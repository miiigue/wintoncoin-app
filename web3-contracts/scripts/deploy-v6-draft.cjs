'use strict';
// CANDIDATO DE DEMO: ensayo local o Optimism Sepolia; no ejecuta nada al importarse.
// El diario permite reanudar en la misma instancia Hardhat y conserva transacciones firmadas.
const fs = require('fs');
const path = require('path');
const hre = require(path.join(process.cwd(), 'node_modules/hardhat'));
const { ethers } = hre;
const names = ['ProtocolModeController','RiskRegistry','ProtocolConfig','PaymentAuthorization','CommitmentLedger','BlueTokenV6','RedTokenV6','ProtocolTreasuryV6','PairedSupplyController','PaymentEngine','ExtensionManager','MockERC20','ExchangeConfig','FifoOrderBook','ExchangeCustody','AmortizationAdapter','ExchangeRouter','CollateralVaultV6'];

async function deploySuiteCore({ wallet, plan, journalPath, maxWei, stopAfter, allowDemo }) {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const local = hre.network.name === 'hardhat' && chainId === 1337n;
  const demo = hre.network.name === 'optimismSepolia' && chainId === 11155420n && allowDemo === true;
  if (!local && !demo) throw Error('Red no autorizada: solo Hardhat u Optimism Sepolia Demo');
  if (demo) {
    if (String(plan.chainId) !== '11155420' || !Number.isSafeInteger(plan.anchorBlock) || !ethers.isHexString(plan.anchorHash, 32)) throw Error('Falta ancla explícita de la red Demo');
    const anchor = await ethers.provider.getBlock(plan.anchorBlock);
    if (!anchor || anchor.hash.toLowerCase() !== plan.anchorHash.toLowerCase()) throw Error('El ancla no coincide con Demo');
  }
  const genesis = await ethers.provider.getBlock(0);
  if (!genesis || !genesis.hash) throw Error('No se puede verificar el bloque inicial');
  if (wallet.address.toLowerCase() !== ethers.getAddress(plan.owner).toLowerCase()) throw Error('Firmante distinto del plan');
  if (!ethers.isAddress(plan.guardian) || !ethers.isAddress(plan.riskOperator)) throw Error('Direcciones inválidas');
  if ([plan.guardian, plan.riskOperator].some(a => a === ethers.ZeroAddress)) throw Error('Dirección cero');
  if (local && BigInt(maxWei) <= 0n) throw Error('Falta presupuesto local');
  const artifacts = {};
  for (const name of names) artifacts[name] = await hre.artifacts.readArtifact(name);
  const fingerprint = ethers.id(JSON.stringify({ chainId: String(chainId), genesis: genesis.hash, signer: wallet.address, budget: String(maxWei), plan, bytecodes: Object.fromEntries(names.map(n => [n, ethers.keccak256(artifacts[n].bytecode)])) }));
  const state = fs.existsSync(journalPath) ? JSON.parse(fs.readFileSync(journalPath, 'utf8')) : { fingerprint, steps: {}, contracts: {} };
  if (state.fingerprint !== fingerprint) throw Error('Plan o bytecode cambió');
  const persist = () => { fs.writeFileSync(journalPath + '.tmp', JSON.stringify(state, null, 2), { mode: 0o600 }); fs.renameSync(journalPath + '.tmp', journalPath); };
  let processed = 0;
  async function send(label, request) {
    let step = state.steps[label];
    if (!step) {
      const gasLimit = (await wallet.estimateGas(request)) * 120n / 100n;
      if (gasLimit > 6_000_000n) throw Error('Límite de gas excedido');
      const populated = await wallet.populateTransaction({ ...request, gasLimit });
      const upperCost = gasLimit * BigInt(populated.maxFeePerGas || populated.gasPrice);
      const reserved = Object.values(state.steps).reduce((sum, value) => sum + BigInt(value.upperCost), 0n);
      if ((local && reserved + upperCost > BigInt(maxWei)) || upperCost > await ethers.provider.getBalance(wallet.address)) throw Error('Saldo o presupuesto insuficiente');
      const raw = await wallet.signTransaction(populated);
      step = { raw, hash: ethers.keccak256(raw), nonce: populated.nonce, upperCost: upperCost.toString(), requestHash: ethers.id(JSON.stringify({ to: request.to || null, data: request.data, value: String(request.value || 0) })) };
      state.steps[label] = step; persist();
    }
    const signed = ethers.Transaction.from(step.raw);
    const requestHash = ethers.id(JSON.stringify({ to: request.to || null, data: request.data, value: String(request.value || 0) }));
    if (step.requestHash !== requestHash || signed.hash !== step.hash || signed.from.toLowerCase() !== wallet.address.toLowerCase() || signed.chainId !== chainId || signed.nonce !== step.nonce || (signed.to || null) !== (request.to || null) || signed.data !== request.data || signed.value !== BigInt(request.value || 0)) throw Error(`Diario inconsistente: ${label}`);
    const signedCost = signed.gasLimit * BigInt(signed.maxFeePerGas || signed.gasPrice);
    if (signedCost !== BigInt(step.upperCost)) throw Error(`Coste inconsistente: ${label}`);
    let receipt = await ethers.provider.getTransactionReceipt(step.hash);
    if (!receipt) {
      if (await ethers.provider.getTransactionCount(wallet.address, 'latest') > step.nonce) throw Error('Nonce consumido por otra transacción');
      const known = await ethers.provider.getTransaction(step.hash);
      const pending = known || await ethers.provider.broadcastTransaction(step.raw);
      receipt = await pending.wait(demo ? 2 : 1, 120000);
    }
    if (!receipt || receipt.status !== 1) throw Error(`Transacción fallida o pendiente: ${label}`);
    if (demo) {
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      if (!block || block.hash !== receipt.blockHash || (await ethers.provider.getBlockNumber()) < receipt.blockNumber + 1) throw Error('Confirmaciones insuficientes o reorganización');
    }
    const rawReceipt = await ethers.provider.send('eth_getTransactionReceipt', [step.hash]);
    step.observedGasWei = (receipt.gasUsed * receipt.gasPrice).toString();
    if (rawReceipt.l1Fee != null) step.observedL1FeeWei = BigInt(rawReceipt.l1Fee).toString();
    if (rawReceipt.operatorFee != null) step.observedOperatorFeeWei = BigInt(rawReceipt.operatorFee).toString();
    step.confirmed = true; step.blockNumber = receipt.blockNumber; persist();
    if (++processed === stopAfter) throw Error('INTERRUPCION_SIMULADA');
    return receipt;
  }
  async function deploy(name, args = []) {
    const a = artifacts[name], factory = new ethers.ContractFactory(a.abi, a.bytecode, wallet);
    const receipt = await send('deploy:' + name, await factory.getDeployTransaction(...args));
    const address = receipt.contractAddress || ethers.getCreateAddress({ from: wallet.address, nonce: state.steps['deploy:' + name].nonce });
    if (await ethers.provider.getCode(address) === '0x') throw Error(`Contrato sin código: ${name}`);
    if (state.contracts[name] && state.contracts[name].toLowerCase() !== address.toLowerCase()) throw Error('Dirección inconsistente');
    state.contracts[name] = address; persist(); return new ethers.Contract(address, a.abi, wallet);
  }
  async function link(label, contract, method, args) { await send(label, await contract[method].populateTransaction(...args)); }
  const m = await deploy('ProtocolModeController', [plan.guardian]);
  if (await m.mode() !== 1n) throw Error('Modo congelado requerido');
  const risk = await deploy('RiskRegistry', [plan.riskOperator]);
  const cfg = await deploy('ProtocolConfig', [plan.maxPayment, plan.duration, plan.commissionBps]);
  const auth = await deploy('PaymentAuthorization'); const ledger = await deploy('CommitmentLedger');
  const blue = await deploy('BlueTokenV6', [risk.target]); const red = await deploy('RedTokenV6');
  const treasury = await deploy('ProtocolTreasuryV6', [blue.target]);
  const pair = await deploy('PairedSupplyController', [blue.target, red.target, m.target]);
  const engine = await deploy('PaymentEngine', [m.target, risk.target, cfg.target, auth.target, ledger.target, pair.target, blue.target, red.target, treasury.target]);
  const extension = await deploy('ExtensionManager', [m.target, risk.target, ledger.target, engine.target]);
  const usdt = await deploy('MockERC20', ['Demo USDT', 'USDT', 6]);
  const ecfg = await deploy('ExchangeConfig', [treasury.target, plan.exchangeFeeBps]); const book = await deploy('FifoOrderBook');
  const custody = await deploy('ExchangeCustody', [blue.target, usdt.target]);
  const adapter = await deploy('AmortizationAdapter', [m.target, book.target, custody.target]);
  const router = await deploy('ExchangeRouter', [m.target, risk.target, book.target, custody.target, ecfg.target, adapter.target]);
  const vault = await deploy('CollateralVaultV6', [usdt.target, m.target, risk.target, engine.target, router.target, adapter.target, custody.target]);
  await link('blue-pair', blue, 'setSupplyController', [pair.target]); await link('red-pair', red, 'setSupplyController', [pair.target]);
  await link('treasury-engine', treasury, 'setCoreProtocol', [engine.target]);
  await link('blue-exchange', blue, 'setExchange', [custody.target]); await link('auth-engine', auth, 'setPaymentEngine', [engine.target]);
  await link('ledger-engine', ledger, 'setPaymentEngine', [engine.target]); await link('pair-engine', pair, 'setOperator', [engine.target, true]);
  await link('engine-extension', engine, 'setExtensionManager', [extension.target]); await link('engine-vault', engine, 'setCollateralVault', [vault.target]);
  await link('book-router', book, 'setRouter', [router.target]); await link('custody-links', custody, 'setIntegration', [router.target, ecfg.target]);
  await link('adapter-links', adapter, 'setIntegration', [router.target, vault.target]);
  const eq = (a,b) => a.toLowerCase() === b.toLowerCase();
  const checks = [[await treasury.coreProtocol(),engine.target], [await engine.treasury(),treasury.target], [await ecfg.treasury(),treasury.target], [await blue.supplyController(),pair.target], [await red.supplyController(),pair.target], [await blue.exchange(),custody.target], [await auth.paymentEngine(),engine.target], [await ledger.paymentEngine(),engine.target], [await engine.extensionManager(),extension.target], [await engine.collateralVault(),vault.target], [await book.router(),router.target], [await custody.router(),router.target], [await custody.config(),ecfg.target], [await adapter.router(),router.target], [await adapter.vault(),vault.target]];
  if (checks.some(([a,b]) => !eq(a,b)) || !(await pair.operators(engine.target)) || await m.mode() !== 1n || await blue.totalSupply() !== 0n || await red.totalSupply() !== 0n) throw Error('Verificación final falló');
  state.verified = true; persist(); return state;
}

async function deploySuite(args) {
  let lock;
  const lockPath = args.journalPath + '.lock';
  try {
    lock = fs.openSync(lockPath, 'wx', 0o600);
    return await deploySuiteCore(args);
  } finally {
    if (lock !== undefined) { fs.closeSync(lock); fs.unlinkSync(lockPath); }
  }
}
module.exports = { deploySuite };
if (require.main === module) {
  (async () => {
    if (hre.network.name !== 'optimismSepolia' || process.env.ALLOW_V6_DEMO_DEPLOY !== 'true') throw Error('Despliegue explícito Demo no habilitado');
    if (!process.env.V6_DEMO_PLAN || !process.env.V6_DEMO_JOURNAL || !process.env.DEPLOYER_PRIVATE_KEY) throw Error('Faltan plan, diario o firmante Demo');
    const plan = JSON.parse(fs.readFileSync(process.env.V6_DEMO_PLAN, 'utf8'));
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, ethers.provider);
    const result = await deploySuite({ wallet, plan, journalPath: path.resolve(process.env.V6_DEMO_JOURNAL), allowDemo: true });
    console.log(JSON.stringify({ verified: result.verified, contracts: result.contracts, journal: path.resolve(process.env.V6_DEMO_JOURNAL) }, null, 2));
  })().catch(e => { console.error('V6_DEMO_STOPPED:', e.shortMessage || e.message); process.exitCode = 1; });
}
