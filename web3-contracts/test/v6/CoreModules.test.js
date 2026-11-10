const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');

const U = 1_000_000n;
const paymentTypes = {
  Payment: [
    { name: 'payer', type: 'address' },
    { name: 'payee', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'blueAmount', type: 'uint256' },
    { name: 'redAmount', type: 'uint256' },
    { name: 'feeBps', type: 'uint16' },
    { name: 'duration', type: 'uint48' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'agreementHash', type: 'bytes32' },
    { name: 'payerStateHash', type: 'bytes32' },
  ],
};

async function fixture() {
  const [owner, riskOperator, alice, bob, outsider] = await ethers.getSigners();
  const risk = await (await ethers.getContractFactory('RiskRegistry')).deploy(riskOperator.address);
  const config = await (await ethers.getContractFactory('ProtocolConfig')).deploy(1_000n * U, 30 * 86400, 500);
  const authorization = await (await ethers.getContractFactory('PaymentAuthorization')).deploy();
  const ledger = await (await ethers.getContractFactory('CommitmentLedger')).deploy();
  const engine = await (await ethers.getContractFactory('CoreEngineHarness')).deploy();
  await authorization.setPaymentEngine(engine.target);
  await ledger.setPaymentEngine(engine.target);
  return { owner, riskOperator, alice, bob, outsider, risk, config, authorization, ledger, engine };
}

describe('V6 modular: Core no monetario', function () {
  it('RiskRegistry separa operador, valida nivel y no permite renunciar al gobierno', async () => {
    const f = await loadFixture(fixture);
    await expect(f.risk.connect(f.outsider).setProfile(f.alice.address, true, 100n * U, 3))
      .to.be.revertedWithCustomError(f.risk, 'UnauthorizedRiskOperator');
    await f.risk.connect(f.riskOperator).setProfile(f.alice.address, true, 100n * U, 3);
    const profile = await f.risk.profile(f.alice.address);
    expect(profile.kycVerified).eq(true);
    expect(profile.creditLimit).eq(100n * U);
    expect(profile.level).eq(3);
    await expect(f.risk.connect(f.riskOperator).setProfile(f.alice.address, true, U, 7))
      .to.be.revertedWithCustomError(f.risk, 'InvalidLevel');
    await expect(f.risk.renounceOwnership()).to.be.revertedWithCustomError(f.risk, 'OwnershipRenunciationDisabled');
  });

  it('ProtocolConfig aplica 48 horas y no admite parámetros fuera de límites', async () => {
    const f = await loadFixture(fixture);
    await expect(f.config.proposeConfig(2_000n * U, 45 * 86400, 1_001))
      .to.be.revertedWithCustomError(f.config, 'InvalidConfig');
    await f.config.proposeConfig(2_000n * U, 45 * 86400, 250);
    await expect(f.config.executeConfig()).to.be.revertedWithCustomError(f.config, 'TimelockNotExpired');
    await time.increase(48 * 3600);
    await f.config.connect(f.outsider).executeConfig();
    const active = await f.config.activeConfig();
    expect(active.maxPayment).eq(2_000n * U);
    expect(active.commitmentDuration).eq(45 * 86400);
    expect(active.commissionBps).eq(250);
  });

  it('ProtocolConfig no permite ejecutar indefinidamente una propuesta antigua', async () => {
    const f = await loadFixture(fixture);
    await f.config.proposeConfig(2_000n * U, 45 * 86400, 250);
    await time.increase(48 * 3600 + 7 * 86400 + 1);
    await expect(f.config.executeConfig()).revertedWithCustomError(f.config, 'ProposalExpired');
    await f.config.cancelConfig();
    expect(await f.config.pendingUnlockAt()).eq(0);
  });

  it('PaymentAuthorization consume una firma EOA una vez y solo desde el Engine', async () => {
    const f = await loadFixture(fixture);
    const network = await ethers.provider.getNetwork();
    const payment = {
      payer: f.alice.address,
      payee: f.bob.address,
      amount: 20n * U,
      blueAmount: 5n * U,
      redAmount: 16n * U,
      feeBps: 500,
      duration: 30 * 86400,
      nonce: 0,
      deadline: (await time.latest()) + 900,
      agreementHash: ethers.id('terms-v6'),
      payerStateHash: ethers.id('state-v6'),
    };
    const domain = {
      name: 'WintonPayment', version: '6', chainId: network.chainId,
      verifyingContract: f.authorization.target,
    };
    const signature = await f.alice.signTypedData(domain, paymentTypes, payment);
    await expect(f.authorization.connect(f.outsider).consume(payment, signature))
      .to.be.revertedWithCustomError(f.authorization, 'UnauthorizedEngine');
    await expect(f.engine.consumeAuthorization(f.authorization.target, payment, signature))
      .to.emit(f.authorization, 'AuthorizationConsumed').withArgs(f.alice.address, 0, await f.authorization.digest(payment));
    await expect(f.engine.consumeAuthorization(f.authorization.target, payment, signature))
      .to.be.revertedWithCustomError(f.authorization, 'InvalidNonce');
  });

  it('PaymentAuthorization valida cuentas ERC-1271 sin entregar su clave al servidor', async () => {
    const f = await loadFixture(fixture);
    const wallet = await (await ethers.getContractFactory('MockSignatureWallet')).deploy(f.alice.address);
    const network = await ethers.provider.getNetwork();
    const payment = {
      payer: wallet.target, payee: f.bob.address, amount: U, blueAmount: 0, redAmount: U,
      feeBps: 0, duration: 30 * 86400, nonce: 0, deadline: (await time.latest()) + 900,
      agreementHash: ethers.id('safe-v6'), payerStateHash: ethers.id('state-safe-v6'),
    };
    const domain = { name: 'WintonPayment', version: '6', chainId: network.chainId, verifyingContract: f.authorization.target };
    const bad = await f.outsider.signTypedData(domain, paymentTypes, payment);
    await expect(f.engine.consumeAuthorization(f.authorization.target, payment, bad))
      .to.be.revertedWithCustomError(f.authorization, 'InvalidSignature');
    await f.engine.consumeAuthorization(
      f.authorization.target, payment, await f.alice.signTypedData(domain, paymentTypes, payment)
    );
    expect(await f.authorization.nonces(wallet.target)).eq(1);
  });

  it('CommitmentLedger conserva FIFO por vencimiento y restringe toda mutación al Engine', async () => {
    const f = await loadFixture(fixture);
    const now = await time.latest();
    await expect(f.ledger.connect(f.outsider).createCommitment(f.alice.address, 30n * U, now + 10, 0, 0))
      .to.be.revertedWithCustomError(f.ledger, 'UnauthorizedEngine');
    await f.engine.create(f.ledger.target, f.alice.address, 30n * U, now + 30, 0, 0);
    await f.engine.create(f.ledger.target, f.alice.address, 20n * U, now + 10, 2n * U, U);
    expect(await f.ledger.firstLotId(f.alice.address)).eq(2);
    expect(await f.ledger.outstanding(f.alice.address)).eq(50n * U);
    await time.increaseTo(now + 11);
    expect(await f.ledger.matured(f.alice.address)).eq(20n * U);
    await expect(f.engine.amortize(f.ledger.target, f.alice.address, 21n * U, true))
      .to.be.revertedWithCustomError(f.ledger, 'AmountExceedsMatured');
    await f.engine.amortize(f.ledger.target, f.alice.address, 20n * U, true);
    expect(await f.ledger.outstanding(f.alice.address)).eq(30n * U);
    expect(await f.ledger.firstLotId(f.alice.address)).eq(1);
  });

  it('CommitmentLedger reordena una prórroga sin duplicar deuda', async () => {
    const f = await loadFixture(fixture);
    const now = await time.latest();
    await f.engine.create(f.ledger.target, f.alice.address, 10n * U, now + 10, 0, 0);
    await f.engine.create(f.ledger.target, f.alice.address, 20n * U, now + 20, 0, 0);
    await f.engine.extend(f.ledger.target, f.alice.address, 1, now + 40, U, 500_000);
    expect(await f.ledger.firstLotId(f.alice.address)).eq(2);
    expect(await f.ledger.outstanding(f.alice.address)).eq(31n * U);
    const lot = await f.ledger.lot(f.alice.address, 1);
    expect(lot.dueAt).eq(now + 40);
    expect(lot.amount).eq(11n * U);
    expect(lot.fee).eq(U);
    expect(lot.margin).eq(500_000);
  });

  it('cada módulo queda ampliamente por debajo del objetivo de 18.000 bytes', async () => {
    const f = await loadFixture(fixture);
    for (const [name, contract] of [
      ['RiskRegistry', f.risk], ['ProtocolConfig', f.config],
      ['PaymentAuthorization', f.authorization], ['CommitmentLedger', f.ledger],
    ]) {
      const bytes = ((await ethers.provider.getCode(contract.target)).length - 2) / 2;
      expect(bytes, `${name}: ${bytes} bytes`).lessThan(18_000);
    }
  });
});
