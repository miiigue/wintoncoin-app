/**
 * backend/scripts/reset_remote_demo_db.js
 * 
 * PROPÓSITO: Realizar una purga radical y completa del esquema público de la
 * base de datos de Demo en Render.com (Clean Slate Go-Live Protocol).
 * 
 * MECANISMO:
 * Ejecuta DROP SCHEMA public CASCADE; y CREATE SCHEMA public;
 * Esto borra instantáneamente los 578 tokens virtuales fantasma y todas las tablas viejas.
 * El Migration Runner (scripts/migrationRunner.js) reconstruirá la estructura
 * DDL limpia y perfecta la próxima vez que se inicie el servidor.
 * 
 * CIBERSEGURIDAD & COMPLIANCE:
 * - Requiere confirmación de variable IS_DEMO_ENV=true para evitar purgas accidentales.
 * - Conexión SSL encriptada hacia Render.com.
 * - Zero Hardcoded Secrets (Lee de .env.demo.local).
 */

const path = require('path');
const { Pool } = require('pg');

// Cargar variables de entorno de Demo
require('dotenv').config({ path: path.join(__dirname, '../.env.demo.local') });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl || process.env.IS_DEMO_ENV !== 'true') {
    console.error('⛔ ERROR DE CIBERSEGURIDAD: Operación cancelada. No se detectó IS_DEMO_ENV=true o DATABASE_URL en .env.demo.local.');
    console.error('Esta compuerta de seguridad impide ejecutar borrados en entornos no autorizados.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function resetRemoteDemoDb() {
    console.log('=' .repeat(70));
    console.log(' ⚠️  [WEB2 CLEAN SLATE] Iniciando Purga Radical en Base de Datos Demo');
    console.log('=' .repeat(70));
    
    let client;
    try {
        client = await pool.connect();
        console.log('🔌 Conectado exitosamente a la Base de Datos Demo en Render...');
        console.log('🚀 Ejecutando DROP SCHEMA public CASCADE...');
        
        // Ejecutar borrado y recreación del esquema público en cascada
        await client.query('DROP SCHEMA public CASCADE;');
        await client.query('CREATE SCHEMA public;');
        await client.query('GRANT ALL ON SCHEMA public TO postgres;');
        await client.query('GRANT ALL ON SCHEMA public TO public;');
        
        console.log('=' .repeat(70));
        console.log(' ✅ [RESET REMOTE DEMO DB] Base de datos vaciada con éxito (Esquema público recreado).');
        console.log(' 👉 ACCIÓN CONTABLE LOGRADA: Los 578 tokens virtuales fantasma han sido eliminados.');
        console.log(' 📦 Las 68+ migraciones reconstruirán el DDL limpio en el próximo reinicio.');
        console.log('=' .repeat(70));
    } catch (error) {
        console.error('❌ ERROR CRÍTICO durante la limpieza de la base de datos Demo:', error);
        process.exitCode = 1;
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

resetRemoteDemoDb();
