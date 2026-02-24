
const { Pool } = require('pg');
require('../config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrationLogic = async (client) => {
    console.log('[MIGRATION] Añadiendo columna blue_cost a la tabla publication_acceptances para donaciones variables...');

    // Añadir blue_cost a publication_acceptances
    // Esto permite registrar cuánto se pagó/donó en cada participación individual
    await client.query(`
        ALTER TABLE publication_acceptances 
        ADD COLUMN IF NOT EXISTS blue_cost NUMERIC(20, 8) DEFAULT NULL
    `);
};

async function runMigration() {
    const client = await pool.connect();
    console.log('🚀 Iniciando migración: 028_add_blue_cost_to_acceptances');

    try {
        await client.query('BEGIN');
        await migrationLogic(client);
        await client.query('COMMIT');
        console.log('🎉 Migración 028 completada con éxito.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante la migración 028:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

module.exports = {
    up: async (client) => {
        await migrationLogic(client);
    },
    down: async (client) => {
        await client.query(`
            ALTER TABLE publication_acceptances 
            DROP COLUMN IF EXISTS blue_cost
        `);
    }
};

if (require.main === module) {
    runMigration();
}
