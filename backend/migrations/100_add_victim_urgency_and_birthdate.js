/**
 * Migración 100: Agregar campos birth_date, age y urgency_score a disaster_victims_registry
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * Garantiza que entornos donde la migración 099 ya fue ejecutada (como Demo DB) reciban
 * de forma incremental las columnas birth_date, age y urgency_score.
 * 
 * Formato compatible con migrationRunner.js y run_migrations.js
 */

const pool = require('../src/config/db');

async function up(clientOrNull) {
    let client = clientOrNull;
    let ownClient = false;

    if (!client || typeof client.query !== 'function') {
        client = await pool.connect();
        ownClient = true;
        await client.query('BEGIN');
    }

    try {
        console.log('[MIGRATION 100] Aplicando columnas de urgencia, fecha de nacimiento y edad en disaster_victims_registry...');

        await client.query(`
            ALTER TABLE disaster_victims_registry ADD COLUMN IF NOT EXISTS birth_date DATE;
            ALTER TABLE disaster_victims_registry ADD COLUMN IF NOT EXISTS age INT NOT NULL DEFAULT 18;
            ALTER TABLE disaster_victims_registry ADD COLUMN IF NOT EXISTS urgency_score INT NOT NULL DEFAULT 0;
        `);

        if (ownClient) {
            await client.query('COMMIT');
        }
        console.log('✅ Migración 100 completada: Columnas birth_date, age y urgency_score agregadas exitosamente.');
    } catch (error) {
        if (ownClient) {
            await client.query('ROLLBACK');
        }
        console.error('❌ Error en la migración 100:', error);
        throw error;
    } finally {
        if (ownClient && client) {
            client.release();
        }
    }
}

module.exports = { up };
