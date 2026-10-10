// Demo content for Tailor Notebook.
// Runs automatically on the very first start (when there are no users yet),
// or manually with:  npm run seed   (add --force to wipe and re-create the demo shop)
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const db = require("./db");
const { nextCustomerCode } = require("./db/customerCode");

const DEMO_EMAIL = "demo@tailor.com";
const DEMO_PASSWORD = "demo123";

function daysFromNow(days, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}
const iso = (d) => d.toISOString();
const dateOnly = (d) => d.toISOString().slice(0, 10);
const sqlTime = (d) => d.toISOString().replace("T", " ").slice(0, 19);

async function seedDemo({ force = false } = {}) {
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(DEMO_EMAIL);
  if (existing) {
    if (!force) return false;
    db.prepare("DELETE FROM users WHERE id = ?").run(existing.id); // cascades to all demo data
  }

  const ownerId = uuidv4();
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, shop_name) VALUES (?, ?, ?, ?, 'tailor', ?)`
  ).run(ownerId, "Ravi Kumar", DEMO_EMAIL, hash, "Sri Lakshmi Tailors");

  // ---------- Customers ----------
  const customerData = [
    ["Suresh Babu", "9848012345", "suresh.babu@example.com", "Brodipet, Guntur", "Prefers slim fit. Regular customer.", "male"],
    ["Lakshmi Devi", "9701123456", "lakshmi.devi@example.com", "Arundelpet, Guntur", "Wedding season orders. Likes heavy zari work.", "female"],
    ["Venkata Rao", "9949234567", null, "Lakshmipuram, Guntur", "Office wear - formal shirts and pants.", "male"],
    ["Anitha Reddy", "9866345678", "anitha.reddy@example.com", "Naaz Centre, Guntur", "Saree blouses, boat neck preferred.", "female"],
    ["Pavan Kalyan", "9985456789", null, "Kothapet, Guntur", "Needs delivery before festivals.", "male"],
    ["Sravani Chowdary", "9533567890", "sravani.c@example.com", "Vidya Nagar, Guntur", "College student. Kurtas, salwars and blouses.", "female"],
    ["Mohammed Imran", "9390678901", null, "Chandramouli Nagar, Guntur", "Suit for engagement, fitting twice.", "male"],
    ["Radhika Sharma", "9295789012", "radhika.sharma@example.com", "Gujjanagundla, Guntur", "Alterations also needed time to time.", "female"],
  ];

  const customers = customerData.map(([name, phone, email, address, notes, gender], i) => {
    const id = uuidv4();
    db.prepare(
      `INSERT INTO customers (id, owner_id, name, phone, email, address, notes, gender, customer_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, ownerId, name, phone, email, address, notes, gender, nextCustomerCode(ownerId), sqlTime(daysFromNow(-60 + i * 5)));
    return { id, name };
  });
  const C = (i) => customers[i];

  // ---------- Measurements (with versions) ----------
  function addMeasurement(customer, garmentType, values, version, daysAgo, profileName = "Default") {
    const id = uuidv4();
    db.prepare(
      `INSERT INTO measurements (id, customer_id, garment_type, profile_name, values_json, version, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, customer.id, garmentType, profileName, JSON.stringify(values), version, sqlTime(daysFromNow(-daysAgo)));
    return id;
  }

  const m = {};
  m.sureshShirt1 = addMeasurement(C(0), "shirt", { chest: "38", waist: "34", shoulder: "17", sleeve: "24", length: "29", collar: "15" }, 1, 45);
  m.sureshShirt2 = addMeasurement(C(0), "shirt", { chest: "39", waist: "35", shoulder: "17", sleeve: "24", length: "29", collar: "15.5" }, 2, 10);
  m.sureshPant = addMeasurement(C(0), "pant", { waist: "35", hip: "40", inseam: "31", length: "41", thigh: "24" }, 1, 45);
  m.lakshmiBlouse = addMeasurement(C(1), "blouse", { bust: "36", waist: "32", shoulder: "14", "sleeve-length": "12", length: "15" }, 1, 30);
  m.venkataShirt = addMeasurement(C(2), "shirt", { chest: "42", waist: "38", shoulder: "18", sleeve: "25", length: "30", collar: "16" }, 1, 25);
  m.venkataPant = addMeasurement(C(2), "pant", { waist: "38", hip: "43", inseam: "32", length: "42", thigh: "26" }, 1, 25);
  m.anithaSB1 = addMeasurement(C(3), "saree-blouse", { bust: "34", waist: "30", shoulder: "13.5", "sleeve-length": "10", "blouse-length": "14" }, 1, 40);
  m.anithaSB2 = addMeasurement(C(3), "saree-blouse", { bust: "35", waist: "30", shoulder: "13.5", "sleeve-length": "10", "blouse-length": "14.5" }, 2, 8);
  m.pavanKurta = addMeasurement(C(4), "kurta", { chest: "40", waist: "36", shoulder: "17.5", sleeve: "24", length: "40" }, 1, 20);
  m.sravaniKurta = addMeasurement(C(5), "kurta", { chest: "34", waist: "29", shoulder: "14", sleeve: "22", length: "38" }, 1, 15);
  m.imranSuit = addMeasurement(C(6), "suit", { chest: "40", waist: "34", shoulder: "17.5", sleeve: "25", "jacket-length": "29", "trouser-length": "42" }, 1, 12);
  m.radhikaBlouse = addMeasurement(C(7), "blouse", { bust: "38", waist: "34", shoulder: "14.5", "sleeve-length": "11", length: "15.5" }, 1, 6);

  // Multiple measurement profiles per customer + more dress types
  m.sureshShirtSlim = addMeasurement(C(0), "shirt", { chest: "38", waist: "33", shoulder: "17", sleeve: "24", length: "28.5", collar: "15" }, 1, 20, "Slim fit");
  m.lakshmiBlouseWedding = addMeasurement(C(1), "blouse", { shoulder: "14", bust: "37", waist: "32", "sleeve-length": "12", armhole: "16", "neck-depth": "7", "blouse-length": "15" }, 1, 18, "Wedding fit");
  m.lakshmiBlouseCasual = addMeasurement(C(1), "blouse", { shoulder: "14", bust: "36", waist: "32", "sleeve-length": "6", armhole: "15.5", "neck-depth": "5", "blouse-length": "14.5" }, 1, 12, "Casual fit");
  m.lakshmiSalwar = addMeasurement(C(1), "salwar", { "top-length": "40", bust: "37", waist: "33", hip: "40", shoulder: "14", "sleeve-length": "10", "bottom-length": "38", "bottom-waist": "32" }, 1, 14);
  m.anithaBlouseHeavy = addMeasurement(C(3), "blouse", { shoulder: "13.5", bust: "35", waist: "30", "sleeve-length": "10", armhole: "15", "neck-depth": "8", "blouse-length": "14.5" }, 1, 9, "Boat neck");
  m.sravaniSalwar = addMeasurement(C(5), "salwar", { "top-length": "38", bust: "34", waist: "29", hip: "37", shoulder: "14", "sleeve-length": "9", "bottom-length": "37", "bottom-waist": "28" }, 1, 11);

  // ---------- Orders (all statuses) ----------
  let orderSeq = 0;
  function addOrder(customer, measurementId, garmentType, fabric, price, advance, status, dueInDays, notes, createdDaysAgo, quantity = 1) {
    const id = uuidv4();
    orderSeq += 1;
    db.prepare(
      `INSERT INTO orders
        (id, owner_id, customer_id, measurement_id, order_code, garment_type, fabric_details, quantity, order_date,
         price, advance_paid, status, due_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, ownerId, customer.id, measurementId, "ORD-" + String(orderSeq).padStart(4, "0"), garmentType, fabric,
      quantity, dateOnly(daysFromNow(-createdDaysAgo)), price, advance, status,
      dateOnly(daysFromNow(dueInDays)), notes,
      sqlTime(daysFromNow(-createdDaysAgo)), sqlTime(daysFromNow(-Math.max(0, createdDaysAgo - 2)))
    );
    return id;
  }

  const o = {};
  o.suresh1 = addOrder(C(0), m.sureshShirt2, "shirt", "White cotton, 2.5m", 850, 400, "pending", 7, "Full sleeve, French cuffs", 1);
  o.suresh2 = addOrder(C(0), m.sureshPant, "pant", "Navy blue terry-rayon, 1.3m", 1100, 500, "cutting", 0, "Flat front, no pleats", 3);
  o.lakshmi = addOrder(C(1), m.lakshmiBlouse, "blouse", "Maroon silk with gold zari border", 1800, 900, "stitching", 0, "Back deep neck with tassels", 6);
  o.venkata1 = addOrder(C(2), m.venkataShirt, "shirt", "Light blue formal check, 2.8m", 950, 950, "ready", 1, "Ready for pickup", 9);
  o.venkata2 = addOrder(C(2), m.venkataPant, "pant", "Charcoal grey, 1.4m", 1200, 600, "stitching", -2, null, 5);
  o.anitha = addOrder(C(3), m.anithaSB2, "saree-blouse", "Pink Banarasi silk", 1500, 0, "pending", 10, "Boat neck, hooks at front", 2, 2);
  o.pavan = addOrder(C(4), m.pavanKurta, "kurta", "Cream linen with mandarin collar", 1300, 650, "cutting", 1, "Festival delivery", 2);
  o.sravani = addOrder(C(5), m.sravaniKurta, "kurta", "Yellow cotton printed, 2.2m", 750, 750, "delivered", -3, "Delivered, customer happy", 14, 2);
  o.imran = addOrder(C(6), m.imranSuit, "suit", "Black 3-piece wool blend", 7500, 3000, "stitching", 12, "Engagement - 2 fittings planned", 7);
  o.radhika = addOrder(C(7), m.radhikaBlouse, "blouse", "Green raw silk", 1400, 700, "cancelled", -5, "Customer cancelled the order", 12);

  // Design details (text only - photos are added by the shop from the order form)
  function setDesign(orderId, neck, sleeve, style, instructions) {
    db.prepare(
      "UPDATE orders SET neck_design = ?, sleeve_design = ?, stitching_style = ?, instructions = ? WHERE id = ?"
    ).run(neck, sleeve, style, instructions, orderId);
  }
  setDesign(o.suresh1, "Spread collar", "Full sleeve, French cuff", "Plain, double-stitched seams", "Pocket on left side only");
  setDesign(o.lakshmi, "Deep back, boat front", "Elbow length with tassels", "Lining + piping, hooks at front", "Match zari border with sleeves. Fitting before final stitch.");
  setDesign(o.anitha, "Boat neck", "Short puff sleeve", "Padded, hooks at front", "Keep extra 1 inch margin at the sides");
  setDesign(o.pavan, "Mandarin collar", "Full sleeve", "Side slits, plain placket", "Slightly loose fit, festival wear");
  setDesign(o.imran, "Notch lapel", "Full sleeve, 4 buttons", "3-piece, half canvas", "Two fittings. Slim fit, no vent at back.");

  // ---------- Appointments ----------
  function addAppt(customer, orderId, purpose, when, status, notes) {
    const id = uuidv4();
    db.prepare(
      `INSERT INTO appointments (id, owner_id, customer_id, order_id, purpose, scheduled_at, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, ownerId, customer.id, orderId, purpose, iso(when), status, notes);
    return id;
  }

  addAppt(C(0), o.suresh1, "measurement", daysFromNow(-1, 11), "completed", "Updated shirt measurements");
  addAppt(C(1), o.lakshmi, "fitting", daysFromNow(1, 11), "scheduled", "First fitting for blouse");
  addAppt(C(2), o.venkata1, "delivery", daysFromNow(1, 17), "scheduled", "Pick up shirt after office");
  addAppt(C(6), o.imran, "fitting", daysFromNow(3, 16), "scheduled", "Suit fitting #1");
  addAppt(C(4), o.pavan, "fitting", daysFromNow(4, 12), "scheduled", null);
  addAppt(C(3), o.anitha, "measurement", daysFromNow(2, 15), "scheduled", "Confirm new bust measurement");
  addAppt(C(5), o.sravani, "delivery", daysFromNow(-3, 14), "completed", "Delivered");
  addAppt(C(7), o.radhika, "fitting", daysFromNow(-6, 13), "missed", "Did not turn up");
  addAppt(C(6), o.imran, "fitting", daysFromNow(9, 16), "scheduled", "Suit fitting #2 (final)");

  // ---------- Catalog (fabrics + designs) ----------
  const catalog = [
    ["fabric", "Pure Cotton - White", "Soft breathable cotton, ideal for formal shirts", 220],
    ["fabric", "Terry Rayon - Navy", "Wrinkle-resistant suiting for pants", 450],
    ["fabric", "Banarasi Silk - Pink", "Rich silk with woven zari, for blouses and sarees", 1200],
    ["fabric", "Raw Silk - Green", "Textured silk, festive and wedding wear", 950],
    ["fabric", "Linen - Cream", "Light summer fabric for kurtas and shirts", 520],
    ["fabric", "Wool Blend - Black", "Premium 3-piece suit fabric", 1800],
    ["design", "Boat Neck Blouse", "Wide neckline with back deep cut and tassels", 1500],
    ["design", "Mandarin Collar Kurta", "Straight kurta with short stand collar", 1300],
    ["design", "French Cuff Formal Shirt", "Full sleeve shirt with double cuffs", 950],
    ["design", "Classic 3-Piece Suit", "Jacket, waistcoat and trousers", 7500],
    ["design", "Princess Cut Blouse", "Fitted blouse with curved seams, zari border", 1700],
  ];
  catalog.forEach(([category, name, description, price]) => {
    db.prepare(
      `INSERT INTO catalog_items (id, owner_id, category, name, description, price_per_unit) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(uuidv4(), ownerId, category, name, description, price);
  });

  // ---------- Notifications ----------
  const notes = [
    ["Venkata Rao's shirt order moved to \"ready\"", "order", o.venkata1, 0, 0],
    ["Lakshmi Devi's blouse order moved to \"stitching\"", "order", o.lakshmi, 0, 1],
    ["fitting appointment scheduled with Mohammed Imran", "appointment", null, 0, 1],
    ["New order created: saree-blouse for Anitha Reddy", "order", o.anitha, 1, 2],
    ["Sravani Chowdary's kurta order moved to \"delivered\"", "order", o.sravani, 1, 3],
    ["Radhika Sharma's blouse order moved to \"cancelled\"", "order", o.radhika, 1, 5],
  ];
  notes.forEach(([message, type, relatedId, isRead, daysAgo]) => {
    db.prepare(
      `INSERT INTO notifications (id, owner_id, message, type, related_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(uuidv4(), ownerId, message, type, relatedId, isRead, sqlTime(daysFromNow(-daysAgo)));
  });

  return true;
}

async function seedIfEmpty() {
  const row = db.prepare("SELECT COUNT(*) AS n FROM users").get();
  if (row && row.n > 0) return false;
  const done = await seedDemo();
  if (done) {
    console.log("");
    console.log("Demo content added. Login with:");
    console.log(`   Email:    ${DEMO_EMAIL}`);
    console.log(`   Password: ${DEMO_PASSWORD}`);
    console.log("");
  }
  return done;
}

module.exports = { seedDemo, seedIfEmpty, DEMO_EMAIL, DEMO_PASSWORD };

// Manual run: node src/seed.js [--force]
if (require.main === module) {
  db.ready
    .then(() => seedDemo({ force: process.argv.includes("--force") }))
    .then((done) => {
      if (done) {
        console.log("Demo shop created.");
        console.log(`Email: ${DEMO_EMAIL}  Password: ${DEMO_PASSWORD}`);
      } else {
        console.log("Demo shop already exists. Use --force to wipe and re-create it.");
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}
