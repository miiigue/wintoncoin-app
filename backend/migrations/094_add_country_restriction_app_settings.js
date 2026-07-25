const pool = require('../src/config/db');

/**
 * Migración 094: Configuraciones de Restricción de Registro por País en app_settings
 * ════════════════════════════════════════════════════════════════════════════════════
 * Inserta las claves globales en la tabla app_settings:
 *  - registration_country_restriction_enabled: 'true'
 *  - registration_allowed_country_prefixes: '+58'
 *  - registration_country_restriction_notice_text: 'Por el momento solo se aceptan registros de personas residentes en Venezuela (+58).'
 */
async function up() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Insertar configuraciones iniciales de restricción de registro por país
        const settings = [
            { key: 'registration_country_restriction_enabled', value: 'true' },
            { key: 'registration_allowed_country_prefixes', value: '+58' },
            { key: 'registration_country_restriction_notice_text', value: 'Por el momento solo se aceptan registros de personas residentes en Venezuela (+58).' }
        ];

        for (const setting of settings) {
            await client.query(`
                INSERT INTO app_settings (setting_key, setting_value) 
                VALUES ($1, $2)
                ON CONFLICT (setting_key) DO NOTHING;
            `, [setting.key, setting.value]);
        }

        await client.query('COMMIT');
        console.log('✅ Migración 094 completada: Configuraciones de restricción por país agregadas a app_settings.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en la migración 094:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { up };
