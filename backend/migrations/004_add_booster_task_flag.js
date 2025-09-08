// Migración 004: Añadir el campo is_booster_task a la tabla de publications.
// Este script es crucial para que el sistema de recompensas de impulsor funcione.
// Añade una bandera booleana para identificar qué tareas deben otorgar IOU.

const { Pool } = require('pg');
require('../config'); // Carga la configuración del entorno (development o production)

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrationQuery = `
    ALTER TABLE publications
    ADD COLUMN IF NOT EXISTS is_booster_task BOOLEAN DEFAULT FALSE;
`;

async function runMigration() {
    const client = await pool.connect();
    console.log('🚀 Iniciando migración: 004_add_booster_task_flag');
    
    try {
        await client.query('BEGIN');

        console.log('ALTERANDO la tabla "publications" para añadir la columna "is_booster_task"...');
        await client.query(migrationQuery);
        console.log('✅ La tabla "publications" ha sido modificada exitosamente.');

        await client.query('COMMIT');
        
        console.log('🎉 Migración completada con éxito.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante la migración. Se han revertido los cambios.');
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
        console.log('🔌 Conexión con la base de datos cerrada.');
    }
}

runMigration();
