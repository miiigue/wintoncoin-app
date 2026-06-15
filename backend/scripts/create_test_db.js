/**
 * backend/scripts/create_test_db.js
 * 
 * PROPÓSITO: Crear de forma automatizada la base de datos PostgreSQL 'wintoncoin_test'
 * si es que aún no existe, conectándose a la base de datos del sistema 'postgres'.
 * 
 * ESTÁNDAR DE INGENIERÍA: Automatización de Onboarding de Pruebas.
 */

const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://postgres:Miiiguebotbinance@localhost:5432/postgres',
    ssl: false
});

async function main() {
    try {
        await client.connect();
        
        // Verificar si la base de datos ya existe
        const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'wintoncoin_test'");
        
        if (res.rowCount === 0) {
            console.log("🔧 [TEST DB SETUP] Creando la base de datos 'wintoncoin_test'...");
            await client.query("CREATE DATABASE wintoncoin_test");
            console.log("✅ [TEST DB SETUP] Base de datos 'wintoncoin_test' creada exitosamente.");
        } else {
            console.log("ℹ️ [TEST DB SETUP] La base de datos 'wintoncoin_test' ya existe.");
        }
    } catch (err) {
        console.error("❌ [TEST DB SETUP] Error al crear la base de datos de pruebas:", err);
    } finally {
        await client.end();
    }
}

main();
