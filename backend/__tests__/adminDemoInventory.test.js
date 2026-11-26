'use strict';

/**
 * ============================================================================
 * SUITE DE PRUEBAS UNITARIAS — ENDPOINT ADMIN DEMO INVENTORY (CODEX-209)
 * ============================================================================
 * Cubre todos los criterios de aceptación de CODEX-209:
 * 1. Auth real (`adminSession.verifySession`): 401 sin cookie, 401 con sesión
 *    revocada (account_status / pwdVersion), Cache-Control: no-store siempre.
 * 2. Guardas pre-pool fuera de Demo (IS_DEMO_ENV, chainId, DATABASE_URL):
 *    403 con 0 llamadas a pool.connect() y 0 llamadas a auditService.
 * 3. Cero parámetros arbitrarios de destino (400 con 0 llamadas al pool).
 * 4. Singleflight en proceso rechazando escaneo concurrente con 409.
 * 5. Truncado por maxTotalRows y maxExecutionMs devolviendo incomplete.
 * 6. Modo summary vs detail + sanitización profunda de datos anidados (0 PII).
 * 7. Escritura de metadatos de auditoría por canal separado (sin informe/PII).
 * 8. Rate-limit demoInventoryLimiter (máx. 6 req/min con Cache-Control: no-store).
 * ============================================================================
 */

const { EventEmitter } = require('node:events');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const realAuditService = require('../src/services/auditService');
const {
  REQUIRED_SQL_TABLES,
  collectSqlDemoInventory,
  validateDatabaseUrlAllowlist
} = require('../src/services/v6DemoInventoryExporter');
const {
  createDemoInventoryHandler
} = require('../src/controllers/admin/adminDemoInventoryController');
const { demoInventoryLimiter } = require('../src/middleware/rateLimiters');

const DEMO_DB_URL = 'postgresql://demo_ro:UltraSecretPass99!@wintoncoin-demo-db.render.internal:5432/wintoncoin_demo_db';
const PROD_DB_URL = 'postgresql://prod_user:ProdSecret99!@wintoncoin-prod-db.render.internal:5432/wintoncoin_prod';
const USER_WALLET = '0x1111111111111111111111111111111111111111';

function createMockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    body: null,
    locals: {},
    set: jest.fn((k, v) => { headers[String(k).toLowerCase()] = v; return res; }),
    setHeader: jest.fn((k, v) => { headers[String(k).toLowerCase()] = v; }),
    getHeader: (k) => headers[String(k).toLowerCase()],
    status: jest.fn((code) => { res.statusCode = code; return res; }),
    json: jest.fn((payload) => { res.body = payload; return res; }),
    send: jest.fn((payload) => { res.body = payload; return res; }),
    _headers: headers
  };
  return res;
}

function createMockReq(overrides = {}) {
  return {
    method: 'GET',
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest-test', 'x-request-id': 'req-test-001' },
    query: {},
    cookies: {},
    user: { userId: 42, username: 'admin_demo', role: 'superadmin' },
    ...overrides
  };
}

/**
 * Crea un mock de pg.Pool que rastrea connect(), release(), end() y las consultas ejecutadas.
 */
function createMockPool(cfg = {}) {
  const state = {
    currentDatabase: 'wintoncoin_demo_db',
    users: [
      {
        id: 1,
        web3_wallet_address: USER_WALLET,
        kyc_verified: true,
        email: 'secreto.usuario@example.com',
        phone: '+5491155551234'
      }
    ],
    publicationsActive: [],
    publicationAcceptances: [],
    creditPolicyIssues: [],
    chainOpsActive: [],
    delayMs: 0,
    ...cfg
  };

  let connectCalls = 0;
  let releaseCalls = 0;
  let endCalls = 0;
  const queries = [];

  const pool = {
    getStats: () => ({ connectCalls, releaseCalls, endCalls, queries }),
    end: jest.fn(async () => { endCalls += 1; }),
    query: jest.fn(async (sql, params) => {
      queries.push({ source: 'pool', sql: String(sql).replace(/\s+/g, ' ').trim(), params });
      return { rows: [] };
    }),
    connect: jest.fn(async () => {
      connectCalls += 1;
      let released = false;
      const client = {
        query: async (sql, params = []) => {
          if (state.delayMs > 0) {
            await new Promise((r) => setTimeout(r, state.delayMs));
          }
          const normalized = String(sql).replace(/\s+/g, ' ').trim();
          queries.push({ source: 'client', sql: normalized, params });

          if (/^(BEGIN|SET LOCAL|COMMIT|ROLLBACK)/i.test(normalized)) return { rows: [] };
          if (/SELECT current_database\(\)/i.test(normalized)) return { rows: [{ db: state.currentDatabase }] };
          if (/FROM information_schema\.tables/i.test(normalized)) {
            return { rows: REQUIRED_SQL_TABLES.map((table_name) => ({ table_name })) };
          }
          if (/FROM information_schema\.columns/i.test(normalized)) {
            return {
              rows: [
                { table_name: 'users', column_name: 'id', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
                { table_name: 'users', column_name: 'web3_wallet_address', data_type: 'text', numeric_precision: null, numeric_scale: null },
                { table_name: 'users', column_name: 'kyc_verified', data_type: 'boolean', numeric_precision: null, numeric_scale: null },
                { table_name: 'publications', column_name: 'id', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
                { table_name: 'publications', column_name: 'author_id', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
                { table_name: 'publications', column_name: 'status', data_type: 'varchar', numeric_precision: null, numeric_scale: null },
                { table_name: 'publications', column_name: 'blue_cost', data_type: 'numeric', numeric_precision: 30, numeric_scale: 6 },
                { table_name: 'publication_acceptances', column_name: 'id', data_type: 'integer', numeric_precision: 32, numeric_scale: 0 },
                { table_name: 'publication_acceptances', column_name: 'blue_cost', data_type: 'numeric', numeric_precision: 30, numeric_scale: 6 }
              ]
            };
          }
          if (/FROM users WHERE id > \$1/i.test(normalized)) {
            const lastId = Number(params[0] || 0);
            const limit = Number(params[1] || 500);
            return { rows: state.users.filter((u) => u.id > lastId).slice(0, limit) };
          }
          if (/SELECT status, COUNT\(\*\)::text AS total FROM credit_policy_issues/i.test(normalized)) {
            const map = new Map();
            for (const i of state.creditPolicyIssues) map.set(i.status, (map.get(i.status) || 0) + 1);
            return { rows: Array.from(map.entries()).map(([status, total]) => ({ status, total: String(total) })) };
          }
          if (/FROM credit_policy_issues/i.test(normalized)) {
            const limit = Number(params[0] || 500);
            const offset = Number(params[1] || 0);
            return {
              rows: state.creditPolicyIssues
                .filter((i) => !['resolved', 'completed', 'closed'].includes(i.status))
                .slice(offset, offset + limit)
            };
          }
          if (/FROM publications/i.test(normalized)) {
            const lastId = Number(params[0] || 0);
            const limit = Number(params[1] || 500);
            return { rows: state.publicationsActive.filter((p) => p.id > lastId).slice(0, limit) };
          }
          if (/SELECT status, COUNT\(\*\)::text AS total FROM publication_acceptances/i.test(normalized)) {
            return { rows: [] };
          }
          if (/FROM publication_acceptances pa/i.test(normalized)) {
            const lastId = Number(params[0] || 0);
            const limit = Number(params[1] || 500);
            return { rows: state.publicationAcceptances.filter((a) => a.id > lastId).slice(0, limit) };
          }
          if (/FROM chain_operations WHERE state IN/i.test(normalized)) {
            const limit = Number(params[0] || 500);
            const offset = Number(params[1] || 0);
            return { rows: state.chainOpsActive.slice(offset, offset + limit) };
          }
          return { rows: [] };
        },
        release: jest.fn(() => {
          if (released) throw new Error('DOUBLE_RELEASE_DETECTED');
          released = true;
          releaseCalls += 1;
        })
      };
      return client;
    })
  };

  return pool;
}

describe('GET /api/admin/web3/demo-inventory — Seguridad y Contrato (CODEX-209)', () => {
  const demoEnv = {
    IS_DEMO_ENV: 'true',
    WINTON_ENVIRONMENT_ID: 'demo',
    WEB3_CHAIN_ID: '11155420',
    DATABASE_URL: DEMO_DB_URL
  };

  test('1. Autenticación real (adminSession.verifySession): 401 sin token, 401 sesión revocada y Cache-Control: no-store', async () => {
    const db = require('../src/config/db');
    const { verifySession } = require('../src/middleware/adminSession');

    const origAdminSecret = process.env.ADMIN_SECRET_KEY;
    const origJwtSecret = process.env.JWT_SECRET;
    process.env.ADMIN_SECRET_KEY = 'admin_secret_independent_key_test';
    process.env.JWT_SECRET = 'user_jwt_different_secret_test';

    const querySpy = jest.spyOn(db, 'query');
    try {
      // 1a. Sin cookie admin_token -> 401 + Cache-Control: no-store
      const reqNoToken = createMockReq({ cookies: {} });
      const resNoToken = createMockRes();
      const nextFn = jest.fn();
      await verifySession(reqNoToken, resNoToken, nextFn);
      expect(resNoToken.statusCode).toBe(401);
      expect(resNoToken.getHeader('cache-control')).toBe('no-store');
      expect(nextFn).not.toHaveBeenCalled();

      // 1b. Token firmado pero sesión revocada (pwdVersion no coincide con password_hash actual) -> 401
      const revokedToken = jwt.sign(
        { userId: 7, role: 'admin', pwdVersion: 'OLDHASH999' },
        process.env.ADMIN_SECRET_KEY,
        { algorithm: 'HS256', expiresIn: '1h' }
      );
      querySpy.mockResolvedValueOnce({
        rows: [{
          id: 7,
          username: 'admin_revoked',
          role: 'admin',
          account_status: 'active',
          password_hash: 'bcrypt$hash$NEWHASH111'
        }]
      });
      const reqRevoked = createMockReq({ cookies: { admin_token: revokedToken } });
      const resRevoked = createMockRes();
      await verifySession(reqRevoked, resRevoked, nextFn);
      expect(resRevoked.statusCode).toBe(401);
      expect(resRevoked.getHeader('cache-control')).toBe('no-store');
      expect(nextFn).not.toHaveBeenCalled();

      // 1c. Cuenta suspendida -> 401
      const suspendedToken = jwt.sign(
        { userId: 8, role: 'admin', pwdVersion: 'NEWHASH111' },
        process.env.ADMIN_SECRET_KEY,
        { algorithm: 'HS256', expiresIn: '1h' }
      );
      querySpy.mockResolvedValueOnce({
        rows: [{
          id: 8,
          username: 'admin_suspended',
          role: 'admin',
          account_status: 'suspended',
          password_hash: 'bcrypt$hash$NEWHASH111'
        }]
      });
      const reqSuspended = createMockReq({ cookies: { admin_token: suspendedToken } });
      const resSuspended = createMockRes();
      await verifySession(reqSuspended, resSuspended, nextFn);
      expect(resSuspended.statusCode).toBe(401);
      expect(resSuspended.getHeader('cache-control')).toBe('no-store');
    } finally {
      querySpy.mockRestore();
      if (origAdminSecret === undefined) delete process.env.ADMIN_SECRET_KEY;
      else process.env.ADMIN_SECRET_KEY = origAdminSecret;
      if (origJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = origJwtSecret;
    }
  });

  test('2. Rechaza pre-pool (403) fuera de Demo / chainId distinto / DB producción con 0 llamadas a pool.connect() y 0 a auditService', async () => {
    const cases = [
      { IS_DEMO_ENV: 'false', WINTON_ENVIRONMENT_ID: 'production', WEB3_CHAIN_ID: '11155420', DATABASE_URL: DEMO_DB_URL },
      { IS_DEMO_ENV: 'true', WINTON_ENVIRONMENT_ID: 'demo', WEB3_CHAIN_ID: '10', DATABASE_URL: DEMO_DB_URL },
      { IS_DEMO_ENV: 'true', WINTON_ENVIRONMENT_ID: 'demo', WEB3_CHAIN_ID: '11155420', DATABASE_URL: PROD_DB_URL }
    ];

    for (const badEnv of cases) {
      const pool = createMockPool();
      const auditService = { logAuditEvent: jest.fn() };
      const handler = createDemoInventoryHandler({
        pool,
        auditService,
        getEnv: () => badEnv
      });
      const req = createMockReq();
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.getHeader('cache-control')).toBe('no-store');
      expect(pool.connect).not.toHaveBeenCalled();
      expect(auditService.logAuditEvent).not.toHaveBeenCalled();
      expect(JSON.stringify(res.body)).not.toContain('ProdSecret99!');
    }
  });

  test('3. Rechaza con 400 parámetros arbitrarios de destino (databaseUrl/host/sql/detail inválido) sin tocar el pool', async () => {
    const pool = createMockPool();
    const auditService = { logAuditEvent: jest.fn() };
    const handler = createDemoInventoryHandler({ pool, auditService, getEnv: () => demoEnv });

    const badQueries = [
      { databaseUrl: PROD_DB_URL },
      { host: 'evil.internal', detail: 'false' },
      { sql: 'SELECT 1' },
      { detail: 'yes' }
    ];

    for (const query of badQueries) {
      const req = createMockReq({ query });
      const res = createMockRes();
      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.getHeader('cache-control')).toBe('no-store');
      expect(res.body.code).toBe('INVALID_QUERY_PARAMS');
    }
    expect(pool.connect).not.toHaveBeenCalled();
    expect(auditService.logAuditEvent).not.toHaveBeenCalled();
  });

  test('4. Singleflight en proceso: rechaza escaneo concurrente con 409 sin abrir segunda conexión al pool', async () => {
    const pool = createMockPool({ delayMs: 25 });
    const auditService = { logAuditEvent: jest.fn().mockResolvedValue({ recorded: true }) };
    const handler = createDemoInventoryHandler({ pool, auditService, getEnv: () => demoEnv });

    const req1 = createMockReq({ headers: { 'x-request-id': 'req-sf-1' } });
    const res1 = createMockRes();
    const req2 = createMockReq({ headers: { 'x-request-id': 'req-sf-2' } });
    const res2 = createMockRes();

    const p1 = handler(req1, res1);
    const p2 = handler(req2, res2);
    await Promise.all([p1, p2]);

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(409);
    expect(res2.body.code).toBe('DEMO_INVENTORY_SCAN_IN_PROGRESS');
    expect(res2.getHeader('cache-control')).toBe('no-store');
    // 1 conexión de lectura READ ONLY + 1 conexión dedicada de auditoría para req1 (0 para req2 rechazada)
    expect(pool.getStats().connectCalls).toBe(2);
    expect(pool.getStats().releaseCalls).toBe(2);
    expect(pool.getStats().endCalls).toBe(0);
  });

  test('5. Truncado por maxTotalRows y por maxExecutionMs marca sqlComplete=false, truncated=true y nunca reporta apto', async () => {
    const manyUsers = Array.from({ length: 5 }, (_, idx) => ({
      id: idx + 1,
      web3_wallet_address: USER_WALLET,
      kyc_verified: true
    }));

    // 5a. Exceso de filas (maxTotalRows = 3)
    const poolRows = createMockPool({ users: manyUsers });
    const auditRows = { logAuditEvent: jest.fn().mockResolvedValue({ recorded: true }) };
    const handlerRows = createDemoInventoryHandler({
      pool: poolRows,
      auditService: auditRows,
      getEnv: () => demoEnv,
      pageSize: 2,
      maxTotalRows: 3
    });
    const resRows = createMockRes();
    await handlerRows(createMockReq(), resRows);

    expect(resRows.statusCode).toBe(200);
    expect(resRows.getHeader('cache-control')).toBe('no-store');
    expect(resRows.body.completeness.sqlComplete).toBe(false);
    expect(resRows.body.completeness.truncated).toBe(true);
    expect(resRows.body.completeness.errorsCount).toBeGreaterThanOrEqual(1);
    expect(resRows.body.errors.some((e) => e.code === 'SQL_MAX_ROWS_EXCEEDED')).toBe(true);
    expect(resRows.body.sqlPreservationAndReconciliation.required).toBe(true);
    expect(poolRows.getStats().releaseCalls).toBe(poolRows.getStats().connectCalls);
    expect(poolRows.getStats().endCalls).toBe(0);

    // 5b. Exceso de tiempo global (maxExecutionMs = 5 con delayMs = 15)
    const poolTime = createMockPool({ users: manyUsers, delayMs: 15 });
    const auditTime = { logAuditEvent: jest.fn().mockResolvedValue({ recorded: true }) };
    const handlerTime = createDemoInventoryHandler({
      pool: poolTime,
      auditService: auditTime,
      getEnv: () => demoEnv,
      pageSize: 2,
      maxExecutionMs: 5
    });
    const resTime = createMockRes();
    await handlerTime(createMockReq(), resTime);

    expect(resTime.statusCode).toBe(200);
    expect(resTime.body.completeness.sqlComplete).toBe(false);
    expect(resTime.body.completeness.truncated).toBe(true);
    expect(resTime.body.errors.some((e) => e.code === 'SQL_MAX_EXECUTION_TIME_EXCEEDED')).toBe(true);
    expect(poolTime.getStats().releaseCalls).toBe(poolTime.getStats().connectCalls);
    expect(poolTime.getStats().endCalls).toBe(0);
  });

  test('6. Modo summary vs detail, sanitización profunda de datos anidados y llamada separada a auditService', async () => {
    const pool = createMockPool({
      creditPolicyIssues: [{
        version_id: '5',
        user_id: 1,
        operation_id: null,
        reason: 'SYNC_FAIL con email fuga@example.com',
        status: 'dead_letter',
        retry_requested: false,
        updated_at: new Date('2026-11-25T10:00:00Z')
      }],
      chainOpsActive: [{
        id: '00000000-0000-4000-8000-000000000099',
        user_id: 1,
        chain_id: '11155420',
        sender: USER_WALLET.toLowerCase(),
        resource_key: 'payment:nested',
        kind: 'marketplace',
        state: 'pending',
        error_code: null,
        payload: {
          to: USER_WALLET,
          nonce: 3,
          calldata: '0xdeadbeef001122334455',
          nestedSecret: { rawSignedTx: '0x02f87082aa36a780843b9aca00', email: 'nested@example.com' }
        },
        steps: [{
          label: 'processPayment',
          nonce: 3,
          to: USER_WALLET,
          hash: '0x' + 'ab'.repeat(32),
          rawSignedTx: '0x02f87082aa36a780843b9aca00'
        }],
        created_at: new Date('2026-11-25T10:00:00Z'),
        updated_at: new Date('2026-11-25T10:01:00Z')
      }]
    });
    const auditService = { logAuditEvent: jest.fn().mockResolvedValue({ recorded: true }) };
    const handler = createDemoInventoryHandler({ pool, auditService, getEnv: () => demoEnv });

    // 6a. Modo summary (default)
    const resSummary = createMockRes();
    await handler(createMockReq({ query: {} }), resSummary);

    expect(resSummary.statusCode).toBe(200);
    expect(resSummary.getHeader('cache-control')).toBe('no-store');
    expect(resSummary.body.mode).toBe('summary');
    expect(resSummary.body.detail).toBeUndefined();
    expect(resSummary.body.auditRecorded).toBe(true);
    expect(resSummary.body.demoIdentity).toEqual({
      chainId: '11155420',
      epoch: 'V6_DEMO',
      databaseNameObserved: 'wintoncoin_demo_db'
    });
    expect(resSummary.body.summaryCounts.users).toBe(1);
    expect(resSummary.body.summaryCounts.deadLetterCount).toBe(1);
    expect(resSummary.body.summaryCounts.chainOpsActive).toBe(1);
    expect(resSummary.body.atomicityNotice).toMatch(/NO equivale a routeAEligible/);

    // 6b. Modo detail (?detail=true)
    const resDetail = createMockRes();
    await handler(createMockReq({ query: { detail: 'true' }, headers: { 'x-request-id': 'req-detail-1' } }), resDetail);

    expect(resDetail.statusCode).toBe(200);
    expect(resDetail.body.mode).toBe('detail');
    expect(resDetail.body.auditRecorded).toBe(true);
    expect(resDetail.body.detail).toBeDefined();
    expect(resDetail.body.detail.linkableAdminDataNotice).toMatch(/datos vinculables/);
    expect(resDetail.body.detail.openCreditPolicyIssues).toHaveLength(1);
    expect(resDetail.body.detail.chainOperationsActive).toHaveLength(1);

    // Sanitización profunda: cero PII ni secretos
    const serialized = JSON.stringify(resDetail.body);
    expect(serialized).not.toContain('UltraSecretPass99!');
    expect(serialized).not.toContain('secreto.usuario@example.com');
    expect(serialized).not.toContain('+5491155551234');
    expect(serialized).not.toContain('fuga@example.com');
    expect(serialized).not.toContain('nested@example.com');
    expect(serialized).not.toContain('0xdeadbeef001122334455');
    expect(serialized).not.toContain('0x02f87082aa36a780843b9aca00');
    expect(serialized).not.toContain('rawSignedTx');
    expect(serialized).not.toContain('calldata');

    // Auditoría por canal separado: llamada con cliente dedicado (fuera de transacción READ ONLY) y sin informe/PII
    expect(auditService.logAuditEvent).toHaveBeenCalledTimes(2);
    const [auditClientArg, , auditPayload] = auditService.logAuditEvent.mock.calls[1];
    expect(typeof auditClientArg.query).toBe('function');
    expect(typeof auditClientArg.release).toBe('function');
    expect(auditPayload.eventType).toBe('admin.web3.demo_inventory.read');
    expect(auditPayload.metadata).toEqual({
      requestId: 'req-detail-1',
      adminId: 42,
      mode: 'detail',
      completeness: { sqlComplete: true, truncated: false, errorsCount: 0 },
      reason: 'ok'
    });
    expect(JSON.stringify(auditPayload)).not.toContain('secreto.usuario@example.com');
    expect(pool.getStats().releaseCalls).toBe(pool.getStats().connectCalls);
    expect(pool.getStats().endCalls).toBe(0);
  });

  test('7. demoInventoryLimiter limita a 6 req/min y devuelve 429 con Cache-Control: no-store en la 7ª solicitud', async () => {
    const next = jest.fn();
    for (let i = 0; i < 6; i += 1) {
      const req = {
        ip: '10.20.30.40',
        headers: {},
        app: { get: () => false }
      };
      const res = createMockRes();
      await new Promise((resolve) => {
        demoInventoryLimiter(req, res, () => {
          next();
          resolve();
        });
      });
    }
    expect(next).toHaveBeenCalledTimes(6);

    const req7 = {
      ip: '10.20.30.40',
      headers: {},
      app: { get: () => false }
    };
    const res7 = createMockRes();
    await new Promise((resolve) => {
      res7.json.mockImplementation((payload) => {
        res7.body = payload;
        resolve();
        return res7;
      });
      demoInventoryLimiter(req7, res7, () => resolve());
    });
    expect(res7.statusCode).toBe(429);
    expect(res7.getHeader('cache-control')).toBe('no-store');
    expect(res7.body.code).toBe('DEMO_INVENTORY_RATE_LIMITED');
  });

  test('8. [AG-06 Alto] Ante SQL_IDENTITY_REJECTED (current_database() != Demo) responde 403 con Cache-Control: no-store y 0 llamadas a auditService/escrituras', async () => {
    const pool = createMockPool({ currentDatabase: 'wintoncoin_prod' });
    const auditService = { logAuditEvent: jest.fn() };
    const handler = createDemoInventoryHandler({
      pool,
      auditService,
      getEnv: () => demoEnv
    });

    const req = createMockReq({ headers: { 'x-request-id': 'req-identity-reject-1' } });
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.getHeader('cache-control')).toBe('no-store');
    expect(res.body.code).toBe('DEMO_DATABASE_IDENTITY_REJECTED');
    expect(auditService.logAuditEvent).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.getStats().releaseCalls).toBe(1);
    expect(pool.getStats().endCalls).toBe(0);
  });

  test('9. [CODEX-210 #1a] Pool saturado: pool.connect() supera maxExecutionMs, libera lateClient al resolver tarde y NO audita', async () => {
    let resolveLateConnect;
    const lateClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    const saturatedPool = {
      connect: jest.fn(() => new Promise((resolve) => { resolveLateConnect = resolve; })),
      query: jest.fn(),
      end: jest.fn()
    };
    const auditService = { logAuditEvent: jest.fn() };
    const handler = createDemoInventoryHandler({
      pool: saturatedPool,
      auditService,
      getEnv: () => demoEnv,
      maxExecutionMs: 30
    });

    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.completeness.sqlComplete).toBe(false);
    expect(res.body.completeness.truncated).toBe(true);
    expect(res.body.errors.some((e) => e.code === 'SQL_MAX_EXECUTION_TIME_EXCEEDED')).toBe(true);
    expect(res.body.auditRecorded).toBe(false);
    // Identidad no confirmada -> 0 escrituras de auditoría
    expect(auditService.logAuditEvent).not.toHaveBeenCalled();

    // Resolver tarde el pool.connect(): debe liberar inmediatamente lateClient sin dejar huérfanos
    resolveLateConnect(lateClient);
    await new Promise((r) => setTimeout(r, 15));
    expect(lateClient.release).toHaveBeenCalledTimes(1);
    expect(lateClient.query).not.toHaveBeenCalled();
  });

  test('10. [CODEX-210 #1b] Consultas lentas sucesivas ajustan SET LOCAL statement_timeout al tiempo restante y abortan al vencer deadline', async () => {
    const pool = createMockPool({ delayMs: 25 });
    const auditService = { logAuditEvent: jest.fn().mockResolvedValue(undefined) };
    const handler = createDemoInventoryHandler({
      pool,
      auditService,
      getEnv: () => demoEnv,
      maxExecutionMs: 85
    });

    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.completeness.sqlComplete).toBe(false);
    expect(res.body.completeness.truncated).toBe(true);
    expect(res.body.errors.some((e) => e.code === 'SQL_MAX_EXECUTION_TIME_EXCEEDED')).toBe(true);
    const timeoutQueries = pool.getStats().queries.filter((q) => /SET LOCAL statement_timeout/i.test(q.sql));
    expect(timeoutQueries.length).toBeGreaterThanOrEqual(2);
    expect(pool.getStats().releaseCalls).toBe(pool.getStats().connectCalls);
    expect(pool.getStats().endCalls).toBe(0);
  });

  test('11. [CODEX-210 #2a/#2b] Presupuesto maxTotalRows cubre credit_policy_issues y chain_operations sin materializar de más', async () => {
    // 11a. 1 usuario + 6 credit_policy_issues con maxTotalRows=4 -> truncado en credit_policy_issues
    const manyIssues = Array.from({ length: 6 }, (_, idx) => ({
      version_id: '10',
      user_id: idx + 1,
      operation_id: null,
      reason: `ERR_${idx}`,
      status: 'dead_letter',
      retry_requested: false,
      updated_at: new Date('2026-11-25T10:00:00Z')
    }));
    const poolIssues = createMockPool({ creditPolicyIssues: manyIssues });
    const handlerIssues = createDemoInventoryHandler({
      pool: poolIssues,
      auditService: { logAuditEvent: jest.fn().mockResolvedValue(undefined) },
      getEnv: () => demoEnv,
      pageSize: 2,
      maxTotalRows: 4
    });
    const resIssues = createMockRes();
    await handlerIssues(createMockReq(), resIssues);

    expect(resIssues.statusCode).toBe(200);
    expect(resIssues.body.completeness.sqlComplete).toBe(false);
    expect(resIssues.body.completeness.truncated).toBe(true);
    expect(resIssues.body.errors.some((e) => e.code === 'SQL_MAX_ROWS_EXCEEDED')).toBe(true);
    expect(resIssues.body.summaryCounts.creditPolicyIssuesUnresolved).toBeLessThanOrEqual(3);

    // 11b. 1 usuario + 5 chain_operations con payload grande y maxTotalRows=3 -> aborta ANTES de materializar el resto
    const hugeOps = Array.from({ length: 5 }, (_, idx) => ({
      id: `00000000-0000-4000-8000-00000000000${idx + 1}`,
      user_id: 1,
      chain_id: '11155420',
      sender: USER_WALLET.toLowerCase(),
      resource_key: `op:${idx}`,
      kind: 'marketplace',
      state: 'pending',
      error_code: null,
      payload: { to: USER_WALLET, nonce: idx, blob: 'X'.repeat(50_000) },
      steps: [],
      created_at: new Date('2026-11-25T10:00:00Z'),
      updated_at: new Date('2026-11-25T10:00:00Z')
    }));
    const poolOps = createMockPool({ chainOpsActive: hugeOps });
    const handlerOps = createDemoInventoryHandler({
      pool: poolOps,
      auditService: { logAuditEvent: jest.fn().mockResolvedValue(undefined) },
      getEnv: () => demoEnv,
      pageSize: 2,
      maxTotalRows: 3
    });
    const resOps = createMockRes();
    await handlerOps(createMockReq(), resOps);

    expect(resOps.statusCode).toBe(200);
    expect(resOps.body.completeness.sqlComplete).toBe(false);
    expect(resOps.body.completeness.truncated).toBe(true);
    expect(resOps.body.errors.some((e) => e.code === 'SQL_MAX_ROWS_EXCEEDED')).toBe(true);
    expect(resOps.body.summaryCounts.chainOpsActive).toBeLessThanOrEqual(2);
  });

  test('12. [CODEX-210 #2c] Exceder maxReportBytes omite detail, marca sqlComplete=false/truncated=true y acota textos largos', async () => {
    const longReason = 'A'.repeat(2000);
    const pool = createMockPool({
      creditPolicyIssues: [{
        version_id: '9',
        user_id: 1,
        operation_id: null,
        reason: longReason,
        status: 'open',
        retry_requested: false,
        updated_at: new Date('2026-11-25T10:00:00Z')
      }]
    });
    const auditService = { logAuditEvent: jest.fn().mockResolvedValue(undefined) };

    // 12a. maxTextLength acota textos largos en modo detail
    const handlerText = createDemoInventoryHandler({
      pool,
      auditService,
      getEnv: () => demoEnv,
      maxTextLength: 64
    });
    const resText = createMockRes();
    await handlerText(createMockReq({ query: { detail: 'true' } }), resText);
    expect(resText.statusCode).toBe(200);
    expect(resText.body.detail.openCreditPolicyIssues[0].reason.length).toBeLessThanOrEqual(80);
    expect(resText.body.detail.openCreditPolicyIssues[0].reason).toContain('...[TRUNCATED]');

    // 12b. maxReportBytes acotado (suficiente para summary sin detail) omite detail y marca sqlComplete=false/truncated=true
    const handlerBytes = createDemoInventoryHandler({
      pool,
      auditService,
      getEnv: () => demoEnv,
      maxReportBytes: 2600
    });
    const resBytes = createMockRes();
    await handlerBytes(createMockReq({ query: { detail: 'true' } }), resBytes);
    expect(resBytes.statusCode).toBe(200);
    expect(Buffer.byteLength(JSON.stringify(resBytes.body), 'utf8')).toBeLessThanOrEqual(2600);
    expect(resBytes.body.detail).toBeUndefined();
    expect(resBytes.body.completeness.sqlComplete).toBe(false);
    expect(resBytes.body.completeness.truncated).toBe(true);
    expect(resBytes.body.errors.some((e) => e.code === 'SQL_REPORT_SIZE_EXCEEDED')).toBe(true);
    expect(resBytes.body.sqlPreservationAndReconciliation.required).toBe(true);
  });

  test('13. [CODEX-210 #3] Sin auditoría si falla BEGIN, chainId sin fallback silencioso, requestId seguro y auditRecorded honesto', async () => {
    // 13a. Fallo en BEGIN (antes de current_database) -> 0 llamadas a auditService y auditRecorded=false
    const failBeginPool = {
      connect: jest.fn(async () => ({
        query: jest.fn(async (sql) => {
          if (/^BEGIN/i.test(sql)) throw new Error('connection terminated unexpectedly');
          return { rows: [] };
        }),
        release: jest.fn()
      })),
      query: jest.fn(),
      end: jest.fn()
    };
    const auditBegin = { logAuditEvent: jest.fn() };
    const handlerBegin = createDemoInventoryHandler({
      pool: failBeginPool,
      auditService: auditBegin,
      getEnv: () => demoEnv
    });
    const resBegin = createMockRes();
    await handlerBegin(createMockReq(), resBegin);
    expect(resBegin.statusCode).toBe(200);
    expect(resBegin.body.completeness.sqlComplete).toBe(false);
    expect(resBegin.body.auditRecorded).toBe(false);
    expect(auditBegin.logAuditEvent).not.toHaveBeenCalled();

    // 13b. Sin chainId explícito o con conflicto entre variables -> 403 fail-closed (sin fallback silencioso)
    const noChainPool = createMockPool();
    const handlerNoChain = createDemoInventoryHandler({
      pool: noChainPool,
      auditService: { logAuditEvent: jest.fn() },
      getEnv: () => ({ IS_DEMO_ENV: 'true', WINTON_ENVIRONMENT_ID: 'demo', DATABASE_URL: DEMO_DB_URL })
    });
    const resNoChain = createMockRes();
    await handlerNoChain(createMockReq(), resNoChain);
    expect(resNoChain.statusCode).toBe(403);
    expect(resNoChain.body.code).toBe('DEMO_CHAIN_ID_NOT_CONFIGURED');
    expect(noChainPool.connect).not.toHaveBeenCalled();

    const conflictHandler = createDemoInventoryHandler({
      pool: noChainPool,
      auditService: { logAuditEvent: jest.fn() },
      getEnv: () => ({
        IS_DEMO_ENV: 'true',
        WINTON_ENVIRONMENT_ID: 'demo',
        WEB3_CHAIN_ID: '11155420',
        CHAIN_ID: '10',
        DATABASE_URL: DEMO_DB_URL
      })
    });
    const resConflict = createMockRes();
    await conflictHandler(createMockReq(), resConflict);
    expect(resConflict.statusCode).toBe(403);
    expect(resConflict.body.code).toBe('DEMO_CHAIN_ID_CONFLICT');

    // 13c. x-request-id inválido es reemplazado por UUID en servidor + fallo de auditService reporta auditRecorded=false
    const okPool = createMockPool();
    const failingAudit = { logAuditEvent: jest.fn().mockRejectedValue(new Error('audit db error secret123')) };
    const handlerAuditFail = createDemoInventoryHandler({
      pool: okPool,
      auditService: failingAudit,
      getEnv: () => demoEnv
    });
    const resAuditFail = createMockRes();
    await handlerAuditFail(
      createMockReq({ headers: { 'x-request-id': 'bad id with spaces\n<script>' } }),
      resAuditFail
    );
    expect(resAuditFail.statusCode).toBe(200);
    expect(resAuditFail.body.auditRecorded).toBe(false);
    expect(resAuditFail.body.auditWarning).toBeTruthy();
    expect(JSON.stringify(resAuditFail.body)).not.toContain('secret123');
    const auditedRequestId = failingAudit.logAuditEvent.mock.calls[0][2].metadata.requestId;
    expect(auditedRequestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  test('14. [CODEX-211 + CODEX-212 #1] Veracidad real con auditService REAL (INSERT fallido -> auditRecorded=false; INSERT OK -> true; undefined -> false)', async () => {
    const consoleErrSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // 14a. INSERT INTO audit_log falla en el pool -> auditService REAL devuelve { recorded: false } sin lanzar
      const poolAuditFail = createMockPool();
      const origConnectFail = poolAuditFail.connect;
      let connCount = 0;
      poolAuditFail.connect = jest.fn(async () => {
        connCount += 1;
        const c = await origConnectFail();
        if (connCount === 2) {
          const origQ = c.query;
          c.query = async (sql, params) => {
            if (/INSERT INTO audit_log/i.test(String(sql))) {
              const err = new Error('permission denied for table audit_log secret_pg_detail');
              err.code = '42501';
              throw err;
            }
            return origQ(sql, params);
          };
        }
        return c;
      });

      const handlerFail = createDemoInventoryHandler({
        pool: poolAuditFail,
        auditService: realAuditService,
        getEnv: () => demoEnv
      });
      const resFail = createMockRes();
      await handlerFail(createMockReq(), resFail);
      expect(resFail.statusCode).toBe(200);
      expect(resFail.body.auditRecorded).toBe(false);
      expect(resFail.body.auditWarning).toBeTruthy();
      expect(JSON.stringify(resFail.body)).not.toContain('secret_pg_detail');

      // 14b. INSERT INTO audit_log exitoso con auditService REAL -> auditRecorded === true
      const poolAuditOk = createMockPool();
      const handlerOk = createDemoInventoryHandler({
        pool: poolAuditOk,
        auditService: realAuditService,
        getEnv: () => demoEnv
      });
      const resOk = createMockRes();
      await handlerOk(createMockReq(), resOk);
      expect(resOk.statusCode).toBe(200);
      expect(resOk.body.auditRecorded).toBe(true);
      expect(resOk.body.auditWarning).toBeUndefined();

      // 14c. Si un servicio resuelve undefined (sin { recorded: true }) -> auditRecorded === false
      const handlerUndef = createDemoInventoryHandler({
        pool: createMockPool(),
        auditService: { logAuditEvent: jest.fn().mockResolvedValue(undefined) },
        getEnv: () => demoEnv
      });
      const resUndef = createMockRes();
      await handlerUndef(createMockReq(), resUndef);
      expect(resUndef.statusCode).toBe(200);
      expect(resUndef.body.auditRecorded).toBe(false);
    } finally {
      consoleErrSpy.mockRestore();
    }
  });

  test('15. [CODEX-211 #2] ROLLBACK fallido destruye conexión con client.release(true) y auditoría saturada libera lateAuditClient', async () => {
    // 15a. ROLLBACK fallido en collectSqlDemoInventory -> client.release(true)
    const releaseSpy = jest.fn();
    const brokenRollbackPool = {
      connect: jest.fn(async () => ({
        query: jest.fn(async (sql) => {
          if (/^BEGIN/i.test(sql) || /^SET LOCAL/i.test(sql)) return { rows: [] };
          if (/SELECT current_database/i.test(sql)) return { rows: [{ db: 'wintoncoin_demo_db' }] };
          if (/^ROLLBACK$/i.test(sql)) throw new Error('socket closed during rollback');
          throw new Error('query failure triggering rollback');
        }),
        release: releaseSpy
      }))
    };

    const dbValidation = validateDatabaseUrlAllowlist(DEMO_DB_URL);
    const out = await collectSqlDemoInventory({
      databaseUrl: DEMO_DB_URL,
      dbValidation,
      pool: brokenRollbackPool
    });
    expect(out.sqlResult.complete).toBe(false);
    expect(releaseSpy).toHaveBeenCalledTimes(1);
    expect(releaseSpy).toHaveBeenCalledWith(true);

    // 15b. Auditoría saturada: segundo pool.connect() tarda más que auditTimeoutMs y resuelve tarde
    const basePool = createMockPool();
    const origConnect = basePool.connect;
    let resolveLateAuditClient;
    const lateAuditClient = { query: jest.fn(), release: jest.fn() };
    let callIdx = 0;
    basePool.connect = jest.fn(() => {
      callIdx += 1;
      if (callIdx === 1) return origConnect();
      return new Promise((resolve) => { resolveLateAuditClient = resolve; });
    });

    const handler = createDemoInventoryHandler({
      pool: basePool,
      auditService: realAuditService,
      getEnv: () => demoEnv,
      auditTimeoutMs: 100
    });
    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.auditRecorded).toBe(false);
    expect(res.body.auditWarning).toBeTruthy();

    resolveLateAuditClient(lateAuditClient);
    await new Promise((r) => setTimeout(r, 15));
    expect(lateAuditClient.release).toHaveBeenCalledTimes(1);
    expect(lateAuditClient.query).not.toHaveBeenCalled();
  });

  test('16. [CODEX-211 + CODEX-212 #2] Proyección SQL escalar de chain_operations y frontera exacta de maxReportBytes POST-metadatos', async () => {
    const pool = createMockPool();
    const handlerMeasure = createDemoInventoryHandler({
      pool,
      auditService: { logAuditEvent: jest.fn().mockResolvedValue({ recorded: false }) },
      getEnv: () => demoEnv
    });
    const resMeasure = createMockRes();
    await handlerMeasure(createMockReq(), resMeasure);

    // Verificar proyección SQL escalar en chain_operations (sin traer columnas crudas payload/steps)
    const chainOpQuery = pool.getStats().queries.find((q) => /FROM chain_operations WHERE state IN/i.test(q.sql));
    expect(chainOpQuery).toBeDefined();
    expect(chainOpQuery.sql).toMatch(/AS target/i);
    expect(chainOpQuery.sql).toMatch(/AS op_nonce/i);
    expect(chainOpQuery.sql).toMatch(/AS tx_hash/i);
    expect(chainOpQuery.sql).not.toMatch(/,\s*payload\s*,/i);
    expect(chainOpQuery.sql).not.toMatch(/,\s*steps\s*,/i);

    // Frontera exacta: establecer maxReportBytes justo por debajo del tamaño con auditRecorded + auditWarning
    const fullBytesWithAudit = Buffer.byteLength(JSON.stringify(resMeasure.body), 'utf8');
    const tightBudget = Math.max(450, fullBytesWithAudit - 10);

    const handlerTight = createDemoInventoryHandler({
      pool: createMockPool(),
      auditService: { logAuditEvent: jest.fn().mockResolvedValue({ recorded: false }) },
      getEnv: () => demoEnv,
      maxReportBytes: tightBudget
    });
    const resTight = createMockRes();
    await handlerTight(createMockReq(), resTight);

    expect(resTight.statusCode).toBe(200);
    const finalBytes = Buffer.byteLength(JSON.stringify(resTight.body), 'utf8');
    expect(finalBytes).toBeLessThanOrEqual(tightBudget);
    expect(resTight.body.completeness.sqlComplete).toBe(false);
    expect(resTight.body.completeness.truncated).toBe(true);
    expect(resTight.body.errors.some((e) => e.code === 'SQL_REPORT_SIZE_EXCEEDED')).toBe(true);
  });

  test('17. [CODEX-212 #3] Desconexión prematura (res close con writableEnded=false) detiene escaneo, hace ROLLBACK, 0 audit_log y 0 res.json', async () => {
    const reqEmitter = new EventEmitter();
    const req = Object.assign(reqEmitter, createMockReq(), { complete: true });
    const resEmitter = new EventEmitter();
    const res = Object.assign(resEmitter, createMockRes(), { writableEnded: false });

    const pool = createMockPool({ delayMs: 20 });
    const auditService = { logAuditEvent: jest.fn().mockResolvedValue({ recorded: true }) };
    const handler = createDemoInventoryHandler({
      pool,
      auditService,
      getEnv: () => demoEnv
    });

    const runPromise = handler(req, res);
    // Emitir res 'close' con writableEnded=false (desconexión real del socket)
    setTimeout(() => res.emit('close'), 35);
    await runPromise;

    expect(auditService.logAuditEvent).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(pool.getStats().connectCalls).toBe(1);
    expect(pool.getStats().releaseCalls).toBe(1);
    expect(pool.getStats().queries.some((q) => /^ROLLBACK$/i.test(q.sql))).toBe(true);
  });

  test('18. [AG-06 Alto Node >=16] http.createServer real: GET normal NO aborta pese a req close (req.complete=true), y socket.destroy() SÍ aborta', async () => {
    const poolNormal = createMockPool({ delayMs: 15 });
    const auditNormal = { logAuditEvent: jest.fn().mockResolvedValue({ recorded: true }) };
    const handlerNormal = createDemoInventoryHandler({
      pool: poolNormal,
      auditService: auditNormal,
      getEnv: () => demoEnv
    });

    const server = http.createServer((req, res) => {
      req.user = { userId: 42, username: 'admin_http_real', role: 'superadmin' };
      req.query = {};
      res.set = (k, v) => { res.setHeader(k, v); return res; };
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (payload) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
        return res;
      };
      handlerNormal(req, res);
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    try {
      // 18a. GET real de Node: `req` emite 'close' con `req.complete === true` inmediatamente,
      // pero la respuesta DEBE completarse con HTTP 200, sqlComplete=true y auditRecorded=true.
      const httpResult = await new Promise((resolve, reject) => {
        const clientReq = http.get(`http://127.0.0.1:${port}/api/admin/web3/demo-inventory`, (httpRes) => {
          const chunks = [];
          httpRes.on('data', (c) => chunks.push(c));
          httpRes.on('end', () => {
            resolve({
              statusCode: httpRes.statusCode,
              cacheControl: httpRes.headers['cache-control'],
              body: JSON.parse(Buffer.concat(chunks).toString('utf8'))
            });
          });
        });
        clientReq.on('error', reject);
      });

      expect(httpResult.statusCode).toBe(200);
      expect(httpResult.cacheControl).toBe('no-store');
      expect(httpResult.body.completeness.sqlComplete).toBe(true);
      expect(httpResult.body.auditRecorded).toBe(true);
      expect(auditNormal.logAuditEvent).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }

    // 18b. Desconexión real del socket del cliente (clientReq.destroy()) en http.createServer SÍ aborta
    const poolAbort = createMockPool({ delayMs: 25 });
    const auditAbort = { logAuditEvent: jest.fn().mockResolvedValue({ recorded: true }) };
    const handlerAbort = createDemoInventoryHandler({
      pool: poolAbort,
      auditService: auditAbort,
      getEnv: () => demoEnv
    });

    let handlerDoneResolve;
    const handlerDone = new Promise((r) => { handlerDoneResolve = r; });
    const abortServer = http.createServer((req, res) => {
      req.user = { userId: 42, username: 'admin_http_abort', role: 'superadmin' };
      req.query = {};
      res.set = (k, v) => { res.setHeader(k, v); return res; };
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = jest.fn((payload) => {
        res.end(JSON.stringify(payload));
        return res;
      });
      Promise.resolve(handlerAbort(req, res)).finally(handlerDoneResolve);
    });

    await new Promise((resolve) => abortServer.listen(0, '127.0.0.1', resolve));
    const abortPort = abortServer.address().port;

    try {
      const clientReq = http.get(`http://127.0.0.1:${abortPort}/api/admin/web3/demo-inventory`);
      clientReq.on('error', () => { /* esperado por destroy() */ });
      setTimeout(() => clientReq.destroy(), 35);
      await handlerDone;

      expect(auditAbort.logAuditEvent).not.toHaveBeenCalled();
      expect(poolAbort.getStats().connectCalls).toBe(1);
      expect(poolAbort.getStats().releaseCalls).toBe(1);
      expect(poolAbort.getStats().queries.some((q) => /^ROLLBACK$/i.test(q.sql))).toBe(true);
    } finally {
      await new Promise((resolve) => abortServer.close(resolve));
    }
  });
});
