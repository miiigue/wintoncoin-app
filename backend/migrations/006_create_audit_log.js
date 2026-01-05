// backend/migrations/006_create_audit_log.js
// Creates an append-only audit log table (bank-grade traceability).
// Retention policy: 48 months (cleanup handled by server cron job).
const { Pool } = require('pg');
require('../config'); // Load env the same way as server.js

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('--- Iniciando Migración 006: Crear tabla audit_log ---');
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id BIGSERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        actor_username TEXT,
        target_username TEXT,
        publication_id INTEGER,
        category TEXT,
        ip_address TEXT,
        user_agent TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Indexes for common investigations
    await client.query(`CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS audit_log_event_type_idx ON audit_log (event_type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log (actor_username);`);
    await client.query(`CREATE INDEX IF NOT EXISTS audit_log_target_idx ON audit_log (target_username);`);
    await client.query(`CREATE INDEX IF NOT EXISTS audit_log_publication_idx ON audit_log (publication_id);`);

    console.log('--- Migración 006 Completada con Éxito ---');
    await client.query('COMMIT');
  } catch (error) {
    console.error('Error durante la migración 006:', error);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();


