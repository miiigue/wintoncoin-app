require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Event listener para errores del pool inesperados (evita que la app crashee)
pool.on('error', (err, client) => {
    console.error('Error inesperado en el cliente de PostgreSQL:', err);
    process.exit(-1);
});

module.exports = pool;
