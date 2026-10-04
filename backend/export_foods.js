// One-off export of the `foods` table for reproducibility as a research
// artefact. The table lives only in the local MySQL instance (setupdb.js
// creates it but never seeds it), so this is the only way to snapshot the
// 83 curated food records currently backing the nutrition recommender.
//
// Run with: node export_foods.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const OUT_DIR = path.join(__dirname, 'data');
const AUDIT_EXTRA_COLUMNS = ['gi_published_value', 'gi_source', 'gi_match_type', 'reviewer_note'];

function sqlEscape(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function csvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function printDistribution(title, rows, key) {
  const counts = {};
  for (const row of rows) {
    const label = row[key] === null || row[key] === undefined ? '(null)' : String(row[key]);
    counts[label] = (counts[label] || 0) + 1;
  }
  console.log(`\n${title}:`);
  for (const [label, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${label}: ${count}`);
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const [rows] = await connection.query('SELECT * FROM foods ORDER BY id');
    if (rows.length === 0) {
      console.log('foods table is empty — nothing to export.');
      return;
    }

    const columns = Object.keys(rows[0]);

    // 1. foods_seed.json
    fs.writeFileSync(path.join(OUT_DIR, 'foods_seed.json'), JSON.stringify(rows, null, 2), 'utf8');

    // 2. foods_seed.sql
    const colList = columns.join(', ');
    const sqlLines = rows.map(
      (row) => `INSERT INTO foods (${colList}) VALUES (${columns.map((c) => sqlEscape(row[c])).join(', ')});`
    );
    fs.writeFileSync(path.join(OUT_DIR, 'foods_seed.sql'), sqlLines.join('\n') + '\n', 'utf8');

    // 3. foods_audit.csv
    const csvColumns = [...columns, ...AUDIT_EXTRA_COLUMNS];
    const csvLines = [csvColumns.map(csvField).join(',')];
    for (const row of rows) {
      const fields = columns.map((c) => csvField(row[c])).concat(AUDIT_EXTRA_COLUMNS.map(() => ''));
      csvLines.push(fields.join(','));
    }
    fs.writeFileSync(path.join(OUT_DIR, 'foods_audit.csv'), csvLines.join('\r\n') + '\r\n', 'utf8');

    console.log(`Total rows exported: ${rows.length}`);
    console.log(`Columns (${columns.length}): ${columns.join(', ')}`);
    printDistribution('glycemic_index distribution', rows, 'glycemic_index');
    printDistribution('category distribution', rows, 'category');
    const pcosFriendlyCount = rows.filter((r) => r.pcos_friendly === 1 || r.pcos_friendly === true).length;
    console.log(`\npcos_friendly = true: ${pcosFriendlyCount} / ${rows.length}`);

    console.log('\nWrote:');
    console.log(`  ${path.join(OUT_DIR, 'foods_seed.json')}`);
    console.log(`  ${path.join(OUT_DIR, 'foods_seed.sql')}`);
    console.log(`  ${path.join(OUT_DIR, 'foods_audit.csv')}`);
  } catch (err) {
    console.error(`Export failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

main();
