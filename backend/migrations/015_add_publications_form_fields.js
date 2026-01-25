// Migración: Agregar campo form_fields a publications
// Este campo almacena la definición de los formularios dinámicos por paso
// Estructura: { "2": ["Pregunta 1", "Pregunta 2"], "3": ["Campo 1"] }

const { Pool } = require('pg');
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development' });
const { ensureSchemaMigrationsTable, computeChecksum, recordMigration } = require('./_migration_utils');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    console.log('--- Iniciando Migración 015: form_fields en publications ---');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await ensureSchemaMigrationsTable(client);

        const ddlStatements = `
            ALTER TABLE publications
            ADD COLUMN IF NOT EXISTS form_fields JSONB DEFAULT NULL;
        `;
        await client.query(ddlStatements);

        await recordMigration(client, '015_add_publications_form_fields', computeChecksum(ddlStatements));
        await client.query('COMMIT');
        console.log('✅ Migración 015 completada.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en Migración 015:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(() => process.exit(1));
