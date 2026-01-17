// backend/migrations/012_add_publications_updated_at.js
// Adds updated_at to publications for safe edit tracking.
const { Pool } = require('pg');
require('../config'); // Load env the same way as server.js

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('--- Iniciando Migración 012: updated_at en publications ---');
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE publications
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    await client.query(`
      UPDATE publications
      SET updated_at = COALESCE(updated_at, created_at, NOW());
    `);

    console.log('--- Migración 012 Completada con Éxito ---');
    await client.query('COMMIT');
  } catch (error) {
    console.error('Error durante la migración 012:', error);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
