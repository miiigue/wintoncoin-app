'use strict';

/**
 * ============================================================================
 * SUITE DE PRUEBAS UNITARIAS Y ESCENARIOS NEGATIVOS — D02 / CODEX-203
 * ============================================================================
 * Valida todas las 7 condiciones fail-closed de CODEX-203 para:
 * - `backend/src/services/v6DemoInventoryExporter.js`
 * - `backend/scripts/export-v6-demo-inventory.js`
 *
 * 100% local y determinista mediante inyección de dependencias (sin RPC real,
 * sin BD real, sin Wallet/Signer, sin secretos ni llamadas a Producción).
 * ============================================================================
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { Interface, getAddress, keccak256, toUtf8Bytes } = require('ethers');

const {
  REQUIRED_V6_CONTRACTS,
  REQUIRED_SQL_TABLES,
  exportV6DemoInventory,
  validateRpcUrlAllowlist,
  validateDatabaseUrlAllowlist,
  sanitizeText,
  sanitizeRpcUrl,
  createDefaultProvider,
  createPinnedRunner,
  withRateLimitRetry
} = require('../src/services/v6DemoInventoryExporter');
const { parseCliArgs, runCli } = require('../scripts/export-v6-demo-inventory');
const { LINKS: V6_LINKS } = require('../src/services/validateV6Demo');

// ----------------------------------------------------------------------------
// HELPERS DETERMINISTAS DE FIXTURE V6 DEMO (CHAIN ID 11155420)
// ----------------------------------------------------------------------------

const DEMO_RPC_URL = 'https://opt-sepolia.g.alchemy.com/v2/SUPER_SECRET_API_KEY_1234567890ABCDEF';
const DEMO_DB_URL = 'postgresql://demo_ro_user:UltraSecretPass123!@wintoncoin-demo-db.render.internal:5432/wintoncoin_demo_db';

const OWNER_ADDR = '0x7d2C6c16EDe986a8bea0204A9824b4C264256C77';
const USER_SQL = '0x1111111111111111111111111111111111111111';
const USER_ONCHAIN_ONLY = '0x2222222222222222222222222222222222222222';
const CORPORATE_WALLET = '0x3333333333333333333333333333333333333333';

const FINALIZED_BLOCK_NUM = 51540000;
const FINALIZED_BLOCK_HASH = '0x' + 'aa'.repeat(32);
const REORGED_BLOCK_HASH = '0x' + 'bb'.repeat(32);

const COMBINED_ABI = [
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function lockedBalanceOf(address) view returns (uint256)',
  'function availableBalanceOf(address) view returns (uint256)',
  'function parkingHead(address) view returns (uint256)',
  'function parkingLotsCount(address) view returns (uint256)',
  'function parkingLots(address,uint256) view returns (uint256 remaining, uint256 releaseAt)',
  'function nextLotId() view returns (uint256)',
  'function paymentEngine() view returns (address)',
  'function lotOwner(uint256) view returns (address)',
  'function ledgerVersion(address) view returns (uint256)',
  'function outstanding(address) view returns (uint256)',
  'function matured(address) view returns (uint256)',
  'function firstLotId(address) view returns (uint256)',
  'function lot(address,uint256) view returns (uint256 dueAt, uint256 amount, uint256 fee, uint256 margin, bool active)',
  'function owner() view returns (address)',
  'function guardian() view returns (address)',
  'function riskOperator() view returns (address)',
  'function isKYCVerified(address) view returns (bool)',
  'function profile(address) view returns (tuple(uint128 creditLimit, uint8 level, bool kycVerified))',
  'function profileUpdateVersion(address) view returns (uint256)',
  'function totalCollateral() view returns (uint256)',
  'function totalExchangeReserved() view returns (uint256)',
  'function solvent() view returns (bool)',
  'function collateralBalance(address) view returns (uint256)',
  'function freeCollateral(address) view returns (uint256)',
  'function unreservedCollateral(address) view returns (uint256)',
  'function exchangeReserved(address) view returns (uint256)',
  'function automaticExchangeCollateral(address) view returns (bool)',
  'function orderUser(uint64) view returns (address)',
  'function orderReserved(uint64) view returns (uint128)',
  'function existingOrder(uint64) view returns (bool)',
  'function router() view returns (address)',
  'function nextOrderId() view returns (uint64)',
  'function nextSequence() view returns (uint64)',
  'function queueLength(uint8) view returns (uint256)',
  'function order(uint64) view returns (tuple(uint64 id, uint64 sequence, uint128 remaining, address user, uint8 status, uint8 side, uint48 createdAt, uint128 original, uint128 refunded))',
  'function totalReserved(uint256) view returns (uint128)',
  'function totalPendingRefund(uint256) view returns (uint128)',
  'function accumulatedFees(uint256) view returns (uint128)',
  'function liabilities(uint8) view returns (uint256)',
  'function solvent(uint8) view returns (bool)',
  'function pendingRefund(address,uint8) view returns (uint128)',
  'function blueCursor() view returns (uint256)',
  'function usdtCursor() view returns (uint256)',
  'function MIN_ORDER_AMOUNT() view returns (uint128)',
  'function totalCollateralReserved() view returns (uint128)',
  'function reservation(uint64) view returns (address user, uint128 remaining)',
  'function feeBps() view returns (uint16)',
  'function treasury() view returns (address)',
  'function pendingFeeBps() view returns (uint16)',
  'function feeReadyAt() view returns (uint48)',
  'function pendingTreasury() view returns (address)',
  'function treasuryReadyAt() view returns (uint48)',
  'function corporateTreasuryWallet() view returns (address)',
  'function currentMerkleRoot() view returns (bytes32)',
  'function rewardEpoch() view returns (uint256)',
  'function activeSurplusProposal() view returns (address recipient, uint256 amount, uint256 eta, bool executed, bool cancelled)',
  'function mode() view returns (uint8)',
  'function activeConfig() view returns (tuple(uint128 maxPayment, uint48 commitmentDuration, uint16 commissionBps))',
  'function pendingConfig() view returns (tuple(uint128 maxPayment, uint48 commitmentDuration, uint16 commissionBps))',
  'function pendingUnlockAt() view returns (uint48)',
  'function operators(address) view returns (bool)',
  'function options(uint48) view returns (uint16 feeBps, uint8 minLevel, bool enabled)',
  'function pendingOptions(uint48) view returns (tuple(uint16 feeBps, uint8 minLevel, bool enabled) option, uint48 unlockAt)',
  'function nonces(address) view returns (uint256)',
  // Link getters de validateV6Demo
  'function modes() view returns (address)',
  'function risk() view returns (address)',
  'function config() view returns (address)',
  'function authorization() view returns (address)',
  'function ledger() view returns (address)',
  'function pairs() view returns (address)',
  'function blue() view returns (address)',
  'function red() view returns (address)',
  'function collateralVault() view returns (address)',
  'function extensionManager() view returns (address)',
  'function blueToken() view returns (address)',
  'function redToken() view returns (address)',
  'function coreProtocol() view returns (address)',
  'function modeController() view returns (address)',
  'function supplyController() view returns (address)',
  'function exchange() view returns (address)',
  'function riskRegistry() view returns (address)',
  'function engine() view returns (address)',
  'function book() view returns (address)',
  'function custody() view returns (address)',
  'function amortization() view returns (address)',
  'function usdt() view returns (address)',
  'function vault() view returns (address)',
  'function adapter() view returns (address)',
  'function exchangeCustody() view returns (address)'
];

const MOCK_IFACE = new Interface(COMBINED_ABI);

/**
 * Construye un manifiesto V6 Demo sintético con bytecodes deterministas y su SHA-256.
 */
function buildTestManifest() {
  const contracts = {};
  const bytecodesByAddress = {};
  const codeHashes = {};
  const owners = {};
  const startBlocks = {};

  REQUIRED_V6_CONTRACTS.forEach((name, idx) => {
    const hexNum = (idx + 0x100).toString(16).padStart(40, '0');
    const addr = getAddress(`0x${hexNum}`);
    const bytecode = '0x60806040' + keccak256(toUtf8Bytes(`V6_DEMO_BYTECODE_${name}`)).slice(2);
    contracts[name] = addr;
    bytecodesByAddress[addr.toLowerCase()] = bytecode;
    codeHashes[name] = keccak256(bytecode);
    if (name !== 'USDT' && name !== 'ExchangeRouter') {
      owners[name] = OWNER_ADDR;
    }
    startBlocks[name] = 51539460;
  });

  const manifest = {
    epoch: 'V6_DEMO',
    chainId: '11155420',
    contracts,
    codeHashes,
    owners,
    roles: {
      guardian: OWNER_ADDR,
      riskOperator: OWNER_ADDR
    },
    startBlocks,
    anchorBlock: 50667758
  };

  const manifestRaw = JSON.stringify(manifest);
  const manifestSha256 = createHash('sha256').update(manifestRaw).digest('hex');

  return { manifest, manifestRaw, manifestSha256, bytecodesByAddress };
}

/**
 * Construye un proveedor EVM en memoria 100% determinista que responde `eth_call`,
 * `getCode`, `getLogs`, `getBlock` y `getNetwork` para toda la suite V6.
 */
function createMockV6Provider(fixture, stateOverrides = {}) {
  const { manifest, bytecodesByAddress } = fixture;
  const c = manifest.contracts;
  const addrToName = {};
  for (const [name, addr] of Object.entries(c)) {
    addrToName[addr.toLowerCase()] = name;
  }

  const state = {
    chainId: 11155420n,
    rpcChainIdHex: null, // si se define, eth_chainId responde este valor (para test de discrepancia)
    mode: 1, // PRELAUNCH_FROZEN por defecto
    latestBlockNumber: FINALIZED_BLOCK_NUM,
    reorgOnFinalRead: false,
    prunedHistoryOnLogs: false,
    nullLogsResponse: false,
    failGlobalStateRead: false,
    timeoutOnNonces: false,
    timeoutOnProfileUpdateVersion: false,
    supportsProfileUpdateVersion: false,
    corruptCodeHashFor: null,
    supplies: { blue: 0n, red: 0n, usdt: 0n },
    blueBalances: {},
    blueLocked: {},
    parkingLots: {},
    redBalances: {},
    ledgerOutstanding: {},
    ledgerMatured: {},
    ledgerLots: [], // [{ lotId, owner, dueAt, amount, fee, margin, active }]
    riskProfiles: {}, // { [lowerAddr]: { creditLimit, level, kycVerified, version } }
    vault: {
      totalCollateral: 0n,
      totalExchangeReserved: 0n,
      solvent: true,
      collateralBalance: {},
      freeCollateral: {},
      unreservedCollateral: {},
      exchangeReserved: {},
      automaticExchangeCollateral: {},
      orderUser: {},
      orderReserved: {},
      existingOrder: {}
    },
    exchange: {
      blueCursor: 0n,
      usdtCursor: 0n,
      nextSequence: 1n,
      blueQueueLength: 0n,
      usdtQueueLength: 0n,
      orders: [], // [{ id, sequence, remaining, user, status, side, createdAt, original, refunded }]
      totalReserved: [0n, 0n],
      totalPendingRefund: [0n, 0n],
      accumulatedFees: [0n, 0n],
      pendingRefund: {}, // { [lowerAddr]: [blue, usdt] }
      adapterTotalCollateralReserved: 0n,
      adapterReservation: {} // { [orderId]: { user, remaining } }
    },
    usdtBalances: {},
    nonces: {},
    logsByContract: {}, // { [contractName]: [{ address, topics, data, blockNumber, transactionHash }] }
    ...stateOverrides
  };

  let finalizedReads = 0;

  const getMapVal = (map, addr, fallback = 0n) => {
    const key = String(addr || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : fallback;
  };

  const handleCall = (to, data) => {
    const contractName = addrToName[String(to).toLowerCase()];
    if (!contractName) throw new Error(`Contrato desconocido en mock: ${to}`);
    const parsed = MOCK_IFACE.parseTransaction({ data });
    const fn = parsed.name;
    const args = parsed.args;
    const encode = (values) => MOCK_IFACE.encodeFunctionResult(parsed.fragment, values);

    // Enlaces de validateV6Demo
    if (V6_LINKS[contractName] && Object.prototype.hasOwnProperty.call(V6_LINKS[contractName], fn)) {
      const targetName = V6_LINKS[contractName][fn];
      return encode([c[targetName]]);
    }

    if (fn === 'owner') return encode([OWNER_ADDR]);
    if (fn === 'guardian') return encode([OWNER_ADDR]);
    if (fn === 'riskOperator') return encode([OWNER_ADDR]);
    if (fn === 'decimals') return encode([6]);
    if (fn === 'mode') return encode([state.mode]);
    if (fn === 'operators') return encode([getAddress(args[0]) === c.PaymentEngine]);

    if (contractName === 'ProtocolConfig') {
      if (fn === 'activeConfig') return encode([[1_000_000_000n, 2_592_000n, 500n]]);
      if (fn === 'pendingConfig') return encode([[0n, 0n, 0n]]);
      if (fn === 'pendingUnlockAt') return encode([0n]);
    }

    if (contractName === 'ExchangeConfig') {
      if (fn === 'feeBps') return encode([100n]);
      if (fn === 'treasury') return encode([c.ProtocolTreasuryV6]);
      if (fn === 'pendingFeeBps') return encode([0n]);
      if (fn === 'feeReadyAt') return encode([0n]);
      if (fn === 'pendingTreasury') return encode(['0x0000000000000000000000000000000000000000']);
      if (fn === 'treasuryReadyAt') return encode([0n]);
    }

    if (contractName === 'ProtocolTreasuryV6') {
      if (fn === 'corporateTreasuryWallet') return encode([CORPORATE_WALLET]);
      if (fn === 'currentMerkleRoot') return encode(['0x' + '00'.repeat(32)]);
      if (fn === 'rewardEpoch') return encode([0n]);
      if (fn === 'activeSurplusProposal') {
        return encode(['0x0000000000000000000000000000000000000000', 0n, 0n, false, false]);
      }
    }

    if (contractName === 'BlueTokenV6') {
      if (fn === 'totalSupply') {
        if (state.failGlobalStateRead) {
          throw new Error('RPC timeout on https://opt-sepolia.g.alchemy.com/v2/shortKey9');
        }
        return encode([state.supplies.blue]);
      }
      if (fn === 'balanceOf') return encode([getMapVal(state.blueBalances, args[0], 0n)]);
      if (fn === 'lockedBalanceOf') return encode([getMapVal(state.blueLocked, args[0], 0n)]);
      if (fn === 'availableBalanceOf') {
        const b = getMapVal(state.blueBalances, args[0], 0n);
        const l = getMapVal(state.blueLocked, args[0], 0n);
        return encode([b >= l ? b - l : 0n]);
      }
      if (fn === 'parkingHead') return encode([0n]);
      if (fn === 'parkingLotsCount') {
        const lots = getMapVal(state.parkingLots, args[0], []);
        return encode([BigInt(lots.length)]);
      }
      if (fn === 'parkingLots') {
        const lots = getMapVal(state.parkingLots, args[0], []);
        const lot = lots[Number(args[1])] || { remaining: 0n, releaseAt: 0n };
        return encode([lot.remaining, lot.releaseAt]);
      }
    }

    if (contractName === 'RedTokenV6') {
      if (fn === 'totalSupply') return encode([state.supplies.red]);
      if (fn === 'balanceOf') return encode([getMapVal(state.redBalances, args[0], 0n)]);
    }

    if (contractName === 'USDT') {
      if (fn === 'totalSupply') return encode([state.supplies.usdt]);
      if (fn === 'balanceOf') return encode([getMapVal(state.usdtBalances, args[0], 0n)]);
    }

    if (contractName === 'CommitmentLedger') {
      if (fn === 'nextLotId') return encode([BigInt(state.ledgerLots.length + 1)]);
      if (fn === 'paymentEngine') return encode([c.PaymentEngine]);
      if (fn === 'lotOwner') {
        const found = state.ledgerLots.find((l) => BigInt(l.lotId) === BigInt(args[0]));
        return encode([found ? found.owner : '0x0000000000000000000000000000000000000000']);
      }
      if (fn === 'ledgerVersion') return encode([1n]);
      if (fn === 'outstanding') return encode([getMapVal(state.ledgerOutstanding, args[0], 0n)]);
      if (fn === 'matured') return encode([getMapVal(state.ledgerMatured, args[0], 0n)]);
      if (fn === 'firstLotId') {
        const found = state.ledgerLots.find((l) => l.owner.toLowerCase() === String(args[0]).toLowerCase() && l.active);
        return encode([found ? BigInt(found.lotId) : 0n]);
      }
      if (fn === 'lot') {
        const found = state.ledgerLots.find(
          (l) => l.owner.toLowerCase() === String(args[0]).toLowerCase() && BigInt(l.lotId) === BigInt(args[1]) && l.active
        );
        if (!found) return encode([0n, 0n, 0n, 0n, false]);
        return encode([found.dueAt, found.amount, found.fee, found.margin, true]);
      }
    }

    if (contractName === 'RiskRegistry') {
      const p = getMapVal(state.riskProfiles, args[0], { creditLimit: 0n, level: 0, kycVerified: false, version: 0n });
      if (fn === 'profile') return encode([[p.creditLimit, p.level, p.kycVerified]]);
      if (fn === 'isKYCVerified') return encode([p.kycVerified]);
      if (fn === 'profileUpdateVersion') {
        if (state.timeoutOnProfileUpdateVersion) {
          throw new Error('request timed out against https://opt-sepolia.g.alchemy.com/v2/shortKey9');
        }
        if (!state.supportsProfileUpdateVersion) {
          throw new Error('execution reverted: selector not found');
        }
        return encode([p.version ?? 0n]);
      }
    }

    if (contractName === 'CollateralVaultV6') {
      if (fn === 'totalCollateral') return encode([state.vault.totalCollateral]);
      if (fn === 'totalExchangeReserved') return encode([state.vault.totalExchangeReserved]);
      if (fn === 'solvent') return encode([state.vault.solvent]);
      if (fn === 'collateralBalance') return encode([getMapVal(state.vault.collateralBalance, args[0], 0n)]);
      if (fn === 'freeCollateral') return encode([getMapVal(state.vault.freeCollateral, args[0], 0n)]);
      if (fn === 'unreservedCollateral') return encode([getMapVal(state.vault.unreservedCollateral, args[0], 0n)]);
      if (fn === 'exchangeReserved') return encode([getMapVal(state.vault.exchangeReserved, args[0], 0n)]);
      if (fn === 'automaticExchangeCollateral') return encode([getMapVal(state.vault.automaticExchangeCollateral, args[0], false)]);
      if (fn === 'orderUser') {
        const u = state.vault.orderUser[String(args[0])] || '0x0000000000000000000000000000000000000000';
        return encode([u]);
      }
      if (fn === 'orderReserved') return encode([state.vault.orderReserved[String(args[0])] || 0n]);
      if (fn === 'existingOrder') return encode([Boolean(state.vault.existingOrder[String(args[0])])]);
    }

    if (contractName === 'FifoOrderBook') {
      if (fn === 'nextOrderId') return encode([BigInt(state.exchange.orders.length + 1)]);
      if (fn === 'nextSequence') return encode([state.exchange.nextSequence]);
      if (fn === 'queueLength') {
        return encode([Number(args[0]) === 0 ? state.exchange.blueQueueLength : state.exchange.usdtQueueLength]);
      }
      if (fn === 'order') {
        const ord = state.exchange.orders.find((o) => BigInt(o.id) === BigInt(args[0]));
        if (!ord) {
          return encode([[0n, 0n, 0n, '0x0000000000000000000000000000000000000000', 0, 0, 0n, 0n, 0n]]);
        }
        return encode([[
          BigInt(ord.id), BigInt(ord.sequence), BigInt(ord.remaining), ord.user, ord.status, ord.side,
          BigInt(ord.createdAt), BigInt(ord.original), BigInt(ord.refunded)
        ]]);
      }
    }

    if (contractName === 'ExchangeCustody') {
      if (fn === 'totalReserved') return encode([state.exchange.totalReserved[Number(args[0])]]);
      if (fn === 'totalPendingRefund') return encode([state.exchange.totalPendingRefund[Number(args[0])]]);
      if (fn === 'accumulatedFees') return encode([state.exchange.accumulatedFees[Number(args[0])]]);
      if (fn === 'liabilities') {
        const idx = Number(args[0]);
        const total = state.exchange.totalReserved[idx] + state.exchange.totalPendingRefund[idx] + state.exchange.accumulatedFees[idx];
        return encode([total]);
      }
      if (fn === 'solvent') {
        const idx = Number(args[0]);
        const total = state.exchange.totalReserved[idx] + state.exchange.totalPendingRefund[idx] + state.exchange.accumulatedFees[idx];
        const phys = idx === 0
          ? getMapVal(state.blueBalances, c.ExchangeCustody, 0n)
          : getMapVal(state.usdtBalances, c.ExchangeCustody, 0n);
        return encode([phys >= total]);
      }
      if (fn === 'pendingRefund') {
        const pair = getMapVal(state.exchange.pendingRefund, args[0], [0n, 0n]);
        return encode([pair[Number(args[1])] || 0n]);
      }
    }

    if (contractName === 'ExchangeRouter') {
      if (fn === 'blueCursor') return encode([state.exchange.blueCursor]);
      if (fn === 'usdtCursor') return encode([state.exchange.usdtCursor]);
      if (fn === 'MIN_ORDER_AMOUNT') return encode([1_000_000n]);
    }

    if (contractName === 'AmortizationAdapter') {
      if (fn === 'totalCollateralReserved') return encode([state.exchange.adapterTotalCollateralReserved]);
      if (fn === 'reservation') {
        const r = state.exchange.adapterReservation[String(args[0])] || { user: '0x0000000000000000000000000000000000000000', remaining: 0n };
        return encode([r.user, r.remaining]);
      }
    }

    if (contractName === 'PaymentAuthorization') {
      if (fn === 'nonces') {
        if (state.timeoutOnNonces) {
          throw new Error('ETIMEDOUT querying https://opt-sepolia.g.alchemy.com/v2/abc123');
        }
        return encode([getMapVal(state.nonces, args[0], 0n)]);
      }
    }

    throw new Error(`Llamada mock no manejada: ${contractName}.${fn}`);
  };

  return {
    getNetwork: async () => ({ chainId: state.chainId }),
    getBlock: async (tag) => {
      if (tag === 'finalized') {
        finalizedReads += 1;
        return { number: FINALIZED_BLOCK_NUM, hash: FINALIZED_BLOCK_HASH, timestamp: 1790000000 };
      }
      if (tag === 'latest') {
        return { number: state.latestBlockNumber, hash: '0x' + 'cc'.repeat(32), timestamp: 1790000010 };
      }
      if (tag === FINALIZED_BLOCK_NUM) {
        finalizedReads += 1;
        if (state.reorgOnFinalRead && finalizedReads >= 2) {
          return { number: FINALIZED_BLOCK_NUM, hash: REORGED_BLOCK_HASH, timestamp: 1790000000 };
        }
        return { number: FINALIZED_BLOCK_NUM, hash: FINALIZED_BLOCK_HASH, timestamp: 1790000000 };
      }
      return null;
    },
    getCode: async (address) => {
      const lower = String(address).toLowerCase();
      if (state.corruptCodeHashFor && addrToName[lower] === state.corruptCodeHashFor) {
        return '0xdeadbeef';
      }
      return bytecodesByAddress[lower] || '0x';
    },
    send: async (method, params) => {
      if (method === 'eth_chainId') {
        return state.rpcChainIdHex !== null ? state.rpcChainIdHex : `0x${state.chainId.toString(16)}`;
      }
      if (method === 'eth_call') {
        return handleCall(params[0].to, params[0].data);
      }
      throw new Error(`RPC send no soportado en mock: ${method}`);
    },
    call: async (tx) => handleCall(tx.to, tx.data),
    getTransactionReceipt: async () => null,
    getLogs: async (filter) => {
      if (state.prunedHistoryOnLogs) {
        const err = new Error('4444 historical state pruned for requested range');
        err.code = 4444;
        throw err;
      }
      if (state.nullLogsResponse) {
        return null;
      }
      const name = addrToName[String(filter.address).toLowerCase()];
      const list = state.logsByContract[name] || [];
      return list.filter((l) => l.blockNumber >= filter.fromBlock && l.blockNumber <= filter.toBlock);
    }
  };
}

/**
 * Construye un cliente PostgreSQL mock que registra las consultas ejecutadas
 * para validar aislamiento `REPEATABLE READ READ ONLY`, timeouts y sanitización.
 */
function createMockSqlClient(sqlConfig = {}) {
  const executedQueries = [];
  const cfg = {
    currentDatabase: 'wintoncoin_demo_db',
    tables: [...REQUIRED_SQL_TABLES, 'smart_accounts', 'credit_policy_versions', 'web3_exchange_v6_orders', 'web3_exchange_v6_refunds'],
    columns: [
      { table_name: 'users', column_name: 'id', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
      { table_name: 'users', column_name: 'web3_wallet_address', data_type: 'text', numeric_precision: null, numeric_scale: null },
      { table_name: 'users', column_name: 'kyc_verified', data_type: 'boolean', numeric_precision: null, numeric_scale: null },
      { table_name: 'users', column_name: 'red_credit_limit_override', data_type: 'numeric', numeric_precision: 24, numeric_scale: 6 },
      { table_name: 'publications', column_name: 'id', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
      { table_name: 'publications', column_name: 'author_id', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
      { table_name: 'publications', column_name: 'status', data_type: 'character varying', numeric_precision: null, numeric_scale: null },
      { table_name: 'publications', column_name: 'blue_cost', data_type: 'numeric', numeric_precision: 30, numeric_scale: 6 },
      { table_name: 'publications', column_name: 'base_blue_cost', data_type: 'numeric', numeric_precision: 18, numeric_scale: 6 },
      { table_name: 'publications', column_name: 'goal_amount', data_type: 'numeric', numeric_precision: 18, numeric_scale: 6 },
      { table_name: 'publication_acceptances', column_name: 'id', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
      { table_name: 'publication_acceptances', column_name: 'publication_id', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
      { table_name: 'publication_acceptances', column_name: 'status', data_type: 'character varying', numeric_precision: null, numeric_scale: null },
      { table_name: 'publication_acceptances', column_name: 'blue_cost', data_type: 'numeric', numeric_precision: 30, numeric_scale: 6 },
      { table_name: 'publication_acceptances', column_name: 'paid_recorded_at', data_type: 'timestamp with time zone', numeric_precision: null, numeric_scale: null },
      { table_name: 'credit_policy_issues', column_name: 'retry_count', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
      { table_name: 'credit_policy_issues', column_name: 'next_retry_at', data_type: 'timestamp with time zone', numeric_precision: null, numeric_scale: null },
      { table_name: 'credit_policy_issues', column_name: 'max_retries', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
      { table_name: 'credit_policy_issues', column_name: 'last_error', data_type: 'text', numeric_precision: null, numeric_scale: null }
    ],
    users: [
      {
        id: 1,
        web3_wallet_address: USER_SQL,
        kyc_verified: true,
        red_credit_limit_override: null,
        // Campos PII deliberadamente inyectados en el mock para probar que jamás se exportan
        email: 'usuario.secreto@example.com',
        phone: '+5491155551234'
      }
    ],
    appSettings: [{ setting_key: 'red_credit_base_limit', setting_value: '100' }],
    creditPolicyIssues: [],
    creditNotificationOutbox: [],
    creditReferralAwards: [],
    escrowHolds: [],
    publicationsActive: [],
    publicationAcceptances: [],
    exchangeSync: [],
    chainOpsActive: [],
    ...sqlConfig
  };

  const client = {
    executedQueries,
    ended: false,
    query: async (sql, params = []) => {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      executedQueries.push({ sql: normalized, params });

      if (/^BEGIN TRANSACTION/i.test(normalized) || /^SET LOCAL statement_timeout/i.test(normalized) || /^COMMIT$/i.test(normalized) || /^ROLLBACK$/i.test(normalized)) {
        return { rows: [] };
      }
      if (/SELECT current_database\(\)/i.test(normalized)) {
        return { rows: [{ db: cfg.currentDatabase }] };
      }
      if (/FROM information_schema\.tables/i.test(normalized)) {
        return { rows: cfg.tables.map((table_name) => ({ table_name })) };
      }
      if (/FROM information_schema\.columns/i.test(normalized)) {
        return { rows: cfg.columns };
      }
      if (/FROM users WHERE id > \$1/i.test(normalized)) {
        const lastId = Number(params[0] || 0);
        const limit = Number(params[1] || 500);
        return { rows: cfg.users.filter((u) => u.id > lastId).slice(0, limit) };
      }
      if (/FROM smart_accounts/i.test(normalized)) {
        return { rows: [] };
      }
      if (/FROM app_settings/i.test(normalized)) {
        return { rows: cfg.appSettings };
      }
      if (/FROM credit_policy_versions/i.test(normalized)) {
        return { rows: [] };
      }
      if (/SELECT status, COUNT\(\*\)::text AS total FROM credit_policy_issues/i.test(normalized)) {
        const counts = new Map();
        for (const row of cfg.creditPolicyIssues) {
          counts.set(row.status, (counts.get(row.status) || 0) + 1);
        }
        return {
          rows: Array.from(counts.entries()).map(([status, total]) => ({ status, total: String(total) }))
        };
      }
      if (/FROM credit_policy_issues/i.test(normalized)) {
        return {
          rows: cfg.creditPolicyIssues.filter((r) => !['resolved', 'completed', 'closed'].includes(r.status))
        };
      }
      if (/SELECT status, COUNT\(\*\)::text AS total FROM credit_notification_outbox/i.test(normalized)) {
        const counts = new Map();
        for (const row of cfg.creditNotificationOutbox) {
          counts.set(row.status, (counts.get(row.status) || 0) + 1);
        }
        return {
          rows: Array.from(counts.entries()).map(([status, total]) => ({ status, total: String(total) }))
        };
      }
      if (/FROM credit_notification_outbox/i.test(normalized)) {
        const lastOpId = String(params[0] || '');
        const limit = Number(params[1] || 500);
        return {
          rows: cfg.creditNotificationOutbox
            .filter((r) => r.status === 'pending' && String(r.operation_id) > lastOpId)
            .sort((a, b) => String(a.operation_id).localeCompare(String(b.operation_id)))
            .slice(0, limit)
        };
      }
      if (/SELECT baseline, COUNT\(\*\)::text AS total FROM credit_referral_awards/i.test(normalized)) {
        const counts = new Map();
        for (const row of cfg.creditReferralAwards) {
          const b = Boolean(row.baseline);
          counts.set(b, (counts.get(b) || 0) + 1);
        }
        return {
          rows: Array.from(counts.entries()).map(([baseline, total]) => ({ baseline, total: String(total) }))
        };
      }
      if (/FROM credit_referral_awards/i.test(normalized)) {
        const lastRefId = Number(params[0] || 0);
        const limit = Number(params[1] || 500);
        return {
          rows: cfg.creditReferralAwards
            .filter((r) => !r.baseline && Number(r.referred_user_id) > lastRefId)
            .sort((a, b) => Number(a.referred_user_id) - Number(b.referred_user_id))
            .slice(0, limit)
        };
      }
      if (/FROM web3_escrow_holds/i.test(normalized)) {
        return { rows: cfg.escrowHolds };
      }
      if (/SELECT status, COUNT\(\*\)::text AS total FROM publication_acceptances/i.test(normalized)) {
        const counts = new Map();
        for (const row of cfg.publicationAcceptances) {
          counts.set(row.status, (counts.get(row.status) || 0) + 1);
        }
        return {
          rows: Array.from(counts.entries()).map(([status, total]) => ({ status, total: String(total) }))
        };
      }
      if (/FROM publication_acceptances pa/i.test(normalized)) {
        const lastAccId = Number(params[0] || 0);
        const limit = Number(params[1] || 500);
        return {
          rows: cfg.publicationAcceptances
            .filter((a) => !['confirmed_paid', 'rejected', 'cancelled'].includes(a.status) && Number(a.id) > lastAccId)
            .sort((a, b) => Number(a.id) - Number(b.id))
            .slice(0, limit)
        };
      }
      if (/FROM publications/i.test(normalized)) {
        const lastId = Number(params[0] || 0);
        const limit = Number(params[1] || 500);
        return { rows: cfg.publicationsActive.filter((p) => p.id > lastId).slice(0, limit) };
      }
      if (/FROM web3_exchange_v6_sync/i.test(normalized)) {
        return { rows: cfg.exchangeSync };
      }
      if (/COUNT\(\*\)::text AS total FROM web3_exchange_v6_/i.test(normalized)) {
        return { rows: [{ total: '0' }] };
      }
      if (/SELECT state, COUNT\(\*\)::text AS total FROM chain_operations/i.test(normalized)) {
        return { rows: cfg.chainOpsActive.length > 0 ? [{ state: 'pending', total: String(cfg.chainOpsActive.length) }] : [] };
      }
      if (/FROM chain_operations WHERE state IN/i.test(normalized)) {
        return { rows: cfg.chainOpsActive };
      }
      return { rows: [] };
    },
    end: async () => {
      client.ended = true;
    }
  };

  return client;
}

// ----------------------------------------------------------------------------
// PRUEBAS UNITARIAS Y ESCENARIOS NEGATIVOS (CODEX-203)
// ----------------------------------------------------------------------------

describe('v6DemoInventoryExporter — Guardas fail-closed CODEX-203', () => {
  const fixture = buildTestManifest();

  test('1. Rechaza RPC no permitido ANTES de conectar (sin invocar providerFactory)', async () => {
    const providerFactory = jest.fn();
    const sqlClientFactory = jest.fn();

    await expect(exportV6DemoInventory({
      rpcUrl: 'https://mainnet.optimism.io',
      databaseUrl: DEMO_DB_URL,
      providerFactory,
      sqlClientFactory,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    })).rejects.toThrow(/RPC_ALLOWLIST_REJECTED/);

    await expect(exportV6DemoInventory({
      rpcUrl: 'http://127.0.0.1:8545',
      databaseUrl: DEMO_DB_URL,
      allowLocalRpc: false,
      providerFactory,
      sqlClientFactory,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    })).rejects.toThrow(/RPC_ALLOWLIST_REJECTED/);

    expect(providerFactory).not.toHaveBeenCalled();
    expect(sqlClientFactory).not.toHaveBeenCalled();
  });

  test('2. Rechaza DB destino no permitido (producción / no-demo / local sin flag) ANTES de conectar', async () => {
    const providerFactory = jest.fn();
    const sqlClientFactory = jest.fn();

    await expect(exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: 'postgresql://user:pass@wintoncoin-prod-db.render.internal:5432/wintoncoin_prod',
      providerFactory,
      sqlClientFactory,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    })).rejects.toThrow(/SQL_ALLOWLIST_REJECTED/);

    await expect(exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: 'postgresql://user:pass@127.0.0.1:5432/wintoncoin_demo',
      allowLocalSql: false,
      providerFactory,
      sqlClientFactory,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    })).rejects.toThrow(/SQL_ALLOWLIST_REJECTED/);

    expect(providerFactory).not.toHaveBeenCalled();
    expect(sqlClientFactory).not.toHaveBeenCalled();
  });

  test('3. Rechaza por chainId distinto de 11155420', async () => {
    const provider = createMockV6Provider(fixture, { chainId: 10n });
    const sqlClientFactory = jest.fn();

    await expect(exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      providerFactory: () => provider,
      sqlClientFactory,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    })).rejects.toThrow(/CHAIN_ID_MISMATCH/);

    expect(sqlClientFactory).not.toHaveBeenCalled();
  });

  test('4. Rechaza por manifiesto/SHA-256 distinto o codeHash distinto de contrato V6', async () => {
    const provider = createMockV6Provider(fixture);

    await expect(exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      skipSql: true,
      providerFactory: () => provider,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: '0'.repeat(64)
    })).rejects.toThrow(/MANIFEST_FINGERPRINT_MISMATCH/);

    const corruptProvider = createMockV6Provider(fixture, { corruptCodeHashFor: 'BlueTokenV6' });
    await expect(exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      skipSql: true,
      providerFactory: () => corruptProvider,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    })).rejects.toThrow(/CODEHASH_MISMATCH/);
  });

  test('5. Falla cerrado ante historial RPC podado (4444) sin fingir lista vacía ni saldo 0', async () => {
    const provider = createMockV6Provider(fixture, { prunedHistoryOnLogs: true });
    const sqlClient = createMockSqlClient();

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClient,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(report.completeness.onchainComplete).toBe(false);
    expect(report.completeness.fullComplete).toBe(false);
    expect(report.eligibility.routeAEligible).toBe(false);
    expect(report.eligibility.candidateEmptyAtBlock).toBe(false);
    expect(report.metadata.rpc.logScan.paginationComplete).toBe(false);
    expect(report.errors.onchain.some((e) => e.code === 'RPC_PRUNED_HISTORY_4444')).toBe(true);
  });

  test('6. Falla cerrado ante reorg (cambio de blockHash al re-leer el bloque finalized al final)', async () => {
    const provider = createMockV6Provider(fixture, { reorgOnFinalRead: true });
    const sqlClient = createMockSqlClient();

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClient,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(report.completeness.reorgDetected).toBe(true);
    expect(report.completeness.onchainComplete).toBe(false);
    expect(report.completeness.fullComplete).toBe(false);
    expect(report.eligibility.routeAEligible).toBe(false);
    expect(report.metadata.rpc.finalizedBlockHash).toBe(FINALIZED_BLOCK_HASH);
    expect(report.metadata.rpc.endVerificationBlockHash).toBe(REORGED_BLOCK_HASH);
    expect(report.errors.onchain.some((e) => e.code === 'REORG_DETECTED')).toBe(true);
  });

  test('7. --skip-sql fuerza fullComplete=false y routeAEligible=false mientras reporta onchainComplete=true', async () => {
    const provider = createMockV6Provider(fixture);
    const sqlClientFactory = jest.fn();

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      skipSql: true,
      writeContainmentVerified: true,
      providerFactory: () => provider,
      sqlClientFactory,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(sqlClientFactory).not.toHaveBeenCalled();
    expect(report.sql.skipped).toBe(true);
    expect(report.completeness.onchainComplete).toBe(true);
    expect(report.completeness.sqlComplete).toBe(false);
    expect(report.completeness.fullComplete).toBe(false);
    expect(report.eligibility.candidateEmptyAtBlock).toBe(true);
    expect(report.eligibility.routeAEligible).toBe(false);
    expect(report.eligibility.routeABlockingReasons.some((r) => /--skip-sql/.test(r))).toBe(true);
  });

  test('8. Distingue tablas SQL requeridas ausentes (falla cerrado) vs columnas opcionales 128..131 ausentes (permitido)', async () => {
    const provider = createMockV6Provider(fixture);

    // 8a. Columnas opcionales 128..131 ausentes pero todas las tablas requeridas presentes
    const sqlClientOptionalMissing = createMockSqlClient();
    const reportOk = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClientOptionalMissing,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(reportOk.completeness.sqlComplete).toBe(true);
    expect(reportOk.completeness.fullComplete).toBe(true);
    expect(reportOk.sql.schema.missingRequiredTables).toEqual([]);
    expect(reportOk.sql.schema.missingOptionalColumns.some((c) => c.migrationHint === '128')).toBe(true);
    // Verificar que se ejecutó REPEATABLE READ READ ONLY y statement_timeout
    expect(sqlClientOptionalMissing.executedQueries[0].sql).toBe(
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'
    );
    expect(sqlClientOptionalMissing.executedQueries[1].sql).toMatch(/SET LOCAL statement_timeout/);

    // 8b. Falta tabla requerida (`web3_exchange_v6_sync`) -> sqlComplete=false, fullComplete=false, routeAEligible=false
    const sqlClientRequiredMissing = createMockSqlClient({
      tables: REQUIRED_SQL_TABLES.filter((t) => t !== 'web3_exchange_v6_sync')
    });
    const reportMissing = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClientRequiredMissing,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(reportMissing.completeness.sqlComplete).toBe(false);
    expect(reportMissing.completeness.fullComplete).toBe(false);
    expect(reportMissing.eligibility.routeAEligible).toBe(false);
    expect(reportMissing.sql.schema.missingRequiredTables).toContain('web3_exchange_v6_sync');
    expect(reportMissing.errors.sql.some((e) => e.code === 'SQL_MISSING_REQUIRED_TABLES')).toBe(true);
  });

  test('9. Descubre cuentas fuera de SQL (solo eventos on-chain) y detecta versión de RiskRegistry', async () => {
    const blueTransferIface = new Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);
    const encoded = blueTransferIface.encodeEventLog(
      blueTransferIface.getEvent('Transfer'),
      ['0x0000000000000000000000000000000000000000', USER_ONCHAIN_ONLY, 5_000_000n]
    );

    const provider = createMockV6Provider(fixture, {
      supportsProfileUpdateVersion: false,
      supplies: { blue: 5_000_000n, red: 5_000_000n, usdt: 0n },
      blueBalances: { [USER_ONCHAIN_ONLY.toLowerCase()]: 5_000_000n },
      blueLocked: { [USER_ONCHAIN_ONLY.toLowerCase()]: 2_000_000n },
      parkingLots: { [USER_ONCHAIN_ONLY.toLowerCase()]: [{ remaining: 2_000_000n, releaseAt: 1800000000n }] },
      redBalances: { [USER_SQL.toLowerCase()]: 5_000_000n },
      ledgerOutstanding: { [USER_SQL.toLowerCase()]: 5_000_000n },
      ledgerLots: [{
        lotId: 1n,
        owner: USER_SQL,
        dueAt: 1800000000n,
        amount: 5_000_000n,
        fee: 250_000n,
        margin: 0n,
        active: true
      }],
      logsByContract: {
        BlueTokenV6: [{
          address: fixture.manifest.contracts.BlueTokenV6,
          topics: encoded.topics,
          data: encoded.data,
          blockNumber: 51539500,
          transactionHash: '0x' + '11'.repeat(32)
        }]
      }
    });

    const sqlClient = createMockSqlClient();
    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClient,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    const onchainOnlyAcc = report.onchain.accounts.find((a) => a.address === USER_ONCHAIN_ONLY);
    expect(onchainOnlyAcc).toBeDefined();
    expect(onchainOnlyAcc.sources).toContain('event:BlueTokenV6.Transfer');
    expect(onchainOnlyAcc.blue.total.baseUnits).toBe('5000000');
    expect(onchainOnlyAcc.blue.total.formatted).toBe('5.0');
    expect(onchainOnlyAcc.blue.parkingLots).toHaveLength(1);
    expect(report.metadata.registryVersionDetected).toBe('v6.0_base');
    expect(report.invariants.allPassed).toBe(true);
  });

  test('10. Supply BLUE/RED = 0 pero con órdenes/reembolsos/MockUSDT residual -> candidateEmptyAtBlock=false y routeAEligible=false', async () => {
    const custodyAddr = fixture.manifest.contracts.ExchangeCustody;
    const provider = createMockV6Provider(fixture, {
      supplies: { blue: 0n, red: 0n, usdt: 10_000_000n },
      usdtBalances: { [custodyAddr.toLowerCase()]: 10_000_000n },
      exchange: {
        blueCursor: 0n,
        usdtCursor: 0n,
        nextSequence: 2n,
        blueQueueLength: 0n,
        usdtQueueLength: 1n,
        orders: [{
          id: 1n,
          sequence: 1n,
          remaining: 7_000_000n,
          user: USER_SQL,
          status: 1, // OPEN
          side: 1,   // USDT_FOR_BLUE
          createdAt: 1789999000n,
          original: 7_000_000n,
          refunded: 0n
        }],
        totalReserved: [0n, 7_000_000n],
        totalPendingRefund: [0n, 3_000_000n],
        accumulatedFees: [0n, 0n],
        pendingRefund: { [USER_SQL.toLowerCase()]: [0n, 3_000_000n] },
        adapterTotalCollateralReserved: 0n,
        adapterReservation: {}
      }
    });

    const sqlClient = createMockSqlClient();
    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      writeContainmentVerified: true,
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClient,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(report.invariants.allPassed).toBe(true);
    expect(report.eligibility.candidateEmptyAtBlock).toBe(false);
    expect(report.eligibility.routeAEligible).toBe(false);
    expect(report.eligibility.candidateEmptyReasons.some((r) => /MockUSDT/.test(r))).toBe(true);
    expect(report.eligibility.candidateEmptyReasons.some((r) => /FifoOrderBook/.test(r))).toBe(true);
    expect(report.eligibility.candidateEmptyReasons.some((r) => /reembolsos pendientes/.test(r))).toBe(true);
  });

  test('11. Separa candidateEmptyAtBlock=true vs routeAEligible=false cuando falta contención o hay bloques tras finalized', async () => {
    const provider = createMockV6Provider(fixture, {
      latestBlockNumber: FINALIZED_BLOCK_NUM + 5
    });
    const sqlClient = createMockSqlClient();

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      writeContainmentVerified: false,
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClient,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(report.completeness.fullComplete).toBe(true);
    expect(report.invariants.allPassed).toBe(true);
    expect(report.eligibility.candidateEmptyAtBlock).toBe(true);
    expect(report.eligibility.routeAEligible).toBe(false);
    expect(report.eligibility.activityAfterFinalized.hasBlocksAfterFinalized).toBe(true);
    expect(report.eligibility.atomicityNotice).toMatch(/NO son atómicos/);
  });

  test('12. Invariantes: falla explícitamente ante cada ruptura (paridad BLUE/RED, sumas, ledger, parking, doble conteo)', async () => {
    const sqlClient = () => createMockSqlClient();

    // 12a. supplyBLUE != supplyRED
    const pParity = createMockV6Provider(fixture, {
      supplies: { blue: 2_000_000n, red: 1_000_000n, usdt: 0n },
      blueBalances: { [USER_SQL.toLowerCase()]: 2_000_000n },
      redBalances: { [USER_SQL.toLowerCase()]: 1_000_000n },
      ledgerOutstanding: { [USER_SQL.toLowerCase()]: 1_000_000n }
    });
    const rParity = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL, databaseUrl: DEMO_DB_URL,
      providerFactory: () => pParity, sqlClientFactory: async () => sqlClient(),
      manifestOverride: fixture.manifestRaw, expectedManifestSha256: fixture.manifestSha256
    });
    expect(rParity.invariants.allPassed).toBe(false);
    expect(rParity.invariants.checks.pairedSupplyParity.ok).toBe(false);

    // 12b. sum(BLUE) != supplyBLUE (titular faltante o saldo inconsistente)
    const pSumBlue = createMockV6Provider(fixture, {
      supplies: { blue: 3_000_000n, red: 3_000_000n, usdt: 0n },
      blueBalances: { [USER_SQL.toLowerCase()]: 1_000_000n },
      redBalances: { [USER_SQL.toLowerCase()]: 3_000_000n },
      ledgerOutstanding: { [USER_SQL.toLowerCase()]: 3_000_000n }
    });
    const rSumBlue = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL, databaseUrl: DEMO_DB_URL,
      providerFactory: () => pSumBlue, sqlClientFactory: async () => sqlClient(),
      manifestOverride: fixture.manifestRaw, expectedManifestSha256: fixture.manifestSha256
    });
    expect(rSumBlue.invariants.allPassed).toBe(false);
    expect(rSumBlue.invariants.checks.blueHoldersSumMatchesSupply.ok).toBe(false);

    // 12b2. sum(RED) != supplyRED
    const pSumRed = createMockV6Provider(fixture, {
      supplies: { blue: 3_000_000n, red: 3_000_000n, usdt: 0n },
      blueBalances: { [USER_SQL.toLowerCase()]: 3_000_000n },
      redBalances: { [USER_SQL.toLowerCase()]: 1_000_000n },
      ledgerOutstanding: { [USER_SQL.toLowerCase()]: 1_000_000n }
    });
    const rSumRed = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL, databaseUrl: DEMO_DB_URL,
      providerFactory: () => pSumRed, sqlClientFactory: async () => sqlClient(),
      manifestOverride: fixture.manifestRaw, expectedManifestSha256: fixture.manifestSha256
    });
    expect(rSumRed.invariants.allPassed).toBe(false);
    expect(rSumRed.invariants.checks.redHoldersSumMatchesSupply.ok).toBe(false);

    // 12c. RED por cuenta != ledger outstanding
    const pRedLedger = createMockV6Provider(fixture, {
      supplies: { blue: 4_000_000n, red: 4_000_000n, usdt: 0n },
      blueBalances: { [USER_SQL.toLowerCase()]: 4_000_000n },
      redBalances: { [USER_SQL.toLowerCase()]: 4_000_000n },
      ledgerOutstanding: { [USER_SQL.toLowerCase()]: 2_000_000n }
    });
    const rRedLedger = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL, databaseUrl: DEMO_DB_URL,
      providerFactory: () => pRedLedger, sqlClientFactory: async () => sqlClient(),
      manifestOverride: fixture.manifestRaw, expectedManifestSha256: fixture.manifestSha256
    });
    expect(rRedLedger.invariants.allPassed).toBe(false);
    expect(rRedLedger.invariants.checks.redMatchesLedgerOutstandingPerAccount.ok).toBe(false);

    // 12d. parking > BLUE
    const pParking = createMockV6Provider(fixture, {
      supplies: { blue: 1_000_000n, red: 1_000_000n, usdt: 0n },
      blueBalances: { [USER_SQL.toLowerCase()]: 1_000_000n },
      blueLocked: { [USER_SQL.toLowerCase()]: 1_500_000n },
      redBalances: { [USER_SQL.toLowerCase()]: 1_000_000n },
      ledgerOutstanding: { [USER_SQL.toLowerCase()]: 1_000_000n }
    });
    const rParking = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL, databaseUrl: DEMO_DB_URL,
      providerFactory: () => pParking, sqlClientFactory: async () => sqlClient(),
      manifestOverride: fixture.manifestRaw, expectedManifestSha256: fixture.manifestSha256
    });
    expect(rParking.invariants.allPassed).toBe(false);
    expect(rParking.invariants.checks.parkingWithinBluePerAccount.ok).toBe(false);

    // 12e. Doble conteo / insolvencia entre Bóveda, ExchangeCustody y AmortizationAdapter
    const vaultAddr = fixture.manifest.contracts.CollateralVaultV6;
    const custodyAddr = fixture.manifest.contracts.ExchangeCustody;
    const pDoubleCount = createMockV6Provider(fixture, {
      supplies: { blue: 0n, red: 0n, usdt: 10_000_000n },
      usdtBalances: {
        [vaultAddr.toLowerCase()]: 2_000_000n, // faltan fondos físicos (debería tener >= 5M)
        [custodyAddr.toLowerCase()]: 5_000_000n
      },
      vault: {
        totalCollateral: 10_000_000n,
        totalExchangeReserved: 5_000_000n,
        solvent: false,
        collateralBalance: { [USER_SQL.toLowerCase()]: 10_000_000n },
        freeCollateral: { [USER_SQL.toLowerCase()]: 0n },
        unreservedCollateral: { [USER_SQL.toLowerCase()]: 5_000_000n },
        exchangeReserved: { [USER_SQL.toLowerCase()]: 5_000_000n },
        automaticExchangeCollateral: {},
        orderUser: { '1': USER_SQL },
        orderReserved: { '1': 5_000_000n },
        existingOrder: { '1': false }
      },
      exchange: {
        blueCursor: 0n,
        usdtCursor: 0n,
        nextSequence: 2n,
        blueQueueLength: 0n,
        usdtQueueLength: 1n,
        orders: [{
          id: 1n, sequence: 1n, remaining: 5_000_000n, user: USER_SQL,
          status: 1, side: 1, createdAt: 1789999000n, original: 5_000_000n, refunded: 0n
        }],
        totalReserved: [0n, 5_000_000n],
        totalPendingRefund: [0n, 0n],
        accumulatedFees: [0n, 0n],
        pendingRefund: {},
        adapterTotalCollateralReserved: 5_000_000n,
        adapterReservation: { '1': { user: USER_SQL, remaining: 5_000_000n } }
      }
    });
    const rDouble = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL, databaseUrl: DEMO_DB_URL,
      providerFactory: () => pDoubleCount, sqlClientFactory: async () => sqlClient(),
      manifestOverride: fixture.manifestRaw, expectedManifestSha256: fixture.manifestSha256
    });
    expect(rDouble.invariants.allPassed).toBe(false);
    expect(rDouble.invariants.checks.custodyAndCollateralNoDoubleCount.ok).toBe(false);
    expect(rDouble.invariants.checks.custodyAndCollateralNoDoubleCount.vaultPhysicalSolvent).toBe(false);
  });

  test('13. Sanitización estricta: el JSON final no contiene DATABASE_URL, API keys, correos, rawSignedTx ni calldata', async () => {
    const provider = createMockV6Provider(fixture);
    const sqlClient = createMockSqlClient({
      chainOpsActive: [{
        id: '00000000-0000-4000-8000-000000000001',
        user_id: 1,
        chain_id: '11155420',
        sender: USER_SQL.toLowerCase(),
        resource_key: 'payment:test',
        kind: 'marketplace',
        state: 'pending',
        error_code: null,
        payload: {
          to: fixture.manifest.contracts.PaymentEngine,
          nonce: 7,
          data: '0xdeadbeefcafebabe1234567890abcdef',
          calldata: '0xdeadbeefcafebabe1234567890abcdef'
        },
        steps: [{
          label: 'processPayment',
          nonce: 7,
          to: fixture.manifest.contracts.PaymentEngine,
          hash: '0x' + 'ab'.repeat(32),
          raw: '0x02f87082aa36a780843b9aca008502540be4008252089411111111111111111111111111111111111111118080c080a01111',
          rawSignedTx: '0x02f87082aa36a780843b9aca008502540be4008252089411111111111111111111111111111111111111118080c080a01111',
          confirmed: false
        }],
        created_at: new Date('2026-11-24T18:00:00Z'),
        updated_at: new Date('2026-11-24T18:01:00Z')
      }]
    });

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClient,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('UltraSecretPass123!');
    expect(serialized).not.toContain('postgresql://');
    expect(serialized).not.toContain('SUPER_SECRET_API_KEY_1234567890ABCDEF');
    expect(serialized).not.toContain('usuario.secreto@example.com');
    expect(serialized).not.toContain('+5491155551234');
    expect(serialized).not.toContain('0xdeadbeefcafebabe1234567890abcdef');
    expect(serialized).not.toContain('0x02f87082aa36a780843b9aca00');
    expect(serialized).not.toContain('rawSignedTx');
    expect(serialized).not.toContain('calldata');

    // Metadatos seguros de chain_operations sí deben conservarse
    expect(report.sql.chainOperations.activeOperations).toHaveLength(1);
    expect(report.sql.chainOperations.activeOperations[0].nonce).toBe('7');
    expect(report.sql.chainOperations.activeOperations[0].tx_hash).toBe('0x' + 'ab'.repeat(32));
  });

  test('14. CLI delgado escribe JSON sanitizado en ruta local explícita y soporta --skip-sql', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'winton-v6-inv-'));
    const outFile = path.join(tmpDir, 'inventory-test.json');
    const stdoutBuf = [];
    const stderrBuf = [];

    const parsed = parseCliArgs(['--rpc-url', DEMO_RPC_URL, '--skip-sql', '--out', outFile], {});
    expect(parsed.skipSql).toBe(true);
    expect(parsed.outPath).toBe(path.resolve(outFile));

    const fakeReport = {
      environment: { chainId: '11155420', epoch: 'V6_DEMO', readOnly: true },
      metadata: { rpc: { finalizedBlockNumber: FINALIZED_BLOCK_NUM } },
      completeness: { onchainComplete: true, sqlComplete: false, fullComplete: false },
      invariants: { allPassed: true },
      eligibility: { candidateEmptyAtBlock: true, routeAEligible: false },
      onchain: { accountsCount: 18 }
    };

    const res = await runCli({
      argv: ['--rpc-url', DEMO_RPC_URL, '--skip-sql', '--out', outFile],
      env: {},
      exporterFn: async (opts) => {
        expect(opts.skipSql).toBe(true);
        return fakeReport;
      },
      stdout: { write: (s) => stdoutBuf.push(s) },
      stderr: { write: (s) => stderrBuf.push(s) }
    });

    expect(res.exitCode).toBe(0);
    expect(stderrBuf).toEqual([]);
    expect(fs.existsSync(outFile)).toBe(true);
    const written = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    expect(written.completeness.fullComplete).toBe(false);
    expect(written.eligibility.routeAEligible).toBe(false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('15. Validadores de allowlist aceptan explícitamente Demo válido y rechazan formatos inválidos', () => {
    const rpcOk = validateRpcUrlAllowlist(DEMO_RPC_URL);
    expect(rpcOk.valid).toBe(true);
    expect(rpcOk.sanitizedUrl).not.toContain('SUPER_SECRET_API_KEY');

    const dbOk = validateDatabaseUrlAllowlist(DEMO_DB_URL);
    expect(dbOk.valid).toBe(true);
    expect(dbOk.sanitizedTarget).toBe('wintoncoin-demo-db.render.internal:5432/wintoncoin_demo_db');
    expect(dbOk.sanitizedTarget).not.toContain('UltraSecretPass123!');
  });

  // --------------------------------------------------------------------------
  // PRUEBAS ADVERSARIALES Y ECONÓMICAS (HALLAZGOS AG-06 Y AG-08)
  // --------------------------------------------------------------------------

  test('16. [AG-06 #1] Valida eth_chainId real del nodo y createDefaultProvider no usa staticNetwork', async () => {
    // 16a. createDefaultProvider no fuerza staticNetwork
    const realProvider = createDefaultProvider('https://sepolia.optimism.io');
    expect(realProvider._getOption('staticNetwork')).toBeNull();
    if (typeof realProvider.destroy === 'function') realProvider.destroy();

    // 16b. Aunque getNetwork() devolviera 11155420n, si eth_chainId responde 0xa (OP Mainnet), falla cerrado
    const spoofedProvider = createMockV6Provider(fixture, {
      chainId: 11155420n,
      rpcChainIdHex: '0xa'
    });
    await expect(exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      skipSql: true,
      providerFactory: () => spoofedProvider,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    })).rejects.toThrow(/CHAIN_ID_MISMATCH/);
  });

  test('17. [AG-06 #2] Rechaza bypass de allowlist RPC por path, subdominio y credenciales embebidas ANTES de conectar', async () => {
    const providerFactory = jest.fn();
    const badUrls = [
      'https://evil.example.com/opt-sepolia',
      'https://opt-sepolia.evil.example.com/v2/key',
      'https://user:pass@sepolia.optimism.io',
      'https://onlyuser@sepolia.optimism.io'
    ];
    for (const badUrl of badUrls) {
      await expect(exportV6DemoInventory({
        rpcUrl: badUrl,
        skipSql: true,
        providerFactory,
        manifestOverride: fixture.manifestRaw,
        expectedManifestSha256: fixture.manifestSha256
      })).rejects.toThrow(/RPC_ALLOWLIST_REJECTED/);
    }
    expect(providerFactory).not.toHaveBeenCalled();
  });

  test('18. [AG-06 #3 y #5] Rechaza bypass de allowlist SQL (host sin demo, query params libpq) y re-lanza SQL_IDENTITY_REJECTED fatal', async () => {
    const sqlClientFactory = jest.fn();
    const badDbUrls = [
      'postgresql://u:p@arbitrario.render.internal:5432/wintoncoin_demo_db', // host sin demo
      'postgresql://u:p@wintoncoin-demo-db.render.internal:5432/wintoncoin_app', // db sin demo
      'postgresql://u:p@wintoncoin-demo-db.render.internal:5432/wintoncoin_demo_db?host=evil.internal',
      'postgresql://u:p@wintoncoin-demo-db.render.internal:5432/wintoncoin_demo_db?options=-c%20default_transaction_read_only=off',
      'postgresql://u:p@wintoncoin-demo-db.render.internal:5432/wintoncoin_demo_db?sslmode=disable'
    ];
    for (const badDb of badDbUrls) {
      await expect(exportV6DemoInventory({
        rpcUrl: DEMO_RPC_URL,
        databaseUrl: badDb,
        sqlClientFactory,
        manifestOverride: fixture.manifestRaw,
        expectedManifestSha256: fixture.manifestSha256
      })).rejects.toThrow(/SQL_ALLOWLIST_REJECTED/);
    }
    expect(sqlClientFactory).not.toHaveBeenCalled();

    // sslmode=require sí está permitido
    expect(validateDatabaseUrlAllowlist(`${DEMO_DB_URL}?sslmode=require`).valid).toBe(true);

    // Si current_database() devuelve una BD de producción/distinta, se re-lanza como error fatal
    const provider = createMockV6Provider(fixture);
    const wrongDbClient = createMockSqlClient({ currentDatabase: 'wintoncoin_prod' });
    await expect(exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      providerFactory: () => provider,
      sqlClientFactory: async () => wrongDbClient,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    })).rejects.toThrow(/SQL_IDENTITY_REJECTED/);
  });

  test('19. [AG-06 #4] sanitizeText y sanitizeRpcUrl redactan API keys cortas en errores RPC, Bearer, teléfonos y hex blobs largos', () => {
    const shortKeyUrl = 'https://opt-sepolia.g.alchemy.com/v2/k12345';
    expect(sanitizeRpcUrl(shortKeyUrl)).toBe('https://opt-sepolia.g.alchemy.com/v2/[REDACTED_KEY]');

    const rawMsg = `Error en ${shortKeyUrl} auth Bearer eyJhbGciOiJIUzI1NiJ9.secret tel +5491155551234 mail a@b.com blob 0x${'ab'.repeat(80)}`;
    const clean = sanitizeText(rawMsg);
    expect(clean).not.toContain('k12345');
    expect(clean).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(clean).not.toContain('+5491155551234');
    expect(clean).not.toContain('a@b.com');
    expect(clean).not.toContain('ab'.repeat(70));
    expect(clean).toContain('[REDACTED_KEY]');
    expect(clean).toContain('Bearer [REDACTED]');
    expect(clean).toContain('[REDACTED_PHONE]');
    expect(clean).toContain('[REDACTED_EMAIL]');
    expect(clean).toContain('0x[REDACTED_HEX_BLOB]');
  });

  test('20. [AG-06 #5] CLI devuelve exitCode=2 cuando falla SQL sin --skip-sql y exitCode=0 con fullComplete=true', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'winton-v6-cli-'));
    const outFile = path.join(tmpDir, 'cli-exit.json');

    const failSqlRes = await runCli({
      argv: ['--rpc-url', DEMO_RPC_URL, '--database-url', DEMO_DB_URL, '--out', outFile],
      env: {},
      exporterFn: async () => ({
        environment: { chainId: '11155420', epoch: 'V6_DEMO', readOnly: true },
        metadata: { rpc: { finalizedBlockNumber: FINALIZED_BLOCK_NUM } },
        completeness: { onchainComplete: true, sqlComplete: false, fullComplete: false },
        invariants: { allPassed: true },
        eligibility: { candidateEmptyAtBlock: true, routeAEligible: false },
        onchain: { accountsCount: 18 }
      }),
      stdout: { write: () => {} },
      stderr: { write: () => {} }
    });
    expect(failSqlRes.exitCode).toBe(2);

    const okFullRes = await runCli({
      argv: ['--rpc-url', DEMO_RPC_URL, '--database-url', DEMO_DB_URL, '--out', outFile],
      env: {},
      exporterFn: async () => ({
        environment: { chainId: '11155420', epoch: 'V6_DEMO', readOnly: true },
        metadata: { rpc: { finalizedBlockNumber: FINALIZED_BLOCK_NUM } },
        completeness: { onchainComplete: true, sqlComplete: true, fullComplete: true },
        invariants: { allPassed: true },
        eligibility: { candidateEmptyAtBlock: true, routeAEligible: false },
        onchain: { accountsCount: 18 }
      }),
      stdout: { write: () => {} },
      stderr: { write: () => {} }
    });
    expect(okFullRes.exitCode).toBe(0);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('21. [AG-06 #6 y AG-08 #12] Pagina publications completas sin truncar y bloquea routeAEligible ante publicationsActive o moraEpisodes en users', async () => {
    const provider = createMockV6Provider(fixture);
    const sqlClient = createMockSqlClient({
      columns: [
        { table_name: 'users', column_name: 'id', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
        { table_name: 'users', column_name: 'web3_wallet_address', data_type: 'text', numeric_precision: null, numeric_scale: null },
        { table_name: 'users', column_name: 'kyc_verified', data_type: 'boolean', numeric_precision: null, numeric_scale: null },
        { table_name: 'users', column_name: 'mora_episode_base_limit', data_type: 'numeric', numeric_precision: 24, numeric_scale: 6 },
        { table_name: 'users', column_name: 'mora_episode_started_at', data_type: 'timestamp with time zone', numeric_precision: null, numeric_scale: null },
        { table_name: 'publications', column_name: 'id', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
        { table_name: 'publications', column_name: 'author_id', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
        { table_name: 'publications', column_name: 'status', data_type: 'character varying', numeric_precision: null, numeric_scale: null },
        { table_name: 'publications', column_name: 'blue_cost', data_type: 'numeric', numeric_precision: 30, numeric_scale: 6 }
      ],
      users: [
        {
          id: 1,
          web3_wallet_address: USER_SQL,
          kyc_verified: true,
          mora_episode_base_limit: '50.000000',
          mora_episode_started_at: new Date('2026-11-20T00:00:00Z')
        }
      ],
      publicationsActive: [
        { id: 1, author_id: 1, status: 'active', blue_cost: '10.000000' },
        { id: 2, author_id: 1, status: 'in_progress', blue_cost: '20.000000' },
        { id: 3, author_id: 1, status: 'active', blue_cost: '30.000000' }
      ]
    });

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      sqlPageSize: 2, // Fuerza 2 páginas para leer las 3 publicaciones
      writeContainmentVerified: true,
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClient,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(report.sql.publicationsActive).toHaveLength(3);
    expect(report.sql.moraEpisodes).toHaveLength(1);
    expect(report.sql.moraEpisodes[0].moraEpisodeBaseLimit).toBe('50.000000');
    expect(report.eligibility.routeAEligible).toBe(false);
    expect(report.eligibility.routeABlockingReasons.some((r) => /publications/.test(r))).toBe(true);
    expect(report.eligibility.routeABlockingReasons.some((r) => /mora_episode_\*/.test(r))).toBe(true);
  });

  test('22. [AG-06 #7] createPinnedRunner NO degrada a blockNumber si el nodo reporta not canonical / reorg / block not found', async () => {
    const fallbackCall = jest.fn();
    const reorgProvider = {
      send: jest.fn().mockRejectedValue(new Error('header not found: block is not canonical after reorg')),
      call: fallbackCall
    };
    const runner = createPinnedRunner(reorgProvider, { number: FINALIZED_BLOCK_NUM, hash: FINALIZED_BLOCK_HASH });

    await expect(runner.call({ to: OWNER_ADDR, data: '0x12345678' })).rejects.toThrow(/not canonical/i);
    expect(fallbackCall).not.toHaveBeenCalled();
  });

  test('23. [AG-08 B1] Timeout en Paso 6 (global_state_read) serializa null (nunca "0") y fuerza invariants.allPassed=false', async () => {
    const provider = createMockV6Provider(fixture, { failGlobalStateRead: true });
    const sqlClient = createMockSqlClient();

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClient,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(report.completeness.globalStateComplete).toBe(false);
    expect(report.completeness.onchainComplete).toBe(false);
    expect(report.completeness.fullComplete).toBe(false);
    expect(report.invariants.allPassed).toBe(false);
    expect(report.invariants.checks.dataCompleteness.ok).toBe(false);
    expect(report.onchain.supplies).toBeNull();
    expect(report.onchain.collateralVault).toBeNull();
    expect(report.onchain.exchange).toBeNull();
    expect(report.eligibility.candidateEmptyAtBlock).toBe(false);
    expect(report.eligibility.routeAEligible).toBe(false);
    // Además, la API key corta en el error RPC quedó redactada
    expect(JSON.stringify(report)).not.toContain('shortKey9');
  });

  test('24. [AG-08 B2] getLogs devolviendo null lanza INVALID_LOGS_RESPONSE y marca onchainComplete=false', async () => {
    const provider = createMockV6Provider(fixture, { nullLogsResponse: true });

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      skipSql: true,
      providerFactory: () => provider,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(report.metadata.rpc.logScan.paginationComplete).toBe(false);
    expect(report.completeness.onchainComplete).toBe(false);
    expect(report.invariants.allPassed).toBe(false);
    expect(report.errors.onchain.some((e) => /INVALID_LOGS_RESPONSE/.test(e.message))).toBe(true);
  });

  test('25. [AG-08 B3] Timeout en paymentAuthContract.nonces y en riskContract.profileUpdateVersion registran error y fuerzan onchainComplete=false', async () => {
    const pNonces = createMockV6Provider(fixture, { timeoutOnNonces: true });
    const rNonces = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      skipSql: true,
      providerFactory: () => pNonces,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });
    expect(rNonces.completeness.onchainComplete).toBe(false);
    expect(rNonces.invariants.allPassed).toBe(false);
    expect(rNonces.errors.onchain.some((e) => e.code === 'PAYMENT_AUTH_NONCE_ERROR')).toBe(true);
    expect(JSON.stringify(rNonces)).not.toContain('abc123');

    const pRiskVer = createMockV6Provider(fixture, { timeoutOnProfileUpdateVersion: true });
    const rRiskVer = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      skipSql: true,
      providerFactory: () => pRiskVer,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });
    expect(rRiskVer.completeness.onchainComplete).toBe(false);
    expect(rRiskVer.metadata.registryVersionDetected).not.toBe('v6.0_base');
    expect(rRiskVer.errors.onchain.some((e) => e.code === 'RISK_REGISTRY_VERSION_READ_ERROR')).toBe(true);
  });

  test('26. [AG-08 #12] resolveContractStartBlocks registra START_BLOCK_RECEIPT_MISSING si getTransactionReceipt devuelve null', async () => {
    const manifestNoStart = {
      ...fixture.manifest,
      startBlocks: {},
      deployTransactions: {
        BlueTokenV6: '0x' + '12'.repeat(32)
      }
    };
    const raw = JSON.stringify(manifestNoStart);
    const sha = createHash('sha256').update(raw).digest('hex');
    const provider = createMockV6Provider({ ...fixture, manifest: manifestNoStart });

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      skipSql: true,
      providerFactory: () => provider,
      manifestOverride: raw,
      expectedManifestSha256: sha
    });

    expect(report.completeness.onchainComplete).toBe(false);
    expect(report.errors.onchain.some((e) => e.code === 'START_BLOCK_RECEIPT_MISSING')).toBe(true);
  });

  test('27. createDefaultProvider usa batchMaxCount=1 sin staticNetwork y withRateLimitRetry reintenta -32016 con backoff y falla cerrado al agotarse', async () => {
    const realProvider = createDefaultProvider('https://sepolia.optimism.io');
    expect(realProvider._getOption('batchMaxCount')).toBe(1);
    expect(realProvider._getOption('staticNetwork')).toBeNull();
    if (typeof realProvider.destroy === 'function') realProvider.destroy();

    const delays = [];
    let calls = 0;
    const recovered = await withRateLimitRetry(async () => {
      calls += 1;
      if (calls < 3) {
        const err = new Error('Your IP has exceeded its requests per second capacity');
        err.code = -32016;
        throw err;
      }
      return 'OK';
    }, {
      maxAttempts: 4,
      baseDelayMs: 100,
      sleepFn: async (ms) => { delays.push(ms); }
    });
    expect(recovered).toBe('OK');
    expect(calls).toBe(3);
    expect(delays).toEqual([100, 200]);

    // Al agotar intentos, falla cerrado (relanza el error)
    let exhaustedCalls = 0;
    await expect(withRateLimitRetry(async () => {
      exhaustedCalls += 1;
      const err = new Error('Your IP has exceeded its requests per second capacity');
      err.code = -32016;
      throw err;
    }, {
      maxAttempts: 3,
      baseDelayMs: 50,
      sleepFn: async () => {}
    })).rejects.toThrow(/exceeded its requests per second/);
    expect(exhaustedCalls).toBe(3);

    // Errores no rate-limit NO se reintentan
    let nonRateCalls = 0;
    await expect(withRateLimitRetry(async () => {
      nonRateCalls += 1;
      throw new Error('execution reverted');
    }, {
      maxAttempts: 4,
      baseDelayMs: 50,
      sleepFn: async () => {}
    })).rejects.toThrow(/execution reverted/);
    expect(nonRateCalls).toBe(1);
  });

  // --------------------------------------------------------------------------
  // PRUEBAS CODEX-205 (#1 Y #2): ESQUEMA REAL 128..131, DEAD_LETTER Y ACCEPTANCES
  // --------------------------------------------------------------------------

  test('28. [CODEX-205 #1a] BD Demo sin migraciones 128..131 aplicadas reporta optionalMigrations ausentes sin fallar', async () => {
    const provider = createMockV6Provider(fixture);
    const sqlClient = createMockSqlClient();

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClient,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(report.completeness.sqlComplete).toBe(true);
    expect(report.completeness.fullComplete).toBe(true);
    expect(report.errors.sql).toEqual([]);

    const opt = report.sql.schema.optionalMigrations;
    expect(opt['128_credit_penalty_episode'].present).toBe(false);
    expect(opt['128_credit_penalty_episode'].columns['users.mora_episode_base_limit']).toBe(false);
    expect(opt['128_credit_penalty_episode'].columns['users.mora_episode_started_at']).toBe(false);

    expect(opt['129_credit_notification_outbox'].present).toBe(false);
    expect(opt['129_credit_notification_outbox'].tablePresent).toBe(false);

    expect(opt['130_credit_referral_episode_awards'].present).toBe(false);
    expect(opt['130_credit_referral_episode_awards'].tablePresent).toBe(false);
    expect(opt['130_credit_referral_episode_awards'].columns['users.mora_episode_earned_base']).toBe(false);
    expect(opt['130_credit_referral_episode_awards'].columns['users.mora_episode_referral_base']).toBe(false);
    expect(opt['130_credit_referral_episode_awards'].columns['users.mora_episode_target_base']).toBe(false);
    expect(opt['130_credit_referral_episode_awards'].columns['users.mora_episode_bonus_applied']).toBe(false);

    expect(opt['131_publication_base_precision'].present).toBe(false);
    expect(opt['131_publication_base_precision'].columns['publications.base_blue_cost'].isNumeric30_6).toBe(false);
    expect(opt['131_publication_base_precision'].columns['publications.goal_amount'].isNumeric30_6).toBe(false);

    expect(report.sql.moraEpisodes).toEqual([]);
    expect(report.sql.creditNotificationOutbox.tablePresent).toBe(false);
    expect(report.sql.creditReferralAwards.tablePresent).toBe(false);
  });

  test('29. [CODEX-205 #1b] BD Demo con migraciones 128..131 aplicadas lee columnas/tablas literales y precisión NUMERIC(30,6)', async () => {
    const provider = createMockV6Provider(fixture);
    const sqlClient = createMockSqlClient({
      tables: [
        ...REQUIRED_SQL_TABLES,
        'smart_accounts',
        'credit_policy_versions',
        'credit_notification_outbox',
        'credit_referral_awards',
        'web3_exchange_v6_orders',
        'web3_exchange_v6_refunds'
      ],
      columns: [
        { table_name: 'users', column_name: 'id', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
        { table_name: 'users', column_name: 'web3_wallet_address', data_type: 'text', numeric_precision: null, numeric_scale: null },
        { table_name: 'users', column_name: 'kyc_verified', data_type: 'boolean', numeric_precision: null, numeric_scale: null },
        { table_name: 'users', column_name: 'mora_episode_base_limit', data_type: 'numeric', numeric_precision: 24, numeric_scale: 6 },
        { table_name: 'users', column_name: 'mora_episode_started_at', data_type: 'timestamp with time zone', numeric_precision: null, numeric_scale: null },
        { table_name: 'users', column_name: 'mora_episode_earned_base', data_type: 'numeric', numeric_precision: 24, numeric_scale: 6 },
        { table_name: 'users', column_name: 'mora_episode_referral_base', data_type: 'numeric', numeric_precision: 24, numeric_scale: 6 },
        { table_name: 'users', column_name: 'mora_episode_target_base', data_type: 'numeric', numeric_precision: 24, numeric_scale: 6 },
        { table_name: 'users', column_name: 'mora_episode_bonus_applied', data_type: 'numeric', numeric_precision: 24, numeric_scale: 6 },
        { table_name: 'publications', column_name: 'id', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
        { table_name: 'publications', column_name: 'author_id', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
        { table_name: 'publications', column_name: 'status', data_type: 'character varying', numeric_precision: null, numeric_scale: null },
        { table_name: 'publications', column_name: 'blue_cost', data_type: 'numeric', numeric_precision: 30, numeric_scale: 6 },
        { table_name: 'publications', column_name: 'base_blue_cost', data_type: 'numeric', numeric_precision: 30, numeric_scale: 6 },
        { table_name: 'publications', column_name: 'goal_amount', data_type: 'numeric', numeric_precision: 30, numeric_scale: 6 },
        { table_name: 'publication_acceptances', column_name: 'id', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
        { table_name: 'publication_acceptances', column_name: 'blue_cost', data_type: 'numeric', numeric_precision: 30, numeric_scale: 6 }
      ],
      users: [
        {
          id: 1,
          web3_wallet_address: USER_SQL,
          kyc_verified: true,
          mora_episode_base_limit: '75.500000',
          mora_episode_started_at: new Date('2026-11-21T12:00:00Z'),
          mora_episode_earned_base: '60.000000',
          mora_episode_referral_base: '15.500000',
          mora_episode_target_base: '120.000000',
          mora_episode_bonus_applied: '5.000000'
        }
      ],
      creditNotificationOutbox: [
        {
          operation_id: '00000000-0000-4000-8000-000000000010',
          user_id: 1,
          confirmed_limit: '75.500000',
          tx_hash: '0x' + 'aa'.repeat(32),
          block_hash: '0x' + 'bb'.repeat(32),
          payload: { email: 'fuga.prohibida@example.com', phone: '+5491199998888' },
          status: 'pending',
          attempts: 2,
          next_attempt_at: new Date('2026-11-24T20:00:00Z'),
          last_error: 'Push timeout para usuario@secreto.com',
          created_at: new Date('2026-11-24T19:00:00Z'),
          delivered_at: null
        },
        {
          operation_id: '00000000-0000-4000-8000-000000000011',
          user_id: 1,
          confirmed_limit: '100.000000',
          tx_hash: '0x' + 'cc'.repeat(32),
          block_hash: '0x' + 'dd'.repeat(32),
          status: 'delivered',
          attempts: 1,
          next_attempt_at: new Date('2026-11-23T19:00:00Z'),
          last_error: null,
          created_at: new Date('2026-11-23T18:00:00Z'),
          delivered_at: new Date('2026-11-23T18:05:00Z')
        }
      ],
      creditReferralAwards: [
        {
          referred_user_id: 2,
          referrer_user_id: 1,
          amount: '0.000000',
          recorded_at: new Date('1970-01-01T00:00:00Z'),
          baseline: true
        },
        {
          referred_user_id: 3,
          referrer_user_id: 1,
          amount: '15.500000',
          recorded_at: new Date('2026-11-22T15:30:00Z'),
          baseline: false
        }
      ]
    });

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      writeContainmentVerified: true,
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClient,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(report.completeness.sqlComplete).toBe(true);
    const opt = report.sql.schema.optionalMigrations;
    expect(opt['128_credit_penalty_episode'].present).toBe(true);
    expect(opt['129_credit_notification_outbox'].present).toBe(true);
    expect(opt['130_credit_referral_episode_awards'].present).toBe(true);
    expect(opt['131_publication_base_precision'].present).toBe(true);
    expect(opt['131_publication_base_precision'].columns['publications.base_blue_cost']).toMatchObject({
      present: true,
      numericPrecision: 30,
      numericScale: 6,
      isNumeric30_6: true
    });
    expect(opt['131_publication_base_precision'].columns['publications.goal_amount']).toMatchObject({
      present: true,
      numericPrecision: 30,
      numericScale: 6,
      isNumeric30_6: true
    });

    // Episodio de mora leído con columnas reales de 128 y 130 (strings exactos)
    expect(report.sql.moraEpisodes).toHaveLength(1);
    expect(report.sql.moraEpisodes[0]).toMatchObject({
      userId: 1,
      moraEpisodeBaseLimit: '75.500000',
      moraEpisodeStartedAt: '2026-11-21T12:00:00.000Z',
      moraEpisodeEarnedBase: '60.000000',
      moraEpisodeReferralBase: '15.500000',
      moraEpisodeTargetBase: '120.000000',
      moraEpisodeBonusApplied: '5.000000'
    });

    // Outbox 129: solo pendientes, conteo por estado, cero payload crudo y lastError sanitizado
    expect(report.sql.creditNotificationOutbox.tablePresent).toBe(true);
    expect(report.sql.creditNotificationOutbox.countsByStatus).toEqual({ pending: '1', delivered: '1' });
    expect(report.sql.creditNotificationOutbox.pendingItems).toHaveLength(1);
    expect(report.sql.creditNotificationOutbox.pendingItems[0].confirmedLimit).toBe('75.500000');
    expect(report.sql.creditNotificationOutbox.pendingItems[0].lastError).toContain('[REDACTED_EMAIL]');

    // Premios de referidos 130: excluye baseline=TRUE, montos exactos como string
    expect(report.sql.creditReferralAwards.tablePresent).toBe(true);
    expect(report.sql.creditReferralAwards.countsByBaseline).toEqual({ baseline: '1', active: '1' });
    expect(report.sql.creditReferralAwards.activeAwards).toHaveLength(1);
    expect(report.sql.creditReferralAwards.activeAwards[0]).toMatchObject({
      referredUserId: 3,
      referrerUserId: 1,
      amount: '15.500000',
      baseline: false
    });

    // Cero PII filtrado del payload del outbox ni de last_error
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('fuga.prohibida@example.com');
    expect(serialized).not.toContain('+5491199998888');
    expect(serialized).not.toContain('usuario@secreto.com');

    // Bloquea Ruta A por episodio de mora activo y notificación pendiente
    expect(report.eligibility.routeAEligible).toBe(false);
    expect(report.eligibility.routeABlockingReasons.some((r) => /credit_notification_outbox/.test(r))).toBe(true);
  });

  test('30. [CODEX-205 #2a] credit_policy_issues captura dead_letter, reporta conteo por estado y bloquea routeAEligible', async () => {
    const provider = createMockV6Provider(fixture);
    const sqlClient = createMockSqlClient({
      creditPolicyIssues: [
        {
          version_id: '12',
          user_id: 1,
          operation_id: '00000000-0000-4000-8000-000000000021',
          reason: 'ONCHAIN_SYNC_EXHAUSTED',
          status: 'dead_letter',
          retry_requested: false,
          retry_count: 5,
          max_retries: 5,
          next_retry_at: null,
          last_error: 'RPC revert en https://opt-sepolia.g.alchemy.com/v2/secretKey99',
          updated_at: new Date('2026-11-24T18:30:00Z')
        },
        {
          version_id: '11',
          user_id: 1,
          operation_id: '00000000-0000-4000-8000-000000000020',
          reason: 'PREVIOUS_TRANSIENT',
          status: 'resolved',
          retry_requested: false,
          retry_count: 1,
          max_retries: 5,
          next_retry_at: null,
          last_error: null,
          updated_at: new Date('2026-11-23T18:30:00Z')
        }
      ]
    });

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      writeContainmentVerified: true,
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClient,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(report.sql.policy.creditPolicyIssuesCountsByStatus).toEqual({
      dead_letter: '1',
      resolved: '1'
    });
    expect(report.sql.policy.openCreditPolicyIssues).toHaveLength(1);
    expect(report.sql.policy.openCreditPolicyIssues[0]).toMatchObject({
      versionId: '12',
      userId: 1,
      status: 'dead_letter',
      retryCount: 5,
      maxRetries: 5
    });
    expect(report.sql.policy.openCreditPolicyIssues[0].lastError).not.toContain('secretKey99');
    expect(report.eligibility.routeAEligible).toBe(false);
    expect(report.eligibility.routeABlockingReasons.some((r) => /dead_letter/.test(r))).toBe(true);
  });

  test('31. [CODEX-205 #2b] publication_acceptances pagina pagos/aceptaciones pendientes por id > $1 sin PII y bloquea routeAEligible', async () => {
    const provider = createMockV6Provider(fixture);
    const sqlClient = createMockSqlClient({
      publicationAcceptances: [
        {
          id: 101,
          publication_id: 10,
          acceptor_user_id: 1,
          acceptor_username: 'juan.perez.privado',
          status: 'pending_approval',
          blue_cost: '12.345678',
          created_at: new Date('2026-11-24T10:00:00Z'),
          paid_recorded_at: null
        },
        {
          id: 102,
          publication_id: 10,
          acceptor_user_id: 2,
          acceptor_username: 'maria.gomez.privada',
          status: 'approved',
          blue_cost: '25.000000',
          created_at: new Date('2026-11-24T11:00:00Z'),
          paid_recorded_at: null
        },
        {
          id: 103,
          publication_id: 11,
          acceptor_user_id: 3,
          acceptor_username: 'carlos.lopez.privado',
          status: 'completed',
          blue_cost: '40.500000',
          created_at: new Date('2026-11-24T12:00:00Z'),
          paid_recorded_at: null
        },
        {
          id: 104,
          publication_id: 11,
          acceptor_user_id: 4,
          acceptor_username: 'ana.pagada.privada',
          status: 'confirmed_paid',
          blue_cost: '99.000000',
          created_at: new Date('2026-11-23T12:00:00Z'),
          paid_recorded_at: new Date('2026-11-23T13:00:00Z')
        }
      ]
    });

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      sqlPageSize: 2, // Fuerza 2 páginas para las 3 aceptaciones pendientes
      writeContainmentVerified: true,
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClient,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(report.sql.publicationAcceptancesCountsByStatus).toEqual({
      pending_approval: '1',
      approved: '1',
      completed: '1',
      confirmed_paid: '1'
    });
    expect(report.sql.publicationAcceptancesPending).toHaveLength(3);
    expect(report.sql.publicationAcceptancesPending.map((a) => a.id)).toEqual([101, 102, 103]);
    expect(report.sql.publicationAcceptancesPending[0]).toMatchObject({
      id: 101,
      publicationId: 10,
      acceptorUserId: 1,
      status: 'pending_approval',
      blueCost: '12.345678'
    });

    // Verificar cero PII (ningún acceptor_username en el reporte)
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('juan.perez.privado');
    expect(serialized).not.toContain('maria.gomez.privada');
    expect(serialized).not.toContain('carlos.lopez.privado');
    expect(serialized).not.toContain('acceptor_username');

    // Bloquea Ruta A por aceptaciones/pagos pendientes
    expect(report.eligibility.routeAEligible).toBe(false);
    expect(report.eligibility.routeABlockingReasons.some((r) => /publication_acceptances/.test(r))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // PRUEBAS CODEX-205 (#3, #4 Y #5): POST-FINALIZED, EVIDENCIA EXTERNA Y EJES SQL/ONCHAIN
  // --------------------------------------------------------------------------

  test('32. [CODEX-205 #3a] Progresión normal latest > finalized con 0 eventos relevantes NO bloquea routeAEligible y emite nonProofNotice', async () => {
    const provider = createMockV6Provider(fixture, {
      latestBlockNumber: FINALIZED_BLOCK_NUM + 25
    });
    const sqlClient = createMockSqlClient();

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      writeContainmentDeclared: true,
      writeContainmentExternalVerified: true,
      writeContainmentEvidenceRef: 'CONTAINMENT-ACTA-2026-11-24-SHA256',
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClient,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(report.eligibility.activityAfterFinalized.hasBlocksAfterFinalized).toBe(true);
    expect(report.eligibility.activityAfterFinalized.blocksDelta).toBe(25);
    expect(report.eligibility.activityAfterFinalized.postFinalizedScanExecuted).toBe(true);
    expect(report.eligibility.activityAfterFinalized.postFinalizedScanComplete).toBe(true);
    expect(report.eligibility.activityAfterFinalized.relevantEventsCount).toBe(0);
    expect(report.eligibility.activityAfterFinalized.nonProofNotice).toMatch(/NO prueba por sí sola/);
    expect(report.eligibility.routeAEligible).toBe(true);
    expect(report.eligibility.routeABlockingReasons).toEqual([]);
  });

  test('33. [CODEX-205 #3b] Escritura relevante emitida tras finalized (finalized + 1 .. latest) SÍ bloquea routeAEligible', async () => {
    const modeIface = new Interface(['event OperationalModeChanged(uint8 indexed previousMode, uint8 indexed newMode, address indexed actor)']);
    const encoded = modeIface.encodeEventLog(
      modeIface.getEvent('OperationalModeChanged'),
      [1, 0, OWNER_ADDR]
    );
    const provider = createMockV6Provider(fixture, {
      latestBlockNumber: FINALIZED_BLOCK_NUM + 10,
      logsByContract: {
        ProtocolModeController: [{
          address: fixture.manifest.contracts.ProtocolModeController,
          topics: encoded.topics,
          data: encoded.data,
          blockNumber: FINALIZED_BLOCK_NUM + 3,
          transactionHash: '0x' + 'ee'.repeat(32)
        }]
      }
    });
    const sqlClient = createMockSqlClient();

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      writeContainmentDeclared: true,
      writeContainmentExternalVerified: true,
      writeContainmentEvidenceRef: 'CONTAINMENT-ACTA-2026-11-24-SHA256',
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClient,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(report.eligibility.activityAfterFinalized.relevantEventsCount).toBe(1);
    expect(report.eligibility.activityAfterFinalized.relevantEvents[0]).toMatchObject({
      contract: 'ProtocolModeController',
      blockNumber: FINALIZED_BLOCK_NUM + 3
    });
    expect(report.eligibility.routeAEligible).toBe(false);
    expect(report.eligibility.routeABlockingReasons.some((r) => /escritura\(s\)\/evento\(s\) relevante\(s\)/i.test(r))).toBe(true);
  });

  test('34. [CODEX-205 #4] Declaración booleana writeContainmentVerified/Declared sin evidencia externa NO habilita routeAEligible', async () => {
    const provider = createMockV6Provider(fixture);
    const sqlClient = createMockSqlClient();

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      writeContainmentVerified: true, // solo declaración booleana del operador, sin evidencia externa
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClient,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(report.completeness.fullComplete).toBe(true);
    expect(report.eligibility.candidateEmptyAtBlock).toBe(true);
    expect(report.eligibility.writeContainmentDeclaration.declaredByOperator).toBe(true);
    expect(report.eligibility.writeContainmentDeclaration.notice).toMatch(/declaración del operador/);
    expect(report.eligibility.writeContainmentEvidence).toEqual({
      declaredByOperator: true,
      externalEvidenceProvided: false,
      externalEvidenceRef: null,
      requiresExternalVerificationBeforeCutover: true
    });
    expect(report.eligibility.routeAEligible).toBe(false);
    expect(report.eligibility.routeABlockingReasons.some((r) => /evidencia externa verificable/.test(r))).toBe(true);
  });

  test('35. [CODEX-205 #5] Economía on-chain vacía + publicaciones SQL -> onchainMigratorRequired=false y sqlPreservationAndReconciliation preserva históricos', async () => {
    const provider = createMockV6Provider(fixture);
    const sqlClient = createMockSqlClient({
      publicationsActive: [
        { id: 1, author_id: 1, status: 'active', blue_cost: '15.000000', base_blue_cost: '15.000000' }
      ]
    });

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: DEMO_DB_URL,
      writeContainmentDeclared: true,
      writeContainmentExternalVerified: true,
      writeContainmentEvidenceRef: 'CONTAINMENT-ACTA-2026-11-24-SHA256',
      providerFactory: () => provider,
      sqlClientFactory: async () => sqlClient,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(report.eligibility.candidateEmptyAtBlock).toBe(true);
    expect(report.eligibility.onchainMigratorRequired).toEqual({
      required: false,
      reasons: []
    });
    expect(report.eligibility.sqlPreservationAndReconciliation.required).toBe(true);
    expect(report.eligibility.sqlPreservationAndReconciliation.preserveHistoricalRecords).toBe(true);
    expect(report.eligibility.sqlPreservationAndReconciliation.neverDeleteHistoricalPublicationsOrIous).toBe(true);
    expect(report.eligibility.sqlPreservationAndReconciliation.pendingItems.some((i) => i.category === 'publications')).toBe(true);
    expect(report.eligibility.routeAEligible).toBe(false);
    expect(report.eligibility.routeABlockingReasons.some((r) => /Conciliación SQL pendiente.*publications/.test(r))).toBe(true);
  });
});
