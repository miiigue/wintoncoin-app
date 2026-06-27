// ============================================================================
// MIGRACIÓN 075: Actualizar expiración del escrow de donaciones a 150 días
// ============================================================================
// Propósito: Modificar el valor por defecto de 'donation_escrow_expiration_days'
//            en la tabla 'app_settings' a 150 días. Esto amplía el plazo para que 
//            los donantes completen su KYC Web3 y evita cancelaciones/reembolsos
//            prematuros o fraudes por auto-reembolso intencional.
//
// Formato: compatible con el motor central de migración de WintonCoin.
// Estándar: Transaccional, idempotente, comentado y 100% auditable.
// ============================================================================

'use strict';

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 075] Iniciando actualización de plazo de escrow de donación a 150 días...');
        
        // Actualizar el valor de configuración en app_settings
        // Se establece a '150' para brindar un margen de adaptación operativa
        await client.query(`
            UPDATE app_settings
            SET setting_value = '150'
            WHERE setting_key = 'donation_escrow_expiration_days';
        `);
        
        console.log('[MIGRATION 075] ✅ Configuración donation_escrow_expiration_days actualizada a 150 días en base de datos.');
    },

    down: async (client) => {
        console.log('[MIGRATION 075] Revirtiendo plazo de escrow de donación a 15 días (valor por defecto previo)...');
        
        // Retornar al valor de fábrica original de 15 días
        await client.query(`
            UPDATE app_settings
            SET setting_value = '15'
            WHERE setting_key = 'donation_escrow_expiration_days';
        `);
        
        console.log('[MIGRATION 075] ✅ Configuración donation_escrow_expiration_days restablecida a 15 días.');
    }
};
