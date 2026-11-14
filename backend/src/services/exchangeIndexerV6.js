'use strict';

// Fetch only V6 exchange events; legacy indexes retain their own address scope.
// This module does not create tables or advance an application cursor.
const { Interface, getAddress, keccak256 } = require('ethers');
const interfaces = {
  router: new Interface([
    'event OrderOpened(uint64 indexed orderId,address indexed user,uint8 side,uint128 amount)',
    'event OrdersMatched(uint64 indexed blueOrderId,uint64 indexed usdtOrderId,uint128 gross,uint128 fee)',
    'event OrderCancelled(uint64 indexed orderId,address indexed user,uint128 personalRefund,uint128 collateralRefund)',
    'event OrderSkipped(uint64 indexed orderId,address indexed user)',
  ]),
  book: new Interface([
    'event OrderCreated(uint64 indexed id,uint64 indexed sequence,address indexed user,uint8 side,uint128 amount)',
    'event OrderFilled(uint64 indexed id,uint128 amount,uint128 remaining)',
    'event OrderCancelled(uint64 indexed id,uint128 refund)',
    'event OrderSuspended(uint64 indexed id)',
    'event OrderResumed(uint64 indexed id,uint64 previousSequence,uint64 newSequence)',
  ]),
  custody: new Interface([
    'event Deposited(uint8 indexed asset,address indexed user,uint128 amount)',
    'event MatchSettled(address indexed blueSeller,address indexed usdtBuyer,uint128 gross)',
    'event Refunded(uint8 indexed asset,address indexed user,uint128 amount,bool held)',
    'event PendingReleased(uint8 indexed asset,address indexed user,address indexed recipient,uint128 amount)',
    'event FeesClaimed(address indexed treasury,uint128 blueAmount,uint128 usdtAmount)',
  ]),
};

function configFromManifest(manifest) {
  if (String(manifest.chainId) !== '11155420' || manifest.epoch !== 'V6_DEMO') throw Error('INVALID_V6_DEMO_MANIFEST');
  const mapping = { router: 'ExchangeRouter', book: 'FifoOrderBook', custody: 'ExchangeCustody' };
  const streams = Object.entries(mapping).map(([kind, name]) => {
    const address = getAddress(manifest.contracts[name]);
    const startBlock = Number(manifest.startBlocks[name]);
    const codeHash = manifest.codeHashes[name];
    if (!Number.isSafeInteger(startBlock) || startBlock < 1 || !/^0x[0-9a-fA-F]{64}$/.test(codeHash)) throw Error('INVALID_V6_STREAM');
    return { kind, address, startBlock, codeHash: codeHash.toLowerCase() };
  });
  if (new Set(streams.map(s => s.address.toLowerCase())).size !== streams.length) throw Error('DUPLICATE_V6_STREAM');
  return { chainId: 11155420n, streams };
}

async function resolveConfig(provider, manifest) {
  if (String(manifest.chainId)!=='11155420' || manifest.epoch!=='V6_DEMO' || (await provider.getNetwork()).chainId!==11155420n) throw Error('INVALID_V6_DEMO_MANIFEST');
  const blocks={};
  for (const name of ['ExchangeRouter','FifoOrderBook','ExchangeCustody']) {
    const hash=manifest.deployTransactions?.[name];
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash||'')) throw Error('V6_DEPLOYMENT_RECEIPT_MISSING');
    const receipt=await provider.getTransactionReceipt(hash);
    if (!receipt || receipt.status!==1 || !Number.isSafeInteger(receipt.blockNumber) || receipt.contractAddress?.toLowerCase()!==manifest.contracts[name].toLowerCase()) throw Error('V6_DEPLOYMENT_RECEIPT_MISMATCH');
    const block=await provider.getBlock(receipt.blockNumber);
    if (!block || block.hash!==receipt.blockHash) throw Error('V6_DEPLOYMENT_NOT_CANONICAL');
    blocks[name]=receipt.blockNumber;
  }
  return configFromManifest({...manifest,startBlocks:blocks});
}

async function logsInRange(provider, filter) {
  try { return await provider.getLogs(filter); }
  catch(error) {
    const detail=String(error?.error?.message || error?.info?.error?.message || error?.message);
    if(filter.fromBlock===filter.toBlock || !/block range|range.{0,30}(limit|wide)|limit.{0,35}blocks/i.test(detail)) throw error;
    const middle=Math.floor((filter.fromBlock+filter.toBlock)/2);
    const first=await logsInRange(provider,{...filter,toBlock:middle});
    return first.concat(await logsInRange(provider,{...filter,fromBlock:middle+1}));
  }
}

async function readPage(provider, config, fromBlock, toBlock) {
  if (!Number.isSafeInteger(fromBlock) || !Number.isSafeInteger(toBlock) || fromBlock < 1 || toBlock < fromBlock) throw Error('INVALID_RANGE');
  if ((await provider.getNetwork()).chainId !== config.chainId) throw Error('WRONG_CHAIN');
  const target = await provider.getBlock(toBlock);
  if (!target?.hash) throw Error('MISSING_TARGET_BLOCK');
  const logs = [];
  for (const stream of config.streams) {
    if (toBlock < stream.startBlock) continue;
    const atStart = Math.max(fromBlock, stream.startBlock);
    if (fromBlock <= stream.startBlock && (await provider.getCode(stream.address, stream.startBlock - 1)) !== '0x') throw Error('V6_NOT_DEPLOYMENT_BLOCK');
    if (keccak256(await provider.getCode(stream.address, toBlock)).toLowerCase() !== stream.codeHash) throw Error('V6_CODE_HASH_MISMATCH');
    const iface = interfaces[stream.kind];
    const topics = iface.fragments.filter(f => f.type === 'event').map(f => iface.getEvent(f.format()).topicHash);
    for (const log of await logsInRange(provider,{ address: stream.address, fromBlock: atStart, toBlock, topics: [topics] })) {
      if (log.removed || getAddress(log.address) !== stream.address || log.blockNumber < atStart || log.blockNumber > toBlock || !Number.isSafeInteger(log.index) || log.index < 0) throw Error('INVALID_V6_LOG');
      const block = await provider.getBlock(log.blockNumber);
      if (!block?.hash || block.hash !== log.blockHash) throw Error('V6_CHAIN_CHANGED');
      const event = iface.parseLog(log);
      if (!event) throw Error('UNKNOWN_V6_EVENT');
      logs.push({ stream: stream.kind, event: event.name, args: event.args.toArray().map(x => typeof x === 'bigint' ? x.toString() : x), blockNumber: log.blockNumber, blockHash: log.blockHash, transactionHash: log.transactionHash, logIndex: log.index, address: stream.address });
    }
  }
  if ((await provider.getBlock(toBlock))?.hash !== target.hash) throw Error('V6_CHAIN_CHANGED');
  const seen = new Set();
  for (const log of logs) { const key = `${log.blockHash}:${log.transactionHash}:${log.logIndex}`; if (seen.has(key)) throw Error('DUPLICATE_V6_LOG'); seen.add(key); }
  return { target: { number: toBlock, hash: target.hash }, logs: logs.sort((a,b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex) };
}
module.exports = { configFromManifest, resolveConfig, readPage, interfaces };

