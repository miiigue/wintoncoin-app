// Migración 008: Añadir user_id a red_token_debts con backfill seguro.
// Ejecutar UNA SOLA VEZ en producción y registrar evidencias.
const { Pool } = require('pg');
require('../config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    const client = await pool.connect();
    console.log('--- Iniciando Migración 008: red_token_debts.user_id ---');
    try {
        await client.query('BEGIN');

        await client.query(`
            ALTER TABLE red_token_debts
            ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
        `);

        await client.query(`
            UPDATE red_token_debts rtd
            SET user_id = u.id
            FROM users u
            WHERE rtd.username = u.username
              AND (rtd.user_id IS NULL OR rtd.user_id IS DISTINCT FROM u.id);
        `);

        await client.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='red_token_debts'
                      AND column_name='user_id'
                      AND is_nullable='YES'
                ) THEN
                    ALTER TABLE red_token_debts ALTER COLUMN user_id SET NOT NULL;
                END IF;
            END $$;
        `);

        await client.query('COMMIT');
        console.log('--- Migración 008 completada con éxito ---');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error durante la migración 008:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
        console.log('🔌 Conexión con la base de datos cerrada.');
    }
}

runMigration();
