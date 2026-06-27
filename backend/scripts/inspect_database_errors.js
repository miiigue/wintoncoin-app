const { Pool } = require('pg');
require('../config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function inspect() {
    const client = await pool.connect();
    try {
        console.log('--- INSPECCIONANDO FUNCIONES "record_balance_event" ---');
        const funcRes = await client.query(`
            SELECT 
                p.proname as function_name,
                pg_catalog.pg_get_function_arguments(p.oid) as arguments,
                t.typname as return_type
            FROM pg_catalog.pg_proc p
            LEFT JOIN pg_catalog.pg_type t ON p.prorettype = t.oid
            LEFT JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
            WHERE p.proname = 'record_balance_event'
              AND n.nspname = 'public';
        `);
        console.log(JSON.stringify(funcRes.rows, null, 2));

        console.log('\n--- INSPECCIONANDO COLUMNAS DE "red_token_debts" ---');
        const colRes = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'red_token_debts'
            ORDER BY ordinal_position;
        `);
        console.log(JSON.stringify(colRes.rows, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

inspect();
