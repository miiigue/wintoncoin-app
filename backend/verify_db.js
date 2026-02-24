const { Pool } = require('pg');
const connectionString = 'postgresql://wintoncoin_demo_user:rAVHJfdN8O2bTlrXQO2FoszVHEOHhjbP@dpg-d5vor7npm1nc73cpmge0-a.ohio-postgres.render.com/wintoncoin_demo?ssl=true';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        console.log('--- CONECTANDO A RENDER ---');
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'momentum_campaigns'");
        console.log('--- COLUMNAS ENCONTRADAS ---');
        console.log(JSON.stringify(res.rows.map(r => r.column_name), null, 2));
        console.log('---------------------------');

        // Si no existe, intentar crearla aquí mismo para solucionar el problema del usuario de una vez
        if (!res.rows.find(r => r.column_name === 'allow_multiple')) {
            console.log('⚠️ LA COLUMNA NO EXISTE. Intentando crearla...');
            await pool.query("ALTER TABLE momentum_campaigns ADD COLUMN IF NOT EXISTS allow_multiple BOOLEAN NOT NULL DEFAULT FALSE");
            console.log('✅ COLUMNA CREADA EXITOSAMENTE.');
        } else {
            console.log('ℹ️ La columna YA EXISTE en la base de datos.');
        }

    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

check();
