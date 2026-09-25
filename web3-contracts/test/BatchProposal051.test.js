const {expect}=require('chai');const {fixture,U}=require('./helpers/suite');const {time,takeSnapshot}=require('@nomicfoundation/hardhat-network-helpers');
describe('Evaluación de la propuesta ANTIGRAVITY051',function(){this.timeout(240000);
 it('Dos pagos del mismo día no tienen el mismo vencimiento exacto',async()=>{const f=await fixture();await f.core.setCommissionBps(0);await time.setNextBlockTimestamp(Math.ceil((await time.latest())/86400)*86400+3600);await f.pay(f.alice,f.bob,U);await time.increase(3600);await f.pay(f.alice,f.bob,U);const a=await f.core.userDebtLots(f.alice.address,0),b=await f.core.userDebtLots(f.alice.address,1);expect(a.dueAt/86400n).eq(b.dueAt/86400n);expect(b.dueAt).greaterThan(a.dueAt);});
 it('Medir operaciones de1/5/10/30 con historiales idénticos de30/1000 compromisos',async()=>{
  for(const size of [30,1000]){const f=await fixture();await f.core.setCommissionBps(0);for(let i=0;i<size;i++)await f.pay(f.alice,f.bob,U);await time.increase(30*86400);
   for(const count of (size===30?[30]:[1,5,10,30])){
    const snapshot=await takeSnapshot();const value=BigInt(count)*U;
    const sale=await(await f.exchange.connect(f.bob).createBlueOrder(value)).wait();const buy=await(await f.exchange.connect(f.alice).createUsdtOrder(value)).wait();const before=await f.red.balanceOf(f.alice.address);
    const receipt=await(await f.exchange.matchOrders(1,2,{gasLimit:16_000_000})).wait();console.log(JSON.stringify({historyLots:size,amortizedLots:count,saleGas:sale.gasUsed.toString(),buyGas:buy.gasUsed.toString(),matchGas:receipt.gasUsed.toString(),totalGas:(sale.gasUsed+buy.gasUsed+receipt.gasUsed).toString()}));
    expect(await f.red.balanceOf(f.alice.address)).eq(before-value);expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());await snapshot.restore();
   }
  }
 });
});
