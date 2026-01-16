// Migración 011: Eliminar columna username de transactions (post-migración a user_id).
// Ejecutar UNA SOLA VEZ en producción y registrar evidencias.
const { Pool } = require('pg');
require('../config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    const client = await pool.connect();
    console.log('--- Iniciando Migración 011: drop transactions.username ---');
    try {
        await client.query('BEGIN');

        // Solo eliminar si user_id existe y no hay NULLs (seguro y auditable).
        await client.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='transactions' AND column_name='username'
                )
                AND EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='transactions' AND column_name='user_id'
                )
                AND NOT EXISTS (SELECT 1 FROM transactions WHERE user_id IS NULL) THEN
                    ALTER TABLE transactions DROP COLUMN username;
                END IF;
            END $$;
        `);

        await client.query('COMMIT');
        console.log('--- Migración 011 completada con éxito ---');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error durante la migración 011:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
        console.log('🔌 Conexión con la base de datos cerrada.');
    }
}

runMigration();
