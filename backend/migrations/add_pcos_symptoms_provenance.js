// ============================================
// MIGRATION: Add provenance columns to pcos_symptoms
// Run once:  node migrations/add_pcos_symptoms_provenance.js
// Safe to run multiple times.
//
// Records whether cycle_regularity/period_duration_days on a given
// assessment were auto-filled from real tracked period data ('tracked')
// or entered/overridden by the user ('self_reported'). Captured at
// submission time because it's a point-in-time fact — if the user logs
// more periods afterward, there's no way to reconstruct after the fact
// whether the value used *then* would have qualified as tracked.
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
    `ALTER TABLE pcos_symptoms ADD COLUMN cycle_regularity_source VARCHAR(20) NULL`,
    (err) => {
      if (err && err.errno !== 1060) {
        console.error('❌ Error adding cycle_regularity_source:', err.message);
      } else {
        console.log("✅ Column 'cycle_regularity_source' added to pcos_symptoms (or already existed)");
      }

      db.query(
        `ALTER TABLE pcos_symptoms ADD COLUMN period_duration_days_source VARCHAR(20) NULL`,
        (err2) => {
          if (err2 && err2.errno !== 1060) {
            console.error('❌ Error adding period_duration_days_source:', err2.message);
          } else {
            console.log("✅ Column 'period_duration_days_source' added to pcos_symptoms (or already existed)");
          }
          console.log('\n✅ Migration complete!');
          db.end();
        }
      );
    }
  );
});
