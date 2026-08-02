'use strict';
const pool = require('../src/config/db');

/**
 * Migración 101: Tabla de Historial y Bitácora de Eventos para Expedientes SOS (SOS Venezuela)
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * Crea la tabla disaster_victim_history para registrar eventos de auditoría,
 * cambios de estado y mensajes con precisión de fecha y hora.
 */
async function up() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(`
            CREATE TABLE IF NOT EXISTS disaster_victim_history (
                id SERIAL PRIMARY KEY,
                victim_id INT NOT NULL REFERENCES disaster_victims_registry(id) ON DELETE CASCADE,
                event_type VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_victim_history_victim_id ON disaster_victim_history(victim_id);
        `);

        await client.query('COMMIT');
        console.log('[MIGRATION 101] ✅ Tabla disaster_victim_history creada con éxito.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MIGRATION 101] ❌ Error al ejecutar migración 101:', error);
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
            DROP TABLE IF EXISTS disaster_victim_history CASCADE;
        `);
        await client.query('COMMIT');
        console.log('[MIGRATION 101] ✅ Tabla disaster_victim_history eliminada.');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { up, down };
