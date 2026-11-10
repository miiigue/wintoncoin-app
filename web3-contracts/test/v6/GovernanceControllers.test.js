const { expect } = require('chai');
const { ethers, artifacts } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('V6 modular: gobierno de modo y suministro pareado', function () {
  async function deployRealFixture() {
    const [owner, guardian, alice, bob, outsider] = await ethers.getSigners();
    const modes = await (await ethers.getContractFactory('ProtocolModeController')).deploy(guardian.address);
    const blue = await (await ethers.getContractFactory('BlueToken')).deploy();
    const red = await (await ethers.getContractFactory('RedToken')).deploy();
    const pairs = await (await ethers.getContractFactory('PairedSupplyController'))
      .deploy(blue.target, red.target, modes.target);
    const operator = await (await ethers.getContractFactory('PairedOperatorMock')).deploy();
    await blue.setCoreProtocol(pairs.target);
    await red.setCoreProtocol(pairs.target);
    await pairs.setOperator(operator.target, true);
    return { owner, guardian, alice, bob, outsider, modes, blue, red, pairs, operator };
  }

  it('nace congelado y el guardián solo puede restringir', async function () {
    const [owner, guardian, outsider] = await ethers.getSigners();
    const modes = await (await ethers.getContractFactory('ProtocolModeController')).deploy(guardian.address);
    expect(await modes.mode()).eq(1);
    expect(await modes.exitsAllowed()).eq(false);
    await modes.setMode(0);
    expect(await modes.isNormal()).eq(true);
    await expect(modes.connect(outsider).guardianRestrictTo(2))
      .to.be.revertedWithCustomError(modes, 'UnauthorizedGuardian');
    await modes.connect(guardian).guardianRestrictTo(2);
    await expect(modes.connect(guardian).guardianRestrictTo(0))
      .to.be.revertedWithCustomError(modes, 'GuardianCannotRelaxMode');
    await modes.connect(guardian).guardianRestrictTo(1);
    await expect(modes.connect(guardian).guardianRestrictTo(2))
      .to.be.revertedWithCustomError(modes, 'GuardianCannotRelaxMode');
    await expect(modes.connect(outsider).setMode(0))
      .to.be.revertedWithCustomError(modes, 'OwnableUnauthorizedAccount');
    await modes.connect(owner).setMode(0);
  });

  it('solo un operador contractual autorizado puede emitir o quemar', async function () {
    const f = await deployRealFixture();
    const releaseAt = (await time.latest()) + 30 * 86400;
    await expect(f.operator.mint(f.pairs.target, f.alice.address, f.bob.address, 10_000_000n, releaseAt))
      .to.be.revertedWithCustomError(f.pairs, 'MintingNotAllowed');
    await f.modes.setMode(0);
    await expect(f.pairs.connect(f.outsider).mintPair(f.alice.address, f.bob.address, 10_000_000n, releaseAt))
      .to.be.revertedWithCustomError(f.pairs, 'UnauthorizedOperator');
    await f.operator.mint(f.pairs.target, f.alice.address, f.bob.address, 10_000_000n, releaseAt);
    expect(await f.blue.totalSupply()).eq(10_000_000n);
    expect(await f.red.totalSupply()).eq(10_000_000n);
    expect(await f.red.balanceOf(f.alice.address)).eq(10_000_000n);
    expect(await f.blue.balanceOf(f.bob.address)).eq(10_000_000n);
  });

  it('Emergencia bloquea emisiones pero permite la quema atómica 1:1', async function () {
    const f = await deployRealFixture();
    const amount = 15_000_000n;
    const releaseAt = (await time.latest()) + 30 * 86400;
    await f.modes.setMode(0);
    await f.operator.mint(f.pairs.target, f.alice.address, f.bob.address, amount, releaseAt);
    await f.modes.connect(f.guardian).guardianRestrictTo(2);
    await expect(f.operator.mint(f.pairs.target, f.alice.address, f.bob.address, 1n, releaseAt))
      .to.be.revertedWithCustomError(f.pairs, 'MintingNotAllowed');
    await f.operator.burn(f.pairs.target, f.alice.address, f.bob.address, amount);
    expect(await f.blue.totalSupply()).eq(0);
    expect(await f.red.totalSupply()).eq(0);
  });

  it('Prelanzamiento bloquea también las quemas y no altera suministros', async function () {
    const f = await deployRealFixture();
    await expect(f.operator.burn(f.pairs.target, f.alice.address, f.bob.address, 1n))
      .to.be.revertedWithCustomError(f.pairs, 'BurningNotAllowed');
    expect(await f.blue.totalSupply()).eq(0);
    expect(await f.red.totalSupply()).eq(0);
  });

  it('revierte atómicamente si cualquiera de las dos quemas no puede completarse', async function () {
    const f = await deployRealFixture();
    const amount = 5_000_000n;
    const releaseAt = (await time.latest()) + 30 * 86400;
    await f.modes.setMode(0);
    await f.operator.mint(f.pairs.target, f.alice.address, f.bob.address, amount, releaseAt);
    await f.modes.connect(f.guardian).guardianRestrictTo(2);
    await expect(f.operator.burn(f.pairs.target, f.outsider.address, f.bob.address, amount)).to.be.reverted;
    expect(await f.blue.balanceOf(f.bob.address)).eq(amount);
    expect(await f.blue.totalSupply()).eq(amount);
    expect(await f.red.totalSupply()).eq(amount);
  });

  it('rechaza cualquier desbalance previo antes de una operación monetaria', async function () {
    const [, guardian, alice] = await ethers.getSigners();
    const modes = await (await ethers.getContractFactory('ProtocolModeController')).deploy(guardian.address);
    const blue = await (await ethers.getContractFactory('PairedTokenMock')).deploy(6);
    const red = await (await ethers.getContractFactory('PairedTokenMock')).deploy(6);
    const pairs = await (await ethers.getContractFactory('PairedSupplyController'))
      .deploy(blue.target, red.target, modes.target);
    const operator = await (await ethers.getContractFactory('PairedOperatorMock')).deploy();
    await pairs.setOperator(operator.target, true);
    await modes.setMode(0);
    await blue.seed(alice.address, 1n);
    await expect(operator.mint(pairs.target, alice.address, alice.address, 1n, (await time.latest()) + 1000))
      .to.be.revertedWithCustomError(pairs, 'PairSupplyMismatch').withArgs(1n, 0n);
  });

  it('mantiene cada controlador muy por debajo del presupuesto de 18.000 bytes', async function () {
    for (const name of ['ProtocolModeController', 'PairedSupplyController']) {
      const artifact = await artifacts.readArtifact(name);
      const bytes = (artifact.deployedBytecode.length - 2) / 2;
      expect(bytes, name).lessThan(18_001);
    }
  });
});
