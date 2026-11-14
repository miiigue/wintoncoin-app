'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { keccak256 } = require('ethers');
const { configFromManifest, interfaces } = require('../src/services/exchangeIndexerV6');
const { ExchangeIndexerV6Worker } = require('../src/services/exchangeIndexerV6Worker');
const { readExchangeSnapshotV6, readExchangeQueueV6 } = require('../src/services/exchangeSnapshotV6');
const { id } = require('ethers');
const migration = require('../migrations/127_exchange_indexer_v6');
const code='0x6000', hash='0x'+'11'.repeat(32), tx='0x'+'22'.repeat(32), a=['0x0000000000000000000000000000000000000001','0x0000000000000000000000000000000000000002','0x0000000000000000000000000000000000000003'];
const manifest={epoch:'V6_DEMO',chainId:'11155420',contracts:{ExchangeRouter:a[0],FifoOrderBook:a[1],ExchangeCustody:a[2]},startBlocks:{ExchangeRouter:10,FifoOrderBook:10,ExchangeCustody:10},codeHashes:Object.fromEntries(['ExchangeRouter','FifoOrderBook','ExchangeCustody'].map(n=>[n,keccak256(code)]))};
test('PostgreSQL aislado: migración, eventos, proyección y reanudación',async()=>{
  if (process.env.V6_INDEXER_PG_TEST !== '1') throw Error('La prueba exige el PostgreSQL aislado explícito');
  const connection={host:'127.0.0.1',port:55471,user:'v6test',database:'postgres'};
  const admin=new Pool(connection); let pool;
  try {
    const directory=(await admin.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/');
    if (!directory.endsWith('/v6-pg-isolated')) throw Error('Base distinta de la instancia aislada');
    const schema='v6test_'+require('crypto').randomBytes(8).toString('hex');
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool=new Pool({...connection,options:`-c search_path=${schema}`});
    const client=await pool.connect(); try { await client.query('BEGIN'); await migration.up(client); await client.query('COMMIT'); } finally { client.release(); }
    const encoded=interfaces.book.encodeEventLog(interfaces.book.getEvent('OrderCreated'),[1,1,a[0],0,1000000]);
    const provider={getNetwork:async()=>({chainId:11155420n}),getBlock:async(tag)=>({number:tag==='finalized'?10:tag,hash}),getCode:async(_a,b)=>b<10?'0x':code,getLogs:async({address})=>address.toLowerCase()===a[1]?[{...encoded,address,blockNumber:10,index:0,blockHash:hash,transactionHash:tx}]:[]};
    const worker=new ExchangeIndexerV6Worker(pool,provider,configFromManifest(manifest));
    worker.custody={solvent:async()=>true,totalReserved:async(i)=>i===0?1000000n:0n,totalPendingRefund:async()=>0n};
    worker.book={order:async()=>({id:1n,sequence:1n,remaining:1000000n,user:a[0],status:1n,side:0n,createdAt:123n,original:1000000n,refunded:0n})};
    assert.deepEqual(await worker.tick(),{status:'ready',block:10});
    assert.deepEqual(await worker.tick(),{status:'ready',block:10});
    const rows=await pool.query('SELECT data FROM web3_exchange_v6_orders');
    assert.equal(rows.rowCount,1); assert.equal(rows.rows[0].data.remaining,'1000000');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM web3_exchange_v6_events')).rows[0].n,1);
    assert.equal((await pool.query('SELECT cursor_block FROM web3_exchange_v6_sync')).rows[0].cursor_block,'10');
    const config=configFromManifest(manifest), identity={chainId:'11155420',exchange:a[0],streamFingerprint:id(JSON.stringify(config.streams))};
    const view=await readExchangeSnapshotV6(pool,identity,a[0]);assert.equal(view.usable,true);assert.equal(view.data.orders[0].remaining_amount,'1.0');
    const queue=await readExchangeQueueV6(pool,identity);assert.equal(queue.totalBlueForSale,'1.0');assert.equal(queue.sellOrders[0].order_id,'1');
    const bad=await readExchangeQueueV6(pool,{...identity,streamFingerprint:'wrong'});assert.equal(bad.usable,false);assert.equal(bad.data,null);
  } finally { if(pool) await pool.end(); await admin.end(); }
});
