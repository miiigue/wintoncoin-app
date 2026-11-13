const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');

const U = 1_000_000n;
const BLUE = 0;

describe('V6 modular: Bóveda, garantía y amortización pareada', function () {
  async function fixture(exchangeFeeBps = 0) {
    const [owner, guardian, treasury, debtor, seller, outsider] = await ethers.getSigners();
    const modes = await (await ethers.getContractFactory('ProtocolModeController')).deploy(guardian.address);
    const risk = await (await ethers.getContractFactory('RiskRegistry')).deploy(owner.address);
    const coreConfig = await (await ethers.getContractFactory('ProtocolConfig')).deploy(1_000n * U, 30 * 86400, 0);
    const authorization = await (await ethers.getContractFactory('PaymentAuthorization')).deploy();
    const ledger = await (await ethers.getContractFactory('CommitmentLedger')).deploy();
    const blue = await (await ethers.getContractFactory('BlueTokenV6')).deploy(risk.target);
    const red = await (await ethers.getContractFactory('RedTokenV6')).deploy();
    const pairs = await (await ethers.getContractFactory('PairedSupplyController'))
      .deploy(blue.target, red.target, modes.target);
    const engine = await (await ethers.getContractFactory('PaymentEngine')).deploy(
      modes.target, risk.target, coreConfig.target, authorization.target, ledger.target,
      pairs.target, blue.target, red.target, treasury.address
    );
    const usdt = await (await ethers.getContractFactory('MockERC20')).deploy('USDT', 'USDT', 6);
    const exchangeConfig = await (await ethers.getContractFactory('ExchangeConfig')).deploy(treasury.address, exchangeFeeBps);
    const book = await (await ethers.getContractFactory('FifoOrderBook')).deploy();
    const custody = await (await ethers.getContractFactory('ExchangeCustody')).deploy(blue.target, usdt.target);
    const adapter = await (await ethers.getContractFactory('AmortizationAdapter'))
      .deploy(modes.target, book.target, custody.target);
    const router = await (await ethers.getContractFactory('ExchangeRouter')).deploy(
      modes.target, risk.target, book.target, custody.target, exchangeConfig.target, adapter.target
    );
    const vault = await (await ethers.getContractFactory('CollateralVaultV6')).deploy(
      usdt.target, modes.target, risk.target, engine.target, router.target, adapter.target, custody.target
    );

    await blue.setSupplyController(pairs.target);
    await red.setSupplyController(pairs.target);
    await blue.setExchange(custody.target);
    await authorization.setPaymentEngine(engine.target);
    await ledger.setPaymentEngine(engine.target);
    await pairs.setOperator(engine.target, true);
    await engine.setCollateralVault(vault.target);
    await book.setRouter(router.target);
    await custody.setIntegration(router.target, exchangeConfig.target);
    await adapter.setIntegration(router.target, vault.target);
    for (const account of [owner, treasury, debtor, seller]) {
      await risk.setProfile(account.address, true, 0, 3);
    }
    await risk.setProfile(vault.target, true, 0, 3);
    await usdt.mint(debtor.address, 500n * U);
    await usdt.connect(debtor).approve(vault.target, ethers.MaxUint256);
    await modes.setMode(0);
    return { owner, guardian, treasury, debtor, seller, outsider, modes, risk, blue, red, pairs,
      ledger, engine, usdt, book, custody, adapter, router, vault };
  }

  it('cuenta el USDT una vez, compra BLUE y quema BLUE/RED 1:1 atómicamente', async () => {
    const f = await loadFixture(fixture);
    await f.vault.connect(f.debtor).deposit(100n * U);
    await f.engine.connect(f.debtor).processPayment(f.seller.address, 100n * U);
    expect(await f.red.balanceOf(f.debtor.address)).eq(100n * U);
    expect(await f.vault.collateralCoverage(f.debtor.address)).eq(100n * U);

    await time.increase(30 * 86400 + 1);
    await f.blue.connect(f.seller).approve(f.custody.target, ethers.MaxUint256);
    await f.router.connect(f.seller).createOrder(BLUE, 100n * U);
    await f.vault.connect(f.debtor).createAmortizationOrder(100n * U);
    expect(await f.vault.freeCollateral(f.debtor.address)).eq(0);
    expect(await f.vault.totalExchangeReserved()).eq(100n * U);

    await f.router.matchNext(10);
    expect(await f.red.balanceOf(f.debtor.address)).eq(0);
    expect(await f.blue.balanceOf(f.vault.target)).eq(0);
    expect(await f.ledger.outstanding(f.debtor.address)).eq(0);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
    expect(await f.vault.collateralBalance(f.debtor.address)).eq(0);
    expect(await f.vault.totalExchangeReserved()).eq(0);
    expect(await f.vault.solvent()).eq(true);
  });

  it('deposita y crea la orden de garantía en una sola transacción atómica', async () => {
    const f = await loadFixture(fixture);
    const tx = await f.vault.connect(f.debtor).depositAndCreateAmortizationOrder(100n * U);
    await expect(tx)
      .to.emit(f.vault, 'Deposited').withArgs(f.debtor.address, 100n * U)
      .and.to.emit(f.vault, 'CollateralOrderCreated').withArgs(f.debtor.address, 1, 100n * U);
    const receipt = await tx.wait();
    const vaultEvents = receipt.logs
      .filter(log => log.address.toLowerCase() === f.vault.target.toLowerCase())
      .map(log => f.vault.interface.parseLog(log).name);
    expect(vaultEvents).deep.eq(['Deposited', 'CollateralOrderCreated']);
    expect(await f.vault.collateralBalance(f.debtor.address)).eq(100n * U);
    expect(await f.vault.exchangeReserved(f.debtor.address)).eq(100n * U);
    expect(await f.usdt.balanceOf(f.custody.target)).eq(100n * U);
    expect(await f.vault.solvent()).eq(true);
  });

  it('revierte también el depósito si no puede crear la orden atómica', async () => {
    const f = await loadFixture(fixture);
    await expect(f.vault.connect(f.debtor).depositAndCreateAmortizationOrder(U - 1n))
      .revertedWithCustomError(f.router, 'InvalidAmount');
    expect(await f.vault.collateralBalance(f.debtor.address)).eq(0);
    expect(await f.usdt.balanceOf(f.vault.target)).eq(0);
  });

  it('la ruta atómica falla cerrada sin KYC y durante Prelanzamiento', async () => {
    const f = await loadFixture(fixture);
    await f.risk.setProfile(f.debtor.address, false, 0, 3);
    await expect(f.vault.connect(f.debtor).depositAndCreateAmortizationOrder(10n * U))
      .revertedWithCustomError(f.vault, 'KycNotVerified');
    expect(await f.vault.collateralBalance(f.debtor.address)).eq(0);
    expect(await f.vault.exchangeReserved(f.debtor.address)).eq(0);
    expect(await f.usdt.balanceOf(f.custody.target)).eq(0);
    expect(await f.book.queueLength(1)).eq(0);
    await f.risk.setProfile(f.debtor.address, true, 0, 3);
    await f.modes.connect(f.guardian).guardianRestrictTo(1);
    await expect(f.vault.connect(f.debtor).depositAndCreateAmortizationOrder(10n * U))
      .revertedWithCustomError(f.vault, 'NotNormal');
    expect(await f.vault.collateralBalance(f.debtor.address)).eq(0);
    expect(await f.vault.exchangeReserved(f.debtor.address)).eq(0);
    expect(await f.usdt.balanceOf(f.custody.target)).eq(0);
    expect(await f.book.queueLength(1)).eq(0);
  });

  it('conserva reservas y solvencia tras llenado parcial y cancelación de la ruta atómica', async () => {
    const f = await loadFixture(fixture);
    await f.risk.setProfile(f.debtor.address, true, 100n * U, 3);
    await f.engine.connect(f.debtor).processPayment(f.seller.address, 100n * U);
    await f.vault.connect(f.debtor).depositAndCreateAmortizationOrder(100n * U);
    await time.increase(30 * 86400 + 1);
    await f.blue.connect(f.seller).approve(f.custody.target, ethers.MaxUint256);
    await f.router.connect(f.seller).createOrder(BLUE, 40n * U);
    await f.router.matchNext(10);
    expect(await f.vault.exchangeReserved(f.debtor.address)).eq(60n * U);
    await f.router.connect(f.debtor).cancelOrder(1);
    expect(await f.vault.exchangeReserved(f.debtor.address)).eq(0);
    expect(await f.vault.collateralBalance(f.debtor.address)).eq(60n * U);
    expect(await f.vault.solvent()).eq(true);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });

  it('revierte el cruce completo si la quema de garantía no puede completarse', async () => {
    const f = await loadFixture(fixture);
    await f.vault.connect(f.debtor).deposit(100n * U);
    await f.risk.setProfile(f.debtor.address, true, 100n * U, 3);
    await f.engine.connect(f.debtor).processPayment(f.seller.address, 50n * U);
    await f.risk.setProfile(f.owner.address, true, 50n * U, 3);
    await f.engine.connect(f.owner).processPayment(f.seller.address, 50n * U);
    await time.increase(30 * 86400 + 1);
    await f.blue.connect(f.seller).approve(f.custody.target, ethers.MaxUint256);
    await f.router.connect(f.seller).createOrder(BLUE, 100n * U);
    await f.vault.connect(f.debtor).createAmortizationOrder(100n * U);
    await expect(f.router.matchNext(10)).to.be.reverted;
    expect((await f.book.order(1)).remaining).eq(100n * U);
    expect((await f.book.order(2)).remaining).eq(100n * U);
    expect(await f.red.balanceOf(f.debtor.address)).eq(50n * U);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });

  it('no permite que la comisión del Exchange deje RED sin cobertura', async () => {
    const f = await fixture(100);
    await f.vault.connect(f.debtor).deposit(100n * U);
    await f.engine.connect(f.debtor).processPayment(f.seller.address, 100n * U);
    await time.increase(30 * 86400 + 1);
    await f.blue.connect(f.seller).approve(f.custody.target, ethers.MaxUint256);
    await f.router.connect(f.seller).createOrder(BLUE, 100n * U);
    await f.vault.connect(f.debtor).createAmortizationOrder(100n * U);
    await expect(f.router.matchNext(10)).revertedWithCustomError(f.engine, 'InsufficientCapacity');
    expect(await f.red.balanceOf(f.debtor.address)).eq(100n * U);
    expect(await f.vault.collateralBalance(f.debtor.address)).eq(100n * U);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });

  it('Emergencia cancela, devuelve USDT a Bóveda y permite retirar solo lo libre', async () => {
    const f = await loadFixture(fixture);
    await f.vault.connect(f.debtor).deposit(50n * U);
    await f.vault.connect(f.debtor).createAmortizationOrder(50n * U);
    await f.modes.connect(f.guardian).guardianRestrictTo(2);
    await f.router.connect(f.debtor).cancelOrder(1);
    expect(await f.vault.exchangeReserved(f.debtor.address)).eq(0);
    expect(await f.usdt.balanceOf(f.vault.target)).eq(50n * U);
    await f.vault.connect(f.debtor).withdraw(50n * U);
    expect(await f.vault.collateralBalance(f.debtor.address)).eq(0);
    expect(await f.vault.solvent()).eq(true);
  });

  it('no permite retirar el USDT que todavía respalda RED pendiente', async () => {
    const f = await loadFixture(fixture);
    await f.vault.connect(f.debtor).deposit(100n * U);
    await f.engine.connect(f.debtor).processPayment(f.seller.address, 80n * U);
    expect(await f.vault.freeCollateral(f.debtor.address)).eq(20n * U);
    await expect(f.vault.connect(f.debtor).withdraw(21n * U))
      .revertedWithCustomError(f.vault, 'InsufficientFreeCollateral');
    await f.vault.connect(f.debtor).withdraw(20n * U);
    expect(await f.vault.collateralBalance(f.debtor.address)).eq(80n * U);
  });

  it('Prelanzamiento bloquea depósitos, órdenes, callbacks y retiros', async () => {
    const f = await loadFixture(fixture);
    await f.vault.connect(f.debtor).deposit(20n * U);
    await f.modes.setMode(1);
    await expect(f.vault.connect(f.debtor).deposit(U)).revertedWithCustomError(f.vault, 'NotNormal');
    await expect(f.vault.connect(f.debtor).createAmortizationOrder(U)).revertedWithCustomError(f.vault, 'NotNormal');
    await expect(f.vault.connect(f.debtor).withdraw(U)).revertedWithCustomError(f.vault, 'ExitsNotAllowed');
  });

  it('Bóveda y orquestadores permanecen bajo 18 KB', async () => {
    const f = await loadFixture(fixture);
    for (const [name, contract] of [['CollateralVaultV6', f.vault], ['PaymentEngine', f.engine], ['ExchangeRouter', f.router]]) {
      const bytes = ((await ethers.provider.getCode(contract.target)).length - 2) / 2;
      expect(bytes, `${name}: ${bytes}`).lessThan(18_000);
    }
  });
});
