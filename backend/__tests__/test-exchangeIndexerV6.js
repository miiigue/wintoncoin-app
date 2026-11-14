'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { keccak256 } = require('ethers');
const { configFromManifest, readPage, interfaces } = require('../src/services/exchangeIndexerV6');
const addresses = ['0x0000000000000000000000000000000000000001','0x0000000000000000000000000000000000000002','0x0000000000000000000000000000000000000003'];
const code = '0x6000', hash = '0x' + '11'.repeat(32), txHash = '0x' + '22'.repeat(32);
const manifest = { epoch: 'V6_DEMO', chainId: '11155420', contracts: { ExchangeRouter: addresses[0], FifoOrderBook: addresses[1], ExchangeCustody: addresses[2] }, startBlocks: { ExchangeRouter: 10, FifoOrderBook: 11, ExchangeCustody: 12 }, codeHashes: Object.fromEntries(['ExchangeRouter','FifoOrderBook','ExchangeCustody'].map(n => [n, keccak256(code)])) };
const provider = {
  getNetwork: async () => ({ chainId: 11155420n }), getBlock: async () => ({ hash }), getCode: async (address, block) => block < 10 + addresses.indexOf(address.toLowerCase()) ? '0x' : code,
  getLogs: async ({address,fromBlock}) => {
    const which = addresses.indexOf(address.toLowerCase());
    const kind = ['router','book','custody'][which];
    const event = ['OrderOpened','OrderCreated','Refunded'][which];
    const args = which === 0 ? [1, addresses[0], 0, 1000000] : which === 1 ? [1, 1, addresses[0], 0, 1000000] : [1, addresses[0], 1000000, true];
    const encoded = interfaces[kind].encodeEventLog(interfaces[kind].getEvent(event), args);
    return [{ address, blockNumber: fromBlock, index: which, blockHash: hash, transactionHash: txHash, ...encoded }];
  },
};
test('lee eventos V6 desde el bloque propio de cada contrato', async () => {
  const page = await readPage(provider, configFromManifest(manifest), 10, 15);
  assert.deepEqual(page.logs.map(x => x.event), ['OrderOpened','OrderCreated','Refunded']);
  assert.deepEqual(page.logs.map(x => x.blockNumber), [10,11,12]);
  assert.equal(page.logs[2].args[3], true);
});
test('rechaza otra red o código alterado', async () => {
  await assert.rejects(readPage({ ...provider, getNetwork: async () => ({ chainId: 1n }) }, configFromManifest(manifest), 10, 15), /WRONG_CHAIN/);
  await assert.rejects(readPage({ ...provider, getCode: async (_a, block) => block === 9 ? '0x' : '0x6001' }, configFromManifest(manifest), 10, 15), /V6_CODE_HASH_MISMATCH/);
});
test('rechaza reorganización durante lectura', async () => {
  let calls = 0;
  await assert.rejects(readPage({ ...provider, getBlock: async () => ({ hash: ++calls > 4 ? txHash : hash }) }, configFromManifest(manifest), 10, 15), /V6_CHAIN_CHANGED/);
});

