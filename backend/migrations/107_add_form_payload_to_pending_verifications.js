'use strict';
// Importación del pool de conexiones a la base de datos PostgreSQL
const pool = require('../src/config/db');

/**
 * Migración 107: Almacenamiento Modular de Payload en Staging (pending_verifications)
 * ═════════════════════════════════════════════════════════════════════════════════════
 * Añade la columna 'form_payload' de tipo JSONB a la tabla 'pending_verifications'.
 * Esto permite resguardar temporalmente todos los campos del formulario (Damnificados SOS,
 * Voluntarios SOS, Comerciantes, Refugios, etc.) antes de validar el código OTP,
 * garantizando que las tablas oficiales de expedientes y usuarios permanezcan 100%
 * limpias y libres de registros fantasma o abandonados.
 */
async function up() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verificar y añadir la columna form_payload JSONB si no existe
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'pending_verifications' AND column_name = 'form_payload'
                ) THEN
                    ALTER TABLE pending_verifications ADD COLUMN form_payload JSONB;
                END IF;
            END $$;
        `);

        // Crear índice GIN optimizado para consultas de alta velocidad sobre el payload JSONB
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_pending_verifications_form_payload 
            ON pending_verifications USING GIN (form_payload);
        `);

        await client.query('COMMIT');
        console.log('[MIGRATION 107] ✅ Columna form_payload JSONB e índice GIN creados con éxito en pending_verifications.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MIGRATION 107] ❌ Error al ejecutar migración 107:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function down() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            DROP INDEX IF EXISTS idx_pending_verifications_form_payload;
            ALTER TABLE pending_verifications DROP COLUMN IF EXISTS form_payload;
        `);
        await client.query('COMMIT');
        console.log('[MIGRATION 107] ⏪ Columna form_payload revertida de pending_verifications.');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { up, down };
