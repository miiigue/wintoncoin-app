// Migración 010: Añadir user_id a transactions con backfill seguro e índice.
// Ejecutar UNA SOLA VEZ en producción y registrar evidencias.
const { Pool } = require('pg');
require('../config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    const client = await pool.connect();
    console.log('--- Iniciando Migración 010: transactions.user_id ---');
    try {
        await client.query('BEGIN');

        await client.query(`
            ALTER TABLE transactions
            ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
        `);

        await client.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='transactions'
                      AND column_name='username'
                ) THEN
                    UPDATE transactions t
                    SET user_id = u.id
                    FROM users u
                    WHERE t.username = u.username
                      AND (t.user_id IS NULL OR t.user_id IS DISTINCT FROM u.id);
                END IF;
            END $$;
        `);

        await client.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='transactions'
                      AND column_name='user_id'
                      AND is_nullable='YES'
                ) THEN
                    IF NOT EXISTS (SELECT 1 FROM transactions WHERE user_id IS NULL) THEN
                        ALTER TABLE transactions ALTER COLUMN user_id SET NOT NULL;
                    END IF;
                END IF;
            END $$;
        `);

        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_transactions_user_id'
                ) THEN
                    CREATE INDEX idx_transactions_user_id ON transactions(user_id);
                END IF;
            END $$;
        `);

        await client.query('COMMIT');
        console.log('--- Migración 010 completada con éxito ---');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error durante la migración 010:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
        console.log('🔌 Conexión con la base de datos cerrada.');
    }
}

runMigration();
