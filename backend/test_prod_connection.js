const { Pool } = require('pg');
const connectionString = 'postgresql://wintoncoin_7osz_user:xJ5VTRBcJB2CATETmchGhRa57EzmlY44@dpg-d206cfndiees73952i50-a.ohio-postgres.render.com/wintoncoin_prod';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
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
