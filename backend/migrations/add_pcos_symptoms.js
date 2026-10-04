// ============================================
// MIGRATION: Add pcos_symptoms table
// Run once:  node migrations/add_pcos_symptoms.js
// Safe to run multiple times (uses IF NOT EXISTS).
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

  const statements = [
    // Stores the 9 real symptom answers the PCOS model needs
    // (age comes from users.date_of_birth, weight/height from
    // user_measurements — no need to duplicate those here)
    `CREATE TABLE IF NOT EXISTS pcos_symptoms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      cycle_regularity VARCHAR(20),      -- 'Regular' or 'Irregular'
      period_duration_days INT,          -- how many days her period lasts (2-12 typical)
      weight_gain BOOLEAN,
      hair_growth BOOLEAN,               -- excess hair growth (face/chest/back)
      skin_darkening BOOLEAN,
      hair_loss BOOLEAN,
      pimples BOOLEAN,
      fast_food BOOLEAN,
      regular_exercise BOOLEAN,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
  ];

  // Add a probability column to pcos_risk if it doesn't already exist
  // (older column set only had total_score + risk_level, no % value)
  const alterStatements = [
    `ALTER TABLE pcos_risk ADD COLUMN pcos_probability_percent FLOAT NULL`,
  ];

  let done = 0;
  const total = statements.length;

  statements.forEach((sql) => {
    db.query(sql, (err) => {
      if (err) {
        console.error('❌ Error creating pcos_symptoms:', err.message);
      } else {
        console.log("✅ Table 'pcos_symptoms' created/exists");
      }
      done++;
      if (done === total) runAlters();
    });
  });

  function runAlters() {
    let altersDone = 0;
    alterStatements.forEach((sql) => {
      db.query(sql, (err) => {
        // Error code 1060 = column already exists — safe to ignore
        if (err && err.errno !== 1060) {
          console.error('❌ Error altering pcos_risk:', err.message);
        } else {
          console.log("✅ Column 'pcos_probability_percent' added to pcos_risk (or already existed)");
        }
        altersDone++;
        if (altersDone === alterStatements.length) {
          console.log('\n✅ Migration complete!');
          db.end();
        }
      });
    });
  }
});