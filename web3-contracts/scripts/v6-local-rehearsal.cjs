'use strict';
// Local rehearsal only: deliberately refuses all public or persistent networks.
const hre = require(require('path').join(process.cwd(), 'node_modules/hardhat'));
const { ethers } = hre;
async function main() {
  const network = await ethers.provider.getNetwork();
  if (hre.network.name !== 'hardhat' || network.chainId !== 1337n) throw Error('Solo red Hardhat efímera');
  const [owner, guardian, treasury] = await ethers.getSigners();
  const c = {};
  async function deploy(name, args = []) {
    const instance = await (await ethers.getContractFactory(name)).deploy(...args);
    await instance.waitForDeployment(); c[name] = instance; return instance;
  }
  async function tx(promise) { await (await promise).wait(); }
  const m = await deploy('ProtocolModeController', [guardian.address]);
  const risk = await deploy('RiskRegistry', [owner.address]);
  const cfg = await deploy('ProtocolConfig', [1000n * 1000000n, 30 * 86400, 500]);
  const auth = await deploy('PaymentAuthorization');
  const ledger = await deploy('CommitmentLedger');
  const blue = await deploy('BlueTokenV6', [risk.target]);
  const red = await deploy('RedTokenV6');
  const pair = await deploy('PairedSupplyController', [blue.target, red.target, m.target]);
  const engine = await deploy('PaymentEngine', [m.target, risk.target, cfg.target, auth.target, ledger.target, pair.target, blue.target, red.target, treasury.address]);
  const extension = await deploy('ExtensionManager', [m.target, risk.target, ledger.target, engine.target]);
  const usdt = await deploy('MockERC20', ['Demo USDT', 'USDT', 6]);
  const ecfg = await deploy('ExchangeConfig', [treasury.address, 0]);
  const book = await deploy('FifoOrderBook');
  const custody = await deploy('ExchangeCustody', [blue.target, usdt.target]);
  const adapter = await deploy('AmortizationAdapter', [m.target, book.target, custody.target]);
  const router = await deploy('ExchangeRouter', [m.target, risk.target, book.target, custody.target, ecfg.target, adapter.target]);
  const vault = await deploy('CollateralVaultV6', [usdt.target, m.target, risk.target, engine.target, router.target, adapter.target, custody.target]);
  await tx(blue.setSupplyController(pair.target)); await tx(red.setSupplyController(pair.target));
  await tx(blue.setExchange(custody.target)); await tx(auth.setPaymentEngine(engine.target));
  await tx(ledger.setPaymentEngine(engine.target)); await tx(pair.setOperator(engine.target, true));
  await tx(engine.setExtensionManager(extension.target)); await tx(engine.setCollateralVault(vault.target));
  await tx(book.setRouter(router.target)); await tx(custody.setIntegration(router.target, ecfg.target));
  await tx(adapter.setIntegration(router.target, vault.target));
  if (await m.mode() !== 1n || await blue.totalSupply() !== 0n || await red.totalSupply() !== 0n) throw Error('Estado inicial inválido');
  for (const [name, instance] of Object.entries(c)) {
    if ((await ethers.provider.getCode(instance.target)) === '0x') throw Error(`Sin código: ${name}`);
  }
  for (const [name, call] of [['pago', () => engine.processPayment(treasury.address, 1000000n)], ['depósito', () => vault.deposit(1000000n)], ['orden', () => router.createOrder(1, 1000000n)]]) {
    try { await call(); throw Error(`Operación ${name} no bloqueada`); } catch (e) {
      if (e.message.startsWith('Operación')) throw e;
      const expected = name === 'pago' ? 'NotNormal' : name === 'depósito' ? 'NotNormal' : 'OperationsFrozen';
      if (!String(e).includes(expected)) throw e;
    }
  }
  console.log(`Ensayo local: ${Object.keys(c).length} contratos, modo congelado, suministro 0/0 y operaciones bloqueadas.`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
