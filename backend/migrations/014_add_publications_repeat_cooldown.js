// backend/migrations/014_add_publications_repeat_cooldown.js
// Adds repeat_cooldown_hours to publications for repeat timing control.

const { Pool } = require('pg');
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    console.log('--- Iniciando Migración 014: repeat_cooldown_hours en publications ---');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(`
            ALTER TABLE publications
            ADD COLUMN IF NOT EXISTS repeat_cooldown_hours INTEGER DEFAULT 24;
        `);

        await client.query(`
            UPDATE publications
            SET repeat_cooldown_hours = 24
            WHERE repeat_cooldown_hours IS NULL;
        `);

        await client.query('COMMIT');
        console.log('✅ Migración 014 completada.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en Migración 014:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(() => process.exit(1));
