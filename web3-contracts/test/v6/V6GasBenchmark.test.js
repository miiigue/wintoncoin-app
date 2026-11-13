const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { fixture: deployV5, U } = require('../helpers/suite');

const BLUE = 0;
const USDT = 1;

async function gas(transaction) {
  return (await (await transaction).wait()).gasUsed;
}

async function deployV6() {
  const [owner, guardian, alice, bob, carol, treasury, buyer] = await ethers.getSigners();
  const modes = await (await ethers.getContractFactory('ProtocolModeController')).deploy(guardian.address);
  const risk = await (await ethers.getContractFactory('RiskRegistry')).deploy(owner.address);
  // V5 fixture starts at 0 BPS; keep V6 equal for a meaningful comparison.
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
  const exchangeConfig = await (await ethers.getContractFactory('ExchangeConfig')).deploy(treasury.address, 0);
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
  for (const account of [owner, alice, bob, carol, treasury, buyer]) {
    await risk.setProfile(account.address, true, 10_000n * U, 3);
    await usdt.mint(account.address, 10_000n * U);
    await usdt.connect(account).approve(vault.target, ethers.MaxUint256);
    await usdt.connect(account).approve(custody.target, ethers.MaxUint256);
    await blue.connect(account).approve(custody.target, ethers.MaxUint256);
  }
  await risk.setProfile(vault.target, true, 0, 3);
  await modes.setMode(0);
  return { owner, alice, bob, carol, treasury, buyer, modes, risk, blue, red, pairs,
    engine, ledger, usdt, book, custody, router, vault };
}

describe('V5 frente a V6: benchmark local de gas', function () {
  this.timeout(240000);

  it('mide rutas equivalentes sin afirmar equivalencia perfecta de arquitectura', async () => {
    const rows = [];
    const v5 = await deployV5();

    rows.push(['normalPayment', 'V5', await gas(v5.pay(v5.alice, v5.bob, 100n * U))]);
    await v5.pay(v5.carol, v5.alice, 30n * U);
    rows.push(['blueAmortization', 'V5', await gas(v5.core.connect(v5.alice).amortizeWithBlue(30n * U))]);
    await time.increase(30 * 86400 + 1);
    rows.push(['blueOrderCreate', 'V5', await gas(v5.exchange.connect(v5.bob).createBlueOrder(50n * U))]);
    rows.push(['usdtOrderCreate', 'V5', await gas(v5.exchange.connect(v5.other).createUsdtOrder(50n * U))]);
    rows.push(['fifoMatch', 'V5', await gas(v5.exchange.matchOrders(1, 2))]);
    rows.push(['orderCreateForCancel', 'V5', await gas(v5.exchange.connect(v5.other).createUsdtOrder(20n * U))]);
    rows.push(['orderCancel', 'V5', await gas(v5.exchange.connect(v5.other).cancelOrder(3))]);
    rows.push(['vaultGuaranteeOrder', 'V5', await gas(v5.vault.connect(v5.alice).depositAndRepayWithCollateral(20n * U))]);

    const v6 = await deployV6();
    rows.push(['normalPayment', 'V6', await gas(v6.engine.connect(v6.alice).processPayment(v6.bob.address, 100n * U))]);
    await v6.engine.connect(v6.carol).processPayment(v6.alice.address, 30n * U);
    rows.push(['blueAmortization', 'V6', await gas(v6.engine.connect(v6.alice).amortizeWithBlue(30n * U))]);
    await time.increase(30 * 86400 + 1);
    rows.push(['blueOrderCreate', 'V6', await gas(v6.router.connect(v6.bob).createOrder(BLUE, 50n * U))]);
    rows.push(['usdtOrderCreate', 'V6', await gas(v6.router.connect(v6.buyer).createOrder(USDT, 50n * U))]);
    rows.push(['fifoMatch', 'V6', await gas(v6.router.matchNext(2))]);
    rows.push(['orderCreateForCancel', 'V6', await gas(v6.router.connect(v6.buyer).createOrder(USDT, 20n * U))]);
    rows.push(['orderCancel', 'V6', await gas(v6.router.connect(v6.buyer).cancelOrder(3))]);
    rows.push(['vaultDepositAndGuarantee', 'V6', await gas(
      v6.vault.connect(v6.alice).depositAndCreateAmortizationOrder(20n * U)
    )]);

    for (const [operation, version, gasUsed] of rows) {
      expect(gasUsed).greaterThan(0n);
      console.log(JSON.stringify({ benchmark: 'V5_V6_GAS', operation, version, gasUsed: gasUsed.toString() }));
    }
    expect(await v5.blue.totalSupply()).eq(await v5.red.totalSupply());
    expect(await v6.blue.totalSupply()).eq(await v6.red.totalSupply());
    console.log(JSON.stringify({
      benchmark: 'V5_V6_GAS_NOTE',
      exactEquivalence: false,
      reason: 'V6 separa libro, custodia, modo, riesgo y controlador monetario; la ruta atómica de bóveda conserva esos límites en una sola transacción.'
    }));
  });
});
