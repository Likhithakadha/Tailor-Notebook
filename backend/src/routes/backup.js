const express = require("express");
const db = require("../db");
const { asyncHandler } = require("../middleware/asyncHandler");
const { authRequired } = require("../middleware/auth");

const router = express.Router();
router.use(authRequired);

// GET /api/backup — full JSON export of everything owned by the logged-in shop
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const ownerId = req.user.id;

    const customers = db.prepare("SELECT * FROM customers WHERE owner_id = ?").all(ownerId);
    const customerIds = customers.map((c) => c.id);

    const measurements = customerIds.length
      ? db
          .prepare(
            `SELECT * FROM measurements WHERE customer_id IN (${customerIds.map(() => "?").join(",")})`
          )
          .all(...customerIds)
      : [];

    const orders = db.prepare("SELECT * FROM orders WHERE owner_id = ?").all(ownerId);
    const appointments = db.prepare("SELECT * FROM appointments WHERE owner_id = ?").all(ownerId);
    const catalogItems = db.prepare("SELECT * FROM catalog_items WHERE owner_id = ?").all(ownerId);

    const backup = {
      exportedAt: new Date().toISOString(),
      shop: { email: req.user.email, shopName: req.user.shopName },
      customers,
      measurements,
      orders,
      appointments,
      catalogItems,
    };

    res.setHeader("Content-Disposition", `attachment; filename="tailor-notebook-backup.json"`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(backup, null, 2));
  })
);

module.exports = router;
