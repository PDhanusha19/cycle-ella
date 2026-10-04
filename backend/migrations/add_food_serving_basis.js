// ============================================
// MIGRATION: Add foods.serving_basis and populate it from foods_seed.json
// Run once:  node migrations/add_food_serving_basis.js
// Safe to run multiple times.
//
// The catalogue stores nutrients on two different bases: some rows are per
// 100 g, others are per portion (one plate of rice, one egg). Without this
// column the app had no way to tell them apart and multiplied every food
// through the same grams conversion, so a stored portion came out 1.5x too
// large at the default 'serving' unit.
//
// The values come from backend/data/foods_seed.json, which carries the
// basis recorded by the food audit (see apply_food_audit.js). Foods whose
// basis is unknown are left NULL and the app falls back to the old
// per-100g behaviour for them.
// ============================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');

const SEED = path.join(__dirname, '..', 'data', 'foods_seed.json');

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

const query = (sql, params) => new Promise((resolve, reject) => {
  db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
});

db.connect(async (err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('Connected to MySQL! 🌸');

  try {
    try {
      await query('ALTER TABLE foods ADD COLUMN serving_basis VARCHAR(20) NULL');
      console.log("✅ Column 'serving_basis' added to foods");
    } catch (e) {
      if (e.errno !== 1060) throw e;
      console.log("✅ Column 'serving_basis' already existed on foods");
    }

    const foods = JSON.parse(fs.readFileSync(SEED, 'utf8'));
    const known = foods.filter((f) => f.serving_basis);
    const unknown = foods.filter((f) => !f.serving_basis);

    let updated = 0;
    for (const f of known) {
      const r = await query('UPDATE foods SET serving_basis = ? WHERE id = ?', [f.serving_basis, f.id]);
      updated += r.affectedRows;
    }

    console.log(`✅ Set serving_basis on ${updated} row(s) from ${known.length} seed entries`);

    if (unknown.length > 0) {
      console.log(`\n⚠️  ${unknown.length} food(s) have no recorded basis and were left NULL:`);
      unknown.forEach((f) => console.log(`   id=${f.id}  ${f.name}`));
      console.log('   These fall back to the per-100g conversion in the app.');
    }

    const [stillNull] = await query(
      'SELECT COUNT(*) AS n FROM foods WHERE serving_basis IS NULL'
    );
    console.log(`\nRows still NULL in the foods table: ${stillNull.n}`);
    console.log('\n✅ Migration complete!');
  } catch (e) {
    console.error('❌ Migration failed:', e.message);
    db.end();
    process.exit(1);
  }

  db.end();
});
