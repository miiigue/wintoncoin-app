'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {Interface}=require('ethers');
const {buildV6WalletPlan,capabilities}=require('../src/services/v6WalletPlan');
const c=Object.fromEntries(['USDT','CollateralVaultV6','PaymentEngine','BlueTokenV6','RedTokenV6','ExchangeCustody','ExchangeRouter','ExchangeConfig'].map((n,i)=>[n,'0x'+String(i+1).padStart(40,'0')]));
const user='0x'+'9'.repeat(40);
const abi=new Interface(['function approve(address,uint256)','function deposit(uint256)','function withdraw(uint256)','function amortizeWithBlue(uint256)','function createAmortizationOrder(uint128)','function depositAndCreateAmortizationOrder(uint128)','function collateralizeExisting(uint64,uint128)','function setAutomaticExchangeCollateral(bool)','function createOrder(uint8,uint128)','function cancelOrder(uint64)','function resumeOrder(uint64)','function claimPending(uint8)']);
function setup(){const state={red:0n,pending:[0n,0n],allowance:0n,feeBps:0n,reserved:0n,balance:1000n};class C{constructor(addr){this.addr=addr;}async balanceOf(){return this.addr===c.RedTokenV6?state.red:state.balance;}async allowance(){return state.allowance;}async freeCollateral(){return 1000n;}async pendingRefund(_user,asset){return state.pending[asset];}async feeBps(){return state.feeBps;}async exchangeReserved(){return state.reserved;}}const run=(action,extra={})=>buildV6WalletPlan({action,amount:10n,orderId:'7',user,contracts:c,rpc:{},ContractClass:C,...extra});return {state,run};}
test('depósito autoriza bóveda y llama deposit',async()=>{const {run}=setup(),p=await run('deposit');assert.equal(p[0].to,c.USDT);assert.equal(abi.parseTransaction({data:p[0].data}).args[0],c.CollateralVaultV6);assert.equal(p[1].to,c.CollateralVaultV6);assert.equal(abi.parseTransaction({data:p[1].data}).name,'deposit');});
for(const [action,side] of [['sell',0n],['buy',1n]])test(action+' autoriza custodia y envía al router con lado correcto',async()=>{const {run}=setup(),p=await run(action);assert.equal(abi.parseTransaction({data:p[0].data}).args[0],c.ExchangeCustody);assert.equal(p[1].to,c.ExchangeRouter);assert.equal(abi.parseTransaction({data:p[1].data}).args[0],side);});
for(const [action,method,target] of [['withdraw','withdraw','CollateralVaultV6'],['amortize','amortizeWithBlue','PaymentEngine'],['repayCollateral','createAmortizationOrder','CollateralVaultV6'],['cancel','cancelOrder','ExchangeRouter'],['resume','resumeOrder','ExchangeRouter']])test(action+' usa destino y selector V6',async()=>{const {run}=setup(),p=await run(action);assert.equal(p[0].to,c[target]);assert.equal(abi.parseTransaction({data:p[0].data}).name,method);});
test('claim prepara únicamente activos con devolución',async()=>{const {state,run}=setup();state.pending=[0n,4n];const p=await run('claim');assert.equal(p.length,1);assert.equal(abi.parseTransaction({data:p[0].data}).args[0],1n);});
test('compra con compromiso RED divide entre depósito garantizado y compra ordinaria según feeBps y reserva',async()=>{
  const {state,run}=setup();state.red=99n;state.feeBps=100n;state.reserved=50n;
  // presupuesto neto: 99 * 10000 / 9900 = 100; ya reservado 50 => falta 50 => split(80) = 50 secured + 30 ordinary
  const p=await run('buy',{amount:80n});
  assert.equal(p.length,4);
  assert.equal(abi.parseTransaction({data:p[0].data}).args[0],c.CollateralVaultV6);
  assert.equal(abi.parseTransaction({data:p[0].data}).args[1],50n);
  assert.equal(p[1].to,c.CollateralVaultV6);
  assert.equal(abi.parseTransaction({data:p[1].data}).name,'depositAndCreateAmortizationOrder');
  assert.equal(abi.parseTransaction({data:p[1].data}).args[0],50n);
  assert.equal(abi.parseTransaction({data:p[2].data}).args[0],c.ExchangeCustody);
  assert.equal(abi.parseTransaction({data:p[2].data}).args[1],30n);
  assert.equal(p[3].to,c.ExchangeRouter);
  assert.equal(abi.parseTransaction({data:p[3].data}).name,'createOrder');
  assert.deepEqual([...abi.parseTransaction({data:p[3].data}).args],[1n,30n]);
});
test('compra con compromiso RED falla cerrado si falta ExchangeConfig',async()=>{
  const {state,run}=setup();state.red=5n;
  const incomplete={...c};delete incomplete.ExchangeConfig;
  await assert.rejects(run('buy',{contracts:incomplete}),/Configuración de Exchange/);
});
test('compra dividida rechaza antes de firmar si el sobrante ordinario queda entre 0.000001 y 0.999999 USDT',async()=>{
  const {state,run}=setup();
  state.balance=20_000_000n;state.red=10_000_000n;state.feeBps=100n;
  // 10 RED al 1% requiere 10_101_010 USDT; al comprar 11_000_000 USDT el sobrante ordinario es 898_990 (< 1_000_000)
  await assert.rejects(run('buy',{amount:11_000_000n}),/al menos 1\.000000 USDT/);
});
test('capacidades reales habilitan secureOrder y autoCollateral en V6 y codifican CollateralVaultV6',async()=>{
  const {run}=setup();
  assert.equal(capabilities.secureOrder,true);
  assert.equal(capabilities.autoCollateral,true);
  const pSecure=await run('secureOrder',{orderId:'12',amount:25n});
  assert.equal(pSecure.length,1);
  assert.equal(pSecure[0].to,c.CollateralVaultV6);
  assert.equal(abi.parseTransaction({data:pSecure[0].data}).name,'collateralizeExisting');
  assert.deepEqual([...abi.parseTransaction({data:pSecure[0].data}).args],[12n,25n]);
  const pAuto=await run('autoCollateral',{enabled:true});
  assert.equal(pAuto.length,1);
  assert.equal(pAuto[0].to,c.CollateralVaultV6);
  assert.equal(abi.parseTransaction({data:pAuto[0].data}).name,'setAutomaticExchangeCollateral');
  assert.deepEqual([...abi.parseTransaction({data:pAuto[0].data}).args],[true]);
  await assert.rejects(run('autoCollateral',{enabled:'yes'}),/Valor inválido/);
});
