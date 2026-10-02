'use strict';

/**
 * Migración 119: Motor de Reintentos Automáticos Exponenciales para Políticas de Compromiso RED
 * 
 * PROPÓSITO (Estándar Bancario & Escalabilidad a 1 Millón de Usuarios):
 * Extiende la tabla credit_policy_issues para permitir que el worker de fondo
 * ejecute reintentos de forma 100% autónoma con retroceso exponencial (Exponential Backoff con Jitter),
 * eliminando la necesidad de que un administrador deba intervenir manualmente o hacer clics
 * en casos de fluctuaciones o congestión transitoria de la red blockchain.
 */

async function up(client) {
    // 1. Añadir columnas de control para retroceso exponencial y tolerancia a fallos
    await client.query(`
        ALTER TABLE credit_policy_issues
            ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 5,
            ADD COLUMN IF NOT EXISTS last_error TEXT
    `);

    // 2. Crear índice optimizado para que el worker seleccione eficientemente las tareas pendientes de reintento
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_credit_policy_issues_backoff 
        ON credit_policy_issues(version_id, status, next_retry_at)
        WHERE status IN ('open', 'retrying')
    `);
}

module.exports = {
    up,
    down: async () => {
        throw new Error('La reversión de la infraestructura de auditoría y reintentos no está permitida.');
    }
};
