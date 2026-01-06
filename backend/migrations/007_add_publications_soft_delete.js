// backend/migrations/007_add_publications_soft_delete.js
// Adds soft-delete fields to publications to avoid hard deletes (bank-grade auditability).
const { Pool } = require('pg');
require('../config'); // Load env the same way as server.js

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('--- Iniciando Migración 007: Soft Delete en publications ---');
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE publications
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS deleted_by_username VARCHAR(255) NULL;
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS publications_deleted_at_idx ON publications (deleted_at);`);

    console.log('--- Migración 007 Completada con Éxito ---');
    await client.query('COMMIT');
  } catch (error) {
    console.error('Error durante la migración 007:', error);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();


