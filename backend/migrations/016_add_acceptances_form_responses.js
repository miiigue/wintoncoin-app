// Migración: Agregar campo form_responses a publication_acceptances
// Este campo almacena las respuestas del usuario a los formularios dinámicos
// Estructura: { "2": { "Pregunta 1": "Respuesta 1", "Pregunta 2": "Respuesta 2" } }

const { Pool } = require('pg');
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development' });
const { ensureSchemaMigrationsTable, computeChecksum, recordMigration } = require('./_migration_utils');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    console.log('--- Iniciando Migración 016: form_responses en publication_acceptances ---');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await ensureSchemaMigrationsTable(client);

        const ddlStatements = `
            ALTER TABLE publication_acceptances
            ADD COLUMN IF NOT EXISTS form_responses JSONB DEFAULT NULL;
        `;
        await client.query(ddlStatements);

        await recordMigration(client, '016_add_acceptances_form_responses', computeChecksum(ddlStatements));
        await client.query('COMMIT');
        console.log('✅ Migración 016 completada.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en Migración 016:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(() => process.exit(1));
