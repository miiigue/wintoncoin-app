const {expect}=require('chai');const {ethers}=require('hardhat');
describe('Parking: comparación con historial individual independiente',function(){
 this.timeout(240000);
 for(const seed of [18,921])it('fechas desordenadas, vaciado y reutilización: semilla '+seed,async()=>{
  const t=await(await ethers.getContractFactory('ParkingLedgerHarness')).deploy(),lots=[];let rng=seed;
  const random=n=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng%n;};
  for(let step=0;step<700;step++){
   const mode=lots.length?random(10):0;
   if(mode<6){const lot={amount:BigInt(random(100)),release:random(100)};lots.push(lot);await t.append(lot.amount,lot.release);}
   else if(mode===6){const index=random(lots.length);lots[index].amount=0n;await t.erase(index);}
   else{
    const original=BigInt(random(500)),timestamp=random(100),matured=mode===7;let remaining=original;
    for(const lot of lots)if(!matured||lot.release<=timestamp){const used=remaining<lot.amount?remaining:lot.amount;lot.amount-=used;remaining-=used;if(!remaining)break;}
    expect(await t.consume.staticCall(original,matured,timestamp)).eq(original-remaining);await t.consume(original,matured,timestamp);
   }
   expect(await t.total()).eq(lots.reduce((s,x)=>s+x.amount,0n));let first=lots.findIndex(x=>x.amount>0n);expect(await t.first()).eq(first<0?lots.length:first);
   const now=random(100);expect(await t.locked(now)).eq(lots.filter(x=>x.release>now).reduce((s,x)=>s+x.amount,0n));
   if(step%19===0||step===699)for(let i=0;i<lots.length;i++)expect(await t.balance(i)).eq(lots[i].amount);
  }
 });
 it('mide mil fechas alternadas y una venta parcial sin liberar las otras',async()=>{
  const t=await(await ethers.getContractFactory('ParkingLedgerHarness')).deploy();
  for(let i=0;i<1000;i++)await t.append(100,i%2?100:10);
  expect(await t.locked(50)).eq(50000);const read=await t.locked.estimateGas(50);
  const receipt=await(await t.consume(49900,true,50,{gasLimit:16_000_000})).wait();
  expect(await t.total()).eq(50100);expect(await t.locked(50)).eq(50000);
  console.log(JSON.stringify({fragmentedParking:1000,lockedReadGas:read.toString(),partialSaleGas:receipt.gasUsed.toString()}));
  expect(read).lessThan(5_000_000n);expect(receipt.gasUsed).lessThan(6_000_000n);
 });
});
