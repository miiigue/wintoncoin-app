const { expect } = require('chai');
const { ethers, artifacts } = require('hardhat');
const fs = require('fs');
const path = require('path');

const WARNING_BYTES = 16_000;
const MAX_RUNTIME_BYTES = 18_000;

function productionContracts() {
  const root = path.resolve(__dirname, '../../contracts/v6');
  const found = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!['mocks', 'test'].includes(entry.name)) visit(target);
      } else if (entry.name.endsWith('.sol')) {
        const source = fs.readFileSync(target, 'utf8');
        for (const match of source.matchAll(/^\s*contract\s+([A-Za-z_]\w*)\b/gm)) found.push(match[1]);
      }
    }
  };
  visit(root);
  return [...new Set(found)].sort();
}

describe('V6: política de tamaño e invariantes monetarios', function () {
  it('registra tamaño/codehash y bloquea todo contrato productivo sobre 18.000 bytes', async function () {
    const names = productionContracts();
    expect(names).to.deep.equal([
      'AmortizationAdapter',
      'BlueTokenV6',
      'CollateralVaultV6',
      'CommitmentLedger',
      'ExchangeConfig',
      'ExchangeCustody',
      'ExchangeRouter',
      'ExtensionManager',
      'FifoOrderBook',
      'PairedSupplyController',
      'PaymentAuthorization',
      'PaymentEngine',
      'ProtocolConfig',
      'ProtocolModeController',
      'RedTokenV6',
      'RiskRegistry',
    ]);

    for (const name of names) {
      const artifact = await artifacts.readArtifact(name);
      const runtimeBytes = (artifact.deployedBytecode.length - 2) / 2;
      const codehash = ethers.keccak256(artifact.deployedBytecode);
      console.log(JSON.stringify({ policy: 'V6_BYTECODE', contract: name, runtimeBytes, codehash }));
      if (runtimeBytes > WARNING_BYTES) {
        console.warn(`${name}: ${runtimeBytes} bytes supera la advertencia conceptual de ${WARNING_BYTES}`);
      }
      expect(runtimeBytes, `${name} excede el objetivo duro V6`).to.be.at.most(MAX_RUNTIME_BYTES);
      expect(codehash).to.match(/^0x[0-9a-f]{64}$/);
    }
  });

  it('preserva BLUE == RED en una secuencia determinista de modos, emisiones y quemas', async function () {
    const signers = await ethers.getSigners();
    const [owner, guardian] = signers;
    const users = signers.slice(2, 8);
    const risk = await (await ethers.getContractFactory('RiskRegistry')).deploy(owner.address);
    const modes = await (await ethers.getContractFactory('ProtocolModeController')).deploy(guardian.address);
    const blue = await (await ethers.getContractFactory('BlueTokenV6')).deploy(risk.target);
    const red = await (await ethers.getContractFactory('RedTokenV6')).deploy();
    const pairs = await (await ethers.getContractFactory('PairedSupplyController'))
      .deploy(blue.target, red.target, modes.target);
    const operator = await (await ethers.getContractFactory('PairedOperatorMock')).deploy();
    await blue.setSupplyController(pairs.target);
    await red.setSupplyController(pairs.target);
    await pairs.setOperator(operator.target, true);

    const balances = users.map(() => 0n);
    let expectedSupply = 0n;
    let currentMode = 1;
    let seed = 0x57494e544f4e5636n;
    const mask = (1n << 64n) - 1n;
    const random = () => {
      seed = (seed * 6364136223846793005n + 1442695040888963407n) & mask;
      return seed;
    };

    for (let step = 0; step < 120; step++) {
      const nextMode = Number(random() % 3n);
      if (nextMode !== currentMode) {
        await modes.setMode(nextMode);
        currentMode = nextMode;
      }
      const index = Number(random() % BigInt(users.length));
      const user = users[index];
      let amount = (random() % 25n + 1n) * 1_000_000n;
      const releaseAt = (await ethers.provider.getBlock('latest')).timestamp + 30 * 86400 + step;

      if (currentMode === 0) {
        const shouldMint = balances[index] === 0n || random() % 2n === 0n;
        if (shouldMint) {
          await operator.mint(pairs.target, user.address, user.address, amount, releaseAt);
          balances[index] += amount;
          expectedSupply += amount;
        } else {
          if (amount > balances[index]) amount = balances[index];
          await operator.burn(pairs.target, user.address, user.address, amount);
          balances[index] -= amount;
          expectedSupply -= amount;
        }
      } else if (currentMode === 2) {
        await expect(operator.mint(pairs.target, user.address, user.address, amount, releaseAt))
          .to.be.revertedWithCustomError(pairs, 'MintingNotAllowed');
        if (balances[index] > 0n) {
          if (amount > balances[index]) amount = balances[index];
          await operator.burn(pairs.target, user.address, user.address, amount);
          balances[index] -= amount;
          expectedSupply -= amount;
        }
      } else {
        await expect(operator.mint(pairs.target, user.address, user.address, amount, releaseAt))
          .to.be.revertedWithCustomError(pairs, 'MintingNotAllowed');
        if (balances[index] > 0n) {
          if (amount > balances[index]) amount = balances[index];
          await expect(operator.burn(pairs.target, user.address, user.address, amount))
            .to.be.revertedWithCustomError(pairs, 'BurningNotAllowed');
        }
      }

      expect(await blue.totalSupply(), `BLUE step ${step}`).eq(expectedSupply);
      expect(await red.totalSupply(), `RED step ${step}`).eq(expectedSupply);
      expect(await pairs.pairedSupply(), `pair step ${step}`).eq(expectedSupply);
    }

    console.log(JSON.stringify({ policy: 'V6_PAIRED_SEQUENCE', seed: '0x57494e544f4e5636', steps: 120, finalSupply: expectedSupply.toString() }));
  });
});
