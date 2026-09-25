const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');
const { fixture, U } = require('./helpers/suite');

describe('Vault: garantía real, reservas FIFO y retiro solicitado', function () {
  let f;
  beforeEach(async () => { f=await loadFixture(fixture); await f.core.setCommissionBps(0); });
  it('Comisión no puede dejar sin respaldo otros compromisos; depósito adicional permite cruce', async () => {
    await f.core.setCreditLimit(f.alice.address,100n*U);
    await f.vault.connect(f.alice).deposit(100n*U); await f.pay(f.alice,f.bob,200n*U);
    await f.exchange.proposeFeeUpdate(100); await time.increase(48*3600); await f.exchange.executeFeeUpdate();
    await time.increase(30*86400); await f.vault.connect(f.alice).repayWithCollateral(f.alice.address,100n*U);
    await f.exchange.connect(f.bob).createBlueOrder(100n*U);
    await f.exchange.matchOrders(10,20);
    const id=await f.vault.activeAmortizationOrder(f.alice.address);
    expect((await f.exchange.orders(id)).status).eq(5);
    expect(await f.vault.userCollateral(f.alice.address)).eq(100n*U);
    expect(await f.red.balanceOf(f.alice.address)).eq(200n*U);
    await f.vault.connect(f.alice).deposit(U); await f.exchange.connect(f.alice).resumeOrder(id); await f.exchange.matchOrders(10,20);
    expect(await f.red.balanceOf(f.alice.address)).eq(101n*U);
    expect(await f.vault.userCollateral(f.alice.address)).eq(U);
    expect(await f.core.getCoverageShortfall(f.alice.address)).eq(0);
  });
  it('Solo depósitos con KYC y seis decimales; rechaza enlace con tesorería', async () => {
    await f.core.setKYCStatus(f.alice.address,false);
    await expect(f.vault.connect(f.alice).deposit(U)).revertedWith('Vault: KYC not verified');
    const fresh=await (await ethers.getContractFactory('CollateralVault')).deploy(f.usdt.target);
    await expect(fresh.linkCoreContracts(f.core.target,f.treasury.target)).reverted;
  });
  it('Crear compra no quema RED sin vendedor y reserva no es retirable', async () => {
    await f.pay(f.alice,f.bob,100n*U); await f.vault.connect(f.alice).deposit(100n*U);
    await f.vault.connect(f.alice).repayWithCollateral(f.alice.address,100n*U);
    expect(await f.red.balanceOf(f.alice.address)).eq(100n*U);
    expect(await f.vault.userCollateral(f.alice.address)).eq(100n*U);
    expect(await f.vault.totalExchangeReserved()).eq(100n*U);
    expect(await f.usdt.balanceOf(f.core.target)).eq(0);
    expect(await f.vault.getFreeCollateral(f.alice.address)).eq(0);
    await expect(f.vault.connect(f.alice).withdraw(U)).revertedWith('Vault: Requested amount exceeds free collateral');
  });
  it('Cancelación retorna al Vault sin retirar garantía exigida por otros compromisos', async () => {
    await f.core.setCreditLimit(f.alice.address,100n*U);
    await f.vault.connect(f.alice).deposit(100n*U); await f.pay(f.alice,f.bob,200n*U);
    await f.vault.connect(f.alice).repayWithCollateral(f.alice.address,50n*U);
    const id=await f.vault.activeAmortizationOrder(f.alice.address);
    await f.exchange.connect(f.alice).cancelOrder(id);
    expect(await f.vault.exchangeReserved(f.alice.address)).eq(0);
    expect(await f.vault.getFreeCollateral(f.alice.address)).eq(0);
    expect(await f.vault.userCollateral(f.alice.address)).eq(100n*U);
  });
  it('Compra parcial 40 y trabajo 60: solamente vuelven los 60 USDT no gastados', async () => {
    await f.pay(f.alice,f.bob,100n*U); await f.vault.connect(f.alice).deposit(100n*U);
    await time.increase(30*86400);
    await f.vault.connect(f.alice).repayWithCollateral(f.alice.address,100n*U);
    await f.exchange.connect(f.bob).createBlueOrder(40n*U);
    await f.exchange.matchOrders(10,20);
    expect(await f.red.balanceOf(f.alice.address)).eq(60n*U);
    expect(await f.vault.userCollateral(f.alice.address)).eq(60n*U);
    await f.pay(f.carol,f.alice,60n*U);
    expect(await f.red.balanceOf(f.alice.address)).eq(0);
    const id=await f.vault.activeAmortizationOrder(f.alice.address);
    await f.exchange.connect(f.alice).cancelOrder(id);
    expect(await f.vault.getFreeCollateral(f.alice.address)).eq(60n*U);
    const before=await f.usdt.balanceOf(f.alice.address);
    await f.vault.connect(f.alice).withdraw(60n*U);
    expect(await f.usdt.balanceOf(f.alice.address)).eq(before+60n*U);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });
  it('Una orden activa y otra reserva; la siguiente entra detrás de otro comprador', async () => {
    await f.pay(f.alice,f.bob,100n*U); await f.vault.connect(f.alice).deposit(100n*U);
    await f.vault.connect(f.alice).repayWithCollateral(f.alice.address,10n*U);
    const first=await f.vault.activeAmortizationOrder(f.alice.address);
    await f.vault.connect(f.alice).repayWithCollateral(f.alice.address,20n*U);
    expect(await f.vault.activeAmortizationOrder(f.alice.address)).eq(first);
    expect(await f.vault.pendingReserve(f.alice.address)).eq(20n*U);
    await f.exchange.connect(f.carol).createUsdtOrder(5n*U);
    await time.increase(30*86400); await f.exchange.connect(f.bob).createBlueOrder(10n*U);
    await f.exchange.matchOrders(10,20);
    await f.vault.connect(f.other).processPending(f.alice.address);
    const next=await f.vault.activeAmortizationOrder(f.alice.address);
    expect(next).greaterThan(first+1n);
    expect(await f.vault.pendingReserve(f.alice.address)).eq(0);
    expect(await f.vault.userCollateral(f.alice.address)).eq(90n*U);
  });
  it('Liquidación pública solo compra para lo vencido, sin consumir compromisos vigentes', async () => {
    await f.core.setCommitmentDuration(60); await f.pay(f.alice,f.bob,U);
    await f.core.setCommitmentDuration(30*86400); await f.pay(f.alice,f.bob,99n*U);
    await f.vault.connect(f.alice).deposit(100n*U); await time.increase(60);
    await expect(f.vault.liquidateDelinquent(f.alice.address,100n*U)).revertedWith('Vault: Purchase exceeds remaining commitment');
    await f.vault.liquidateDelinquent(f.alice.address,U);
    await f.exchange.connect(f.bob).createBlueOrder(U);
    await f.exchange.matchOrders(10,20);
    expect(await f.red.balanceOf(f.alice.address)).eq(99n*U);
    expect(await f.vault.userCollateral(f.alice.address)).eq(99n*U);
  });
  it('Con comisión Exchange 1%, gastar 100 amortiza 99 y mantiene 1 RED', async () => {
    await f.pay(f.alice,f.bob,100n*U); await f.vault.connect(f.alice).deposit(100n*U);
    await f.exchange.proposeFeeUpdate(100); await time.increase(48*3600); await f.exchange.executeFeeUpdate();
    await time.increase(30*86400);
    await f.vault.connect(f.alice).repayWithCollateral(f.alice.address,100n*U);
    await f.exchange.connect(f.bob).createBlueOrder(100n*U); await f.exchange.matchOrders(10,20);
    expect(await f.red.balanceOf(f.alice.address)).eq(U);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });
});
