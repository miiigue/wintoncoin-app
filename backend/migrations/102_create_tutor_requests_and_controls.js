/**
 * backend/migrations/102_create_tutor_requests_and_controls.js
 * 
 * PROPÓSITO: Migración de base de datos para la gestión segura de tutores y controles parentales FinTech.
 * 1. Crea la tabla 'tutor_requests' para implementar el modelo Maker-Checker de aprobación de tutelas legales (Cumplimiento SOC 2, COPPA y RGPD).
 * 2. Añade las columnas de control parental 'is_suspended_by_tutor' y 'tutor_permissions' (JSONB) a la tabla 'users'.
 * 
 * ESTÁNDAR DE INGENIERÍA: Idempotencia total, Cero Modificaciones a migraciones previas, Auditoría y Seguridad Cero Confianza.
 */

'use strict';

exports.up = async (client) => {
    console.log('[MIGRATION 102] Iniciando creación de tabla "tutor_requests" y columnas de control parental...');

    // 1. Crear la tabla de solicitudes de tutela (Maker-Checker)
    // Permite que los menores soliciten tutela y los tutores aprueben o rechacen explícitamente el contrato de responsabilidad legal.
    await client.query(`
        CREATE TABLE IF NOT EXISTS tutor_requests (
            id SERIAL PRIMARY KEY,
            minor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            tutor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) DEFAULT 'pending' NOT NULL,
            ip_address VARCHAR(45),
            user_agent TEXT,
            approved_terms_version VARCHAR(50),
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
            CONSTRAINT chk_tutor_request_status CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
        );
    `);

    // 2. Crear índice único parcial para asegurar que un menor solo tenga una solicitud 'pending' activa a la vez
    await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_tutor_request 
        ON tutor_requests (minor_user_id) 
        WHERE status = 'pending';
    `);

    console.log('[MIGRATION 102] Tabla "tutor_requests" e índices creados correctamente.');

    // 3. Añadir columna 'is_suspended_by_tutor' a la tabla 'users' si no existe
    // Permite al tutor congelar o pausar el acceso financiero del menor en tiempo real (freno de mano de emergencia FinTech).
    await client.query(`
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_suspended_by_tutor') THEN
                ALTER TABLE users ADD COLUMN is_suspended_by_tutor BOOLEAN DEFAULT FALSE NOT NULL;
            END IF;
        END $$;
    `);

    // 4. Añadir columna 'tutor_permissions' (JSONB) a la tabla 'users' si no existe
    // Almacena permisos granulares (allow_contracting, allow_selling, allow_donations, allow_p2p) y límite de deuda max_red_debt.
    await client.query(`
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tutor_permissions') THEN
                ALTER TABLE users ADD COLUMN tutor_permissions JSONB DEFAULT '{"allow_contracting": true, "allow_selling": true, "allow_donations": true, "allow_p2p": false, "max_red_debt": 20.0000}'::jsonb NOT NULL;
            END IF;
        END $$;
    `);

    console.log('[MIGRATION 102] Columnas de control parental "is_suspended_by_tutor" y "tutor_permissions" añadidas a "users".');
    console.log('[MIGRATION 102] Migración completada exitosamente.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 102] Revertir migración: Eliminando tabla "tutor_requests" y columnas de control parental...');
    
    // 1. Eliminar la tabla de solicitudes de tutela
    await client.query(`DROP TABLE IF EXISTS tutor_requests CASCADE;`);

    // 2. Eliminar columnas de control parental en la tabla 'users'
    await client.query(`
        ALTER TABLE users 
        DROP COLUMN IF EXISTS is_suspended_by_tutor,
        DROP COLUMN IF EXISTS tutor_permissions;
    `);

    console.log('[MIGRATION 102] Reversión de migración finalizada.');
};
