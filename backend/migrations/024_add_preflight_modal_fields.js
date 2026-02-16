
const { Pool } = require('pg');
require('../config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrationQuery = `
    DO $$
    BEGIN
        -- 1. Add column to publications table
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'publications' AND column_name = 'show_preflight_modal'
        ) THEN
            ALTER TABLE publications ADD COLUMN show_preflight_modal BOOLEAN DEFAULT FALSE;
        END IF;
    END $$;
`;

const settingsSeeding = async (client) => {
    const defaultSettings = [
        ['daily_modal_title', 'Aviso Importante'],
        ['daily_modal_mon', '¡Feliz Lunes! Recuerda completar tus tareas con precisión.'],
        ['daily_modal_tue', '¡Buen Martes! Asegúrate de seguir todas las instrucciones.'],
        ['daily_modal_wed', '¡Mitad de semana! Revisa bien los requisitos antes de empezar.'],
        ['daily_modal_thu', '¡Casi viernes! Tu consistencia es clave para mejores ganancias.'],
        ['daily_modal_fri', '¡Buen Viernes! No olvides reportar cualquier anomalía.'],
        ['daily_modal_sat', '¡Sábado de progreso! Disfruta tu fin de semana de micro-tareas.'],
        ['daily_modal_sun', '¡Domingo de descanso! Prepárate para una nueva semana exitosa.']
    ];

    for (const [key, value] of defaultSettings) {
        await client.query(`
            INSERT INTO app_settings (setting_key, setting_value)
            VALUES ($1, $2)
            ON CONFLICT (setting_key) DO NOTHING;
        `, [key, value]);
    }
};

async function runMigration() {
    const client = await pool.connect();
    console.log('🚀 Iniciando migración: 024_add_preflight_modal_fields');

    try {
        await client.query('BEGIN');
        await client.query(migrationQuery);
        await settingsSeeding(client);
        await client.query('COMMIT');
        console.log('🎉 Migración 024 completada con éxito.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante la migración 024:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Exportar para el runner
module.exports = {
    up: async (client) => {
        await client.query(migrationQuery);
        await settingsSeeding(client);
    },
    down: async (client) => {
        const keys = [
            'daily_modal_title', 'daily_modal_mon', 'daily_modal_tue',
            'daily_modal_wed', 'daily_modal_thu', 'daily_modal_fri',
            'daily_modal_sat', 'daily_modal_sun'
        ];
        await client.query(`DELETE FROM app_settings WHERE setting_key = ANY($1::text[])`, [keys]);
        await client.query(`ALTER TABLE publications DROP COLUMN IF EXISTS show_preflight_modal;`);
    }
};

// Auto-ejecución si se llama directamente
if (require.main === module) {
    runMigration();
}
