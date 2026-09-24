const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');
const { fixture, U } = require('./helpers/suite');

describe('Prórrogas por compromiso y beneficios 3/5', function () {
  let f;
  beforeEach(async () => { f = await loadFixture(fixture); });
  for (const level of [1,2,3,4,5,6]) {
    it(`Nivel ${level}: elegibilidad verificada en contrato`, async () => {
      await f.core.setUserLevel(f.alice.address, level);
      await f.pay(f.alice, f.bob, 100n * U);
      const action = f.extend(f.alice);
      if (level < 3) await expect(action).revertedWith('Protocol: Extension requires level 3');
      else await expect(action).to.emit(f.core, 'CommitmentExtended');
    });
  }
  it('Extender 100 no cobra sobre otros 900 ni cambia su fecha', async () => {
    await f.core.setCommissionBps(0);
    await f.pay(f.alice, f.bob, 100n * U);
    await f.pay(f.alice, f.carol, 900n * U);
    const other = await f.core.userDebtLots(f.alice.address, 1);
    await f.extend(f.alice);
    expect((await f.core.userDebtLots(f.alice.address, 0)).remainingAmount).eq(105n * U);
    expect(await f.core.userDebtLots(f.alice.address, 1)).deep.eq(other);
    expect(await f.red.balanceOf(f.alice.address)).eq(1005n * U);
    expect(await f.red.totalSupply()).eq(await f.blue.totalSupply());
  });
  it('Mantiene el parking de Bob y da parking propio al recargo', async () => {
    await f.pay(f.alice, f.bob, 100n * U);
    const original = await f.blue.parkingLots(f.bob.address, 0);
    await time.increase(10 * 86400);
    await f.extend(f.alice);
    expect(await f.blue.parkingLots(f.bob.address, 0)).deep.eq(original);
    const feeLot = await f.blue.parkingLots(f.treasury.target, 1);
    expect(feeLot.releaseAt).greaterThan(original.releaseAt);
  });
  for (const level of [3,4]) {
    it(`Nivel ${level} sin capacidad necesita amortizar o depositar garantía`, async () => {
      await f.core.setCommissionBps(0); await f.core.setUserLevel(f.alice.address, level);
      await f.core.setCreditLimit(f.alice.address, 100n * U);
      await f.pay(f.alice, f.bob, 100n * U);
      await expect(f.extend(f.alice)).revertedWith('Protocol: Insufficient fee capacity');
      await f.vault.connect(f.alice).deposit(5n * U);
      await f.extend(f.alice);
      expect(await f.red.balanceOf(f.alice.address)).eq(105n * U);
      expect(await f.vault.getFreeCollateral(f.alice.address)).eq(0);
    });
  }
  it('Nivel 5 no concede dinero predeterminado; margen solo para recargos', async () => {
    await f.core.setCommissionBps(0); await f.core.setUserLevel(f.alice.address, 5);
    await f.core.setCreditLimit(f.alice.address, 100n * U);
    await f.pay(f.alice, f.bob, 100n * U);
    await expect(f.extend(f.alice)).revertedWith('Protocol: Extension margin exhausted');
    await f.core.setExtensionMargin(f.alice.address, 5n * U);
    await f.extend(f.alice);
    expect(await f.core.extensionMarginUsed(f.alice.address)).eq(5n * U);
    expect(await f.core.getAvailableCreditCapacity(f.alice.address)).eq(0);
    await expect(f.pay(f.alice, f.bob, 1n)).revertedWith('Protocol: Insufficient credit capacity');
  });
  it('No acumula recargos sobre recargos; máximo dos y reloj real de 15 días', async () => {
    await f.core.setCommissionBps(0); await f.pay(f.alice, f.bob, 100n * U);
    await f.extend(f.alice);
    const record = await f.core.lotExtensions(1);
    await expect(f.extend(f.alice)).revertedWith('Protocol: Extension cooldown active');
    await time.increaseTo(Number(record.firstExtendedAt) + 15 * 86400 - 1);
    await f.extend(f.alice);
    expect((await f.core.userDebtLots(f.alice.address, 0)).remainingAmount).eq(110n * U);
    await expect(f.extend(f.alice)).revertedWith('Protocol: Extension limit reached');
  });
  it('Rechaza cotización vieja, KYC revocado, pausa y solicitudes al vencer', async () => {
    await f.pay(f.alice, f.bob, 100n * U);
    const lot = await f.core.userDebtLots(f.alice.address, 0);
    const quote = await f.core.quoteExtension(f.alice.address, 0, 30);
    await f.core.setExtensionOption(30, 600, true);
    await expect(f.core.connect(f.alice).requestCommitmentExtension(0,30,quote.fee,lot.dueAt,f.treasury.target,lot.dueAt)).revertedWith('Protocol: Extension quote changed');
    await f.core.setKYCStatus(f.alice.address, false);
    await expect(f.extend(f.alice)).revertedWith('Protocol: KYC not verified');
    await f.core.setKYCStatus(f.alice.address, true); await f.core.pause();
    await expect(f.extend(f.alice)).revertedWithCustomError(f.core, 'EnforcedPause');
    await f.core.unpause(); await time.increaseTo(lot.dueAt);
    await expect(f.extend(f.alice)).revertedWith('Protocol: Overdue commitments');
  });
  it('Nueva fecha cambia el orden de amortización sin perder el compromiso antiguo', async () => {
    await f.core.setCommissionBps(0);
    await f.pay(f.alice,f.bob,100n*U); await f.pay(f.alice,f.bob,50n*U);
    await f.extend(f.alice,0,60);
    await f.pay(f.carol,f.alice,50n*U);
    await f.core.connect(f.alice).amortizeWithBlue(50n*U);
    expect((await f.core.userDebtLots(f.alice.address,1)).repaid).eq(true);
    expect((await f.core.userDebtLots(f.alice.address,0)).remainingAmount).eq(110n*U);
  });
  it('La amortización libera solo el margen del recargo efectivamente pagado', async () => {
    await f.core.setCommissionBps(0); await f.core.setCreditLimit(f.alice.address,100n*U);
    await f.core.setUserLevel(f.alice.address,5); await f.core.setExtensionMargin(f.alice.address,5n*U);
    await f.pay(f.alice,f.bob,100n*U); await f.extend(f.alice);
    await f.pay(f.carol,f.alice,2n*U); await f.core.connect(f.alice).amortizeWithBlue(2n*U);
    expect(await f.core.extensionMarginUsed(f.alice.address)).eq(3n*U);
    expect(await f.core.getAvailableCreditCapacity(f.alice.address)).eq(0);
  });
  it('Comisión cero válida y seis decimales exactos', async () => {
    await f.core.setCommissionBps(0); await f.pay(f.alice,f.bob,1n*U);
    expect((await f.core.quoteExtension(f.alice.address,0,15)).fee).eq(25000n);
    await f.core.setExtensionOption(15,0,true);
    await f.extend(f.alice,0,15);
    expect(await f.red.balanceOf(f.alice.address)).eq(U);
  });
});
