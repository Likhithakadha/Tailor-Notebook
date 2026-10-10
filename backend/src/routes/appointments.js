const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { createNotification } = require("../db/notify");
const { asyncHandler } = require("../middleware/asyncHandler");
const { authRequired } = require("../middleware/auth");

const router = express.Router();
router.use(authRequired);

const VALID_STATUSES = ["scheduled", "completed", "cancelled", "missed"];
const VALID_PURPOSES = ["measurement", "fitting", "delivery"];

function getOwnedAppointment(id, ownerId) {
  return db.prepare("SELECT * FROM appointments WHERE id = ? AND owner_id = ?").get(id, ownerId);
}

// GET /api/appointments?from=&to=&status=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { from, to, status } = req.query;
    let query = `SELECT appointments.*, customers.name as customer_name, customers.phone as customer_phone
                 FROM appointments JOIN customers ON customers.id = appointments.customer_id
                 WHERE appointments.owner_id = ?`;
    const params = [req.user.id];

    if (from) {
      query += " AND appointments.scheduled_at >= ?";
      params.push(from);
    }
    if (to) {
      query += " AND appointments.scheduled_at <= ?";
      params.push(to);
    }
    if (status) {
      query += " AND appointments.status = ?";
      params.push(status);
    }
    query += " ORDER BY appointments.scheduled_at ASC";

    const rows = db.prepare(query).all(...params);
    res.json({ appointments: rows });
  })
);

// POST /api/appointments
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { customerId, orderId, purpose, scheduledAt, notes } = req.body;

    if (!customerId || !scheduledAt) {
      return res.status(400).json({ error: "customerId and scheduledAt are required" });
    }
    if (purpose && !VALID_PURPOSES.includes(purpose)) {
      return res
        .status(400)
        .json({ error: `purpose must be one of: ${VALID_PURPOSES.join(", ")}` });
    }

    const customer = db
      .prepare("SELECT id, name FROM customers WHERE id = ? AND owner_id = ?")
      .get(customerId, req.user.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const id = uuidv4();
    db.prepare(
      `INSERT INTO appointments (id, owner_id, customer_id, order_id, purpose, scheduled_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.user.id, customerId, orderId || null, purpose || "fitting", scheduledAt, notes || null);

    const appointment = db.prepare("SELECT * FROM appointments WHERE id = ?").get(id);

    createNotification(
      req.user.id,
      `${purpose || "fitting"} appointment scheduled with ${customer.name} on ${new Date(
        scheduledAt
      ).toLocaleString()}`,
      "appointment",
      id
    );

    res.status(201).json({ appointment });
  })
);

// PATCH /api/appointments/:id/status
router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const appt = getOwnedAppointment(req.params.id, req.user.id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    }

    db.prepare("UPDATE appointments SET status = ? WHERE id = ?").run(status, appt.id);
    const updated = db.prepare("SELECT * FROM appointments WHERE id = ?").get(appt.id);
    res.json({ appointment: updated });
  })
);

// DELETE /api/appointments/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const appt = getOwnedAppointment(req.params.id, req.user.id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    db.prepare("DELETE FROM appointments WHERE id = ?").run(appt.id);
    res.status(204).send();
  })
);

module.exports = router;
