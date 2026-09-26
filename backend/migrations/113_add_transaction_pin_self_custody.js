'use strict';

/**
 * Migración 113: Implementación de Autocustodia con PIN de 6 Dígitos y Keystore Criptográfico en users.
 * 
 * OBJETIVO FINTECH & LEGAL (SOC 2 / Zero-Trust / No-Custodial Compliance):
 * Permite que los usuarios operen bajo el paradigma de Autocustodia (Non-Custodial)
 * mediante un PIN personal de 6 dígitos que protege su clave privada en un Keystore cifrado (AES-256-GCM).
 * 
 * CAMPOS AGREGADOS:
 * - has_transaction_pin: Flag booleano que indica si el usuario activó su PIN de seguridad.
 * - transaction_pin_hash: Hash bcrypt del PIN para control de intentos y mitigación de fuerza bruta.
 * - transaction_pin_salt: Salt criptográfico único por usuario para derivación de clave (PBKDF2-SHA256).
 * - transaction_pin_failed_attempts: Contador de intentos fallidos consecutivos (bloqueo preventivo tras 5 intentos).
 * - transaction_pin_locked_until: Timestamp de bloqueo temporal en caso de exceder intentos.
 * - web3_keystore: Paquete JSONB con los datos cifrados (ciphertext, iv, authTag, salt, kdf).
 */

async function up(client) {
    await client.query('SAVEPOINT migration113');
    try {
        console.log('[MIGRATION 113] Iniciando creación de campos de autocustodia y PIN de 6 dígitos en tabla users...');

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS has_transaction_pin BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS transaction_pin_hash VARCHAR(255),
            ADD COLUMN IF NOT EXISTS transaction_pin_salt VARCHAR(64),
            ADD COLUMN IF NOT EXISTS transaction_pin_failed_attempts INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS transaction_pin_locked_until TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS web3_keystore JSONB;
        `);

        // Índice para optimizar consultas de verificación de PIN en flujos transaccionales
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_has_transaction_pin ON users(has_transaction_pin);
        `);

        await client.query('RELEASE SAVEPOINT migration113');
        console.log('[MIGRATION 113] ✅ Campos de autocustodia y PIN de 6 dígitos creados exitosamente.');
    } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT migration113');
        throw err;
    }
}

async function down(client) {
    console.log('[MIGRATION 113] Revirtiendo migración 113: Eliminando columnas de PIN y autocustodia...');

    await client.query(`
        DROP INDEX IF EXISTS idx_users_has_transaction_pin;
        ALTER TABLE users
        DROP COLUMN IF EXISTS has_transaction_pin,
        DROP COLUMN IF EXISTS transaction_pin_hash,
        DROP COLUMN IF EXISTS transaction_pin_salt,
        DROP COLUMN IF EXISTS transaction_pin_failed_attempts,
        DROP COLUMN IF EXISTS transaction_pin_locked_until,
        DROP COLUMN IF EXISTS web3_keystore;
    `);

    console.log('[MIGRATION 113] ✅ Reversión de migración 113 completada.');
}

module.exports = { up, down };
