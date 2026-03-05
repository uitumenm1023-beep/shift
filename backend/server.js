require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { db } = require("./db");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const workerRoutes = require("./routes/worker");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/worker", workerRoutes);

// Create default admin if none exists
function ensureAdmin() {
  const c = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='admin'").get().c;
  if (c > 0) return;

  const defaultRate = Math.max(0, parseInt(process.env.DEFAULT_HOURLY_RATE_MNT || "15000", 10));
  const hash = bcrypt.hashSync("admin1234", 10);

  db.prepare(`
    INSERT INTO users (name, email, password_hash, role, hourly_rate_mnt, is_active)
    VALUES (?, ?, ?, 'admin', ?, 1)
  `).run("Admin", "admin@local", hash, defaultRate);

  console.log("✅ Default admin created:");
  console.log("   email: admin@local");
  console.log("   pass : admin1234");
}

ensureAdmin();

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`✅ Backend running: http://localhost:${port}`));