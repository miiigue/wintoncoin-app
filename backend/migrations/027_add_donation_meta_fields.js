
const { Pool } = require('pg');
require('../config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrationLogic = async (client) => {
    console.log('[MIGRATION] Añadiendo campos de meta de recaudación a la tabla publications...');

    // Añadir goal_amount y current_amount
    // goal_amount: Meta total a recaudar
    // current_amount: Lo recaudado hasta el momento
    await client.query(`
        ALTER TABLE publications 
        ADD COLUMN IF NOT EXISTS goal_amount NUMERIC(20, 8) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS current_amount NUMERIC(20, 8) DEFAULT 0
    `);
};

async function runMigration() {
    const client = await pool.connect();
    console.log('🚀 Iniciando migración: 027_add_donation_meta_fields');

    try {
        await client.query('BEGIN');
        await migrationLogic(client);
        await client.query('COMMIT');
        console.log('🎉 Migración 027 completada con éxito.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante la migración 027:', error);
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
            ALTER TABLE publications 
            DROP COLUMN IF EXISTS goal_amount,
            DROP COLUMN IF EXISTS current_amount
        `);
    }
};

if (require.main === module) {
    runMigration();
}
