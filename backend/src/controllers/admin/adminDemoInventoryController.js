'use strict';

/**
 * ============================================================================
 * CONTROLADOR ADMIN READ-ONLY: INVENTARIO SQL DEMO (CODEX-209 / OPCIÓN 1)
 * ============================================================================
 * Endpoint: `GET /api/admin/web3/demo-inventory[?detail=true|false]`
 *
 * Garantías de Seguridad (Zero-Trust / SOC 2 / CODEX-209):
 * 1. Protegido por `verifyAdminToken` (`adminSession.verifySession`) con
 *    verificación real de sesión activa y revocación (`account_status` y
 *    `pwdVersion`).
 * 2. Guardas pre-pool ANTES de llamar a `pool.connect()`:
 *    - Exige entorno explícitamente Demo (`IS_DEMO_ENV=true` o
 *      `WINTON_ENVIRONMENT_ID=demo`), `chainId === 11155420` y
 *      `validateDatabaseUrlAllowlist(DATABASE_URL)` sin imprimir la URL.
 *    - Fuera de Demo responde `403` sin tocar el pool ni escribir auditoría.
 * 3. Cero parámetros arbitrarios de destino: rechaza con `400` cualquier query
 *    param fuera de `detail=true|false`.
 * 4. `Cache-Control: no-store` obligatorio en TODAS las respuestas (éxito/error).
 * 5. Singleflight en proceso: rechaza con `409` escaneos concurrentes para
 *    proteger el pool de conexiones.
 * 6. Reutiliza `collectSqlDemoInventory` (DRY) dentro de una única transacción
 *    `REPEATABLE READ READ ONLY` con `statement_timeout`, `maxTotalRows`,
 *    `maxExecutionMs` y cancelación por desconexión (`AbortSignal`), liberando
 *    el cliente con `client.release()` en `finally` (o `client.release(true)` si
 *    falla `ROLLBACK`). Nota honesta: `maxExecutionMs` gobierna la ventana de
 *    lectura SQL (y `auditTimeoutMs` la escritura de auditoría), no constituye
 *    un cap HTTP global rígido; `maxReportBytes` acota el JSON serializado final.
 * 7. Auditoría de metadatos por canal separado (`auditService.logAuditEvent`):
 *    escritura de metadatos de auditoría SIEMPRE fuera de la transacción
 *    `READ ONLY` del snapshot, con cliente dedicado y timeout propio, y SOLO
 *    cuando se confirmó `sqlResult.databaseIdentityConfirmed === true`.
 *    Solo reporta `auditRecorded: true` si `logAuditEvent` confirmó `{ recorded: true }`.
 * 8. Terminología canónica: los saldos RED son compromisos RED.
 * ============================================================================
 */

const { randomUUID } = require('node:crypto');
const defaultPool = require('../../config/db');
const defaultAuditService = require('../../services/auditService');
const defaultMarketplaceDeployment = require('../../services/marketplaceDeployment');
const { assertDemoDatabase } = require('../../services/demoEnvironmentGuard');
const {
  DEMO_CHAIN_ID_STR,
  DEMO_EPOCH,
  SCHEMA_VERSION,
  validateDatabaseUrlAllowlist,
  acquirePoolClientWithTimeout,
  collectSqlDemoInventory,
  buildSqlPreservationAndReconciliation,
  deepSanitizeReport,
  sanitizeText
} = require('../../services/v6DemoInventoryExporter');

const DEFAULT_HTTP_STATEMENT_TIMEOUT_MS = 12_000;
const DEFAULT_HTTP_PAGE_SIZE = 500;
const DEFAULT_HTTP_MAX_TOTAL_ROWS = 25_000;
const DEFAULT_HTTP_MAX_EXECUTION_MS = 20_000;
const DEFAULT_HTTP_AUDIT_TIMEOUT_MS = 3_000;
const DEFAULT_HTTP_MAX_REPORT_BYTES = 512 * 1024; // 512 KiB máximo por respuesta HTTP serializada
const DEFAULT_HTTP_MAX_TEXT_LENGTH = 512;

const ALLOWED_QUERY_KEYS = new Set(['detail']);
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;

/**
 * Resuelve un `requestId` seguro para trazabilidad y auditoría.
 * Valida estrictamente el header `x-request-id` contra `/^[A-Za-z0-9._:-]{1,64}$/`;
 * si falta o es inválido, genera `crypto.randomUUID()` en servidor.
 */
function resolveSafeRequestId(req) {
  const raw = req?.headers?.['x-request-id'];
  if (typeof raw === 'string' && SAFE_REQUEST_ID_PATTERN.test(raw.trim())) {
    return raw.trim();
  }
  return randomUUID();
}

/**
 * Valida las guardas pre-pool del entorno Demo ANTES de abrir cualquier conexión SQL.
 * Nunca imprime ni retorna credenciales ni la URL completa de base de datos.
 * Fail-closed: obtiene el `chainId` desde la configuración canónica validada
 * (`marketplaceDeployment.configuration`, con verificación SHA-256 de manifiesto V6)
 * y/o variables explícitas de entorno, rechazando cualquier ausencia o contradicción.
 */
function evaluatePrePoolDemoGuard(
  env = process.env,
  allowlistOptions = {},
  deploymentResolver = defaultMarketplaceDeployment.configuration
) {
  const envId = String(env.WINTON_ENVIRONMENT_ID || '').trim().toLowerCase();
  const isDemoMarker = env.IS_DEMO_ENV === 'true' || envId === 'demo';
  if (!isDemoMarker || envId === 'prod' || envId === 'production') {
    return {
      ok: false,
      code: 'DEMO_ENV_REQUIRED',
      message: 'Este endpoint de inventario SQL está habilitado exclusivamente en entorno Demo.'
    };
  }

  // Recolectar cualquier variable explícita de chainId presente en el entorno
  const explicitChainIds = [
    env.WINTON_CHAIN_ID,
    env.WEB3_CHAIN_ID,
    env.V6_CHAIN_ID,
    env.CHAIN_ID
  ]
    .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
    .map((v) => String(v).trim());

  const uniqueExplicitChainIds = new Set(explicitChainIds);
  if (uniqueExplicitChainIds.size > 1) {
    return {
      ok: false,
      code: 'DEMO_CHAIN_ID_CONFLICT',
      message: 'Configuración contradictoria de chainId entre variables de entorno.'
    };
  }

  // Consultar la configuración canónica validada del despliegue (DRY con marketplaceDeployment)
  let canonicalConfig = null;
  if (typeof deploymentResolver === 'function') {
    try {
      canonicalConfig = deploymentResolver(env);
    } catch {
      canonicalConfig = null;
    }
  }
  const canonicalChainId = canonicalConfig?.chainId ? String(canonicalConfig.chainId).trim() : null;
  const canonicalEpoch = canonicalConfig?.epoch ? String(canonicalConfig.epoch).trim() : null;

  if (explicitChainIds.length === 0) {
    // Sin variable explícita: exigir identidad canónica validada (11155420 + V6_DEMO)
    if (canonicalChainId !== DEMO_CHAIN_ID_STR || canonicalEpoch !== DEMO_EPOCH) {
      return {
        ok: false,
        code: 'DEMO_CHAIN_ID_NOT_CONFIGURED',
        message: `Configuración incompleta: no se pudo validar chainId=${DEMO_CHAIN_ID_STR} (${DEMO_EPOCH}) desde marketplaceDeployment ni desde WEB3_CHAIN_ID / V6_CHAIN_ID / CHAIN_ID.`
      };
    }
  } else {
    const configuredChainId = explicitChainIds[0];
    if (configuredChainId !== DEMO_CHAIN_ID_STR) {
      return {
        ok: false,
        code: 'DEMO_CHAIN_ID_REQUIRED',
        message: `Entorno no autorizado: se requiere chainId=${DEMO_CHAIN_ID_STR} (Demo Optimism Sepolia).`
      };
    }
    if (canonicalChainId && canonicalChainId !== configuredChainId) {
      return {
        ok: false,
        code: 'DEMO_CHAIN_ID_CONFLICT',
        message: 'Configuración contradictoria entre variables de entorno y marketplaceDeployment.'
      };
    }
  }

  // Si el entorno define huella SHA-256 oficial (`WINTON_DEMO_DATABASE_FINGERPRINT`),
  // validamos criptográficamente `DATABASE_URL` mediante `demoEnvironmentGuard.assertDemoDatabase`
  // (soporta hosts internos autogenerados por Render tipo `dpg-xxxx-a` sin relajar seguridad).
  // Fail-closed: si hay huella configurada y NO coincide, rechazamos de inmediato.
  let effectiveAllowlistOptions = { ...allowlistOptions };
  const hasDbFingerprint =
    typeof env.WINTON_DEMO_DATABASE_FINGERPRINT === 'string' &&
    env.WINTON_DEMO_DATABASE_FINGERPRINT.trim() !== '';

  if (hasDbFingerprint) {
    try {
      assertDemoDatabase(env);
      const parsedUrl = new URL(env.DATABASE_URL);
      const pinnedHost = parsedUrl.hostname.toLowerCase();
      const pinnedDbName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));
      effectiveAllowlistOptions = {
        ...allowlistOptions,
        allowedDbHosts: [pinnedHost],
        allowedDbNames: [pinnedDbName]
      };
    } catch {
      return {
        ok: false,
        code: 'DEMO_DATABASE_FINGERPRINT_MISMATCH',
        message: 'La huella criptográfica de la base de datos no coincide con el entorno Demo autorizado.'
      };
    }
  }

  try {
    const dbValidation = validateDatabaseUrlAllowlist(env.DATABASE_URL, effectiveAllowlistOptions);
    return {
      ok: true,
      dbValidation,
      allowedDbNames: effectiveAllowlistOptions.allowedDbNames || null
    };
  } catch {
    return {
      ok: false,
      code: 'DEMO_DATABASE_NOT_ALLOWED',
      message: 'La base de datos configurada no pertenece a un destino Demo autorizado.'
    };
  }
}

/**
 * Parsea y valida estrictamente `req.query`: solo acepta `?detail=true|false`.
 * Rechaza cualquier intento de inyectar destino, host, URL, DB o SQL.
 */
function parseStrictQueryParams(query = {}) {
  const keys = Object.keys(query || {});
  const forbiddenKeys = keys.filter((k) => !ALLOWED_QUERY_KEYS.has(k));
  if (forbiddenKeys.length > 0) {
    return {
      ok: false,
      message: `Parámetro(s) de consulta no permitido(s): ${forbiddenKeys.join(', ')}. Solo se admite detail=true|false.`
    };
  }

  if (query.detail === undefined || query.detail === '') {
    return { ok: true, mode: 'summary', includeDetail: false };
  }

  const rawDetail = String(query.detail).trim().toLowerCase();
  if (rawDetail === 'true') {
    return { ok: true, mode: 'detail', includeDetail: true };
  }
  if (rawDetail === 'false') {
    return { ok: true, mode: 'summary', includeDetail: false };
  }

  return {
    ok: false,
    message: 'El parámetro detail debe ser exactamente "true" o "false".'
  };
}

/**
 * Construye los conteos exactos de resumen a partir del resultado de `collectSqlDemoInventory`.
 */
function buildSummaryCounts(sqlResult) {
  const openIssues = sqlResult.policy?.openCreditPolicyIssues || [];
  const deadLetterCount = openIssues.filter((i) => i.status === 'dead_letter').length;

  return {
    users: (sqlResult.users || []).length,
    publicationsActive: (sqlResult.publicationsActive || []).length,
    publicationAcceptancesPending: (sqlResult.publicationAcceptancesPending || []).length,
    publicationAcceptancesByStatus: sqlResult.publicationAcceptancesCountsByStatus || {},
    escrowHoldsActive: (sqlResult.escrowHoldsActive || []).length,
    moraEpisodes: (sqlResult.moraEpisodes || []).length,
    creditPolicyIssuesUnresolved: openIssues.length,
    deadLetterCount,
    creditPolicyIssuesByStatus: sqlResult.policy?.creditPolicyIssuesCountsByStatus || {},
    outboxPending: (sqlResult.creditNotificationOutbox?.pendingItems || []).length,
    outboxByStatus: sqlResult.creditNotificationOutbox?.countsByStatus || {},
    referralAwardsActive: (sqlResult.creditReferralAwards?.activeAwards || []).length,
    referralAwardsByBaseline: sqlResult.creditReferralAwards?.countsByBaseline || { baseline: '0', active: '0' },
    chainOpsActive: (sqlResult.chainOperations?.activeOperations || []).length,
    countsByState: sqlResult.chainOperations?.countsByState || {}
  };
}

/**
 * Crea el handler HTTP con inyección de dependencias para pruebas unitarias e integración real.
 */
function createDemoInventoryHandler(deps = {}) {
  const {
    pool = defaultPool,
    auditService = defaultAuditService,
    getEnv = () => process.env,
    collectorFn = collectSqlDemoInventory,
    statementTimeoutMs = DEFAULT_HTTP_STATEMENT_TIMEOUT_MS,
    pageSize = DEFAULT_HTTP_PAGE_SIZE,
    maxTotalRows = DEFAULT_HTTP_MAX_TOTAL_ROWS,
    maxExecutionMs = DEFAULT_HTTP_MAX_EXECUTION_MS,
    auditTimeoutMs = DEFAULT_HTTP_AUDIT_TIMEOUT_MS,
    maxReportBytes = DEFAULT_HTTP_MAX_REPORT_BYTES,
    maxTextLength = DEFAULT_HTTP_MAX_TEXT_LENGTH,
    allowLocalSql = false,
    allowedDbHosts = null,
    allowedDbNames = null,
    deploymentResolver = defaultMarketplaceDeployment.configuration
  } = deps;

  // Guard singleflight en proceso: impide múltiples escaneos paralelos sobre el pool
  let scanInProgress = false;

  return async function getDemoInventory(req, res) {
    // Cabecera obligatoria anti-caché en TODAS las respuestas (éxito y error)
    res.set('Cache-Control', 'no-store');

    const requestId = resolveSafeRequestId(req);

    // 1. Validar que solo venga `?detail=true|false` (cero parámetros de destino)
    const parsedQuery = parseStrictQueryParams(req.query);
    if (!parsedQuery.ok) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_QUERY_PARAMS',
        message: parsedQuery.message
      });
    }

    // 2. Guardas pre-pool estrictas ANTES de llamar a `pool.connect()` o `auditService`
    const env = getEnv();
    const demoGuard = evaluatePrePoolDemoGuard(
      env,
      {
        allowLocalSql,
        allowedDbHosts,
        allowedDbNames
      },
      deploymentResolver
    );
    if (!demoGuard.ok) {
      return res.status(403).json({
        success: false,
        code: demoGuard.code,
        message: demoGuard.message
      });
    }

    // 3. Singleflight en proceso: rechazar concurrencia antes de tocar el pool
    if (scanInProgress) {
      return res.status(409).json({
        success: false,
        code: 'DEMO_INVENTORY_SCAN_IN_PROGRESS',
        message: 'Ya existe un escaneo de inventario SQL Demo en curso. Espera unos segundos e intenta nuevamente.'
      });
    }

    // 4. Cancelación por desconexión real del cliente (Node.js >= 16):
    // En Node >= 16, `req` emite 'close' apenas termina de leer el body (inmediatamente en GET,
    // con `req.complete === true`). Solo es desconexión prematura si `res` emite 'close' antes
    // de `res.writableEnded`, si `req` emite 'close' con `!req.complete`, o si `req` emite 'aborted'.
    const abortController = new AbortController();
    const onResClose = () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    };
    const onReqClose = () => {
      if (!req.complete && !res.writableEnded) {
        abortController.abort();
      }
    };
    const onReqAborted = () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    };
    if (typeof res.on === 'function') res.on('close', onResClose);
    if (typeof req.on === 'function') {
      req.on('close', onReqClose);
      req.on('aborted', onReqAborted);
    }

    const detachCloseListeners = () => {
      if (typeof res.off === 'function') res.off('close', onResClose);
      else if (typeof res.removeListener === 'function') res.removeListener('close', onResClose);
      if (typeof req.off === 'function') {
        req.off('close', onReqClose);
        req.off('aborted', onReqAborted);
      } else if (typeof req.removeListener === 'function') {
        req.removeListener('close', onReqClose);
        req.removeListener('aborted', onReqAborted);
      }
    };

    try {
      scanInProgress = true;
      let sqlResult = null;
      let sqlErrors = [];
      let auditReason = 'ok';

      try {
        const out = await collectorFn({
          databaseUrl: env.DATABASE_URL,
          dbValidation: demoGuard.dbValidation,
          pool,
          statementTimeoutMs,
          pageSize,
          maxTotalRows,
          maxExecutionMs,
          signal: abortController.signal,
          allowLocalSql,
          allowedDbNames: demoGuard.allowedDbNames || allowedDbNames
        });
        sqlResult = out.sqlResult;
        sqlErrors = out.sqlErrors || [];
      } catch (error) {
        if (abortController.signal.aborted || res.writableEnded) {
          return;
        }
        const msg = String(error?.message || '');
        if (/^SQL_IDENTITY_(REJECTED|MISMATCH|FAILED)/.test(msg)) {
          // Zero-Trust / aislamiento estricto: si current_database() indica que el pool
          // apunta a una BD no autorizada/no-Demo, JAMÁS escribir en audit_log sobre ese pool.
          return res.status(403).json({
            success: false,
            code: 'DEMO_DATABASE_IDENTITY_REJECTED',
            message: 'La identidad observada de la base de datos no corresponde a un entorno Demo autorizado.'
          });
        }

        // Nunca auditar si la identidad Demo del servidor no llegó a confirmarse
        return res.status(503).json({
          success: false,
          code: 'DEMO_INVENTORY_UNAVAILABLE',
          message: 'No se pudo completar la lectura de solo lectura del inventario SQL Demo.'
        });
      } finally {
        scanInProgress = false;
      }

      // Si el cliente se desconectó durante el escaneo, abortar sin auditar ni responder
      if (abortController.signal.aborted || res.writableEnded || sqlResult?.aborted) {
        return;
      }

      let truncated = Boolean(sqlResult.truncated);
      let sqlComplete = Boolean(sqlResult.complete && !truncated && sqlErrors.length === 0);
      if (truncated) {
        auditReason = 'truncated';
      } else if (!sqlComplete) {
        auditReason = 'incomplete';
      }

      const summaryCounts = buildSummaryCounts(sqlResult);
      const sqlPreservationAndReconciliation = buildSqlPreservationAndReconciliation(sqlResult, sqlComplete);

      const rawResponse = {
        capturedAt: new Date().toISOString(),
        demoIdentity: {
          chainId: DEMO_CHAIN_ID_STR,
          epoch: DEMO_EPOCH,
          databaseNameObserved: sqlResult.databaseNameObserved
        },
        exporterVersion: SCHEMA_VERSION,
        mode: parsedQuery.mode,
        completeness: {
          sqlComplete,
          truncated,
          errorsCount: sqlErrors.length
        },
        schema: {
          missingRequiredTables: sqlResult.schema?.missingRequiredTables || [],
          optionalMigrations: sqlResult.schema?.optionalMigrations || {}
        },
        summaryCounts,
        sqlPreservationAndReconciliation,
        atomicityNotice:
          'SQL (REPEATABLE READ READ ONLY) y blockchain (bloque finalized) NO son atómicos entre sí. ' +
          'Este endpoint cubre únicamente el estado SQL Demo y NO equivale a routeAEligible ni a una certificación on-chain.',
        errors: sqlErrors.map((e) => ({
          stage: e.stage ? String(e.stage) : 'sql_read',
          code: e.code ? String(e.code) : 'SQL_READ_ERROR',
          message: sanitizeText(e.message, { maxLength: maxTextLength })
        }))
      };

      if (parsedQuery.includeDetail) {
        rawResponse.detail = {
          linkableAdminDataNotice:
            'Los identificadores de usuario y direcciones de billetera incluidos en modo detail son datos vinculables de uso exclusivo administrativo; ' +
            'no se incluyen datos personales de contacto ni firmas o cargas transaccionales crudas.',
          users: sqlResult.users || [],
          moraEpisodes: sqlResult.moraEpisodes || [],
          openCreditPolicyIssues: sqlResult.policy?.openCreditPolicyIssues || [],
          publicationsActive: sqlResult.publicationsActive || [],
          publicationAcceptancesPending: sqlResult.publicationAcceptancesPending || [],
          escrowHoldsActive: sqlResult.escrowHoldsActive || [],
          creditNotificationOutboxPending: sqlResult.creditNotificationOutbox?.pendingItems || [],
          creditReferralAwardsActive: sqlResult.creditReferralAwards?.activeAwards || [],
          chainOperationsActive: sqlResult.chainOperations?.activeOperations || []
        };
      }

      // Defensa en profundidad: sanitización recursiva profunda + acotado de longitud de textos
      let finalResponse = deepSanitizeReport(rawResponse, { maxTextLength });

      // Pre-chequeo de tamaño para reflejar `report_size_exceeded` en auditoría si ya excede antes de metadatos
      const hasByteCap = Number.isSafeInteger(maxReportBytes) && maxReportBytes > 0;
      if (hasByteCap && Buffer.byteLength(JSON.stringify(finalResponse), 'utf8') > maxReportBytes) {
        truncated = true;
        sqlComplete = false;
        auditReason = 'report_size_exceeded';
      }

      // =========================================================================
      // ESCRITURA DE METADATOS DE AUDITORÍA (CANAL SEPARADO — SOLO SI IDENTIDAD DEMO CONFIRMADA)
      // =========================================================================
      // Se ejecuta SIEMPRE fuera de la transacción `REPEATABLE READ READ ONLY`
      // del inventario, acotada a `auditTimeoutMs` en un cliente dedicado, y
      // ÚNICAMENTE si `sqlResult.databaseIdentityConfirmed === true`.
      let auditStatus = { recorded: false, warning: null };
      if (sqlResult.databaseIdentityConfirmed === true) {
        auditStatus = await writeAuditMetadataSafely(auditService, pool, req, {
          requestId,
          mode: parsedQuery.mode,
          sqlComplete,
          truncated,
          errorsCount: finalResponse.completeness.errorsCount,
          reason: auditReason,
          auditTimeoutMs,
          signal: abortController.signal
        });
      } else {
        auditStatus = {
          recorded: false,
          warning: 'No se registró auditoría porque no se confirmó la identidad Demo en PostgreSQL.'
        };
      }

      if (abortController.signal.aborted || res.writableEnded) {
        return;
      }

      finalResponse.auditRecorded = auditStatus.recorded;
      if (!auditStatus.recorded && auditStatus.warning) {
        finalResponse.auditWarning = auditStatus.warning;
      }

      // =========================================================================
      // CHEQUEO FINAL DE BYTES POST-METADATOS (GARANTIZA `<= maxReportBytes`)
      // =========================================================================
      if (hasByteCap) {
        const serializedBytes = Buffer.byteLength(JSON.stringify(finalResponse), 'utf8');
        if (serializedBytes > maxReportBytes) {
          if (finalResponse.detail) {
            delete finalResponse.detail;
          }
          finalResponse.errors.push({
            stage: 'http_response',
            code: 'SQL_REPORT_SIZE_EXCEEDED',
            message: `El tamaño serializado del informe (${serializedBytes} bytes) excedió el límite de ${maxReportBytes} bytes; detalle omitido.`
          });
          finalResponse.completeness = {
            sqlComplete: false,
            truncated: true,
            errorsCount: finalResponse.errors.length
          };
          finalResponse.sqlPreservationAndReconciliation = buildSqlPreservationAndReconciliation(
            { ...sqlResult, truncated: true },
            false
          );

          // Si tras omitir `detail` el JSON completo (con metadatos de auditoría) todavía
          // supera `maxReportBytes`, emitir fallback mínimo fail-closed garantizado <= maxReportBytes
          if (Buffer.byteLength(JSON.stringify(finalResponse), 'utf8') > maxReportBytes) {
            finalResponse = buildMinimalSizeFallback({
              capturedAt: finalResponse.capturedAt,
              demoIdentity: finalResponse.demoIdentity,
              auditStatus,
              maxReportBytes
            });
          }
        }
      }

      return res.status(200).json(finalResponse);
    } finally {
      detachCloseListeners();
    }
  };
}

/**
 * Construye el fallback mínimo fail-closed cuando el JSON final (tras adjuntar
 * `auditRecorded`/`auditWarning`) excede `maxReportBytes`, garantizando
 * `sqlComplete: false`, `truncated: true` y tamaño serializado `<= maxReportBytes`.
 */
function buildMinimalSizeFallback({ capturedAt, demoIdentity, auditStatus, maxReportBytes }) {
  const fallback = {
    success: true,
    mode: 'summary',
    capturedAt,
    demoIdentity,
    exporterVersion: SCHEMA_VERSION,
    completeness: {
      sqlComplete: false,
      truncated: true,
      errorsCount: 1
    },
    errors: [{
      code: 'SQL_REPORT_SIZE_EXCEEDED',
      message: 'Informe omitido por exceder el limite de bytes configurado.'
    }],
    auditRecorded: Boolean(auditStatus.recorded)
  };
  if (!auditStatus.recorded) {
    fallback.auditWarning = 'Auditoria no registrada.';
  }
  // Si el presupuesto configurado es extremadamente estrecho, acortar mensaje descriptivo
  if (Buffer.byteLength(JSON.stringify(fallback), 'utf8') > maxReportBytes) {
    fallback.errors[0].message = 'SIZE_EXCEEDED';
    if (fallback.auditWarning) fallback.auditWarning = 'NO_AUDIT';
  }
  return fallback;
}

/**
 * Registra metadatos de auditoría usando `auditService.logAuditEvent` en un
 * cliente dedicado acotado a `auditTimeoutMs` (sin `Promise.race` que deje
 * escrituras colgadas). Solo reporta `recorded: true` cuando `logAuditEvent`
 * devuelve explícitamente `{ recorded: true }`.
 */
async function writeAuditMetadataSafely(auditService, pool, req, meta) {
  if (!auditService || typeof auditService.logAuditEvent !== 'function') {
    return {
      recorded: false,
      warning: 'Servicio de auditoría no disponible en esta instancia.'
    };
  }

  const safeAuditTimeoutMs = Math.trunc(
    Math.max(100, Math.min(Number(meta.auditTimeoutMs) || DEFAULT_HTTP_AUDIT_TIMEOUT_MS, 30_000))
  );
  const auditPayload = {
    eventType: 'admin.web3.demo_inventory.read',
    actorId: req.user?.userId ?? null,
    actorUsername: req.user?.username || 'admin',
    category: 'web3_demo_inventory',
    metadata: {
      requestId: meta.requestId,
      adminId: req.user?.userId ?? null,
      mode: meta.mode,
      completeness: {
        sqlComplete: Boolean(meta.sqlComplete),
        truncated: Boolean(meta.truncated),
        errorsCount: Number(meta.errorsCount || 0)
      },
      reason: meta.reason
    }
  };

  let auditClient = null;
  let inTx = false;
  let destroyOnRelease = false;
  let released = false;

  try {
    if (pool && typeof pool.connect === 'function') {
      auditClient = await acquirePoolClientWithTimeout(pool, safeAuditTimeoutMs, {
        signal: meta.signal || null,
        stage: 'audit_pool_connect'
      });
      await auditClient.query('BEGIN');
      inTx = true;
      await auditClient.query(`SET LOCAL statement_timeout = '${safeAuditTimeoutMs}ms'`);

      const result = await auditService.logAuditEvent(auditClient, req, auditPayload);
      const isRecorded = Boolean(result && result.recorded === true);
      if (isRecorded) {
        await auditClient.query('COMMIT');
        inTx = false;
        return { recorded: true, warning: null };
      }

      await auditClient.query('ROLLBACK');
      inTx = false;
      return {
        recorded: false,
        warning: 'No se pudo confirmar el registro de auditoría en el canal separado.'
      };
    }

    // Fallback para pools/clientes sin `.connect()`
    const result = await auditService.logAuditEvent(pool, req, auditPayload);
    if (result && result.recorded === true) {
      return { recorded: true, warning: null };
    }
    return {
      recorded: false,
      warning: 'No se pudo confirmar el registro de auditoría en el canal separado.'
    };
  } catch {
    return {
      recorded: false,
      warning: 'No se pudo registrar el evento de auditoría en el canal separado.'
    };
  } finally {
    if (auditClient && inTx) {
      try {
        await auditClient.query('ROLLBACK');
      } catch {
        destroyOnRelease = true;
      }
      inTx = false;
    }
    if (auditClient && !released && typeof auditClient.release === 'function') {
      released = true;
      try {
        if (destroyOnRelease) auditClient.release(true);
        else auditClient.release();
      } catch { /* noop */ }
    }
  }
}

const getDemoInventory = createDemoInventoryHandler();

module.exports = {
  DEFAULT_HTTP_STATEMENT_TIMEOUT_MS,
  DEFAULT_HTTP_PAGE_SIZE,
  DEFAULT_HTTP_MAX_TOTAL_ROWS,
  DEFAULT_HTTP_MAX_EXECUTION_MS,
  DEFAULT_HTTP_AUDIT_TIMEOUT_MS,
  DEFAULT_HTTP_MAX_REPORT_BYTES,
  DEFAULT_HTTP_MAX_TEXT_LENGTH,
  resolveSafeRequestId,
  evaluatePrePoolDemoGuard,
  parseStrictQueryParams,
  buildSummaryCounts,
  buildMinimalSizeFallback,
  createDemoInventoryHandler,
  getDemoInventory
};
