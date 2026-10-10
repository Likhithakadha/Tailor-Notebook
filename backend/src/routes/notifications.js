const express = require("express");
const db = require("../db");
const { asyncHandler } = require("../middleware/asyncHandler");
const { authRequired } = require("../middleware/auth");

const router = express.Router();
router.use(authRequired);

// GET /api/notifications?unreadOnly=true
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { unreadOnly } = req.query;
    let rows;
    if (unreadOnly === "true") {
      rows = db
        .prepare(
          "SELECT * FROM notifications WHERE owner_id = ? AND is_read = 0 ORDER BY created_at DESC"
        )
        .all(req.user.id);
    } else {
      rows = db
        .prepare(
          "SELECT * FROM notifications WHERE owner_id = ? ORDER BY created_at DESC LIMIT 50"
        )
        .all(req.user.id);
    }
    const unreadCount = db
      .prepare("SELECT COUNT(*) as c FROM notifications WHERE owner_id = ? AND is_read = 0")
      .get(req.user.id).c;

    res.json({ notifications: rows, unreadCount });
  })
);

// PATCH /api/notifications/:id/read
router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const notif = db
      .prepare("SELECT * FROM notifications WHERE id = ? AND owner_id = ?")
      .get(req.params.id, req.user.id);
    if (!notif) return res.status(404).json({ error: "Notification not found" });

    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(notif.id);
    res.json({ ok: true });
  })
);

// PATCH /api/notifications/read-all
router.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE owner_id = ? AND is_read = 0").run(
      req.user.id
    );
    res.json({ ok: true });
  })
);

module.exports = router;
