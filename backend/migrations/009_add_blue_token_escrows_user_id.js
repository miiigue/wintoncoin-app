// Migración 009: Añadir user_id a blue_token_escrows con backfill seguro.
// Ejecutar UNA SOLA VEZ en producción y registrar evidencias.
const { Pool } = require('pg');
require('../config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    const client = await pool.connect();
    console.log('--- Iniciando Migración 009: blue_token_escrows.user_id ---');
    try {
        await client.query('BEGIN');

        await client.query(`
            ALTER TABLE blue_token_escrows
            ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
        `);

        await client.query(`
            UPDATE blue_token_escrows bte
            SET user_id = u.id
            FROM users u
            WHERE bte.username = u.username
              AND (bte.user_id IS NULL OR bte.user_id IS DISTINCT FROM u.id);
        `);

        await client.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='blue_token_escrows'
                      AND column_name='user_id'
                      AND is_nullable='YES'
                ) THEN
                    ALTER TABLE blue_token_escrows ALTER COLUMN user_id SET NOT NULL;
                END IF;
            END $$;
        `);

        await client.query('COMMIT');
        console.log('--- Migración 009 completada con éxito ---');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error durante la migración 009:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
        console.log('🔌 Conexión con la base de datos cerrada.');
    }
}

runMigration();
