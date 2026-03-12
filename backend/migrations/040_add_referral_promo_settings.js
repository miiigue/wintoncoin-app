// ============================================================================
// MIGRACIÓN 040: Configuración de Recompensa Pos-Promoción
// ============================================================================
// Añade el campo para definir cuánto se ganará después de que termine la promo.
// Esto permite mostrar en el frontend la dinámica "Gana 1000 ahora, 750 después".
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 040] Añadiendo configuración referral_reward_after_expiry...');

        await client.query(`
            INSERT INTO app_settings (setting_key, setting_value, description)
            VALUES (
                'referral_reward_after_expiry', 
                '750.00', 
                'Cantidad de BLUE que se otorgará por referido después de que expire la promoción actual.'
            )
            ON CONFLICT (setting_key) DO NOTHING;
        `);

        console.log('[MIGRATION 040] ✅ Configuración añadida correctamente.');
    },

    down: async (client) => {
        console.log('[MIGRATION 040] Revirtiendo configuración...');
        await client.query("DELETE FROM app_settings WHERE setting_key = 'referral_reward_after_expiry';");
        console.log('[MIGRATION 040] ✅ Configuración eliminada.');
    }
};
