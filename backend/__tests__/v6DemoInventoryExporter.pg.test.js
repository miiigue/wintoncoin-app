'use strict';

/**
 * ============================================================================
 * PRUEBA DE INTEGRACIÓN REAL CONTRA POSTGRESQL 17 AISLADO — D02 / CODEX-206
 * ============================================================================
 * Ejecución habilitada exclusivamente mediante `WINTON_LOCAL_PG_TEST=1` contra
 * el clúster local aislado `v6-pg-isolated` en `127.0.0.1:55471` (usuario `v6test`).
 *
 * Garantías de aislamiento y seguridad:
 * 1. Verifica `SHOW data_directory;` y ABORTA si no pertenece a `v6-pg-isolated`.
 * 2. Crea una base de datos temporal exclusiva (`winton_d02_pg_test_<ts>`) y la
 *    elimina en `afterAll` (nunca modifica el esquema `public` de `postgres`).
 * 3. Valida el esquema SQL real antes de `128..131` (Fase A), después de aplicar
 *    las migraciones reales `128..131` con filas reales y PII sintético (Fase B),
 *    y demuestra que `REPEATABLE READ READ ONLY` rechaza escrituras con `25006`
 *    haciendo rollback limpio (Fase C).
 * 4. Terminología canónica: los saldos RED son compromisos RED.
 * ============================================================================
 */

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { Client } = require('pg');
const { Interface, getAddress, keccak256, toUtf8Bytes } = require('ethers');

const {
  REQUIRED_V6_CONTRACTS,
  exportV6DemoInventory
} = require('../src/services/v6DemoInventoryExporter');
const { LINKS: V6_LINKS } = require('../src/services/validateV6Demo');

const RUN_LOCAL_PG = process.env.WINTON_LOCAL_PG_TEST === '1';
const PG_HOST = '127.0.0.1';
const PG_PORT = 55471;
const PG_USER = 'v6test';
const EXPECTED_DATA_DIR_MARKER = 'v6-pg-isolated';

const MIGRATIONS_128_131_FILES = Object.freeze([
  '128_credit_penalty_episode.js',
  '129_credit_notification_outbox.js',
  '130_credit_referral_episode_awards.js',
  '131_publication_base_precision.js'
]);

/**
 * Resuelve el directorio de las migraciones reales 128..131 sin rutas hardcodeadas:
 * 1. Usa `process.env.WINTON_MIGRATIONS_128_131_DIR` si fue suministrado.
 * 2. En caso contrario, usa `path.resolve(__dirname, '../migrations')`.
 * Lanza error descriptivo si falta alguno de los 4 archivos requeridos.
 */
function resolveMigrations128To131Dir() {
  const envDir = typeof process.env.WINTON_MIGRATIONS_128_131_DIR === 'string'
    ? process.env.WINTON_MIGRATIONS_128_131_DIR.trim()
    : '';
  const targetDir = envDir ? path.resolve(envDir) : path.resolve(__dirname, '../migrations');
  const missing = MIGRATIONS_128_131_FILES.filter((file) => !fs.existsSync(path.join(targetDir, file)));
  if (missing.length > 0) {
    throw new Error(
      `MIGRATIONS_128_131_MISSING: Faltan archivo(s) de migración [${missing.join(', ')}] en "${targetDir}". ` +
      'Si las migraciones 128..131 aún no están en backend/migrations/, defina la variable de entorno ' +
      'WINTON_MIGRATIONS_128_131_DIR apuntando al directorio que contiene 128..131.'
    );
  }
  return targetDir;
}

const DEMO_RPC_URL = 'https://opt-sepolia.g.alchemy.com/v2/SUPER_SECRET_TEST_KEY_987654321';
const OWNER_ADDR = '0x7d2C6c16EDe986a8bea0204A9824b4C264256C77';
const USER_WALLET_1 = '0x1111111111111111111111111111111111111111';
const USER_WALLET_2 = '0x2222222222222222222222222222222222222222';
const CORPORATE_WALLET = '0x3333333333333333333333333333333333333333';
const FINALIZED_BLOCK_NUM = 51540000;
const FINALIZED_BLOCK_HASH = '0x' + 'aa'.repeat(32);

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
 * Construye manifiesto V6 Demo sintético para aislar el lado RPC mientras SQL corre real contra PG17.
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
    const bytecode = '0x60806040' + keccak256(toUtf8Bytes(`V6_PG_TEST_BYTECODE_${name}`)).slice(2);
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
 * Proveedor EVM mock mínimo en estado limpio (PRELAUNCH_FROZEN, supply=0)
 * para enfocar toda la verificación real en las consultas SQL de PostgreSQL 17.
 */
function createCleanMockProvider(fixture) {
  const { manifest, bytecodesByAddress } = fixture;
  const c = manifest.contracts;
  const addrToName = {};
  for (const [name, addr] of Object.entries(c)) {
    addrToName[addr.toLowerCase()] = name;
  }

  const handleCall = (to, data) => {
    const contractName = addrToName[String(to).toLowerCase()];
    const parsed = MOCK_IFACE.parseTransaction({ data });
    const fn = parsed.name;
    const args = parsed.args;
    const encode = (values) => MOCK_IFACE.encodeFunctionResult(parsed.fragment, values);

    if (V6_LINKS[contractName] && Object.prototype.hasOwnProperty.call(V6_LINKS[contractName], fn)) {
      return encode([c[V6_LINKS[contractName][fn]]]);
    }
    if (fn === 'owner' || fn === 'guardian' || fn === 'riskOperator') return encode([OWNER_ADDR]);
    if (fn === 'decimals') return encode([6]);
    if (fn === 'mode') return encode([1]); // PRELAUNCH_FROZEN
    if (fn === 'operators') return encode([getAddress(args[0]) === c.PaymentEngine]);
    if (fn === 'activeConfig') return encode([[1_000_000_000n, 2_592_000n, 500n]]);
    if (fn === 'pendingConfig') return encode([[0n, 0n, 0n]]);
    if (fn === 'pendingUnlockAt' || fn === 'feeReadyAt' || fn === 'treasuryReadyAt' || fn === 'pendingFeeBps') return encode([0n]);
    if (fn === 'feeBps') return encode([100n]);
    if (fn === 'treasury') return encode([c.ProtocolTreasuryV6]);
    if (fn === 'pendingTreasury') return encode(['0x0000000000000000000000000000000000000000']);
    if (fn === 'corporateTreasuryWallet') return encode([CORPORATE_WALLET]);
    if (fn === 'currentMerkleRoot') return encode(['0x' + '00'.repeat(32)]);
    if (fn === 'rewardEpoch') return encode([0n]);
    if (fn === 'activeSurplusProposal') return encode(['0x0000000000000000000000000000000000000000', 0n, 0n, false, false]);
    if (fn === 'totalSupply' || fn === 'balanceOf' || fn === 'lockedBalanceOf' || fn === 'availableBalanceOf') return encode([0n]);
    if (fn === 'parkingHead' || fn === 'parkingLotsCount') return encode([0n]);
    if (fn === 'nextLotId' || fn === 'nextOrderId' || fn === 'nextSequence' || fn === 'ledgerVersion') return encode([1n]);
    if (fn === 'paymentEngine') return encode([c.PaymentEngine]);
    if (fn === 'outstanding' || fn === 'matured' || fn === 'firstLotId') return encode([0n]);
    if (fn === 'profile') return encode([[0n, 0, false]]);
    if (fn === 'isKYCVerified') return encode([false]);
    if (fn === 'profileUpdateVersion') throw new Error('execution reverted: selector not found');
    if (fn === 'totalCollateral' || fn === 'totalExchangeReserved' || fn === 'collateralBalance' || fn === 'freeCollateral' || fn === 'unreservedCollateral' || fn === 'exchangeReserved') return encode([0n]);
    if (fn === 'solvent') return encode([true]);
    if (fn === 'automaticExchangeCollateral') return encode([false]);
    if (fn === 'queueLength' || fn === 'totalReserved' || fn === 'totalPendingRefund' || fn === 'accumulatedFees' || fn === 'liabilities' || fn === 'pendingRefund') return encode([0n]);
    if (fn === 'blueCursor' || fn === 'usdtCursor' || fn === 'totalCollateralReserved' || fn === 'nonces') return encode([0n]);
    if (fn === 'MIN_ORDER_AMOUNT') return encode([1_000_000n]);
    throw new Error(`Llamada RPC mock no manejada: ${contractName}.${fn}`);
  };

  return {
    getNetwork: async () => ({ chainId: 11155420n }),
    getBlock: async (tag) => {
      if (tag === 'finalized' || tag === FINALIZED_BLOCK_NUM || tag === 'latest') {
        return { number: FINALIZED_BLOCK_NUM, hash: FINALIZED_BLOCK_HASH, timestamp: 1790000000 };
      }
      return null;
    },
    getCode: async (addr) => bytecodesByAddress[String(addr).toLowerCase()] || '0x',
    send: async (method, params) => {
      if (method === 'eth_chainId') return '0xaa37dc';
      if (method === 'eth_call') return handleCall(params[0].to, params[0].data);
      throw new Error(`RPC send no soportado: ${method}`);
    },
    call: async (tx) => handleCall(tx.to, tx.data),
    getTransactionReceipt: async () => null,
    getLogs: async () => []
  };
}

/**
 * Crea el esquema base pre-115 tal como lo establece databaseInit.js y aplica
 * las migraciones REALES 053, 115, 116, 117, 119, 120, 121, 122 y 127 del repo.
 */
async function bootstrapSchemaUpTo127(client) {
  await client.query(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255),
      phone_number VARCHAR(50),
      web3_wallet_address VARCHAR(255),
      kyc_verified BOOLEAN NOT NULL DEFAULT FALSE,
      referrer_id INTEGER REFERENCES users(id)
    );

    CREATE TABLE admin_users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL
    );

    CREATE TABLE app_settings (
      id SERIAL PRIMARY KEY,
      setting_key VARCHAR(255) UNIQUE NOT NULL,
      setting_value TEXT NOT NULL,
      description TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE publications (
      id SERIAL PRIMARY KEY,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      blue_cost NUMERIC(20, 2) DEFAULT 0,
      base_blue_cost NUMERIC(20, 2) DEFAULT 0,
      current_amount NUMERIC(20, 2) DEFAULT 0,
      goal_amount NUMERIC(20, 2) DEFAULT 0
    );

    CREATE TABLE publication_acceptances (
      id SERIAL PRIMARY KEY,
      publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
      acceptor_username VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending_approval',
      blue_cost NUMERIC(20, 2) DEFAULT 0,
      form_responses JSONB,
      evidence_urls JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE transactions (
      id SERIAL PRIMARY KEY,
      blue_change NUMERIC(20, 2),
      red_change NUMERIC(20, 2),
      platform_fee_blue NUMERIC(20, 2)
    );

    CREATE TABLE platform_commission_log (
      id SERIAL PRIMARY KEY,
      commission_amount_blue NUMERIC(20, 2)
    );
  `);

  // Ejecutar las migraciones reales del repositorio en orden estricto
  const repoMigrations = [
    '053_web3_financial_architecture.js',
    '115_wallet_identity_credit_override.js',
    '116_durable_chain_operations.js',
    '117_payment_recovery_controls.js',
    '119_credit_policy_exponential_backoff.js',
    '120_credit_recovery_post_mora.js',
    '121_recoverable_accounts.js',
    '122_publication_payment_time.js',
    '127_exchange_indexer_v6.js'
  ];

  for (const file of repoMigrations) {
    const mod = require(path.resolve(__dirname, '../migrations', file));
    await client.query('BEGIN');
    try {
      await mod.up(client);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Fallo aplicando migración ${file}: ${err.message}`);
    }
  }
}

const describePg = RUN_LOCAL_PG ? describe : describe.skip;

describePg('v6DemoInventoryExporter — Integración REAL contra PostgreSQL 17 aislado (CODEX-206)', () => {
  const fixture = buildTestManifest();
  const tempDbName = `winton_d02_pg_test_${Date.now()}`;
  const adminUrl = `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/postgres`;
  const tempDbUrl = `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${tempDbName}`;
  let isolationVerified = false;
  let tempDbCreated = false;

  beforeAll(async () => {
    const adminClient = new Client({ connectionString: adminUrl });
    await adminClient.connect();
    try {
      // Guarda obligatoria de aislamiento: verificar data_directory del clúster
      const dirRes = await adminClient.query('SHOW data_directory');
      const dataDirectory = String(dirRes.rows?.[0]?.data_directory || '');
      if (!dataDirectory.toLowerCase().includes(EXPECTED_DATA_DIR_MARKER)) {
        throw new Error(
          `ISOLATION_ABORT: data_directory ("${dataDirectory}") no pertenece al clúster aislado "${EXPECTED_DATA_DIR_MARKER}".`
        );
      }
      isolationVerified = true;

      // Crear base de datos temporal exclusiva (nunca tocar esquema public de postgres)
      await adminClient.query(`CREATE DATABASE "${tempDbName}"`);
      tempDbCreated = true;
    } finally {
      await adminClient.end();
    }

    // Construir esquema real hasta migración 127
    const setupClient = new Client({ connectionString: tempDbUrl });
    await setupClient.connect();
    try {
      await bootstrapSchemaUpTo127(setupClient);
    } finally {
      await setupClient.end();
    }
  }, 30_000);

  afterAll(async () => {
    // Nunca intentar limpieza ni tocar el servidor si falló la guarda de aislamiento o no se creó la BD temporal
    if (!isolationVerified || !tempDbCreated) {
      return;
    }
    const adminClient = new Client({ connectionString: adminUrl });
    try {
      await adminClient.connect();
      await adminClient.query(`DROP DATABASE IF EXISTS "${tempDbName}" WITH (FORCE)`);
    } finally {
      await adminClient.end().catch(() => {});
    }
  }, 20_000);

  test('Fase A: BD PostgreSQL 17 real con esquema hasta 127 (sin 128..131) completa sqlComplete=true y reporta 128..131 ausentes', async () => {
    const provider = createCleanMockProvider(fixture);

    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: tempDbUrl,
      allowLocalSql: true,
      allowedDbHosts: [PG_HOST],
      allowedDbNames: [tempDbName],
      providerFactory: () => provider,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    expect(report.errors.sql).toEqual([]);
    expect(report.completeness.sqlComplete).toBe(true);
    expect(report.completeness.fullComplete).toBe(true);
    expect(report.sql.databaseNameObserved).toBe(tempDbName);
    expect(report.sql.schema.missingRequiredTables).toEqual([]);

    const opt = report.sql.schema.optionalMigrations;
    expect(opt['128_credit_penalty_episode'].present).toBe(false);
    expect(opt['129_credit_notification_outbox'].present).toBe(false);
    expect(opt['130_credit_referral_episode_awards'].present).toBe(false);
    expect(opt['131_publication_base_precision'].present).toBe(false);
    expect(opt['131_publication_base_precision'].columns['publications.base_blue_cost'].isNumeric30_6).toBe(false);
    expect(opt['131_publication_base_precision'].columns['publications.goal_amount'].isNumeric30_6).toBe(false);

    expect(report.sql.moraEpisodes).toEqual([]);
    expect(report.sql.creditNotificationOutbox.tablePresent).toBe(false);
    expect(report.sql.creditReferralAwards.tablePresent).toBe(false);
  }, 30_000);

  test('Fase B: Aplica migraciones REALES 128..131, inserta filas reales con PII sintético y verifica extracción exacta sin PII', async () => {
    const migrations128To131Dir = resolveMigrations128To131Dir();

    const seedClient = new Client({ connectionString: tempDbUrl });
    await seedClient.connect();
    try {
      // Aplicar migraciones reales 128..131
      for (const file of MIGRATIONS_128_131_FILES) {
        const mod = require(path.join(migrations128To131Dir, file));
        await seedClient.query('BEGIN');
        try {
          await mod.up(seedClient);
          await seedClient.query('COMMIT');
        } catch (err) {
          await seedClient.query('ROLLBACK');
          throw new Error(`Fallo aplicando migración real ${file}: ${err.message}`);
        }
      }

      // 1. Insertar usuarios reales (uno en mora con 128/130 y PII ficticio para verificar 0 PII)
      const u1 = await seedClient.query(
        `INSERT INTO users (
           username, email, phone_number, web3_wallet_address, kyc_verified,
           mora_episode_base_limit, mora_episode_started_at, mora_episode_earned_base,
           mora_episode_referral_base, mora_episode_target_base, mora_episode_bonus_applied
         ) VALUES (
           'usuario_mora_privado', 'mora.privado@example.com', '+5491144445555', $1, TRUE,
           100.000000, NOW(), 100.000000, 15.250000, 150.000000, 5.000000
         ) RETURNING id`,
        [USER_WALLET_1]
      );
      const userId1 = u1.rows[0].id;

      const u2 = await seedClient.query(
        `INSERT INTO users (username, email, phone_number, web3_wallet_address, kyc_verified, referrer_id)
         VALUES ('aceptador_privado_uno', 'aceptador1@example.com', '+5491166667777', $1, TRUE, $2)
         RETURNING id`,
        [USER_WALLET_2, userId1]
      );
      const userId2 = u2.rows[0].id;

      const u3 = await seedClient.query(
        `INSERT INTO users (username, email, phone_number, web3_wallet_address, kyc_verified, referrer_id)
         VALUES ('referido_baseline_privado', 'baseline@example.com', '+5491188889999', NULL, TRUE, $1)
         RETURNING id`,
        [userId1]
      );
      const userId3 = u3.rows[0].id;

      // 2. Insertar chain_operations pendiente con rawSignedTx/calldata ficticio
      const opIdPending = '00000000-0000-4000-8000-000000000101';
      await seedClient.query(
        `INSERT INTO chain_operations (
           id, user_id, request_key, chain_id, sender, resource_key, kind, payload, state, steps
         ) VALUES (
           $1, $2, 'req-d02-pg-1', '11155420', $3, 'credit:policy:1', 'credit_policy',
           $4::jsonb, 'pending', $5::jsonb
         )`,
        [
          opIdPending,
          userId1,
          USER_WALLET_1.toLowerCase(),
          JSON.stringify({
            to: fixture.manifest.contracts.RiskRegistry,
            nonce: 9,
            calldata: '0xdeadbeefcafebabe0011223344556677'
          }),
          JSON.stringify([{
            label: 'setProfile',
            nonce: 9,
            to: fixture.manifest.contracts.RiskRegistry,
            hash: '0x' + '11'.repeat(32),
            rawSignedTx: '0x02f87082aa36a780843b9aca00deadbeef00112233445566778899aabbccddeeff'
          }])
        ]
      );

      // 3. Insertar credit_policy_versions + 3 credit_policy_issues (dead_letter, open, resolved)
      const verRes = await seedClient.query(
        `INSERT INTO credit_policy_versions (settings, actor_id) VALUES ('{"red_credit_base_limit":"100"}'::jsonb, $1) RETURNING id`,
        [userId1]
      );
      const versionId = verRes.rows[0].id;

      await seedClient.query(
        `INSERT INTO credit_policy_issues (version_id, user_id, operation_id, reason, status, retry_count, max_retries, last_error)
         VALUES
           ($1, $2, $5, 'MAX_RETRIES_EXHAUSTED', 'dead_letter', 5, 5, 'Error RPC https://opt-sepolia.g.alchemy.com/v2/secretKeyPg1'),
           ($1, $3, NULL, 'TRANSIENT_NONCE', 'open', 1, 5, NULL),
           ($1, $4, NULL, 'ALREADY_SYNCED', 'resolved', 1, 5, NULL)`,
        [versionId, userId1, userId2, userId3, opIdPending]
      );

      // 4. Insertar publication con precisión 6 decimales (131) + web3_escrow_holds activo
      const pubRes = await seedClient.query(
        `INSERT INTO publications (author_id, status, blue_cost, base_blue_cost, current_amount, goal_amount)
         VALUES ($1, 'active', 12.962962, 12.345678, 5.000000, 50.123456)
         RETURNING id`,
        [userId1]
      );
      const pubId = pubRes.rows[0].id;

      await seedClient.query(
        `INSERT INTO web3_escrow_holds (publication_id, author_id, responsible_user_id, amount_locked, commission_rate_locked, status)
         VALUES ($1, $2, $3, 12.96, 5.00, 'locked')`,
        [pubId, userId1, userId2]
      );

      // 5. Insertar 3 publication_acceptances pendientes (paginación real con sqlPageSize=2) + 1 confirmed_paid
      //    con PII sintético en acceptor_username, form_responses y evidence_urls
      await seedClient.query(
        `INSERT INTO publication_acceptances (publication_id, acceptor_username, status, blue_cost, form_responses, evidence_urls)
         VALUES
           ($1, 'aceptador_privado_uno', 'pending_approval', 12.345678, '{"dni":"99887766","correo":"form1@example.com"}'::jsonb, '["https://priv.local/evidencia1.jpg"]'::jsonb),
           ($1, 'aceptador_privado_uno', 'approved', 20.000001, '{"telefono":"+5491100001111"}'::jsonb, '["https://priv.local/evidencia2.jpg"]'::jsonb),
           ($1, 'usuario_mora_privado', 'completed', 30.654321, '{"nota":"secreta"}'::jsonb, '["https://priv.local/evidencia3.jpg"]'::jsonb),
           ($1, 'aceptador_privado_uno', 'confirmed_paid', 99.000000, NULL, NULL)`,
        [pubId]
      );

      // 6. Insertar credit_notification_outbox (129) pendiente con payload conteniendo PII ficticio
      await seedClient.query(
        `INSERT INTO credit_notification_outbox (
           operation_id, user_id, confirmed_limit, tx_hash, block_hash, payload, status, attempts, last_error
         ) VALUES (
           $1, $2, 100.000000, $3, $4,
           '{"email":"payload.outbox@example.com","phone":"+5491122223333"}'::jsonb,
           'pending', 2, 'Error entrega a payload.outbox@example.com'
         )`,
        [opIdPending, userId1, '0x' + '22'.repeat(32), '0x' + '33'.repeat(32)]
      );

      // 7. Insertar credit_referral_awards (130): 1 baseline=TRUE y 1 baseline=FALSE
      await seedClient.query(
        `INSERT INTO credit_referral_awards (referred_user_id, referrer_user_id, amount, baseline)
         VALUES
           ($1, $3, 0.000000, TRUE),
           ($2, $3, 15.250000, FALSE)`,
        [userId3, userId2, userId1]
      );
    } finally {
      await seedClient.end();
    }

    // Ejecutar exportV6DemoInventory REAL contra PostgreSQL 17 con sqlPageSize=2 para forzar paginación real
    const provider = createCleanMockProvider(fixture);
    const report = await exportV6DemoInventory({
      rpcUrl: DEMO_RPC_URL,
      databaseUrl: tempDbUrl,
      allowLocalSql: true,
      allowedDbHosts: [PG_HOST],
      allowedDbNames: [tempDbName],
      sqlPageSize: 2,
      writeContainmentVerified: true,
      providerFactory: () => provider,
      manifestOverride: fixture.manifestRaw,
      expectedManifestSha256: fixture.manifestSha256
    });

    // Verificar completitud y detección de migraciones 128..131
    expect(report.errors.sql).toEqual([]);
    expect(report.completeness.sqlComplete).toBe(true);
    expect(report.completeness.fullComplete).toBe(true);

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

    // Verificar episodios de mora en users (128/130)
    expect(report.sql.moraEpisodes).toHaveLength(1);
    expect(report.sql.moraEpisodes[0]).toMatchObject({
      moraEpisodeBaseLimit: '100.000000',
      moraEpisodeEarnedBase: '100.000000',
      moraEpisodeReferralBase: '15.250000',
      moraEpisodeTargetBase: '150.000000',
      moraEpisodeBonusApplied: '5.000000'
    });
    expect(report.sql.moraEpisodes[0].moraEpisodeStartedAt).toBeTruthy();

    // Verificar credit_policy_issues (dead_letter + open, excluye resolved)
    expect(report.sql.policy.creditPolicyIssuesCountsByStatus).toEqual({
      dead_letter: '1',
      open: '1',
      resolved: '1'
    });
    expect(report.sql.policy.openCreditPolicyIssues).toHaveLength(2);
    const dlqIssue = report.sql.policy.openCreditPolicyIssues.find((i) => i.status === 'dead_letter');
    expect(dlqIssue).toBeDefined();
    expect(dlqIssue.retryCount).toBe(5);
    expect(dlqIssue.maxRetries).toBe(5);
    expect(dlqIssue.lastError).not.toContain('secretKeyPg1');

    // Verificar publications con precisión exacta de 6 decimales (131) + escrow activo
    expect(report.sql.publicationsActive).toHaveLength(1);
    expect(report.sql.publicationsActive[0]).toMatchObject({
      status: 'active',
      baseBlueCost: '12.345678',
      goalAmount: '50.123456'
    });
    expect(report.sql.escrowHoldsActive).toHaveLength(1);

    // Verificar publication_acceptances paginadas en >1 página (3 filas con sqlPageSize=2), sin PII
    expect(report.sql.publicationAcceptancesCountsByStatus).toEqual({
      pending_approval: '1',
      approved: '1',
      completed: '1',
      confirmed_paid: '1'
    });
    expect(report.sql.publicationAcceptancesPending).toHaveLength(3);
    expect(report.sql.publicationAcceptancesPending.map((a) => a.blueCost)).toEqual([
      '12.345678',
      '20.000001',
      '30.654321'
    ]);
    for (const acc of report.sql.publicationAcceptancesPending) {
      expect(typeof acc.acceptorUserId).toBe('number');
      expect(acc.acceptor_username).toBeUndefined();
      expect(acc.form_responses).toBeUndefined();
      expect(acc.evidence_urls).toBeUndefined();
    }

    // Verificar credit_notification_outbox (129) sin payload crudo
    expect(report.sql.creditNotificationOutbox.tablePresent).toBe(true);
    expect(report.sql.creditNotificationOutbox.countsByStatus).toEqual({ pending: '1' });
    expect(report.sql.creditNotificationOutbox.pendingItems).toHaveLength(1);
    expect(report.sql.creditNotificationOutbox.pendingItems[0].confirmedLimit).toBe('100.000000');
    expect(report.sql.creditNotificationOutbox.pendingItems[0].lastError).toContain('[REDACTED_EMAIL]');

    // Verificar credit_referral_awards (130)
    expect(report.sql.creditReferralAwards.tablePresent).toBe(true);
    expect(report.sql.creditReferralAwards.countsByBaseline).toEqual({ baseline: '1', active: '1' });
    expect(report.sql.creditReferralAwards.activeAwards).toHaveLength(1);
    expect(report.sql.creditReferralAwards.activeAwards[0].amount).toBe('15.250000');

    // Verificar chain_operations sanitizado
    expect(report.sql.chainOperations.activeOperations).toHaveLength(1);
    expect(report.sql.chainOperations.activeOperations[0].nonce).toBe('9');

    // Verificar bloqueo de Ruta A por cada causa SQL real
    expect(report.eligibility.routeAEligible).toBe(false);
    expect(report.eligibility.routeABlockingReasons.some((r) => /dead_letter/.test(r))).toBe(true);
    expect(report.eligibility.routeABlockingReasons.some((r) => /publication_acceptances/.test(r))).toBe(true);
    expect(report.eligibility.routeABlockingReasons.some((r) => /credit_notification_outbox/.test(r))).toBe(true);

    // Defensa en profundidad: CERO PII, CERO secretos, CERO rawSignedTx/calldata en el JSON completo
    const serialized = JSON.stringify(report);
    const forbiddenStrings = [
      'mora.privado@example.com',
      '+5491144445555',
      'aceptador1@example.com',
      '+5491166667777',
      'baseline@example.com',
      'usuario_mora_privado',
      'aceptador_privado_uno',
      'referido_baseline_privado',
      '99887766',
      'form1@example.com',
      'evidencia1.jpg',
      'payload.outbox@example.com',
      '+5491122223333',
      'secretKeyPg1',
      'SUPER_SECRET_TEST_KEY_987654321',
      '0xdeadbeefcafebabe0011223344556677',
      '0x02f87082aa36a780843b9aca00',
      'rawSignedTx',
      'calldata',
      'acceptor_username',
      'form_responses',
      'evidence_urls'
    ];
    for (const secretOrPii of forbiddenStrings) {
      expect(serialized).not.toContain(secretOrPii);
    }
  }, 30_000);

  test('Fase C: Transacción REPEATABLE READ READ ONLY rechaza escrituras en PostgreSQL 17 con código 25006 y hace rollback limpio', async () => {
    const roClient = new Client({ connectionString: tempDbUrl });
    await roClient.connect();
    try {
      const beforeRes = await roClient.query('SELECT COUNT(*)::text AS total FROM app_settings');
      const beforeCount = beforeRes.rows[0].total;

      await roClient.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      let caughtError = null;
      try {
        await roClient.query(
          "INSERT INTO app_settings (setting_key, setting_value) VALUES ('forbidden_ro_write', '1')"
        );
      } catch (err) {
        caughtError = err;
      } finally {
        await roClient.query('ROLLBACK');
      }

      // PostgreSQL error code 25006 = read_only_sql_transaction
      expect(caughtError).not.toBeNull();
      expect(caughtError.code).toBe('25006');

      const afterRes = await roClient.query('SELECT COUNT(*)::text AS total FROM app_settings');
      expect(afterRes.rows[0].total).toBe(beforeCount);
    } finally {
      await roClient.end();
    }
  }, 15_000);
});
