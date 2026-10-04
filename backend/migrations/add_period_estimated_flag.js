// ============================================
// MIGRATION: Add is_estimated flag to period_logs
// Run once:  node migrations/add_period_estimated_flag.js
// Safe to run multiple times.
//
// Onboarding period-history entries where the user didn't remember
// the exact day get stored with a first-of-month placeholder date.
// This flag marks those rows so regularity calculations (which need
// real day-level gaps between periods) can exclude them instead of
// treating a guessed date as tracked data.
// ============================================

require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('Connected to MySQL! 🌸');

  db.query(
    `ALTER TABLE period_logs ADD COLUMN is_estimated BOOLEAN DEFAULT FALSE`,
    (err) => {
      // Error code 1060 = column already exists — safe to ignore
      if (err && err.errno !== 1060) {
        console.error('❌ Error altering period_logs:', err.message);
      } else {
        console.log("✅ Column 'is_estimated' added to period_logs (or already existed)");
      }
      console.log('\n✅ Migration complete!');
      db.end();
    }
  );
});
