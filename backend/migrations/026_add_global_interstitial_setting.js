// Migración 026: Añadir configuración para el Modal Intersticial Global.
// Sigue el patrón estándar del proyecto (ver 024 como referencia).
// Añade la clave 'global_app_interstitial_enabled' a app_settings.

const { Pool } = require('pg');
require('../config'); // Carga la configuración del entorno (development o production)

// Conexión propia de la migración (aislada del servidor)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// SQL de la migración
const settingsSeeding = async (client) => {
    const defaultSettings = [
        [
            'global_app_interstitial_enabled',
            'false',
            'Determina si se muestra el modal informativo diario al abrir el Dashboard de la aplicación.'
        ]
    ];

    for (const [key, value, description] of defaultSettings) {
        await client.query(`
            INSERT INTO app_settings (setting_key, setting_value, description)
            VALUES ($1, $2, $3)
            ON CONFLICT (setting_key) DO NOTHING;
        `, [key, value, description]);
    }
};

// Función principal de ejecución directa
async function runMigration() {
    const client = await pool.connect();
    console.log('🚀 Iniciando migración: 026_add_global_interstitial_setting');

    try {
        await client.query('BEGIN');
        await settingsSeeding(client);
        await client.query('COMMIT');
        console.log('🎉 Migración 026 completada con éxito.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante la migración 026:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Exportar para runners (up/down estándar)
module.exports = {
    up: async (client) => {
        await settingsSeeding(client);
    },
    down: async (client) => {
        await client.query(
            `DELETE FROM app_settings WHERE setting_key = 'global_app_interstitial_enabled'`
        );
    }
};

// Auto-ejecución si se llama directamente (node migrations/026_...)
if (require.main === module) {
    runMigration();
}
