'use strict';

const { Interface, JsonRpcProvider, FetchRequest, getAddress, keccak256, toQuantity } = require('ethers');
const ABI = [
    'event OrderCreated(uint64 indexed orderId,address indexed user,uint8 indexed side,uint128 originalAmount,uint64 sequenceId,uint48 createdAt,uint256 createdBlock)',
    'event OrderMatched(uint64 indexed matchId,uint64 indexed blueOrderId,uint64 indexed usdtOrderId,uint128 grossAmount,uint128 feeBlue,uint128 feeUsdt,uint128 netBlueTransferredByExchange,uint128 netUsdtTransferredByExchange)',
    'event OrderCancelled(uint64 indexed orderId,address indexed user,uint128 refundedAmount)',
    'event OrderReduced(uint64 indexed orderId,uint128 refunded,uint128 remaining)',
    'event OrderSuspended(uint64 indexed orderId,uint8 reason)',
    'event OrderResumed(uint64 indexed orderId,uint64 oldSequence,uint64 newSequence)',
    'event RefundHeld(address indexed user,uint128 blue,uint128 usdt)',
    'event PendingRefundClaimed(address indexed user,uint128 blue,uint128 usdt)',
    'function orders(uint64) view returns(uint64 id,uint64 sequenceId,uint128 remainingAmount,address user,uint8 status,uint8 side,uint48 createdAt,uint128 originalAmount,uint128 refundedAmount)',
    'function pendingRefundBlue(address) view returns(uint128)',
    'function pendingRefundUsdt(address) view returns(uint128)',
    'function isAmortizationOrder(uint64) view returns(bool)'
];
const iface = new Interface(ABI);
const topics = iface.fragments.filter(f => f.type === 'event').map(f => f.topicHash);
const address = value => getAddress(value).toLowerCase();
function fail(code) { const e = new Error(code); e.indexerCode = code; throw e; }
function uint(value, max = BigInt(Number.MAX_SAFE_INTEGER)) {
    if (!/^\d+$/.test(String(value)) || BigInt(value) > max) fail('INVALID_CONFIG');
    return BigInt(value);
}
function identityFromEnv(env = process.env) {
    const chainId = uint(env.EXCHANGE_INDEXER_CHAIN_ID, (1n << 256n) - 1n).toString();
    if (chainId === '0') fail('INVALID_CONFIG');
    const exchange = address(env.EXCHANGE_INDEXER_ADDRESS);
    if (/^0x0{40}$/.test(exchange)) fail('INVALID_CONFIG');
    return { chainId, exchange };
}
function configFromEnv(env = process.env) {
    const identity = identityFromEnv(env);
    const startBlock = Number(uint(env.EXCHANGE_INDEXER_START_BLOCK));
    const finality = env.EXCHANGE_INDEXER_FINALITY || 'finalized';
    if (startBlock < 1 || !/^(finalized|confirmations:[1-9][0-9]{0,5})$/.test(finality)) fail('INVALID_CONFIG');
    const readInt = (key, fallback, min, max) => {
        const n = Number(uint(env[key] ?? fallback));
        if (n < min || n > max) fail('INVALID_CONFIG');
        return n;
    };
    return { ...identity, startBlock, finality,
        batchBlocks: readInt('EXCHANGE_INDEXER_BATCH_BLOCKS', 100, 1, 2000),
        maxLogs: readInt('EXCHANGE_INDEXER_MAX_LOGS', 2000, 1, 10000),
        pollMs: readInt('EXCHANGE_INDEXER_POLL_MS', 5000, 1000, 60000) };
}

// No signer, wallet, private key, or write RPC method exists in this adapter.
// EIP-1898 pins every eth_call to a hash, including when a reorg occurs mid-read.
class ExchangeChainReader {
    constructor(provider, exchange) { this.provider = provider; this.exchange = address(exchange); }
    async chainId() { return BigInt(await this.provider.send('eth_chainId', [])).toString(); }
    async block(tag) {
        const block = await this.provider.send('eth_getBlockByNumber', [typeof tag === 'number' ? toQuantity(tag) : tag, false]);
        if (!block) fail('BLOCK_UNAVAILABLE');
        const number = Number(BigInt(block.number));
        if (!Number.isSafeInteger(number) || !/^0x[0-9a-f]{64}$/.test(block.hash)) fail('INVALID_BLOCK');
        return { number, hash: block.hash };
    }
    async code(block) {
        return this.provider.send('eth_getCode', [this.exchange, toQuantity(block)]);
    }
    async logs(from, to) {
        try {
            const logs = await this.provider.send('eth_getLogs', [{ address: this.exchange, fromBlock: toQuantity(from), toBlock: toQuantity(to), topics: [topics] }]);
            return logs.map(l => ({ ...l, blockNumber: Number(BigInt(l.blockNumber)), index: Number(BigInt(l.logIndex)) }));
        } catch (error) {
            const body = typeof error?.info?.responseBody === 'string' ? error.info.responseBody : '';
            const msg = (body + ' ' + (error?.message || '')).toLowerCase();
            if (msg.includes('block range') || msg.includes('limit') || msg.includes('too large') || msg.includes('query returned more than')) {
                fail('PAGE_TOO_LARGE');
            }
            throw error;
        }
    }
    async call(name, args, hash) {
        const value = await this.provider.send('eth_call', [
            { to: this.exchange, data: iface.encodeFunctionData(name, args) },
            { blockHash: hash, requireCanonical: true }
        ]);
        return iface.decodeFunctionResult(name, value);
    }
    async order(id, hash) { return this.call('orders', [id], hash); }
    async isAmortization(id, hash) { return (await this.call('isAmortizationOrder', [id], hash))[0]; }
    async refunds(wallet, hash) {
        const blue = (await this.call('pendingRefundBlue', [wallet], hash))[0];
        const usdt = (await this.call('pendingRefundUsdt', [wallet], hash))[0];
        return { blue, usdt };
    }
}
function createReader(url, exchange) {
    if (!url || !/^https?:\/\//i.test(url)) fail('INVALID_RPC_CONFIG');
    const request = new FetchRequest(url);
    request.timeout = 20000;
    const provider = new JsonRpcProvider(request, undefined, { cacheTimeout: -1, batchMaxCount: 1 });
    return new ExchangeChainReader(provider, exchange);
}
module.exports = { ABI, iface, address, uint, fail, configFromEnv, identityFromEnv, ExchangeChainReader, createReader, keccak256 };
