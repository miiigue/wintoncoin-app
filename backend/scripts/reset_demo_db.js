require('dotenv').config({ path: '../.env.demo.local' });
const { Pool } = require('pg');

// Verificación de seguridad
if (!process.env.DATABASE_URL.includes('wintoncoin_demo')) {
    console.error('⛔ PELIGRO: La URL de la base de datos no parece ser la de DEMO.');
    console.error('URL detectada:', process.env.DATABASE_URL);
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function resetDemoDb() {
    console.log('🗑️  INICIANDO LIMPIEZA TOTAL DE BASE DE DATOS DEMO...');
    const client = await pool.connect();

    try {
        await client.query('DROP SCHEMA public CASCADE;');
        await client.query('CREATE SCHEMA public;');
        await client.query('GRANT ALL ON SCHEMA public TO postgres;');
        await client.query('GRANT ALL ON SCHEMA public TO public;');
        console.log('✅ Base de datos totalmente vacía (Schema public recreado).');
        console.log('👉 AHORA: Reinicia el servicio en Render para que el backend recree las tablas automáticamente.');
    } catch (error) {
        console.error('❌ Error limpiando DB:', error);
    } finally {
        client.release();
        pool.end();
    }
}

resetDemoDb();
