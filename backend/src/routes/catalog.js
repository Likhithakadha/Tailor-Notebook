const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { asyncHandler } = require("../middleware/asyncHandler");
const { authRequired } = require("../middleware/auth");

const router = express.Router();
router.use(authRequired);

const VALID_CATEGORIES = ["fabric", "design"];

function getOwnedItem(id, ownerId) {
  return db.prepare("SELECT * FROM catalog_items WHERE id = ? AND owner_id = ?").get(id, ownerId);
}

// GET /api/catalog?category=fabric
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { category } = req.query;
    let rows;
    if (category) {
      rows = db
        .prepare(
          "SELECT * FROM catalog_items WHERE owner_id = ? AND category = ? ORDER BY created_at DESC"
        )
        .all(req.user.id, category);
    } else {
      rows = db
        .prepare("SELECT * FROM catalog_items WHERE owner_id = ? ORDER BY created_at DESC")
        .all(req.user.id);
    }
    res.json({ items: rows });
  })
);

// POST /api/catalog
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { category, name, description, pricePerUnit, imageUrl } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` });
    }

    const id = uuidv4();
    db.prepare(
      `INSERT INTO catalog_items (id, owner_id, category, name, description, price_per_unit, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.user.id,
      category || "fabric",
      name,
      description || null,
      pricePerUnit || null,
      imageUrl || null
    );

    const item = db.prepare("SELECT * FROM catalog_items WHERE id = ?").get(id);
    res.status(201).json({ item });
  })
);

// PUT /api/catalog/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const item = getOwnedItem(req.params.id, req.user.id);
    if (!item) return res.status(404).json({ error: "Catalog item not found" });

    const { category, name, description, pricePerUnit, imageUrl } = req.body;
    db.prepare(
      `UPDATE catalog_items SET category = ?, name = ?, description = ?, price_per_unit = ?, image_url = ?
       WHERE id = ?`
    ).run(
      category ?? item.category,
      name ?? item.name,
      description ?? item.description,
      pricePerUnit ?? item.price_per_unit,
      imageUrl ?? item.image_url,
      item.id
    );

    const updated = db.prepare("SELECT * FROM catalog_items WHERE id = ?").get(item.id);
    res.json({ item: updated });
  })
);

// DELETE /api/catalog/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const item = getOwnedItem(req.params.id, req.user.id);
    if (!item) return res.status(404).json({ error: "Catalog item not found" });
    db.prepare("DELETE FROM catalog_items WHERE id = ?").run(item.id);
    res.status(204).send();
  })
);

module.exports = router;
