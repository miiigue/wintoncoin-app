const {expect}=require('chai');
const {ethers}=require('hardhat');
const {loadFixture,time}=require('@nomicfoundation/hardhat-network-helpers');
const {fixture,U}=require('./helpers/suite');
describe('Regresiones revisión ANTIGRAVITY049',()=>{
 let f;beforeEach(async()=>{f=await loadFixture(fixture);await f.core.setCommissionBps(0);});
 it('Una orden omitida debe quedar suspendida y poder regresar al final con KYC restablecido',async()=>{
  await f.pay(f.alice,f.bob,10n*U);await f.pay(f.alice,f.carol,10n*U);await time.increase(30*86400);
  await f.exchange.connect(f.bob).createBlueOrder(10n*U);const id=await f.exchange.nextOrderId()-1n;
  await f.exchange.connect(f.carol).createBlueOrder(10n*U);await f.exchange.connect(f.other).createUsdtOrder(10n*U);
  await f.core.setKYCStatus(f.bob.address,false);await f.exchange.matchOrders(10,30);
  expect((await f.exchange.orders(id)).status).eq(5n);
  await f.core.setKYCStatus(f.bob.address,true);await f.exchange.connect(f.bob).resumeOrder(id);
  await f.exchange.connect(f.other).createUsdtOrder(10n*U);await f.exchange.matchOrders(10,30);
  expect((await f.exchange.orders(id)).status).eq(3n);expect(await f.exchange.totalReservedBlue()).eq(0);
 });
 it('Cancelar con KYC suspendido conserva USDT en custodia hasta recuperar KYC',async()=>{
  await f.exchange.connect(f.alice).createUsdtOrder(10n*U);const id=await f.exchange.nextOrderId()-1n;
  await f.core.setKYCStatus(f.alice.address,false);const wallet=await f.usdt.balanceOf(f.alice.address);
  await f.exchange.connect(f.alice).cancelOrder(id);
  expect(await f.usdt.balanceOf(f.alice.address)).eq(wallet);
  expect(await f.exchange.pendingRefundUsdt(f.alice.address)).eq(10n*U);
  await f.core.setKYCStatus(f.alice.address,true);await f.exchange.connect(f.alice).claimPendingRefunds();
  expect(await f.usdt.balanceOf(f.alice.address)).eq(wallet+10n*U);
 });
 it('Una compra sin cobertura de comisión no bloquea al siguiente comprador',async()=>{
  await f.core.setCreditLimit(f.alice.address,100n*U);await f.vault.connect(f.alice).deposit(100n*U);
  await f.pay(f.alice,f.bob,200n*U);await f.exchange.proposeFeeUpdate(100);await time.increase(48*3600);await f.exchange.executeFeeUpdate();await time.increase(30*86400);
  await f.vault.connect(f.alice).repayWithCollateral(f.alice.address,100n*U);const id=await f.vault.activeAmortizationOrder(f.alice.address);
  await f.exchange.connect(f.other).createUsdtOrder(10n*U);await f.exchange.connect(f.bob).createBlueOrder(110n*U);
  await f.exchange.matchOrders(10,30);
  expect((await f.exchange.orders(id)).status).eq(5n);expect(await f.blue.balanceOf(f.other.address)).eq(9_900_000n);
  expect(await f.vault.userCollateral(f.alice.address)).eq(100n*U);
 });
 it('Consulta hasta importe devuelve cantidad acotada y cero pide cero',async()=>{
  await f.pay(f.alice,f.bob,100n*U);await time.increase(30*86400);
  expect(await f.core.getMaturedDebtUpTo(f.alice.address,U)).eq(U);
  expect(await f.core.getMaturedDebtUpTo(f.alice.address,0)).eq(0);
 });
});

describe('Custodia y reanudación: revisión068',()=>{
 let f;beforeEach(async()=>{f=await loadFixture(fixture);await f.core.setCommissionBps(0);});
 async function sell(){await f.pay(f.alice,f.bob,100n*U);await time.increase(30*86400);await f.exchange.connect(f.bob).createBlueOrder(100n*U);return await f.exchange.nextOrderId()-1n;}
 async function invariant(){
  expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  expect(await f.blue.balanceOf(f.exchange.target)).eq(await f.exchange.totalReservedBlue()+await f.exchange.accumulatedFeesBlue()+await f.exchange.totalPendingRefundBlue());
  expect(await f.usdt.balanceOf(f.exchange.target)).eq(await f.exchange.totalReservedUsdt()+await f.exchange.accumulatedFeesUsdt()+await f.exchange.totalPendingRefundUsdt());
 }
 it('Cancelar BLUE con KYC suspendido mantiene custodia y reclamar no puede repetirse',async()=>{
  const id=await sell();await f.core.setKYCStatus(f.bob.address,false);await f.exchange.connect(f.bob).cancelOrder(id);await invariant();
  expect(await f.exchange.pendingRefundBlue(f.bob.address)).eq(100n*U);
  await expect(f.exchange.connect(f.bob).claimPendingRefunds()).revertedWith('Exchange: KYC not verified');
  await f.core.setKYCStatus(f.bob.address,true);await f.exchange.connect(f.bob).claimPendingRefunds();
  await expect(f.exchange.connect(f.bob).claimPendingRefunds()).revertedWith('Exchange: No pending refund');await invariant();
 });
 it('Pausa de Core retiene BLUE pendiente pero permite retirar USDT independiente',async()=>{
  const blueId=await sell();await f.exchange.connect(f.bob).createUsdtOrder(10n*U);const usdtId=await f.exchange.nextOrderId()-1n;
  await f.core.setKYCStatus(f.bob.address,false);await f.exchange.connect(f.bob).cancelOrder(blueId);await f.exchange.connect(f.bob).cancelOrder(usdtId);
  await f.core.pause();await f.core.setKYCStatus(f.bob.address,true);const wallet=await f.usdt.balanceOf(f.bob.address);await f.exchange.connect(f.bob).claimPendingRefunds();
  expect(await f.usdt.balanceOf(f.bob.address)).eq(wallet+10n*U);expect(await f.exchange.pendingRefundBlue(f.bob.address)).eq(100n*U);await invariant();
  await f.core.unpause();await f.exchange.connect(f.bob).claimPendingRefunds();expect(await f.exchange.pendingRefundBlue(f.bob.address)).eq(0);await invariant();
 });
 it('BLUE devuelto cancela vencidos contraídos después de entrar en custodia',async()=>{
  const id=await sell();await f.pay(f.bob,f.carol,40n*U);await time.increase(30*86400);await f.exchange.connect(f.bob).cancelOrder(id);
  expect(await f.red.balanceOf(f.bob.address)).eq(0);expect(await f.blue.balanceOf(f.bob.address)).eq(60n*U);await invariant();
 });
 it('Core pausado permite cancelar venta: BLUE queda custodiado hasta poder amortizar',async()=>{
  const id=await sell();await f.pay(f.bob,f.carol,40n*U);await time.increase(30*86400);await f.core.pause();await f.exchange.connect(f.bob).cancelOrder(id);
  expect(await f.exchange.pendingRefundBlue(f.bob.address)).eq(100n*U);await invariant();
  await expect(f.exchange.connect(f.bob).claimPendingRefunds()).revertedWith('Exchange: BLUE refund awaits Core');expect(await f.exchange.pendingRefundBlue(f.bob.address)).eq(100n*U);
  await f.core.unpause();await f.exchange.connect(f.bob).claimPendingRefunds();expect(await f.red.balanceOf(f.bob.address)).eq(0);expect(await f.blue.balanceOf(f.bob.address)).eq(60n*U);await invariant();
 });
 it('Cancelar compra garantizada sin KYC retorna al Vault, nunca a billetera',async()=>{
  await f.core.setCreditLimit(f.alice.address,100n*U);await f.vault.connect(f.alice).deposit(100n*U);await f.pay(f.alice,f.bob,200n*U);await f.vault.connect(f.alice).repayWithCollateral(f.alice.address,100n*U);
  const id=await f.vault.activeAmortizationOrder(f.alice.address),wallet=await f.usdt.balanceOf(f.alice.address);await f.core.setKYCStatus(f.alice.address,false);await f.exchange.connect(f.alice).cancelOrder(id);
  expect(await f.usdt.balanceOf(f.alice.address)).eq(wallet);expect(await f.vault.userCollateral(f.alice.address)).eq(100n*U);expect(await f.vault.getFreeCollateral(f.alice.address)).eq(0);await invariant();
 });
 it('Reanudar no adelanta a una orden válida y no duplica depósito ni prioridad',async()=>{
  const id=await sell();await f.pay(f.carol,f.other,100n*U);await time.increase(30*86400);await f.exchange.connect(f.other).createBlueOrder(100n*U);const next=await f.exchange.nextOrderId()-1n;
  await f.exchange.connect(f.carol).createUsdtOrder(10n*U);await f.core.setKYCStatus(f.bob.address,false);await f.exchange.matchOrders(1,30);
  await f.core.setKYCStatus(f.bob.address,true);await f.exchange.connect(f.bob).resumeOrder(id);
  await expect(f.exchange.connect(f.bob).resumeOrder(id)).revertedWith('Exchange: Order not suspended');
  await f.exchange.connect(f.carol).createUsdtOrder(100n*U);await f.exchange.matchOrders(10,30);
  expect((await f.exchange.orders(next)).status).eq(3);expect((await f.exchange.orders(id)).remainingAmount).eq(90n*U);expect(await f.exchange.totalDepositedBlue()).eq(200n*U);await invariant();
 });
 it('Nadie puede invocar liquidación interna para eludir FIFO',async()=>{
  await expect(f.exchange.connect(f.other).executeMatch(1,2,U)).revertedWith('Exchange: Only self');
 });
});

describe('Reservas retenidas y comisiones separadas',()=>{
 let f;beforeEach(async()=>{f=await loadFixture(fixture);await f.core.setCommissionBps(0);});
 it('Comisiones cobrables no incluyen las devoluciones pendientes y exigen KYC institucional',async()=>{
  await f.pay(f.alice,f.bob,100n*U);await f.exchange.proposeFeeUpdate(100);await time.increase(30*86400); // propuesta caduca: renovar
  await f.exchange.cancelFeeProposal();await f.exchange.proposeFeeUpdate(100);await time.increase(48*3600);await f.exchange.executeFeeUpdate();
  await f.exchange.connect(f.bob).createBlueOrder(100n*U);await f.exchange.connect(f.other).createUsdtOrder(100n*U);await f.exchange.matchOrders(10,20);
  await f.exchange.connect(f.carol).createUsdtOrder(20n*U);const id=await f.exchange.nextOrderId()-1n;await f.core.setKYCStatus(f.carol.address,false);await f.exchange.connect(f.carol).cancelOrder(id);
  expect((await f.exchange.freeSurplus(false)).surplus).eq(0);
  await f.core.setKYCStatus(f.treasury.target,false);await expect(f.exchange.claimFees()).revertedWith('Exchange: KYC not verified');
  await f.core.setKYCStatus(f.treasury.target,true);await f.exchange.claimFees();
  expect(await f.usdt.balanceOf(f.exchange.target)).eq(20n*U);expect(await f.exchange.pendingRefundUsdt(f.carol.address)).eq(20n*U);
 });
 it('Repetir suspensión/reanudación permite cancelar sin perder saldos ni duplicar reservas',async()=>{
  await f.pay(f.alice,f.bob,10n*U);await time.increase(30*86400);await f.exchange.connect(f.bob).createBlueOrder(10n*U);const id=await f.exchange.nextOrderId()-1n;
  await f.exchange.connect(f.other).createUsdtOrder(10n*U);
  for(let i=0;i<3;i++){await f.core.setKYCStatus(f.bob.address,false);await f.exchange.matchOrders(10,30);expect((await f.exchange.orders(id)).status).eq(5);
   await f.core.setKYCStatus(f.bob.address,true);await f.exchange.connect(f.bob).resumeOrder(id);}
  await f.exchange.connect(f.bob).cancelOrder(id);expect(await f.blue.balanceOf(f.bob.address)).eq(10n*U);expect(await f.exchange.totalReservedBlue()).eq(0);
  await f.exchange.matchOrders(10,30);expect(await f.exchange.totalReservedUsdt()).eq(10n*U);
 });
});
