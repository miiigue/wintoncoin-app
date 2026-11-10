const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');
const U = 1_000_000n, BLUE = 0, USDT = 1;

describe('V6 modular: libro FIFO, custodia y configuración', function () {
  async function fixture() {
    const [owner, treasury, seller, buyer, other] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory('MockERC20');
    const blue = await Mock.deploy('Blue Test', 'BLUE', 6);
    const usdt = await Mock.deploy('USDT Test', 'USDT', 6);
    const config = await (await ethers.getContractFactory('ExchangeConfig')).deploy(treasury.address, 100);
    const book = await (await ethers.getContractFactory('FifoOrderBook')).deploy();
    const custody = await (await ethers.getContractFactory('ExchangeCustody')).deploy(blue.target, usdt.target);
    const router = await (await ethers.getContractFactory('ExchangeRouterHarness')).deploy(book.target, custody.target);
    await book.setRouter(router.target); await custody.setIntegration(router.target, config.target);
    await blue.mint(seller.address, 1_000n * U); await usdt.mint(buyer.address, 1_000n * U);
    await blue.connect(seller).approve(custody.target, ethers.MaxUint256);
    await usdt.connect(buyer).approve(custody.target, ethers.MaxUint256);
    return { owner, treasury, seller, buyer, other, blue, usdt, config, book, custody, router };
  }

  it('bloquea las integraciones una vez y solo Router puede mutar módulos', async () => {
    const f = await loadFixture(fixture);
    await expect(f.book.connect(f.seller).create(f.seller.address, BLUE, 10n * U)).revertedWithCustomError(f.book, 'Unauthorized');
    await expect(f.custody.connect(f.seller).deposit(BLUE, f.seller.address, 10n * U)).revertedWithCustomError(f.custody, 'Unauthorized');
    await expect(f.book.setRouter(f.router.target)).revertedWithCustomError(f.book, 'IntegrationLocked');
    await expect(f.custody.setIntegration(f.router.target, f.config.target)).revertedWithCustomError(f.custody, 'IntegrationAlreadyLocked');
  });

  it('conserva prioridad FIFO, llenados parciales y reanudación al final', async () => {
    const f = await loadFixture(fixture);
    await f.router.create(f.seller.address, BLUE, 100n * U); await f.router.create(f.other.address, BLUE, 50n * U);
    expect((await f.book.nextActive(BLUE, 0, 10))[0]).eq(1);
    await f.router.fill(1, 40n * U); expect((await f.book.order(1)).remaining).eq(60n * U);
    await f.router.suspend(1); expect((await f.book.nextActive(BLUE, 0, 10))[0]).eq(2);
    await f.router.resume(1); expect((await f.book.order(1)).sequence).eq(3); expect(await f.book.queueAt(BLUE, 2)).eq(1);
    expect((await f.book.nextActive(BLUE, 0, 10))[0]).eq(2);
    await f.router.cancel(2); expect((await f.book.order(2)).status).eq(4);
  });

  it('separa reservas, fees y transferencias conservando solvencia', async () => {
    const f = await loadFixture(fixture);
    await f.router.deposit(BLUE, f.seller.address, 100n * U); await f.router.deposit(USDT, f.buyer.address, 100n * U);
    await f.router.settle(f.seller.address, f.buyer.address, 100n * U, 99n * U, 99n * U, 1n * U, 1n * U);
    expect(await f.blue.balanceOf(f.buyer.address)).eq(99n * U); expect(await f.usdt.balanceOf(f.seller.address)).eq(99n * U);
    expect(await f.custody.totalReserved(BLUE)).eq(0); expect(await f.custody.accumulatedFees(BLUE)).eq(1n * U);
    expect(await f.custody.solvent(BLUE)).eq(true); await f.router.claimFees();
    expect(await f.blue.balanceOf(f.treasury.address)).eq(1n * U); expect(await f.usdt.balanceOf(f.treasury.address)).eq(1n * U);
  });

  it('mantiene refunds retenidos como pasivo hasta su liberación', async () => {
    const f = await loadFixture(fixture);
    await f.router.deposit(USDT, f.buyer.address, 25n * U); await f.router.refund(USDT, f.buyer.address, 25n * U, true);
    expect(await f.custody.totalReserved(USDT)).eq(0); expect(await f.custody.pendingRefund(f.buyer.address, USDT)).eq(25n * U);
    expect(await f.custody.liabilities(USDT)).eq(25n * U); const before = await f.usdt.balanceOf(f.buyer.address);
    await f.router.release(USDT, f.buyer.address, f.buyer.address, 25n * U);
    expect(await f.usdt.balanceOf(f.buyer.address)).eq(before + 25n * U); expect(await f.custody.liabilities(USDT)).eq(0);
  });

  it('rechaza tokens fee-on-transfer sin crear reservas ficticias', async () => {
    const [, treasury, user] = await ethers.getSigners();
    const feeBlue = await (await ethers.getContractFactory('MockFeeOnTransferERC20')).deploy('Fee BLUE', 'FBLUE', 6);
    const usdt = await (await ethers.getContractFactory('MockERC20')).deploy('USDT', 'USDT', 6);
    const config = await (await ethers.getContractFactory('ExchangeConfig')).deploy(treasury.address, 0);
    const book = await (await ethers.getContractFactory('FifoOrderBook')).deploy();
    const custody = await (await ethers.getContractFactory('ExchangeCustody')).deploy(feeBlue.target, usdt.target);
    const router = await (await ethers.getContractFactory('ExchangeRouterHarness')).deploy(book.target, custody.target);
    await custody.setIntegration(router.target, config.target); await feeBlue.mint(user.address, 10n * U);
    await feeBlue.connect(user).approve(custody.target, ethers.MaxUint256);
    await expect(router.deposit(BLUE, user.address, 10n * U)).revertedWithCustomError(custody, 'DepositAmountMismatch');
    expect(await custody.totalReserved(BLUE)).eq(0);
  });

  it('aplica fee y tesorería solo tras timelock, con ejecución pública determinista', async () => {
    const f = await loadFixture(fixture);
    await f.config.proposeFee(250); await expect(f.config.executeFee()).revertedWithCustomError(f.config, 'TimelockActive');
    await time.increase(48 * 3600); await f.config.connect(f.other).executeFee(); expect(await f.config.feeBps()).eq(250);
    await f.config.proposeTreasury(f.other.address); await time.increase(48 * 3600);
    await f.config.connect(f.seller).executeTreasury(); expect(await f.config.treasury()).eq(f.other.address);
  });

  it('mantiene cada módulo productivo por debajo de 18KB', async () => {
    const f = await loadFixture(fixture);
    for (const [name, contract] of [['FifoOrderBook', f.book], ['ExchangeCustody', f.custody], ['ExchangeConfig', f.config]]) {
      const bytes = ((await ethers.provider.getCode(contract.target)).length - 2) / 2;
      expect(bytes, name).lessThan(18_000); console.log(JSON.stringify({ module: name, deployedBytes: bytes }));
    }
  });
});
