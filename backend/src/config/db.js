require('dotenv').config();
const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
const isRenderExternal = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com');
const forceSsl = isProduction || isRenderExternal;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: forceSsl ? { rejectUnauthorized: false } : false
});

// Event listener para errores del pool inesperados (evita que la app crashee)
pool.on('error', (err, client) => {
    console.error('Error inesperado en el cliente de PostgreSQL:', err);
    process.exit(-1);
});

module.exports = pool;
