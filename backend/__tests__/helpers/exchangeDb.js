'use strict';
const { Client, Pool } = require('pg');
const { randomBytes } = require('crypto');
async function isolatedDb(port) {
    const connection = { host: '127.0.0.1', port: Number(port), user: 'review070', database: 'postgres' };
    const admin = new Client(connection);
    await admin.connect();
    const directory = (await admin.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\', '/');
    if (!directory.endsWith('/pg-review-070')) { await admin.end(); throw new Error('Only isolated pg-review-070 is permitted'); }
    const schema = `idx_${randomBytes(8).toString('hex')}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const pool = new Pool({ ...connection, options: `-c search_path=${schema},public`, max: 5 });
    const client = await pool.connect();
    let setupError;
    try {
        await client.query('BEGIN');
        await client.query('CREATE TABLE users(id SERIAL PRIMARY KEY); CREATE TABLE web3_wallets_sync(onchain_blue_balance NUMERIC,onchain_red_debt NUMERIC)');
        await require('../../migrations/109_web3_suite_v4_contracts_and_governance').up(client);
        await require('../../migrations/111_repair_web3_refund_provenance').up(client);
        await require('../../migrations/112_exchange_indexer').up(client);
        await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); setupError = error; }
    finally { client.release(); }
    if (setupError) { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); throw setupError; }
    return { pool, async close() { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); } };
}
module.exports = { isolatedDb };
