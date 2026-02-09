// Migración 020: Agregar preferencias de notificaciones a usuarios
const { Pool } = require('pg');
require('../config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrationQuery = `
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"security": true, "social": true, "marketing": true}';
`;

async function runMigration() {
    const client = await pool.connect();
    console.log('🚀 Iniciando migración: 020_add_notification_preferences');

    try {
        await client.query('BEGIN');
        await client.query(migrationQuery);
        await client.query('COMMIT');
        console.log('🎉 Migración 020 completada con éxito.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante la migración 020:', error);
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
    }
};

// Auto-ejecución si se llama directamente
if (require.main === module) {
    runMigration();
}
