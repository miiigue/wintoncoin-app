'use strict';

const { Contract, getAddress, isAddress } = require('ethers');

const REQUIRED_CONTRACTS = Object.freeze([
  'CoreProtocol',
  'BlueToken',
  'RedToken',
  'CollateralVault',
  'FifoExchange',
  'USDT',
]);

const ABIS = Object.freeze({
  token: [
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
  ],
  blue: [
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function lockedBalanceOf(address) view returns (uint256)',
    'function parkingLotsCount(address) view returns (uint256)',
    'function parkingLots(address,uint256) view returns (uint256 remaining,uint256 releaseAt)',
  ],
  core: [
    'function isKYCVerified(address) view returns (bool)',
    'function creditLimits(address) view returns (uint256)',
    'function userLevels(address) view returns (uint8)',
    'function extensionMarginLimits(address) view returns (uint256)',
    'function extensionMarginUsed(address) view returns (uint256)',
    'function paymentNonces(address) view returns (uint256)',
    'function getUserDebtLotsCount(address) view returns (uint256)',
    'function userDebtLots(address,uint256) view returns (uint256 id,uint256 amount,uint256 remainingAmount,uint256 dueAt,bool repaid)',
  ],
  vault: [
    'function userCollateral(address) view returns (uint256)',
    'function exchangeReserved(address) view returns (uint256)',
    'function pendingReserve(address) view returns (uint256)',
    'function activeAmortizationOrder(address) view returns (uint64)',
    'function pendingMaturedOnly(address) view returns (bool)',
    'function automaticExchangeCollateral(address) view returns (bool)',
    'function totalCollateralLocked() view returns (uint256)',
    'function totalExchangeReserved() view returns (uint256)',
  ],
  exchange: [
    'function nextOrderId() view returns (uint64)',
    'function orders(uint64) view returns (uint64 id,uint64 sequenceId,uint128 remainingAmount,address user,uint8 status,uint8 side,uint48 createdAt,uint128 originalAmount,uint128 refundedAmount)',
    'function isAmortizationOrder(uint64) view returns (bool)',
    'function exchangeCollateralized(uint64) view returns (uint128)',
    'function pendingRefundBlue(address) view returns (uint128)',
    'function pendingRefundUsdt(address) view returns (uint128)',
    'function totalPendingRefundBlue() view returns (uint128)',
    'function totalPendingRefundUsdt() view returns (uint128)',
    'function totalReservedBlue() view returns (uint128)',
    'function totalReservedUsdt() view returns (uint128)',
    'function accumulatedFeesBlue() view returns (uint128)',
    'function accumulatedFeesUsdt() view returns (uint128)',
  ],
});

const ZERO = '0';

function normalize(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (!/^\d+$/.test(key)) result[key] = normalize(item);
    }
    return result;
  }
  return value;
}

function sanitizeError(error) {
  const raw = error && (error.shortMessage || error.reason || error.code || error.message);
  return String(raw || 'lectura fallida').replace(/https?:\/\/\S+/g, '[RPC]').slice(0, 240);
}

function validateConfig(config) {
  const errors = [];
  if (!config || config.schemaVersion !== 1) errors.push('schemaVersion debe ser 1');
  if (!config || !/^\d+$/.test(String(config.chainId || ''))) errors.push('chainId es obligatorio');
  if (!config || !config.walletInventory || config.walletInventory.complete !== true) {
    errors.push('walletInventory.complete debe ser true; los mappings no se pueden descubrir de forma exhaustiva por RPC');
  }
  if (!config || !Array.isArray(config.wallets) || config.wallets.length === 0) {
    errors.push('wallets debe contener al menos una dirección');
  }
  const seen = new Set();
  for (const wallet of (config && config.wallets) || []) {
    if (!isAddress(wallet)) errors.push(`wallet inválida: ${wallet}`);
    else {
      const canonical = getAddress(wallet);
      if (seen.has(canonical)) errors.push(`wallet duplicada: ${canonical}`);
      seen.add(canonical);
    }
  }
  for (const suiteName of ['sourceSuite', 'destinationSuite']) {
    const suite = config && config[suiteName];
    if (!suite || !suite.contracts) {
      errors.push(`${suiteName}.contracts es obligatorio`);
      continue;
    }
    for (const name of REQUIRED_CONTRACTS) {
      const address = suite.contracts[name];
      if (!isAddress(address || '')) errors.push(`${suiteName}.contracts.${name} no es una dirección válida`);
    }
  }
  return errors;
}

function makeContracts(provider, suite) {
  const addresses = suite.contracts;
  return {
    BlueToken: new Contract(addresses.BlueToken, ABIS.blue, provider),
    RedToken: new Contract(addresses.RedToken, ABIS.token, provider),
    USDT: new Contract(addresses.USDT, ABIS.token, provider),
    CoreProtocol: new Contract(addresses.CoreProtocol, ABIS.core, provider),
    CollateralVault: new Contract(addresses.CollateralVault, ABIS.vault, provider),
    FifoExchange: new Contract(addresses.FifoExchange, ABIS.exchange, provider),
  };
}

async function safeRead(contract, method, args, blockTag, errors, path) {
  try {
    return normalize(await contract[method](...args, { blockTag }));
  } catch (error) {
    errors.push({ path, error: sanitizeError(error) });
    return null;
  }
}

function asCount(value, path, maximum, errors) {
  if (value === null) return null;
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    errors.push({ path, error: 'contador fuera del rango seguro de JavaScript' });
    return null;
  }
  if (count > maximum) {
    errors.push({ path, error: `contador ${count} supera el límite de ensayo ${maximum}` });
    return null;
  }
  return count;
}

async function captureUser(contracts, wallet, blockTag, limits, errors, suiteLabel) {
  const p = `${suiteLabel}.users.${wallet}`;
  const core = contracts.CoreProtocol;
  const blue = contracts.BlueToken;
  const vault = contracts.CollateralVault;
  const exchange = contracts.FifoExchange;
  const user = {
    address: wallet,
    kyc: await safeRead(core, 'isKYCVerified', [wallet], blockTag, errors, `${p}.kyc`),
    creditLimit: await safeRead(core, 'creditLimits', [wallet], blockTag, errors, `${p}.creditLimit`),
    level: await safeRead(core, 'userLevels', [wallet], blockTag, errors, `${p}.level`),
    extensionMarginLimit: await safeRead(core, 'extensionMarginLimits', [wallet], blockTag, errors, `${p}.extensionMarginLimit`),
    extensionMarginUsed: await safeRead(core, 'extensionMarginUsed', [wallet], blockTag, errors, `${p}.extensionMarginUsed`),
    paymentNonce: await safeRead(core, 'paymentNonces', [wallet], blockTag, errors, `${p}.paymentNonce`),
    blueBalance: await safeRead(blue, 'balanceOf', [wallet], blockTag, errors, `${p}.blueBalance`),
    blueLocked: await safeRead(blue, 'lockedBalanceOf', [wallet], blockTag, errors, `${p}.blueLocked`),
    redBalance: await safeRead(contracts.RedToken, 'balanceOf', [wallet], blockTag, errors, `${p}.redBalance`),
    usdtBalance: await safeRead(contracts.USDT, 'balanceOf', [wallet], blockTag, errors, `${p}.usdtBalance`),
    collateral: await safeRead(vault, 'userCollateral', [wallet], blockTag, errors, `${p}.collateral`),
    exchangeReserved: await safeRead(vault, 'exchangeReserved', [wallet], blockTag, errors, `${p}.exchangeReserved`),
    pendingReserve: await safeRead(vault, 'pendingReserve', [wallet], blockTag, errors, `${p}.pendingReserve`),
    activeAmortizationOrder: await safeRead(vault, 'activeAmortizationOrder', [wallet], blockTag, errors, `${p}.activeAmortizationOrder`),
    pendingMaturedOnly: await safeRead(vault, 'pendingMaturedOnly', [wallet], blockTag, errors, `${p}.pendingMaturedOnly`),
    automaticExchangeCollateral: await safeRead(vault, 'automaticExchangeCollateral', [wallet], blockTag, errors, `${p}.automaticExchangeCollateral`),
    pendingRefundBlue: await safeRead(exchange, 'pendingRefundBlue', [wallet], blockTag, errors, `${p}.pendingRefundBlue`),
    pendingRefundUsdt: await safeRead(exchange, 'pendingRefundUsdt', [wallet], blockTag, errors, `${p}.pendingRefundUsdt`),
    parkingLots: [],
    debtLots: [],
  };

  const parkingRaw = await safeRead(blue, 'parkingLotsCount', [wallet], blockTag, errors, `${p}.parkingLotsCount`);
  const parkingCount = asCount(parkingRaw, `${p}.parkingLotsCount`, limits.maxLotsPerWallet, errors);
  if (parkingCount !== null) {
    for (let index = 0; index < parkingCount; index += 1) {
      const lot = await safeRead(blue, 'parkingLots', [wallet, index], blockTag, errors, `${p}.parkingLots.${index}`);
      if (lot !== null) user.parkingLots.push({ index, remaining: lot[0], releaseAt: lot[1] });
    }
  }

  const debtsRaw = await safeRead(core, 'getUserDebtLotsCount', [wallet], blockTag, errors, `${p}.debtLotsCount`);
  const debtCount = asCount(debtsRaw, `${p}.debtLotsCount`, limits.maxLotsPerWallet, errors);
  if (debtCount !== null) {
    for (let index = 0; index < debtCount; index += 1) {
      const lot = await safeRead(core, 'userDebtLots', [wallet, index], blockTag, errors, `${p}.debtLots.${index}`);
      if (lot !== null) {
        user.debtLots.push({ index, id: lot[0], amount: lot[1], remainingAmount: lot[2], dueAt: lot[3], repaid: lot[4] });
      }
    }
  }
  return user;
}

async function captureSuite(provider, suite, wallets, blockTag, limits, label) {
  const errors = [];
  const contracts = makeContracts(provider, suite);
  const globals = {
    blueSupply: await safeRead(contracts.BlueToken, 'totalSupply', [], blockTag, errors, `${label}.globals.blueSupply`),
    redSupply: await safeRead(contracts.RedToken, 'totalSupply', [], blockTag, errors, `${label}.globals.redSupply`),
    blueDecimals: await safeRead(contracts.BlueToken, 'decimals', [], blockTag, errors, `${label}.globals.blueDecimals`),
    redDecimals: await safeRead(contracts.RedToken, 'decimals', [], blockTag, errors, `${label}.globals.redDecimals`),
    usdtDecimals: await safeRead(contracts.USDT, 'decimals', [], blockTag, errors, `${label}.globals.usdtDecimals`),
    vaultCollateralTokenBalance: await safeRead(contracts.USDT, 'balanceOf', [suite.contracts.CollateralVault], blockTag, errors, `${label}.globals.vaultCollateralTokenBalance`),
    exchangeUsdtTokenBalance: await safeRead(contracts.USDT, 'balanceOf', [suite.contracts.FifoExchange], blockTag, errors, `${label}.globals.exchangeUsdtTokenBalance`),
    exchangeBlueTokenBalance: await safeRead(contracts.BlueToken, 'balanceOf', [suite.contracts.FifoExchange], blockTag, errors, `${label}.globals.exchangeBlueTokenBalance`),
    totalCollateralLocked: await safeRead(contracts.CollateralVault, 'totalCollateralLocked', [], blockTag, errors, `${label}.globals.totalCollateralLocked`),
    totalExchangeReserved: await safeRead(contracts.CollateralVault, 'totalExchangeReserved', [], blockTag, errors, `${label}.globals.totalExchangeReserved`),
    totalReservedBlue: await safeRead(contracts.FifoExchange, 'totalReservedBlue', [], blockTag, errors, `${label}.globals.totalReservedBlue`),
    totalReservedUsdt: await safeRead(contracts.FifoExchange, 'totalReservedUsdt', [], blockTag, errors, `${label}.globals.totalReservedUsdt`),
    accumulatedFeesBlue: await safeRead(contracts.FifoExchange, 'accumulatedFeesBlue', [], blockTag, errors, `${label}.globals.accumulatedFeesBlue`),
    accumulatedFeesUsdt: await safeRead(contracts.FifoExchange, 'accumulatedFeesUsdt', [], blockTag, errors, `${label}.globals.accumulatedFeesUsdt`),
    totalPendingRefundBlue: await safeRead(contracts.FifoExchange, 'totalPendingRefundBlue', [], blockTag, errors, `${label}.globals.totalPendingRefundBlue`),
    totalPendingRefundUsdt: await safeRead(contracts.FifoExchange, 'totalPendingRefundUsdt', [], blockTag, errors, `${label}.globals.totalPendingRefundUsdt`),
  };

  const users = [];
  for (const wallet of wallets) users.push(await captureUser(contracts, wallet, blockTag, limits, errors, label));

  const nextOrderRaw = await safeRead(contracts.FifoExchange, 'nextOrderId', [], blockTag, errors, `${label}.globals.nextOrderId`);
  globals.nextOrderId = nextOrderRaw;
  const nextOrderId = asCount(nextOrderRaw, `${label}.globals.nextOrderId`, limits.maxOrders + 1, errors);
  const orders = [];
  if (nextOrderId !== null) {
    for (let id = 1; id < nextOrderId; id += 1) {
      const order = await safeRead(contracts.FifoExchange, 'orders', [id], blockTag, errors, `${label}.orders.${id}`);
      const amortization = await safeRead(contracts.FifoExchange, 'isAmortizationOrder', [id], blockTag, errors, `${label}.orders.${id}.amortization`);
      const collateralized = await safeRead(contracts.FifoExchange, 'exchangeCollateralized', [id], blockTag, errors, `${label}.orders.${id}.collateralized`);
      if (order !== null) {
        orders.push({
          id: order[0], sequenceId: order[1], remainingAmount: order[2], user: order[3], status: order[4], side: order[5],
          createdAt: order[6], originalAmount: order[7], refundedAmount: order[8], amortization, collateralized,
        });
      }
    }
  }
  return { label, contracts: suite.contracts, globals, users, orders, readErrors: errors };
}

function nonZero(value) {
  return value !== null && value !== undefined && String(value) !== ZERO;
}

function lessThan(left, right) {
  if (left === null || right === null || left === undefined || right === undefined) return false;
  return BigInt(left) < BigInt(right);
}

function sumValues(...values) {
  if (values.some((value) => value === null || value === undefined)) return null;
  return values.reduce((total, value) => total + BigInt(value), 0n).toString();
}

function activeLots(lots, remainingField) {
  return (lots || []).filter((lot) => nonZero(lot[remainingField]));
}

function addBlocker(blockers, code, scope, detail) {
  blockers.push({ severity: 'BLOCKER', code, scope, detail });
}

function reconcileSnapshots(source, destination, metadata = {}) {
  const blockers = [];
  const actions = [];
  const warnings = [];

  for (const error of [...(source.readErrors || []), ...(destination.readErrors || [])]) {
    addBlocker(blockers, 'INCOMPLETE_READ', error.path, error.error);
  }
  for (const suite of [source, destination]) {
    const g = suite.globals || {};
    if (g.blueSupply !== null && g.redSupply !== null && g.blueSupply !== g.redSupply) {
      addBlocker(blockers, 'PAIRED_SUPPLY_VIOLATION', suite.label, `BLUE ${g.blueSupply} != RED ${g.redSupply}`);
    }
    if (String(g.blueDecimals) !== '6' || String(g.redDecimals) !== '6') {
      addBlocker(blockers, 'TOKEN_DECIMALS_MISMATCH', suite.label, `BLUE=${g.blueDecimals}, RED=${g.redDecimals}; se requieren 6`);
    }
    if (lessThan(g.vaultCollateralTokenBalance, g.totalCollateralLocked)) {
      addBlocker(blockers, 'VAULT_INSOLVENT', suite.label, `USDT vault=${g.vaultCollateralTokenBalance} < totalCollateralLocked=${g.totalCollateralLocked}`);
    }
    const blueLiability = sumValues(g.totalReservedBlue, g.accumulatedFeesBlue, g.totalPendingRefundBlue);
    const usdtLiability = sumValues(g.totalReservedUsdt, g.accumulatedFeesUsdt, g.totalPendingRefundUsdt);
    if (blueLiability !== null && lessThan(g.exchangeBlueTokenBalance, blueLiability)) {
      addBlocker(blockers, 'EXCHANGE_BLUE_INSOLVENT', suite.label, `BLUE exchange=${g.exchangeBlueTokenBalance} < liabilities=${blueLiability}`);
    }
    if (usdtLiability !== null && lessThan(g.exchangeUsdtTokenBalance, usdtLiability)) {
      addBlocker(blockers, 'EXCHANGE_USDT_INSOLVENT', suite.label, `USDT exchange=${g.exchangeUsdtTokenBalance} < liabilities=${usdtLiability}`);
    }
  }

  const destinationByAddress = new Map((destination.users || []).map((user) => [String(user.address).toLowerCase(), user]));
  for (const oldUser of source.users || []) {
    const address = String(oldUser.address).toLowerCase();
    const newUser = destinationByAddress.get(address);
    if (!newUser) {
      addBlocker(blockers, 'WALLET_NOT_CAPTURED_IN_DESTINATION', oldUser.address, 'No existe lectura de la misma billetera en destino');
      continue;
    }
    const administrative = [
      ['kyc', 'setKYCStatus'], ['creditLimit', 'setCreditLimit'], ['level', 'setUserBenefits'], ['extensionMarginLimit', 'setUserBenefits'],
    ];
    for (const [field, setter] of administrative) {
      if (oldUser[field] !== newUser[field]) {
        actions.push({
          type: 'REVIEW_ADMINISTRATIVE_REPLAY', wallet: oldUser.address, field,
          sourceValue: oldUser[field], destinationValue: newUser[field], intendedValue: oldUser[field], setter,
          requiresOwnerApproval: true, requiresSourceEvidence: true,
        });
      }
    }
    if (nonZero(oldUser.extensionMarginUsed)) {
      addBlocker(blockers, 'EXTENSION_USAGE_NOT_IMPORTABLE', oldUser.address, `extensionMarginUsed=${oldUser.extensionMarginUsed}; no hay setter de importación`);
    }
    if (nonZero(oldUser.paymentNonce)) {
      addBlocker(blockers, 'PAYMENT_NONCE_NOT_IMPORTABLE', oldUser.address, `paymentNonce=${oldUser.paymentNonce}; no hay setter de importación y reiniciarlo habilita replay entre suites si las autorizaciones no están separadas`);
    }
    if (nonZero(oldUser.blueBalance) || nonZero(oldUser.redBalance)) {
      addBlocker(blockers, 'TOKEN_BALANCES_NOT_IMPORTABLE', oldUser.address, `BLUE=${oldUser.blueBalance}, RED=${oldUser.redBalance}; no existe puente/importador pareado por billetera`);
    }
    const parking = activeLots(oldUser.parkingLots, 'remaining');
    if (parking.length) addBlocker(blockers, 'PARKING_SCHEDULE_NOT_IMPORTABLE', oldUser.address, `${parking.length} lotes activos con releaseAt que no pueden importarse`);
    const debt = activeLots(oldUser.debtLots, 'remainingAmount');
    if (debt.length) addBlocker(blockers, 'DEBT_FIFO_NOT_IMPORTABLE', oldUser.address, `${debt.length} lotes RED activos; no existe importador que preserve id, dueAt y prelación FIFO`);
    if (nonZero(oldUser.collateral) || nonZero(oldUser.exchangeReserved) || nonZero(oldUser.pendingReserve) || nonZero(oldUser.activeAmortizationOrder)) {
      addBlocker(blockers, 'VAULT_STATE_NOT_IMPORTABLE', oldUser.address, `collateral=${oldUser.collateral}, reserved=${oldUser.exchangeReserved}, pending=${oldUser.pendingReserve}, order=${oldUser.activeAmortizationOrder}`);
    }
    if (oldUser.automaticExchangeCollateral === true) {
      warnings.push({ code: 'CONSENT_MUST_BE_REACCEPTED', wallet: oldUser.address, detail: 'No copiar consentimiento automático a otra suite sin aceptación versionada aplicable al nuevo contrato' });
    }
    if (nonZero(oldUser.pendingRefundBlue) || nonZero(oldUser.pendingRefundUsdt)) {
      addBlocker(blockers, 'REFUNDS_MUST_SETTLE_ON_SOURCE', oldUser.address, `BLUE=${oldUser.pendingRefundBlue}, USDT=${oldUser.pendingRefundUsdt}`);
    }
  }

  const activeOrders = (source.orders || []).filter((order) => ['1', '2', '5'].includes(String(order.status)) && nonZero(order.remainingAmount));
  if (activeOrders.length) {
    addBlocker(blockers, 'ORDERBOOK_NOT_IMPORTABLE', 'sourceSuite.FifoExchange', `${activeOrders.length} órdenes activas; recrearlas cambiaría sequenceId, createdAt y prioridad FIFO`);
  }
  if (nonZero((source.globals || {}).totalPendingRefundBlue) || nonZero((source.globals || {}).totalPendingRefundUsdt)) {
    addBlocker(blockers, 'UNCLAIMED_GLOBAL_REFUNDS', 'sourceSuite.FifoExchange', `BLUE=${source.globals.totalPendingRefundBlue}, USDT=${source.globals.totalPendingRefundUsdt}`);
  }
  if (nonZero((destination.globals || {}).blueSupply) || nonZero((destination.globals || {}).redSupply) || (destination.orders || []).length) {
    warnings.push({ code: 'DESTINATION_NOT_EMPTY', detail: 'El destino ya contiene estado; una migración debe conciliarlo, no asumir una suite limpia' });
  }

  const phases = [
    { order: 1, name: 'Congelar altas económicas', condition: 'Pausar nuevas operaciones en la suite fuente con aprobación humana y registrar bloque de corte' },
    { order: 2, name: 'Liquidar estado no importable', condition: 'Órdenes, refunds, reservas, parking y lotes RED deben resolverse en origen o requerir un contrato migrador auditado' },
    { order: 3, name: 'Repetir configuración administrativa', condition: 'Preparar setKYCStatus/setCreditLimit/setUserBenefits; no ejecutar desde este ensayo' },
    { order: 4, name: 'Conciliar invariante pareada', condition: 'Cada emisión/quema de migración debe ser BLUE=RED 1:1 en la misma operación; igualdad neta posterior no basta' },
    { order: 5, name: 'Reaceptar consentimiento', condition: 'La autorización de garantía automática debe ser explícita, versionada y referir a la suite destino' },
    { order: 6, name: 'Repetir inventario fijado', condition: 'Ejecutar este lector en un bloque finalizado posterior al corte; cero lecturas incompletas y cero bloqueos' },
  ];

  return {
    schemaVersion: 1,
    generatedAt: metadata.generatedAt || new Date().toISOString(),
    chainId: metadata.chainId,
    blockNumber: metadata.blockNumber,
    blockHash: metadata.blockHash,
    mode: 'READ_ONLY_DRY_RUN_FAIL_CLOSED',
    ready: blockers.length === 0,
    blockers,
    warnings,
    proposedActions: actions,
    migrationPhases: phases,
    snapshots: { source, destination },
  };
}

async function auditMigration({ provider, config, limits = {} }) {
  const validationErrors = validateConfig(config);
  if (validationErrors.length) {
    return { schemaVersion: 1, mode: 'READ_ONLY_DRY_RUN_FAIL_CLOSED', ready: false, configurationErrors: validationErrors, blockers: validationErrors.map((detail) => ({ severity: 'BLOCKER', code: 'INVALID_CONFIG', scope: 'config', detail })) };
  }
  const effectiveLimits = {
    maxOrders: Number(limits.maxOrders || config.limits?.maxOrders || 5000),
    maxLotsPerWallet: Number(limits.maxLotsPerWallet || config.limits?.maxLotsPerWallet || 1000),
  };
  const network = await provider.getNetwork();
  if (String(network.chainId) !== String(config.chainId)) {
    return { schemaVersion: 1, mode: 'READ_ONLY_DRY_RUN_FAIL_CLOSED', ready: false, blockers: [{ severity: 'BLOCKER', code: 'WRONG_CHAIN', scope: 'provider', detail: `RPC chainId=${network.chainId}; esperado=${config.chainId}` }] };
  }
  const requestedBlock = config.blockNumber === undefined ? 'finalized' : Number(config.blockNumber);
  const block = await provider.getBlock(requestedBlock);
  if (!block) throw new Error('No se pudo fijar el bloque de lectura');

  const codeErrors = [];
  for (const suiteName of ['sourceSuite', 'destinationSuite']) {
    for (const name of REQUIRED_CONTRACTS) {
      const address = config[suiteName].contracts[name];
      const code = await provider.getCode(address, block.number);
      if (code === '0x') codeErrors.push(`${suiteName}.${name} no tiene bytecode en bloque ${block.number}`);
    }
  }
  if (codeErrors.length) {
    return { schemaVersion: 1, mode: 'READ_ONLY_DRY_RUN_FAIL_CLOSED', ready: false, chainId: String(network.chainId), blockNumber: block.number, blockHash: block.hash, blockers: codeErrors.map((detail) => ({ severity: 'BLOCKER', code: 'NO_CONTRACT_CODE', scope: 'inventory', detail })) };
  }

  const wallets = config.wallets.map(getAddress);
  const source = await captureSuite(provider, config.sourceSuite, wallets, block.number, effectiveLimits, 'sourceSuite');
  const destination = await captureSuite(provider, config.destinationSuite, wallets, block.number, effectiveLimits, 'destinationSuite');
  return reconcileSnapshots(source, destination, { chainId: String(network.chainId), blockNumber: block.number, blockHash: block.hash });
}

module.exports = {
  ABIS,
  REQUIRED_CONTRACTS,
  auditMigration,
  captureSuite,
  normalize,
  reconcileSnapshots,
  validateConfig,
};
