require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { DB_FILE } = require("./db");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const workerRoutes = require("./routes/worker");

const app = express();

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";

// If behind a proxy (Render/Railway/Nginx), trust it for correct IP/rate-limit
app.set("trust proxy", 1);

// Security headers
app.use(helmet());

// JSON body size (avoid abuse)
app.use(express.json({ limit: "200kb" }));

// Rate limit: basic protection for login + public API
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // 120 requests/min per IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS
// In production set FRONTEND_ORIGIN=https://your-frontend-domain.com
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "";
app.use(cors({
  origin: (origin, cb) => {
    if (NODE_ENV !== "production") return cb(null, true);
    if (!origin) return cb(null, false);
    if (FRONTEND_ORIGIN && origin === FRONTEND_ORIGIN) return cb(null, true);
    return cb(new Error("CORS blocked"), false);
  },
  credentials: true
}));

// Health endpoint
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    env: NODE_ENV,
    db_file: DB_FILE
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/worker", workerRoutes);

// Global error handler (so you don’t leak stack traces)
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);
  res.status(500).json({ error: "Server error" });
});

app.listen(PORT, () => {
  console.log(`✅ API running on http://127.0.0.1:${PORT}`);
});