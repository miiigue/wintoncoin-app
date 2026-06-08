/**
 * backend/migrations/058_create_admin_invitations_table.js
 * 
 * PROPÓSITO: Crear la tabla 'admin_invitations' para gestionar invitaciones de administradores
 * utilizando tokens efímeros hasheados (SHA-256) para máxima seguridad (Zero Hardcoded/Leaked Secrets).
 * 
 * ESTÁNDAR DE INGENIERÍA: Idempotencia, Seguridad Bancaria y Trazabilidad.
 */

'use strict';

exports.up = async (client) => {
    console.log('[MIGRATION 058] Iniciando creación de tabla "admin_invitations"...');

    // Crear la tabla de invitaciones de administrador
    await client.query(`
        CREATE TABLE IF NOT EXISTS admin_invitations (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            token_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 del token plano
            role VARCHAR(20) DEFAULT 'admin' NOT NULL,
            created_by VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP
        )
    `);

    console.log('[MIGRATION 058] Tabla "admin_invitations" creada o verificada correctamente.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 058] Revirtiendo migración: Eliminando tabla "admin_invitations"...');
    await client.query(`
        DROP TABLE IF EXISTS admin_invitations
    `);
    console.log('[MIGRATION 058] Reversión finalizada.');
};
