'use strict';
// Separate from V5 tables: the old stream remains available for audit.
exports.up = async client => {
  await client.query(`CREATE TABLE IF NOT EXISTS web3_exchange_v6_sync (
    chain_id bigint NOT NULL, router_address text NOT NULL, start_block bigint NOT NULL,
    stream_fingerprint text NOT NULL, cursor_block bigint NOT NULL, cursor_hash text, status text NOT NULL DEFAULT 'syncing',
    updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(chain_id,router_address));
    CREATE TABLE IF NOT EXISTS web3_exchange_v6_events (
    chain_id bigint NOT NULL, router_address text NOT NULL, block_number bigint NOT NULL,
    block_hash text NOT NULL, transaction_hash text NOT NULL, log_index integer NOT NULL,
    emitter text NOT NULL, stream text NOT NULL, event_name text NOT NULL, arguments jsonb NOT NULL,
    PRIMARY KEY(chain_id,router_address,block_hash,transaction_hash,log_index));
    CREATE TABLE IF NOT EXISTS web3_exchange_v6_orders (
    chain_id bigint NOT NULL, router_address text NOT NULL, order_id numeric(20,0) NOT NULL,
    data jsonb NOT NULL, block_number bigint NOT NULL, block_hash text NOT NULL,
    PRIMARY KEY(chain_id,router_address,order_id));
    CREATE TABLE IF NOT EXISTS web3_exchange_v6_refunds (
    chain_id bigint NOT NULL, router_address text NOT NULL, user_address text NOT NULL,
    blue numeric(39,0) NOT NULL, usdt numeric(39,0) NOT NULL, block_number bigint NOT NULL, block_hash text NOT NULL,
    PRIMARY KEY(chain_id,router_address,user_address));`);
};

