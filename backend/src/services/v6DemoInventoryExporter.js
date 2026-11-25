'use strict';

/**
 * ============================================================================
 * EXPORTADOR DE INVENTARIO 100% READ-ONLY — SUITE V6 DEMO (OPTIMISM SEPOLIA)
 * ============================================================================
 * Propósito:
 * Construir una fotografía auditable, determinista y fail-closed del estado
 * on-chain (anclado a un único bloque `finalized`) y del estado SQL Demo
 * (dentro de una transacción `REPEATABLE READ READ ONLY`) de la suite V6 Demo
 * (`chainId = 11155420`, `epoch = V6_DEMO`), cumpliendo las 7 condiciones
 * fail-closed de CODEX-203.
 *
 * Garantías de Seguridad (Zero-Trust / SOC 2):
 * 1. Allowlist explícita de RPC Demo y destino SQL Demo ANTES de abrir
 *    cualquier conexión de red o base de datos.
 * 2. Prohibido cargar `.env` genérico, instanciar Wallet/Signer o firmar/enviar
 *    transacciones. Este módulo es estrictamente de solo lectura.
 * 3. Todos los montos monetarios y de tokens se serializan como strings exactos
 *    (unidades base enteras de 6 decimales y representación decimal exacta),
 *    nunca como `Number` de punto flotante.
 * 4. Cero credenciales, cero `DATABASE_URL`, cero PII (sin correos, teléfonos
 *    ni nombres KYC) y cero transacciones firmadas crudas o calldata reutilizable.
 * 5. Nunca convierte errores, timeouts, `null` ni historial podado (4444) en
 *    saldos `0` o listas vacías: falla cerrado marcando completitud e
 *    elegibilidad en `false`.
 * 6. Terminología canónica: los saldos RED son compromisos RED.
 * ============================================================================
 */

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const {
  Contract,
  Interface,
  JsonRpcProvider,
  formatUnits,
  getAddress,
  isAddress,
  keccak256
} = require('ethers');
const v6ReleasePin = require('./v6ReleasePin');
const { LINKS: V6_LINKS } = require('./validateV6Demo');

// ----------------------------------------------------------------------------
// CONSTANTES CANÓNICAS DE LA SUITE V6 DEMO
// ----------------------------------------------------------------------------

const DEMO_CHAIN_ID = 11155420n;
const DEMO_CHAIN_ID_STR = '11155420';
const DEMO_EPOCH = 'V6_DEMO';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DEFAULT_MANIFEST_PATH = path.resolve(__dirname, '../../../web3-contracts/deployments/v6-demo-candidate.json');

const DEFAULT_MAX_LOG_BLOCK_SPAN = 10_000;
const DEFAULT_SQL_STATEMENT_TIMEOUT_MS = 15_000;
const DEFAULT_SQL_PAGE_SIZE = 500;

const MODE_NAMES = Object.freeze({
  0: 'NORMAL',
  1: 'PRELAUNCH_FROZEN',
  2: 'EMERGENCY_EXIT_ONLY'
});

const ORDER_SIDE_NAMES = Object.freeze({
  0: 'BLUE_FOR_USDT',
  1: 'USDT_FOR_BLUE'
});

const ORDER_STATUS_NAMES = Object.freeze({
  0: 'NONE',
  1: 'OPEN',
  2: 'PARTIALLY_FILLED',
  3: 'FILLED',
  4: 'CANCELLED',
  5: 'SUSPENDED'
});

// Contratos requeridos en el manifiesto canónico V6 Demo
const REQUIRED_V6_CONTRACTS = Object.freeze([
  'ProtocolModeController',
  'RiskRegistry',
  'ProtocolConfig',
  'PaymentAuthorization',
  'CommitmentLedger',
  'BlueTokenV6',
  'RedTokenV6',
  'ProtocolTreasuryV6',
  'PairedSupplyController',
  'PaymentEngine',
  'ExtensionManager',
  'ExchangeConfig',
  'FifoOrderBook',
  'ExchangeCustody',
  'AmortizationAdapter',
  'ExchangeRouter',
  'CollateralVaultV6',
  'USDT'
]);

// Patrones estrictamente anclados al HOSTNAME de proveedores legítimos de Optimism Sepolia Demo
// (nunca se valida contra pathname para impedir bypasses tipo https://evil.com/opt-sepolia)
const DEFAULT_ALLOWED_RPC_HOSTNAME_PATTERNS = Object.freeze([
  /^sepolia\.optimism\.io$/i,
  /^opt-sepolia\.g\.alchemy\.com$/i,
  /^optimism-sepolia\.infura\.io$/i,
  /^optimism-sepolia\.drpc\.org$/i,
  /^optimism-sepolia-rpc\.publicnode\.com$/i,
  /^optimism-sepolia\.blockpi\.network$/i,
  /^sepolia\.optimism\.gateway\.tenderly\.co$/i
]);

// Segmentos de ruta públicos permitidos sin redacción en URLs RPC
const ALLOWED_PUBLIC_RPC_PATH_SEGMENTS = /^(v\d+|rpc|sepolia|optimism|eth)$/i;

// Valores permitidos para `sslmode` en URLs PostgreSQL (cualquier otro query param libpq se rechaza)
const ALLOWED_PG_SSLMODES = new Set(['require', 'verify-ca', 'verify-full', 'prefer']);

// Patrones explícitamente prohibidos (producción / mainnet)
const FORBIDDEN_PROD_PATTERNS = Object.freeze([
  /mainnet/i,
  /opt-mainnet/i,
  /optimism-mainnet/i,
  /eth-mainnet/i,
  /(^|[._-])prod(uction)?([._-]|$)/i,
  /wintoncoin[_-]prod/i
]);

// Hosts locales (solo habilitados cuando se solicita explícitamente en tests/local)
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

// Tablas SQL requeridas para considerar el inventario SQL completo
const REQUIRED_SQL_TABLES = Object.freeze([
  'users',
  'app_settings',
  'chain_operations',
  'publications',
  'publication_acceptances',
  'web3_escrow_holds',
  'credit_policy_issues',
  'web3_exchange_v6_sync'
]);

// Tablas opcionales reales que pueden existir según migraciones aplicadas (incl. 117, 120, 129, 130)
const OPTIONAL_SQL_TABLES = Object.freeze([
  'smart_accounts',
  'credit_policy_versions',
  'credit_policy_jobs',
  'user_credit_cure_logs',
  'marketplace_payment_settlements',
  'web3_exchange_v6_orders',
  'web3_exchange_v6_refunds',
  'credit_notification_outbox',
  'credit_referral_awards'
]);

// Columnas opcionales reales según migraciones 115, 119, 120, 122, 128 y 130 (CERO nombres inventados)
const OPTIONAL_SQL_COLUMNS = Object.freeze([
  { table: 'users', column: 'red_credit_limit_override', migrationHint: '115' },
  { table: 'credit_policy_issues', column: 'retry_count', migrationHint: '119' },
  { table: 'credit_policy_issues', column: 'next_retry_at', migrationHint: '119' },
  { table: 'credit_policy_issues', column: 'max_retries', migrationHint: '119' },
  { table: 'credit_policy_issues', column: 'last_error', migrationHint: '119' },
  { table: 'users', column: 'last_mora_cured_at', migrationHint: '120' },
  { table: 'users', column: 'mora_penalty_base_limit', migrationHint: '120' },
  { table: 'users', column: 'mora_target_limit', migrationHint: '120' },
  { table: 'publication_acceptances', column: 'paid_recorded_at', migrationHint: '122' },
  { table: 'users', column: 'mora_episode_base_limit', migrationHint: '128' },
  { table: 'users', column: 'mora_episode_started_at', migrationHint: '128' },
  { table: 'users', column: 'mora_episode_earned_base', migrationHint: '130' },
  { table: 'users', column: 'mora_episode_referral_base', migrationHint: '130' },
  { table: 'users', column: 'mora_episode_target_base', migrationHint: '130' },
  { table: 'users', column: 'mora_episode_bonus_applied', migrationHint: '130' }
]);

// Claves seguras de `app_settings` permitidas en el inventario (nunca secretos)
const ALLOWED_APP_SETTING_KEYS = Object.freeze([
  'platform_commission_percentage',
  'debt_cycle_days',
  'pre_launch_mode_enabled',
  'red_credit_base_limit',
  'red_credit_referral',
  'red_credit_culture_quiz',
  'red_credit_monthly_activity',
  'red_credit_early_payment',
  'gas_sponsor_enabled',
  'gas_sponsor_daily_user_operations',
  'gas_sponsor_daily_budget_wei',
  'gas_sponsor_max_topup_wei',
  'gas_sponsor_maintenance_daily_budget_wei',
  'gas_sponsor_maintenance_max_step_wei'
]);

// ----------------------------------------------------------------------------
// ABIs MÍNIMOS DE SOLO LECTURA (V6 CANÓNICO)
// ----------------------------------------------------------------------------

const ERC20_VIEW_ABI = Object.freeze([
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
]);

const BLUE_V6_VIEW_ABI = Object.freeze([
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function lockedBalanceOf(address) view returns (uint256)',
  'function availableBalanceOf(address) view returns (uint256)',
  'function parkingHead(address) view returns (uint256)',
  'function parkingLotsCount(address) view returns (uint256)',
  'function parkingLots(address,uint256) view returns (uint256 remaining, uint256 releaseAt)',
  'function owner() view returns (address)'
]);

const RED_V6_VIEW_ABI = Object.freeze([
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function owner() view returns (address)'
]);

const LEDGER_V6_VIEW_ABI = Object.freeze([
  'function nextLotId() view returns (uint256)',
  'function paymentEngine() view returns (address)',
  'function owner() view returns (address)',
  'function lotOwner(uint256) view returns (address)',
  'function ledgerVersion(address) view returns (uint256)',
  'function outstanding(address) view returns (uint256)',
  'function matured(address) view returns (uint256)',
  'function firstLotId(address) view returns (uint256)',
  'function lot(address,uint256) view returns (uint256 dueAt, uint256 amount, uint256 fee, uint256 margin, bool active)'
]);

const RISK_V6_VIEW_ABI = Object.freeze([
  'function owner() view returns (address)',
  'function riskOperator() view returns (address)',
  'function isKYCVerified(address) view returns (bool)',
  'function profile(address) view returns (tuple(uint128 creditLimit, uint8 level, bool kycVerified))',
  'function profileUpdateVersion(address) view returns (uint256)'
]);

const VAULT_V6_VIEW_ABI = Object.freeze([
  'function owner() view returns (address)',
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
  'function existingOrder(uint64) view returns (bool)'
]);

const BOOK_V6_VIEW_ABI = Object.freeze([
  'function owner() view returns (address)',
  'function router() view returns (address)',
  'function nextOrderId() view returns (uint64)',
  'function nextSequence() view returns (uint64)',
  'function queueLength(uint8) view returns (uint256)',
  'function order(uint64) view returns (tuple(uint64 id, uint64 sequence, uint128 remaining, address user, uint8 status, uint8 side, uint48 createdAt, uint128 original, uint128 refunded))'
]);

const CUSTODY_V6_VIEW_ABI = Object.freeze([
  'function owner() view returns (address)',
  'function totalReserved(uint256) view returns (uint128)',
  'function totalPendingRefund(uint256) view returns (uint128)',
  'function accumulatedFees(uint256) view returns (uint128)',
  'function liabilities(uint8) view returns (uint256)',
  'function solvent(uint8) view returns (bool)',
  'function pendingRefund(address,uint8) view returns (uint128)'
]);

const ROUTER_V6_VIEW_ABI = Object.freeze([
  'function blueCursor() view returns (uint256)',
  'function usdtCursor() view returns (uint256)',
  'function MIN_ORDER_AMOUNT() view returns (uint128)'
]);

const ADAPTER_V6_VIEW_ABI = Object.freeze([
  'function owner() view returns (address)',
  'function totalCollateralReserved() view returns (uint128)',
  'function reservation(uint64) view returns (address user, uint128 remaining)'
]);

const EXCHANGE_CONFIG_V6_VIEW_ABI = Object.freeze([
  'function owner() view returns (address)',
  'function feeBps() view returns (uint16)',
  'function treasury() view returns (address)',
  'function pendingFeeBps() view returns (uint16)',
  'function feeReadyAt() view returns (uint48)',
  'function pendingTreasury() view returns (address)',
  'function treasuryReadyAt() view returns (uint48)'
]);

const TREASURY_V6_VIEW_ABI = Object.freeze([
  'function owner() view returns (address)',
  'function corporateTreasuryWallet() view returns (address)',
  'function currentMerkleRoot() view returns (bytes32)',
  'function rewardEpoch() view returns (uint256)',
  'function activeSurplusProposal() view returns (address recipient, uint256 amount, uint256 eta, bool executed, bool cancelled)'
]);

const MODE_V6_VIEW_ABI = Object.freeze([
  'function mode() view returns (uint8)',
  'function owner() view returns (address)',
  'function guardian() view returns (address)'
]);

const PROTOCOL_CONFIG_V6_VIEW_ABI = Object.freeze([
  'function owner() view returns (address)',
  'function activeConfig() view returns (tuple(uint128 maxPayment, uint48 commitmentDuration, uint16 commissionBps))',
  'function pendingConfig() view returns (tuple(uint128 maxPayment, uint48 commitmentDuration, uint16 commissionBps))',
  'function pendingUnlockAt() view returns (uint48)'
]);

const PAIRED_SUPPLY_V6_VIEW_ABI = Object.freeze([
  'function owner() view returns (address)',
  'function operators(address) view returns (bool)',
  'function pairedSupply() view returns (uint256)'
]);

const EXTENSION_MANAGER_V6_VIEW_ABI = Object.freeze([
  'function owner() view returns (address)',
  'function options(uint48) view returns (uint16 feeBps, uint8 minLevel, bool enabled)',
  'function pendingOptions(uint48) view returns (tuple(uint16 feeBps, uint8 minLevel, bool enabled) option, uint48 unlockAt)'
]);

const PAYMENT_AUTH_V6_VIEW_ABI = Object.freeze([
  'function owner() view returns (address)',
  'function nonces(address) view returns (uint256)'
]);

// Interfaces de eventos usados para descubrir titulares y actividad histórica
const DISCOVERY_EVENT_INTERFACES = Object.freeze({
  BlueTokenV6: new Interface([
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event ParkingCreated(address indexed user, uint256 indexed index, uint256 amount, uint256 releaseAt)'
  ]),
  RedTokenV6: new Interface([
    'event Transfer(address indexed from, address indexed to, uint256 value)'
  ]),
  CommitmentLedger: new Interface([
    'event CommitmentCreated(address indexed account, uint256 indexed lotId, uint256 amount, uint256 dueAt, uint256 fee, uint256 margin)',
    'event CommitmentExtended(address indexed account, uint256 indexed lotId, uint256 newDueAt, uint256 addedFee, uint256 addedMargin)',
    'event CommitmentAmortized(address indexed account, uint256 amount, uint256 releasedMargin, bool maturedOnly)'
  ]),
  RiskRegistry: new Interface([
    'event ProfileUpdated(address indexed account, bool kycVerified, uint128 creditLimit, uint8 level)'
  ]),
  CollateralVaultV6: new Interface([
    'event Deposited(address indexed user, uint256 amount)',
    'event Withdrawn(address indexed user, uint256 amount)',
    'event CollateralOrderCreated(address indexed user, uint64 indexed orderId, uint128 amount)',
    'event CollateralConsumed(address indexed user, uint64 indexed orderId, uint128 grossUsdt, uint128 blueBurned)',
    'event CollateralReturned(address indexed user, uint64 indexed orderId, uint128 amount)',
    'event AutomaticExchangeCollateralChanged(address indexed user, bool enabled)',
    'event ExistingOrderCollateralized(address indexed user, uint64 indexed orderId, uint128 amount, bool automatic)',
    'event ExistingOrderCollateralReleased(address indexed user, uint64 indexed orderId, uint128 amount)'
  ]),
  FifoOrderBook: new Interface([
    'event OrderCreated(uint64 indexed id, uint64 indexed sequence, address indexed user, uint8 side, uint128 amount)'
  ]),
  ExchangeCustody: new Interface([
    'event Deposited(uint8 indexed asset, address indexed user, uint128 amount)',
    'event MatchSettled(address indexed blueSeller, address indexed usdtBuyer, uint128 gross)',
    'event Refunded(uint8 indexed asset, address indexed user, uint128 amount, bool held)',
    'event PendingReleased(uint8 indexed asset, address indexed user, address indexed recipient, uint128 amount)'
  ]),
  ExchangeRouter: new Interface([
    'event OrderOpened(uint64 indexed orderId, address indexed user, uint8 side, uint128 amount)',
    'event OrderCancelled(uint64 indexed orderId, address indexed user, uint128 personalRefund, uint128 collateralRefund)',
    'event OrderSkipped(uint64 indexed orderId, address indexed user)'
  ]),
  ProtocolTreasuryV6: new Interface([
    'event BoosterRewardClaimed(address indexed user, uint256 amount)',
    'event RewardEpochStarted(uint256 indexed epoch, bytes32 root)',
    'event SurplusWithdrawalProposed(address indexed recipient, uint256 amount, uint256 eta)',
    'event SurplusWithdrawalCancelled(address indexed recipient, uint256 amount)',
    'event SurplusWithdrawalExecuted(address indexed recipient, uint256 amount)'
  ]),
  PaymentAuthorization: new Interface([
    'event AuthorizationConsumed(address indexed payer, uint256 indexed nonce, bytes32 digest)'
  ]),
  ExtensionManager: new Interface([
    'event OptionProposed(uint48 indexed duration, uint16 feeBps, uint8 minLevel, bool enabled, uint48 unlockAt)',
    'event OptionActivated(uint48 indexed duration, uint16 feeBps, uint8 minLevel, bool enabled)'
  ]),
  USDT: new Interface([
    'event Transfer(address indexed from, address indexed to, uint256 value)'
  ])
});

// ----------------------------------------------------------------------------
// UTILIDADES PURAS DE PRECISIÓN, SANITIZACIÓN Y VALIDACIÓN FAIL-CLOSED
// ----------------------------------------------------------------------------

/**
 * Formatea un valor entero BigInt (6 decimales) como objeto de strings exactos.
 * Nunca utiliza Number de punto flotante para montos monetarios o de tokens.
 */
function toExactAmount(value, decimals = 6) {
  const bi = BigInt(value);
  return {
    baseUnits: bi.toString(),
    formatted: formatUnits(bi, decimals)
  };
}

/**
 * Normaliza una dirección Ethereum a formato checksum si es válida y distinta de 0x0.
 */
function normalizeNonZeroAddress(candidate) {
  if (typeof candidate !== 'string' || !isAddress(candidate)) return null;
  const checksummed = getAddress(candidate);
  return checksummed === ZERO_ADDRESS ? null : checksummed;
}

/**
 * Sanitiza una URL RPC eliminando userinfo, query strings y redactando TODO
 * segmento de path que no pertenezca a la allowlist de segmentos públicos
 * (sin depender de longitud del token/API key).
 */
function sanitizeRpcUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  const safeSegments = parsed.pathname
    .split('/')
    .map((segment) => {
      if (!segment) return '';
      if (ALLOWED_PUBLIC_RPC_PATH_SEGMENTS.test(segment)) {
        return segment;
      }
      return '[REDACTED_KEY]';
    });
  const cleanPath = safeSegments.join('/');
  const portPart = parsed.port ? `:${parsed.port}` : '';
  return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${portPart}${cleanPath}`;
}

/**
 * Sanitiza un mensaje de error o texto libre para evitar filtrar credenciales,
 * URLs con API keys, tokens Bearer, correos, teléfonos o blobs hex largos.
 */
function sanitizeText(input) {
  let text = String(input ?? '');
  // Redactar URLs de PostgreSQL completas
  text = text.replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, 'postgresql://[REDACTED]');
  // Aplicar sanitizeRpcUrl a toda URL http/https para redactar API keys en path, userinfo y query
  text = text.replace(/https?:\/\/[^\s'"<>]+/gi, (match) => {
    try {
      return sanitizeRpcUrl(match);
    } catch {
      return 'https://[REDACTED_URL]';
    }
  });
  // Redactar encabezados / tokens Bearer
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]');
  // Redactar correos electrónicos
  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]');
  // Redactar números telefónicos internacionales
  text = text.replace(/\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,5}/g, '[REDACTED_PHONE]');
  // Redactar blobs hexadecimales largos (calldata/tx firmadas crudas >= 65 bytes)
  text = text.replace(/0x[0-9a-fA-F]{130,}/g, '0x[REDACTED_HEX_BLOB]');
  return text;
}

/**
 * Valida la URL RPC contra la allowlist explícita de Optimism Sepolia Demo
 * ANTES de abrir cualquier conexión de red.
 * - Valida ÚNICAMENTE `parsed.hostname` (nunca `pathname`).
 * - Rechaza credenciales embebidas (`username`/`password`).
 */
function validateRpcUrlAllowlist(rpcUrl, options = {}) {
  const {
    allowLocalRpc = false,
    allowedRpcHosts = null
  } = options;

  if (typeof rpcUrl !== 'string' || rpcUrl.trim().length === 0) {
    throw new Error('RPC_ALLOWLIST_REJECTED: URL RPC requerida y no puede estar vacía.');
  }

  let parsed;
  try {
    parsed = new URL(rpcUrl.trim());
  } catch {
    throw new Error('RPC_ALLOWLIST_REJECTED: URL RPC con formato inválido.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('RPC_ALLOWLIST_REJECTED: No se permiten credenciales embebidas en la URL RPC.');
  }

  const protocol = parsed.protocol.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();

  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new Error('RPC_ALLOWLIST_REJECTED: Solo se permiten protocolos http/https.');
  }

  // Bloqueo explícito de indicadores de mainnet o producción
  for (const forbidden of FORBIDDEN_PROD_PATTERNS) {
    if (forbidden.test(hostname) || forbidden.test(parsed.pathname)) {
      throw new Error('RPC_ALLOWLIST_REJECTED: Destino RPC prohibido (indicador de mainnet/producción detectado).');
    }
  }

  const isLocal = LOCAL_HOSTS.has(hostname);
  if (isLocal) {
    if (!allowLocalRpc) {
      throw new Error('RPC_ALLOWLIST_REJECTED: Host RPC local rechazado salvo habilitación explícita allowLocalRpc.');
    }
    return {
      valid: true,
      isLocal: true,
      host: hostname,
      protocol,
      sanitizedUrl: sanitizeRpcUrl(rpcUrl.trim())
    };
  }

  if (protocol !== 'https:') {
    throw new Error('RPC_ALLOWLIST_REJECTED: Los endpoints RPC remotos deben usar HTTPS.');
  }

  // Si el llamador inyecta hosts permitidos explícitos, exigir coincidencia exacta con hostname
  if (Array.isArray(allowedRpcHosts) && allowedRpcHosts.length > 0) {
    const normalizedAllowed = new Set(allowedRpcHosts.map((h) => String(h).toLowerCase()));
    if (!normalizedAllowed.has(hostname)) {
      throw new Error(`RPC_ALLOWLIST_REJECTED: Host RPC "${hostname}" fuera de la allowlist explícita.`);
    }
  } else {
    const matchesDemoHostname = DEFAULT_ALLOWED_RPC_HOSTNAME_PATTERNS.some(
      (pattern) => pattern.test(hostname)
    );
    if (!matchesDemoHostname) {
      throw new Error(`RPC_ALLOWLIST_REJECTED: Host RPC "${hostname}" no corresponde a un proveedor Optimism Sepolia Demo permitido.`);
    }
  }

  return {
    valid: true,
    isLocal: false,
    host: hostname,
    protocol,
    sanitizedUrl: sanitizeRpcUrl(rpcUrl.trim())
  };
}

/**
 * Valida la URL de base de datos PostgreSQL contra la allowlist explícita Demo
 * ANTES de abrir cualquier conexión SQL. Nunca devuelve credenciales ni URL completa.
 * - Rechaza cualquier query param `libpq` fuera de `sslmode` permitido.
 * - Para hosts remotos sin allowlist explícita, exige marcador `demo` en AMBOS: hostname Y databaseName.
 */
function validateDatabaseUrlAllowlist(databaseUrl, options = {}) {
  const {
    allowLocalSql = false,
    allowedDbHosts = null,
    allowedDbNames = null
  } = options;

  if (typeof databaseUrl !== 'string' || databaseUrl.trim().length === 0) {
    throw new Error('SQL_ALLOWLIST_REJECTED: URL de base de datos Demo requerida.');
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl.trim());
  } catch {
    throw new Error('SQL_ALLOWLIST_REJECTED: URL de base de datos con formato inválido.');
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
    throw new Error('SQL_ALLOWLIST_REJECTED: Solo se permiten conexiones PostgreSQL.');
  }

  // Validar estrictamente query params libpq (prohibir host, hostaddr, port, dbname, options, etc.)
  for (const [paramKey, paramValue] of parsed.searchParams.entries()) {
    const normalizedKey = paramKey.toLowerCase();
    if (normalizedKey !== 'sslmode') {
      throw new Error(`SQL_ALLOWLIST_REJECTED: Parámetro de conexión SQL no permitido ("${paramKey}").`);
    }
    if (!ALLOWED_PG_SSLMODES.has(String(paramValue).toLowerCase())) {
      throw new Error(`SQL_ALLOWLIST_REJECTED: Valor sslmode no permitido ("${paramValue}").`);
    }
  }

  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port || '5432';
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));

  if (!hostname || !databaseName) {
    throw new Error('SQL_ALLOWLIST_REJECTED: Host o nombre de base de datos ausente.');
  }

  // Rechazo absoluto de indicadores de producción en host o nombre de BD
  for (const forbidden of FORBIDDEN_PROD_PATTERNS) {
    if (forbidden.test(hostname) || forbidden.test(databaseName)) {
      throw new Error('SQL_ALLOWLIST_REJECTED: Destino SQL prohibido (indicador de producción detectado).');
    }
  }

  const isLocal = LOCAL_HOSTS.has(hostname);
  if (isLocal && !allowLocalSql) {
    throw new Error('SQL_ALLOWLIST_REJECTED: Base de datos local rechazada salvo habilitación explícita allowLocalSql.');
  }

  const hasExplicitHosts = Array.isArray(allowedDbHosts) && allowedDbHosts.length > 0;
  const hasExplicitNames = Array.isArray(allowedDbNames) && allowedDbNames.length > 0;

  if (hasExplicitHosts) {
    const allowedSet = new Set(allowedDbHosts.map((h) => String(h).toLowerCase()));
    if (!allowedSet.has(hostname)) {
      throw new Error(`SQL_ALLOWLIST_REJECTED: Host SQL "${hostname}" fuera de la allowlist explícita.`);
    }
  }

  if (hasExplicitNames) {
    const allowedNameSet = new Set(allowedDbNames.map((n) => String(n).toLowerCase()));
    if (!allowedNameSet.has(databaseName.toLowerCase())) {
      throw new Error(`SQL_ALLOWLIST_REJECTED: Base de datos "${databaseName}" fuera de la allowlist explícita.`);
    }
  }

  if (!isLocal) {
    // Si no hay allowlist explícita de host+db, exigir marcador `demo` en AMBOS (host Y db)
    if (!hasExplicitHosts && !/demo/i.test(hostname)) {
      throw new Error(`SQL_ALLOWLIST_REJECTED: Host SQL remoto "${hostname}" debe contener marcador explícito de entorno Demo.`);
    }
    if (!hasExplicitNames && !/demo/i.test(databaseName)) {
      throw new Error(`SQL_ALLOWLIST_REJECTED: Base de datos remota "${databaseName}" debe contener marcador explícito de entorno Demo.`);
    }
  } else if (!hasExplicitNames && !/(demo|test|local)/i.test(databaseName)) {
    throw new Error(`SQL_ALLOWLIST_REJECTED: Nombre de base de datos local "${databaseName}" no corresponde a Demo/local permitido.`);
  }

  return {
    valid: true,
    isLocal,
    host: hostname,
    port,
    databaseName,
    sanitizedTarget: `${hostname}:${port}/${databaseName}`
  };
}

/**
 * Detecta errores de historial RPC podado / EIP-4444 o rangos históricos no disponibles.
 */
function isPrunedHistoryError(error) {
  const detail = String(
    error?.error?.message ||
    error?.info?.error?.message ||
    error?.shortMessage ||
    error?.message ||
    ''
  );
  const code = error?.error?.code ?? error?.info?.error?.code ?? error?.code;
  return (
    code === 4444 ||
    code === '4444' ||
    /4444|insufficient changesets|missing trie node|historical state|pruned.*history|history.*pruned|state.*pruned|ancient.*pruned/i.test(detail)
  );
}

/**
 * Detecta errores transitorios de límite de tasa (rate-limit) del proveedor RPC
 * (ej. HTTP 429 o Optimism Sepolia público `-32016`).
 */
function isRateLimitError(error) {
  const detail = String(
    error?.error?.message ||
    error?.info?.error?.message ||
    error?.shortMessage ||
    error?.message ||
    ''
  );
  const code = error?.error?.code ?? error?.info?.error?.code ?? error?.code;
  const statusCode = error?.info?.responseStatus ?? error?.statusCode;
  return (
    code === -32016 ||
    code === '-32016' ||
    code === 429 ||
    code === '429' ||
    statusCode === 429 ||
    /exceeded its requests per second|rate limit|too many requests|-32016|\b429\b/i.test(detail)
  );
}

/**
 * Reintenta una operación RPC con backoff exponencial ÚNICAMENTE ante errores
 * transitorios de rate-limit. Si el error no es rate-limit o se agotan los
 * intentos, relanza el error original intacto (fail-closed, sin silenciar).
 */
async function withRateLimitRetry(fn, {
  maxAttempts = 4,
  baseDelayMs = 400,
  sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
} = {}) {
  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      return await fn();
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= maxAttempts) {
        throw error;
      }
      const delayMs = baseDelayMs * (2 ** (attempt - 1));
      await sleepFn(delayMs);
    }
  }
}

/**
 * Detecta errores de límite de rango de bloques en `eth_getLogs` para subdivisión binaria.
 */
function isBlockRangeLimitError(error) {
  const detail = String(
    error?.error?.message ||
    error?.info?.error?.message ||
    error?.shortMessage ||
    error?.message ||
    ''
  );
  return /block range|range.{0,30}(limit|wide|exceeded)|limit.{0,35}blocks|too many results|more than \d+ results/i.test(detail);
}

/**
 * Carga y verifica el manifiesto canónico V6 Demo contra su huella SHA-256 fijada.
 */
function loadAndVerifyV6Manifest(options = {}) {
  const {
    manifestPath = DEFAULT_MANIFEST_PATH,
    manifestOverride = null,
    expectedManifestSha256 = v6ReleasePin.manifestSha256
  } = options;

  let rawText;
  let manifest;

  if (manifestOverride) {
    if (typeof manifestOverride === 'string') {
      rawText = manifestOverride;
      manifest = JSON.parse(rawText);
    } else {
      rawText = JSON.stringify(manifestOverride);
      manifest = manifestOverride;
    }
  } else {
    rawText = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(rawText);
  }

  const manifestSha256 = createHash('sha256').update(rawText).digest('hex');

  if (!manifestOverride && manifestSha256 !== expectedManifestSha256) {
    throw new Error(
      `MANIFEST_FINGERPRINT_MISMATCH: El SHA-256 del manifiesto (${manifestSha256}) no coincide con el pin autorizado (${expectedManifestSha256}).`
    );
  }

  if (manifestOverride && expectedManifestSha256 && manifestSha256 !== expectedManifestSha256) {
    throw new Error(
      `MANIFEST_FINGERPRINT_MISMATCH: El SHA-256 del manifiesto inyectado (${manifestSha256}) no coincide con el esperado (${expectedManifestSha256}).`
    );
  }

  if (manifest.epoch !== DEMO_EPOCH || String(manifest.chainId) !== DEMO_CHAIN_ID_STR) {
    throw new Error(
      `MANIFEST_INVALID_IDENTITY: Se esperaba epoch=${DEMO_EPOCH} y chainId=${DEMO_CHAIN_ID_STR}.`
    );
  }

  if (!manifest.contracts || !manifest.codeHashes || !manifest.owners || !manifest.roles) {
    throw new Error('MANIFEST_INCOMPLETE: Faltan secciones obligatorias (contracts, codeHashes, owners, roles).');
  }

  const normalizedContracts = {};
  for (const name of REQUIRED_V6_CONTRACTS) {
    const addr = manifest.contracts[name];
    const hash = manifest.codeHashes[name];
    if (!addr || !isAddress(addr) || getAddress(addr) === ZERO_ADDRESS) {
      throw new Error(`MANIFEST_INVALID_CONTRACT: Dirección inválida o ausente para ${name}.`);
    }
    if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      throw new Error(`MANIFEST_INVALID_CODEHASH: Codehash inválido o ausente para ${name}.`);
    }
    normalizedContracts[name] = getAddress(addr);
  }

  return {
    manifest: {
      ...manifest,
      contracts: normalizedContracts
    },
    manifestSha256,
    fingerprint: `0x${manifestSha256}`
  };
}

/**
 * Crea un ContractRunner anclado a un único bloque `finalized` (número y hash).
 * Compatible tanto con JsonRpcProvider real como con mocks unitarios de ethers.
 * NUNCA degrada a `blockNumber` si el error indica reorg, bloque no canónico o no encontrado.
 */
function createPinnedRunner(provider, finalizedBlock, retryOptions = {}) {
  return {
    provider,
    call: async (tx) => {
      if (typeof provider.send === 'function') {
        try {
          return await withRateLimitRetry(
            () => provider.send('eth_call', [
              { to: tx.to, data: tx.data },
              { blockHash: finalizedBlock.hash, requireCanonical: true }
            ]),
            retryOptions
          );
        } catch (err) {
          const msg = String(err?.error?.message || err?.info?.error?.message || err?.message || '');
          // Prohibido degradar si el nodo señala reorg, bloque no canónico o bloque ausente
          if (/not canonical|reorg|block not found|header not found|unknown block/i.test(msg)) {
            throw err;
          }
          // Solo degradar a blockNumber si el proveedor no soporta el formato EIP-1898 por blockHash
          if (!/blockHash|requireCanonical|invalid argument|unmarshal|unsupported/i.test(msg)) {
            throw err;
          }
        }
      }
      return withRateLimitRetry(
        () => provider.call({
          to: tx.to,
          data: tx.data,
          blockTag: finalizedBlock.number
        }),
        retryOptions
      );
    }
  };
}

/**
 * Obtiene logs en una ventana única con subdivisión binaria si el nodo limita el rango.
 * Falla cerrado con `INVALID_LOGS_RESPONSE` si la respuesta es `null` o no es un Array.
 */
async function fetchLogsWindow(provider, filter, stats, {
  rpcRequestDelayMs = 0,
  retryOptions = {},
  sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
} = {}) {
  if (rpcRequestDelayMs > 0 && stats.rpcLogRequests > 0) {
    await sleepFn(rpcRequestDelayMs);
  }
  stats.rpcLogRequests += 1;
  try {
    const logs = await withRateLimitRetry(() => provider.getLogs(filter), retryOptions);
    if (!Array.isArray(logs)) {
      const invalidErr = new Error('INVALID_LOGS_RESPONSE: eth_getLogs devolvió una respuesta nula o no-array.');
      invalidErr.code = 'INVALID_LOGS_RESPONSE';
      throw invalidErr;
    }
    return logs;
  } catch (error) {
    if (error.code === 'INVALID_LOGS_RESPONSE') {
      throw error;
    }
    if (isPrunedHistoryError(error)) {
      const prunedErr = new Error(`RPC_PRUNED_HISTORY_4444: ${sanitizeText(error.message)}`);
      prunedErr.code = 4444;
      prunedErr.isPruned = true;
      throw prunedErr;
    }
    if (filter.fromBlock < filter.toBlock && isBlockRangeLimitError(error)) {
      const mid = Math.floor((filter.fromBlock + filter.toBlock) / 2);
      stats.subdivisions += 1;
      const left = await fetchLogsWindow(provider, { ...filter, toBlock: mid }, stats, { rpcRequestDelayMs, retryOptions, sleepFn });
      const right = await fetchLogsWindow(provider, { ...filter, fromBlock: mid + 1 }, stats, { rpcRequestDelayMs, retryOptions, sleepFn });
      return left.concat(right);
    }
    throw error;
  }
}

/**
 * Pagine `eth_getLogs` en ventanas acotadas desde `fromBlock` hasta `toBlock`.
 */
async function fetchLogsPaginated(provider, { address, topics, fromBlock, toBlock }, maxSpan, stats, windowOptions = {}) {
  if (toBlock < fromBlock) return [];
  const allLogs = [];
  for (let start = fromBlock; start <= toBlock; start += maxSpan) {
    const end = Math.min(toBlock, start + maxSpan - 1);
    const chunk = await fetchLogsWindow(provider, { address, topics, fromBlock: start, toBlock: end }, stats, windowOptions);
    for (const log of chunk) {
      if (log?.removed) {
        const reorgErr = new Error('REORG_LOG_REMOVED: Se observó un log marcado como removed durante el escaneo.');
        reorgErr.isReorg = true;
        throw reorgErr;
      }
      allLogs.push(log);
    }
  }
  return allLogs;
}

/**
 * Determina los `startBlocks` reales por contrato a partir del manifiesto, pin de release
 * y recibos de despliegue (sin asumir nunca que el primer evento observado es el inicio).
 */
async function resolveContractStartBlocks(provider, manifest, finalizedBlockNumber, onchainErrors, retryOptions = {}) {
  const startBlocks = {};
  const pinStartBlocks = v6ReleasePin.startBlocks || {};
  const manifestStartBlocks = manifest.startBlocks || {};
  const deployTxs = manifest.deployTransactions || {};
  const fallbackAnchor = Number.isSafeInteger(manifest.anchorBlock) && manifest.anchorBlock >= 0
    ? manifest.anchorBlock
    : 0;

  for (const name of Object.keys(DISCOVERY_EVENT_INTERFACES)) {
    const explicit = manifestStartBlocks[name] ?? pinStartBlocks[name];
    if (Number.isSafeInteger(explicit) && explicit >= 0) {
      startBlocks[name] = Math.min(explicit, finalizedBlockNumber);
      continue;
    }

    const txHash = deployTxs[name];
    if (txHash && /^0x[0-9a-fA-F]{64}$/.test(txHash) && typeof provider.getTransactionReceipt === 'function') {
      try {
        const receipt = await withRateLimitRetry(() => provider.getTransactionReceipt(txHash), retryOptions);
        if (receipt && Number.isSafeInteger(receipt.blockNumber) && receipt.blockNumber >= 0) {
          startBlocks[name] = Math.min(receipt.blockNumber, finalizedBlockNumber);
          continue;
        }
        // Recibo nulo o sin blockNumber válido: no degradar silenciosamente a anchorBlock
        onchainErrors.push({
          stage: 'resolveStartBlocks',
          contract: name,
          code: 'START_BLOCK_RECEIPT_MISSING',
          message: `No se obtuvo recibo de despliegue válido para ${name} (txHash=${txHash}).`
        });
      } catch (err) {
        if (isPrunedHistoryError(err)) {
          onchainErrors.push({
            stage: 'resolveStartBlocks',
            contract: name,
            code: 'RPC_PRUNED_HISTORY_4444',
            message: sanitizeText(err.message)
          });
          // Registrar anchorBlock solo como referencia, pero el error ya invalida onchainComplete
          startBlocks[name] = Math.min(fallbackAnchor, finalizedBlockNumber);
          continue;
        }
        onchainErrors.push({
          stage: 'resolveStartBlocks',
          contract: name,
          code: 'START_BLOCK_RECEIPT_ERROR',
          message: sanitizeText(err.message)
        });
      }
    }

    startBlocks[name] = Math.min(fallbackAnchor, finalizedBlockNumber);
  }

  return startBlocks;
}

/**
 * Sanitiza un paso de `chain_operations` conservando solo metadatos de auditoría
 * y eliminando cualquier transacción firmada cruda (`raw`, `rawSignedTx`) o `calldata`.
 */
function sanitizeChainOperationRow(row) {
  const rawSteps = Array.isArray(row.steps) ? row.steps : [];
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};

  const sanitizedSteps = rawSteps.map((step) => ({
    label: step?.label ? String(step.label) : null,
    nonce: step?.nonce !== undefined && step?.nonce !== null ? String(step.nonce) : null,
    to: normalizeNonZeroAddress(step?.to || payload?.to) || null,
    tx_hash: typeof (step?.hash || step?.tx_hash || step?.txHash) === 'string'
      ? String(step.hash || step.tx_hash || step.txHash)
      : null,
    confirmed: Boolean(step?.confirmed)
  }));

  return {
    id: String(row.id),
    user_id: row.user_id !== null && row.user_id !== undefined ? Number(row.user_id) : null,
    chain_id: String(row.chain_id),
    sender: row.sender ? String(row.sender).toLowerCase() : null,
    resource_key: row.resource_key ? String(row.resource_key) : null,
    kind: String(row.kind),
    state: String(row.state),
    error_code: row.error_code ? String(row.error_code) : null,
    target: normalizeNonZeroAddress(payload?.to) || sanitizedSteps[0]?.to || null,
    nonce: sanitizedSteps[0]?.nonce ?? (payload?.nonce !== undefined ? String(payload.nonce) : null),
    tx_hash: sanitizedSteps.at(-1)?.tx_hash || null,
    steps: sanitizedSteps,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

/**
 * Defensa en profundidad: recorre el informe JSON completo y elimina/redacta
 * cualquier campo o patrón prohibido (credenciales, PII, rawSignedTx, calldata).
 */
const FORBIDDEN_OUTPUT_KEYS = new Set([
  'database_url',
  'databaseurl',
  'raw',
  'rawsignedtx',
  'raw_signed_tx',
  'signedtx',
  'signed_tx',
  'data',
  'txdata',
  'calldata',
  'signature',
  'privatekey',
  'private_key',
  'mnemonic',
  'password',
  'password_hash',
  'secret',
  'api_key',
  'apikey',
  'token',
  'email',
  'phone',
  'phone_number',
  'full_name',
  'fullname',
  'document_number',
  'dni',
  'passkey',
  'acceptor_username',
  'form_responses',
  'evidence_urls'
]);

function deepSanitizeReport(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return sanitizeText(value);
  if (Array.isArray(value)) return value.map((item) => deepSanitizeReport(item));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_OUTPUT_KEYS.has(k.toLowerCase())) {
        continue;
      }
      out[k] = deepSanitizeReport(v);
    }
    return out;
  }
  return value;
}

// ----------------------------------------------------------------------------
// LECTURA SQL ESTRICTAMENTE READ ONLY (REPEATABLE READ)
// ----------------------------------------------------------------------------

/**
 * Ejecuta la extracción SQL Demo dentro de una transacción `REPEATABLE READ READ ONLY`
 * con `statement_timeout` acotado y paginación determinista.
 */
async function collectSqlDemoInventory({
  databaseUrl,
  dbValidation,
  sqlClientFactory,
  statementTimeoutMs = DEFAULT_SQL_STATEMENT_TIMEOUT_MS,
  pageSize = DEFAULT_SQL_PAGE_SIZE,
  allowLocalSql = false,
  allowedDbNames = null
}) {
  const sqlResult = {
    skipped: false,
    target: dbValidation.sanitizedTarget,
    databaseNameObserved: null,
    isolationLevel: 'REPEATABLE READ',
    readOnlyEnforced: true,
    statementTimeoutMs,
    schema: {
      requiredTablesPresent: [],
      missingRequiredTables: [],
      optionalTablesPresent: [],
      missingOptionalTables: [],
      optionalColumnsPresent: [],
      missingOptionalColumns: [],
      optionalMigrations: {
        '128_credit_penalty_episode': {
          present: false,
          columns: {
            'users.mora_episode_base_limit': false,
            'users.mora_episode_started_at': false
          }
        },
        '129_credit_notification_outbox': {
          present: false,
          tablePresent: false
        },
        '130_credit_referral_episode_awards': {
          present: false,
          tablePresent: false,
          columns: {
            'users.mora_episode_earned_base': false,
            'users.mora_episode_referral_base': false,
            'users.mora_episode_target_base': false,
            'users.mora_episode_bonus_applied': false
          }
        },
        '131_publication_base_precision': {
          present: false,
          columns: {
            'publications.base_blue_cost': {
              present: false,
              dataType: null,
              numericPrecision: null,
              numericScale: null,
              isNumeric30_6: false
            },
            'publications.goal_amount': {
              present: false,
              dataType: null,
              numericPrecision: null,
              numericScale: null,
              isNumeric30_6: false
            }
          }
        }
      }
    },
    users: [],
    smartAccounts: [],
    policy: {
      appSettings: {},
      recentPolicyVersions: [],
      creditPolicyIssuesCountsByStatus: {},
      openCreditPolicyIssues: []
    },
    moraEpisodes: [],
    creditNotificationOutbox: {
      tablePresent: false,
      countsByStatus: {},
      pendingItems: []
    },
    creditReferralAwards: {
      tablePresent: false,
      countsByBaseline: { baseline: '0', active: '0' },
      activeAwards: []
    },
    escrowHoldsActive: [],
    publicationsActive: [],
    publicationAcceptancesCountsByStatus: {},
    publicationAcceptancesPending: [],
    exchangeV6Sync: [],
    exchangeV6ProjectionsCount: {
      orders: null,
      refunds: null
    },
    chainOperations: {
      countsByState: {},
      activeOperations: []
    },
    discoveredWallets: [],
    complete: false
  };

  const sqlErrors = [];
  let client = null;
  let inTransaction = false;

  try {
    client = await sqlClientFactory(databaseUrl);
    if (!client || typeof client.query !== 'function') {
      throw new Error('SQL_CLIENT_INVALID: El cliente SQL inyectado no implementa query().');
    }

    // 1. Iniciar snapshot transaccional estrictamente READ ONLY
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    inTransaction = true;

    const safeTimeout = Math.trunc(
      Math.max(1000, Math.min(Number(statementTimeoutMs) || DEFAULT_SQL_STATEMENT_TIMEOUT_MS, 120_000))
    );
    await client.query(`SET LOCAL statement_timeout = '${safeTimeout}ms'`);

    // 2. Verificar identidad real del servidor (current_database()) contra allowlist Demo
    const dbRes = await client.query('SELECT current_database() AS db');
    const observedDb = String(dbRes?.rows?.[0]?.db || '');
    sqlResult.databaseNameObserved = observedDb || null;

    if (!observedDb) {
      throw new Error('SQL_IDENTITY_FAILED: current_database() devolvió vacío.');
    }
    for (const forbidden of FORBIDDEN_PROD_PATTERNS) {
      if (forbidden.test(observedDb)) {
        throw new Error(`SQL_IDENTITY_REJECTED: current_database() "${observedDb}" parece de producción.`);
      }
    }
    if (Array.isArray(allowedDbNames) && allowedDbNames.length > 0) {
      const allowedSet = new Set(allowedDbNames.map((n) => String(n).toLowerCase()));
      if (!allowedSet.has(observedDb.toLowerCase())) {
        throw new Error(`SQL_IDENTITY_REJECTED: current_database() "${observedDb}" no está en allowlist.`);
      }
    } else if (observedDb.toLowerCase() !== dbValidation.databaseName.toLowerCase()) {
      throw new Error(
        `SQL_IDENTITY_MISMATCH: current_database() ("${observedDb}") difiere del destino esperado ("${dbValidation.databaseName}").`
      );
    } else if (!allowLocalSql && !/demo/i.test(observedDb)) {
      throw new Error(`SQL_IDENTITY_REJECTED: current_database() "${observedDb}" no está marcada como Demo.`);
    }

    // 3. Inspeccionar information_schema.tables e information_schema.columns
    const tablesRes = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    const existingTables = new Set((tablesRes?.rows || []).map((r) => String(r.table_name)));

    for (const tbl of REQUIRED_SQL_TABLES) {
      if (existingTables.has(tbl)) sqlResult.schema.requiredTablesPresent.push(tbl);
      else sqlResult.schema.missingRequiredTables.push(tbl);
    }
    for (const tbl of OPTIONAL_SQL_TABLES) {
      if (existingTables.has(tbl)) sqlResult.schema.optionalTablesPresent.push(tbl);
      else sqlResult.schema.missingOptionalTables.push(tbl);
    }

    const colsRes = await client.query(
      `SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
       FROM information_schema.columns
       WHERE table_schema = 'public'`
    );
    const existingColumnsByTable = new Map();
    const columnMetaByTable = new Map();
    for (const row of colsRes?.rows || []) {
      const t = String(row.table_name);
      const colName = String(row.column_name);
      if (!existingColumnsByTable.has(t)) existingColumnsByTable.set(t, new Set());
      existingColumnsByTable.get(t).add(colName);
      if (!columnMetaByTable.has(t)) columnMetaByTable.set(t, new Map());
      columnMetaByTable.get(t).set(colName, {
        dataType: row.data_type !== undefined && row.data_type !== null ? String(row.data_type) : null,
        numericPrecision: row.numeric_precision !== undefined && row.numeric_precision !== null
          ? Number(row.numeric_precision)
          : null,
        numericScale: row.numeric_scale !== undefined && row.numeric_scale !== null
          ? Number(row.numeric_scale)
          : null
      });
    }

    const hasColumn = (table, col) => existingColumnsByTable.get(table)?.has(col) === true;
    const getColumnMeta = (table, col) => columnMetaByTable.get(table)?.get(col) || null;

    for (const opt of OPTIONAL_SQL_COLUMNS) {
      if (hasColumn(opt.table, opt.column)) {
        sqlResult.schema.optionalColumnsPresent.push(opt);
      } else {
        sqlResult.schema.missingOptionalColumns.push(opt);
      }
    }

    // Diagnóstico explícito de migraciones opcionales 128..131 (esquema literal)
    const has128BaseLimit = hasColumn('users', 'mora_episode_base_limit');
    const has128StartedAt = hasColumn('users', 'mora_episode_started_at');
    const has129Outbox = existingTables.has('credit_notification_outbox');
    const has130Awards = existingTables.has('credit_referral_awards');
    const has130Earned = hasColumn('users', 'mora_episode_earned_base');
    const has130Referral = hasColumn('users', 'mora_episode_referral_base');
    const has130Target = hasColumn('users', 'mora_episode_target_base');
    const has130Bonus = hasColumn('users', 'mora_episode_bonus_applied');

    const baseBlueCostMeta = getColumnMeta('publications', 'base_blue_cost');
    const goalAmountMeta = getColumnMeta('publications', 'goal_amount');
    const isBaseBlueCost30_6 = Boolean(
      baseBlueCostMeta && baseBlueCostMeta.numericPrecision === 30 && baseBlueCostMeta.numericScale === 6
    );
    const isGoalAmount30_6 = Boolean(
      goalAmountMeta && goalAmountMeta.numericPrecision === 30 && goalAmountMeta.numericScale === 6
    );

    sqlResult.schema.optionalMigrations = {
      '128_credit_penalty_episode': {
        present: has128BaseLimit && has128StartedAt,
        columns: {
          'users.mora_episode_base_limit': has128BaseLimit,
          'users.mora_episode_started_at': has128StartedAt
        }
      },
      '129_credit_notification_outbox': {
        present: has129Outbox,
        tablePresent: has129Outbox
      },
      '130_credit_referral_episode_awards': {
        present: has130Awards && has130Earned && has130Referral && has130Target && has130Bonus,
        tablePresent: has130Awards,
        columns: {
          'users.mora_episode_earned_base': has130Earned,
          'users.mora_episode_referral_base': has130Referral,
          'users.mora_episode_target_base': has130Target,
          'users.mora_episode_bonus_applied': has130Bonus
        }
      },
      '131_publication_base_precision': {
        present: isBaseBlueCost30_6 && isGoalAmount30_6,
        columns: {
          'publications.base_blue_cost': {
            present: hasColumn('publications', 'base_blue_cost'),
            dataType: baseBlueCostMeta?.dataType ?? null,
            numericPrecision: baseBlueCostMeta?.numericPrecision ?? null,
            numericScale: baseBlueCostMeta?.numericScale ?? null,
            isNumeric30_6: isBaseBlueCost30_6
          },
          'publications.goal_amount': {
            present: hasColumn('publications', 'goal_amount'),
            dataType: goalAmountMeta?.dataType ?? null,
            numericPrecision: goalAmountMeta?.numericPrecision ?? null,
            numericScale: goalAmountMeta?.numericScale ?? null,
            isNumeric30_6: isGoalAmount30_6
          }
        }
      }
    };

    // Si faltan tablas requeridas, registrar error explícito y no fingir listas vacías como completas
    if (sqlResult.schema.missingRequiredTables.length > 0) {
      sqlErrors.push({
        stage: 'sql_schema',
        code: 'SQL_MISSING_REQUIRED_TABLES',
        message: `Faltan tablas SQL requeridas: ${sqlResult.schema.missingRequiredTables.join(', ')}`
      });
    }

    const walletSet = new Set();

    // 4. Usuarios y billeteras (CERO PII: solo IDs, direcciones, flags KYC/política y columnas reales de 115/120/128/130)
    if (existingTables.has('users')) {
      const userCols = ['id', 'web3_wallet_address'];
      if (hasColumn('users', 'kyc_verified')) userCols.push('kyc_verified');
      if (hasColumn('users', 'red_credit_limit_override')) userCols.push('red_credit_limit_override::text AS red_credit_limit_override');
      if (hasColumn('users', 'last_mora_cured_at')) userCols.push('last_mora_cured_at');
      if (hasColumn('users', 'mora_penalty_base_limit')) userCols.push('mora_penalty_base_limit::text AS mora_penalty_base_limit');
      if (hasColumn('users', 'mora_target_limit')) userCols.push('mora_target_limit::text AS mora_target_limit');
      // Columnas reales de migración 128 (`128_credit_penalty_episode.js`)
      if (has128BaseLimit) userCols.push('mora_episode_base_limit::text AS mora_episode_base_limit');
      if (has128StartedAt) userCols.push('mora_episode_started_at');
      // Columnas reales de migración 130 (`130_credit_referral_episode_awards.js`)
      if (has130Earned) userCols.push('mora_episode_earned_base::text AS mora_episode_earned_base');
      if (has130Referral) userCols.push('mora_episode_referral_base::text AS mora_episode_referral_base');
      if (has130Target) userCols.push('mora_episode_target_base::text AS mora_episode_target_base');
      if (has130Bonus) userCols.push('mora_episode_bonus_applied::text AS mora_episode_bonus_applied');

      let lastId = 0;
      while (true) {
        const pageRes = await client.query(
          `SELECT ${userCols.join(', ')}
           FROM users
           WHERE id > $1
           ORDER BY id ASC
           LIMIT $2`,
          [lastId, pageSize]
        );
        const rows = pageRes?.rows || [];
        if (rows.length === 0) break;

        for (const r of rows) {
          const wallet = normalizeNonZeroAddress(r.web3_wallet_address);
          if (wallet) walletSet.add(wallet);
          const entry = {
            id: Number(r.id),
            walletAddress: wallet,
            kycVerified: r.kyc_verified !== undefined ? Boolean(r.kyc_verified) : null,
            redCreditLimitOverride: r.red_credit_limit_override !== undefined && r.red_credit_limit_override !== null
              ? String(r.red_credit_limit_override)
              : null
          };
          if (hasColumn('users', 'last_mora_cured_at')) {
            entry.lastMoraCuredAt = r.last_mora_cured_at ? new Date(r.last_mora_cured_at).toISOString() : null;
          }
          if (hasColumn('users', 'mora_penalty_base_limit')) {
            entry.moraPenaltyBaseLimit = r.mora_penalty_base_limit !== null && r.mora_penalty_base_limit !== undefined
              ? String(r.mora_penalty_base_limit)
              : null;
          }
          if (hasColumn('users', 'mora_target_limit')) {
            entry.moraTargetLimit = r.mora_target_limit !== null && r.mora_target_limit !== undefined
              ? String(r.mora_target_limit)
              : null;
          }
          if (has128BaseLimit) {
            entry.moraEpisodeBaseLimit = r.mora_episode_base_limit !== null && r.mora_episode_base_limit !== undefined
              ? String(r.mora_episode_base_limit)
              : null;
          }
          if (has128StartedAt) {
            entry.moraEpisodeStartedAt = r.mora_episode_started_at ? new Date(r.mora_episode_started_at).toISOString() : null;
          }
          if (has130Earned) {
            entry.moraEpisodeEarnedBase = r.mora_episode_earned_base !== null && r.mora_episode_earned_base !== undefined
              ? String(r.mora_episode_earned_base)
              : null;
          }
          if (has130Referral) {
            entry.moraEpisodeReferralBase = r.mora_episode_referral_base !== null && r.mora_episode_referral_base !== undefined
              ? String(r.mora_episode_referral_base)
              : null;
          }
          if (has130Target) {
            entry.moraEpisodeTargetBase = r.mora_episode_target_base !== null && r.mora_episode_target_base !== undefined
              ? String(r.mora_episode_target_base)
              : null;
          }
          if (has130Bonus) {
            entry.moraEpisodeBonusApplied = r.mora_episode_bonus_applied !== null && r.mora_episode_bonus_applied !== undefined
              ? String(r.mora_episode_bonus_applied)
              : null;
          }
          sqlResult.users.push(entry);

          // Episodios de mora activos en `users` (migraciones 128 y 130)
          const hasActiveMoraEpisode =
            (has128StartedAt && entry.moraEpisodeStartedAt !== null) ||
            (has128BaseLimit && entry.moraEpisodeBaseLimit !== null);
          if (hasActiveMoraEpisode) {
            sqlResult.moraEpisodes.push({
              userId: entry.id,
              walletAddress: entry.walletAddress,
              moraEpisodeBaseLimit: entry.moraEpisodeBaseLimit ?? null,
              moraEpisodeStartedAt: entry.moraEpisodeStartedAt ?? null,
              moraEpisodeEarnedBase: entry.moraEpisodeEarnedBase ?? null,
              moraEpisodeReferralBase: entry.moraEpisodeReferralBase ?? null,
              moraEpisodeTargetBase: entry.moraEpisodeTargetBase ?? null,
              moraEpisodeBonusApplied: entry.moraEpisodeBonusApplied ?? null
            });
          }

          lastId = Number(r.id);
        }

        if (rows.length < pageSize) break;
      }
    }

    // 5. Smart accounts (si existen; sin passkey ni PII)
    if (existingTables.has('smart_accounts')) {
      const saRes = await client.query(
        `SELECT identity_id, chain_id, address, state, created_at
         FROM smart_accounts
         WHERE chain_id = $1
         ORDER BY created_at ASC`,
        [DEMO_CHAIN_ID_STR]
      );
      for (const r of saRes?.rows || []) {
        const addr = normalizeNonZeroAddress(r.address);
        if (addr) walletSet.add(addr);
        sqlResult.smartAccounts.push({
          identityId: String(r.identity_id),
          chainId: String(r.chain_id),
          address: addr,
          state: String(r.state),
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : null
        });
      }
    }

    // 6. Política económica (app_settings filtrada por allowlist, sin secretos)
    if (existingTables.has('app_settings')) {
      const settingsRes = await client.query(
        `SELECT setting_key, setting_value
         FROM app_settings
         WHERE setting_key = ANY($1::text[])
         ORDER BY setting_key ASC`,
        [ALLOWED_APP_SETTING_KEYS]
      );
      for (const r of settingsRes?.rows || []) {
        sqlResult.policy.appSettings[String(r.setting_key)] = String(r.setting_value ?? '');
      }
    }

    if (existingTables.has('credit_policy_versions')) {
      const verRes = await client.query(
        `SELECT id, settings, created_at
         FROM credit_policy_versions
         ORDER BY id DESC
         LIMIT 5`
      );
      sqlResult.policy.recentPolicyVersions = (verRes?.rows || []).map((r) => ({
        id: String(r.id),
        settings: r.settings && typeof r.settings === 'object' ? r.settings : {},
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null
      }));
    }

    if (existingTables.has('credit_policy_issues')) {
      // Conteo completo por estado (open, retrying, dead_letter, resolved, etc.)
      const issueCountsRes = await client.query(
        `SELECT status, COUNT(*)::text AS total
         FROM credit_policy_issues
         GROUP BY status`
      );
      for (const r of issueCountsRes?.rows || []) {
        sqlResult.policy.creditPolicyIssuesCountsByStatus[String(r.status)] = String(r.total);
      }

      // Capturar TODAS las incidencias no resueltas (incluyendo 'dead_letter', 'open', 'retrying')
      const issueCols = ['version_id', 'user_id', 'operation_id', 'reason', 'status', 'retry_requested', 'updated_at'];
      if (hasColumn('credit_policy_issues', 'retry_count')) issueCols.push('retry_count');
      if (hasColumn('credit_policy_issues', 'next_retry_at')) issueCols.push('next_retry_at');
      if (hasColumn('credit_policy_issues', 'max_retries')) issueCols.push('max_retries');
      if (hasColumn('credit_policy_issues', 'last_error')) issueCols.push('last_error');

      const issuesRes = await client.query(
        `SELECT ${issueCols.join(', ')}
         FROM credit_policy_issues
         WHERE status NOT IN ('resolved', 'completed', 'closed')
         ORDER BY version_id ASC, user_id ASC`
      );
      sqlResult.policy.openCreditPolicyIssues = (issuesRes?.rows || []).map((r) => ({
        versionId: String(r.version_id),
        userId: Number(r.user_id),
        operationId: r.operation_id ? String(r.operation_id) : null,
        reason: sanitizeText(r.reason),
        status: String(r.status),
        retryRequested: Boolean(r.retry_requested),
        retryCount: r.retry_count !== undefined && r.retry_count !== null ? Number(r.retry_count) : null,
        maxRetries: r.max_retries !== undefined && r.max_retries !== null ? Number(r.max_retries) : null,
        nextRetryAt: r.next_retry_at ? new Date(r.next_retry_at).toISOString() : null,
        lastError: r.last_error !== undefined && r.last_error !== null ? sanitizeText(r.last_error) : null,
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null
      }));
    }

    // 7a. Outbox de notificaciones de política de compromiso RED (migración 129, si existe; CERO payload crudo)
    if (has129Outbox) {
      sqlResult.creditNotificationOutbox.tablePresent = true;
      const outboxCountsRes = await client.query(
        `SELECT status, COUNT(*)::text AS total
         FROM credit_notification_outbox
         GROUP BY status`
      );
      for (const r of outboxCountsRes?.rows || []) {
        sqlResult.creditNotificationOutbox.countsByStatus[String(r.status)] = String(r.total);
      }

      let lastOpId = '';
      while (true) {
        const outboxRes = await client.query(
          `SELECT operation_id, user_id, confirmed_limit::text AS confirmed_limit, tx_hash, block_hash,
                  status, attempts, next_attempt_at, last_error, created_at, delivered_at
           FROM credit_notification_outbox
           WHERE status = 'pending' AND operation_id::text > $1
           ORDER BY operation_id::text ASC
           LIMIT $2`,
          [lastOpId, pageSize]
        );
        const rows = outboxRes?.rows || [];
        if (rows.length === 0) break;

        for (const r of rows) {
          const opId = String(r.operation_id);
          sqlResult.creditNotificationOutbox.pendingItems.push({
            operationId: opId,
            userId: Number(r.user_id),
            confirmedLimit: r.confirmed_limit !== null && r.confirmed_limit !== undefined ? String(r.confirmed_limit) : null,
            txHash: r.tx_hash ? String(r.tx_hash) : null,
            blockHash: r.block_hash ? String(r.block_hash) : null,
            status: String(r.status),
            attempts: r.attempts !== undefined && r.attempts !== null ? Number(r.attempts) : 0,
            nextAttemptAt: r.next_attempt_at ? new Date(r.next_attempt_at).toISOString() : null,
            lastError: r.last_error !== undefined && r.last_error !== null ? sanitizeText(r.last_error) : null,
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
            deliveredAt: r.delivered_at ? new Date(r.delivered_at).toISOString() : null
          });
          lastOpId = opId;
        }

        if (rows.length < pageSize) break;
      }
    }

    // 7b. Premios de referidos por episodio de compromiso RED (migración 130, si existe; CERO PII)
    if (has130Awards) {
      sqlResult.creditReferralAwards.tablePresent = true;
      const awardCountsRes = await client.query(
        `SELECT baseline, COUNT(*)::text AS total
         FROM credit_referral_awards
         GROUP BY baseline`
      );
      for (const r of awardCountsRes?.rows || []) {
        if (r.baseline === true || r.baseline === 't' || r.baseline === 'true') {
          sqlResult.creditReferralAwards.countsByBaseline.baseline = String(r.total);
        } else {
          sqlResult.creditReferralAwards.countsByBaseline.active = String(r.total);
        }
      }

      let lastReferredId = 0;
      while (true) {
        const awardsRes = await client.query(
          `SELECT referred_user_id, referrer_user_id, amount::text AS amount, recorded_at, baseline
           FROM credit_referral_awards
           WHERE baseline = FALSE AND referred_user_id > $1
           ORDER BY referred_user_id ASC
           LIMIT $2`,
          [lastReferredId, pageSize]
        );
        const rows = awardsRes?.rows || [];
        if (rows.length === 0) break;

        for (const r of rows) {
          const refId = Number(r.referred_user_id);
          sqlResult.creditReferralAwards.activeAwards.push({
            referredUserId: refId,
            referrerUserId: Number(r.referrer_user_id),
            amount: r.amount !== null && r.amount !== undefined ? String(r.amount) : '0',
            recordedAt: r.recorded_at ? new Date(r.recorded_at).toISOString() : null,
            baseline: Boolean(r.baseline)
          });
          lastReferredId = refId;
        }

        if (rows.length < pageSize) break;
      }
    }

    // 8. Retenciones escrow activas (web3_escrow_holds)
    if (existingTables.has('web3_escrow_holds')) {
      const escrowRes = await client.query(
        `SELECT id, publication_id, author_id, responsible_user_id, amount_locked, commission_rate_locked, status, created_at
         FROM web3_escrow_holds
         WHERE status IN ('locked', 'pending', 'disputed')
         ORDER BY id ASC`
      );
      sqlResult.escrowHoldsActive = (escrowRes?.rows || []).map((r) => ({
        id: String(r.id),
        publicationId: r.publication_id !== null && r.publication_id !== undefined ? Number(r.publication_id) : null,
        authorId: r.author_id !== null && r.author_id !== undefined ? Number(r.author_id) : null,
        responsibleUserId: r.responsible_user_id !== null && r.responsible_user_id !== undefined ? Number(r.responsible_user_id) : null,
        amountLocked: String(r.amount_locked ?? '0'),
        commissionRateLocked: String(r.commission_rate_locked ?? '0'),
        status: String(r.status),
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null
      }));
    }

    // 9a. Publicaciones activas / con pago en curso (paginadas por id > $1, sin truncar ni texto libre PII)
    if (existingTables.has('publications')) {
      const pubCols = ['id', 'author_id', 'status'];
      if (hasColumn('publications', 'blue_cost')) pubCols.push('blue_cost::text AS blue_cost');
      if (hasColumn('publications', 'base_blue_cost')) pubCols.push('base_blue_cost::text AS base_blue_cost');
      if (hasColumn('publications', 'current_amount')) pubCols.push('current_amount::text AS current_amount');
      if (hasColumn('publications', 'goal_amount')) pubCols.push('goal_amount::text AS goal_amount');

      let lastPubId = 0;
      while (true) {
        const pubRes = await client.query(
          `SELECT ${pubCols.join(', ')}
           FROM publications
           WHERE id > $1 AND status NOT IN ('completed', 'cancelled', 'deleted', 'expired', 'closed')
           ORDER BY id ASC
           LIMIT $2`,
          [lastPubId, pageSize]
        );
        const rows = pubRes?.rows || [];
        if (rows.length === 0) break;

        for (const r of rows) {
          sqlResult.publicationsActive.push({
            id: Number(r.id),
            authorId: r.author_id !== null && r.author_id !== undefined ? Number(r.author_id) : null,
            status: String(r.status),
            blueCost: r.blue_cost !== undefined && r.blue_cost !== null ? String(r.blue_cost) : null,
            baseBlueCost: r.base_blue_cost !== undefined && r.base_blue_cost !== null ? String(r.base_blue_cost) : null,
            currentAmount: r.current_amount !== undefined && r.current_amount !== null ? String(r.current_amount) : null,
            goalAmount: r.goal_amount !== undefined && r.goal_amount !== null ? String(r.goal_amount) : null
          });
          lastPubId = Number(r.id);
        }

        if (rows.length < pageSize) break;
      }
    }

    // 9b. Aceptaciones / pagos pendientes en publication_acceptances (paginadas por pa.id > $1, CERO PII)
    if (existingTables.has('publication_acceptances')) {
      const accCountsRes = await client.query(
        `SELECT status, COUNT(*)::text AS total
         FROM publication_acceptances
         GROUP BY status`
      );
      for (const r of accCountsRes?.rows || []) {
        sqlResult.publicationAcceptancesCountsByStatus[String(r.status)] = String(r.total);
      }

      const accCols = ['pa.id', 'pa.publication_id', 'u.id AS acceptor_user_id', 'pa.status', 'pa.created_at'];
      if (hasColumn('publication_acceptances', 'blue_cost')) accCols.push('pa.blue_cost::text AS blue_cost');
      if (hasColumn('publication_acceptances', 'paid_recorded_at')) accCols.push('pa.paid_recorded_at');

      let lastAccId = 0;
      while (true) {
        const accRes = await client.query(
          `SELECT ${accCols.join(', ')}
           FROM publication_acceptances pa
           LEFT JOIN users u ON u.username = pa.acceptor_username
           WHERE pa.id > $1 AND pa.status NOT IN ('confirmed_paid', 'rejected', 'cancelled')
           ORDER BY pa.id ASC
           LIMIT $2`,
          [lastAccId, pageSize]
        );
        const rows = accRes?.rows || [];
        if (rows.length === 0) break;

        for (const r of rows) {
          sqlResult.publicationAcceptancesPending.push({
            id: Number(r.id),
            publicationId: r.publication_id !== null && r.publication_id !== undefined ? Number(r.publication_id) : null,
            acceptorUserId: r.acceptor_user_id !== null && r.acceptor_user_id !== undefined ? Number(r.acceptor_user_id) : null,
            status: String(r.status),
            blueCost: r.blue_cost !== undefined && r.blue_cost !== null ? String(r.blue_cost) : null,
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
            paidRecordedAt: r.paid_recorded_at ? new Date(r.paid_recorded_at).toISOString() : null
          });
          lastAccId = Number(r.id);
        }

        if (rows.length < pageSize) break;
      }
    }

    // 10. Cursores de sincronización del Exchange V6
    if (existingTables.has('web3_exchange_v6_sync')) {
      const syncRes = await client.query(
        `SELECT chain_id, router_address, start_block, stream_fingerprint, cursor_block, cursor_hash, status, updated_at
         FROM web3_exchange_v6_sync
         ORDER BY chain_id ASC, router_address ASC`
      );
      sqlResult.exchangeV6Sync = (syncRes?.rows || []).map((r) => ({
        chainId: String(r.chain_id),
        routerAddress: String(r.router_address),
        startBlock: String(r.start_block),
        streamFingerprint: String(r.stream_fingerprint),
        cursorBlock: String(r.cursor_block),
        cursorHash: r.cursor_hash ? String(r.cursor_hash) : null,
        status: String(r.status),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null
      }));
    }

    if (existingTables.has('web3_exchange_v6_orders')) {
      const ordCnt = await client.query('SELECT COUNT(*)::text AS total FROM web3_exchange_v6_orders');
      sqlResult.exchangeV6ProjectionsCount.orders = String(ordCnt?.rows?.[0]?.total ?? '0');
    }
    if (existingTables.has('web3_exchange_v6_refunds')) {
      const refCnt = await client.query('SELECT COUNT(*)::text AS total FROM web3_exchange_v6_refunds');
      sqlResult.exchangeV6ProjectionsCount.refunds = String(refCnt?.rows?.[0]?.total ?? '0');
    }

    // 11. Operaciones en cadena (prepared / pending / conflict) estrictamente sanitizadas
    if (existingTables.has('chain_operations')) {
      const countRes = await client.query(
        `SELECT state, COUNT(*)::text AS total
         FROM chain_operations
         GROUP BY state`
      );
      for (const r of countRes?.rows || []) {
        sqlResult.chainOperations.countsByState[String(r.state)] = String(r.total);
      }

      const activeOpsRes = await client.query(
        `SELECT id, user_id, chain_id, sender, resource_key, kind, state, error_code, payload, steps, created_at, updated_at
         FROM chain_operations
         WHERE state IN ('prepared', 'pending', 'conflict')
         ORDER BY created_at ASC`
      );
      sqlResult.chainOperations.activeOperations = (activeOpsRes?.rows || []).map(sanitizeChainOperationRow);
    }

    sqlResult.discoveredWallets = Array.from(walletSet).sort();

    await client.query('COMMIT');
    inTransaction = false;

    sqlResult.complete = sqlErrors.length === 0;
  } catch (error) {
    // Re-lanzar errores fatales de identidad de base de datos (fail-closed)
    if (/^SQL_IDENTITY_(REJECTED|MISMATCH|FAILED)/.test(String(error?.message || ''))) {
      throw error;
    }
    sqlErrors.push({
      stage: 'sql_read',
      code: error.code ? String(error.code) : 'SQL_READ_ERROR',
      message: sanitizeText(error.message)
    });
    sqlResult.complete = false;
  } finally {
    if (client && inTransaction) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignorar error de rollback en cierre seguro
      }
    }
    if (client) {
      if (typeof client.end === 'function') {
        try { await client.end(); } catch { /* noop */ }
      } else if (typeof client.release === 'function') {
        try { client.release(); } catch { /* noop */ }
      }
    }
  }

  return { sqlResult, sqlErrors };
}

// ----------------------------------------------------------------------------
// EVALUACIÓN DE INVARIANTES ECONÓMICOS Y ELEGIBILIDAD
// ----------------------------------------------------------------------------

/**
 * Evalúa todos los invariantes contables y económicos del protocolo V6 usando
 * aritmética entera exacta (`BigInt`).
 */
function evaluateInvariants({
  supplies,
  accountsMap,
  vaultState,
  exchangeState,
  orders,
  onchainComplete = true,
  globalStateComplete = true
}) {
  const checks = {};

  // 0. Completitud de datos on-chain: nunca certificar invariantes sobre datos parciales o sintéticos
  checks.dataCompleteness = {
    ok: Boolean(onchainComplete && globalStateComplete),
    passed: Boolean(onchainComplete && globalStateComplete),
    onchainComplete: Boolean(onchainComplete),
    globalStateComplete: Boolean(globalStateComplete),
    detail: (onchainComplete && globalStateComplete)
      ? 'Lectura on-chain y estado global completos para evaluar invariantes.'
      : 'Lectura on-chain o estado global incompleto: invariantes bloqueados en modo fail-closed.'
  };

  if (!globalStateComplete || !supplies || !vaultState || !exchangeState) {
    return { allPassed: false, checks };
  }

  // 1. Paridad global 1:1 BLUE == RED
  const blueSupply = supplies.blue;
  const redSupply = supplies.red;
  checks.pairedSupplyParity = {
    ok: blueSupply === redSupply,
    blueTotalSupply: blueSupply.toString(),
    redTotalSupply: redSupply.toString(),
    detail: blueSupply === redSupply
      ? 'Paridad exacta 1:1 verificada entre TotalSupply(BLUE) y TotalSupply(RED).'
      : `Ruptura de paridad 1:1: BLUE=${blueSupply.toString()} != RED=${redSupply.toString()}.`
  };

  // 2. Suma de saldos BLUE de todos los titulares/contratos == totalSupply(BLUE)
  let sumBlue = 0n;
  let sumRed = 0n;
  let sumCollateralBalance = 0n;
  let sumExchangeReservedByAccount = 0n;
  let sumPendingRefundBlueByAccount = 0n;
  let sumPendingRefundUsdtByAccount = 0n;

  const redLedgerMismatches = [];
  const parkingViolations = [];

  for (const [address, acc] of accountsMap.entries()) {
    sumBlue += acc.blue.balance;
    sumRed += acc.red.balance;
    sumCollateralBalance += acc.vault.collateralBalance;
    sumExchangeReservedByAccount += acc.vault.exchangeReserved;
    sumPendingRefundBlueByAccount += acc.exchangePendingRefund.blue;
    sumPendingRefundUsdtByAccount += acc.exchangePendingRefund.usdt;

    // 4. RED por cuenta == CommitmentLedger.outstanding(cuenta)
    if (acc.red.balance !== acc.red.ledgerOutstanding) {
      redLedgerMismatches.push({
        address,
        redBalance: acc.red.balance.toString(),
        ledgerOutstanding: acc.red.ledgerOutstanding.toString()
      });
    }

    // 5. Parking <= BLUE por cuenta y consistencia con availableBalanceOf
    if (acc.blue.locked > acc.blue.balance || (acc.blue.balance - acc.blue.locked) !== acc.blue.available) {
      parkingViolations.push({
        address,
        blueBalance: acc.blue.balance.toString(),
        blueLocked: acc.blue.locked.toString(),
        blueAvailable: acc.blue.available.toString()
      });
    }
  }

  checks.blueHoldersSumMatchesSupply = {
    ok: sumBlue === blueSupply,
    sumAccountsBlue: sumBlue.toString(),
    blueTotalSupply: blueSupply.toString(),
    detail: sumBlue === blueSupply
      ? 'La suma de BLUE por titular/contrato coincide exactamente con totalSupply(BLUE).'
      : `Discrepancia en BLUE: sum=${sumBlue.toString()} vs supply=${blueSupply.toString()}.`
  };

  // 3. Suma de saldos RED de todos los titulares/contratos == totalSupply(RED)
  checks.redHoldersSumMatchesSupply = {
    ok: sumRed === redSupply,
    sumAccountsRed: sumRed.toString(),
    redTotalSupply: redSupply.toString(),
    detail: sumRed === redSupply
      ? 'La suma de RED por titular/contrato coincide exactamente con totalSupply(RED).'
      : `Discrepancia en RED: sum=${sumRed.toString()} vs supply=${redSupply.toString()}.`
  };

  checks.redMatchesLedgerOutstandingPerAccount = {
    ok: redLedgerMismatches.length === 0,
    mismatchCount: redLedgerMismatches.length,
    mismatches: redLedgerMismatches,
    detail: redLedgerMismatches.length === 0
      ? 'Todos los titulares cumplen RedTokenV6.balanceOf == CommitmentLedger.outstanding.'
      : `Se detectaron ${redLedgerMismatches.length} cuenta(s) con discrepancia entre RedTokenV6 y CommitmentLedger.`
  };

  checks.parkingWithinBluePerAccount = {
    ok: parkingViolations.length === 0,
    violationCount: parkingViolations.length,
    violations: parkingViolations,
    detail: parkingViolations.length === 0
      ? 'Todos los titulares cumplen lockedBalanceOf <= balanceOf y available == balance - locked.'
      : `Se detectaron ${parkingViolations.length} cuenta(s) con violación de parking BLUE.`
  };

  // 6. Custodia física y garantías sin doble conteo
  let activeBlueOrdersRemaining = 0n;
  let activeUsdtOrdersRemaining = 0n;
  let sumOrderReservedVault = 0n;
  let sumAdapterReservations = 0n;
  const orderCollateralViolations = [];

  for (const ord of orders) {
    const isLiveOrder = ord.statusCode === 1 || ord.statusCode === 2 || ord.statusCode === 5; // OPEN, PARTIALLY_FILLED, SUSPENDED
    if (isLiveOrder) {
      if (ord.sideCode === 0) activeBlueOrdersRemaining += ord.remaining;
      else if (ord.sideCode === 1) activeUsdtOrdersRemaining += ord.remaining;
    }
    sumOrderReservedVault += ord.vaultOrderReserved;
    sumAdapterReservations += ord.adapterReserved;

    if (ord.vaultOrderReserved !== ord.adapterReserved || ord.vaultOrderReserved > ord.remaining) {
      orderCollateralViolations.push({
        orderId: ord.id,
        remaining: ord.remaining.toString(),
        vaultOrderReserved: ord.vaultOrderReserved.toString(),
        adapterReserved: ord.adapterReserved.toString()
      });
    }
  }

  const custodyBlueLiabilities = exchangeState.custody.totalReservedBlue +
    exchangeState.custody.totalPendingRefundBlue +
    exchangeState.custody.accumulatedFeesBlue;
  const custodyUsdtLiabilities = exchangeState.custody.totalReservedUsdt +
    exchangeState.custody.totalPendingRefundUsdt +
    exchangeState.custody.accumulatedFeesUsdt;

  const custodyBlueSolvent = exchangeState.custody.physicalBlueBalance >= custodyBlueLiabilities &&
    exchangeState.custody.physicalBlueBalance >= exchangeState.custody.liabilitiesBlue;
  const custodyUsdtSolvent = exchangeState.custody.physicalUsdtBalance >= custodyUsdtLiabilities &&
    exchangeState.custody.physicalUsdtBalance >= exchangeState.custody.liabilitiesUsdt;

  const vaultUnreservedRequired = vaultState.totalCollateral >= vaultState.totalExchangeReserved
    ? vaultState.totalCollateral - vaultState.totalExchangeReserved
    : null;
  const vaultPhysicalSolvent = vaultUnreservedRequired !== null &&
    vaultState.usdtPhysicalBalance >= vaultUnreservedRequired;

  const noDoubleCount =
    exchangeState.adapter.totalCollateralReserved === vaultState.totalExchangeReserved &&
    exchangeState.adapter.totalCollateralReserved <= exchangeState.custody.totalReservedUsdt &&
    sumOrderReservedVault === vaultState.totalExchangeReserved &&
    sumAdapterReservations === exchangeState.adapter.totalCollateralReserved &&
    sumExchangeReservedByAccount === vaultState.totalExchangeReserved &&
    sumCollateralBalance === vaultState.totalCollateral &&
    activeBlueOrdersRemaining === exchangeState.custody.totalReservedBlue &&
    activeUsdtOrdersRemaining === exchangeState.custody.totalReservedUsdt &&
    sumPendingRefundBlueByAccount === exchangeState.custody.totalPendingRefundBlue &&
    sumPendingRefundUsdtByAccount === exchangeState.custody.totalPendingRefundUsdt &&
    orderCollateralViolations.length === 0;

  checks.custodyAndCollateralNoDoubleCount = {
    ok: custodyBlueSolvent && custodyUsdtSolvent && vaultPhysicalSolvent && noDoubleCount,
    custodyBlueSolvent,
    custodyUsdtSolvent,
    vaultPhysicalSolvent,
    noDoubleCount,
    metrics: {
      custodyPhysicalBlue: exchangeState.custody.physicalBlueBalance.toString(),
      custodyLiabilitiesBlue: custodyBlueLiabilities.toString(),
      custodyPhysicalUsdt: exchangeState.custody.physicalUsdtBalance.toString(),
      custodyLiabilitiesUsdt: custodyUsdtLiabilities.toString(),
      activeBlueOrdersRemaining: activeBlueOrdersRemaining.toString(),
      custodyTotalReservedBlue: exchangeState.custody.totalReservedBlue.toString(),
      activeUsdtOrdersRemaining: activeUsdtOrdersRemaining.toString(),
      custodyTotalReservedUsdt: exchangeState.custody.totalReservedUsdt.toString(),
      vaultUsdtPhysical: vaultState.usdtPhysicalBalance.toString(),
      vaultTotalCollateral: vaultState.totalCollateral.toString(),
      vaultTotalExchangeReserved: vaultState.totalExchangeReserved.toString(),
      adapterTotalCollateralReserved: exchangeState.adapter.totalCollateralReserved.toString(),
      sumCollateralBalanceByAccount: sumCollateralBalance.toString(),
      sumExchangeReservedByAccount: sumExchangeReservedByAccount.toString(),
      sumOrderReservedVault: sumOrderReservedVault.toString(),
      sumAdapterReservations: sumAdapterReservations.toString(),
      sumPendingRefundBlueByAccount: sumPendingRefundBlueByAccount.toString(),
      custodyTotalPendingRefundBlue: exchangeState.custody.totalPendingRefundBlue.toString(),
      sumPendingRefundUsdtByAccount: sumPendingRefundUsdtByAccount.toString(),
      custodyTotalPendingRefundUsdt: exchangeState.custody.totalPendingRefundUsdt.toString()
    },
    orderCollateralViolations,
    detail: (custodyBlueSolvent && custodyUsdtSolvent && vaultPhysicalSolvent && noDoubleCount)
      ? 'Custodia física de Exchange y Bóveda solventes y sin doble conteo.'
      : 'Se detectó inconsistencia de solvencia o doble conteo entre Bóveda, ExchangeCustody, FifoOrderBook y AmortizationAdapter.'
  };

  const allPassed = Object.values(checks).every((c) => c.ok === true);
  return { allPassed, checks };
}

/**
 * Evalúa por separado:
 * 1) `candidateEmptyAtBlock`: estado económico on-chain observado en el bloque `finalized`.
 * 2) `onchainMigratorRequired`: si se requiere migrador on-chain por estado vivo en contratos V6.
 * 3) `sqlPreservationAndReconciliation`: obligaciones de preservación y conciliación SQL
 *    (nunca borrar publicaciones ni IOUs históricos).
 * 4) `routeAEligible`: elegibilidad estricta que exige contención externa verificable,
 *    cero actividad relevante post-finalized y cero pendientes activos.
 */
function evaluateEligibility({
  completeness,
  invariants,
  supplies,
  vaultState,
  exchangeState,
  treasuryState,
  orders,
  governance,
  sqlResult,
  activityAfterFinalized,
  writeContainmentVerified = false,
  writeContainmentDeclared = false,
  writeContainmentExternalVerified = false,
  writeContainmentEvidenceRef = null
}) {
  const candidateEmptyReasons = [];

  if (!completeness.onchainComplete) {
    candidateEmptyReasons.push('Inventario on-chain incompleto; no se puede afirmar estado vacío en el bloque finalizado.');
  }
  if (!completeness.globalStateComplete || !supplies || !vaultState || !exchangeState) {
    candidateEmptyReasons.push('Lectura del estado global de contratos incompleta (valores no disponibles).');
  }
  if (!invariants.allPassed) {
    candidateEmptyReasons.push('Falló al menos un invariante contable/económico.');
  }
  if (supplies && supplies.blue > 0n) {
    candidateEmptyReasons.push(`TotalSupply(BLUE) residual distinto de cero: ${supplies.blue.toString()}.`);
  }
  if (supplies && supplies.red > 0n) {
    candidateEmptyReasons.push(`TotalSupply(RED) residual distinto de cero: ${supplies.red.toString()}.`);
  }
  if (supplies && supplies.usdt > 0n) {
    candidateEmptyReasons.push(`MockUSDT totalSupply residual distinto de cero: ${supplies.usdt.toString()}.`);
  }

  const liveOrdersCount = Array.isArray(orders)
    ? orders.filter((o) => o.statusCode === 1 || o.statusCode === 2 || o.statusCode === 5).length
    : 0;
  if (liveOrdersCount > 0) {
    candidateEmptyReasons.push(`Existen ${liveOrdersCount} orden(es) activa(s) o suspendida(s) en FifoOrderBook.`);
  }
  if (exchangeState && (exchangeState.custody.totalReservedBlue > 0n || exchangeState.custody.totalReservedUsdt > 0n)) {
    candidateEmptyReasons.push('ExchangeCustody conserva reservas activas distintas de cero.');
  }
  if (exchangeState && (exchangeState.custody.totalPendingRefundBlue > 0n || exchangeState.custody.totalPendingRefundUsdt > 0n)) {
    candidateEmptyReasons.push('ExchangeCustody conserva reembolsos pendientes distintos de cero.');
  }
  if (exchangeState && (exchangeState.custody.accumulatedFeesBlue > 0n || exchangeState.custody.accumulatedFeesUsdt > 0n)) {
    candidateEmptyReasons.push('ExchangeCustody conserva comisiones acumuladas sin reclamar.');
  }
  if (exchangeState && (exchangeState.custody.physicalBlueBalance > 0n || exchangeState.custody.physicalUsdtBalance > 0n)) {
    candidateEmptyReasons.push('ExchangeCustody conserva balance físico residual de BLUE o USDT.');
  }
  if (vaultState && (vaultState.totalCollateral > 0n || vaultState.totalExchangeReserved > 0n || vaultState.usdtPhysicalBalance > 0n)) {
    candidateEmptyReasons.push('CollateralVaultV6 conserva garantías o USDT físico residual.');
  }
  if (
    treasuryState &&
    treasuryState.activeSurplusProposal &&
    BigInt(treasuryState.activeSurplusProposal.eta) > 0n &&
    !treasuryState.activeSurplusProposal.executed &&
    !treasuryState.activeSurplusProposal.cancelled
  ) {
    candidateEmptyReasons.push('ProtocolTreasuryV6 tiene una propuesta de retiro de excedentes activa pendiente.');
  }

  const candidateEmptyAtBlock = candidateEmptyReasons.length === 0;

  // Eje 1 (CODEX-205 #5): Necesidad de migrador on-chain (estrictamente estado vivo on-chain)
  const onchainMigratorRequired = {
    required: !candidateEmptyAtBlock,
    reasons: candidateEmptyAtBlock ? [] : [...candidateEmptyReasons]
  };

  // Eje 2 (CODEX-205 #5): Preservación y conciliación SQL (nunca borrar publicaciones ni IOUs históricos)
  const sqlPendingItems = [];
  if (sqlResult.skipped) {
    sqlPendingItems.push({
      category: 'sql_skipped',
      count: null,
      detail: 'Se omitió la lectura SQL (--skip-sql); la conciliación SQL es obligatoria antes de cualquier corte.'
    });
  } else {
    if (!completeness.sqlComplete) {
      sqlPendingItems.push({
        category: 'sql_incomplete',
        count: null,
        detail: 'Lectura SQL incompleta o tablas requeridas ausentes.'
      });
    }
    if (sqlResult.chainOperations?.activeOperations?.length > 0) {
      sqlPendingItems.push({
        category: 'chain_operations',
        count: sqlResult.chainOperations.activeOperations.length,
        detail: `Existen ${sqlResult.chainOperations.activeOperations.length} operación(es) SQL activas en chain_operations.`
      });
    }
    if (sqlResult.escrowHoldsActive?.length > 0) {
      sqlPendingItems.push({
        category: 'web3_escrow_holds',
        count: sqlResult.escrowHoldsActive.length,
        detail: `Existen ${sqlResult.escrowHoldsActive.length} retención(es) activa(s) en web3_escrow_holds.`
      });
    }
    if (sqlResult.policy?.openCreditPolicyIssues?.length > 0) {
      const dlqCount = sqlResult.policy.openCreditPolicyIssues.filter((i) => i.status === 'dead_letter').length;
      const dlqSuffix = dlqCount > 0 ? ` (incluyendo ${dlqCount} en dead_letter)` : '';
      sqlPendingItems.push({
        category: 'credit_policy_issues',
        count: sqlResult.policy.openCreditPolicyIssues.length,
        deadLetterCount: dlqCount,
        detail: `Existen ${sqlResult.policy.openCreditPolicyIssues.length} incidencia(s) no resuelta(s) en credit_policy_issues${dlqSuffix}.`
      });
    }
    if (sqlResult.moraEpisodes?.length > 0) {
      sqlPendingItems.push({
        category: 'mora_episodes',
        count: sqlResult.moraEpisodes.length,
        detail: `Existen ${sqlResult.moraEpisodes.length} episodio(s) de mora activo(s) en users (mora_episode_*).`
      });
    }
    if (sqlResult.creditNotificationOutbox?.pendingItems?.length > 0) {
      sqlPendingItems.push({
        category: 'credit_notification_outbox',
        count: sqlResult.creditNotificationOutbox.pendingItems.length,
        detail: `Existen ${sqlResult.creditNotificationOutbox.pendingItems.length} notificación(es) pendiente(s) en credit_notification_outbox.`
      });
    }
    if (sqlResult.publicationsActive?.length > 0) {
      sqlPendingItems.push({
        category: 'publications',
        count: sqlResult.publicationsActive.length,
        detail: `Existen ${sqlResult.publicationsActive.length} publicación(es) activa(s) en publications (preservar registros históricos y conciliar).`
      });
    }
    if (sqlResult.publicationAcceptancesPending?.length > 0) {
      sqlPendingItems.push({
        category: 'publication_acceptances',
        count: sqlResult.publicationAcceptancesPending.length,
        detail: `Existen ${sqlResult.publicationAcceptancesPending.length} aceptación(es)/pago(s) pendiente(s) en publication_acceptances (preservar registros históricos y conciliar).`
      });
    }
  }

  const sqlPreservationAndReconciliation = {
    required: sqlPendingItems.length > 0,
    preserveHistoricalRecords: true,
    neverDeleteHistoricalPublicationsOrIous: true,
    pendingItems: sqlPendingItems
  };

  // Eje 3 (CODEX-205 #4): Declaración del operador vs evidencia externa verificable de contención
  const declaredByOperator = Boolean(writeContainmentDeclared || writeContainmentVerified);
  const sanitizedEvidenceRef = (typeof writeContainmentEvidenceRef === 'string' && writeContainmentEvidenceRef.trim().length > 0)
    ? sanitizeText(writeContainmentEvidenceRef.trim())
    : null;
  const externalEvidenceProvided = Boolean(writeContainmentExternalVerified && sanitizedEvidenceRef);

  const writeContainmentDeclaration = {
    declaredByOperator,
    notice: 'Un booleano provisto como opción es únicamente una declaración del operador y NO constituye evidencia criptográfica ni operativa suficiente por sí sola.'
  };

  const writeContainmentEvidence = {
    declaredByOperator,
    externalEvidenceProvided,
    externalEvidenceRef: sanitizedEvidenceRef,
    requiresExternalVerificationBeforeCutover: true
  };

  // Evaluación estricta y separada de elegibilidad Ruta A
  const routeABlockingReasons = [];
  if (!completeness.onchainComplete) {
    routeABlockingReasons.push('Lectura on-chain incompleta o con errores/reorg.');
  }
  if (sqlResult.skipped) {
    routeABlockingReasons.push('Se omitió la lectura SQL (--skip-sql); Ruta A exige inventario SQL completo.');
  } else if (!completeness.sqlComplete) {
    routeABlockingReasons.push('Lectura SQL incompleta o faltan tablas requeridas.');
  }
  if (!completeness.fullComplete) {
    routeABlockingReasons.push('El inventario no alcanzó fullComplete=true.');
  }
  if (!invariants.allPassed) {
    routeABlockingReasons.push('Invariantes contables/económicos no superados.');
  }
  if (!candidateEmptyAtBlock) {
    routeABlockingReasons.push('El bloque finalizado no está vacío (candidateEmptyAtBlock=false).');
  }
  const currentModeName = governance?.modeName || 'UNKNOWN';
  if (currentModeName !== 'PRELAUNCH_FROZEN') {
    routeABlockingReasons.push(`El protocolo no está en modo PRELAUNCH_FROZEN (actual: ${currentModeName}).`);
  }
  if (!declaredByOperator) {
    routeABlockingReasons.push('El operador no declaró contención de escrituras (SQL y blockchain no son atómicos sin contención).');
  }
  if (!externalEvidenceProvided) {
    routeABlockingReasons.push('Falta evidencia externa verificable de contención de escrituras (una declaración booleana no basta por sí sola para habilitar Ruta A).');
  }

  // CODEX-205 #3: NO bloquear solo por progresión normal de bloques L2 (latest > finalized);
  // bloquear únicamente si hubo escrituras/eventos relevantes en contratos V6 o falló el escaneo post-finalized.
  if (activityAfterFinalized?.hasBlocksAfterFinalized) {
    if (activityAfterFinalized.postFinalizedScanComplete === false) {
      routeABlockingReasons.push(
        `El escaneo de actividad post-finalized (${activityAfterFinalized.finalizedBlockNumber + 1}..${activityAfterFinalized.latestBlockNumber}) falló o quedó incompleto.`
      );
    }
    if ((activityAfterFinalized.relevantEventsCount || 0) > 0) {
      routeABlockingReasons.push(
        `Se detectaron ${activityAfterFinalized.relevantEventsCount} escritura(s)/evento(s) relevante(s) en contratos V6 tras el bloque finalizado (${activityAfterFinalized.finalizedBlockNumber + 1}..${activityAfterFinalized.latestBlockNumber}).`
      );
    }
  }

  // Obligaciones de conciliación SQL pendientes (sin confundir con necesidad de migrador on-chain)
  for (const item of sqlPendingItems) {
    if (item.category !== 'sql_skipped' && item.category !== 'sql_incomplete') {
      routeABlockingReasons.push(`Conciliación SQL pendiente: ${item.detail}`);
    }
  }

  const routeAEligible = routeABlockingReasons.length === 0;

  return {
    atomicityNotice: 'SQL (REPEATABLE READ) y blockchain (bloque finalized) NO son atómicos entre sí sin contención real demostrada de escrituras.',
    activityAfterFinalized,
    writeContainmentDeclaration,
    writeContainmentEvidence,
    candidateEmptyAtBlock,
    candidateEmptyReasons,
    onchainMigratorRequired,
    sqlPreservationAndReconciliation,
    routeAEligible,
    routeABlockingReasons
  };
}

// ----------------------------------------------------------------------------
// FUNCIÓN PRINCIPAL DEL EXPORTADOR (100% READ-ONLY E INYECTABLE)
// ----------------------------------------------------------------------------

/**
 * Exporta el inventario completo read-only de la suite V6 Demo (chainId 11155420).
 *
 * @param {object} options
 * @param {string} options.rpcUrl URL RPC de Optimism Sepolia Demo (validada contra allowlist ANTES de conectar).
 * @param {string} [options.databaseUrl] URL PostgreSQL Demo (validada contra allowlist ANTES de conectar; omitida si skipSql=true).
 * @param {boolean} [options.skipSql=false] Omite consultas SQL; fuerza fullComplete=false y routeAEligible=false.
 * @param {boolean} [options.allowLocalRpc=false] Permite localhost/127.0.0.1 solo en pruebas/inyección local.
 * @param {boolean} [options.allowLocalSql=false] Permite PostgreSQL local solo en pruebas/inyección local.
 * @param {string[]} [options.allowedRpcHosts] Allowlist explícita opcional de hosts RPC.
 * @param {string[]} [options.allowedDbHosts] Allowlist explícita opcional de hosts SQL.
 * @param {string[]} [options.allowedDbNames] Allowlist explícita opcional de nombres de BD SQL.
 * @param {number} [options.maxLogBlockSpan=10000] Ventana máxima de bloques por llamada `eth_getLogs`.
 * @param {number} [options.sqlStatementTimeoutMs=15000] Timeout de consulta SQL dentro de la transacción READ ONLY.
 * @param {number} [options.sqlPageSize=500] Tamaño de página para consultas SQL paginadas.
 * @param {boolean} [options.writeContainmentVerified=false] Solo true si el operador demuestra contención real de escrituras.
 * @param {Function} [options.providerFactory] Fábrica inyectable `(rpcUrl) => provider` para pruebas unitarias.
 * @param {Function} [options.sqlClientFactory] Fábrica inyectable `(databaseUrl) => pgClient` para pruebas unitarias.
 * @param {object|string} [options.manifestOverride] Manifiesto inyectado para pruebas unitarias.
 * @param {string} [options.expectedManifestSha256] SHA-256 esperado del manifiesto.
 */
/**
 * Fábrica por defecto del proveedor RPC:
 * - Usa `{ batchMaxCount: 1 }` para evitar batches >10 ítems rechazados con HTTP 413 (-32014)
 *   por endpoints públicos de Optimism Sepolia.
 * - NO usa `staticNetwork: true` para garantizar la consulta real de `eth_chainId` al nodo.
 */
function createDefaultProvider(url) {
  return new JsonRpcProvider(url, undefined, { batchMaxCount: 1 });
}

async function exportV6DemoInventory(options = {}) {
  const isCustomProviderFactory = typeof options.providerFactory === 'function';
  const {
    rpcUrl,
    databaseUrl = null,
    skipSql = false,
    allowLocalRpc = false,
    allowLocalSql = false,
    allowedRpcHosts = null,
    allowedDbHosts = null,
    allowedDbNames = null,
    maxLogBlockSpan = DEFAULT_MAX_LOG_BLOCK_SPAN,
    sqlStatementTimeoutMs = DEFAULT_SQL_STATEMENT_TIMEOUT_MS,
    sqlPageSize = DEFAULT_SQL_PAGE_SIZE,
    rpcRequestDelayMs = isCustomProviderFactory ? 0 : 80,
    rpcRateLimitMaxAttempts = 4,
    rpcRateLimitBaseDelayMs = 400,
    writeContainmentVerified = false,
    writeContainmentDeclared = false,
    writeContainmentExternalVerified = false,
    writeContainmentEvidenceRef = null,
    providerFactory = createDefaultProvider,
    sqlClientFactory = async (url) => {
      const { Client } = require('pg');
      const client = new Client({ connectionString: url });
      await client.connect();
      return client;
    },
    manifestOverride = null,
    expectedManifestSha256 = v6ReleasePin.manifestSha256,
    manifestPath = DEFAULT_MANIFEST_PATH
  } = options;

  // ==========================================================================
  // PASO 1 (FAIL-CLOSED ANTES DE CONECTAR): Allowlist RPC, SQL y Manifiesto
  // ==========================================================================
  const rpcValidation = validateRpcUrlAllowlist(rpcUrl, { allowLocalRpc, allowedRpcHosts });

  let dbValidation = null;
  if (!skipSql) {
    dbValidation = validateDatabaseUrlAllowlist(databaseUrl, {
      allowLocalSql,
      allowedDbHosts,
      allowedDbNames
    });
  }

  const { manifest, manifestSha256, fingerprint } = loadAndVerifyV6Manifest({
    manifestPath,
    manifestOverride,
    expectedManifestSha256
  });

  // ==========================================================================
  // PASO 2: Conexión RPC solo lectura + validación real de eth_chainId y bloque finalized
  // ==========================================================================
  const provider = await providerFactory(rpcUrl);
  const network = await provider.getNetwork();
  if (BigInt(network.chainId) !== DEMO_CHAIN_ID) {
    throw new Error(
      `CHAIN_ID_MISMATCH: Se esperaba Optimism Sepolia Demo (${DEMO_CHAIN_ID_STR}) pero getNetwork() respondió chainId=${String(network.chainId)}.`
    );
  }
  // Consulta directa y obligatoria de `eth_chainId` al proveedor (inmune a cachés/staticNetwork)
  if (typeof provider.send === 'function') {
    const rpcChainIdRaw = await provider.send('eth_chainId', []);
    let rpcChainId;
    try {
      rpcChainId = BigInt(rpcChainIdRaw);
    } catch {
      throw new Error(`CHAIN_ID_MISMATCH: eth_chainId devolvió un valor inválido (${sanitizeText(rpcChainIdRaw)}).`);
    }
    if (rpcChainId !== DEMO_CHAIN_ID) {
      throw new Error(
        `CHAIN_ID_MISMATCH: eth_chainId devolvió ${rpcChainId.toString()}, esperado Optimism Sepolia Demo (${DEMO_CHAIN_ID_STR}).`
      );
    }
  }

  const finalizedBlock = await provider.getBlock('finalized');
  if (!finalizedBlock || !Number.isSafeInteger(finalizedBlock.number) || !/^0x[0-9a-fA-F]{64}$/.test(finalizedBlock.hash || '')) {
    throw new Error('FINALIZED_BLOCK_UNAVAILABLE: No se pudo obtener un bloque finalized canónico del RPC.');
  }

  const latestBlock = await provider.getBlock('latest');
  if (!latestBlock || !Number.isSafeInteger(latestBlock.number) || latestBlock.number < finalizedBlock.number) {
    throw new Error('LATEST_BLOCK_INCOHERENT: El bloque latest es inválido o anterior al bloque finalized.');
  }

  const retryOptions = {
    maxAttempts: rpcRateLimitMaxAttempts,
    baseDelayMs: rpcRateLimitBaseDelayMs
  };
  const pinnedRunner = createPinnedRunner(provider, finalizedBlock, retryOptions);
  const contracts = manifest.contracts;

  // ==========================================================================
  // PASO 3: Validación de codeHashes, owners y roles del manifiesto en `finalized`
  // ==========================================================================
  const verifiedCodeHashes = {};
  for (const name of REQUIRED_V6_CONTRACTS) {
    const address = contracts[name];
    const bytecode = await withRateLimitRetry(
      () => provider.getCode(address, finalizedBlock.number),
      retryOptions
    );
    if (!bytecode || bytecode === '0x') {
      throw new Error(`CONTRACT_CODE_MISSING: No existe bytecode en ${name} (${address}) en el bloque ${finalizedBlock.number}.`);
    }
    const observedHash = keccak256(bytecode).toLowerCase();
    const expectedHash = manifest.codeHashes[name].toLowerCase();
    if (observedHash !== expectedHash) {
      throw new Error(
        `CODEHASH_MISMATCH: ${name} (${address}) tiene codeHash=${observedHash}, esperado=${expectedHash}.`
      );
    }
    verifiedCodeHashes[name] = observedHash;
  }

  // Verificar enlaces críticos de la suite V6 en el bloque finalized
  for (const [sourceName, linkSpec] of Object.entries(V6_LINKS)) {
    const methods = Object.keys(linkSpec);
    const instance = new Contract(
      contracts[sourceName],
      methods.map((m) => `function ${m}() view returns (address)`),
      pinnedRunner
    );
    for (const [method, targetName] of Object.entries(linkSpec)) {
      const observedTarget = getAddress(await instance[method]());
      if (observedTarget !== contracts[targetName]) {
        throw new Error(
          `CONTRACT_LINK_MISMATCH: ${sourceName}.${method}() apunta a ${observedTarget}, esperado ${targetName} (${contracts[targetName]}).`
        );
      }
    }
  }

  // ==========================================================================
  // PASO 4: Lectura SQL Demo (REPEATABLE READ READ ONLY) o modo --skip-sql
  // ==========================================================================
  let sqlResult;
  let sqlErrors = [];
  if (skipSql) {
    sqlResult = {
      skipped: true,
      target: null,
      databaseNameObserved: null,
      isolationLevel: null,
      readOnlyEnforced: true,
      statementTimeoutMs: null,
      schema: null,
      users: [],
      smartAccounts: [],
      policy: null,
      moraEpisodes: [],
      creditNotificationOutbox: null,
      creditReferralAwards: null,
      escrowHoldsActive: [],
      publicationsActive: [],
      publicationAcceptancesCountsByStatus: {},
      publicationAcceptancesPending: [],
      exchangeV6Sync: [],
      exchangeV6ProjectionsCount: null,
      chainOperations: { countsByState: {}, activeOperations: [] },
      discoveredWallets: [],
      complete: false
    };
  } else {
    const sqlOut = await collectSqlDemoInventory({
      databaseUrl,
      dbValidation,
      sqlClientFactory,
      statementTimeoutMs: sqlStatementTimeoutMs,
      pageSize: sqlPageSize,
      allowLocalSql,
      allowedDbNames
    });
    sqlResult = sqlOut.sqlResult;
    sqlErrors = sqlOut.sqlErrors;
  }

  // ==========================================================================
  // PASO 5: Descubrimiento completo de titulares (eventos + sistema + SQL)
  // ==========================================================================
  const onchainErrors = [];
  const logStats = {
    maxLogBlockSpan,
    rpcLogRequests: 0,
    subdivisions: 0,
    totalLogsScanned: 0,
    paginationComplete: true
  };

  const startBlocks = await resolveContractStartBlocks(provider, manifest, finalizedBlock.number, onchainErrors, retryOptions);

  // Mapa de direcciones descubiertas -> Set de fuentes
  const discoveredAddressSources = new Map();
  const registerAddress = (rawAddr, source) => {
    const addr = normalizeNonZeroAddress(rawAddr);
    if (!addr) return;
    if (!discoveredAddressSources.has(addr)) discoveredAddressSources.set(addr, new Set());
    discoveredAddressSources.get(addr).add(source);
  };

  // 5.1 Contratos del sistema + owners/roles del manifiesto
  for (const [name, addr] of Object.entries(contracts)) {
    registerAddress(addr, `system_contract:${name}`);
  }
  for (const [name, addr] of Object.entries(manifest.owners || {})) {
    registerAddress(addr, `manifest_owner:${name}`);
  }
  for (const [role, addr] of Object.entries(manifest.roles || {})) {
    registerAddress(addr, `manifest_role:${role}`);
  }

  // 5.2 Billeteras descubiertas en SQL
  for (const wallet of sqlResult.discoveredWallets || []) {
    registerAddress(wallet, 'sql_wallet');
  }

  // 5.3 Eventos on-chain paginados desde startBlocks hasta finalizedBlock.number
  const commitmentLotsByAccount = new Map();
  const observedExtensionDurations = new Set();
  const observedBoosterClaims = [];

  for (const [contractName, iface] of Object.entries(DISCOVERY_EVENT_INTERFACES)) {
    const address = contracts[contractName];
    const fromBlock = startBlocks[contractName];
    const topics = [iface.fragments.filter((f) => f.type === 'event').map((f) => iface.getEvent(f.format()).topicHash)];

    try {
      const logs = await fetchLogsPaginated(
        provider,
        { address, topics, fromBlock, toBlock: finalizedBlock.number },
        maxLogBlockSpan,
        logStats,
        { rpcRequestDelayMs, retryOptions }
      );
      logStats.totalLogsScanned += logs.length;

      for (const log of logs) {
        let parsed;
        try {
          parsed = iface.parseLog(log);
        } catch {
          continue;
        }
        if (!parsed) continue;

        // Extraer cualquier dirección presente en los argumentos del evento
        for (const arg of parsed.args) {
          if (typeof arg === 'string' && isAddress(arg)) {
            registerAddress(arg, `event:${contractName}.${parsed.name}`);
          }
        }

        // Registrar lotIds creados en CommitmentLedger para consulta exacta de lotes activos
        if (contractName === 'CommitmentLedger' && parsed.name === 'CommitmentCreated') {
          const account = normalizeNonZeroAddress(parsed.args.account);
          const lotId = BigInt(parsed.args.lotId);
          if (account) {
            if (!commitmentLotsByAccount.has(account)) commitmentLotsByAccount.set(account, new Set());
            commitmentLotsByAccount.get(account).add(lotId);
          }
        }

        // Registrar duraciones observadas en ExtensionManager
        if (contractName === 'ExtensionManager' && (parsed.name === 'OptionProposed' || parsed.name === 'OptionActivated')) {
          observedExtensionDurations.add(Number(parsed.args.duration));
        }

        // Registrar reclamos de boosters en ProtocolTreasuryV6
        if (contractName === 'ProtocolTreasuryV6' && parsed.name === 'BoosterRewardClaimed') {
          observedBoosterClaims.push({
            user: normalizeNonZeroAddress(parsed.args.user),
            amount: toExactAmount(parsed.args.amount),
            blockNumber: log.blockNumber,
            txHash: log.transactionHash || null
          });
        }
      }
    } catch (error) {
      logStats.paginationComplete = false;
      onchainErrors.push({
        stage: 'event_discovery',
        contract: contractName,
        fromBlock,
        toBlock: finalizedBlock.number,
        code: error.isPruned ? 'RPC_PRUNED_HISTORY_4444' : (error.isReorg ? 'REORG_LOG_REMOVED' : 'EVENT_SCAN_ERROR'),
        message: sanitizeText(error.message)
      });
    }
  }

  // ==========================================================================
  // PASO 6: Lectura del estado global de contratos V6 en bloque `finalized`
  // ==========================================================================
  const blueContract = new Contract(contracts.BlueTokenV6, BLUE_V6_VIEW_ABI, pinnedRunner);
  const redContract = new Contract(contracts.RedTokenV6, RED_V6_VIEW_ABI, pinnedRunner);
  const usdtContract = new Contract(contracts.USDT, ERC20_VIEW_ABI, pinnedRunner);
  const ledgerContract = new Contract(contracts.CommitmentLedger, LEDGER_V6_VIEW_ABI, pinnedRunner);
  const riskContract = new Contract(contracts.RiskRegistry, RISK_V6_VIEW_ABI, pinnedRunner);
  const vaultContract = new Contract(contracts.CollateralVaultV6, VAULT_V6_VIEW_ABI, pinnedRunner);
  const bookContract = new Contract(contracts.FifoOrderBook, BOOK_V6_VIEW_ABI, pinnedRunner);
  const custodyContract = new Contract(contracts.ExchangeCustody, CUSTODY_V6_VIEW_ABI, pinnedRunner);
  const routerContract = new Contract(contracts.ExchangeRouter, ROUTER_V6_VIEW_ABI, pinnedRunner);
  const adapterContract = new Contract(contracts.AmortizationAdapter, ADAPTER_V6_VIEW_ABI, pinnedRunner);
  const exchangeConfigContract = new Contract(contracts.ExchangeConfig, EXCHANGE_CONFIG_V6_VIEW_ABI, pinnedRunner);
  const treasuryContract = new Contract(contracts.ProtocolTreasuryV6, TREASURY_V6_VIEW_ABI, pinnedRunner);
  const modeContract = new Contract(contracts.ProtocolModeController, MODE_V6_VIEW_ABI, pinnedRunner);
  const protocolConfigContract = new Contract(contracts.ProtocolConfig, PROTOCOL_CONFIG_V6_VIEW_ABI, pinnedRunner);
  const pairedSupplyContract = new Contract(contracts.PairedSupplyController, PAIRED_SUPPLY_V6_VIEW_ABI, pinnedRunner);
  const extensionManagerContract = new Contract(contracts.ExtensionManager, EXTENSION_MANAGER_V6_VIEW_ABI, pinnedRunner);
  const paymentAuthContract = new Contract(contracts.PaymentAuthorization, PAYMENT_AUTH_V6_VIEW_ABI, pinnedRunner);

  let globalStateComplete = false;
  let supplies = null;
  let governance = null;
  let vaultState = null;
  let exchangeState = null;
  let treasuryState = null;
  let ledgerGlobal = null;
  const orders = [];

  try {
    const [
      blueSupplyRaw,
      redSupplyRaw,
      usdtSupplyRaw,
      blueDecimals,
      redDecimals,
      usdtDecimals,
      modeRaw,
      modeOwner,
      modeGuardian,
      riskOwner,
      riskOperator,
      activeCfg,
      pendingCfg,
      pendingUnlockAt,
      protocolConfigOwner,
      exFeeBps,
      exTreasury,
      exPendingFeeBps,
      exFeeReadyAt,
      exPendingTreasury,
      exTreasuryReadyAt,
      exConfigOwner,
      pairedOwner,
      engineIsOperator,
      vaultUsdtPhysical,
      vaultTotalCollateral,
      vaultTotalExchangeReserved,
      vaultSolvent,
      vaultOwner,
      nextOrderId,
      nextSequence,
      blueQueueLength,
      usdtQueueLength,
      blueCursor,
      usdtCursor,
      minOrderAmount,
      custodyPhysicalBlue,
      custodyPhysicalUsdt,
      custodyReservedBlue,
      custodyReservedUsdt,
      custodyPendingBlue,
      custodyPendingUsdt,
      custodyFeesBlue,
      custodyFeesUsdt,
      custodyLiabilitiesBlue,
      custodyLiabilitiesUsdt,
      custodySolventBlue,
      custodySolventUsdt,
      adapterTotalCollateralReserved,
      treasuryOwner,
      corporateTreasuryWallet,
      currentMerkleRoot,
      rewardEpoch,
      activeSurplusProposal,
      treasuryBlue,
      treasuryRed,
      treasuryLedgerOut,
      treasuryUsdt,
      ledgerNextLotId,
      ledgerEngine,
      ledgerOwner,
      extManagerOwner
    ] = await Promise.all([
      blueContract.totalSupply(),
      redContract.totalSupply(),
      usdtContract.totalSupply(),
      blueContract.decimals(),
      redContract.decimals(),
      usdtContract.decimals(),
      modeContract.mode(),
      modeContract.owner(),
      modeContract.guardian(),
      riskContract.owner(),
      riskContract.riskOperator(),
      protocolConfigContract.activeConfig(),
      protocolConfigContract.pendingConfig(),
      protocolConfigContract.pendingUnlockAt(),
      protocolConfigContract.owner(),
      exchangeConfigContract.feeBps(),
      exchangeConfigContract.treasury(),
      exchangeConfigContract.pendingFeeBps(),
      exchangeConfigContract.feeReadyAt(),
      exchangeConfigContract.pendingTreasury(),
      exchangeConfigContract.treasuryReadyAt(),
      exchangeConfigContract.owner(),
      pairedSupplyContract.owner(),
      pairedSupplyContract.operators(contracts.PaymentEngine),
      usdtContract.balanceOf(contracts.CollateralVaultV6),
      vaultContract.totalCollateral(),
      vaultContract.totalExchangeReserved(),
      vaultContract.solvent(),
      vaultContract.owner(),
      bookContract.nextOrderId(),
      bookContract.nextSequence(),
      bookContract.queueLength(0),
      bookContract.queueLength(1),
      routerContract.blueCursor(),
      routerContract.usdtCursor(),
      routerContract.MIN_ORDER_AMOUNT(),
      blueContract.balanceOf(contracts.ExchangeCustody),
      usdtContract.balanceOf(contracts.ExchangeCustody),
      custodyContract.totalReserved(0),
      custodyContract.totalReserved(1),
      custodyContract.totalPendingRefund(0),
      custodyContract.totalPendingRefund(1),
      custodyContract.accumulatedFees(0),
      custodyContract.accumulatedFees(1),
      custodyContract.liabilities(0),
      custodyContract.liabilities(1),
      custodyContract.solvent(0),
      custodyContract.solvent(1),
      adapterContract.totalCollateralReserved(),
      treasuryContract.owner(),
      treasuryContract.corporateTreasuryWallet(),
      treasuryContract.currentMerkleRoot(),
      treasuryContract.rewardEpoch(),
      treasuryContract.activeSurplusProposal(),
      blueContract.balanceOf(contracts.ProtocolTreasuryV6),
      redContract.balanceOf(contracts.ProtocolTreasuryV6),
      ledgerContract.outstanding(contracts.ProtocolTreasuryV6),
      usdtContract.balanceOf(contracts.ProtocolTreasuryV6),
      ledgerContract.nextLotId(),
      ledgerContract.paymentEngine(),
      ledgerContract.owner(),
      extensionManagerContract.owner()
    ]);

    if (BigInt(blueDecimals) !== 6n || BigInt(redDecimals) !== 6n || BigInt(usdtDecimals) !== 6n) {
      throw new Error('TOKEN_DECIMALS_MISMATCH: BLUE, RED y MockUSDT deben tener exactamente 6 decimales.');
    }

    supplies = {
      blue: BigInt(blueSupplyRaw),
      red: BigInt(redSupplyRaw),
      usdt: BigInt(usdtSupplyRaw)
    };

    // Validar owners y roles críticos contra el manifiesto
    if (getAddress(modeOwner) !== getAddress(manifest.owners.ProtocolModeController)) {
      throw new Error('MANIFEST_OWNER_MISMATCH: ProtocolModeController.owner() no coincide con el manifiesto.');
    }
    if (getAddress(modeGuardian) !== getAddress(manifest.roles.guardian)) {
      throw new Error('MANIFEST_ROLE_MISMATCH: ProtocolModeController.guardian() no coincide con el manifiesto.');
    }
    if (getAddress(riskOperator) !== getAddress(manifest.roles.riskOperator)) {
      throw new Error('MANIFEST_ROLE_MISMATCH: RiskRegistry.riskOperator() no coincide con el manifiesto.');
    }

    registerAddress(corporateTreasuryWallet, 'treasury_corporate_wallet');

    const modeCode = Number(modeRaw);
    governance = {
      modeCode,
      modeName: MODE_NAMES[modeCode] || 'UNKNOWN',
      owners: {
        ProtocolModeController: getAddress(modeOwner),
        RiskRegistry: getAddress(riskOwner),
        ProtocolConfig: getAddress(protocolConfigOwner),
        ExchangeConfig: getAddress(exConfigOwner),
        PairedSupplyController: getAddress(pairedOwner),
        CollateralVaultV6: getAddress(vaultOwner),
        ProtocolTreasuryV6: getAddress(treasuryOwner),
        CommitmentLedger: getAddress(ledgerOwner),
        ExtensionManager: getAddress(extManagerOwner)
      },
      roles: {
        guardian: getAddress(modeGuardian),
        riskOperator: getAddress(riskOperator),
        paymentEnginePairedSupplyOperator: Boolean(engineIsOperator)
      },
      protocolConfig: {
        active: {
          maxPayment: toExactAmount(activeCfg.maxPayment),
          commitmentDurationSeconds: String(activeCfg.commitmentDuration),
          commissionBps: String(activeCfg.commissionBps)
        },
        pending: {
          maxPayment: toExactAmount(pendingCfg.maxPayment),
          commitmentDurationSeconds: String(pendingCfg.commitmentDuration),
          commissionBps: String(pendingCfg.commissionBps),
          unlockAt: String(pendingUnlockAt)
        }
      },
      exchangeConfig: {
        feeBps: String(exFeeBps),
        treasury: getAddress(exTreasury),
        pendingFeeBps: String(exPendingFeeBps),
        feeReadyAt: String(exFeeReadyAt),
        pendingTreasury: normalizeNonZeroAddress(exPendingTreasury),
        treasuryReadyAt: String(exTreasuryReadyAt)
      },
      pairedSupplyController: {
        owner: getAddress(pairedOwner),
        paymentEngineAuthorized: Boolean(engineIsOperator)
      },
      extensionManager: {
        owner: getAddress(extManagerOwner),
        options: []
      }
    };

    // Leer opciones observadas en ExtensionManager
    for (const duration of Array.from(observedExtensionDurations).sort((a, b) => a - b)) {
      const [opt, pendingOpt] = await Promise.all([
        extensionManagerContract.options(duration),
        extensionManagerContract.pendingOptions(duration)
      ]);
      governance.extensionManager.options.push({
        durationSeconds: String(duration),
        active: {
          feeBps: String(opt.feeBps),
          minLevel: Number(opt.minLevel),
          enabled: Boolean(opt.enabled)
        },
        pending: {
          feeBps: String(pendingOpt.option.feeBps),
          minLevel: Number(pendingOpt.option.minLevel),
          enabled: Boolean(pendingOpt.option.enabled),
          unlockAt: String(pendingOpt.unlockAt)
        }
      });
    }

    vaultState = {
      usdtPhysicalBalance: BigInt(vaultUsdtPhysical),
      totalCollateral: BigInt(vaultTotalCollateral),
      totalExchangeReserved: BigInt(vaultTotalExchangeReserved),
      solvent: Boolean(vaultSolvent),
      owner: getAddress(vaultOwner)
    };

    exchangeState = {
      router: {
        blueCursor: BigInt(blueCursor),
        usdtCursor: BigInt(usdtCursor),
        minOrderAmount: BigInt(minOrderAmount)
      },
      book: {
        nextOrderId: BigInt(nextOrderId),
        nextSequence: BigInt(nextSequence),
        blueQueueLength: BigInt(blueQueueLength),
        usdtQueueLength: BigInt(usdtQueueLength)
      },
      custody: {
        physicalBlueBalance: BigInt(custodyPhysicalBlue),
        physicalUsdtBalance: BigInt(custodyPhysicalUsdt),
        totalReservedBlue: BigInt(custodyReservedBlue),
        totalReservedUsdt: BigInt(custodyReservedUsdt),
        totalPendingRefundBlue: BigInt(custodyPendingBlue),
        totalPendingRefundUsdt: BigInt(custodyPendingUsdt),
        accumulatedFeesBlue: BigInt(custodyFeesBlue),
        accumulatedFeesUsdt: BigInt(custodyFeesUsdt),
        liabilitiesBlue: BigInt(custodyLiabilitiesBlue),
        liabilitiesUsdt: BigInt(custodyLiabilitiesUsdt),
        solventBlue: Boolean(custodySolventBlue),
        solventUsdt: Boolean(custodySolventUsdt)
      },
      adapter: {
        totalCollateralReserved: BigInt(adapterTotalCollateralReserved)
      }
    };

    treasuryState = {
      address: contracts.ProtocolTreasuryV6,
      owner: getAddress(treasuryOwner),
      corporateTreasuryWallet: normalizeNonZeroAddress(corporateTreasuryWallet),
      currentMerkleRoot: String(currentMerkleRoot),
      rewardEpoch: BigInt(rewardEpoch).toString(),
      blueBalance: toExactAmount(treasuryBlue),
      redCommitmentBalance: toExactAmount(treasuryRed),
      ledgerOutstanding: toExactAmount(treasuryLedgerOut),
      usdtBalance: toExactAmount(treasuryUsdt),
      activeSurplusProposal: {
        recipient: normalizeNonZeroAddress(activeSurplusProposal.recipient),
        amount: toExactAmount(activeSurplusProposal.amount),
        eta: BigInt(activeSurplusProposal.eta).toString(),
        executed: Boolean(activeSurplusProposal.executed),
        cancelled: Boolean(activeSurplusProposal.cancelled)
      },
      observedBoosterClaims
    };

    ledgerGlobal = {
      nextLotId: BigInt(ledgerNextLotId).toString(),
      paymentEngine: getAddress(ledgerEngine),
      owner: getAddress(ledgerOwner)
    };

    // Descubrir también cualquier lote en CommitmentLedger iterando `1 .. nextLotId - 1`
    // (garantiza que incluso si faltara un evento o para auditoría total, conocemos cada dueño de lote)
    const maxLotId = BigInt(ledgerNextLotId);
    for (let lotId = 1n; lotId < maxLotId; lotId += 1n) {
      const ownerOfLot = normalizeNonZeroAddress(await ledgerContract.lotOwner(lotId));
      if (ownerOfLot) {
        registerAddress(ownerOfLot, 'onchain_commitment_lot_owner');
        if (!commitmentLotsByAccount.has(ownerOfLot)) commitmentLotsByAccount.set(ownerOfLot, new Set());
        commitmentLotsByAccount.get(ownerOfLot).add(lotId);
      }
    }

    // Iterar TODAS las órdenes del libro FIFO (`1 .. nextOrderId - 1`) y su colateralización
    const maxOrderId = BigInt(nextOrderId);
    for (let orderId = 1n; orderId < maxOrderId; orderId += 1n) {
      const [ord, adapterRes, vaultOrdUser, vaultOrdReserved, vaultExisting] = await Promise.all([
        bookContract.order(orderId),
        adapterContract.reservation(orderId),
        vaultContract.orderUser(orderId),
        vaultContract.orderReserved(orderId),
        vaultContract.existingOrder(orderId)
      ]);
      const ordUser = normalizeNonZeroAddress(ord.user);
      if (ordUser) registerAddress(ordUser, 'onchain_fifo_order');

      const statusCode = Number(ord.status);
      const sideCode = Number(ord.side);
      orders.push({
        id: BigInt(ord.id).toString(),
        sequence: BigInt(ord.sequence).toString(),
        user: ordUser,
        sideCode,
        side: ORDER_SIDE_NAMES[sideCode] || 'UNKNOWN',
        statusCode,
        status: ORDER_STATUS_NAMES[statusCode] || 'UNKNOWN',
        createdAt: String(ord.createdAt),
        original: BigInt(ord.original),
        remaining: BigInt(ord.remaining),
        refunded: BigInt(ord.refunded),
        adapterUser: normalizeNonZeroAddress(adapterRes.user),
        adapterReserved: BigInt(adapterRes.remaining),
        vaultOrderUser: normalizeNonZeroAddress(vaultOrdUser),
        vaultOrderReserved: BigInt(vaultOrdReserved),
        vaultExistingOrder: Boolean(vaultExisting)
      });
    }

    globalStateComplete = true;
  } catch (error) {
    globalStateComplete = false;
    // Re-lanzar errores fatales de identidad del manifiesto/decimales
    if (/^(MANIFEST_|TOKEN_DECIMALS_MISMATCH)/.test(error.message)) {
      throw error;
    }
    onchainErrors.push({
      stage: 'global_state_read',
      code: isPrunedHistoryError(error) ? 'RPC_PRUNED_HISTORY_4444' : 'GLOBAL_READ_ERROR',
      message: sanitizeText(error.message)
    });
  }

  // ==========================================================================
  // PASO 7: Inventario detallado por cada titular descubierto en bloque `finalized`
  // ==========================================================================
  let registryVersionDetected = 'unknown';
  let profileUpdateVersionSupported = null;
  const accountsMap = new Map();
  const sortedAddresses = Array.from(discoveredAddressSources.keys()).sort();

  for (const addr of sortedAddresses) {
    try {
      const [
        profile,
        blueBal,
        blueLocked,
        blueAvail,
        parkingHead,
        parkingCount,
        redBal,
        ledgerOut,
        ledgerMat,
        ledgerFirstLot,
        ledgerVer,
        vaultCollat,
        vaultFree,
        vaultUnreserved,
        vaultExReserved,
        vaultAuto,
        pendingRefBlue,
        pendingRefUsdt,
        usdtBal
      ] = await Promise.all([
        riskContract.profile(addr),
        blueContract.balanceOf(addr),
        blueContract.lockedBalanceOf(addr),
        blueContract.availableBalanceOf(addr),
        blueContract.parkingHead(addr),
        blueContract.parkingLotsCount(addr),
        redContract.balanceOf(addr),
        ledgerContract.outstanding(addr),
        ledgerContract.matured(addr),
        ledgerContract.firstLotId(addr),
        ledgerContract.ledgerVersion(addr),
        vaultContract.collateralBalance(addr),
        vaultContract.freeCollateral(addr),
        vaultContract.unreservedCollateral(addr),
        vaultContract.exchangeReserved(addr),
        vaultContract.automaticExchangeCollateral(addr),
        custodyContract.pendingRefund(addr, 0),
        custodyContract.pendingRefund(addr, 1),
        usdtContract.balanceOf(addr)
      ]);

      // Lectura opcional de `profileUpdateVersion` en RiskRegistry:
      // solo degrada a `v6.0_base` si es la primera comprobación y el error es
      // inequívocamente selector ausente / revert (nunca ante timeout, red o 4444).
      let profileUpdateVersion = null;
      if (profileUpdateVersionSupported !== false) {
        try {
          const v = await riskContract.profileUpdateVersion(addr);
          profileUpdateVersion = BigInt(v).toString();
          profileUpdateVersionSupported = true;
          registryVersionDetected = 'v6.1_with_profileUpdateVersion';
        } catch (err) {
          const detail = String(err?.error?.message || err?.info?.error?.message || err?.shortMessage || err?.message || '');
          const isUnsupportedSelector =
            !isPrunedHistoryError(err) &&
            !/timeout|timed out|network|socket|econn|etimedout|502|503|504|rate limit/i.test(detail) &&
            (err?.code === 'CALL_EXCEPTION' || err?.code === 'BAD_DATA' || /execution reverted|selector|function.*not found|unrecognized/i.test(detail));

          if (profileUpdateVersionSupported === null && isUnsupportedSelector) {
            profileUpdateVersionSupported = false;
            registryVersionDetected = 'v6.0_base';
          } else {
            onchainErrors.push({
              stage: 'account_read_risk_version',
              address: addr,
              code: isPrunedHistoryError(err) ? 'RPC_PRUNED_HISTORY_4444' : 'RISK_REGISTRY_VERSION_READ_ERROR',
              message: sanitizeText(err.message)
            });
          }
        }
      }

      // Lectura de nonce en PaymentAuthorization (sin catch silencioso: fallo invalida onchainComplete)
      let paymentAuthNonce = null;
      try {
        const n = await paymentAuthContract.nonces(addr);
        paymentAuthNonce = BigInt(n).toString();
      } catch (err) {
        onchainErrors.push({
          stage: 'account_read_nonce',
          address: addr,
          code: isPrunedHistoryError(err) ? 'RPC_PRUNED_HISTORY_4444' : 'PAYMENT_AUTH_NONCE_ERROR',
          message: sanitizeText(err.message)
        });
      }

      // Lotes activos de parking en BlueTokenV6
      const parkingLots = [];
      const pHead = BigInt(parkingHead);
      const pCount = BigInt(parkingCount);
      for (let i = pHead; i < pCount; i += 1n) {
        const lotInfo = await blueContract.parkingLots(addr, i);
        const remaining = BigInt(lotInfo.remaining);
        const releaseAt = BigInt(lotInfo.releaseAt);
        if (remaining > 0n) {
          parkingLots.push({
            index: i.toString(),
            remaining: toExactAmount(remaining),
            releaseAt: releaseAt.toString(),
            releasedAtBlock: releaseAt <= BigInt(finalizedBlock.timestamp)
          });
        }
      }

      // Lotes activos de compromiso RED en CommitmentLedger
      const lotIds = new Set(commitmentLotsByAccount.get(addr) || []);
      if (BigInt(ledgerFirstLot) > 0n) lotIds.add(BigInt(ledgerFirstLot));
      const commitmentLots = [];
      for (const lotId of Array.from(lotIds).sort((a, b) => (a < b ? -1 : 1))) {
        const lotData = await ledgerContract.lot(addr, lotId);
        if (lotData.active) {
          commitmentLots.push({
            lotId: lotId.toString(),
            dueAt: BigInt(lotData.dueAt).toString(),
            amount: toExactAmount(lotData.amount),
            fee: toExactAmount(lotData.fee),
            margin: toExactAmount(lotData.margin),
            active: true,
            isMaturedAtBlock: BigInt(lotData.dueAt) <= BigInt(finalizedBlock.timestamp)
          });
        }
      }

      accountsMap.set(addr, {
        address: addr,
        sources: Array.from(discoveredAddressSources.get(addr)).sort(),
        riskRegistry: {
          kycVerified: Boolean(profile.kycVerified),
          creditLimit: BigInt(profile.creditLimit),
          level: Number(profile.level),
          profileUpdateVersion
        },
        blue: {
          balance: BigInt(blueBal),
          locked: BigInt(blueLocked),
          available: BigInt(blueAvail),
          parkingHead: pHead.toString(),
          parkingLotsCount: pCount.toString(),
          parkingLots
        },
        red: {
          balance: BigInt(redBal),
          ledgerOutstanding: BigInt(ledgerOut),
          ledgerMatured: BigInt(ledgerMat),
          firstLotId: BigInt(ledgerFirstLot).toString(),
          ledgerVersion: BigInt(ledgerVer).toString(),
          commitmentLots
        },
        vault: {
          collateralBalance: BigInt(vaultCollat),
          freeCollateral: BigInt(vaultFree),
          unreservedCollateral: BigInt(vaultUnreserved),
          exchangeReserved: BigInt(vaultExReserved),
          automaticExchangeCollateral: Boolean(vaultAuto)
        },
        exchangePendingRefund: {
          blue: BigInt(pendingRefBlue),
          usdt: BigInt(pendingRefUsdt)
        },
        usdtBalance: BigInt(usdtBal),
        paymentAuthorizationNonce: paymentAuthNonce
      });
    } catch (error) {
      onchainErrors.push({
        stage: 'account_read',
        address: addr,
        code: isPrunedHistoryError(error) ? 'RPC_PRUNED_HISTORY_4444' : 'ACCOUNT_READ_ERROR',
        message: sanitizeText(error.message)
      });
    }
  }

  // ==========================================================================
  // PASO 8: Re-lectura final del bloque `finalized` para detección de REORG
  // ==========================================================================
  let reorgDetected = false;
  let endBlockHash = null;
  try {
    const verificationBlock = await provider.getBlock(finalizedBlock.number);
    endBlockHash = verificationBlock?.hash || null;
    if (!verificationBlock || verificationBlock.hash !== finalizedBlock.hash) {
      reorgDetected = true;
      onchainErrors.push({
        stage: 'reorg_check',
        code: 'REORG_DETECTED',
        message: `El blockHash del bloque ${finalizedBlock.number} cambió durante la exportación (inicio=${finalizedBlock.hash}, fin=${endBlockHash}).`
      });
    }
  } catch (error) {
    reorgDetected = true;
    onchainErrors.push({
      stage: 'reorg_check',
      code: 'REORG_CHECK_ERROR',
      message: sanitizeText(error.message)
    });
  }

  // ==========================================================================
  // PASO 9: Evaluación de completitud, invariantes y elegibilidad (fail-closed)
  // ==========================================================================
  const onchainComplete = onchainErrors.length === 0 && logStats.paginationComplete && globalStateComplete && !reorgDetected;
  const sqlComplete = !sqlResult.skipped && sqlResult.complete && sqlErrors.length === 0;
  const fullComplete = onchainComplete && sqlComplete;

  const completeness = {
    onchainComplete,
    globalStateComplete,
    sqlComplete,
    sqlSkipped: Boolean(sqlResult.skipped),
    fullComplete,
    reorgDetected
  };

  const invariants = evaluateInvariants({
    supplies,
    accountsMap,
    vaultState,
    exchangeState,
    orders,
    onchainComplete,
    globalStateComplete
  });

  // ==========================================================================
  // PASO 8b (CODEX-205 #3): Escaneo paginado de actividad relevante post-finalized
  // ==========================================================================
  const postFinalizedFrom = finalizedBlock.number + 1;
  const postFinalizedTo = latestBlock.number;
  const hasBlocksAfterFinalized = postFinalizedTo > finalizedBlock.number;
  const postFinalizedEvents = [];
  const postFinalizedScanErrors = [];
  let postFinalizedScanComplete = true;

  if (hasBlocksAfterFinalized) {
    const postScanStats = { rpcLogRequests: 0, subdivisions: 0 };
    for (const contractName of REQUIRED_V6_CONTRACTS) {
      const address = contracts[contractName];
      try {
        const logs = await fetchLogsPaginated(
          provider,
          { address, fromBlock: postFinalizedFrom, toBlock: postFinalizedTo },
          maxLogBlockSpan,
          postScanStats,
          { rpcRequestDelayMs, retryOptions }
        );
        for (const log of logs) {
          postFinalizedEvents.push({
            contract: contractName,
            blockNumber: log.blockNumber ?? null,
            txHash: log.transactionHash || null,
            topic0: Array.isArray(log.topics) && log.topics.length > 0 ? String(log.topics[0]) : null
          });
        }
      } catch (error) {
        postFinalizedScanComplete = false;
        postFinalizedScanErrors.push({
          contract: contractName,
          fromBlock: postFinalizedFrom,
          toBlock: postFinalizedTo,
          code: error.isPruned ? 'RPC_PRUNED_HISTORY_4444' : (error.isReorg ? 'REORG_LOG_REMOVED' : 'POST_FINALIZED_SCAN_ERROR'),
          message: sanitizeText(error.message)
        });
      }
    }
  }

  const activityAfterFinalized = {
    finalizedBlockNumber: finalizedBlock.number,
    latestBlockNumber: latestBlock.number,
    blocksDelta: latestBlock.number - finalizedBlock.number,
    hasBlocksAfterFinalized,
    postFinalizedScanExecuted: hasBlocksAfterFinalized,
    postFinalizedScanComplete,
    relevantEventsCount: postFinalizedEvents.length,
    relevantEvents: postFinalizedEvents,
    postFinalizedScanErrors,
    nonProofNotice: 'La ausencia de eventos en la ventana (finalized + 1 .. latest) NO prueba por sí sola contención de rutas sin eventos; requiere revalidación de modos, permisos y nonces bajo contención externa verificable.'
  };

  const eligibility = evaluateEligibility({
    completeness,
    invariants,
    supplies,
    vaultState,
    exchangeState,
    treasuryState,
    orders,
    governance,
    sqlResult,
    activityAfterFinalized,
    writeContainmentVerified,
    writeContainmentDeclared,
    writeContainmentExternalVerified,
    writeContainmentEvidenceRef
  });

  // ==========================================================================
  // PASO 10: Serialización exacta (solo strings para montos) + sanitización
  // ==========================================================================
  const serializedAccounts = Array.from(accountsMap.values()).map((acc) => ({
    address: acc.address,
    sources: acc.sources,
    riskRegistry: {
      kycVerified: acc.riskRegistry.kycVerified,
      creditLimit: toExactAmount(acc.riskRegistry.creditLimit),
      level: acc.riskRegistry.level,
      profileUpdateVersion: acc.riskRegistry.profileUpdateVersion
    },
    blue: {
      total: toExactAmount(acc.blue.balance),
      locked: toExactAmount(acc.blue.locked),
      available: toExactAmount(acc.blue.available),
      parkingHead: acc.blue.parkingHead,
      parkingLotsCount: acc.blue.parkingLotsCount,
      parkingLots: acc.blue.parkingLots
    },
    redCommitment: {
      tokenBalance: toExactAmount(acc.red.balance),
      ledgerOutstanding: toExactAmount(acc.red.ledgerOutstanding),
      ledgerMatured: toExactAmount(acc.red.ledgerMatured),
      firstLotId: acc.red.firstLotId,
      ledgerVersion: acc.red.ledgerVersion,
      activeLots: acc.red.commitmentLots
    },
    collateralVault: {
      collateralBalance: toExactAmount(acc.vault.collateralBalance),
      freeCollateral: toExactAmount(acc.vault.freeCollateral),
      unreservedCollateral: toExactAmount(acc.vault.unreservedCollateral),
      exchangeReserved: toExactAmount(acc.vault.exchangeReserved),
      automaticExchangeCollateral: acc.vault.automaticExchangeCollateral
    },
    exchangePendingRefund: {
      blue: toExactAmount(acc.exchangePendingRefund.blue),
      usdt: toExactAmount(acc.exchangePendingRefund.usdt)
    },
    mockUsdtBalance: toExactAmount(acc.usdtBalance),
    paymentAuthorizationNonce: acc.paymentAuthorizationNonce
  }));

  const serializedOrders = orders.map((ord) => ({
    id: ord.id,
    sequence: ord.sequence,
    user: ord.user,
    side: ord.side,
    status: ord.status,
    createdAt: ord.createdAt,
    original: toExactAmount(ord.original),
    remaining: toExactAmount(ord.remaining),
    refunded: toExactAmount(ord.refunded),
    collateralization: {
      adapterUser: ord.adapterUser,
      adapterReserved: toExactAmount(ord.adapterReserved),
      vaultOrderUser: ord.vaultOrderUser,
      vaultOrderReserved: toExactAmount(ord.vaultOrderReserved),
      existingOrder: ord.vaultExistingOrder
    }
  }));

  const rawReport = {
    schemaVersion: 'v6-demo-inventory/1.0',
    generatedAt: new Date().toISOString(),
    environment: {
      epoch: DEMO_EPOCH,
      chainId: DEMO_CHAIN_ID_STR,
      readOnly: true
    },
    metadata: {
      manifest: {
        epoch: manifest.epoch,
        chainId: String(manifest.chainId),
        sha256: manifestSha256,
        fingerprint,
        verifiedCodeHashes
      },
      rpc: {
        source: rpcValidation.sanitizedUrl,
        host: rpcValidation.host,
        finalizedBlockNumber: finalizedBlock.number,
        finalizedBlockHash: finalizedBlock.hash,
        finalizedBlockTimestamp: finalizedBlock.timestamp,
        endVerificationBlockHash: endBlockHash,
        latestBlockNumber: latestBlock.number,
        startBlocks,
        logScan: logStats
      },
      registryVersionDetected
    },
    completeness,
    eligibility,
    invariants,
    onchain: {
      supplies: globalStateComplete && supplies ? {
        blue: toExactAmount(supplies.blue),
        redCommitment: toExactAmount(supplies.red),
        mockUsdt: toExactAmount(supplies.usdt)
      } : null,
      commitmentLedger: globalStateComplete ? ledgerGlobal : null,
      governance: globalStateComplete ? governance : null,
      treasury: globalStateComplete ? treasuryState : null,
      collateralVault: globalStateComplete && vaultState ? {
        address: contracts.CollateralVaultV6,
        owner: vaultState.owner,
        usdtPhysicalBalance: toExactAmount(vaultState.usdtPhysicalBalance),
        totalCollateral: toExactAmount(vaultState.totalCollateral),
        totalExchangeReserved: toExactAmount(vaultState.totalExchangeReserved),
        solvent: vaultState.solvent
      } : null,
      exchange: globalStateComplete && exchangeState ? {
        router: {
          address: contracts.ExchangeRouter,
          blueCursor: exchangeState.router.blueCursor.toString(),
          usdtCursor: exchangeState.router.usdtCursor.toString(),
          minOrderAmount: toExactAmount(exchangeState.router.minOrderAmount)
        },
        orderBook: {
          address: contracts.FifoOrderBook,
          nextOrderId: exchangeState.book.nextOrderId.toString(),
          nextSequence: exchangeState.book.nextSequence.toString(),
          blueQueueLength: exchangeState.book.blueQueueLength.toString(),
          usdtQueueLength: exchangeState.book.usdtQueueLength.toString(),
          orders: serializedOrders
        },
        custody: {
          address: contracts.ExchangeCustody,
          physicalBlueBalance: toExactAmount(exchangeState.custody.physicalBlueBalance),
          physicalUsdtBalance: toExactAmount(exchangeState.custody.physicalUsdtBalance),
          totalReservedBlue: toExactAmount(exchangeState.custody.totalReservedBlue),
          totalReservedUsdt: toExactAmount(exchangeState.custody.totalReservedUsdt),
          totalPendingRefundBlue: toExactAmount(exchangeState.custody.totalPendingRefundBlue),
          totalPendingRefundUsdt: toExactAmount(exchangeState.custody.totalPendingRefundUsdt),
          accumulatedFeesBlue: toExactAmount(exchangeState.custody.accumulatedFeesBlue),
          accumulatedFeesUsdt: toExactAmount(exchangeState.custody.accumulatedFeesUsdt),
          liabilitiesBlue: toExactAmount(exchangeState.custody.liabilitiesBlue),
          liabilitiesUsdt: toExactAmount(exchangeState.custody.liabilitiesUsdt),
          solventBlue: exchangeState.custody.solventBlue,
          solventUsdt: exchangeState.custody.solventUsdt
        },
        amortizationAdapter: {
          address: contracts.AmortizationAdapter,
          totalCollateralReserved: toExactAmount(exchangeState.adapter.totalCollateralReserved)
        }
      } : null,
      accountsCount: serializedAccounts.length,
      accounts: serializedAccounts
    },
    sql: sqlResult,
    errors: {
      onchain: onchainErrors,
      sql: sqlErrors
    }
  };

  return deepSanitizeReport(rawReport);
}

module.exports = {
  DEMO_CHAIN_ID,
  DEMO_CHAIN_ID_STR,
  DEMO_EPOCH,
  REQUIRED_V6_CONTRACTS,
  REQUIRED_SQL_TABLES,
  OPTIONAL_SQL_TABLES,
  OPTIONAL_SQL_COLUMNS,
  validateRpcUrlAllowlist,
  validateDatabaseUrlAllowlist,
  sanitizeRpcUrl,
  sanitizeText,
  sanitizeChainOperationRow,
  deepSanitizeReport,
  isPrunedHistoryError,
  isRateLimitError,
  withRateLimitRetry,
  loadAndVerifyV6Manifest,
  createDefaultProvider,
  createPinnedRunner,
  evaluateInvariants,
  evaluateEligibility,
  exportV6DemoInventory
};
