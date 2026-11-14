'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { keccak256 } = require('ethers');
const { startVerifiedDemoV6Indexer } = require('../src/services/exchangeIndexerV6Startup');
const env={EXCHANGE_INDEXER_V6_ENABLED:'true',IS_DEMO_ENV:'true',WINTON_ENVIRONMENT_ID:'demo'};
const contracts={ExchangeRouter:'0x0000000000000000000000000000000000000001',FifoOrderBook:'0x0000000000000000000000000000000000000002',ExchangeCustody:'0x0000000000000000000000000000000000000003'};
const manifest={epoch:'V6_DEMO',chainId:'11155420',contracts,startBlocks:Object.fromEntries(Object.keys(contracts).map(k=>[k,10])),codeHashes:Object.fromEntries(Object.keys(contracts).map(k=>[k,keccak256('0x6000')]))};
const blockHash='0x'+'11'.repeat(32);manifest.deployTransactions=Object.fromEntries(Object.entries(contracts).map(([k,v])=>[k,'0x'+v.slice(2).padStart(64,'0')]));
const rpc={getNetwork:async()=>({chainId:11155420n}),getTransactionReceipt:async hash=>({status:1,blockNumber:10,blockHash,contractAddress:'0x'+hash.slice(-40)}),getBlock:async()=>({hash:blockHash})};
test('requiere Demo y verificación previa; la opción apagada no inicia',async()=>{
  let checked=false,started=false;
  const deployment={configuration:()=>({epoch:'V6_DEMO',chainId:'11155420',manifest}),provider:()=>rpc,validate:async()=>{checked=true;}};
  const createWorker=()=>{ assert(checked); started=true; return 'started'; };
  assert.equal(await startVerifiedDemoV6Indexer({}, {env:{EXCHANGE_INDEXER_V6_ENABLED:'false'},deployment,createWorker}),null);
  await assert.rejects(startVerifiedDemoV6Indexer({}, {env:{...env,WINTON_ENVIRONMENT_ID:'production'},deployment,createWorker}),/V6_INDEXER_DEMO_ONLY/);
  assert.equal(await startVerifiedDemoV6Indexer({}, {env,deployment,createWorker}),'started'); assert(started);
});
test('rechaza suite inválida sin iniciar',async()=>{
  let destroyed=false;
  const deployment={configuration:()=>({epoch:'V6_DEMO',chainId:'11155420',manifest}),provider:()=>({destroy:()=>{destroyed=true;}}),validate:async()=>{throw Error('BAD_RELEASE');}};
  await assert.rejects(startVerifiedDemoV6Indexer({}, {env,deployment,createWorker:()=>{throw Error('NO');}}),/BAD_RELEASE/); assert(destroyed);
});
