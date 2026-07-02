/**
 * Migración 082 - Agregar configuración de subtítulo para la tarjeta de referidos
 */
module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 082] Creando configuración de subtítulo para referidos...');

        await client.query(`
            INSERT INTO app_settings (setting_key, setting_value, description)
            VALUES 
                ('referral_card_subtitle', 'Bono por referir hoy', 'Subtítulo del bono o recompensa de referidos en la tarjeta.')
            ON CONFLICT (setting_key) DO UPDATE SET
                description = EXCLUDED.description;
        `);

        console.log('[MIGRATION 082] ✅ Configuración de subtítulo sembrada con éxito.');
    },

    down: async (client) => {
        console.log('[MIGRATION 082] Eliminando configuración de subtítulo...');
        
        await client.query(`
            DELETE FROM app_settings 
            WHERE setting_key = 'referral_card_subtitle';
        `);
        
        console.log('[MIGRATION 082] ✅ Configuración revertida.');
    }
};
