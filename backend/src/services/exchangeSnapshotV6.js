'use strict';
const { formatUnits } = require('ethers');
const { address, uint } = require('./exchangeChainReader');
const { capabilities: walletCapabilities } = require('./v6WalletPlan');
const states = [null,'OPEN','PARTIALLY_FILLED','FILLED','CANCELLED','SUSPENDED'];
function render(o, row) {
  return { order_id:o.id, sequence_id:o.sequence, wallet_address:o.user, side:o.side===0?'SELL_BLUE':'BUY_BLUE', status:states[o.status],
    original_amount:formatUnits(o.original,6), remaining_amount:formatUnits(o.remaining,6), refunded_amount:formatUnits(o.refunded,6),
    created_at_chain:o.createdAt, block_number:row.block_number, block_hash:row.block_hash,
    is_amortization:null, exchange_collateralized:null, suspend_reason:null };
}
async function snapshot(pool, identity, wallet, {after='0',limit=50,maxAgeSeconds=120,queue=false}={}) {
  if (!Number.isInteger(limit)||limit<1||limit>100) throw Error('INVALID_PAGE');
  if (!queue) { wallet=address(wallet); after=uint(after,(1n<<64n)-1n).toString(); }
  const client=await pool.connect(), key=[identity.chainId,identity.exchange];
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const row=(await client.query(`SELECT *, (status='ready' AND cursor_hash IS NOT NULL AND updated_at > clock_timestamp()-($3*interval '1 second')) AS fresh FROM web3_exchange_v6_sync WHERE chain_id=$1 AND router_address=$2`,[...key,maxAgeSeconds])).rows[0];
    const matching=row?.stream_fingerprint===identity.streamFingerprint;
    // Capacidades reales alineadas con el planificador de operaciones V6 (auditables por versión de protocolo).
    const capabilities = {
        exchangeRead: true,
        exchangeWrite: Boolean(walletCapabilities.buy && walletCapabilities.sell && walletCapabilities.cancel && walletCapabilities.resume && walletCapabilities.claim),
        autoCollateral: Boolean(walletCapabilities.autoCollateral),
        secureOrder: Boolean(walletCapabilities.secureOrder),
        collateralDetails: false,
    };
    const out={chainId:identity.chainId,exchange:identity.exchange,protocolVersion:'V6',capabilities,usable:!!row?.fresh&&matching,status:!row?'not_started':!matching?'configuration_changed':row.status==='ready'&&!row.fresh?'stale':row.status,verifiedThroughBlock:row?.cursor_hash?row.cursor_block:null,verifiedBlockHash:row?.cursor_hash??null,data:null};
    if (!queue) out.wallet=wallet;
    if(out.usable && !queue){
      const rows=(await client.query(`SELECT data,block_number,block_hash FROM web3_exchange_v6_orders WHERE chain_id=$1 AND router_address=$2 AND data->>'user'=$3 AND order_id>$4 ORDER BY order_id LIMIT $5`,[...key,wallet,after,limit+1])).rows;
      const hasMore=rows.length>limit;if(hasMore)rows.pop();
      const refunds=(await client.query('SELECT blue,usdt FROM web3_exchange_v6_refunds WHERE chain_id=$1 AND router_address=$2 AND user_address=$3',[...key,wallet])).rows[0];
      out.data={orders:rows.map(r=>render(r.data,r)),pendingRefunds:{BLUE:formatUnits(refunds?.blue??'0',6),USDT:formatUnits(refunds?.usdt??'0',6)},nextAfter:hasMore?rows.at(-1).data.id:null};
    }
    if(out.usable && queue){
      const rows=[];
      for(const side of ['0','1']) rows.push(...(await client.query(`SELECT data,block_number,block_hash FROM web3_exchange_v6_orders WHERE chain_id=$1 AND router_address=$2 AND data->>'side'=$3 AND data->>'status' IN ('1','2') ORDER BY (data->>'sequence')::numeric LIMIT $4`,[...key,side,limit])).rows);
      const totals=(await client.query(`SELECT COALESCE(sum((data->>'remaining')::numeric) FILTER(WHERE data->>'side'='0'),0)::text AS blue,COALESCE(sum((data->>'remaining')::numeric) FILTER(WHERE data->>'side'='1'),0)::text AS usdt FROM web3_exchange_v6_orders WHERE chain_id=$1 AND router_address=$2 AND data->>'status' IN ('1','2')`,key)).rows[0];
      const orders=rows.map(r=>render(r.data,r));out.sellOrders=orders.filter(x=>x.side==='SELL_BLUE');out.buyOrders=orders.filter(x=>x.side==='BUY_BLUE');out.totalBlueForSale=formatUnits(totals.blue,6);out.totalUsdtWaiting=formatUnits(totals.usdt,6);out.limitPerSide=limit;out.data={sellOrders:out.sellOrders,buyOrders:out.buyOrders};
    }
    await client.query('COMMIT');return out;
  } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
}
module.exports={readExchangeSnapshotV6:(pool,identity,wallet,options)=>snapshot(pool,identity,wallet,options),readExchangeQueueV6:(pool,identity,options)=>snapshot(pool,identity,null,{...options,queue:true})};
