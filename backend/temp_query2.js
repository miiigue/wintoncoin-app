require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
pool.query(`
    SELECT pa.id, pa.status, p.title, p.blue_cost 
    FROM publication_acceptances pa 
    JOIN publications p ON pa.publication_id = p.id 
    JOIN users u ON p.author_id = u.id 
    WHERE u.username = 'Plataforma WintonCoin' 
      AND pa.status NOT IN ('confirmed_paid', 'rejected', 'cancelled', 'abandoned')
`).then(res => {
    console.table(res.rows);
    pool.end();
}).catch(console.error);
