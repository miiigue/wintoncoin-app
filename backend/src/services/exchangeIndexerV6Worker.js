'use strict';
const { Contract, id } = require('ethers');
const { readPage } = require('./exchangeIndexerV6');
const bookAbi = ['function order(uint64) view returns (tuple(uint64 id,uint64 sequence,uint128 remaining,address user,uint8 status,uint8 side,uint48 createdAt,uint128 original,uint128 refunded))'];
const custodyAbi = ['function pendingRefund(address,uint8) view returns (uint128)', 'function solvent(uint8) view returns (bool)', 'function totalReserved(uint256) view returns (uint128)', 'function totalPendingRefund(uint256) view returns (uint128)'];
class ExchangeIndexerV6Worker {
  constructor(pool, provider, config, { batchBlocks = 1000 } = {}) {
    this.pool = pool; this.provider = provider; this.config = config; this.batchBlocks = batchBlocks;
    if (!Number.isSafeInteger(batchBlocks) || batchBlocks < 1) throw Error('INVALID_BATCH');
    this.router = config.streams.find(x => x.kind === 'router').address.toLowerCase();
    this.book = new Contract(config.streams.find(x => x.kind === 'book').address, bookAbi, provider);
    this.custody = new Contract(config.streams.find(x => x.kind === 'custody').address, custodyAbi, provider);
    this.start = Math.min(...config.streams.map(x => x.startBlock));
    this.fingerprint = id(JSON.stringify(config.streams));
  }
  async tick() {
    const client = await this.pool.connect();
    const key = [String(this.config.chainId), this.router];
    let locked = false;
    try {
      locked = (await client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked', [`winton:v6:${key.join(':')}`])).rows[0].locked;
      if (!locked) return { status: 'busy' };
      if ((await this.provider.getNetwork()).chainId !== this.config.chainId) throw Error('WRONG_CHAIN');
      const target = await this.provider.getBlock('finalized');
      if (!target || !Number.isSafeInteger(target.number)) throw Error('FINALIZED_UNAVAILABLE');
      await client.query(`INSERT INTO web3_exchange_v6_sync(chain_id,router_address,start_block,cursor_block,status,stream_fingerprint)
        VALUES($1,$2,$3::bigint,$3::bigint-1,'syncing',$4) ON CONFLICT DO NOTHING`, [...key, this.start, this.fingerprint]);
      const cursor = (await client.query('SELECT * FROM web3_exchange_v6_sync WHERE chain_id=$1 AND router_address=$2', key)).rows[0];
      if (Number(cursor.start_block) !== this.start || cursor.stream_fingerprint !== this.fingerprint) throw Error('STREAM_CONFIG_CHANGED');
      if (target.number < this.start && Number(cursor.cursor_block) === this.start - 1) return { status: 'waiting_deployment' };
      if (cursor.cursor_hash) {
        const current = await this.provider.getBlock(Number(cursor.cursor_block));
        if (!current || current.hash !== cursor.cursor_hash) throw Error('FINALIZED_REORG_REQUIRES_REVIEW');
      }
      if (target.number < Number(cursor.cursor_block)) throw Error('RPC_BEHIND_CURSOR');
      if (target.number === Number(cursor.cursor_block)) {
        if (cursor.status !== 'ready') throw Error('RECONCILIATION_REQUIRED');
        if (!(await this.custody.solvent(0,{blockTag:target.number})) || !(await this.custody.solvent(1,{blockTag:target.number}))) throw Error('V6_CUSTODY_INSOLVENT');
        if ((await this.provider.getBlock(target.number)).hash !== cursor.cursor_hash) throw Error('V6_CHAIN_CHANGED');
        await client.query("UPDATE web3_exchange_v6_sync SET updated_at=now() WHERE chain_id=$1 AND router_address=$2", key);
        return { status: 'ready', block: target.number };
      }
      const lastDeployment = Math.max(...this.config.streams.map(x => x.startBlock));
      if (target.number < lastDeployment) return { status: 'waiting_deployment' };
      const end = Math.min(target.number, Math.max(Number(cursor.cursor_block) + this.batchBlocks, lastDeployment));
      if (end < this.start) return { status: 'waiting_deployment' };
      const page = await readPage(this.provider, this.config, Number(cursor.cursor_block) + 1, end);
      const ids = new Set(), users = new Set();
      for (const log of page.logs) {
        if (log.stream === 'book') ids.add(log.args[0]);
        if (log.stream === 'router' && ['OrderOpened','OrderCancelled','OrderSkipped'].includes(log.event)) ids.add(log.args[0]);
        if (log.event === 'OrdersMatched') { ids.add(log.args[0]); ids.add(log.args[1]); }
        if (log.stream === 'custody' && ['Refunded','PendingReleased'].includes(log.event)) users.add(log.args[1].toLowerCase());
      }
      const orders = [];
      for (const id of ids) {
        const o = await this.book.order(id, { blockTag: end });
        if (o.id.toString() !== id || Number(o.status) < 1 || Number(o.status) > 5) throw Error('INVALID_ORDER');
        orders.push({ id, data: { id, sequence: o.sequence.toString(), remaining: o.remaining.toString(), user: o.user.toLowerCase(), status: Number(o.status), side: Number(o.side), createdAt: o.createdAt.toString(), original: o.original.toString(), refunded: o.refunded.toString() } });
      }
      const refunds = [];
      for (const user of users) refunds.push({ user, blue: (await this.custody.pendingRefund(user,0,{blockTag:end})).toString(), usdt: (await this.custody.pendingRefund(user,1,{blockTag:end})).toString() });
      if (!(await this.custody.solvent(0,{blockTag:end})) || !(await this.custody.solvent(1,{blockTag:end}))) throw Error('V6_CUSTODY_INSOLVENT');
      if ((await this.provider.getBlock(end)).hash !== page.target.hash) throw Error('V6_CHAIN_CHANGED');
      await client.query('BEGIN');
      try {
        for (const x of page.logs) await client.query(`INSERT INTO web3_exchange_v6_events(chain_id,router_address,block_number,block_hash,transaction_hash,log_index,emitter,stream,event_name,arguments) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) ON CONFLICT DO NOTHING`, [...key, x.blockNumber,x.blockHash,x.transactionHash,x.logIndex,x.address.toLowerCase(),x.stream,x.event,JSON.stringify(x.args)]);
        for (const x of orders) await client.query(`INSERT INTO web3_exchange_v6_orders(chain_id,router_address,order_id,data,block_number,block_hash) VALUES($1,$2,$3,$4::jsonb,$5,$6) ON CONFLICT(chain_id,router_address,order_id) DO UPDATE SET data=EXCLUDED.data,block_number=EXCLUDED.block_number,block_hash=EXCLUDED.block_hash`, [...key,x.id,JSON.stringify(x.data),end,page.target.hash]);
        for (const x of refunds) await client.query(`INSERT INTO web3_exchange_v6_refunds(chain_id,router_address,user_address,blue,usdt,block_number,block_hash) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(chain_id,router_address,user_address) DO UPDATE SET blue=EXCLUDED.blue,usdt=EXCLUDED.usdt,block_number=EXCLUDED.block_number,block_hash=EXCLUDED.block_hash`, [...key,x.user,x.blue,x.usdt,end,page.target.hash]);
        const totals = (await client.query(`SELECT
          COALESCE(sum((data->>'remaining')::numeric) FILTER (WHERE data->>'side'='0' AND data->>'status' IN ('1','2','5')),0)::text AS blue,
          COALESCE(sum((data->>'remaining')::numeric) FILTER (WHERE data->>'side'='1' AND data->>'status' IN ('1','2','5')),0)::text AS usdt
          FROM web3_exchange_v6_orders WHERE chain_id=$1 AND router_address=$2`, key)).rows[0];
        const held = (await client.query(`SELECT COALESCE(sum(blue),0)::text AS blue,COALESCE(sum(usdt),0)::text AS usdt FROM web3_exchange_v6_refunds WHERE chain_id=$1 AND router_address=$2`, key)).rows[0];
        for (const [i,name] of [[0,'blue'],[1,'usdt']]) {
          if (BigInt(totals[name]) !== await this.custody.totalReserved(i,{blockTag:end}) || BigInt(held[name]) !== await this.custody.totalPendingRefund(i,{blockTag:end})) throw Error('V6_RECONCILIATION_MISMATCH');
        }
        if ((await this.provider.getBlock(end)).hash !== page.target.hash) throw Error('V6_CHAIN_CHANGED');
        const status = end === target.number ? 'ready' : 'syncing';
        await client.query(`UPDATE web3_exchange_v6_sync SET cursor_block=$3,cursor_hash=$4,status=$5,updated_at=now() WHERE chain_id=$1 AND router_address=$2`, [...key,end,page.target.hash,status]);
        await client.query('COMMIT'); return { status, block: end };
      } catch (e) { await client.query('ROLLBACK'); throw e; }
    } catch (e) {
      if (locked) await client.query("UPDATE web3_exchange_v6_sync SET status='error',updated_at=now() WHERE chain_id=$1 AND router_address=$2", key);
      throw e;
    } finally {
      let destroy = false;
      if (locked) try { await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [`winton:v6:${key.join(':')}`]); } catch { destroy = true; }
      client.release(destroy);
    }
  }
}
// Caller must supply a previously verified Demo manifest and RPC provider.
// This function is intentionally not called during import or legacy startup.
function startExchangeIndexerV6(pool, provider, config, { pollMs = 10000, batchBlocks = 1000, onError = () => {} } = {}) {
  if (!Number.isSafeInteger(pollMs) || pollMs < 1000) throw Error('INVALID_POLL_INTERVAL');
  const worker = new ExchangeIndexerV6Worker(pool, provider, config, { batchBlocks });
  let stopped = false, timer;
  async function run() {
    if (stopped) return;
    let delay=pollMs;
    try {
      const page=await worker.tick();
      if(page.status==='syncing') delay=100;
    } catch (error) { onError(error); }
    if (!stopped) timer = setTimeout(run, delay);
  }
  timer = setTimeout(run, 0);
  return { worker, stop() { stopped = true; clearTimeout(timer); } };
}
module.exports = { ExchangeIndexerV6Worker, startExchangeIndexerV6 };

