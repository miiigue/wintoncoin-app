const { expect } = require('chai');
const { ethers, artifacts } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');

const U = 1_000_000n;
const paymentTypes = {
  Payment: [
    { name: 'payer', type: 'address' }, { name: 'payee', type: 'address' },
    { name: 'amount', type: 'uint256' }, { name: 'blueAmount', type: 'uint256' },
    { name: 'redAmount', type: 'uint256' }, { name: 'feeBps', type: 'uint16' },
    { name: 'duration', type: 'uint48' }, { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }, { name: 'agreementHash', type: 'bytes32' },
    { name: 'payerStateHash', type: 'bytes32' },
  ],
};

async function fixture() {
  const [owner, guardian, alice, bob, carol, treasury, relayer, outsider] = await ethers.getSigners();
  const modes = await (await ethers.getContractFactory('ProtocolModeController')).deploy(guardian.address);
  const risk = await (await ethers.getContractFactory('RiskRegistry')).deploy(owner.address);
  const config = await (await ethers.getContractFactory('ProtocolConfig')).deploy(1_000n * U, 30 * 86400, 500);
  const authorization = await (await ethers.getContractFactory('PaymentAuthorization')).deploy();
  const ledger = await (await ethers.getContractFactory('CommitmentLedger')).deploy();
  const blue = await (await ethers.getContractFactory('BlueTokenV6')).deploy(risk.target);
  const red = await (await ethers.getContractFactory('RedTokenV6')).deploy();
  const pairs = await (await ethers.getContractFactory('PairedSupplyController'))
    .deploy(blue.target, red.target, modes.target);
  const engine = await (await ethers.getContractFactory('PaymentEngine')).deploy(
    modes.target, risk.target, config.target, authorization.target, ledger.target,
    pairs.target, blue.target, red.target, treasury.address
  );
  await blue.setSupplyController(pairs.target);
  await red.setSupplyController(pairs.target);
  await authorization.setPaymentEngine(engine.target);
  await ledger.setPaymentEngine(engine.target);
  await pairs.setOperator(engine.target, true);
  for (const user of [owner, alice, bob, carol, treasury, relayer]) {
    await risk.setProfile(user.address, true, 10_000n * U, 3);
  }
  await modes.setMode(0);
  return { owner, guardian, alice, bob, carol, treasury, relayer, outsider, modes, risk,
    config, authorization, ledger, blue, red, pairs, engine };
}

describe('V6 modular: PaymentEngine y ExtensionManager', function () {
  it('pago normal emite BLUE/RED 1:1, cobra comisión y registra un único lote', async () => {
    const f = await loadFixture(fixture);
    await f.engine.connect(f.alice).processPayment(f.bob.address, 100n * U);
    expect(await f.red.balanceOf(f.alice.address)).eq(105n * U);
    expect(await f.blue.balanceOf(f.bob.address)).eq(100n * U);
    expect(await f.blue.balanceOf(f.treasury.address)).eq(5n * U);
    expect(await f.ledger.outstanding(f.alice.address)).eq(105n * U);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });

  it('pago mixto quema BLUE/RED y solo conserva el RED residual', async () => {
    const f = await loadFixture(fixture);
    await f.engine.connect(f.carol).processPayment(f.alice.address, 30n * U);
    await f.engine.connect(f.alice).processMixedPayment(f.bob.address, 100n * U, 30n * U);
    expect(await f.red.balanceOf(f.alice.address)).eq(75n * U);
    expect(await f.ledger.outstanding(f.alice.address)).eq(75n * U);
    expect(await f.blue.balanceOf(f.alice.address)).eq(0);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });

  it('firma EIP-712 fija modalidad, estado y nonce antes de ejecutar', async () => {
    const f = await loadFixture(fixture);
    const payment = {
      payer: f.alice.address, payee: f.bob.address, amount: 20n * U,
      blueAmount: 0, redAmount: 21n * U, feeBps: 500, duration: 30 * 86400,
      nonce: 0, deadline: (await time.latest()) + 900,
      agreementHash: ethers.id('v6-terms'), payerStateHash: await f.engine.paymentStateHash(f.alice.address),
    };
    const network = await ethers.provider.getNetwork();
    const domain = { name: 'WintonPayment', version: '6', chainId: network.chainId,
      verifyingContract: f.authorization.target };
    const signature = await f.alice.signTypedData(domain, paymentTypes, payment);
    await f.engine.connect(f.relayer).processAuthorizedPayment(payment, signature);
    expect(await f.red.balanceOf(f.alice.address)).eq(21n * U);
    await expect(f.engine.connect(f.relayer).processAuthorizedPayment(payment, signature))
      .to.be.revertedWithCustomError(f.engine, 'AuthorizationStateChanged');
  });

  it('falla cerrado por KYC, capacidad y modo Prelanzamiento', async () => {
    const f = await loadFixture(fixture);
    await f.risk.setProfile(f.alice.address, true, 10n * U, 3);
    await expect(f.engine.connect(f.alice).processPayment(f.bob.address, 20n * U))
      .to.be.revertedWithCustomError(f.engine, 'InsufficientCapacity');
    await f.risk.setProfile(f.alice.address, true, 10_000n * U, 3);
    await f.risk.setProfile(f.bob.address, false, 10_000n * U, 3);
    await expect(f.engine.connect(f.alice).processPayment(f.bob.address, U))
      .to.be.revertedWithCustomError(f.engine, 'KycNotVerified');
    await f.modes.setMode(1);
    await expect(f.engine.connect(f.alice).processPayment(f.treasury.address, U))
      .to.be.revertedWithCustomError(f.engine, 'NotNormal');
    expect(await f.blue.totalSupply()).eq(0);
    expect(await f.red.totalSupply()).eq(0);
  });

  it('Emergencia solo permite reducción pareada y Prelanzamiento la bloquea', async () => {
    const f = await loadFixture(fixture);
    await f.engine.connect(f.alice).processPayment(f.bob.address, 50n * U);
    await f.engine.connect(f.carol).processPayment(f.alice.address, 20n * U);
    await f.modes.setMode(2);
    await expect(f.engine.connect(f.alice).processPayment(f.bob.address, U))
      .to.be.revertedWithCustomError(f.engine, 'NotNormal');
    await f.engine.connect(f.alice).amortizeWithBlue(20n * U);
    expect(await f.red.balanceOf(f.alice.address)).eq(32_500_000n);
    expect(await f.ledger.outstanding(f.alice.address)).eq(32_500_000n);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
    await f.modes.setMode(1);
    await expect(f.engine.connect(f.alice).amortizeWithBlue(U))
      .to.be.revertedWithCustomError(f.engine, 'ExitsNotAllowed');
  });

  it('prórroga timelocked aumenta RED y BLUE pareados sin interés sobre recargos', async () => {
    const f = await loadFixture(fixture);
    const extensions = await (await ethers.getContractFactory('ExtensionManager'))
      .deploy(f.modes.target, f.risk.target, f.ledger.target, f.engine.target);
    await f.engine.setExtensionManager(extensions.target);
    await f.pairs.setOperator(extensions.target, false); // Manager never touches supply directly.
    await extensions.proposeOption(15 * 86400, 500, 3, true);
    await time.increase(48 * 3600);
    await extensions.executeOption(15 * 86400);
    await f.engine.connect(f.alice).processPayment(f.bob.address, 100n * U);
    const quote = await extensions.quoteExtension(f.alice.address, 1, 15 * 86400);
    await extensions.connect(f.alice).requestExtension(
      1, 15 * 86400, quote.fee, quote.newDueAt, (await time.latest()) + 900
    );
    expect(quote.fee).eq(5n * U);
    expect(await f.red.balanceOf(f.alice.address)).eq(110n * U);
    expect(await f.ledger.outstanding(f.alice.address)).eq(110n * U);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });

  it('PaymentEngine y ExtensionManager quedan debajo de 18.000 bytes', async () => {
    for (const name of ['PaymentEngine', 'ExtensionManager']) {
      const artifact = await artifacts.readArtifact(name);
      const bytes = (artifact.deployedBytecode.length - 2) / 2;
      expect(bytes, `${name}: ${bytes}`).lessThan(18_000);
    }
  });
});
