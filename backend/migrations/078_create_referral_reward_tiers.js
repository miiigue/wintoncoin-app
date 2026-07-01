// ============================================================================
// MIGRACIÓN 078: Crear y sembrar la tabla de tramos de recompensas de referidos
// ============================================================================
// Propósito: Crear la tabla 'referral_reward_tiers' para configurar los tramos
//            de recompensas promocionales (halving dinámico) según la cantidad
//            acumulada de usuarios en el sistema.
// Sembrado:  Tramo 1 (10k limit -> 200 BLUE), Tramo 2 (310k limit -> 100 BLUE)
//            y Tramo 3 (1010k limit -> 75 BLUE).
//
// Estándar: Transaccional, idempotente y alineado a auditoría SOC 2.
// ============================================================================

'use strict';

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 078] Creando tabla referral_reward_tiers...');

        // 1. Crear tabla con restricciones contables y de rangos seguros
        await client.query(`
            CREATE TABLE IF NOT EXISTS referral_reward_tiers (
                id SERIAL PRIMARY KEY,
                tier_number INTEGER UNIQUE NOT NULL,
                label VARCHAR(100) NOT NULL,
                max_users_limit INTEGER NOT NULL CHECK (max_users_limit > 0),
                reward_amount NUMERIC(18, 4) NOT NULL CHECK (reward_amount >= 0),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('[MIGRATION 078] Sembrando tramos iniciales de recompensas (200, 100 y 75 BLUE)...');

        // 2. Sembrado inicial de los tramos por defecto
        await client.query(`
            INSERT INTO referral_reward_tiers (tier_number, label, max_users_limit, reward_amount)
            VALUES 
                (1, 'Tramo 1 (Primeros 10k)', 10000, 200.0000),
                (2, 'Tramo 2 (Siguientes 300k)', 310000, 100.0000),
                (3, 'Tramo 3 (Siguientes 700k)', 1010000, 75.0000)
            ON CONFLICT (tier_number) DO UPDATE 
            SET label = EXCLUDED.label,
                max_users_limit = EXCLUDED.max_users_limit,
                reward_amount = EXCLUDED.reward_amount;
        `);

        // 3. Establecer la recompensa post-promoción en 0 para apagar los bonos tras la expiración
        await client.query(`
            UPDATE app_settings 
            SET setting_value = '0' 
            WHERE setting_key = 'referral_reward_after_expiry';
        `);

        console.log('[MIGRATION 078] ✅ Tabla referral_reward_tiers creada y sembrada con éxito.');
    },

    down: async (client) => {
        console.log('[MIGRATION 078] Eliminando tabla referral_reward_tiers...');
        await client.query('DROP TABLE IF EXISTS referral_reward_tiers CASCADE;');
        console.log('[MIGRATION 078] ✅ Tabla referral_reward_tiers eliminada.');
    }
};
