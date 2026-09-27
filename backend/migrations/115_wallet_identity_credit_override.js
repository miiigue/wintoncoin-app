'use strict';
async function up(client) {
    // Fail rather than silently reassign wallets or discard balances if duplicates exist.
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_web3_wallet_unique_ci
        ON users(LOWER(web3_wallet_address)) WHERE web3_wallet_address IS NOT NULL`);
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS red_credit_limit_override NUMERIC(24,6) CHECK (red_credit_limit_override>=0)');
}
async function down() { throw new Error('La asociación única y las excepciones RED requieren reversión supervisada.'); }
module.exports={up,down};
