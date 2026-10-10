const express = require("express");
const db = require("../db");
const { asyncHandler } = require("../middleware/asyncHandler");
const { authRequired } = require("../middleware/auth");

const router = express.Router();
router.use(authRequired);

// GET /api/measurements?search=&garmentType=&customerId=
// Every saved measurement (all versions) across the shop's customers, for the Measurement Management page.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search, garmentType, customerId } = req.query;
    let sql = `
      SELECT m.*, c.name AS customer_name, c.customer_code, c.phone AS customer_phone, c.gender AS customer_gender
      FROM measurements m JOIN customers c ON c.id = m.customer_id
      WHERE c.owner_id = ?`;
    const params = [req.user.id];

    if (garmentType) {
      sql += " AND m.garment_type = ?";
      params.push(String(garmentType));
    }
    if (customerId) {
      sql += " AND m.customer_id = ?";
      params.push(String(customerId));
    }
    if (search && String(search).trim()) {
      const term = String(search).trim();
      const like = `%${term}%`;
      const digits = term.replace(/[\s-]/g, "");
      sql += ` AND (c.name LIKE ? OR c.customer_code LIKE ? OR m.profile_name LIKE ?
                    OR REPLACE(REPLACE(c.phone, ' ', ''), '-', '') LIKE ?)`;
      params.push(like, like, like, `%${digits}%`);
    }
    sql += " ORDER BY m.recorded_at DESC, m.version DESC";

    const rows = db.prepare(sql).all(...params).map((row) => {
      let values = {};
      try {
        values = JSON.parse(row.values_json);
      } catch {
        values = {};
      }
      return { ...row, values };
    });
    res.json({ measurements: rows });
  })
);

module.exports = router;
