const Database = require("better-sqlite3");
require("dotenv").config();

const DB_FILE = process.env.DB_FILE || "./data.sqlite";

const db = new Database(DB_FILE);

// ✅ Production-friendly SQLite settings
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");     // better concurrency
db.pragma("synchronous = NORMAL");   // good performance + safe enough
db.pragma("busy_timeout = 5000");    // wait up to 5s if locked

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','worker')),
  hourly_rate_mnt INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL,
  work_date TEXT NOT NULL,          -- YYYY-MM-DD (Mongolia date)
  start_time TEXT,
  end_time TEXT,
  check_in_at TEXT,
  check_out_at TEXT,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(worker_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL,
  minutes INTEGER NOT NULL,      -- can be negative
  reason TEXT,
  created_at_mn TEXT NOT NULL,   -- ISO string with +08:00
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(worker_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

function colExists(table, col) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some(c => c.name === col);
}

// ✅ migrations for older DBs
if (!colExists("shifts", "check_in_at")) db.exec(`ALTER TABLE shifts ADD COLUMN check_in_at TEXT;`);
if (!colExists("shifts", "check_out_at")) db.exec(`ALTER TABLE shifts ADD COLUMN check_out_at TEXT;`);

// ✅ Indexes (important for 1-year queries and payroll)
db.exec(`
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_shifts_worker_date ON shifts(worker_id, work_date);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(work_date);
CREATE INDEX IF NOT EXISTS idx_shifts_worker_open ON shifts(worker_id, check_out_at);

CREATE INDEX IF NOT EXISTS idx_adj_worker ON adjustments(worker_id);
CREATE INDEX IF NOT EXISTS idx_adj_created_mn ON adjustments(created_at_mn);
`);

module.exports = { db, DB_FILE };