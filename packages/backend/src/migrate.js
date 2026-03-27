require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function migrate() {
  if (!pool) {
    console.error('Migration failed: DATABASE_URL is not set');
    process.exit(1);
  }

  const sqlFile = path.join(__dirname, '../migrations/001_initial_schema.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  try {
    await pool.query(sql);
    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
