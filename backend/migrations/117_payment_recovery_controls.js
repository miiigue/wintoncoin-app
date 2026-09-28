'use strict';
async function up(client) {
 await client.query("ALTER TABLE chain_operations DROP CONSTRAINT IF EXISTS chain_operations_state_check");
 await client.query("ALTER TABLE chain_operations ADD CONSTRAINT chain_operations_state_check CHECK(state IN ('prepared','pending','confirmed','failed','conflict','abandoned'))");
 await client.query(`CREATE TABLE IF NOT EXISTS credit_policy_issues (
  version_id BIGINT NOT NULL REFERENCES credit_policy_versions(id), user_id INTEGER NOT NULL,
  operation_id UUID, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
  retry_requested BOOLEAN NOT NULL DEFAULT FALSE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(version_id,user_id))`);
 await client.query(`CREATE TABLE IF NOT EXISTS marketplace_payment_settlements (
  operation_id UUID PRIMARY KEY REFERENCES chain_operations(id), payment_key TEXT NOT NULL UNIQUE,
  tx_hash TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
 await client.query("CREATE INDEX IF NOT EXISTS marketplace_payment_key ON chain_operations((payload->>'paymentKey')) WHERE kind='marketplace'");
 // Widen legacy history fields so a confirmed micro-payment is not rounded
 // to zero while BLUE/RED retain six decimals in the contracts.
 await client.query('ALTER TABLE IF EXISTS transactions ALTER COLUMN blue_change TYPE NUMERIC(30,6), ALTER COLUMN red_change TYPE NUMERIC(30,6), ALTER COLUMN platform_fee_blue TYPE NUMERIC(30,6)');
 await client.query('ALTER TABLE IF EXISTS platform_commission_log ALTER COLUMN commission_amount_blue TYPE NUMERIC(30,6)');
 await client.query('ALTER TABLE IF EXISTS publication_acceptances ALTER COLUMN blue_cost TYPE NUMERIC(30,6)');
 await client.query('ALTER TABLE IF EXISTS publications ALTER COLUMN blue_cost TYPE NUMERIC(30,6), ALTER COLUMN current_amount TYPE NUMERIC(30,6)');
}
module.exports={up,down:async()=>{throw new Error('Los registros de pagos y firmas no se eliminan automáticamente.');}};
