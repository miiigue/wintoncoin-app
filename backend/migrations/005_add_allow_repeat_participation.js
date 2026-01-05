// backend/migrations/005_add_allow_repeat_participation.js
const { Pool } = require('pg');
require('../config'); // Cargar configuración de entorno correctamente (igual que server.js)

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('--- Iniciando Migración 005: Permitir Participación Recurrente ---');
        await client.query('BEGIN');

        // 1. Añadir la columna allow_repeat_participation a la tabla publications
        console.log('1. Añadiendo columna allow_repeat_participation...');
        await client.query(`
            ALTER TABLE publications 
            ADD COLUMN IF NOT EXISTS allow_repeat_participation BOOLEAN DEFAULT FALSE;
        `);

        // 2. Modificar la restricción UNIQUE en publication_acceptances
        // Necesitamos permitir múltiples filas para el mismo par (publication_id, acceptor_username),
        // pero SOLO si tienen estados diferentes a 'open' o 'in_progress' simultáneamente.
        // Como postgres no permite índices condicionales complejos fácilmente para "una fila activa",
        // confiaremos en la validación lógica del servidor (server.js) para la unicidad de tareas activas.
        // Lo que debemos hacer es ELIMINAR la restricción unique estricta actual.
        
        console.log('2. Eliminando restricción UNIQUE estricta en publication_acceptances...');
        
        // Primero, intentamos averiguar el nombre de la restricción si no lo sabemos
        // Generalmente es publication_acceptances_publication_id_acceptor_username_key
        // Pero usaremos un bloque DO para hacerlo seguro.
        await client.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'publication_acceptances_publication_id_acceptor_username_key'
                ) THEN
                    ALTER TABLE publication_acceptances DROP CONSTRAINT publication_acceptances_publication_id_acceptor_username_key;
                END IF;
            END $$;
        `);

        // Alternativamente, si fue creada como UNIQUE INDEX y no CONSTRAINT:
        await client.query(`DROP INDEX IF EXISTS publication_acceptances_publication_id_acceptor_username_idx;`); // Nombre común si fuera índice manual

        console.log('--- Migración 005 Completada con Éxito ---');
        await client.query('COMMIT');
    } catch (error) {
        console.error('Error durante la migración:', error);
        await client.query('ROLLBACK');
    } finally {
        client.release();
        pool.end();
    }
}

runMigration();

