// Migración 003: Añadir el campo booster_blue_balance a la tabla de usuarios.
// Este script está diseñado para ser ejecutado UNA SOLA VEZ.
// Su propósito es corregir un olvido en el desarrollo, añadiendo la columna
// necesaria para que el panel de administración funcione correctamente.

const { Pool } = require('pg');
require('../config'); // Carga la configuración del entorno (development o production)

// Configuración de la conexión a la base de datos.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrationQuery = `
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS booster_blue_balance NUMERIC(18, 4) DEFAULT 0.0000;
`;

async function runMigration() {
    const client = await pool.connect();
    console.log('🚀 Iniciando migración: 003_add_booster_blue_balance');
    
    try {
        await client.query('BEGIN'); // Iniciar transacción

        console.log('ALTERANDO la tabla "users" para añadir la columna "booster_blue_balance"...');
        await client.query(migrationQuery);
        console.log('✅ La tabla "users" ha sido modificada exitosamente.');

        await client.query('COMMIT'); // Confirmar transacción
        
        console.log('🎉 Migración completada con éxito.');

    } catch (error) {
        await client.query('ROLLBACK'); // Revertir en caso de error
        console.error('❌ Error durante la migración. Se han revertido los cambios.');
        console.error(error);
        process.exit(1); // Salir con un código de error
    } finally {
        client.release();
        await pool.end();
        console.log('🔌 Conexión con la base de datos cerrada.');
    }
}

runMigration();
