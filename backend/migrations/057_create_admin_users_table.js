/**
 * backend/migrations/057_create_admin_users_table.js
 * 
 * PROPÓSITO: Crear la tabla 'admin_users' para gestionar cuentas administrativas individuales
 * y migrar la contraseña administrativa única de entorno (process.env.ADMIN_PASSWORD)
 * a una credencial persistida con hasheo criptográfico robusto (bcrypt).
 * 
 * ESTÁNDAR DE INGENIERÍA: Idempotencia, Seguridad Bancaria (Password Hashing) y Trazabilidad.
 */

'use strict';

const bcrypt = require('bcrypt');

exports.up = async (client) => {
    console.log('[MIGRATION 057] Iniciando creación de tabla "admin_users" y aprovisionamiento inicial...');

    // 1. Crear la tabla de usuarios administradores
    // Se definen restricciones de unicidad, no nulos y estados por defecto.
    await client.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'admin' NOT NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            last_login TIMESTAMP,
            account_status VARCHAR(20) DEFAULT 'active' NOT NULL
        )
    `);

    console.log('[MIGRATION 057] Tabla "admin_users" creada o verificada correctamente.');

    // 2. Aprovisionar el administrador inicial 'admin'
    // Recuperar la contraseña administrativa actual de entorno
    let rawPassword = process.env.ADMIN_PASSWORD;
    let isUsingDefault = false;

    if (!rawPassword || rawPassword.trim() === '') {
        // Fallback seguro de desarrollo si no existe la variable de entorno
        rawPassword = 'WintonAdmin2026!';
        isUsingDefault = true;
        console.warn('[MIGRATION 057] ⚠️ ADVERTENCIA: Variable ADMIN_PASSWORD no encontrada en el entorno.');
        console.warn('[MIGRATION 057] Aprovisionando administrador por defecto con clave temporal: WintonAdmin2026!');
    }

    // Hashear la contraseña con 10 rondas de salt (Estándar de Seguridad)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(rawPassword, saltRounds);

    // Insertar el usuario administrador inicial utilizando INSERT ON CONFLICT DO NOTHING
    // Esto asegura que la migración sea 100% idempotente y no falle en re-ejecuciones.
    const insertResult = await client.query(`
        INSERT INTO admin_users (username, password_hash, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (username) DO NOTHING
        RETURNING id
    `, ['admin', passwordHash, 'superadmin']);

    if (insertResult.rowCount > 0) {
        console.log('[MIGRATION 057] ✅ Administrador "admin" creado e insertado con hash exitosamente.');
        if (isUsingDefault) {
            console.log('[MIGRATION 057] 🚨 IMPORTANTE: Cambia la contraseña de administrador lo antes posible.');
        }
    } else {
        console.log('[MIGRATION 057] El administrador "admin" ya existía previamente. Omitiendo inserción.');
    }

    console.log('[MIGRATION 057] Migración completada de forma 100% exitosa y auditable.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 057] Revirtiendo migración: Eliminando tabla "admin_users"...');
    
    // Eliminación de la tabla. Por seguridad, esto revierte todos los cambios de esquema.
    await client.query(`
        DROP TABLE IF EXISTS admin_users
    `);
    
    console.log('[MIGRATION 057] Reversión de esquema de base de datos finalizada.');
};
