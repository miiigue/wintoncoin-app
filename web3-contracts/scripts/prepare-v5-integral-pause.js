'use strict';

/**
 * Prepara un paquete NO firmado para pausar o reanudar la suite V5 de Demo.
 *
 * Controles deliberados:
 * - no carga dotenv, claves ni wallets;
 * - no dispone de ninguna ruta para transmitir transacciones;
 * - valida chain, bytecode, owner y estado antes de proponer nonces/gas;
 * - marca siempre el paquete como no autorizado para ejecución.
 */
const fs = require('fs');
const path = require('path');
const {
  Interface,
  JsonRpcProvider,
  FetchRequest,
  getAddress,
  keccak256,
  toUtf8Bytes,
} = require('ethers');

const EXPECTED_CHAIN_ID = 11155420n;
const EXPECTED_EPOCH = 'V5_CODEX_163';
const EXPECTED_FINGERPRINT = '0xa4fbb3c5518e2f8d0a4c2257fcc3f802697ee5c3a3ad2de75f15f1ece98fddb1';
const EXPECTED_OWNER = '0x7d2C6c16EDe986a8bea0204A9824b4C264256C77';
const DEFAULT_RPC = 'https://sepolia.optimism.io';
const SUITE_KEYS = ['CoreProtocol', 'CollateralVault', 'FifoExchange', 'BlueToken', 'RedToken', 'USDT', 'ProtocolTreasury'];
const CONTRACT_KEYS = ['CoreProtocol', 'FifoExchange', 'CollateralVault', 'ProtocolTreasury'];
const PAUSE_ORDER = ['CoreProtocol', 'FifoExchange', 'ProtocolTreasury', 'CollateralVault'];
const UNPAUSE_ORDER = [...PAUSE_ORDER].reverse();
const GAS_LIMIT_MARGIN_BPS = 12_500n;
const DEFAULT_BALANCE_MARGIN_BPS = 20_000n;
const DEFAULT_L1_FEE_BUFFER_WEI = 1_000_000_000_000_000n;
const DEFAULT_MAX_RPC_BLOCK_DRIFT = 100;
const DEFAULT_RPC_TIMEOUT_MS = 15_000;
const EXPECTED_CODE_HASHES = {
  CoreProtocol: '0x70e93a41f0855de64cdff28d7de8ef252fd6759b7ac799bfee7051d869f85f68',
  FifoExchange: '0x569fd4b08a9989c531c0f3c8528b76bfd3fdde0187ff3c3ff283819a3a5441c5',
  CollateralVault: '0xffdb50bc0796b2e2cf3da9e6e42d5249315c9e4aa8d20af097632d67f7f1bd43',
  ProtocolTreasury: '0xed770336308238f329f6e8378c5d7bd055432bec8ac286ef6b807a3e3e348c27',
};
const ABI = new Interface([
  'function owner() view returns (address)',
  'function paused() view returns (bool)',
  'function pause()',
  'function unpause()',
]);

function fail(code, details) {
  const error = new Error(code);
  error.code = code;
  if (details) error.details = details;
  throw error;
}

function parseArgs(argv) {
  const result = {
    action: 'pause',
    rpc: DEFAULT_RPC,
    rpcSecondary: null,
    manifest: path.resolve(__dirname, '..', 'deployment-manifest-v4.json'),
    out: null,
    balanceMarginBps: DEFAULT_BALANCE_MARGIN_BPS,
    l1FeeBufferWei: DEFAULT_L1_FEE_BUFFER_WEI,
    maxRpcBlockDrift: DEFAULT_MAX_RPC_BLOCK_DRIFT,
    rpcTimeoutMs: DEFAULT_RPC_TIMEOUT_MS,
  };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === '--action') result.action = argv[++i];
    else if (value === '--rpc') result.rpc = argv[++i];
    else if (value === '--rpc-secondary') result.rpcSecondary = argv[++i];
    else if (value === '--manifest') result.manifest = path.resolve(argv[++i]);
    else if (value === '--out') result.out = path.resolve(argv[++i]);
    else if (value === '--balance-margin-bps') result.balanceMarginBps = BigInt(argv[++i]);
    else if (value === '--l1-fee-buffer-wei') result.l1FeeBufferWei = BigInt(argv[++i]);
    else if (value === '--max-rpc-block-drift') result.maxRpcBlockDrift = Number(argv[++i]);
    else if (value === '--rpc-timeout-ms') result.rpcTimeoutMs = Number(argv[++i]);
    else if (value === '--help') result.help = true;
    else fail('UNKNOWN_ARGUMENT', value);
  }
  if (!['pause', 'unpause'].includes(result.action)) fail('INVALID_ACTION', result.action);
  if (!result.rpc || typeof result.rpc !== 'string') fail('RPC_REQUIRED');
  if (!result.rpcSecondary || typeof result.rpcSecondary !== 'string') fail('SECONDARY_RPC_REQUIRED');
  if (result.balanceMarginBps < 10_000n || result.balanceMarginBps > 100_000n) fail('INVALID_BALANCE_MARGIN_BPS');
  if (result.l1FeeBufferWei < 0n) fail('INVALID_L1_FEE_BUFFER');
  if (!Number.isSafeInteger(result.maxRpcBlockDrift) || result.maxRpcBlockDrift < 0 || result.maxRpcBlockDrift > 10_000) fail('INVALID_RPC_BLOCK_DRIFT');
  if (!Number.isSafeInteger(result.rpcTimeoutMs) || result.rpcTimeoutMs < 1_000 || result.rpcTimeoutMs > 60_000) fail('INVALID_RPC_TIMEOUT');
  return result;
}

function providerConnection(url, timeoutMs) {
  const request = new FetchRequest(url);
  request.timeout = timeoutMs;
  return request;
}

function validateManifest(manifest) {
  if (BigInt(manifest.chainId) !== EXPECTED_CHAIN_ID) fail('WRONG_MANIFEST_CHAIN');
  const contracts = {};
  for (const key of SUITE_KEYS) {
    if (!manifest.contracts?.[key]) fail('MISSING_CONTRACT', key);
    contracts[key] = getAddress(manifest.contracts[key]);
  }
  const unique = new Set(Object.values(contracts).map(value => value.toLowerCase()));
  if (unique.size !== SUITE_KEYS.length) fail('DUPLICATE_CONTRACT_ADDRESS');
  const fingerprint = keccak256(toUtf8Bytes(JSON.stringify({
    chainId: EXPECTED_CHAIN_ID.toString(),
    epoch: EXPECTED_EPOCH,
    contracts,
  })));
  if (fingerprint !== EXPECTED_FINGERPRINT) fail('V5_FINGERPRINT_MISMATCH', { fingerprint });
  if (getAddress(manifest.deployer) !== getAddress(EXPECTED_OWNER)) fail('MANIFEST_OWNER_MISMATCH');
  return contracts;
}

function operationOrder(action) {
  return action === 'pause' ? PAUSE_ORDER : UNPAUSE_ORDER;
}

function unsignedTemplate(contracts, action) {
  const method = action === 'pause' ? 'pause' : 'unpause';
  return operationOrder(action).map((key, sequence) => ({
    sequence: sequence + 1,
    contract: key,
    to: contracts[key],
    value: '0',
    data: ABI.encodeFunctionData(method),
    method,
  }));
}

async function inspectContract(provider, key, address, expectedCodeHashes = EXPECTED_CODE_HASHES) {
  const code = await provider.getCode(address, 'latest');
  if (code === '0x') fail('CONTRACT_HAS_NO_BYTECODE', { key, address });
  const [ownerRaw, pausedRaw] = await Promise.all([
    provider.call({ to: address, data: ABI.encodeFunctionData('owner') }, 'latest'),
    provider.call({ to: address, data: ABI.encodeFunctionData('paused') }, 'latest'),
  ]);
  const bytecodeHash = keccak256(code);
  if (expectedCodeHashes[key] && bytecodeHash !== expectedCodeHashes[key]) {
    fail('BYTECODE_HASH_MISMATCH', { key, address, expected: expectedCodeHashes[key], actual: bytecodeHash });
  }
  const owner = getAddress(ABI.decodeFunctionResult('owner', ownerRaw)[0]);
  if (owner !== getAddress(EXPECTED_OWNER)) fail('CONTRACT_OWNER_MISMATCH', { key, owner });
  return {
    key,
    address,
    bytecodeHash,
    owner,
    paused: Boolean(ABI.decodeFunctionResult('paused', pausedRaw)[0]),
  };
}

async function readAddress(provider, to, signature) {
  const iface = new Interface([`function ${signature} view returns(address)`]);
  const name = signature.slice(0, signature.indexOf('('));
  const raw = await provider.call({ to, data: iface.encodeFunctionData(name) }, 'latest');
  return getAddress(iface.decodeFunctionResult(name, raw)[0]);
}

async function validateSuiteIdentity(provider, contracts, expectedCodeHashes = EXPECTED_CODE_HASHES) {
  const codeHashes = {};
  for (const key of SUITE_KEYS) {
    const code = await provider.getCode(contracts[key], 'latest');
    if (code === '0x') fail('CONTRACT_HAS_NO_BYTECODE', { key, address: contracts[key] });
    codeHashes[key] = keccak256(code);
  }
  for (const [key, expected] of Object.entries(expectedCodeHashes)) {
    if (codeHashes[key] !== expected) fail('BYTECODE_HASH_MISMATCH', { key, expected, actual: codeHashes[key] });
  }
  const links = [
    [await readAddress(provider, contracts.CoreProtocol, 'blueToken()'), 'BlueToken'],
    [await readAddress(provider, contracts.CoreProtocol, 'redToken()'), 'RedToken'],
    [await readAddress(provider, contracts.CoreProtocol, 'vault()'), 'CollateralVault'],
    [await readAddress(provider, contracts.CoreProtocol, 'treasury()'), 'ProtocolTreasury'],
    [await readAddress(provider, contracts.CollateralVault, 'collateralToken()'), 'USDT'],
    [await readAddress(provider, contracts.CollateralVault, 'coreProtocol()'), 'CoreProtocol'],
    [await readAddress(provider, contracts.CollateralVault, 'exchange()'), 'FifoExchange'],
    [await readAddress(provider, contracts.FifoExchange, 'blueToken()'), 'BlueToken'],
    [await readAddress(provider, contracts.FifoExchange, 'usdtToken()'), 'USDT'],
    [await readAddress(provider, contracts.FifoExchange, 'coreProtocol()'), 'CoreProtocol'],
    [await readAddress(provider, contracts.FifoExchange, 'treasury()'), 'ProtocolTreasury'],
    [await readAddress(provider, contracts.ProtocolTreasury, 'blueToken()'), 'BlueToken'],
    [await readAddress(provider, contracts.ProtocolTreasury, 'coreProtocol()'), 'CoreProtocol'],
  ];
  for (const [actual, key] of links) {
    if (actual.toLowerCase() !== contracts[key].toLowerCase()) fail('SUITE_LINK_MISMATCH', { key, expected: contracts[key], actual });
  }
  const decimalsInterface = new Interface(['function decimals() view returns(uint8)']);
  for (const key of ['BlueToken', 'RedToken', 'USDT']) {
    const raw = await provider.call({ to: contracts[key], data: decimalsInterface.encodeFunctionData('decimals') }, 'latest');
    if (decimalsInterface.decodeFunctionResult('decimals', raw)[0] !== 6n) fail('TOKEN_DECIMALS_MISMATCH', key);
  }
  return { codeHashes, linksValidated: links.length, tokenDecimals: 6 };
}

async function buildPackage({
  provider,
  secondaryProvider,
  manifest,
  action,
  balanceMarginBps = DEFAULT_BALANCE_MARGIN_BPS,
  l1FeeBufferWei = DEFAULT_L1_FEE_BUFFER_WEI,
  maxRpcBlockDrift = DEFAULT_MAX_RPC_BLOCK_DRIFT,
  expectedCodeHashes = EXPECTED_CODE_HASHES,
  now = () => new Date(),
}) {
  if (balanceMarginBps < 10_000n || balanceMarginBps > 100_000n) fail('INVALID_BALANCE_MARGIN_BPS');
  if (l1FeeBufferWei < 0n) fail('INVALID_L1_FEE_BUFFER');
  if (!secondaryProvider) fail('SECONDARY_RPC_REQUIRED');
  const [network, secondaryNetwork] = await Promise.all([provider.getNetwork(), secondaryProvider.getNetwork()]);
  for (const actual of [network.chainId, secondaryNetwork.chainId]) if (actual !== EXPECTED_CHAIN_ID) {
    fail('WRONG_RPC_CHAIN', { expected: EXPECTED_CHAIN_ID.toString(), actual: actual.toString() });
  }
  const contracts = validateManifest(manifest);
  const [primaryIdentity, secondaryIdentity] = await Promise.all([
    validateSuiteIdentity(provider, contracts, expectedCodeHashes),
    validateSuiteIdentity(secondaryProvider, contracts, expectedCodeHashes),
  ]);
  for (const key of SUITE_KEYS) if (primaryIdentity.codeHashes[key] !== secondaryIdentity.codeHashes[key]) {
    fail('RPC_BYTECODE_DISAGREEMENT', key);
  }
  const inspected = [];
  for (const key of CONTRACT_KEYS) inspected.push(await inspectContract(provider, key, contracts[key], expectedCodeHashes));
  const secondaryInspected = [];
  for (const key of CONTRACT_KEYS) secondaryInspected.push(await inspectContract(secondaryProvider, key, contracts[key], expectedCodeHashes));
  for (const item of inspected) {
    const second = secondaryInspected.find(candidate => candidate.key === item.key);
    if (item.owner !== second.owner || item.paused !== second.paused || item.bytecodeHash !== second.bytecodeHash) {
      fail('RPC_CONTRACT_STATE_DISAGREEMENT', item.key);
    }
  }
  const owners = new Set(inspected.map(item => item.owner.toLowerCase()));
  if (owners.size !== 1) fail('OWNERS_NOT_UNIFORM', inspected.map(({ key, owner }) => ({ key, owner })));
  const owner = inspected[0].owner;
  const ownerCode = await provider.getCode(owner, 'latest');
  if (ownerCode !== '0x') fail('OWNER_IS_CONTRACT_REQUIRES_GOVERNANCE_FLOW', { owner, codeHash: keccak256(ownerCode) });

  const [latest, finalized, pendingNonce, latestNonce, ownerBalance, feeData,
    secondaryLatest, secondaryFinalized, secondaryPendingNonce, secondaryLatestNonce, secondaryOwnerBalance, secondaryFeeData] = await Promise.all([
    provider.getBlock('latest'),
    provider.getBlock('finalized'),
    provider.getTransactionCount(owner, 'pending'),
    provider.getTransactionCount(owner, 'latest'),
    provider.getBalance(owner, 'latest'),
    provider.getFeeData(),
    secondaryProvider.getBlock('latest'),
    secondaryProvider.getBlock('finalized'),
    secondaryProvider.getTransactionCount(owner, 'pending'),
    secondaryProvider.getTransactionCount(owner, 'latest'),
    secondaryProvider.getBalance(owner, 'latest'),
    secondaryProvider.getFeeData(),
  ]);
  if (!latest || !finalized || !secondaryLatest || !secondaryFinalized) fail('BLOCK_CONTEXT_UNAVAILABLE');
  const latestDrift = Math.abs(latest.number - secondaryLatest.number);
  const finalizedDrift = Math.abs(finalized.number - secondaryFinalized.number);
  if (latestDrift > maxRpcBlockDrift || finalizedDrift > maxRpcBlockDrift) {
    fail('RPC_BLOCK_DRIFT_EXCEEDED', { latestDrift, finalizedDrift, maxRpcBlockDrift });
  }
  if (pendingNonce !== secondaryPendingNonce || latestNonce !== secondaryLatestNonce) {
    fail('RPC_NONCE_DISAGREEMENT', { pendingNonce, secondaryPendingNonce, latestNonce, secondaryLatestNonce });
  }
  const effectiveOwnerBalance = ownerBalance < secondaryOwnerBalance ? ownerBalance : secondaryOwnerBalance;

  const desiredPaused = action === 'pause';
  const transactions = [];
  let nonceOffset = 0;
  for (const key of operationOrder(action)) {
    const contract = inspected.find(item => item.key === key);
    if (contract.paused === desiredPaused) continue;
    const method = desiredPaused ? 'pause' : 'unpause';
    const data = ABI.encodeFunctionData(method);
    const request = { from: owner, to: contract.address, data, value: 0n };
    await Promise.all([provider.call(request, 'latest'), secondaryProvider.call(request, 'latest')]);
    const [primaryEstimate, secondaryEstimate] = await Promise.all([provider.estimateGas(request), secondaryProvider.estimateGas(request)]);
    const estimate = primaryEstimate > secondaryEstimate ? primaryEstimate : secondaryEstimate;
    const gasLimit = estimate * GAS_LIMIT_MARGIN_BPS / 10_000n;
    transactions.push({
      sequence: transactions.length + 1,
      contract: key,
      to: contract.address,
      from: owner,
      nonce: pendingNonce + nonceOffset++,
      value: '0',
      data,
      method,
      gasEstimate: estimate.toString(),
      proposedGasLimit: gasLimit.toString(),
      simulation: 'PASS_AT_LATEST_WITHOUT_STATE_CHANGE',
    });
  }

  const primaryFeeCap = feeData.maxFeePerGas ?? feeData.gasPrice;
  const secondaryFeeCap = secondaryFeeData.maxFeePerGas ?? secondaryFeeData.gasPrice;
  const feeCap = primaryFeeCap && secondaryFeeCap
    ? (primaryFeeCap > secondaryFeeCap ? primaryFeeCap : secondaryFeeCap)
    : (primaryFeeCap ?? secondaryFeeCap);
  if (transactions.length > 0 && (!feeCap || feeCap <= 0n)) fail('FEE_CAP_UNAVAILABLE');
  const totalGasLimit = transactions.reduce((sum, tx) => sum + BigInt(tx.proposedGasLimit), 0n);
  const executionGasCapWei = totalGasLimit * (feeCap ?? 0n);
  const executionWithMarginWei = executionGasCapWei * balanceMarginBps / 10_000n;
  const requiredOwnerBalanceWei = transactions.length > 0 ? executionWithMarginWei + l1FeeBufferWei : 0n;
  if (effectiveOwnerBalance < requiredOwnerBalanceWei) {
    fail('OWNER_GAS_BALANCE_INSUFFICIENT', {
      ownerBalanceWei: effectiveOwnerBalance.toString(),
      requiredOwnerBalanceWei: requiredOwnerBalanceWei.toString(),
      totalGasLimit: totalGasLimit.toString(),
      feeCapWei: (feeCap ?? 0n).toString(),
    });
  }

  const proposal = {
    schema: 'wintoncoin.v5.integral-pause-package.v1',
    generatedAt: now().toISOString(),
    environment: 'Demo / Optimism Sepolia',
    epoch: EXPECTED_EPOCH,
    fingerprint: EXPECTED_FINGERPRINT,
    action,
    chainId: EXPECTED_CHAIN_ID.toString(),
    latestBlock: latest.number,
    finalizedBlock: finalized.number,
    rpcConsensus: {
      sources: 2,
      primary: { latestBlock: latest.number, finalizedBlock: finalized.number, latestNonce, pendingNonce },
      secondary: { latestBlock: secondaryLatest.number, finalizedBlock: secondaryFinalized.number, latestNonce: secondaryLatestNonce, pendingNonce: secondaryPendingNonce },
      latestDrift,
      finalizedDrift,
      maxRpcBlockDrift,
      bytecodeAndLinksAgree: true,
    },
    owner,
    ownerKind: 'EOA',
    ownerBalanceWei: effectiveOwnerBalance.toString(),
    pendingNonce,
    feeSnapshot: {
      gasPrice: feeData.gasPrice?.toString() ?? null,
      maxFeePerGas: feeData.maxFeePerGas?.toString() ?? null,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() ?? null,
      note: 'Snapshot informativo; recalcular antes de cualquier aprobación de ejecución. No incluye garantía exacta de tarifa L1.',
    },
    gasBudget: {
      transactionCount: transactions.length,
      totalProposedGasLimit: totalGasLimit.toString(),
      feeCapWei: (feeCap ?? 0n).toString(),
      executionGasCapWei: executionGasCapWei.toString(),
      balanceMarginBps: balanceMarginBps.toString(),
      executionWithMarginWei: executionWithMarginWei.toString(),
      l1FeeBufferWei: l1FeeBufferWei.toString(),
      requiredOwnerBalanceWei: requiredOwnerBalanceWei.toString(),
      ownerBalanceWei: effectiveOwnerBalance.toString(),
      sufficient: effectiveOwnerBalance >= requiredOwnerBalanceWei,
      note: 'Fail-closed: combina gas L2 con margen configurable y reserva explícita para tarifa de datos L1.',
    },
    suiteIdentity: primaryIdentity,
    contracts: inspected,
    transactions,
    oppositeActionTemplate: unsignedTemplate(contracts, action === 'pause' ? 'unpause' : 'pause'),
    executionProperties: {
      atomic: false,
      reason: 'El owner actual es EOA y requiere una transacción separada por contrato.',
      order: operationOrder(action),
      stopAfterEveryTransactionForVerification: true,
    },
    authorization: {
      preparedOnly: true,
      signed: false,
      broadcast: false,
      approvedForExecution: false,
      requiredNextApproval: 'Aprobación expresa de Miguel después de revisión independiente y preflight actualizado.',
    },
    mandatoryPreconditions: [
      'Prelanzamiento permanece activo en el backend.',
      'Chain ID, direcciones, bytecode y owners vuelven a validarse inmediatamente antes de firmar.',
      'Nonce y tarifas se recalculan; no se reutilizan ciegamente desde este paquete.',
      'Se verifica gas suficiente del owner sin revelar claves.',
      'No existen transacciones pendientes del owner que puedan alterar la secuencia.',
      'Auditor independiente aprueba la simulación y el plan de rollback.',
    ],
  };
  proposal.packageHash = keccak256(toUtf8Bytes(JSON.stringify(proposal)));
  return proposal;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write('Uso: node prepare-v5-integral-pause.js --rpc-secondary URL_PUBLICA_INDEPENDIENTE [--action pause|unpause] [--rpc URL_PUBLICA] [--manifest RUTA] [--out ARCHIVO_NUEVO]\n');
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(args.manifest, 'utf8'));
  // Algunos RPC públicos rechazan lotes JSON-RPC aun cuando aceptan las mismas
  // consultas por separado. Desactivar batching evita falsos negativos 400 sin
  // reducir las validaciones independientes.
  const providerOptions = { staticNetwork: true, batchMaxCount: 1 };
  const provider = new JsonRpcProvider(providerConnection(args.rpc, args.rpcTimeoutMs), Number(EXPECTED_CHAIN_ID), providerOptions);
  const secondaryProvider = new JsonRpcProvider(providerConnection(args.rpcSecondary, args.rpcTimeoutMs), Number(EXPECTED_CHAIN_ID), providerOptions);
  const proposal = await buildPackage({
    provider,
    secondaryProvider,
    manifest,
    action: args.action,
    balanceMarginBps: args.balanceMarginBps,
    l1FeeBufferWei: args.l1FeeBufferWei,
    maxRpcBlockDrift: args.maxRpcBlockDrift,
  });
  const output = JSON.stringify(proposal, null, 2) + '\n';
  if (args.out) fs.writeFileSync(args.out, output, { encoding: 'utf8', flag: 'wx' });
  else process.stdout.write(output);
  provider.destroy();
  secondaryProvider.destroy();
}

if (require.main === module) {
  main().catch(error => {
    const report = {
      success: false,
      code: error.code || 'PREPARATION_FAILED',
      details: error.details || null,
      message: error.shortMessage || error.message || 'Fallo no identificado durante la preparación',
    };
    process.stderr.write(JSON.stringify(report) + '\n');
    process.exitCode = 1;
  });
}

module.exports = {
  CONTRACT_KEYS,
  SUITE_KEYS,
  PAUSE_ORDER,
  UNPAUSE_ORDER,
  DEFAULT_BALANCE_MARGIN_BPS,
  DEFAULT_L1_FEE_BUFFER_WEI,
  DEFAULT_RPC_TIMEOUT_MS,
  ABI,
  parseArgs,
  validateManifest,
  operationOrder,
  unsignedTemplate,
  buildPackage,
};
