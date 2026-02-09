// Migración 019: Crear tabla para suscripciones push
const { Pool } = require('pg');
require('../config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrationQuery = `
    CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        keys_p256dh TEXT NOT NULL,
        keys_auth TEXT NOT NULL,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON push_subscriptions(user_id);
`;

async function runMigration() {
    const client = await pool.connect();
    console.log('🚀 Iniciando migración: 019_create_push_subscriptions_table');

    try {
        await client.query('BEGIN');
        await client.query(migrationQuery);
        await client.query('COMMIT');
        console.log('🎉 Migración completada con éxito.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante la migración:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
