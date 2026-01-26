// Migración: Permitir precisión en repeat_cooldown_hours (minutos)

const { Pool } = require('pg');
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development' });
const { ensureSchemaMigrationsTable, computeChecksum, recordMigration } = require('./_migration_utils');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    console.log('--- Iniciando Migración 018: repeat_cooldown_hours con precisión ---');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await ensureSchemaMigrationsTable(client);

        const ddlStatements = `
            ALTER TABLE publications
            ALTER COLUMN repeat_cooldown_hours TYPE NUMERIC(10,4)
            USING repeat_cooldown_hours::numeric;
        `;
        await client.query(ddlStatements);
        await client.query(`
            UPDATE publications
            SET repeat_cooldown_hours = 24
            WHERE repeat_cooldown_hours IS NULL;
        `);

        await recordMigration(client, '018_update_publications_repeat_cooldown_precision', computeChecksum(ddlStatements));
        await client.query('COMMIT');
        console.log('✅ Migración 018 completada.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en Migración 018:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(() => process.exit(1));
