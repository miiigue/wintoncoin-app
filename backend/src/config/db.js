// Requerir el configurador de entorno dinámico central del proyecto
require('../../config');
const { Pool } = require('pg');

let useSsl = false;
const dbUrl = process.env.DATABASE_URL || '';

// 1. Si NO es producción (entorno local de desarrollo), NUNCA usar SSL.
// 2. Si es una URL interna de Render (.internal), NUNCA usar SSL (viaja por red privada).
// 3. Si es una URL externa pública (producción), FORZAR SSL obligatorio.
if (process.env.NODE_ENV !== 'production') {
    useSsl = false;
} else if (dbUrl.includes('.internal')) {
    useSsl = false;
} else if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
    useSsl = false;
} else {
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
