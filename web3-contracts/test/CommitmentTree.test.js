const {expect}=require('chai');
const {ethers}=require('hardhat');
describe('Ledger ordenado: modelo independiente y estructura AVL',function(){
 this.timeout(240000);
 for(const seed of [7,29,9281])it('inserciones, prórrogas, amortización parcial y por grupos; semilla '+seed,async()=>{
  const t=await(await ethers.getContractFactory('CommitmentTreeHarness')).deploy();
  const lots=new Map();let next=1,rng=seed;
  const random=n=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng%n;};
  const active=()=>[...lots.values()].filter(x=>x.amount>0n);
  for(let step=0;step<600;step++){
   let live=active(),mode=live.length?random(10):0;
   if(mode<5){
    const lot={id:next++,due:random(50),amount:BigInt(1+random(1000)),fee:0n,margin:0n};
    lot.fee=BigInt(random(Number(lot.amount)+1));lot.margin=BigInt(random(Number(lot.fee)+1));lots.set(lot.id,lot);
    await t.insert(lot.id,lot.due,lot.amount,lot.fee,lot.margin);
   }else if(mode<7){
    const lot=live[random(live.length)],fee=BigInt(random(100));lot.due+=1+random(70);lot.amount+=fee;lot.fee+=fee;lot.margin+=BigInt(random(Number(fee)+1));
    await t.move(lot.id,lot.due,lot.amount,lot.fee,lot.margin);
   }else{
    const total=live.reduce((s,x)=>s+x.amount,0n);let amount=mode===9?total:BigInt(random(Number(total)+1));const original=amount;let margin=0n;
    live.sort((a,b)=>a.due-b.due||a.id-b.id);
    for(const lot of live){const paid=amount<lot.amount?amount:lot.amount,fee=paid<lot.fee?paid:lot.fee,m=fee<lot.margin?fee:lot.margin;lot.amount-=paid;lot.fee-=fee;lot.margin-=m;margin+=m;amount-=paid;if(!amount)break;}
    expect(await t.consume.staticCall(original)).eq(margin);await t.consume(original);
   }
   live=active();const structure=await t.check();expect(structure.sum).eq(live.reduce((s,x)=>s+x.amount,0n));expect(structure.margin).eq(live.reduce((s,x)=>s+x.margin,0n));
   expect(await t.firstId()).eq(live.length?Math.min(...live.map(x=>x.id)):0);
   const due=random(130);expect(await t.matured(due)).eq(live.filter(x=>x.due<=due).reduce((s,x)=>s+x.amount,0n));
   if(step%17===0 || step===599)for(const lot of lots.values())expect([...(await t.balances(lot.id))]).deep.eq([lot.amount,lot.fee,lot.margin]);
  }
 });
 it('poda casi todo un árbol alto y conserva los últimos lotes sin revivir historia',async()=>{
  const t=await(await ethers.getContractFactory('CommitmentTreeHarness')).deploy();
  for(let i=1;i<=255;i++)await t.insert(i,i,10,3,2);
  await t.consume(2501);expect((await t.check()).sum).eq(49);expect(await t.firstId()).eq(251);
  expect([...(await t.balances(251))]).deep.eq([9n,2n,1n]);expect([...(await t.balances(128))]).deep.eq([0n,0n,0n]);
  await t.move(251,1000,12,5,2);await t.check();await t.consume(40);expect((await t.check()).sum).eq(12);expect(await t.matured(999)).eq(0);
  await t.consume(12);await t.check();await t.insert(256,1,20,2,0);await t.check();expect(await t.firstId()).eq(256);
 });
});
