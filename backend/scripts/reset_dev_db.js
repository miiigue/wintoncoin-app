/**
 * backend/scripts/reset_dev_db.js
 * 
 * PROPÓSITO: Limpiar por completo la base de datos de desarrollo local,
 * recreando el esquema público desde cero. Al iniciar de nuevo el servidor,
 * el Migration Runner (scripts/migrationRunner.js) reconstruirá toda la estructura
 * automáticamente con las 63 migraciones en orden cronológico, garantizando
 * consistencia y eliminando duplicación de código DDL.
 * 
 * CIBERSEGURIDAD:
 * - Zero Hardcoded Secrets: Lee la conexión dinámicamente desde el archivo de entorno.
 * - Candado de Producción: Bloquea la ejecución en ambientes productivos.
 * - Validación de URL: Asegura que la URL apunte a localhost/desarrollo.
 */

const path = require('path');
const env = process.env.NODE_ENV || 'development';
// Buscar el archivo de variables de entorno en la carpeta raíz
const envPath = path.resolve(__dirname, `../../.env.${env}`);
require('dotenv').config({ path: envPath });

const { Pool } = require('pg');

// 1. Candado de seguridad de entorno
if (process.env.NODE_ENV === 'production') {
    console.error('⛔ ERROR DE CIBERSEGURIDAD: Operación cancelada. No se permite reiniciar la base de datos en entornos de producción.');
    process.exit(1);
}

const dbUrl = process.env.DATABASE_URL;

// 2. Validación de destino local
if (!dbUrl || (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1') && !dbUrl.includes('wintoncoin_dev'))) {
    console.error('⛔ CUIDADO CONTRA FUGAS DE DATOS: La URL de conexión no parece apuntar a un servidor local de desarrollo.');
    console.error('Conexión bloqueada para proteger la integridad de bases de datos externas.');
    console.error('URL detectada:', dbUrl ? dbUrl.replace(/:[^:@\s]+@/, ':****@') : 'Ninguna'); // Enmascarar contraseña en logs
    process.exit(1);
}

const pool = new Pool({
    connectionString: dbUrl,
    ssl: false
});

async function resetDevDb() {
    console.log('🔄 [RESET DEV DB] Iniciando limpieza total de la base de datos de desarrollo...');
    let client;
    
    try {
        client = await pool.connect();
        
        // Ejecutar borrado y recreación del esquema público en cascada
        await client.query('DROP SCHEMA public CASCADE;');
        await client.query('CREATE SCHEMA public;');
        await client.query('GRANT ALL ON SCHEMA public TO postgres;');
        await client.query('GRANT ALL ON SCHEMA public TO public;');
        
        console.log('✅ [RESET DEV DB] Base de datos vaciada con éxito (Esquema público recreado).');
        console.log('👉 ACCIÓN CONTABLE REQUERIDA: Reinicia el servidor backend (node server.js). Las migraciones reconstruirán todas las tablas desde cero.');
    } catch (error) {
        console.error('❌ [RESET DEV DB] Error durante la limpieza de la base de datos:', error);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

resetDevDb();
