'use strict';

const { parseUnits } = require('ethers');
const { fail } = require('./exchangeChainReader');

// Independent contract counters detect incomplete event pages before the cursor
// is committed. Never repair a mismatch by inventing events or zero balances.
async function reconcileExchange(client, chain, key, hash) {
    const actual = await chain.accounting(hash);
    const orders = (await client.query(`SELECT COUNT(*) AS count,
        COALESCE(MAX(order_id),0) AS last,
        COALESCE(SUM(remaining_amount) FILTER (WHERE side='SELL_BLUE' AND status IN ('OPEN','PARTIALLY_FILLED','SUSPENDED')),0) AS blue,
        COALESCE(SUM(remaining_amount) FILTER (WHERE side='BUY_BLUE' AND status IN ('OPEN','PARTIALLY_FILLED','SUSPENDED')),0) AS usdt
        FROM web3_exchange_order_snapshots WHERE chain_id=$1 AND exchange_address=$2`, key)).rows[0];
    const refunds = (await client.query(`SELECT
        COALESCE(SUM(amount) FILTER (WHERE token_type='BLUE'),0) AS blue,
        COALESCE(SUM(amount) FILTER (WHERE token_type='USDT'),0) AS usdt
        FROM web3_pending_refunds WHERE chain_id=$1 AND exchange_address=$2`, key)).rows[0];
    const matches = (await client.query(`SELECT COUNT(*) AS count FROM web3_exchange_logs
        WHERE chain_id=$1 AND exchange_address=$2 AND NOT is_removed AND event_name='OrderMatched'`, key)).rows[0];
    if (BigInt(orders.count) !== actual.nextOrderId - 1n || BigInt(orders.last) !== actual.nextOrderId - 1n ||
        BigInt(matches.count) !== actual.matchId - 1n ||
        parseUnits(orders.blue, 6) !== actual.totalReservedBlue || parseUnits(orders.usdt, 6) !== actual.totalReservedUsdt ||
        parseUnits(refunds.blue, 6) !== actual.totalPendingRefundBlue || parseUnits(refunds.usdt, 6) !== actual.totalPendingRefundUsdt) {
        fail('ACCOUNTING_MISMATCH');
    }
}

module.exports = { reconcileExchange };
