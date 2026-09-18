'use strict';
// Importación del pool centralizado de conexiones PostgreSQL
const pool = require('../src/config/db');

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * MIGRACIÓN 108: Garantizar Restricción Única en 'referral_log.referred_user_id'
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * Estándar FinTech, Integridad Referencial y Ciberseguridad Bancaria (SOC 2):
 *
 * 1. Diagnóstico del Incidente:
 *    En bases de datos históricas de producción creadas previamente, la tabla 'referral_log'
 *    carecía de una restricción UNIQUE en la columna 'referred_user_id'. Al ejecutar consultas
 *    con 'ON CONFLICT (referred_user_id)', PostgreSQL arrojaba el error:
 *    "there is no unique or exclusion constraint matching the ON CONFLICT specification",
 *    lo que provocaba el envenenamiento/aborto de la transacción (error 25P02) en la
 *    verificación OTP de nuevos damnificados SOS.
 *
 * 2. Solución Aplicada:
 *    - Depura duplicados históricos preservando el registro original más antiguo (MIN(id)).
 *    - Aplica de forma idempotente la restricción UNIQUE 'referral_log_referred_user_id_key'.
 *    - Crea un índice B-Tree optimizado para acelerar las consultas de genealogía de referidos.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */

async function up(clientOrPool) {
    const isStandalone = !clientOrPool;
    const client = isStandalone ? await pool.connect() : clientOrPool;

    try {
        if (isStandalone) await client.query('BEGIN');

        console.log('[MIGRATION 108] 🚀 Verificando integridad de tabla referral_log y restricción UNIQUE...');

        // 1. Asegurar existencia de la tabla base 'referral_log' si no existiera
        await client.query(`
            CREATE TABLE IF NOT EXISTS referral_log (
                id SERIAL PRIMARY KEY,
                referrer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // 2. Depuración atómica de duplicados históricos (si existieran) antes de aplicar la restricción UNIQUE
        // Conserva el registro original con el menor ID (primer registro cronológico)
        await client.query(`
            DELETE FROM referral_log a 
            USING referral_log b
            WHERE a.id > b.id 
              AND a.referred_user_id = b.referred_user_id;
        `);

        // 3. Adición idempotente de la restricción UNIQUE sobre 'referred_user_id'
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM pg_constraint 
                    WHERE conname = 'referral_log_referred_user_id_key'
                ) AND NOT EXISTS (
                    SELECT 1 
                    FROM pg_indexes 
                    WHERE tablename = 'referral_log' 
                      AND (indexname = 'referral_log_referred_user_id_key' OR indexname = 'referral_log_referred_user_id_idx')
                ) THEN
                    ALTER TABLE referral_log 
                    ADD CONSTRAINT referral_log_referred_user_id_key UNIQUE (referred_user_id);
                    RAISE NOTICE 'Restricción UNIQUE referral_log_referred_user_id_key añadida exitosamente.';
                END IF;
            END $$;
        `);

        // 4. Crear índice auxiliar sobre referrer_user_id para acelerar conteo y genealogía
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_referral_log_referrer_user_id 
            ON referral_log (referrer_user_id);
        `);

        if (isStandalone) await client.query('COMMIT');
        console.log('[MIGRATION 108] ✅ Restricción UNIQUE e índices asegurados en referral_log exitosamente.');

    } catch (error) {
        if (isStandalone) await client.query('ROLLBACK');
        console.error('[MIGRATION 108] ❌ Error ejecutando migración 108:', error);
        throw error;
    } finally {
        if (isStandalone) client.release();
    }
}

async function down(clientOrPool) {
    const isStandalone = !clientOrPool;
    const client = isStandalone ? await pool.connect() : clientOrPool;

    try {
        if (isStandalone) await client.query('BEGIN');

        await client.query(`
            ALTER TABLE referral_log DROP CONSTRAINT IF EXISTS referral_log_referred_user_id_key;
            DROP INDEX IF EXISTS idx_referral_log_referrer_user_id;
        `);

        if (isStandalone) await client.query('COMMIT');
        console.log('[MIGRATION 108] ⏪ Restricción UNIQUE e índices revertidos en referral_log.');

    } catch (error) {
        if (isStandalone) await client.query('ROLLBACK');
        console.error('[MIGRATION 108] ❌ Error revirtiendo migración 108:', error);
        throw error;
    } finally {
        if (isStandalone) client.release();
    }
}

module.exports = { up, down };
