// Requerir el configurador de entorno dinámico central del proyecto
require('../../config');
const { Pool } = require('pg');

let useSsl = false;
const dbUrl = process.env.DATABASE_URL || '';

// 1. Si es una URL interna de Render (.internal), NUNCA usar SSL (viaja por red privada).
// 2. Si es una URL local (localhost/127.0.0.1), NUNCA usar SSL.
// 3. Si es una URL externa de Render (render.com), o entorno de Producción/Demo, FORZAR SSL obligatorio.
if (dbUrl.includes('.internal')) {
    useSsl = false;
} else if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
    useSsl = false;
} else if (dbUrl.includes('render.com') || process.env.NODE_ENV === 'production' || process.env.IS_DEMO_ENV === 'true') {
    useSsl = { rejectUnauthorized: false };
} else {
    useSsl = false;
}

const pool = new Pool({
    connectionString: dbUrl,
    ssl: useSsl
});

// Event listener para errores del pool inesperados (evita que la app crashee)
pool.on('error', (err, client) => {
    console.error('[DATABASE POOL ERROR] Conexión inactiva cerrada por el servidor remoto:', err.message);
    // El process.exit(-1) ha sido eliminado intencionalmente. 
    // PostgreSQL Pool se auto-recuperará creando una nueva conexión cuando sea necesario (Self-Healing).
});

module.exports = pool;
