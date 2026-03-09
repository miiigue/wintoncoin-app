require('dotenv').config();
const { Pool } = require('pg');

let useSsl = false;

if (process.env.RENDER) {
    // Estamos ejecutándonos DENTRO de Render (la nube).
    // Render intercepta incluso la URL externa y la envía por su red privada interna.
    // En su red privada NO soportan SSL, por lo que PostgreSQL rechaza la conexión si lo usamos.
    useSsl = false;
} else if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')) {
    // Estamos ejecutándonos FUERA de Render (ej. tu localhost conectándose a la nube de Render).
    // Para admitinos desde afuera, Render EXIGE estrictamente estar blindados con SSL.
    useSsl = { rejectUnauthorized: false };
} else if (process.env.NODE_ENV === 'production') {
    // Entorno de producción en otro proveedor que no sea Render
    useSsl = { rejectUnauthorized: false };
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl
});

// Event listener para errores del pool inesperados (evita que la app crashee)
pool.on('error', (err, client) => {
    console.error('Error inesperado en el cliente de PostgreSQL:', err);
    process.exit(-1);
});

module.exports = pool;
