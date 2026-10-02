'use strict';

/**
 * Migración 120: Infraestructura de Curación y Recuperación Gradual de Compromisos RED Post-Mora
 * 
 * PROPÓSITO FINTECH & ESTÁNDAR BANCARIO (Auditoría SOC 2 & Whitepaper Canónico):
 * 1. Crea la tabla inmutable de auditoría bancaria `user_credit_cure_logs` para registrar
 *    con precisión cronológica cuándo un usuario terminó de saldar todos sus compromisos RED vencidos.
 * 2. Añade a la tabla `users` las columnas de control $O(1)$ para trackear el inicio de la curación,
 *    el límite penalizado de partida (ej. 50 RED tras halving) y el límite objetivo (ej. 100 RED).
 * 3. Permite la recuperación gradual a razón de un 10% mensual (1.000 BPS) por cada 30 días continuos
 *    de conducta intachable al día, erradicando saltos repentinos y modelando la regla económica real.
 */

async function up(client) {
    // 1. Tabla de bitácora y auditoría bancaria de eventos de curación
    await client.query(`
        CREATE TABLE IF NOT EXISTS user_credit_cure_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            penalty_limit NUMERIC(24,6) NOT NULL CHECK (penalty_limit >= 0),
            target_limit NUMERIC(24,6) NOT NULL CHECK (target_limit >= penalty_limit),
            cured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            monthly_recovery_bps INTEGER NOT NULL DEFAULT 1000 CHECK (monthly_recovery_bps > 0),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_user_credit_cure_logs_user_cured 
            ON user_credit_cure_logs(user_id, cured_at DESC);
    `);

    // 2. Columnas en users para evaluación de scoring en tiempo constante O(1)
    await client.query(`
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS last_mora_cured_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS mora_penalty_base_limit NUMERIC(24,6) CHECK (mora_penalty_base_limit >= 0),
            ADD COLUMN IF NOT EXISTS mora_target_limit NUMERIC(24,6) CHECK (mora_target_limit >= 0);
    `);
}

async function down() {
    throw new Error('La reversión de la infraestructura de auditoría de curación de crédito no está permitida.');
}

module.exports = {
    up,
    down
};
