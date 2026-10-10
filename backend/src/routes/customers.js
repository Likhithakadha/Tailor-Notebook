const express = require("express");
const { v4: uuidv4 } = require("uuid");
const PDFDocument = require("pdfkit");
const db = require("../db");
const { removePhoto } = require("../db/photos");
const { nextCustomerCode } = require("../db/customerCode");
const { asyncHandler } = require("../middleware/asyncHandler");
const { authRequired } = require("../middleware/auth");

const router = express.Router();
router.use(authRequired);

const GENDERS = ["male", "female", "other"];

// Helper: ensure the customer belongs to the logged-in tailor
function getOwnedCustomer(customerId, ownerId) {
  return db
    .prepare("SELECT * FROM customers WHERE id = ? AND owner_id = ?")
    .get(customerId, ownerId);
}

// Compare phone numbers by their last 10 digits so "+91 98480 12345" equals "9848012345"
function phoneKey(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

function cleanGender(value) {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  const g = String(value).toLowerCase();
  return GENDERS.includes(g) ? { ok: true, value: g } : { ok: false };
}

function parseValues(row) {
  let values = {};
  try {
    values = JSON.parse(row.values_json);
  } catch {
    values = {};
  }
  return { ...row, values };
}

// Validate a { field: number } object coming from the measurement form
function cleanMeasurementValues(values) {
  if (!values || typeof values !== "object" || Array.isArray(values)) return null;
  const out = {};
  for (const [key, raw] of Object.entries(values)) {
    if (raw === "" || raw === null || raw === undefined) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || n > 500) return { error: `"${key}" must be a positive number` };
    out[key] = String(n);
  }
  if (Object.keys(out).length === 0) return { error: "Enter at least one measurement" };
  return { values: out };
}

const CUSTOMER_LIST_SQL = `
  SELECT c.*,
    (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count,
    (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) AS last_order_at,
    (SELECT COUNT(*) FROM measurements m WHERE m.customer_id = c.id) AS measurement_count
  FROM customers c
`;

// GET /api/customers?search=&gender=   (search matches name, phone or customer ID)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search, gender } = req.query;
    let sql = `${CUSTOMER_LIST_SQL} WHERE c.owner_id = ?`;
    const params = [req.user.id];

    if (search && String(search).trim()) {
      const term = String(search).trim();
      const like = `%${term}%`;
      const digits = term.replace(/[\s-]/g, "");
      sql += ` AND (c.name LIKE ? OR c.customer_code LIKE ? OR c.phone LIKE ?
                    OR REPLACE(REPLACE(c.phone, ' ', ''), '-', '') LIKE ?)`;
      params.push(like, like, like, `%${digits}%`);
    }
    if (gender && GENDERS.includes(String(gender))) {
      sql += " AND c.gender = ?";
      params.push(String(gender));
    }
    sql += " ORDER BY c.created_at DESC, c.rowid DESC";

    res.json({ customers: db.prepare(sql).all(...params) });
  })
);

// POST /api/customers
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, phone, email, address, notes, gender, allowDuplicatePhone } = req.body;
    if (!name || !String(name).trim() || !phone || !String(phone).trim()) {
      return res.status(400).json({ error: "name and phone are required" });
    }
    const digitCount = String(phone).replace(/\D/g, "").length;
    if (digitCount < 7 || digitCount > 15) {
      return res.status(400).json({ error: "Enter a valid phone number (7 to 15 digits)" });
    }
    const g = cleanGender(gender);
    if (!g.ok) return res.status(400).json({ error: "gender must be male, female or other" });

    // Returning customer? Point the tailor to the existing record instead of creating a duplicate.
    if (!allowDuplicatePhone) {
      const key = phoneKey(phone);
      const owned = db.prepare("SELECT * FROM customers WHERE owner_id = ?").all(req.user.id);
      const existing = owned.find((c) => phoneKey(c.phone) === key);
      if (existing) {
        return res.status(409).json({
          error: `A customer with this phone number already exists (${existing.customer_code} - ${existing.name})`,
          existing,
        });
      }
    }

    const id = uuidv4();
    db.prepare(
      `INSERT INTO customers (id, owner_id, name, phone, email, address, notes, gender, customer_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.user.id,
      String(name).trim(),
      String(phone).trim(),
      email || null,
      address || null,
      notes || null,
      g.value,
      nextCustomerCode(req.user.id)
    );

    const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
    res.status(201).json({ customer });
  })
);

// GET /api/customers/:id  (with measurement profiles and previous orders)
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const customer = getOwnedCustomer(req.params.id, req.user.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const measurements = db
      .prepare(
        `SELECT * FROM measurements WHERE customer_id = ?
         ORDER BY recorded_at DESC, version DESC`
      )
      .all(customer.id)
      .map(parseValues);

    const orders = db
      .prepare(
        `SELECT orders.*, measurements.profile_name AS measurement_profile,
                measurements.version AS measurement_version
         FROM orders LEFT JOIN measurements ON measurements.id = orders.measurement_id
         WHERE orders.customer_id = ? ORDER BY orders.created_at DESC`
      )
      .all(customer.id);

    res.json({ customer, measurements, orders });
  })
);

// PUT /api/customers/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const customer = getOwnedCustomer(req.params.id, req.user.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const { name, phone, email, address, notes, gender } = req.body;
    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ error: "name cannot be empty" });
    }
    if (phone !== undefined) {
      const digitCount = String(phone).replace(/\D/g, "").length;
      if (digitCount < 7 || digitCount > 15) {
        return res.status(400).json({ error: "Enter a valid phone number (7 to 15 digits)" });
      }
    }
    let genderValue = customer.gender;
    if (gender !== undefined) {
      const g = cleanGender(gender);
      if (!g.ok) return res.status(400).json({ error: "gender must be male, female or other" });
      genderValue = g.value;
    }

    db.prepare(
      `UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, notes = ?, gender = ?
       WHERE id = ?`
    ).run(
      name !== undefined ? String(name).trim() : customer.name,
      phone !== undefined ? String(phone).trim() : customer.phone,
      email ?? customer.email,
      address ?? customer.address,
      notes ?? customer.notes,
      genderValue,
      customer.id
    );

    const updated = db.prepare("SELECT * FROM customers WHERE id = ?").get(customer.id);
    res.json({ customer: updated });
  })
);

// DELETE /api/customers/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const customer = getOwnedCustomer(req.params.id, req.user.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    const photos = db.prepare("SELECT design_photo FROM orders WHERE customer_id = ?").all(customer.id);
    db.prepare("DELETE FROM customers WHERE id = ?").run(customer.id);
    photos.forEach((r) => removePhoto(r.design_photo));
    res.status(204).send();
  })
);

// ---------- Measurements (nested under a customer) ----------
// A customer can have many measurement PROFILES per dress type (e.g. blouse "Wedding fit",
// blouse "Casual fit"). Every save inside a profile creates a new VERSION, so history is kept.

// POST /api/customers/:id/measurements
router.post(
  "/:id/measurements",
  asyncHandler(async (req, res) => {
    const customer = getOwnedCustomer(req.params.id, req.user.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const { garmentType, values, profileName, notes } = req.body;
    if (!garmentType || !String(garmentType).trim()) {
      return res.status(400).json({ error: "garmentType is required" });
    }
    const cleaned = cleanMeasurementValues(values);
    if (!cleaned) return res.status(400).json({ error: "values object is required" });
    if (cleaned.error) return res.status(400).json({ error: cleaned.error });

    const profile = (profileName && String(profileName).trim()) || "Default";
    if (profile.length > 60) {
      return res.status(400).json({ error: "Profile name must be 60 characters or fewer" });
    }

    const lastVersion = db
      .prepare(
        `SELECT MAX(version) as v FROM measurements
         WHERE customer_id = ? AND garment_type = ? AND profile_name = ?`
      )
      .get(customer.id, garmentType, profile);
    const version = (lastVersion?.v || 0) + 1;

    const id = uuidv4();
    db.prepare(
      `INSERT INTO measurements (id, customer_id, garment_type, profile_name, values_json, notes, version)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, customer.id, garmentType, profile, JSON.stringify(cleaned.values), notes || null, version);

    const measurement = db.prepare("SELECT * FROM measurements WHERE id = ?").get(id);
    res.status(201).json({ measurement: parseValues(measurement) });
  })
);

// GET /api/customers/:id/measurements
router.get(
  "/:id/measurements",
  asyncHandler(async (req, res) => {
    const customer = getOwnedCustomer(req.params.id, req.user.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const rows = db
      .prepare(
        `SELECT * FROM measurements WHERE customer_id = ?
         ORDER BY recorded_at DESC, version DESC`
      )
      .all(customer.id);

    res.json({ measurements: rows.map(parseValues) });
  })
);

// PUT /api/customers/:id/measurement-profiles  { garmentType, from, to }  -> rename a profile
router.put(
  "/:id/measurement-profiles",
  asyncHandler(async (req, res) => {
    const customer = getOwnedCustomer(req.params.id, req.user.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const { garmentType, from, to } = req.body;
    const newName = to && String(to).trim();
    if (!garmentType || !from || !newName) {
      return res.status(400).json({ error: "garmentType, from and to are required" });
    }
    if (newName.length > 60) {
      return res.status(400).json({ error: "Profile name must be 60 characters or fewer" });
    }
    if (newName !== from) {
      const clash = db
        .prepare(
          "SELECT id FROM measurements WHERE customer_id = ? AND garment_type = ? AND profile_name = ?"
        )
        .get(customer.id, garmentType, newName);
      if (clash) {
        return res.status(409).json({ error: `A ${garmentType} profile named "${newName}" already exists` });
      }
    }
    db.prepare(
      "UPDATE measurements SET profile_name = ? WHERE customer_id = ? AND garment_type = ? AND profile_name = ?"
    ).run(newName, customer.id, garmentType, from);
    res.json({ ok: true });
  })
);

// DELETE /api/customers/:id/measurements/:measurementId  (one version)
router.delete(
  "/:id/measurements/:measurementId",
  asyncHandler(async (req, res) => {
    const customer = getOwnedCustomer(req.params.id, req.user.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const measurement = db
      .prepare("SELECT id FROM measurements WHERE id = ? AND customer_id = ?")
      .get(req.params.measurementId, customer.id);
    if (!measurement) return res.status(404).json({ error: "Measurement not found" });

    db.prepare("DELETE FROM measurements WHERE id = ?").run(measurement.id);
    res.status(204).send();
  })
);

// GET /api/customers/:id/measurements/:measurementId/pdf — printable measurement card
router.get(
  "/:id/measurements/:measurementId/pdf",
  asyncHandler(async (req, res) => {
    const customer = getOwnedCustomer(req.params.id, req.user.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const measurement = db
      .prepare("SELECT * FROM measurements WHERE id = ? AND customer_id = ?")
      .get(req.params.measurementId, customer.id);
    if (!measurement) return res.status(404).json({ error: "Measurement not found" });

    const values = JSON.parse(measurement.values_json);
    const safe = (s) => String(s).replace(/[^A-Za-z0-9_-]+/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safe(customer.name)}_${safe(measurement.garment_type)}_${safe(measurement.profile_name)}_v${measurement.version}.pdf"`
    );

    const doc = new PDFDocument({ size: "A5", margin: 40 });
    doc.pipe(res);

    doc
      .fontSize(18)
      .text(req.user.shopName || "Tailor Notebook", { align: "center" })
      .moveDown(0.2)
      .fontSize(10)
      .fillColor("#666")
      .text("Measurement Card", { align: "center" })
      .fillColor("#000")
      .moveDown(1);

    doc.fontSize(12).text(`Customer: ${customer.name}${customer.customer_code ? `  (${customer.customer_code})` : ""}`);
    doc.text(`Phone: ${customer.phone}`);
    if (customer.gender) doc.text(`Gender: ${customer.gender}`);
    doc.text(`Dress type: ${measurement.garment_type}`);
    doc.text(`Profile: ${measurement.profile_name} (version ${measurement.version})`);
    doc.text(`Recorded: ${new Date(measurement.recorded_at).toLocaleDateString()}`);
    doc.moveDown(1);

    doc.fontSize(13).text("Measurements", { underline: true });
    doc.moveDown(0.5);
    Object.entries(values).forEach(([key, val]) => {
      doc.fontSize(11).text(`${key.replace(/-/g, " ")}:  ${val} in`);
    });

    if (measurement.notes) {
      doc.moveDown(1);
      doc.fontSize(11).text(`Notes: ${measurement.notes}`);
    }

    doc.moveDown(1.5);
    doc.fontSize(9).fillColor("#888").text("Generated by Tailor Notebook", { align: "center" });

    doc.end();
  })
);

module.exports = router;
