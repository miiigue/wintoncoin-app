const {expect}=require('chai');const {ethers}=require('hardhat');
const {fixture,U}=require('./helpers/suite');
const {time}=require('@nomicfoundation/hardhat-network-helpers');
describe('Medición local de crecimiento por posiciones activas',function(){
 this.timeout(240000);
 it('Mide 1/10/100/1000 posiciones; no estima precios en dólares',async()=>{
  const f=await fixture();await f.core.setCommissionBps(0);let created=0;
  for(const count of [1,10,100,1000]){
   let receipt;
   while(created<count){receipt=await (await f.pay(f.alice,f.bob,U)).wait();created++;}
   const viewGas=await f.core.getRequiredCollateral.estimateGas(f.alice.address);
   const tx=await (await f.extend(f.alice,count-1,30)).wait();
   console.log(JSON.stringify({positions:count,paymentGas:receipt.gasUsed.toString(),collateralViewGas:viewGas.toString(),extensionGas:tx.gasUsed.toString()}));
   expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  }
  await time.increase(31*86400);
  console.log(JSON.stringify({positions:1000,maturedCollateralViewGas:(await f.core.getRequiredCollateral.estimateGas(f.alice.address)).toString(), cappedMaturedViewGas:(await f.core.getMaturedDebtUpTo.estimateGas(f.alice.address,U)).toString()}));
  await f.exchange.connect(f.bob).createBlueOrder(996n*U);
  await f.exchange.connect(f.alice).createUsdtOrder(996n*U);
  // Explicit regression documenting the remaining full-settlement gas blocker.
  const beforeDebt=await f.red.balanceOf(f.alice.address);
  let failure;
  try {await f.exchange.matchOrders(1,2,{gasLimit:16_000_000});}catch(e){failure=e;}
  expect(failure, 'The large settlement must reproduce the gas limit blocker').not.eq(undefined);
  console.log(JSON.stringify({largeSettlementFailure:failure.message.split('\n')[0]}));
  const trace=await ethers.provider.send('debug_traceTransaction',[failure.transactionHash,{disableMemory:true,disableStack:true,disableStorage:true}]);
  const lastAtDepth={};for(const x of trace.structLogs)lastAtDepth[x.depth]=x;
  const halted=Object.values(lastAtDepth).filter(x=>!['RETURN','STOP','REVERT'].includes(x.op));
  console.log(JSON.stringify({gasBudget:16_000_000,failed:trace.failed,halted}));
  expect(trace.failed).eq(true);
  expect(halted.some(x=>x.gas===x.gasCost && x.gas<5000)).eq(true);
  expect(await f.red.balanceOf(f.alice.address)).eq(beforeDebt);
  expect(await f.exchange.totalReservedUsdt()).eq(996n*U);
  expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
 });
});
