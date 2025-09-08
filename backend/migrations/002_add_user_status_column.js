// Migración 002: Añadir campo de estado para la moderación de usuarios.
// Este script está diseñado para ser ejecutado UNA SOLA VEZ.
// Su propósito es modificar la tabla 'users' para añadir la columna 'status',
// que permitirá suspender o banear usuarios.

const { Pool } = require('pg');
require('../config'); // Carga la configuración del entorno (development o production)

// Configuración de la conexión a la base de datos.
// El connectionString es cargado por config.js desde el archivo .env correspondiente.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrationQuery = `
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
`;

async function runMigration() {
    const client = await pool.connect();
    console.log('🚀 Iniciando migración: 002_add_user_status_column');
    
    try {
        await client.query('BEGIN'); // Iniciar transacción

        console.log('ALTERANDO la tabla "users" para añadir la columna "status"...');
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
