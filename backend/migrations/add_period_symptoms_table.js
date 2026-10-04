// ============================================
// MIGRATION: Add period_symptoms table
// Run once:  node migrations/add_period_symptoms_table.js
// Safe to run multiple times (uses IF NOT EXISTS).
//
// This table has been queried by periodController.js/reportsController.js
// in production for a while but never had a migration file committed —
// this closes that gap for fresh environments. Schema matches what those
// queries already assume: one row per (user_id, log_date), symptoms
// stored as a comma-joined string, upserted via ON DUPLICATE KEY UPDATE.
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
    `CREATE TABLE IF NOT EXISTS period_symptoms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      log_date DATE NOT NULL,
      symptoms VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_log_date (user_id, log_date),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    (err) => {
      if (err) {
        console.error('❌ Error creating period_symptoms:', err.message);
      } else {
        console.log("✅ Table 'period_symptoms' created/exists");
      }
      console.log('\n✅ Migration complete!');
      db.end();
    }
  );
});
