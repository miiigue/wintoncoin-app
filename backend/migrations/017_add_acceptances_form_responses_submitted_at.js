// Migración: Agregar campo form_responses_submitted_at a publication_acceptances
// Este campo registra la fecha/hora de envío de respuestas del formulario

const { Pool } = require('pg');
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development' });
const { ensureSchemaMigrationsTable, computeChecksum, recordMigration } = require('./_migration_utils');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    console.log('--- Iniciando Migración 017: form_responses_submitted_at en publication_acceptances ---');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await ensureSchemaMigrationsTable(client);

        const ddlStatements = `
            ALTER TABLE publication_acceptances
            ADD COLUMN IF NOT EXISTS form_responses_submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
        `;
        await client.query(ddlStatements);

        await recordMigration(client, '017_add_acceptances_form_responses_submitted_at', computeChecksum(ddlStatements));
        await client.query('COMMIT');
        console.log('✅ Migración 017 completada.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en Migración 017:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(() => process.exit(1));
