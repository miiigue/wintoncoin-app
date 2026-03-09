require('dotenv').config();
const { Pool } = require('pg');

let useSsl = false;
const dbUrl = process.env.DATABASE_URL || '';

// Detectar si la conexión es a una base de datos local
const isLocalUrl = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

// Estándar de la industria (Zero Trust):
// Si la base de datos no está en la máquina local del desarrollador,
// SIEMPRE forzar túnel SSL encriptado. Heroku, AWS y Render lo exigen.
if (!isLocalUrl) {
    useSsl = { rejectUnauthorized: false };
}

const pool = new Pool({
    connectionString: dbUrl,
    ssl: useSsl
});

// Event listener para errores del pool inesperados (evita que la app crashee)
pool.on('error', (err, client) => {
    console.error('Error inesperado en el cliente de PostgreSQL:', err);
    process.exit(-1);
});

module.exports = pool;
