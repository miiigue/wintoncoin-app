// ============================================================================
// MIGRACIÓN 079: Agregar configuraciones de plantilla y código global de referidos
// ============================================================================
// Propósito: Sembrar en 'app_settings' el código especial, el switch de activación
//            y la plantilla del mensaje a compartir en redes sociales.
//
// Estándar: Transaccional, idempotente y de grado SOC 2.
// ============================================================================

'use strict';

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 079] Sembrando configuraciones de mensaje de referido en app_settings...');

        const settings = [
            {
                key: 'referral_custom_share_code',
                value: 'WINTON',
                desc: 'Código de referido especial/global para forzar su uso al compartir en redes sociales.'
            },
            {
                key: 'referral_custom_share_code_enabled',
                value: 'false',
                desc: 'Habilita (true) o deshabilita (false) el uso forzado del código de referido especial.'
            },
            {
                key: 'referral_share_message_template',
                value: '¡Hola! Únete a WintonCoin usando mi código {code} y ambos ganaremos {reward} BLUE IOU de bienvenida.\n\n👉 Regístrate gratis aquí: {link}\n\n(Sujeto a disponibilidad de tramos promocionales)',
                desc: 'Plantilla de texto utilizada para compartir la invitación por WhatsApp y redes sociales.'
            }
        ];

        for (const s of settings) {
            await client.query(`
                INSERT INTO app_settings (setting_key, setting_value, description)
                VALUES ($1, $2, $3)
                ON CONFLICT (setting_key) DO UPDATE 
                SET description = EXCLUDED.description;
            `, [s.key, s.value, s.desc]);
        }

        console.log('[MIGRATION 079] ✅ Configuraciones de mensaje de referido sembradas con éxito.');
    },

    down: async (client) => {
        console.log('[MIGRATION 079] Revirtiendo configuraciones de mensaje de referido en app_settings...');
        await client.query(`
            DELETE FROM app_settings 
            WHERE setting_key IN ('referral_custom_share_code', 'referral_custom_share_code_enabled', 'referral_share_message_template')
        `);
        console.log('[MIGRATION 079] ✅ Configuraciones de mensaje de referido eliminadas.');
    }
};
