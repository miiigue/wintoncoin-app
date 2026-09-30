'use strict';
const { Contract, Interface, Transaction, getAddress, parseUnits, keccak256 }=require('ethers');
const { randomUUID }=require('crypto');
const deployment=require('./chainDeployment');
const { ChainOperationStore, locked, publicResult, error }=require('./chainOperationStore');

const abi=[
  'function owner() view returns(address)',
  'function setCommissionBps(uint256)', 'function setCommitmentDuration(uint256)',
  'function setCreditLimit(address,uint256)', 'function setKYCStatus(address,bool)',
  'function setMaxTransactionAmount(uint256)', 'function setExtensionOption(uint256,uint16,bool)',
  'function setUserBenefits(address,uint8,uint256)', 'function pause()', 'function unpause()'
];
const iface=new Interface(abi);
const decimal=(value,max)=>{
  if(typeof value!=='string'||!/^\d+(?:\.\d{1,6})?$/.test(value))throw error('Importe inválido.',400);
  const amount=parseUnits(value,6);if(amount>BigInt(max)*1000000n)throw error('Importe fuera de límite.',400);return amount;
};
const integer=(v,min,max)=>{if(!/^\d+$/.test(String(v))||Number(v)<min||Number(v)>max||!Number.isSafeInteger(Number(v)))throw error('Parámetro fuera de límite.',400);return Number(v);};
function actionPlan(action,input,contracts) {
  let method,args,projection={},target=contracts.CoreProtocol,resource=action;
  switch(action){
    case 'commission': {
      const pct=String(input.value);
      if(!/^\d+(?:\.\d{1,2})?$/.test(pct)||Number(pct)>10)throw error('Comisión entre 0 y 10%.',400);
      const bps=BigInt(pct.includes('.')?pct.split('.')[0]:pct)*100n+BigInt((pct.split('.')[1]||'').padEnd(2,'0'));
      method='setCommissionBps';args=[bps];projection={type:'setting',key:'platform_commission_percentage',value:pct};break;
    }
    case 'commitment_duration':{
      const days=integer(input.value,1,365);method='setCommitmentDuration';args=[days*86400];projection={type:'setting',key:'debt_cycle_days',value:String(days)};break;
    }
    case 'credit_limit':{
      const wallet=getAddress(input.walletAddress),amount=decimal(String(input.limit),100000000);
      method='setCreditLimit';args=[wallet,amount];projection={type:'credit_manual',wallet,value:String(input.limit)};resource+=':'+wallet.toLowerCase();break;
    }
    case 'kyc':{
      if(typeof input.status!=='boolean')throw error('Estado KYC inválido.',400);
      const wallet=getAddress(input.walletAddress);method='setKYCStatus';args=[wallet,input.status];projection={type:'kyc',wallet,value:input.status};resource+=':'+wallet.toLowerCase();break;
    }
    case 'max_transaction':method='setMaxTransactionAmount';args=[decimal(String(input.amount),100000000)];if(args[0]===0n)throw error('El máximo debe ser mayor que cero.',400);break;
    case 'extension_option':method='setExtensionOption';args=[integer(input.extensionDays,1,365),integer(input.extensionBps,0,10000),input.enabled];if(typeof input.enabled!=='boolean')throw error('Estado de prórroga inválido.',400);resource+=':'+args[0];break;
    case 'user_benefits':{
      const wallet=getAddress(input.walletAddress);method='setUserBenefits';args=[wallet,integer(input.level,0,255),decimal(String(input.margin),100000000)];resource+=':'+wallet.toLowerCase();break;
    }
    case 'pause_protocol':method='pause';args=[];resource='pause:core';break;
    case 'unpause_protocol':method='unpause';args=[];resource='pause:core';break;
    case 'pause_vault':method='pause';args=[];target=contracts.CollateralVault;resource='pause:vault';break;
    case 'unpause_vault':method='unpause';args=[];target=contracts.CollateralVault;resource='pause:vault';break;
    default:throw error('Acción administrativa no admitida.',400);
  }
  return {target,method,data:iface.encodeFunctionData(method,args),projection,resource:'external-owner:'+resource};
}
async function prepare({pool,provider,action,input}){
  const config=await deployment.validate(provider);
  const plan=actionPlan(action,input,config.contracts);
  const owner=getAddress(await new Contract(plan.target,abi,provider).owner());
  const store=new ChainOperationStore(pool,provider);
  return locked(pool,plan.resource,async client=>{
    const active=await client.query("SELECT * FROM chain_operations WHERE chain_id=$1 AND resource_key=$2 AND state IN ('prepared','pending','conflict') ORDER BY created_at LIMIT 1",[config.chainId,plan.resource]);
    if(active.rows[0]){
      const old=active.rows[0];
      if(old.sender!==owner.toLowerCase()||old.payload.to.toLowerCase()!==plan.target.toLowerCase()||old.payload.data!==plan.data)throw error('Ya existe un cambio pendiente sobre este parámetro (referencia '+old.id+'). Comprueba su estado; si la billetera lo envió, verifica su transacción.',409);
      return {operationId:old.id,chainId:config.chainId,owner,to:plan.target,data:plan.data,pending:old.state!=='prepared',txHash:old.steps?.[0]?.hash||null};
    }
    const row=await store.prepare({key:'external-owner:'+randomUUID(),chainId:config.chainId,sender:owner,resource:plan.resource,kind:'owner:'+action,
      payload:{to:plan.target,data:plan.data,value:'0',fingerprint:config.fingerprint},projection:plan.projection});
    return {operationId:row.id,chainId:config.chainId,owner,to:plan.target,data:plan.data,pending:false};
  });
}
async function confirm({pool,provider,id,hash}){
  if(!/^0x[0-9a-fA-F]{64}$/.test(String(hash)))throw error('Identificador de transacción inválido.',400);
  const store=new ChainOperationStore(pool,provider),initial=await store.get(id);
  if(!initial.kind.startsWith('owner:'))throw error('Operación no admitida.',400);
  if(initial.state==='confirmed'||initial.state==='failed'||initial.state==='conflict')return publicResult(initial);
  return locked(pool,'signer:'+initial.chain_id+':'+initial.sender,async client=>{
    const row=await store.get(id);
    if(row.state==='pending'){
      if(row.steps?.[0]?.hash?.toLowerCase()!==hash.toLowerCase())throw error('La firma no corresponde a esta operación.',409);
      return store.advanceLocked(row,client);
    }
    if(row.state!=='prepared'||row.steps?.length)throw error('Operación ya utilizada.',409);
    const config=await deployment.validate(provider);
    if(config.fingerprint!==row.payload.fingerprint||config.chainId!==row.chain_id)throw error('El despliegue cambió. Prepara la operación nuevamente.',409);
    const tx=await provider.getTransaction(hash);
    if(!tx)return {success:false,pending:true,operationId:id,txHash:hash,message:'La red aún no devuelve la transacción. Consulta de nuevo sin repetir la firma.'};
    if(tx.from?.toLowerCase()!==row.sender||tx.to?.toLowerCase()!==row.payload.to.toLowerCase()||tx.data!==row.payload.data||tx.value!==0n||String(tx.chainId)!==row.chain_id)throw error('Transacción ajena a la solicitud administrativa.',409);
    const raw=Transaction.from(tx).serialized;
    if(keccak256(raw).toLowerCase()!==hash.toLowerCase()||Transaction.from(raw).from.toLowerCase()!==row.sender)
      throw error('Firma administrativa inconsistente.',409);
    const step={raw,hash:hash.toLowerCase(),nonce:tx.nonce,label:row.kind};
    await client.query("UPDATE chain_operations SET steps=$2,state='pending',updated_at=NOW() WHERE id=$1 AND state='prepared'",[id,JSON.stringify([step])]);
    return store.advanceLocked({...row,state:'pending',steps:[step]},client);
  });
}
module.exports={actionPlan,prepare,confirm};
