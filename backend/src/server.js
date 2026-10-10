require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const db = require("./db");
const { UPLOAD_DIR } = require("./db/photos");
const { seedIfEmpty } = require("./seed");
const authRoutes = require("./routes/auth");
const customerRoutes = require("./routes/customers");
const measurementRoutes = require("./routes/measurements");
const orderRoutes = require("./routes/orders");
const appointmentRoutes = require("./routes/appointments");
const notificationRoutes = require("./routes/notifications");
const catalogRoutes = require("./routes/catalog");
const backupRoutes = require("./routes/backup");

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "tailor-notebook-local-secret-change-me";
  console.warn("JWT_SECRET not set - using a default local secret. Set one in backend/.env for real use.");
}

const app = express();

app.use(
  cors({
    origin: true,
  })
);
app.use(express.json({ limit: "8mb" }));
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "tailor-notebook-backend" });
});

// Design photos (file names are random UUIDs)
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/measurements", measurementRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/backup", backupRoutes);

// Serve the built React app (frontend/dist) from the same server, so one URL runs everything
const distPath = path.resolve(__dirname, "../../frontend/dist");
if (fs.existsSync(path.join(distPath, "index.html"))) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

db.ready
  .then(() => seedIfEmpty())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Tailor Notebook running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize the database:", err);
    process.exit(1);
  });
