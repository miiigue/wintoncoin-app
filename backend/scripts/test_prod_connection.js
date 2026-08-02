require('../config');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function test() {
    console.log('--- TEST DE CONEXIÓN A PRODUCCIÓN ---');
    console.log('Intentando conectar con wintoncoin_user...');
    try {
        const res = await pool.query('SELECT current_user, now()');
        console.log('✅ CONEXIÓN EXITOSA');
        console.log('Usuario actual:', res.rows[0].current_user);
        console.log('Hora del servidor:', res.rows[0].now);
    } catch (err) {
        console.error('❌ ERROR DE CONEXIÓN:', err.message);
        if (err.message.includes('not permitted to log in')) {
            console.error('DIAGNÓSTICO: El rol wintoncoin_user tiene el atributo NOLOGIN activado.');
        }
    } finally {
        await pool.end();
    }
}

test();
