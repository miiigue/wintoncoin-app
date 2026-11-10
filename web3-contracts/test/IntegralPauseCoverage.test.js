const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');
const { fixture, U } = require('./helpers/suite');

const NORMAL = 0n;
const PRELAUNCH_FROZEN = 1n;
const EMERGENCY_EXIT_ONLY = 2n;

describe('V5 candidata: modos operativos y salidas seguras', function () {
  let f;

  beforeEach(async () => {
    f = await loadFixture(fixture);
    await f.core.setCommissionBps(0);
  });

  it('cada contrato económico nace congelado y requiere reanudación explícita', async () => {
    const core = await (await ethers.getContractFactory('CoreProtocol')).deploy();
    const treasury = await (await ethers.getContractFactory('ProtocolTreasury')).deploy(f.blue.target);
    const vault = await (await ethers.getContractFactory('CollateralVault')).deploy(f.usdt.target);
    const exchange = await (await ethers.getContractFactory('FifoExchange'))
      .deploy(f.blue.target, f.usdt.target, treasury.target, 0);

    for (const contract of [core, treasury, vault, exchange]) {
      expect(await contract.operationalMode()).eq(PRELAUNCH_FROZEN);
      expect(await contract.paused()).eq(true);
    }
    await expect(exchange.connect(f.alice).createUsdtOrder(20n * U))
      .to.be.revertedWithCustomError(exchange, 'EnforcedPause');
  });

  it('solo el propietario cambia de modo y cada transición queda registrada', async () => {
    await expect(f.core.connect(f.alice).enterEmergencyExitOnly())
      .to.be.revertedWithCustomError(f.core, 'OwnableUnauthorizedAccount');
    await expect(f.core.enterEmergencyExitOnly())
      .to.emit(f.core, 'OperationalModeChanged').withArgs(NORMAL, EMERGENCY_EXIT_ONLY);
    expect(await f.core.paused()).eq(true);
    await expect(f.core.pause())
      .to.emit(f.core, 'OperationalModeChanged').withArgs(EMERGENCY_EXIT_ONLY, PRELAUNCH_FROZEN);
    await expect(f.core.unpause())
      .to.emit(f.core, 'OperationalModeChanged').withArgs(PRELAUNCH_FROZEN, NORMAL);
  });

  it('Prelanzamiento bloquea consentimientos, cancelaciones, refunds y retiros', async () => {
    await f.vault.connect(f.alice).deposit(50n * U);
    await f.exchange.connect(f.alice).createUsdtOrder(20n * U);
    const id = await f.exchange.nextOrderId() - 1n;
    await f.vault.pause();
    await f.exchange.pause();

    await expect(f.vault.connect(f.alice).setAutomaticExchangeCollateral(true))
      .to.be.revertedWithCustomError(f.vault, 'EnforcedPause');
    await expect(f.vault.connect(f.alice).withdraw(10n * U))
      .to.be.revertedWithCustomError(f.vault, 'PrelaunchFrozen');
    await expect(f.exchange.connect(f.alice).cancelOrder(id))
      .to.be.revertedWithCustomError(f.exchange, 'PrelaunchFrozen');
    expect((await f.exchange.orders(id)).status).eq(1);
  });

  it('Emergencia bloquea exposición nueva y permite reducción, cancelación y colateral libre', async () => {
    await f.vault.connect(f.alice).deposit(50n * U);
    await f.exchange.connect(f.alice).createUsdtOrder(20n * U);
    const id = await f.exchange.nextOrderId() - 1n;
    await f.pay(f.alice, f.bob, 10n * U);
    await f.pay(f.carol, f.alice, 10n * U);
    const supplyBefore = await f.blue.totalSupply();
    expect(supplyBefore).eq(await f.red.totalSupply());

    for (const contract of [f.core, f.treasury, f.vault, f.exchange]) {
      await contract.enterEmergencyExitOnly();
      expect(await contract.operationalMode()).eq(EMERGENCY_EXIT_ONLY);
    }

    await expect(f.pay(f.alice, f.bob, U)).to.be.revertedWithCustomError(f.core, 'EnforcedPause');
    await expect(f.vault.connect(f.alice).deposit(U)).to.be.revertedWithCustomError(f.vault, 'EnforcedPause');
    await expect(f.exchange.connect(f.alice).createUsdtOrder(U))
      .to.be.revertedWithCustomError(f.exchange, 'EnforcedPause');

    await expect(f.exchange.connect(f.alice).cancelOrder(id)).to.not.be.reverted;
    expect((await f.exchange.orders(id)).status).eq(4);
    await expect(f.vault.connect(f.alice).withdraw(10n * U)).to.not.be.reverted;
    await expect(f.core.connect(f.alice).amortizeWithBlue(10n * U)).to.not.be.reverted;
    expect(await f.blue.totalSupply()).eq(supplyBefore - 10n * U);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });

  it('Emergencia permite recuperar un refund retenido sin crear nueva exposición', async () => {
    await f.exchange.connect(f.alice).createUsdtOrder(20n * U);
    const id = await f.exchange.nextOrderId() - 1n;
    await f.core.setKYCStatus(f.alice.address, false);
    await f.exchange.connect(f.alice).cancelOrder(id);
    expect(await f.exchange.pendingRefundUsdt(f.alice.address)).eq(20n * U);
    await f.core.setKYCStatus(f.alice.address, true);
    await f.exchange.enterEmergencyExitOnly();

    const before = await f.usdt.balanceOf(f.alice.address);
    await f.exchange.connect(f.alice).claimPendingRefunds();
    expect(await f.usdt.balanceOf(f.alice.address)).eq(before + 20n * U);
    expect(await f.exchange.pendingRefundUsdt(f.alice.address)).eq(0);
    expect(await f.exchange.nextOrderId()).eq(id + 1n);
  });

  it('una desincronización conserva BLUE en custodia si Core sigue congelado', async () => {
    await f.pay(f.alice, f.bob, 20n * U);
    await time.increase(31 * 86400);
    await f.exchange.connect(f.bob).createBlueOrder(20n * U);
    const id = await f.exchange.nextOrderId() - 1n;
    await f.exchange.enterEmergencyExitOnly();
    await f.core.pause();

    const before = await f.blue.balanceOf(f.bob.address);
    await f.exchange.connect(f.bob).cancelOrder(id);
    expect(await f.blue.balanceOf(f.bob.address)).eq(before);
    expect(await f.exchange.pendingRefundBlue(f.bob.address)).eq(20n * U);
    expect((await f.exchange.orders(id)).status).eq(4);
    await expect(f.exchange.connect(f.bob).claimPendingRefunds())
      .to.be.revertedWithCustomError(f.exchange, 'BlueRefundAwaitsCore');
  });

  it('Core no crea exposición si cualquier dependencia económica sigue congelada', async () => {
    await f.vault.pause();
    await expect(f.pay(f.alice, f.bob, U))
      .to.be.revertedWithCustomError(f.core, 'EconomicSuiteNotNormal');
    expect(await f.blue.totalSupply()).eq(0);
    expect(await f.red.totalSupply()).eq(0);
  });

  it('Emergencia sincronizada devuelve BLUE y amortiza RED sin romper la paridad', async () => {
    await f.pay(f.carol, f.alice, 20n * U);
    await time.increase(15 * 86400);
    await f.pay(f.alice, f.bob, 20n * U);
    await time.increase(16 * 86400);
    await f.exchange.connect(f.alice).createBlueOrder(20n * U);
    const id = await f.exchange.nextOrderId() - 1n;
    await time.increase(15 * 86400);
    for (const contract of [f.core, f.treasury, f.vault, f.exchange]) {
      await contract.enterEmergencyExitOnly();
    }

    await f.exchange.connect(f.alice).cancelOrder(id);
    expect(await f.exchange.pendingRefundBlue(f.alice.address)).eq(0);
    expect(await f.blue.balanceOf(f.alice.address)).eq(0);
    expect(await f.red.balanceOf(f.alice.address)).eq(0);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });

  it('Prelanzamiento impide ejecutar cambios económicos de comisión ya maduros', async () => {
    await f.exchange.proposeFeeUpdate(100);
    await ethers.provider.send('evm_increaseTime', [48 * 3600 + 1]);
    await ethers.provider.send('evm_mine');
    await f.exchange.pause();
    await expect(f.exchange.executeFeeUpdate())
      .to.be.revertedWithCustomError(f.exchange, 'EnforcedPause');
    expect(await f.exchange.feeBps()).eq(0);
  });
});
