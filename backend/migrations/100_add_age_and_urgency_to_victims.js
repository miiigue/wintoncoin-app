'use strict';
const pool = require('../src/config/db');

/**
 * Migración 100: Adición de Campos de Edad, Fecha de Nacimiento y Score de Urgencia en Expedientes SOS
 * ═════════════════════════════════════════════════════════════════════════════════════════════════════
 * Adiciona las columnas auditables para el cálculo de urgencia de 4 dígitos y censo de edad.
 * Compatible con migrationRunner.js (up/down).
 */
async function up() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Adicionar columnas a disaster_victims_registry, users y pending_verifications
        await client.query(`
            ALTER TABLE disaster_victims_registry ADD COLUMN IF NOT EXISTS birth_date DATE;
            ALTER TABLE disaster_victims_registry ADD COLUMN IF NOT EXISTS age INT NOT NULL DEFAULT 18;
            ALTER TABLE disaster_victims_registry ADD COLUMN IF NOT EXISTS urgency_score INT NOT NULL DEFAULT 0;

            ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
            ALTER TABLE pending_verifications ADD COLUMN IF NOT EXISTS date_of_birth DATE;
        `);

        await client.query('COMMIT');
        console.log('[MIGRATION 100] ✅ Columnas birth_date, age y urgency_score añadidas a disaster_victims_registry exitosamente.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MIGRATION 100] ❌ Error al ejecutar migración 100:', error);
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
            ALTER TABLE disaster_victims_registry DROP COLUMN IF EXISTS birth_date;
            ALTER TABLE disaster_victims_registry DROP COLUMN IF EXISTS age;
            ALTER TABLE disaster_victims_registry DROP COLUMN IF EXISTS urgency_score;
        `);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { up, down };
