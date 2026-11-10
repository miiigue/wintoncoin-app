const { expect } = require('chai');
const { ethers, artifacts } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('V6 modular: tokens con autoridades separadas', function () {
  async function fixture() {
    const [owner, guardian, alice, bob, outsider] = await ethers.getSigners();
    const risk = await (await ethers.getContractFactory('RiskRegistry')).deploy(owner.address);
    const modes = await (await ethers.getContractFactory('ProtocolModeController')).deploy(guardian.address);
    const blue = await (await ethers.getContractFactory('BlueTokenV6')).deploy(risk.target);
    const red = await (await ethers.getContractFactory('RedTokenV6')).deploy();
    const pairs = await (await ethers.getContractFactory('PairedSupplyController'))
      .deploy(blue.target, red.target, modes.target);
    const operator = await (await ethers.getContractFactory('PairedOperatorMock')).deploy();
    const exchange = await (await ethers.getContractFactory('BlueExchangeV6Mock')).deploy(blue.target);
    await blue.setSupplyController(pairs.target);
    await red.setSupplyController(pairs.target);
    await blue.setExchange(exchange.target);
    await pairs.setOperator(operator.target, true);
    await risk.setProfile(alice.address, true, 0, 1);
    await risk.setProfile(bob.address, true, 0, 1);
    return { owner, guardian, alice, bob, outsider, risk, modes, blue, red, pairs, operator, exchange };
  }

  async function mintPair(f, redAccount, blueAccount, amount = 10_000_000n, delay = 30 * 86400) {
    const releaseAt = (await time.latest()) + delay;
    await f.modes.setMode(0);
    await f.operator.mint(f.pairs.target, redAccount.address, blueAccount.address, amount, releaseAt);
    return releaseAt;
  }

  it('configura una sola vez autoridades distintas y bloquea suplantaciones', async function () {
    const f = await fixture();
    expect(await f.blue.supplyController()).eq(f.pairs.target);
    expect(await f.blue.riskRegistry()).eq(f.risk.target);
    expect(await f.blue.exchange()).eq(f.exchange.target);
    expect(await f.red.supplyController()).eq(f.pairs.target);
    await expect(f.blue.setSupplyController(f.outsider.address))
      .to.be.revertedWithCustomError(f.blue, 'SupplyControllerAlreadySet');
    await expect(f.blue.setExchange(f.outsider.address))
      .to.be.revertedWithCustomError(f.blue, 'ExchangeAlreadySet');
    await expect(f.red.setSupplyController(f.outsider.address))
      .to.be.revertedWithCustomError(f.red, 'SupplyControllerAlreadySet');
    await expect(f.blue.connect(f.outsider).mintWithParking(f.outsider.address, 1n, (await time.latest()) + 1))
      .to.be.revertedWithCustomError(f.blue, 'UnauthorizedSupplyController');
    await expect(f.red.connect(f.outsider).mintCommitment(f.outsider.address, 1n))
      .to.be.revertedWithCustomError(f.red, 'UnauthorizedSupplyController');
  });

  it('emite BLUE y RED 1:1 por el controlador y registra parking', async function () {
    const f = await fixture();
    const releaseAt = await mintPair(f, f.alice, f.bob);
    expect(await f.blue.totalSupply()).eq(10_000_000n);
    expect(await f.red.totalSupply()).eq(10_000_000n);
    expect(await f.blue.lockedBalanceOf(f.bob.address)).eq(10_000_000n);
    expect(await f.blue.availableBalanceOf(f.bob.address)).eq(0);
    expect(await f.blue.parkingLotsCount(f.bob.address)).eq(1);
    expect((await f.blue.parkingLots(f.bob.address, 0)).releaseAt).eq(releaseAt);
  });

  it('solo Exchange mueve BLUE y respeta parking y KYC del registro separado', async function () {
    const f = await fixture();
    const amount = 10_000_000n;
    await mintPair(f, f.alice, f.bob, amount, 10 * 86400);
    await expect(f.blue.connect(f.bob).transfer(f.alice.address, 1n))
      .to.be.revertedWithCustomError(f.blue, 'TransferOutsideExchange');
    await f.blue.connect(f.bob).approve(f.exchange.target, amount);
    await expect(f.exchange.depositFrom(f.bob.address, amount))
      .to.be.revertedWithCustomError(f.blue, 'ParkingNotReleased');
    await time.increase(10 * 86400 + 1);
    await f.risk.setProfile(f.bob.address, false, 0, 1);
    await expect(f.exchange.depositFrom(f.bob.address, amount))
      .to.be.revertedWithCustomError(f.blue, 'KycNotVerified');
    await f.risk.setProfile(f.bob.address, true, 0, 1);
    await f.exchange.depositFrom(f.bob.address, amount);
    expect(await f.blue.balanceOf(f.exchange.target)).eq(amount);
    await f.risk.setProfile(f.bob.address, false, 0, 1);
    await expect(f.exchange.refund(f.bob.address, amount))
      .to.be.revertedWithCustomError(f.blue, 'KycNotVerified');
    await f.risk.setProfile(f.bob.address, true, 0, 1);
    await f.exchange.refund(f.bob.address, amount);
    expect(await f.blue.balanceOf(f.bob.address)).eq(amount);
  });

  it('RED permanece estrictamente no transferible', async function () {
    const f = await fixture();
    await mintPair(f, f.alice, f.bob);
    await expect(f.red.connect(f.alice).transfer(f.bob.address, 1n))
      .to.be.revertedWithCustomError(f.red, 'NonTransferable');
    await expect(f.red.connect(f.alice).approve(f.bob.address, 1n)).to.not.be.reverted;
    await expect(f.red.connect(f.bob).transferFrom(f.alice.address, f.bob.address, 1n))
      .to.be.revertedWithCustomError(f.red, 'NonTransferable');
  });

  it('quema incluso BLUE estacionado en Emergencia y conserva igualdad global', async function () {
    const f = await fixture();
    const amount = 12_000_000n;
    await mintPair(f, f.alice, f.bob, amount);
    await f.modes.connect(f.guardian).guardianRestrictTo(2);
    await f.operator.burn(f.pairs.target, f.alice.address, f.bob.address, amount);
    expect(await f.blue.totalSupply()).eq(0);
    expect(await f.red.totalSupply()).eq(0);
    expect(await f.blue.lockedBalanceOf(f.bob.address)).eq(0);
  });

  it('mantiene tokens V6 por debajo de 18.000 bytes de runtime', async function () {
    for (const name of ['BlueTokenV6', 'RedTokenV6']) {
      const artifact = await artifacts.readArtifact(name);
      expect((artifact.deployedBytecode.length - 2) / 2, name).lessThan(18_001);
    }
  });
});
