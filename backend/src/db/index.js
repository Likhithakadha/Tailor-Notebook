const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");
require("dotenv").config();

const DB_PATH = process.env.DB_PATH || "./data/tailor_notebook.db";
const resolvedPath = path.resolve(__dirname, "../../", DB_PATH);

const dataDir = path.dirname(resolvedPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let inst = null;

function save() {
  const data = inst.export();
  inst.run("PRAGMA foreign_keys = ON"); // export() resets this pragma
  fs.writeFileSync(resolvedPath, Buffer.from(data));
}

function clean(params) {
  return params.map((p) => (p === undefined ? null : p));
}

// Small wrapper that mimics the better-sqlite3 API used across the routes
const db = {
  prepare(sql) {
    return {
      run(...params) {
        inst.run(sql, clean(params));
        const changes = inst.getRowsModified();
        save();
        return { changes };
      },
      get(...params) {
        const stmt = inst.prepare(sql);
        try {
          stmt.bind(clean(params));
          return stmt.step() ? stmt.getAsObject() : undefined;
        } finally {
          stmt.free();
        }
      },
      all(...params) {
        const stmt = inst.prepare(sql);
        const rows = [];
        try {
          stmt.bind(clean(params));
          while (stmt.step()) rows.push(stmt.getAsObject());
        } finally {
          stmt.free();
        }
        return rows;
      },
    };
  },
  exec(sql) {
    inst.exec(sql);
    save();
  },
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'tailor',
  shop_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  notes TEXT,
  gender TEXT,
  customer_code TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS measurements (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  garment_type TEXT NOT NULL,
  profile_name TEXT NOT NULL DEFAULT 'Default',
  values_json TEXT NOT NULL,
  notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  measurement_id TEXT REFERENCES measurements(id) ON DELETE SET NULL,
  order_code TEXT,
  garment_type TEXT NOT NULL,
  fabric_details TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  order_date TEXT,
  design_photo TEXT,
  neck_design TEXT,
  sleeve_design TEXT,
  stitching_style TEXT,
  instructions TEXT,
  price REAL NOT NULL DEFAULT 0,
  advance_paid REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  purpose TEXT NOT NULL DEFAULT 'fitting',
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catalog_items (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'fabric',
  name TEXT NOT NULL,
  description TEXT,
  price_per_unit REAL,
  image_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'order',
  related_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(owner_id);
CREATE INDEX IF NOT EXISTS idx_measurements_customer ON measurements(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_owner ON orders(owner_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_appointments_owner ON appointments(owner_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_catalog_owner ON catalog_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_notifications_owner ON notifications(owner_id, is_read);
`;

function columnExists(table, column) {
  const res = inst.exec(`PRAGMA table_info(${table})`);
  if (!res.length) return false;
  const nameIdx = res[0].columns.indexOf("name");
  return res[0].values.some((row) => row[nameIdx] === column);
}

// Upgrades databases created by older versions of the app (adds new columns, backfills customer IDs)
function migrate() {
  if (!columnExists("customers", "gender")) {
    inst.run("ALTER TABLE customers ADD COLUMN gender TEXT");
  }
  if (!columnExists("customers", "customer_code")) {
    inst.run("ALTER TABLE customers ADD COLUMN customer_code TEXT");
  }
  if (!columnExists("measurements", "profile_name")) {
    inst.run("ALTER TABLE measurements ADD COLUMN profile_name TEXT NOT NULL DEFAULT 'Default'");
  }
  if (!columnExists("measurements", "notes")) {
    inst.run("ALTER TABLE measurements ADD COLUMN notes TEXT");
  }

  // Give every existing customer a readable ID (CUST-0001, CUST-0002 ...) per shop, oldest first
  const owners = inst.exec("SELECT DISTINCT owner_id FROM customers WHERE customer_code IS NULL");
  if (owners.length) {
    for (const [ownerId] of owners[0].values) {
      const maxRes = inst.exec("SELECT customer_code FROM customers WHERE owner_id = ? AND customer_code IS NOT NULL", [ownerId]);
      let max = 0;
      if (maxRes.length) {
        for (const [code] of maxRes[0].values) {
          const m = /(\d+)$/.exec(code || "");
          if (m) max = Math.max(max, parseInt(m[1], 10));
        }
      }
      const rows = inst.exec(
        "SELECT id FROM customers WHERE owner_id = ? AND customer_code IS NULL ORDER BY created_at, rowid",
        [ownerId]
      );
      for (const [id] of rows[0].values) {
        max += 1;
        inst.run("UPDATE customers SET customer_code = ? WHERE id = ?", [
          "CUST-" + String(max).padStart(4, "0"),
          id,
        ]);
      }
    }
  }

  // Orders: readable order ID (ORD-0001 ...), quantity and order date
  if (!columnExists("orders", "order_code")) {
    inst.run("ALTER TABLE orders ADD COLUMN order_code TEXT");
  }
  if (!columnExists("orders", "quantity")) {
    inst.run("ALTER TABLE orders ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1");
  }
  if (!columnExists("orders", "order_date")) {
    inst.run("ALTER TABLE orders ADD COLUMN order_date TEXT");
  }
  for (const col of ["design_photo", "neck_design", "sleeve_design", "stitching_style", "instructions"]) {
    if (!columnExists("orders", col)) inst.run(`ALTER TABLE orders ADD COLUMN ${col} TEXT`);
  }
  inst.run("UPDATE orders SET order_date = date(created_at) WHERE order_date IS NULL");
  const orderOwners = inst.exec("SELECT DISTINCT owner_id FROM orders WHERE order_code IS NULL");
  if (orderOwners.length) {
    for (const [ownerId] of orderOwners[0].values) {
      const maxRes = inst.exec("SELECT order_code FROM orders WHERE owner_id = ? AND order_code IS NOT NULL", [ownerId]);
      let max = 0;
      if (maxRes.length) {
        for (const [code] of maxRes[0].values) {
          const m = /(\d+)$/.exec(code || "");
          if (m) max = Math.max(max, parseInt(m[1], 10));
        }
      }
      const rows = inst.exec(
        "SELECT id FROM orders WHERE owner_id = ? AND order_code IS NULL ORDER BY created_at, rowid",
        [ownerId]
      );
      for (const [id] of rows[0].values) {
        max += 1;
        inst.run("UPDATE orders SET order_code = ? WHERE id = ?", ["ORD-" + String(max).padStart(4, "0"), id]);
      }
    }
  }
  inst.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_code ON orders(owner_id, order_code)");
  inst.run("CREATE INDEX IF NOT EXISTS idx_orders_due ON orders(owner_id, due_date)");

  inst.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_code ON customers(owner_id, customer_code)");
  inst.run("CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(owner_id, phone)");
  inst.run(
    "CREATE INDEX IF NOT EXISTS idx_measurements_profile ON measurements(customer_id, garment_type, profile_name)"
  );
}

// Server awaits this before it starts listening
db.ready = initSqlJs().then((SQL) => {
  inst = fs.existsSync(resolvedPath)
    ? new SQL.Database(fs.readFileSync(resolvedPath))
    : new SQL.Database();
  inst.run("PRAGMA foreign_keys = ON");
  inst.exec(SCHEMA);
  migrate();
  save();
});

module.exports = db;
