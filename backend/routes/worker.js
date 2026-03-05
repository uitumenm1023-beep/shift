const express = require("express");
const { db } = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");
const { mnNowParts, minutesWorkedFromISO, paidMinutes, roundTo2 } = require("../utils/time");

const router = express.Router();
router.use(authRequired, requireRole("worker"));

function safeErr(res, e) {
  console.error("WORKER ROUTE ERROR:", e);
  return res.status(500).json({ error: "Server error" });
}

router.get("/me", (req, res) => {
  try {
    const me = db.prepare("SELECT id, name, email, role, hourly_rate_mnt FROM users WHERE id=?").get(req.user.id);
    res.json({ user: me });
  } catch (e) {
    safeErr(res, e);
  }
});

router.post("/check-in", (req, res) => {
  try {
    const now = mnNowParts();
    const notes = req.body?.notes ? String(req.body.notes) : null;

    const open = db.prepare(`
      SELECT id FROM shifts
      WHERE worker_id=? AND (check_out_at IS NULL OR check_out_at = '')
      ORDER BY id DESC LIMIT 1
    `).get(req.user.id);

    if (open) return res.status(400).json({ error: "Нээлттэй ээлж байна. Эхлээд тарах дарна уу." });

    // end_time may be NOT NULL in old DBs -> placeholder end_time=start_time
    const info = db.prepare(`
      INSERT INTO shifts (worker_id, work_date, start_time, end_time, check_in_at, check_out_at, break_minutes, notes)
      VALUES (?, ?, ?, ?, ?, NULL, 0, ?)
    `).run(req.user.id, now.work_date, now.hhmm, now.hhmm, now.iso_mn, notes);

    const shift = db.prepare("SELECT * FROM shifts WHERE id=?").get(info.lastInsertRowid);
    res.status(201).json({ shift });
  } catch (e) {
    safeErr(res, e);
  }
});

router.post("/check-out", (req, res) => {
  try {
    const now = mnNowParts();

    const open = db.prepare(`
      SELECT * FROM shifts
      WHERE worker_id=? AND (check_out_at IS NULL OR check_out_at = '')
      ORDER BY id DESC LIMIT 1
    `).get(req.user.id);

    if (!open) return res.status(400).json({ error: "Нээлттэй ээлж олдсонгүй. Эхлээд ирэх дарна уу." });

    db.prepare(`
      UPDATE shifts
      SET end_time=?, check_out_at=?, break_minutes=0
      WHERE id=? AND worker_id=?
    `).run(now.hhmm, now.iso_mn, open.id, req.user.id);

    const rate = db.prepare("SELECT hourly_rate_mnt FROM users WHERE id=?").get(req.user.id).hourly_rate_mnt;

    const worked = minutesWorkedFromISO(open.check_in_at, now.iso_mn);
    const paid = paidMinutes(worked);

    const hours = roundTo2(paid / 60);
    const pay = Math.round(hours * rate);

    const updated = db.prepare("SELECT * FROM shifts WHERE id=?").get(open.id);

    res.json({
      shift: {
        ...updated,
        computed: { worked_minutes: worked, paid_minutes: paid, hours, hourly_rate_mnt: rate, pay_mnt: pay }
      }
    });
  } catch (e) {
    safeErr(res, e);
  }
});

router.get("/open-shift", (req, res) => {
  try {
    const open = db.prepare(`
      SELECT * FROM shifts
      WHERE worker_id=? AND (check_out_at IS NULL OR check_out_at = '')
      ORDER BY id DESC LIMIT 1
    `).get(req.user.id);

    res.json({ openShift: open || null });
  } catch (e) {
    safeErr(res, e);
  }
});

router.get("/shifts", (req, res) => {
  try {
    const from = req.query.from || null;
    const to = req.query.to || null;

    let where = "WHERE worker_id=?";
    const params = [req.user.id];
    if (from) { where += " AND work_date >= ?"; params.push(from); }
    if (to) { where += " AND work_date <= ?"; params.push(to); }

    const shifts = db.prepare(`
      SELECT * FROM shifts
      ${where}
      ORDER BY work_date DESC, start_time DESC
    `).all(...params);

    const rate = db.prepare("SELECT hourly_rate_mnt FROM users WHERE id=?").get(req.user.id).hourly_rate_mnt;

    const enriched = shifts.map(s => {
      const worked = (s.check_in_at && s.check_out_at) ? minutesWorkedFromISO(s.check_in_at, s.check_out_at) : 0;
      const paid = paidMinutes(worked);
      const hours = roundTo2(paid / 60);
      const pay = Math.round(hours * rate);
      return { ...s, computed: { worked_minutes: worked, paid_minutes: paid, hours, hourly_rate_mnt: rate, pay_mnt: pay } };
    });

    res.json({ shifts: enriched });
  } catch (e) {
    safeErr(res, e);
  }
});

router.get("/summary", (req, res) => {
  try {
    const from = req.query.from || null;
    const to = req.query.to || null;

    let where = "WHERE worker_id=?";
    const params = [req.user.id];
    if (from) { where += " AND work_date >= ?"; params.push(from); }
    if (to) { where += " AND work_date <= ?"; params.push(to); }

    const rows = db.prepare(`SELECT * FROM shifts ${where}`).all(...params);
    const rate = db.prepare("SELECT hourly_rate_mnt FROM users WHERE id=?").get(req.user.id).hourly_rate_mnt;

    let totalWorked = 0;
    let totalPaid = 0;

    for (const r of rows) {
      const worked = (r.check_in_at && r.check_out_at) ? minutesWorkedFromISO(r.check_in_at, r.check_out_at) : 0;
      totalWorked += worked;
      totalPaid += paidMinutes(worked);
    }

    // add admin adjustments too (worker sees final summary)
    const adjWhere = [];
    const adjParams = [req.user.id];
    if (from) { adjWhere.push("date(created_at_mn) >= ?"); adjParams.push(from); }
    if (to) { adjWhere.push("date(created_at_mn) <= ?"); adjParams.push(to); }
    const adjSql = `SELECT COALESCE(SUM(minutes),0) as m FROM adjustments WHERE worker_id=? ${adjWhere.length ? "AND " + adjWhere.join(" AND ") : ""}`;
    const adjustMinutes = db.prepare(adjSql).get(...adjParams).m;

    const finalPaidMinutes = Math.max(0, totalPaid + adjustMinutes);

    const totalHours = roundTo2(finalPaidMinutes / 60);
    const totalPay = Math.round(totalHours * rate);

    res.json({
      from, to,
      hourly_rate_mnt: rate,
      total_worked_minutes: totalWorked,
      total_paid_minutes: totalPaid,
      adjustment_minutes: adjustMinutes,
      final_paid_minutes: finalPaidMinutes,
      total_hours: totalHours,
      total_pay_mnt: totalPay
    });
  } catch (e) {
    safeErr(res, e);
  }
});

module.exports = router;