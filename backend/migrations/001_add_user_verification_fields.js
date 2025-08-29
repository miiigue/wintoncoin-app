// Migración 001: Añadir campos de verificación de identidad a la tabla de usuarios.
// Este script está diseñado para ser ejecutado UNA SOLA VEZ en la base de datos de producción.
// Su propósito es modificar la tabla 'users' añadiendo nuevas columnas sin eliminar datos existentes.

const { Pool } = require('pg');
require('../config'); // Carga la configuración del entorno (development o production)

// Configuración de la conexión a la base de datos.
// El connectionString es cargado por config.js desde el archivo .env correspondiente.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const migrationQuery = `
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS given_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS family_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS document_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS document_number VARCHAR(50),
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
`;

async function runMigration() {
    const client = await pool.connect();
    console.log('🚀 Iniciando migración: 001_add_user_verification_fields');
    
    try {
        await client.query('BEGIN'); // Iniciar transacción

        console.log('ALTERANDO la tabla "users" para añadir nuevos campos...');
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
