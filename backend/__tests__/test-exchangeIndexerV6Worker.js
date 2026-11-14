'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { keccak256, id } = require('ethers');
const { configFromManifest } = require('../src/services/exchangeIndexerV6');
const { ExchangeIndexerV6Worker } = require('../src/services/exchangeIndexerV6Worker');
const code='0x6000', hash='0x'+'11'.repeat(32), addrs=['0x0000000000000000000000000000000000000001','0x0000000000000000000000000000000000000002','0x0000000000000000000000000000000000000003'];
const manifest={ epoch:'V6_DEMO',chainId:'11155420', contracts:{ExchangeRouter:addrs[0],FifoOrderBook:addrs[1],ExchangeCustody:addrs[2]},startBlocks:{ExchangeRouter:10,FifoOrderBook:10,ExchangeCustody:10},codeHashes:Object.fromEntries(['ExchangeRouter','FifoOrderBook','ExchangeCustody'].map(n=>[n,keccak256(code)])) };
function fixture({failUpdate=false,reorg=false}={}) {
  const calls=[];
  const client={release:()=>{},query:async(sql)=>{ calls.push(sql); if(sql.startsWith('SELECT pg_try'))return{rows:[{locked:true}]}; if(sql.startsWith('SELECT *'))return{rows:[{start_block:'10',stream_fingerprint:id(JSON.stringify(configFromManifest(manifest).streams)),cursor_block:reorg?'10':'9',cursor_hash:reorg?'0x'+'22'.repeat(32):null}]}; if(sql.startsWith('SELECT\n') || sql.startsWith('SELECT COALESCE'))return{rows:[{blue:'0',usdt:'0'}]}; if(failUpdate && sql.startsWith('UPDATE web3_exchange_v6_sync SET cursor_block'))throw Error('DB_ERROR'); return{rows:[]}; }};
  const provider={getNetwork:async()=>({chainId:11155420n}),getBlock:async(tag)=>({number:tag==='finalized'?10:tag,hash}),getCode:async(_a,block)=>block < 10?'0x':code,getLogs:async()=>[]};
  const worker=new ExchangeIndexerV6Worker({connect:async()=>client},provider,configFromManifest(manifest));
  worker.custody={solvent:async()=>true,totalReserved:async()=>0n,totalPendingRefund:async()=>0n};
  return {worker,calls};
}
test('avanza atómicamente solo después de procesar el bloque finalizado',async()=>{
  const f=fixture(); assert.deepEqual(await f.worker.tick(),{status:'ready',block:10});
  assert(f.calls.includes('BEGIN')); assert(f.calls.includes('COMMIT')); assert(!f.calls.includes('ROLLBACK'));
});
test('revierte fallos de base y marca el flujo en error',async()=>{
  const f=fixture({failUpdate:true}); await assert.rejects(f.worker.tick(),/DB_ERROR/);
  assert(f.calls.includes('ROLLBACK')); assert(f.calls.some(s=>s.includes("status='error'"))); assert(!f.calls.includes('COMMIT'));
});
test('no reescribe histórico si cambia el bloque previamente finalizado',async()=>{
  const f=fixture({reorg:true}); await assert.rejects(f.worker.tick(),/FINALIZED_REORG_REQUIRES_REVIEW/);
  assert(!f.calls.includes('BEGIN')); assert(f.calls.some(s=>s.includes("status='error'")));
});

