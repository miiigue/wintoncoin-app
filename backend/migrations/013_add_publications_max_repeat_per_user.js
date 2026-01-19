// backend/migrations/013_add_publications_max_repeat_per_user.js
// Adds max_repeat_per_user to publications for per-user repeat limits.
const { Pool } = require('pg');
require('../config'); // Load env the same way as server.js

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('--- Iniciando Migración 013: max_repeat_per_user en publications ---');
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE publications
        ADD COLUMN IF NOT EXISTS max_repeat_per_user INTEGER;
    `);

    await client.query(`
      UPDATE publications
      SET max_repeat_per_user = 1
      WHERE COALESCE(allow_repeat_participation, FALSE) = FALSE
        AND max_repeat_per_user IS NULL;
    `);

    console.log('--- Migración 013 Completada con Éxito ---');
    await client.query('COMMIT');
  } catch (error) {
    console.error('Error durante la migración 013:', error);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
