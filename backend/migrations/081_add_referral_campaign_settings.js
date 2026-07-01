// ============================================================================
// MIGRACIÓN 081: Variables de Campaña para Tarjeta de Referidos (UI)
// ============================================================================
// Siembra las variables para que el administrador pueda personalizar 
// la apariencia de la tarjeta dinámica de referidos cuando el
// modo "Código de Invitación Global" está activo.
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 081] Sembrando configuraciones de UI para campaña de referidos...');

        // 1. Configuración de título y botón
        await client.query(`
            INSERT INTO app_settings (setting_key, setting_value, description)
            VALUES 
                ('referral_card_title', '🔥 CAMPAÑA ESPECIAL', 'Título de la tarjeta de referidos en modo campaña.'),
                ('referral_card_button_text', '📢 COMPARTIR INVITACIÓN', 'Texto del botón de la tarjeta en modo campaña.'),
                ('referral_campaign_image_url', '', 'Ruta relativa de la imagen de fondo para la campaña (ej. /uploads/campaigns/vzla.jpg).')
            ON CONFLICT (setting_key) DO UPDATE SET
                description = EXCLUDED.description;
        `);

        console.log('[MIGRATION 081] ✅ Configuraciones de UI sembradas con éxito.');
    },

    down: async (client) => {
        console.log('[MIGRATION 081] Eliminando configuraciones de UI para campaña...');
        
        await client.query(`
            DELETE FROM app_settings 
            WHERE setting_key IN ('referral_card_title', 'referral_card_button_text', 'referral_campaign_image_url');
        `);
        
        console.log('[MIGRATION 081] ✅ Configuraciones revertidas.');
    }
};
