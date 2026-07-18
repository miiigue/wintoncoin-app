const pool = require('../src/config/db');

async function up() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Insertar configuraciones iniciales de limites de imágenes
        const settings = [
            { key: 'max_images_request', value: '1' },
            { key: 'max_images_sell', value: '2' },
            { key: 'max_images_donation', value: '1' },
            { key: 'max_images_platform', value: '3' },
            { key: 'max_images_evidence', value: '2' }
        ];

        for (const setting of settings) {
            await client.query(`
                INSERT INTO app_settings (setting_key, setting_value) 
                VALUES ($1, $2)
                ON CONFLICT (setting_key) DO NOTHING;
            `, [setting.key, setting.value]);
        }

        await client.query('COMMIT');
        console.log('✅ Migración 092 completada: Límites de imágenes configurados en app_settings.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en la migración 092:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { up };
