'use strict';
const {Contract,Interface,getAddress} = require('ethers');
const {error} = require('./chainOperationStore');
const tokenAbi=['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)','function transfer(address,uint256) returns(bool)'];
const vaultAbi=['function deposit(uint256)','function withdraw(uint256)','function freeCollateral(address) view returns(uint256)','function createAmortizationOrder(uint128)'];
const coreAbi=['function amortizeWithBlue(uint256)'];
const routerAbi=['function createOrder(uint8,uint128)','function cancelOrder(uint64)','function resumeOrder(uint64)','function claimPending(uint8)'];
const custodyAbi=['function pendingRefund(address,uint8) view returns(uint128)'];
const unsupported=['secureOrder','autoCollateral'];
const capabilities=Object.freeze({deposit:true,withdraw:true,transfer:true,amortize:true,sell:true,buy:true,repayCollateral:true,cancel:true,resume:true,claim:true,secureOrder:false,autoCollateral:false});
const call=(to,abi,method,args,label)=>({to:getAddress(to),data:new Interface(abi).encodeFunctionData(method,args),value:'0',label});

// Produces unsigned calls only. User authorization and runtime isolation must be
// enforced by the caller. Amounts are raw six-decimal token units.
async function buildV6WalletPlan({action,amount,orderId,destination,user,contracts,rpc,ContractClass=Contract}) {
  if(unsupported.includes(action)) throw error('Esta modalidad todavía no está disponible en V6.',409);
  if(!capabilities[action]) throw error('Operación no admitida.',400);
  const who=getAddress(user), plan=[];
  const c=Object.fromEntries(Object.entries(contracts).map(([k,v])=>[k,getAddress(v)]));
  const at=(address,abi)=>new ContractClass(address,abi,rpc);
  const positive=()=>{if(typeof amount!=='bigint'||amount<=0n)throw error('Importe inválido.',400);};
  const approve=async(token,spender)=>{
    positive();const t=at(token,tokenAbi);
    if(await t.balanceOf(who)<amount)throw error('Saldo insuficiente.',409);
    const current=await t.allowance(who,spender);
    if(current<amount){if(current>0n)plan.push(call(token,tokenAbi,'approve',[spender,0n],'Restablecer autorización'));
      plan.push(call(token,tokenAbi,'approve',[spender,amount],'Autorizar importe exacto'));}
  };
  switch(action){
    case 'deposit': await approve(c.USDT,c.CollateralVaultV6);plan.push(call(c.CollateralVaultV6,vaultAbi,'deposit',[amount],'Depositar garantía'));break;
    case 'withdraw': positive();if(await at(c.CollateralVaultV6,vaultAbi).freeCollateral(who)<amount)throw error('Garantía no disponible.',409);plan.push(call(c.CollateralVaultV6,vaultAbi,'withdraw',[amount],'Retirar garantía'));break;
    case 'transfer': positive();if(await at(c.USDT,tokenAbi).balanceOf(who)<amount)throw error('Saldo insuficiente.',409);if(getAddress(destination)==='0x0000000000000000000000000000000000000000')throw error('Destino inválido.',400);plan.push(call(c.USDT,tokenAbi,'transfer',[destination,amount],'Transferir USDT'));break;
    case 'amortize': positive();plan.push(call(c.PaymentEngine,coreAbi,'amortizeWithBlue',[amount],'Amortizar con BLUE'));break;
    case 'repayCollateral': positive();plan.push(call(c.CollateralVaultV6,vaultAbi,'createAmortizationOrder',[amount],'Crear orden con garantía depositada'));break;
    case 'sell': await approve(c.BlueTokenV6,c.ExchangeCustody);plan.push(call(c.ExchangeRouter,routerAbi,'createOrder',[0,amount],'Vender BLUE'));break;
    case 'buy':
      positive();
      // No silent downgrade of the previously approved automatic collateral policy.
      if(await at(c.RedTokenV6,tokenAbi).balanceOf(who)>0n)throw error('Compra con RED pendiente aún no disponible en V6.',409);
      await approve(c.USDT,c.ExchangeCustody);plan.push(call(c.ExchangeRouter,routerAbi,'createOrder',[1,amount],'Comprar BLUE'));break;
    case 'cancel':case 'resume':
      if(!/^\d+$/.test(String(orderId)) || BigInt(orderId)<1n || BigInt(orderId)>(1n<<64n)-1n)throw error('Orden inválida.',400);
      plan.push(call(c.ExchangeRouter,routerAbi,action==='cancel'?'cancelOrder':'resumeOrder',[orderId],action==='cancel'?'Cancelar orden':'Reactivar orden'));break;
    case 'claim': {
      const custody=at(c.ExchangeCustody,custodyAbi);
      for(const asset of [0,1])if(await custody.pendingRefund(who,asset)>0n)plan.push(call(c.ExchangeRouter,routerAbi,'claimPending',[asset],asset===0?'Reclamar BLUE':'Reclamar USDT'));
      if(!plan.length)throw error('No hay devoluciones pendientes.',409);
      break;
    }
  }
  return plan;
}
module.exports={buildV6WalletPlan,capabilities};
