const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { createNotification } = require("../db/notify");
const { nextOrderCode } = require("../db/orderCode");
const { savePhoto, removePhoto } = require("../db/photos");
const { asyncHandler } = require("../middleware/asyncHandler");
const { authRequired } = require("../middleware/auth");

const router = express.Router();
router.use(authRequired);

const VALID_STATUSES = ["pending", "cutting", "stitching", "ready", "delivered", "cancelled"];
const DELIVERY_FILTERS = ["today", "tomorrow", "upcoming", "delayed"];
const PAYMENT_FILTERS = ["paid", "partial", "pending"];

// ---------- helpers ----------

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayAndTomorrow() {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { today: ymd(now), tomorrow: ymd(tomorrow) };
}

function dayDiff(fromYmd, toYmd) {
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

// delivery_state: today | tomorrow | upcoming | delayed | no_date (still in progress)
//                 delivered | cancelled (finished orders are never "delayed")
function deliveryState(order, today, tomorrow) {
  if (order.status === "delivered") return "delivered";
  if (order.status === "cancelled") return "cancelled";
  const due = (order.due_date || "").slice(0, 10);
  if (!due) return "no_date";
  if (due < today) return "delayed";
  if (due === today) return "today";
  if (due === tomorrow) return "tomorrow";
  return "upcoming";
}

// payment_status: paid | partial | pending
function paymentStatus(price, paid) {
  const remaining = Math.max(price - paid, 0);
  if (price > 0 && remaining <= 0) return "paid";
  if (paid <= 0) return "pending";
  return "partial";
}

function enrich(row, today, tomorrow) {
  const price = Number(row.price) || 0;
  const paid = Number(row.advance_paid) || 0;
  const out = { ...row };
  out.remaining_amount = Math.max(price - paid, 0);
  out.payment_status = paymentStatus(price, paid);
  out.delivery_state = deliveryState(row, today, tomorrow);
  const due = (row.due_date || "").slice(0, 10);
  out.days_to_delivery = due ? dayDiff(today, due) : null;
  if (row.measurement_values_json !== undefined) {
    try {
      out.measurement_values = row.measurement_values_json ? JSON.parse(row.measurement_values_json) : null;
    } catch {
      out.measurement_values = null;
    }
    delete out.measurement_values_json;
  }
  return out;
}

function getOwnedOrder(orderId, ownerId) {
  return db.prepare("SELECT * FROM orders WHERE id = ? AND owner_id = ?").get(orderId, ownerId);
}

function validDate(v) {
  return v === null || v === undefined || v === "" || /^\d{4}-\d{2}-\d{2}$/.test(String(v));
}

function cleanText(v, max = 200) {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t ? t.slice(0, max) : null;
}

function parseQuantity(v, fallback = 1) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

// ---------- routes ----------

// GET /api/orders?status=&customerId=&delivery=today|tomorrow|upcoming|delayed&payment=paid|partial|pending&q=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, customerId, delivery, payment, q } = req.query;

    if (delivery && !DELIVERY_FILTERS.includes(delivery)) {
      return res.status(400).json({ error: `delivery must be one of: ${DELIVERY_FILTERS.join(", ")}` });
    }
    if (payment && !PAYMENT_FILTERS.includes(payment)) {
      return res.status(400).json({ error: `payment must be one of: ${PAYMENT_FILTERS.join(", ")}` });
    }

    let query = `SELECT orders.*, customers.name as customer_name, customers.phone as customer_phone,
                        customers.customer_code as customer_code,
                        measurements.profile_name as measurement_profile,
                        measurements.version as measurement_version,
                        measurements.values_json as measurement_values_json
                 FROM orders JOIN customers ON customers.id = orders.customer_id
                 LEFT JOIN measurements ON measurements.id = orders.measurement_id
                 WHERE orders.owner_id = ?`;
    const params = [req.user.id];

    if (status) {
      query += " AND orders.status = ?";
      params.push(status);
    }
    if (customerId) {
      query += " AND orders.customer_id = ?";
      params.push(customerId);
    }
    if (q && String(q).trim()) {
      const like = `%${String(q).trim()}%`;
      query += ` AND (orders.order_code LIKE ? OR customers.name LIKE ? OR customers.phone LIKE ?
                      OR customers.customer_code LIKE ? OR orders.fabric_details LIKE ?)`;
      params.push(like, like, like, like, like);
    }
    query += " ORDER BY orders.created_at DESC";

    const { today, tomorrow } = todayAndTomorrow();
    let rows = db.prepare(query).all(...params).map((r) => enrich(r, today, tomorrow));

    if (delivery) rows = rows.filter((r) => r.delivery_state === delivery);
    if (payment) rows = rows.filter((r) => r.payment_status === payment);

    // Delivery views: the most urgent date first
    if (delivery) {
      rows.sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
    }

    res.json({ orders: rows });
  })
);

// POST /api/orders
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      customerId,
      measurementId,
      garmentType,
      fabricDetails,
      quantity,
      orderDate,
      price,
      advancePaid,
      dueDate,
      notes,
      neckDesign,
      sleeveDesign,
      stitchingStyle,
      instructions,
      designPhoto,
    } = req.body;

    if (!customerId || !garmentType) {
      return res.status(400).json({ error: "customerId and garmentType are required" });
    }

    const customer = db
      .prepare("SELECT id, name FROM customers WHERE id = ? AND owner_id = ?")
      .get(customerId, req.user.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    if (measurementId) {
      // The linked measurement profile must belong to this same customer
      const measurement = db
        .prepare("SELECT id FROM measurements WHERE id = ? AND customer_id = ?")
        .get(measurementId, customerId);
      if (!measurement) {
        return res.status(400).json({ error: "That measurement does not belong to this customer" });
      }
    }
    if ((price !== undefined && Number(price) < 0) || (advancePaid !== undefined && Number(advancePaid) < 0)) {
      return res.status(400).json({ error: "price and advancePaid cannot be negative" });
    }
    if (Number(advancePaid || 0) > Number(price || 0)) {
      return res.status(400).json({ error: "advancePaid cannot be more than the price" });
    }
    const qty = parseQuantity(quantity);
    if (qty === null) return res.status(400).json({ error: "quantity must be a whole number, 1 or more" });
    if (!validDate(orderDate) || !validDate(dueDate)) {
      return res.status(400).json({ error: "Dates must be in YYYY-MM-DD format" });
    }
    const placedOn = orderDate || todayAndTomorrow().today;
    if (dueDate && dueDate < placedOn) {
      return res.status(400).json({ error: "Delivery date cannot be before the order date" });
    }

    const photoPath = designPhoto ? savePhoto(designPhoto) : null;

    const id = uuidv4();
    const orderCode = nextOrderCode(req.user.id);
    db.prepare(
      `INSERT INTO orders
        (id, owner_id, customer_id, measurement_id, order_code, garment_type, fabric_details, quantity, order_date,
         price, advance_paid, due_date, notes, design_photo, neck_design, sleeve_design, stitching_style, instructions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.user.id,
      customerId,
      measurementId || null,
      orderCode,
      garmentType,
      fabricDetails || null,
      qty,
      placedOn,
      price || 0,
      advancePaid || 0,
      dueDate || null,
      notes || null,
      photoPath,
      cleanText(neckDesign),
      cleanText(sleeveDesign),
      cleanText(stitchingStyle),
      cleanText(instructions, 1000)
    );

    const { today, tomorrow } = todayAndTomorrow();
    const order = enrich(db.prepare("SELECT * FROM orders WHERE id = ?").get(id), today, tomorrow);

    createNotification(
      req.user.id,
      `New order ${orderCode}: ${garmentType} for ${customer.name || "customer"}`,
      "order",
      order.id
    );

    res.status(201).json({ order });
  })
);

// PATCH /api/orders/:id/status
router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const order = getOwnedOrder(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    }

    db.prepare(
      "UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(status, order.id);

    const { today, tomorrow } = todayAndTomorrow();
    const updated = enrich(db.prepare("SELECT * FROM orders WHERE id = ?").get(order.id), today, tomorrow);

    const customer = db.prepare("SELECT name FROM customers WHERE id = ?").get(order.customer_id);
    createNotification(
      req.user.id,
      `${customer?.name || "Customer"}'s ${order.garment_type} order ${order.order_code || ""} moved to "${status}"`.replace("  ", " "),
      "order",
      order.id
    );

    res.json({ order: updated });
  })
);

// POST /api/orders/:id/payments  { amount }  -> records a payment received (added to the amount paid so far)
router.post(
  "/:id/payments",
  asyncHandler(async (req, res) => {
    const order = getOwnedOrder(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Payment amount must be more than 0" });
    }
    const remaining = Math.max((order.price || 0) - (order.advance_paid || 0), 0);
    if (amount > remaining) {
      return res.status(400).json({ error: `Payment cannot be more than the remaining amount (₹${remaining})` });
    }

    db.prepare(
      "UPDATE orders SET advance_paid = advance_paid + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(amount, order.id);

    const { today, tomorrow } = todayAndTomorrow();
    const updated = enrich(db.prepare("SELECT * FROM orders WHERE id = ?").get(order.id), today, tomorrow);

    const customer = db.prepare("SELECT name FROM customers WHERE id = ?").get(order.customer_id);
    createNotification(
      req.user.id,
      `₹${amount} received from ${customer?.name || "customer"} for ${order.order_code || "order"}` +
        (updated.payment_status === "paid" ? " - fully paid" : ` - ₹${updated.remaining_amount} remaining`),
      "payment",
      order.id
    );

    res.json({ order: updated });
  })
);

// PUT /api/orders/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const order = getOwnedOrder(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const {
      fabricDetails,
      quantity,
      orderDate,
      price,
      advancePaid,
      dueDate,
      notes,
      neckDesign,
      sleeveDesign,
      stitchingStyle,
      instructions,
      designPhoto,
      removeDesignPhoto,
    } = req.body;

    const newPrice = price ?? order.price;
    const newAdvance = advancePaid ?? order.advance_paid;
    if (Number(newPrice) < 0 || Number(newAdvance) < 0) {
      return res.status(400).json({ error: "price and advancePaid cannot be negative" });
    }
    if (Number(newAdvance) > Number(newPrice)) {
      return res.status(400).json({ error: "Amount paid cannot be more than the price" });
    }
    const qty = parseQuantity(quantity, order.quantity || 1);
    if (qty === null) return res.status(400).json({ error: "quantity must be a whole number, 1 or more" });
    if (!validDate(orderDate) || !validDate(dueDate)) {
      return res.status(400).json({ error: "Dates must be in YYYY-MM-DD format" });
    }
    const newOrderDate = orderDate || order.order_date;
    const newDue = dueDate === "" ? null : dueDate ?? order.due_date;
    if (newDue && newOrderDate && newDue < newOrderDate) {
      return res.status(400).json({ error: "Delivery date cannot be before the order date" });
    }

    // Photo: new upload replaces the old file; removeDesignPhoto deletes it
    let photoPath = order.design_photo;
    if (designPhoto) {
      photoPath = savePhoto(designPhoto);
    } else if (removeDesignPhoto) {
      photoPath = null;
    }

    db.prepare(
      `UPDATE orders SET fabric_details = ?, quantity = ?, order_date = ?, price = ?, advance_paid = ?,
       due_date = ?, notes = ?, design_photo = ?, neck_design = ?, sleeve_design = ?, stitching_style = ?,
       instructions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(
      fabricDetails ?? order.fabric_details,
      qty,
      newOrderDate,
      newPrice,
      newAdvance,
      newDue,
      notes ?? order.notes,
      photoPath,
      neckDesign !== undefined ? cleanText(neckDesign) : order.neck_design,
      sleeveDesign !== undefined ? cleanText(sleeveDesign) : order.sleeve_design,
      stitchingStyle !== undefined ? cleanText(stitchingStyle) : order.stitching_style,
      instructions !== undefined ? cleanText(instructions, 1000) : order.instructions,
      order.id
    );
    if (photoPath !== order.design_photo) removePhoto(order.design_photo);

    const { today, tomorrow } = todayAndTomorrow();
    const updated = enrich(db.prepare("SELECT * FROM orders WHERE id = ?").get(order.id), today, tomorrow);
    res.json({ order: updated });
  })
);

// DELETE /api/orders/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const order = getOwnedOrder(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    db.prepare("DELETE FROM orders WHERE id = ?").run(order.id);
    removePhoto(order.design_photo);
    res.status(204).send();
  })
);

// GET /api/orders/meta/summary -> counts by status, delivery buckets and pending payments (dashboard + tab badges)
router.get(
  "/meta/summary",
  asyncHandler(async (req, res) => {
    const rows = db.prepare("SELECT * FROM orders WHERE owner_id = ?").all(req.user.id);
    const { today, tomorrow } = todayAndTomorrow();

    const summary = Object.fromEntries(VALID_STATUSES.map((s) => [s, 0]));
    const delivery = { today: 0, tomorrow: 0, upcoming: 0, delayed: 0 };
    const payments = { paid: 0, partial: 0, pending: 0, pendingAmount: 0 };

    for (const r of rows) {
      summary[r.status] = (summary[r.status] || 0) + 1;
      const state = deliveryState(r, today, tomorrow);
      if (delivery[state] !== undefined) delivery[state] += 1;
      if (r.status !== "cancelled") {
        const price = Number(r.price) || 0;
        const paid = Number(r.advance_paid) || 0;
        payments[paymentStatus(price, paid)] += 1;
        payments.pendingAmount += Math.max(price - paid, 0);
      }
    }
    res.json({ summary, delivery, payments });
  })
);

module.exports = router;
