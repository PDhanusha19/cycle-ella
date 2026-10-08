const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const C = require('../utils/cycleCalculations');

const pool = db.promise();

// ============================================
// LOGIN RATE LIMITING
// In-memory per-IP counter — resets on process restart, which is fine for
// a single-instance admin dashboard. 5 failed attempts / 15 min / IP.
// ============================================
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map(); // ip -> { count, firstAttemptAt }

function isRateLimited(ip) {
  const rec = loginAttempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.firstAttemptAt > WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function recordFailure(ip) {
  const rec = loginAttempts.get(ip);
  if (!rec || Date.now() - rec.firstAttemptAt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttemptAt: Date.now() });
  } else {
    rec.count += 1;
  }
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

// ============================================
// LOGIN
// ============================================
const login = (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip;

  if (isRateLimited(ip)) {
    return res.status(429).json({ message: 'Too many failed attempts. Try again in 15 minutes.' });
  }

  if (!username || !password) {
    return res.status(400).json({ message: 'Please enter username and password' });
  }

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminUsername || !adminPasswordHash) {
    console.error('Admin login is not configured: set ADMIN_USERNAME and ADMIN_PASSWORD_HASH in backend/.env');
    return res.status(500).json({ message: 'Admin login is not configured' });
  }

  // Constant-shape check: always run bcrypt.compare even on a username
  // mismatch, so a wrong username doesn't return faster than a wrong
  // password and leak which one failed via timing.
  const usernameMatches = username === adminUsername;
  const isMatch = bcrypt.compareSync(password, adminPasswordHash);

  if (!usernameMatches || !isMatch) {
    recordFailure(ip);
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (!process.env.JWT_SECRET) {
    // index.js already refuses to boot without JWT_SECRET, but this guards
    // against ever signing an admin token with an undefined secret.
    return res.status(500).json({ message: 'Server misconfigured: JWT_SECRET is not set' });
  }

  clearAttempts(ip);
  const token = jwt.sign({ role: 'admin', username: adminUsername }, process.env.JWT_SECRET, { expiresIn: '2h' });
  res.json({ message: 'Login successful', token, expiresIn: '2h' });
};

// ============================================
// SUMMARY KPIs
// ============================================
const getSummary = async (req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM users WHERE is_verified = 1) AS verified_users,
        (SELECT COUNT(*) FROM pcos_risk) AS completed_assessments,
        (SELECT COUNT(*) FROM period_logs WHERE deleted_at IS NULL) AS period_logs,
        (SELECT COUNT(*) FROM food_logs) AS food_logs,
        (SELECT COUNT(*) FROM reminders WHERE is_active = 1) AS active_reminders`
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ message: 'Database error', error: err.message });
  }
};

// ============================================
// RISK-LEVEL DISTRIBUTION (latest assessment per user)
// ============================================
const getRiskDistribution = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT risk_level, COUNT(*) AS count FROM (
        SELECT user_id, risk_level,
               ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY assessed_at DESC, id DESC) AS rn
        FROM pcos_risk
      ) latest
      WHERE rn = 1
      GROUP BY risk_level`
    );
    res.json({ distribution: rows });
  } catch (err) {
    res.status(500).json({ message: 'Database error', error: err.message });
  }
};

// ============================================
// REGISTRATIONS + ASSESSMENTS PER WEEK
// ============================================
const getTimeseries = async (req, res) => {
  try {
    const weeks = Math.min(52, Math.max(1, parseInt(req.query.weeks, 10) || 12));
    const [rows] = await pool.query(
      `WITH RECURSIVE weeks AS (
        SELECT DATE_SUB(DATE(CURDATE()), INTERVAL WEEKDAY(CURDATE()) DAY) AS week_start, 0 AS n
        UNION ALL
        SELECT DATE_SUB(week_start, INTERVAL 7 DAY), n + 1 FROM weeks WHERE n < ?
      )
      SELECT w.week_start,
        COALESCE(u.c, 0) AS registrations,
        COALESCE(a.c, 0) AS assessments
      FROM weeks w
      LEFT JOIN (
        SELECT DATE_SUB(DATE(created_at), INTERVAL WEEKDAY(created_at) DAY) AS week_start, COUNT(*) AS c
        FROM users GROUP BY week_start
      ) u ON u.week_start = w.week_start
      LEFT JOIN (
        SELECT DATE_SUB(DATE(assessed_at), INTERVAL WEEKDAY(assessed_at) DAY) AS week_start, COUNT(*) AS c
        FROM pcos_risk GROUP BY week_start
      ) a ON a.week_start = w.week_start
      ORDER BY w.week_start ASC`,
      [weeks - 1]
    );
    const series = rows.map((r) => ({
      week_start: C.isoDate(r.week_start),
      registrations: Number(r.registrations),
      assessments: Number(r.assessments),
    }));
    res.json({ weeks, series });
  } catch (err) {
    res.status(500).json({ message: 'Database error', error: err.message });
  }
};

// ============================================
// CYCLE REGULARITY — reuses the exact same rule the app uses
// (utils/cycleCalculations.js), so this can never drift from what a user
// sees on their own Period Tracker screen.
// ============================================
const getCycleRegularity = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT user_id, start_date, end_date, duration_days, is_estimated
       FROM period_logs
       WHERE deleted_at IS NULL AND start_date IS NOT NULL
       ORDER BY user_id ASC, start_date ASC`
    );

    const byUser = new Map();
    for (const row of rows) {
      if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
      byUser.get(row.user_id).push(row);
    }

    let regular = 0;
    let irregular = 0;
    let notEnoughData = 0;

    for (const entries of byUser.values()) {
      const stats = C.computeCycleStats(entries);
      if (!stats.hasEnoughForPersonalization) {
        notEnoughData += 1;
      } else if (stats.isIrregular) {
        irregular += 1;
      } else {
        regular += 1;
      }
    }

    res.json({
      users_with_period_data: byUser.size,
      regular,
      irregular,
      not_enough_data: notEnoughData,
    });
  } catch (err) {
    res.status(500).json({ message: 'Database error', error: err.message });
  }
};

// ============================================
// TOP 10 MOST LOGGED FOODS
// ============================================
const getTopFoods = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT food_name, COUNT(*) AS count
       FROM food_logs
       WHERE food_name IS NOT NULL AND food_name <> ''
       GROUP BY food_name
       ORDER BY count DESC
       LIMIT 10`
    );
    res.json({ top_foods: rows });
  } catch (err) {
    res.status(500).json({ message: 'Database error', error: err.message });
  }
};

// ============================================
// HEALTH CONDITIONS (diabetes / cholesterol / blood pressure)
// ============================================
const getHealthConditions = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 'diabetes' AS field, diabetes AS value, COUNT(*) AS count FROM users GROUP BY diabetes
       UNION ALL
       SELECT 'cholesterol', cholesterol, COUNT(*) FROM users GROUP BY cholesterol
       UNION ALL
       SELECT 'blood_pressure', blood_pressure, COUNT(*) FROM users GROUP BY blood_pressure`
    );
    const grouped = { diabetes: [], cholesterol: [], blood_pressure: [] };
    rows.forEach((r) => {
      if (grouped[r.field]) grouped[r.field].push({ value: r.value || 'Unknown', count: r.count });
    });
    res.json(grouped);
  } catch (err) {
    res.status(500).json({ message: 'Database error', error: err.message });
  }
};

// ============================================
// LANGUAGE PREFERENCE
// ============================================
const getLanguages = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT language, COUNT(*) AS count FROM users GROUP BY language ORDER BY count DESC`
    );
    res.json({ languages: rows });
  } catch (err) {
    res.status(500).json({ message: 'Database error', error: err.message });
  }
};

// ============================================
// FEATURE USAGE (counts of logs per module)
// ============================================
const getFeatureUsage = async (req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM period_logs WHERE deleted_at IS NULL) AS period_tracking,
        (SELECT COUNT(*) FROM food_logs) AS food_logging,
        (SELECT COUNT(*) FROM pcos_risk) AS pcos_assessments,
        (SELECT COUNT(*) FROM reminders) AS reminders_set,
        (SELECT COUNT(*) FROM tips_log) AS tips_viewed`
    );
    res.json({ feature_usage: row });
  } catch (err) {
    res.status(500).json({ message: 'Database error', error: err.message });
  }
};

// ============================================
// MODEL EVALUATION — static thesis results, read once and cached.
// ============================================
const MODEL_EVAL_PATH = path.join(__dirname, '..', 'data', 'model_evaluation.json');
let modelEvalCache = null;

const getModelEvaluation = (req, res) => {
  try {
    if (!modelEvalCache) {
      modelEvalCache = JSON.parse(fs.readFileSync(MODEL_EVAL_PATH, 'utf8'));
    }
    res.json(modelEvalCache);
  } catch (err) {
    res.status(500).json({ message: 'Could not read model evaluation data', error: err.message });
  }
};

module.exports = {
  login,
  getSummary,
  getRiskDistribution,
  getTimeseries,
  getCycleRegularity,
  getTopFoods,
  getHealthConditions,
  getLanguages,
  getFeatureUsage,
  getModelEvaluation,
};
