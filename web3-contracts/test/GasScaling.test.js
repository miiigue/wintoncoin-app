const {expect}=require('chai');
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
  console.log(JSON.stringify({positions:1000,maturedCollateralViewGas:(await f.core.getRequiredCollateral.estimateGas(f.alice.address)).toString()}));
 });
});
