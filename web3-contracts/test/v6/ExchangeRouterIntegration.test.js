const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');
const U = 1_000_000n, BLUE = 0, USDT = 1;

describe('V6 modular: integración del Router Exchange', function () {
  async function fixture(exchangeFeeBps = 100) {
    const [owner, guardian, treasury, seller, buyer, debtAccount, outsider] = await ethers.getSigners();
    const modes = await (await ethers.getContractFactory('ProtocolModeController')).deploy(guardian.address);
    const risk = await (await ethers.getContractFactory('RiskRegistry')).deploy(owner.address);
    const blue = await (await ethers.getContractFactory('BlueTokenV6')).deploy(risk.target);
    const red = await (await ethers.getContractFactory('RedTokenV6')).deploy();
    const pairs = await (await ethers.getContractFactory('PairedSupplyController')).deploy(blue.target, red.target, modes.target);
    const operator = await (await ethers.getContractFactory('PairedOperatorMock')).deploy();
    await blue.setSupplyController(pairs.target); await red.setSupplyController(pairs.target);
    await pairs.setOperator(operator.target, true);
    const usdt = await (await ethers.getContractFactory('MockERC20')).deploy('USDT', 'USDT', 6);
    const config = await (await ethers.getContractFactory('ExchangeConfig')).deploy(treasury.address, exchangeFeeBps);
    const book = await (await ethers.getContractFactory('FifoOrderBook')).deploy();
    const custody = await (await ethers.getContractFactory('ExchangeCustody')).deploy(blue.target, usdt.target);
    const adapter = await (await ethers.getContractFactory('AmortizationAdapter')).deploy(modes.target, book.target, custody.target);
    const vault = await (await ethers.getContractFactory('AmortizationVaultHarness')).deploy(adapter.target);
    const router = await (await ethers.getContractFactory('ExchangeRouter')).deploy(
      modes.target, risk.target, book.target, custody.target, config.target, adapter.target
    );
    await book.setRouter(router.target); await custody.setIntegration(router.target, config.target);
    await adapter.setIntegration(router.target, vault.target); await blue.setExchange(custody.target);
    for (const account of [seller, buyer, treasury]) await risk.setProfile(account.address, true, 0, 1);
    await risk.setProfile(vault.target, true, 0, 1);
    await usdt.mint(buyer.address, 1_000n * U); await usdt.connect(buyer).approve(custody.target, ethers.MaxUint256);
    await modes.setMode(0);
    const release = (await time.latest()) + 86400;
    await operator.mint(pairs.target, debtAccount.address, seller.address, 500n * U, release);
    await time.increase(86401);
    await blue.connect(seller).approve(custody.target, ethers.MaxUint256);
    return { owner, guardian, treasury, seller, buyer, debtAccount, outsider, modes, risk, blue, red, pairs,
      operator, usdt, config, book, custody, adapter, vault, router };
  }

  it('crea y cruza las primeras órdenes FIFO con depósitos exactos y solvencia', async () => {
    const f = await loadFixture(fixture);
    await f.router.connect(f.seller).createOrder(BLUE, 100n * U);
    await f.router.connect(f.buyer).createOrder(USDT, 100n * U);
    await f.router.matchNext(10);
    expect((await f.book.order(1)).status).eq(3); expect((await f.book.order(2)).status).eq(3);
    expect(await f.blue.balanceOf(f.buyer.address)).eq(99n * U);
    expect(await f.usdt.balanceOf(f.seller.address)).eq(99n * U);
    expect(await f.custody.accumulatedFees(BLUE)).eq(1n * U);
    expect(await f.custody.solvent(BLUE)).eq(true); expect(await f.custody.solvent(USDT)).eq(true);
  });

  it('usa la liquidación optimizada sin comisión cuando la tarifa es cero', async () => {
    const f = await fixture(0);
    await f.router.connect(f.seller).createOrder(BLUE, 100n * U);
    await f.router.connect(f.buyer).createOrder(USDT, 100n * U);
    await f.router.matchNext(10);
    expect(await f.blue.balanceOf(f.buyer.address)).eq(100n * U);
    expect(await f.usdt.balanceOf(f.seller.address)).eq(100n * U);
    expect(await f.custody.accumulatedFees(BLUE)).eq(0);
    expect(await f.custody.accumulatedFees(USDT)).eq(0);
    expect(await f.custody.solvent(BLUE)).eq(true);
    expect(await f.custody.solvent(USDT)).eq(true);
  });

  it('suspende la cabeza sin KYC y nunca adelanta una orden posterior indebidamente', async () => {
    const f = await loadFixture(fixture);
    await f.router.connect(f.seller).createOrder(BLUE, 50n * U);
    await f.router.connect(f.buyer).createOrder(USDT, 20n * U);
    await f.router.connect(f.buyer).createOrder(USDT, 20n * U);
    await f.risk.setProfile(f.buyer.address, false, 0, 1);
    await f.router.matchNext(10);
    expect((await f.book.order(2)).status).eq(5);
    expect((await f.book.order(3)).status).eq(1);
    await f.router.connect(f.buyer).cancelOrder(2);
    expect((await f.book.order(2)).status).eq(4);
    expect(await f.custody.pendingRefund(f.buyer.address, USDT)).eq(20n * U);
  });

  it('Prelanzamiento bloquea todo y Emergencia permite solo cancelar y reclamar', async () => {
    const f = await loadFixture(fixture);
    await f.router.connect(f.seller).createOrder(BLUE, 40n * U);
    await f.router.connect(f.buyer).createOrder(USDT, 40n * U);
    await f.modes.connect(f.guardian).guardianRestrictTo(2);
    await expect(f.router.connect(f.buyer).createOrder(USDT, U)).revertedWithCustomError(f.router, 'ExitOnly');
    await expect(f.router.matchNext(10)).revertedWithCustomError(f.router, 'ExitOnly');
    await f.router.connect(f.seller).cancelOrder(1);
    expect(await f.blue.balanceOf(f.seller.address)).eq(500n * U);
    await f.risk.setProfile(f.buyer.address, false, 0, 1);
    await f.router.connect(f.buyer).cancelOrder(2);
    expect(await f.custody.pendingRefund(f.buyer.address, USDT)).eq(40n * U);
    await f.risk.setProfile(f.buyer.address, true, 0, 1);
    await f.router.connect(f.buyer).claimPending(USDT);
    await f.modes.setMode(1);
    await expect(f.router.connect(f.buyer).claimPending(USDT)).revertedWithCustomError(f.router, 'OperationsFrozen');
  });

  it('reserva garantía una sola vez, dirige BLUE al Vault y devuelve USDT reservado al cancelar', async () => {
    const f = await loadFixture(fixture);
    await f.router.connect(f.seller).createOrder(BLUE, 50n * U);
    await f.router.connect(f.buyer).createOrder(USDT, 50n * U);
    await f.vault.register(2, f.buyer.address, 30n * U);
    await expect(f.vault.register(2, f.buyer.address, 21n * U)).revertedWithCustomError(f.adapter, 'InvalidAmount');
    await f.router.matchNext(10);
    expect(await f.vault.filledUsdt()).eq(30n * U); expect(await f.vault.receivedBlue()).eq(29_700_000n);
    expect(await f.blue.balanceOf(f.vault.target)).eq(29_700_000n);
    expect((await f.adapter.reservation(2)).remaining).eq(0);
    await f.vault.register(2, f.buyer.address, 10n * U);
    const vaultUsdtBefore = await f.usdt.balanceOf(f.vault.target);
    await f.router.connect(f.buyer).cancelOrder(2);
    expect(await f.usdt.balanceOf(f.vault.target)).eq(vaultUsdtBefore + 10n * U);
    expect(await f.vault.refundedUsdt()).eq(10n * U);
    expect(await f.adapter.totalCollateralReserved()).eq(0);
  });

  it('Router y Adapter permanecen por debajo de 18KB', async () => {
    const f = await loadFixture(fixture);
    for (const [name, contract] of [['ExchangeRouter', f.router], ['AmortizationAdapter', f.adapter]]) {
      const bytes = ((await ethers.provider.getCode(contract.target)).length - 2) / 2;
      expect(bytes, name).lessThan(18_000); console.log(JSON.stringify({ module: name, deployedBytes: bytes }));
    }
  });
});
