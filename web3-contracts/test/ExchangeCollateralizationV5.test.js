const { expect } = require('chai');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');
const { fixture, U } = require('./helpers/suite');

describe('V5: USDT del Exchange como garantía RED sin doble custodia', function () {
  let f;
  beforeEach(async () => {
    f = await loadFixture(fixture);
    await f.core.setCommissionBps(0);
  });

  async function usdtOrder(user, amount) {
    const receipt = await (await f.exchange.connect(user).createUsdtOrder(amount)).wait();
    return receipt.logs.map(x => { try { return f.exchange.interface.parseLog(x); } catch { return null; } })
      .find(x => x?.name === 'OrderCreated').args.orderId;
  }

  it('autoriza una parte en sitio: una custodia, mismo id/secuencia y excedente cancelable', async () => {
    const id = await usdtOrder(f.alice, 100n * U);
    const before = await f.exchange.orders(id);
    const physical = await f.usdt.balanceOf(f.exchange.target);
    await f.pay(f.alice, f.bob, 100n * U);

    await f.vault.connect(f.alice).collateralizeUsdtOrder(id, 40n * U);
    const after = await f.exchange.orders(id);
    expect(after.sequenceId).eq(before.sequenceId);
    expect(after.remainingAmount).eq(100n * U);
    expect(await f.usdt.balanceOf(f.exchange.target)).eq(physical);
    expect(await f.exchange.exchangeCollateralized(id)).eq(40n * U);
    expect(await f.vault.userCollateral(f.alice.address)).eq(40n * U);
    expect(await f.vault.exchangeReserved(f.alice.address)).eq(40n * U);

    await f.exchange.connect(f.alice).cancelOrder(id);
    expect((await f.exchange.orders(id)).remainingAmount).eq(40n * U);
    expect(await f.exchange.exchangeCollateralized(id)).eq(40n * U);
    await f.exchange.connect(f.alice).cancelOrder(id);
    expect((await f.exchange.orders(id)).remainingAmount).eq(40n * U);
  });

  it('al vencer quema primero BLUE parking y bloquea solo el déficit USDT', async () => {
    await f.core.setCommitmentDuration(100);
    const id = await usdtOrder(f.alice, 100n * U);
    await f.pay(f.alice, f.bob, 100n * U);
    await f.pay(f.carol, f.alice, 30n * U);
    expect(await f.blue.balanceOf(f.alice.address)).eq(30n * U);
    await f.vault.connect(f.alice).setAutomaticExchangeCollateral(true);
    await time.increase(100);

    await f.vault.collateralizeMatured(f.alice.address, [id]);
    expect(await f.blue.balanceOf(f.alice.address)).eq(0);
    expect(await f.red.balanceOf(f.alice.address)).eq(70n * U);
    expect(await f.exchange.exchangeCollateralized(id)).eq(70n * U);
    expect(await f.vault.userCollateral(f.alice.address)).eq(70n * U);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });

  it('consentimiento es obligatorio y repetir el keeper no duplica garantía', async () => {
    await f.core.setCommitmentDuration(60);
    const id = await usdtOrder(f.alice, 100n * U);
    await f.pay(f.alice, f.bob, 100n * U);
    await time.increase(60);
    await expect(f.vault.collateralizeMatured(f.alice.address, [id]))
      .revertedWith('Vault: Automatic collateral not authorized');
    await f.vault.connect(f.alice).setAutomaticExchangeCollateral(true);
    await f.vault.collateralizeMatured(f.alice.address, [id]);
    await f.vault.collateralizeMatured(f.alice.address, [id]);
    expect(await f.exchange.exchangeCollateralized(id)).eq(100n * U);
    expect(await f.vault.userCollateral(f.alice.address)).eq(100n * U);
  });

  it('el fill garantizado quema BLUE y RED 1:1 y conserva la paridad global', async () => {
    const id = await usdtOrder(f.alice, 100n * U);
    await f.pay(f.alice, f.bob, 100n * U);
    await f.vault.connect(f.alice).collateralizeUsdtOrder(id, 40n * U);
    await time.increase(30 * 86400);
    await f.exchange.connect(f.bob).createBlueOrder(40n * U);
    await f.exchange.matchOrders(1, 2);
    expect(await f.red.balanceOf(f.alice.address)).eq(60n * U);
    expect(await f.blue.balanceOf(f.alice.address)).eq(0);
    expect(await f.exchange.exchangeCollateralized(id)).eq(0);
    expect(await f.vault.userCollateral(f.alice.address)).eq(0);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });

  it('una cancelación al vencimiento no puede adelantarse al bloqueo autorizado', async () => {
    await f.core.setCommitmentDuration(60);
    const id = await usdtOrder(f.alice, 100n * U);
    await f.pay(f.alice, f.bob, 100n * U);
    await f.vault.connect(f.alice).setAutomaticExchangeCollateral(true);
    await time.increase(60);
    await f.exchange.connect(f.alice).cancelOrder(id);
    expect(await f.exchange.exchangeCollateralized(id)).eq(100n * U);
  });

  it('una devolución retenida tampoco escapa: pasa físicamente al Vault y queda reservada', async () => {
    await f.core.setCommitmentDuration(60);
    const id = await usdtOrder(f.alice, 100n * U);
    await f.pay(f.alice, f.bob, 100n * U);
    await f.vault.connect(f.alice).setAutomaticExchangeCollateral(true);
    await time.increase(60);
    await f.core.setKYCStatus(f.alice.address, false);
    await f.exchange.connect(f.alice).cancelOrder(id);
    expect(await f.exchange.pendingRefundUsdt(f.alice.address)).eq(100n * U);
    await f.core.setKYCStatus(f.alice.address, true);
    await f.exchange.connect(f.alice).claimPendingRefunds();
    expect(await f.exchange.pendingRefundUsdt(f.alice.address)).eq(0);
    expect(await f.vault.pendingReserve(f.alice.address)).eq(100n * U);
    expect(await f.vault.userCollateral(f.alice.address)).eq(100n * U);
    expect(await f.usdt.balanceOf(f.vault.target)).eq(100n * U);
  });
});
