const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { asyncHandler } = require("../middleware/asyncHandler");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, shopName: user.shop_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    shopName: user.shop_name,
  };
}

// POST /api/auth/register
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { name, email, password, shopName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();

    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, shop_name)
       VALUES (?, ?, ?, ?, 'tailor', ?)`
    ).run(id, name, email.toLowerCase(), passwordHash, shopName || null);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    const token = signToken(user);

    res.status(201).json({ token, user: publicUser(user) });
  })
);

// POST /api/auth/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  })
);

// GET /api/auth/me
router.get(
  "/me",
  authRequired,
  asyncHandler(async (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: publicUser(user) });
  })
);

module.exports = router;
