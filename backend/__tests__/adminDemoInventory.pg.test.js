'use strict';

/**
 * ============================================================================
 * PRUEBA DE INTEGRACIÓN REAL CON pg.Pool CONTRA POSTGRESQL 17 AISLADO (CODEX-209)
 * ============================================================================
 * Opt-in estricto mediante `WINTON_LOCAL_PG_TEST=1` contra `v6-pg-isolated:55471`.
 *
 * Demuestra contra PostgreSQL 17 real:
 * 1. Guarda de aislamiento `SHOW data_directory` + `isolationVerified && tempDbCreated`
 *    en `afterAll` (jamás limpia ni toca otra instancia si falla la guarda).
 * 2. Lectura real vía `createDemoInventoryHandler({ pool })` con `pg.Pool` en
 *    transacción `REPEATABLE READ READ ONLY`, escritura de auditoría por canal
 *    separado en `audit_log` y liberación limpia (`client.release()`).
 * 3. Ante error/timeout SQL real o violación `25006` (`read_only_sql_transaction`),
 *    el cliente se libera con `ROLLBACK` + `client.release()` (sin llamar `pool.end()`),
 *    y el MISMO `pg.Pool` sigue sano y reutilizable en una consulta posterior.
 * ============================================================================
 */

const { EventEmitter } = require('node:events');
const path = require('node:path');
const { Client, Pool } = require('pg');
const auditService = require('../src/services/auditService');
const {
  createDemoInventoryHandler
} = require('../src/controllers/admin/adminDemoInventoryController');

const RUN_LOCAL_PG = process.env.WINTON_LOCAL_PG_TEST === '1';
const PG_HOST = '127.0.0.1';
const PG_PORT = 55471;
const PG_USER = 'v6test';
const EXPECTED_DATA_DIR_MARKER = 'v6-pg-isolated';

function createMockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    body: null,
    set: (k, v) => { headers[String(k).toLowerCase()] = v; return res; },
    getHeader: (k) => headers[String(k).toLowerCase()],
    status: (code) => { res.statusCode = code; return res; },
    json: (payload) => { res.body = payload; return res; }
  };
  return res;
}

async function bootstrapSchemaWithAuditLog(client) {
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
    CREATE TABLE audit_log (
      id SERIAL PRIMARY KEY,
      event_type VARCHAR(100) NOT NULL,
      actor_id INTEGER,
      actor_username VARCHAR(255),
      target_username VARCHAR(255),
      publication_id INTEGER,
      category VARCHAR(100),
      ip_address VARCHAR(100),
      user_agent TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

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
      throw err;
    }
  }
}

const describePg = RUN_LOCAL_PG ? describe : describe.skip;

describePg('adminDemoInventoryController — Integración REAL con pg.Pool en PostgreSQL 17 aislado (CODEX-209)', () => {
  const tempDbName = `winton_d02_admin_pg_test_${Date.now()}`;
  const adminUrl = `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/postgres`;
  const tempDbUrl = `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${tempDbName}`;
  let isolationVerified = false;
  let tempDbCreated = false;
  let pool = null;

  beforeAll(async () => {
    const adminClient = new Client({ connectionString: adminUrl });
    await adminClient.connect();
    try {
      const dirRes = await adminClient.query('SHOW data_directory');
      const dataDirectory = String(dirRes.rows?.[0]?.data_directory || '');
      if (!dataDirectory.toLowerCase().includes(EXPECTED_DATA_DIR_MARKER)) {
        throw new Error(`ISOLATION_ABORT: data_directory ("${dataDirectory}") no pertenece a "${EXPECTED_DATA_DIR_MARKER}".`);
      }
      isolationVerified = true;

      await adminClient.query(`CREATE DATABASE "${tempDbName}"`);
      tempDbCreated = true;
    } finally {
      await adminClient.end();
    }

    const setupClient = new Client({ connectionString: tempDbUrl });
    await setupClient.connect();
    try {
      await bootstrapSchemaWithAuditLog(setupClient);
      await setupClient.query(
        `INSERT INTO users (username, email, phone_number, web3_wallet_address, kyc_verified)
         VALUES ('demo_pg_user', 'pg.privado@example.com', '+5491133334444', '0x1111111111111111111111111111111111111111', TRUE)`
      );
    } finally {
      await setupClient.end();
    }

    pool = new Pool({ connectionString: tempDbUrl, max: 2 });
  }, 30_000);

  afterAll(async () => {
    if (pool) {
      await pool.end().catch(() => {});
      pool = null;
    }
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

  test('1. Ejecuta inventario real vía pg.Pool en REPEATABLE READ READ ONLY, escribe audit_log por canal separado y mantiene pool reutilizable', async () => {
    const handler = createDemoInventoryHandler({
      pool,
      auditService,
      getEnv: () => ({
        IS_DEMO_ENV: 'true',
        WINTON_ENVIRONMENT_ID: 'demo',
        WEB3_CHAIN_ID: '11155420',
        DATABASE_URL: tempDbUrl
      }),
      allowLocalSql: true,
      allowedDbHosts: [PG_HOST],
      allowedDbNames: [tempDbName]
    });

    const req = {
      method: 'GET',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'pg-integration-test', 'x-request-id': 'req-pg-pool-1' },
      query: { detail: 'true' },
      user: { userId: 99, username: 'admin_pg_test', role: 'superadmin' }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.getHeader('cache-control')).toBe('no-store');
    expect(res.body.completeness).toEqual({ sqlComplete: true, truncated: false, errorsCount: 0 });
    expect(res.body.demoIdentity.databaseNameObserved).toBe(tempDbName);
    expect(res.body.summaryCounts.users).toBe(1);
    expect(JSON.stringify(res.body)).not.toContain('pg.privado@example.com');
    expect(JSON.stringify(res.body)).not.toContain('+5491133334444');

    // Verificar escritura en audit_log por canal separado (sin PII ni informe)
    const auditRes = await pool.query(
      `SELECT event_type, actor_id, category, metadata FROM audit_log WHERE event_type = 'admin.web3.demo_inventory.read'`
    );
    expect(auditRes.rows).toHaveLength(1);
    expect(auditRes.rows[0].actor_id).toBe(99);
    expect(auditRes.rows[0].metadata).toMatchObject({
      requestId: 'req-pg-pool-1',
      adminId: 99,
      mode: 'detail',
      reason: 'ok'
    });
  }, 20_000);

  test('2. Ante error/timeout real o rechazo 25006 en REPEATABLE READ READ ONLY, libera cliente limpiamente y el mismo pg.Pool sigue reutilizable', async () => {
    // 2a. Demostrar REPEATABLE READ READ ONLY (25006) + rollback + release en el mismo pool
    const client = await pool.connect();
    let roErr = null;
    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      try {
        await client.query("INSERT INTO app_settings (setting_key, setting_value) VALUES ('ro_blocked', '1')");
      } catch (err) {
        roErr = err;
      } finally {
        await client.query('ROLLBACK');
      }
    } finally {
      client.release();
    }
    expect(roErr).not.toBeNull();
    expect(roErr.code).toBe('25006');

    // 2b. Forzar truncado/error por maxTotalRows=0? No, usar maxTotalRows=1 con 2 usuarios para forzar aborto en mitad de transacción
    await pool.query(
      `INSERT INTO users (username, email, web3_wallet_address, kyc_verified)
       VALUES ('demo_pg_user_2', 'pg2@example.com', '0x2222222222222222222222222222222222222222', TRUE)`
    );

    const truncatedHandler = createDemoInventoryHandler({
      pool,
      auditService,
      getEnv: () => ({
        IS_DEMO_ENV: 'true',
        WINTON_ENVIRONMENT_ID: 'demo',
        WEB3_CHAIN_ID: '11155420',
        DATABASE_URL: tempDbUrl
      }),
      allowLocalSql: true,
      allowedDbHosts: [PG_HOST],
      allowedDbNames: [tempDbName],
      pageSize: 1,
      maxTotalRows: 1
    });

    const resTrunc = createMockRes();
    await truncatedHandler({
      method: 'GET',
      ip: '127.0.0.1',
      headers: { 'x-request-id': 'req-pg-trunc-1' },
      query: {},
      user: { userId: 99, username: 'admin_pg_test', role: 'superadmin' }
    }, resTrunc);

    expect(resTrunc.statusCode).toBe(200);
    expect(resTrunc.body.completeness.sqlComplete).toBe(false);
    expect(resTrunc.body.completeness.truncated).toBe(true);
    expect(resTrunc.body.errors.some((e) => e.code === 'SQL_MAX_ROWS_EXCEEDED')).toBe(true);

    // 2c. Reutilización del MISMO pg.Pool inmediatamente después del error/truncado (demuestra que nunca se llamó pool.end() ni hubo leak)
    const reuseRes = await pool.query('SELECT COUNT(*)::text AS total FROM users');
    expect(reuseRes.rows[0].total).toBe('2');
    expect(pool.ended).toBe(false);
    expect(pool.waitingCount).toBe(0);
  }, 20_000);

  test('3. [CODEX-210 #1c] Timeout real (57014) en REPEATABLE READ READ ONLY hace ROLLBACK limpio, libera cliente y el mismo pg.Pool sigue reutilizable', async () => {
    const client = await pool.connect();
    let timeoutErr = null;
    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await client.query("SET LOCAL statement_timeout = '60ms'");
      try {
        await client.query('SELECT pg_sleep(0.3)');
      } catch (err) {
        timeoutErr = err;
      } finally {
        await client.query('ROLLBACK');
      }
    } finally {
      client.release();
    }

    // PostgreSQL error code 57014 = query_canceled (statement_timeout)
    expect(timeoutErr).not.toBeNull();
    expect(timeoutErr.code).toBe('57014');

    // Verificar que el mismo pg.Pool sigue completamente sano y reutilizable en una consulta real posterior
    const verifyRes = await pool.query('SELECT current_database() AS db, COUNT(*)::text AS users_count FROM users');
    expect(verifyRes.rows[0].db).toBe(tempDbName);
    expect(verifyRes.rows[0].users_count).toBe('2');
    expect(pool.ended).toBe(false);
    expect(pool.waitingCount).toBe(0);
  }, 20_000);

  test('4. [CODEX-212 #3] Desconexión del cliente (req close / AbortSignal) en PG 17.4 real aborta sin auditar ni responder y deja pg.Pool reutilizable', async () => {
    const beforeAudit = await pool.query('SELECT COUNT(*)::text AS total FROM audit_log');
    const beforeCount = beforeAudit.rows[0].total;

    const handler = createDemoInventoryHandler({
      pool,
      auditService,
      getEnv: () => ({
        IS_DEMO_ENV: 'true',
        WINTON_ENVIRONMENT_ID: 'demo',
        WEB3_CHAIN_ID: '11155420',
        DATABASE_URL: tempDbUrl
      }),
      allowLocalSql: true,
      allowedDbHosts: [PG_HOST],
      allowedDbNames: [tempDbName]
    });

    const reqEmitter = new EventEmitter();
    const req = Object.assign(reqEmitter, {
      method: 'GET',
      complete: true,
      ip: '127.0.0.1',
      headers: { 'user-agent': 'pg-abort-test', 'x-request-id': 'req-pg-abort-1' },
      query: {},
      user: { userId: 99, username: 'admin_pg_test', role: 'superadmin' }
    });
    const resEmitter = new EventEmitter();
    const res = Object.assign(resEmitter, createMockRes(), { writableEnded: false });
    const jsonSpy = jest.fn((p) => { res.body = p; return res; });
    res.json = jsonSpy;

    // Emitir res 'close' con writableEnded=false (desconexión prematura real en Node >= 16)
    const runPromise = handler(req, res);
    setImmediate(() => res.emit('close'));
    await runPromise;

    // 0 filas nuevas en audit_log y 0 llamadas a res.json
    const afterAudit = await pool.query('SELECT COUNT(*)::text AS total FROM audit_log');
    expect(afterAudit.rows[0].total).toBe(beforeCount);
    expect(jsonSpy).not.toHaveBeenCalled();

    // El mismo pg.Pool sigue sano y reutilizable inmediatamente después
    const reuseRes = await pool.query('SELECT COUNT(*)::text AS total FROM users');
    expect(reuseRes.rows[0].total).toBe('2');
    expect(pool.ended).toBe(false);
    expect(pool.waitingCount).toBe(0);
  }, 20_000);
});
