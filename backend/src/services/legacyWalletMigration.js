'use strict';
const fs=require('fs');
const path=require('path');
const {Interface,getAddress}=require('ethers');
const deployment=require('./chainDeployment');
const {error}=require('./chainOperationStore');
const roles=['BlueToken','RedToken','USDT','CoreProtocol','CollateralVault','FifoExchange'];
function blocked(message){return Object.assign(error(message,409),{code:'LEGACY_MIGRATION_REQUIRED'});}
// This registry includes historical suites: zero in the current tokens alone is insufficient.
function suites(chainId){
 const current=deployment.configuration();
 if(String(current.chainId)!==String(chainId))throw blocked('La red de la billetera requiere revisión.');
 const dir=path.resolve(__dirname,'../../../web3-contracts/deployments');
 const all=[current,...fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')))];
 const unique=new Map();
 for(const item of all){
  if(String(item.chainId)!==String(chainId)||!roles.every(k=>item.contracts?.[k]))continue;
  unique.set(roles.map(k=>getAddress(item.contracts[k]).toLowerCase()).join(':'),item.contracts);
 }
 return [...unique.values()];
}
async function inspect({rpc,runner,userId,address,chainId,excludeOperationId=null,deployments=null,migration=null}){
 try{
  deployments=deployments||suites(chainId);
  address=getAddress(address);
  const pending=await runner.query(`SELECT id FROM chain_operations WHERE user_id=$1
   AND state NOT IN ('confirmed','failed','abandoned') AND ($2::uuid IS NULL OR (id<>$2::uuid AND COALESCE(payload->>'migrationParentId','')<>$2::text)) LIMIT 1`,[userId,excludeOperationId]);
  const legacyPending=await runner.query("SELECT tx_hash FROM web3_pending_transactions WHERE user_id=$1 AND status NOT IN ('fully_resolved','failed') LIMIT 1",[userId]);
  const registered=await runner.query('SELECT contract_name,contract_address FROM web3_contract_deployments WHERE chain_id=$1',[String(chainId)]);
  for(const row of registered.rows)if(roles.includes(row.contract_name)&&!deployments.some(d=>d[row.contract_name]?.toLowerCase()===row.contract_address.toLowerCase()))
   throw blocked('Hay un despliegue anterior que requiere revisión antes de reemplazar tu billetera.');
  if(pending.rows.length||legacyPending.rows.length)throw blocked('Hay una operación pendiente. Termínala antes de actualizar tu billetera.');
  if(!deployments.length||String((await rpc.getNetwork()).chainId)!==String(chainId))throw blocked('No pudimos comprobar la red de tu billetera.');
  const block=await rpc.getBlock('latest');
  if(!block?.hash||!Number.isSafeInteger(block.number))throw Error('Missing block');
  const tag='0x'+block.number.toString(16);
  // Direct RPC calls avoid provider caches at the final replacement check.
  const read=async(to,signature,args=[])=>{
   const abi=new Interface(['function '+signature]);const f=abi.fragments[0];
   const data=await rpc.send('eth_call',[{to,data:abi.encodeFunctionData(f,args)},tag]);
   return abi.decodeFunctionResult(f,data);
  };
  const usdt=new Map(),authorizations=[];
  const native=await rpc.send('eth_getBalance',[address,tag]);
  if(BigInt(native)>BigInt(migration?.nativeAllowance||0))throw blocked('Tu billetera anterior tiene saldo de la red. Debe conservarse hasta resolver ese saldo.');
  if(await rpc.send('eth_getCode',[address,tag])!=='0x')throw blocked('La dirección anterior es un contrato y necesita una migración específica.');
  for(const at of [tag,'pending'])if(BigInt(await rpc.send('eth_getTransactionCount',[address,at]))!==BigInt(migration?.nonceAllowance||0))
   throw blocked('La billetera anterior tiene actividad. Necesita una revisión antes de reemplazarla.');
  const checked=new Set();
  for(const contracts of deployments){
   for(const role of roles){const target=getAddress(contracts[role]);if(checked.has(target))continue;
    if(await rpc.send('eth_getCode',[target,tag])==='0x')throw Error('Missing deployment');checked.add(target);
   }
   for(const token of ['BlueToken','RedToken','USDT']){
    const balance=(await read(contracts[token],'balanceOf(address) view returns(uint256)',[address]))[0];
    if(balance===0n)continue;
    if(token==='USDT'&&migration?.planning){usdt.set(contracts.USDT.toLowerCase(),balance.toString());continue;}
    throw blocked('La billetera anterior tiene tokens '+token+'. Debemos resolver ese saldo antes de actualizarla. Tu dirección se conserva.');
   }
   for(const name of ['userCollateral','exchangeReserved','pendingReserve','activeAmortizationOrder'])
    if((await read(contracts.CollateralVault,name+'(address) view returns(uint256)',[address]))[0]!==0n)
     throw blocked('Hay garantías o importes reservados en tu billetera anterior. No se ha cambiado tu dirección.');
   for(const name of ['pendingRefundBlue','pendingRefundUsdt'])
    if((await read(contracts.FifoExchange,name+'(address) view returns(uint128)',[address]))[0]!==0n)
     throw blocked('Hay una devolución pendiente en el Exchange. Debe resolverse antes de actualizar la billetera.');
   // An authorised legacy signer must not remain usable beside the new account.
   if((await read(contracts.CoreProtocol,'isKYCVerified(address) view returns(bool)',[address]))[0]){
    if(!migration?.planning)throw blocked('La dirección anterior todavía está habilitada para operar. Soporte debe deshabilitarla antes de reemplazarla; tu identidad se conserva.');
    authorizations.push(contracts.CoreProtocol.toLowerCase());
   }
   const count=(await read(contracts.FifoExchange,'nextOrderId() view returns(uint64)'))[0];
   if(count<1n||count>201n)throw blocked('El historial del Exchange requiere una revisión de migración. Tu billetera se conserva.');
   for(let id=1n;id<count;id++){
    const order=await read(contracts.FifoExchange,'orders(uint64) view returns(uint64,uint64,uint128,address,uint8,uint8,uint48,uint128,uint128)',[id]);
    if(order[3].toLowerCase()===address.toLowerCase()&&[1n,2n,5n].includes(order[4]))
     throw blocked('Tienes una orden pendiente en el Exchange. Resuélvela antes de actualizar tu billetera.');
   }
  }
  const finalBlock=await rpc.send('eth_getBlockByNumber',[tag,false]);
  if(finalBlock?.hash?.toLowerCase()!==block.hash.toLowerCase())throw Error('Block changed');
  return {address:address.toLowerCase(),chainId:String(chainId),blockNumber:block.number,blockHash:block.hash,...(migration?.planning?{usdt:[...usdt].map(([token,amount])=>({token,amount})),authorizations:[...new Set(authorizations)]}:{})};
 }catch(e){if(e.code==='LEGACY_MIGRATION_REQUIRED')throw e;
  throw blocked('No pudimos comprobar que la billetera anterior esté libre de fondos y operaciones. Tu dirección se conserva. Vuelve a intentarlo.');}
}
module.exports={inspect,suites};
