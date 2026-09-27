'use strict';
async function up(client) {
    await client.query(`CREATE TABLE IF NOT EXISTS wallet_pin_attempts (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts>=0), locked_until TIMESTAMPTZ
    )`);
    await client.query(`INSERT INTO wallet_pin_attempts(user_id,failed_attempts,locked_until)
        SELECT id,COALESCE(transaction_pin_failed_attempts,0),transaction_pin_locked_until FROM users
        WHERE has_transaction_pin=TRUE ON CONFLICT DO NOTHING`);
}
async function down() { throw new Error('No se elimina el historial de protección PIN mediante rollback automático.'); }
module.exports={up,down};
