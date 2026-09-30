const {expect}=require('chai');const {ethers}=require('hardhat');
const {fixture,U}=require('./helpers/suite');const {time}=require('@nomicfoundation/hardhat-network-helpers');
describe('Parking: limpieza de historial liberado sin adelantar vencimientos',()=>{
 it('vender parcialmente tras liberación conserva el resto y nuevos ingresos siguen bloqueados',async()=>{
  const f=await fixture();await f.core.setCommissionBps(0);await f.pay(f.alice,f.bob,100n*U);
  await time.increase(31*86400);await f.exchange.connect(f.bob).createBlueOrder(40n*U);
  expect(await f.blue.balanceOf(f.bob.address)).eq(60n*U);expect(await f.blue.availableBalanceOf(f.bob.address)).eq(60n*U);
  expect((await f.blue.parkingLots(f.bob.address,0)).remaining).eq(60n*U);
  await f.pay(f.carol,f.bob,30n*U);expect(await f.blue.lockedBalanceOf(f.bob.address)).eq(30n*U);
  await expect(f.exchange.connect(f.bob).createBlueOrder(61n*U)).revertedWith('BLUE: Parking not released');
  await f.exchange.connect(f.bob).cancelOrder(1);expect(await f.blue.balanceOf(f.bob.address)).eq(130n*U);
  expect(await f.blue.availableBalanceOf(f.bob.address)).eq(100n*U);expect(await f.blue.lockedBalanceOf(f.bob.address)).eq(30n*U);
  expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
 });
 it('un plazo nuevo más corto no libera un pago previo de plazo largo',async()=>{
  const f=await fixture();await f.core.setCommissionBps(0);await f.core.setCommitmentDuration(60*86400);await f.pay(f.alice,f.bob,10n*U);
  await f.core.setCommitmentDuration(15*86400);await f.pay(f.carol,f.bob,20n*U);await time.increase(16*86400);
  expect(await f.blue.lockedBalanceOf(f.bob.address)).eq(10n*U);await f.exchange.connect(f.bob).createBlueOrder(20n*U);
  expect(await f.blue.parkingHead(f.bob.address)).eq(0);await expect(f.exchange.connect(f.bob).createBlueOrder(U)).revertedWith('BLUE: Parking not released');
  await time.increase(45*86400);await f.exchange.connect(f.bob).createBlueOrder(10n*U);expect(await f.blue.balanceOf(f.bob.address)).eq(0);
 });
});
