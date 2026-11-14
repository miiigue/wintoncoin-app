'use strict';
const {Contract, Interface, getAddress} = require('ethers');
const {randomUUID} = require('crypto');
const {ChainOperationStore, locked, error} = require('./chainOperationStore');
const deployment = require('./marketplaceDeployment');
const {capabilities} = require('./v6WalletPlan');
const candidateStatus = require('./v6CandidateStatus');
const iface = new Interface(['function setMode(uint8)']);

const KIND = 'v6-owner:normal';

async function ready({pool, env=process.env}) {
  if (!capabilities.secureOrder || !capabilities.autoCollateral)
    throw error('Falta el bloqueo de USDT de las órdenes como garantía RED en V6.',409);
  const candidate = await candidateStatus.inspect(env);
  const active = deployment.configuration(env);
  if (!candidate.configured || active.epoch !== 'V6_DEMO' ||
      String(active.chainId) !== candidate.chainId ||
      getAddress(active.contracts.ExchangeRouter) !== getAddress(candidate.contracts.ExchangeRouter) ||
      getAddress(active.contracts.ProtocolModeController) !== getAddress(candidate.contracts.ProtocolModeController)) throw error('V6 no está conectada de forma coherente.',409);
  const setting = await pool.query('SELECT setting_value FROM app_settings WHERE setting_key=$1',['pre_launch_mode_enabled']);
  if (setting.rowCount !== 1 || setting.rows[0].setting_value !== 'true') throw error('Prelanzamiento debe permanecer activo durante esta operación.',409);
  const sync=await pool.query("SELECT status,cursor_block,cursor_hash,(updated_at > clock_timestamp() - interval '120 seconds') AS fresh FROM web3_exchange_v6_sync WHERE chain_id=$1 AND router_address=$2",[candidate.chainId,getAddress(candidate.contracts.ExchangeRouter).toLowerCase()]);
  if(sync.rowCount!==1 || sync.rows[0].status!=='ready' || sync.rows[0].fresh!==true || !sync.rows[0].cursor_hash || !sync.rows[0].cursor_block) throw error('El indexador V6 no está sincronizado.',409);
  return candidate;
}

function createGovernance({ readiness=ready, ContractClass=Contract, Store=ChainOperationStore, lock=locked } = {}) {
async function status({pool}) {
  try {
    const current=await readiness({pool});
    return {success:true,activationReady:current.mode==='PRELAUNCH_FROZEN',mode:current.mode};
  } catch(e) {
    return {success:true,activationReady:false,message:e.status===409?e.message:'No se pudo verificar la preparación V6.'};
  }
}
async function prepare({pool,provider}) {
  const c = await readiness({pool});
  if (c.mode !== 'PRELAUNCH_FROZEN') throw error('El contrato no está congelado.',409);
  const target=getAddress(c.contracts.ProtocolModeController);
  const controller=new ContractClass(target,['function owner() view returns(address)'],provider);
  const owner=getAddress(await controller.owner());
  const data=iface.encodeFunctionData('setMode',[0]);
  await provider.call({from:owner,to:target,data,value:0n});
  return lock(pool,'v6-owner:mode',async client=>{
    const active=await client.query("SELECT id FROM chain_operations WHERE chain_id=$1 AND resource_key=$2 AND state IN ('prepared','pending','conflict') LIMIT 1",[c.chainId,'v6-owner:mode']);
    if(active.rowCount)throw error('Ya existe una operación V6 pendiente.',409);
    const store=new Store(pool,provider);
    const row=await store.prepare({key:KIND+':'+randomUUID(),chainId:c.chainId,sender:owner,resource:'v6-owner:mode',kind:KIND,payload:{to:target,data,value:'0',modeController:target},projection:{}});
    return {success:true,operationId:row.id,chainId:c.chainId,owner,to:target,data};
  });
}

async function confirm({pool,provider,operationId,txHash}) {
  if (!/^[a-f0-9-]{36}$/i.test(String(operationId)) || !/^0x[a-f0-9]{64}$/i.test(String(txHash))) throw error('Referencia inválida.',400);
  // Checking a receipt is read-only; neither this handler nor the store broadcasts.
  const store=new Store(pool,provider);
  const row=await store.get(operationId);
  if(row.kind!==KIND || String(row.chain_id)!=='11155420') throw error('Operación no admitida.',409);
  return lock(pool,'v6-owner:mode',async client=>{
    const c=await readiness({pool});
    if(getAddress(row.payload.to)!==getAddress(c.contracts.ProtocolModeController) || row.payload.data!==iface.encodeFunctionData('setMode',[0])) throw error('La suite cambió.',409);
    const tx=await provider.getTransaction(txHash),receipt=await provider.getTransactionReceipt(txHash);
    if(!tx || !receipt) return {success:false,pending:true,operationId,txHash};
    if(tx.from.toLowerCase()!==row.sender.toLowerCase() || getAddress(tx.to)!==getAddress(row.payload.to) || tx.data!==row.payload.data || tx.value!==0n || String(tx.chainId)!=='11155420' || receipt.status!==1) throw error('Transacción ajena o fallida.',409);
    const block=await provider.getBlock(receipt.blockNumber);
    if(!block || block.hash!==receipt.blockHash || await provider.getBlockNumber()<receipt.blockNumber+1) return {success:false,pending:true,operationId,txHash};
    const controller=new ContractClass(row.payload.to,['function mode() view returns(uint8)'],provider);
    if(await controller.mode()!==0n) throw error('El modo NORMAL no está confirmado.',409);
    if(row.state==='confirmed') {
      if(row.steps?.[0]?.hash?.toLowerCase()!==txHash.toLowerCase()) throw error('La operación corresponde a otra transacción.',409);
      return {success:true,state:'confirmed',mode:'NORMAL',operationId,txHash};
    }
    const result=await client.query("UPDATE chain_operations SET state='confirmed',steps=$2,updated_at=NOW() WHERE id=$1 AND kind=$3 AND state='prepared' RETURNING id",[operationId,JSON.stringify([{hash:txHash.toLowerCase(),confirmed:true,label:KIND,blockNumber:receipt.blockNumber}]),KIND]);
    if(result.rowCount!==1)throw error('Operación ya procesada; consulta su estado.',409);
    return {success:true,state:'confirmed',mode:'NORMAL',operationId,txHash};
  });
}
return {status,prepare,confirm};
}
module.exports={ready,createGovernance,...createGovernance()};
