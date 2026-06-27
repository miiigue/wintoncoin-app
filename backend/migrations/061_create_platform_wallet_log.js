/**
 * backend/migrations/061_create_platform_wallet_log.js
 * 
 * PROPÓSITO: Crear la tabla 'platform_wallet_log' para registrar todas las transacciones
 * e historial de la billetera de la plataforma (deudas saldadas, quemas de tokens,
 * pagos a impulsores). Garantiza la trazabilidad contable y auditoría de partida doble.
 * 
 * ESTÁNDAR DE INGENIERÍA: Idempotencia y Trazabilidad de Auditoría Bancaria.
 */

'use strict';

exports.up = async (client) => {
    console.log('[MIGRATION 061] Creando tabla platform_wallet_log...');

    await client.query(`
        CREATE TABLE IF NOT EXISTS platform_wallet_log (
            id SERIAL PRIMARY KEY,
            transaction_type VARCHAR(50) NOT NULL, -- ej: 'burn', 'booster_payout'
            amount NUMERIC(19, 4) NOT NULL,       -- el monto de la transacción (puede ser negativo)
            related_username VARCHAR(255),       -- usuario asociado a la transacción (opcional)
            description TEXT,                     -- detalle/concepto de la transacción
            created_at TIMESTAMPTZ DEFAULT NOW() -- fecha y hora del evento
        );
    `);

    // Índice de rendimiento y auditoría
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_platform_wallet_log_type 
        ON platform_wallet_log (transaction_type, created_at);
    `);

    console.log('[MIGRATION 061] ✅ Tabla platform_wallet_log y su índice fueron creados/verificados con éxito.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 061] Revirtiendo migración: Eliminando tabla platform_wallet_log...');
    await client.query('DROP TABLE IF EXISTS platform_wallet_log CASCADE;');
    console.log('[MIGRATION 061] Reversión finalizada.');
};
