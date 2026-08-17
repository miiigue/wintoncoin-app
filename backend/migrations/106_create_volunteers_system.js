'use strict';
// Importación del pool de conexiones a PostgreSQL
const pool = require('../src/config/db');

/**
 * Migración 106: Sistema de Registro, Expediente Inteligente y Bitácora de Voluntarios SOS
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * Crea las tablas necesarias para la gestión auditable de voluntarios:
 * 1. volunteers_registry: Registro inmutable de expedientes con codificación inteligente de 4 dígitos.
 * 2. volunteer_activity_history: Bitácora de eventos del expediente (registro, verificación OTP, activaciones).
 */
async function up() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Crear tabla principal de Expedientes de Voluntarios
        await client.query(`
            CREATE TABLE IF NOT EXISTS volunteers_registry (
                id SERIAL PRIMARY KEY,
                dossier_number VARCHAR(50) UNIQUE NOT NULL,
                user_id INT REFERENCES users(id) ON DELETE SET NULL,
                full_name VARCHAR(255) NOT NULL,
                id_document VARCHAR(30) UNIQUE NOT NULL,
                birth_date DATE NOT NULL,
                age INT NOT NULL,
                gender VARCHAR(20) NOT NULL DEFAULT 'female',
                email VARCHAR(255) NOT NULL,
                phone_number VARCHAR(30) NOT NULL,
                country VARCHAR(100) NOT NULL DEFAULT 'Venezuela',
                state VARCHAR(100) NOT NULL,
                municipality VARCHAR(100) NOT NULL,
                sector_city VARCHAR(150) NOT NULL,
                volunteer_types TEXT[] NOT NULL DEFAULT '{}',
                availability TEXT[] NOT NULL DEFAULT '{}',
                profession_skills TEXT,
                priority_score INT DEFAULT 0,
                status VARCHAR(30) NOT NULL DEFAULT 'pending_verification',
                data_consent_accepted BOOLEAN NOT NULL DEFAULT TRUE,
                legal_disclaimer_accepted BOOLEAN NOT NULL DEFAULT TRUE,
                verified_by_admin_id INT REFERENCES admin_users(id) ON DELETE SET NULL,
                admin_notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_volunteers_user_id ON volunteers_registry(user_id);
            CREATE INDEX IF NOT EXISTS idx_volunteers_email ON volunteers_registry(email);
            CREATE INDEX IF NOT EXISTS idx_volunteers_id_document ON volunteers_registry(id_document);
            CREATE INDEX IF NOT EXISTS idx_volunteers_status ON volunteers_registry(status);
            CREATE INDEX IF NOT EXISTS idx_volunteers_priority_score ON volunteers_registry(priority_score DESC);
        `);

        // 2. Crear tabla de Bitácora e Historial de Eventos del Voluntario
        await client.query(`
            CREATE TABLE IF NOT EXISTS volunteer_activity_history (
                id SERIAL PRIMARY KEY,
                volunteer_id INT NOT NULL REFERENCES volunteers_registry(id) ON DELETE CASCADE,
                event_type VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_volunteer_history_vol_id ON volunteer_activity_history(volunteer_id);
        `);

        await client.query('COMMIT');
        console.log('[MIGRATION 106] ✅ Sistema de registro de voluntarios creado con éxito.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MIGRATION 106] ❌ Error al ejecutar migración 106:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function down() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DROP TABLE IF EXISTS volunteer_activity_history CASCADE;');
        await client.query('DROP TABLE IF EXISTS volunteers_registry CASCADE;');
        await client.query('COMMIT');
        console.log('[MIGRATION 106] ✅ Tablas de voluntariado eliminadas con éxito.');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { up, down };
