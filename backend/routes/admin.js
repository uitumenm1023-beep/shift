const express = require("express");
const bcrypt = require("bcrypt");
const { db } = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");
const { mnNowParts, minutesWorkedFromISO, paidMinutes } = require("../utils/time");
require("dotenv").config();

const router = express.Router();
router.use(authRequired, requireRole("admin"));

// workers CRUD (same as before)
router.post("/workers", (req, res) => {
  const { name, email, password, hourly_rate_mnt } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "name, email, password required" });

  const rate = Number.isFinite(+hourly_rate_mnt)
    ? Math.max(0, Math.floor(+hourly_rate_mnt))
    : Math.max(0, parseInt(process.env.DEFAULT_HOURLY_RATE_MNT || "15000", 10));

  const hash = bcrypt.hashSync(String(password), 10);

  try {
    const info = db
      .prepare("INSERT INTO users (name, email, password_hash, role, hourly_rate_mnt, is_active) VALUES (?, ?, ?, 'worker', ?, 1)")
      .run(name.trim(), email.toLowerCase().trim(), hash, rate);

    res.status(201).json({ worker: { id: info.lastInsertRowid, name: name.trim(), email: email.toLowerCase().trim(), hourly_rate_mnt: rate, is_active: 1 } });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return res.status(409).json({ error: "Email already exists" });
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/workers", (req, res) => {
  const workers = db
    .prepare("SELECT id, name, email, hourly_rate_mnt, is_active, created_at FROM users WHERE role='worker' ORDER BY created_at DESC")
    .all();
  res.json({ workers });
});

router.put("/workers/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const existing = db.prepare("SELECT id, role FROM users WHERE id=?").get(id);
  if (!existing || existing.role !== "worker") return res.status(404).json({ error: "Worker not found" });

  const { name, email, password, hourly_rate_mnt, is_active } = req.body || {};
  const updates = [];
  const params = [];

  if (typeof name === "string" && name.trim()) { updates.push("name=?"); params.push(name.trim()); }
  if (typeof email === "string" && email.trim()) { updates.push("email=?"); params.push(email.toLowerCase().trim()); }
  if (password) { updates.push("password_hash=?"); params.push(bcrypt.hashSync(String(password), 10)); }

  if (hourly_rate_mnt !== undefined) {
    const rate = Math.max(0, Math.floor(+hourly_rate_mnt));
    if (!Number.isFinite(rate)) return res.status(400).json({ error: "hourly_rate_mnt must be number" });
    updates.push("hourly_rate_mnt=?");
    params.push(rate);
  }

  if (is_active !== undefined) {
    const active = (is_active === true || is_active === 1 || is_active === "1") ? 1 : 0;
    updates.push("is_active=?");
    params.push(active);
  }

  if (updates.length === 0) return res.status(400).json({ error: "No valid fields to update" });

  params.push(id);

  try {
    db.prepare(`UPDATE users SET ${updates.join(",")} WHERE id=?`).run(...params);
    const worker = db.prepare("SELECT id, name, email, hourly_rate_mnt, is_active, created_at FROM users WHERE id=?").get(id);
    res.json({ worker });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return res.status(409).json({ error: "Email already exists" });
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/workers/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const worker = db.prepare("SELECT id, role FROM users WHERE id=?").get(id);
  if (!worker || worker.role !== "worker") return res.status(404).json({ error: "Worker not found" });

  const info = db.prepare("DELETE FROM users WHERE id=?").run(id);
  res.json({ ok: true, deleted: info.changes });
});

// ✅ NEW: Admin adjusts time (+/- hours)
// POST /api/admin/adjustments  { worker_id, hours, reason }
router.post("/adjustments", (req, res) => {
  const worker_id = Number(req.body?.worker_id);
  const hours = Number(req.body?.hours);
  const reason = req.body?.reason ? String(req.body.reason) : null;

  if (!Number.isFinite(worker_id)) return res.status(400).json({ error: "worker_id required" });
  if (!Number.isFinite(hours)) return res.status(400).json({ error: "hours required (number)" });

  const worker = db.prepare("SELECT id, role FROM users WHERE id=?").get(worker_id);
  if (!worker || worker.role !== "worker") return res.status(404).json({ error: "Worker not found" });

  const minutes = Math.trunc(hours * 60); // can be negative
  const now = mnNowParts().iso_mn;

  const info = db.prepare(`
    INSERT INTO adjustments (worker_id, minutes, reason, created_at_mn)
    VALUES (?, ?, ?, ?)
  `).run(worker_id, minutes, reason, now);

  res.status(201).json({ adjustment: { id: info.lastInsertRowid, worker_id, minutes, hours, reason, created_at_mn: now } });
});

// Payroll includes adjustments
router.get("/payroll", (req, res) => {
  const from = req.query.from || null;
  const to = req.query.to || null;

  // shifts
  let where = "WHERE u.role='worker'";
  const params = [];
  if (from) { where += " AND s.work_date >= ?"; params.push(from); }
  if (to) { where += " AND s.work_date <= ?"; params.push(to); }

  const rows = db.prepare(`
    SELECT u.id as worker_id, u.name, u.email, u.hourly_rate_mnt,
           s.work_date, s.check_in_at, s.check_out_at
    FROM users u
    LEFT JOIN shifts s ON s.worker_id = u.id
    ${where}
    ORDER BY u.name ASC
  `).all(...params);

  // adjustments
  const adjWhere = [];
  const adjParams = [];
  if (from) { adjWhere.push("date(created_at_mn) >= ?"); adjParams.push(from); }
  if (to) { adjWhere.push("date(created_at_mn) <= ?"); adjParams.push(to); }

  const adjRows = db.prepare(`
    SELECT worker_id, COALESCE(SUM(minutes),0) as minutes
    FROM adjustments
    ${adjWhere.length ? "WHERE " + adjWhere.join(" AND ") : ""}
    GROUP BY worker_id
  `).all(...adjParams);

  const adjMap = new Map(adjRows.map(a => [a.worker_id, a.minutes]));

  const map = new Map();

  for (const r of rows) {
    if (!map.has(r.worker_id)) {
      map.set(r.worker_id, {
        worker_id: r.worker_id,
        name: r.name,
        email: r.email,
        hourly_rate_mnt: r.hourly_rate_mnt,
        total_worked_minutes: 0,
        total_paid_minutes: 0,
        adjustment_minutes: adjMap.get(r.worker_id) || 0,
        final_paid_minutes: 0,
        total_hours: 0,
        total_pay_mnt: 0
      });
    }

    if (r.work_date && r.check_in_at && r.check_out_at) {
      const worked = minutesWorkedFromISO(r.check_in_at, r.check_out_at);
      const paid = paidMinutes(worked);
      const agg = map.get(r.worker_id);
      agg.total_worked_minutes += worked;
      agg.total_paid_minutes += paid;
    }
  }

  const payroll = Array.from(map.values()).map(p => {
    p.final_paid_minutes = Math.max(0, p.total_paid_minutes + p.adjustment_minutes);
    p.total_hours = Math.round((p.final_paid_minutes / 60) * 100) / 100;
    p.total_pay_mnt = Math.round(p.total_hours * p.hourly_rate_mnt);
    return p;
  });

  res.json({ payroll, from, to });
});

module.exports = router;