const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000,
    })
  : null;

if (pool) {
  pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err);
  });
}

module.exports = {
  query: (text, params) => {
    if (!pool) {
      const err = new Error('DATABASE_URL is not set');
      err.code = 'CONFIG';
      return Promise.reject(err);
    }
    return pool.query(text, params);
  },
  pool,
};
