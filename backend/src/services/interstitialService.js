const pool = require('../config/db');

/**
 * Servicio para gestionar mensajes intersticiales (modales que bloquean la vista hasta ser aceptados)
 */
class InterstitialService {

    /**
     * Obtiene el mensaje correspondiente al día actual de la semana
     * @returns {Promise<Object>}
     */
    async getCurrentDailyMessage() {
        const daysShort = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const today = new Date().getDay();
        const dayKey = `daily_modal_${daysShort[today]}`;
        const titleKey = 'daily_modal_title';

        try {
            const result = await pool.query(
                "SELECT setting_key, setting_value FROM app_settings WHERE setting_key = $1 OR setting_key = $2",
                [titleKey, dayKey]
            );

            const settings = {};
            result.rows.forEach(row => {
                settings[row.setting_key] = row.setting_value;
            });

            return {
                title: settings[titleKey] || '¿Sabías?',
                message: settings[dayKey] || '',
                day: daysShort[today]
            };
        } catch (error) {
            console.error('Error al obtener mensaje diario:', error);
            throw error;
        }
    }

    /**
     * Verifica si el modal global de la aplicación está activado
     * @returns {Promise<boolean>}
     */
    async isGlobalModalEnabled() {
        try {
            const result = await pool.query(
                "SELECT setting_value FROM app_settings WHERE setting_key = 'global_app_interstitial_enabled'"
            );
            return result.rows.length > 0 && result.rows[0].setting_value === 'true';
        } catch (error) {
            console.error('Error al verificar estado del modal global:', error);
            return false;
        }
    }

    /**
     * Obtiene la configuración completa del modal global para el cliente
     */
    async getGlobalConfig() {
        const enabled = await this.isGlobalModalEnabled();
        if (!enabled) return { enabled: false };

        const daily = await this.getCurrentDailyMessage();
        return {
            enabled: true,
            ...daily
        };
    }
}

module.exports = new InterstitialService();
