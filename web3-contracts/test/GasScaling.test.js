const {expect}=require('chai');const {ethers}=require('hardhat');
const {fixture,U}=require('./helpers/suite');
const {time}=require('@nomicfoundation/hardhat-network-helpers');
describe('Medición local de crecimiento por posiciones activas',function(){
 this.timeout(240000);
 it('los contratos optimizados caben en el límite configurado para desplegar',async()=>{
  const f=await fixture();
  for(const [name,c] of [['CoreProtocol',f.core],['BlueToken',f.blue]]){
   const gas=(await c.deploymentTransaction().wait()).gasUsed;expect(gas).lessThan(5_000_000n);
   expect(((await ethers.provider.getCode(c.target)).length-2)/2).lessThan(24577);
   console.log(JSON.stringify({contract:name,deploymentGas:gas.toString()}));
  }
 });
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
  const sale=await(await f.exchange.connect(f.bob).createBlueOrder(996n*U)).wait();
  await f.exchange.connect(f.alice).createUsdtOrder(996n*U);
  // This used to exhaust 16M gas. Require the actual fill and paired burn.
  const beforeDebt=await f.red.balanceOf(f.alice.address);
  const receipt=await(await f.exchange.matchOrders(1,2,{gasLimit:8_000_000})).wait();
  console.log(JSON.stringify({positions:1000,saleGas:sale.gasUsed.toString(),fullSettlementGas:receipt.gasUsed.toString()}));
  expect(await f.red.balanceOf(f.alice.address)).eq(beforeDebt-996n*U);
  expect(await f.exchange.totalReservedUsdt()).eq(0n);
  expect(sale.gasUsed).lessThan(1_000_000n);
  expect(receipt.gasUsed).lessThan(8_000_000n);
  for(const index of [0,9,99,999])expect((await f.core.userDebtLots(f.alice.address,index)).remainingAmount).eq(1050000n);
  for(const index of [1,8,98,998])expect((await f.core.userDebtLots(f.alice.address,index)).remainingAmount).eq(0n);
  expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
 });
 it('amortiza con mil ingresos BLUE aún en parking sin cambiar sus fechas',async()=>{
  const f=await fixture();await f.core.setCommissionBps(0);
  await f.pay(f.alice,f.bob,1000n*U);
  await f.core.setCommitmentDuration(60*86400);
  for(let i=0;i<1000;i++)await f.pay(f.carol,f.alice,U);
  await time.increase(31*86400);
  expect(await f.blue.lockedBalanceOf(f.alice.address)).eq(1000n*U);
  const estimate=await f.core.settleMatured.estimateGas(f.alice.address);
  const receipt=await(await f.core.settleMatured(f.alice.address,{gasLimit:8_000_000})).wait();
  console.log(JSON.stringify({parkingLots:1000,settlementEstimate:estimate.toString(),settlementGas:receipt.gasUsed.toString()}));
  expect(await f.red.balanceOf(f.alice.address)).eq(0);expect(await f.blue.balanceOf(f.alice.address)).eq(0);
  expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  expect(estimate*125n/100n).lessThan(8_000_000n);
 });
 it('vende desde mil fechas alternadas respetando los BLUE no liberados y el margen de gas del servidor',async()=>{
  const f=await fixture();await f.core.setCommissionBps(0);
  for(let i=0;i<1000;i++){await f.core.setCommitmentDuration((i%2?60:15)*86400);await f.pay(f.carol,f.bob,U);}
  await time.increase(16*86400);expect(await f.blue.lockedBalanceOf(f.bob.address)).eq(500n*U);
  const estimate=await f.exchange.connect(f.bob).createBlueOrder.estimateGas(499n*U);
  const receipt=await(await f.exchange.connect(f.bob).createBlueOrder(499n*U,{gasLimit:8_000_000})).wait();
  expect(await f.blue.lockedBalanceOf(f.bob.address)).eq(500n*U);expect(await f.blue.availableBalanceOf(f.bob.address)).eq(U);
  expect(estimate*125n/100n).lessThan(8_000_000n);expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  console.log(JSON.stringify({fragmentedParking:1000,saleEstimate:estimate.toString(),saleGas:receipt.gasUsed.toString()}));
 });
});
