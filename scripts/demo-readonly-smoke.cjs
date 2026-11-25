'use strict';

/**
 * ============================================================================
 * SUPERVISIÓN PERIÓDICA 100% READ-ONLY PARA ENTORNO DEMO (WINTONCOIN SRE)
 * ============================================================================
 * Responsable: AG-07 (SRE / Plataforma / Rendimiento) — D06 (CODEX-204 §7)
 *
 * Propósito:
 * Ejecutar comprobaciones de salud y aislamiento de solo lectura (HTTP GET)
 * exclusivamente contra el entorno Demo:
 *   - Frontend Demo: https://demo.wintoncoin.com
 *   - Backend Demo:  https://wintoncoin-backend-demo.onrender.com
 *
 * Garantías de Seguridad y Cumplimiento (Zero-Trust / SOC 2):
 * 1. Allowlist estricta ANTES de abrir cualquier conexión de red:
 *    solo se permiten HTTPS hacia `demo.wintoncoin.com` y
 *    `wintoncoin-backend-demo.onrender.com`. Cualquier dominio de Producción,
 *    URL arbitraria, esquema HTTP, puerto no estándar o credencial embebida
 *    se rechaza de inmediato con exitCode = 1 y 0 llamadas de red.
 * 2. Cero operaciones mutantes y cero reintentos mutantes:
 *    solo `GET`, `redirect: 'manual'` (bloquea redirecciones fuera de allowlist),
 *    sin cookies ni secretos, y `maxRetries = 0`.
 * 3. Timeout estricto por solicitud (15 000 ms por defecto) vía AbortController.
 * 4. Reporte JSON estructurado en stdout (y opcional `--out` restringido a
 *    `backend/scratch/`), sin secretos ni PII.
 *
 * Criterio explícito para `/api/web3/exchange-queue`:
 * - HTTP 200 solo es `ok` (`info`) si cumple TODAS estas condiciones:
 *     1) `payload.success === true`
 *     2) `String(payload.chainId) === "11155420"` (nunca ausente)
 *     3) `payload.status === "ready"` (sin fallback implícito)
 *     4) `payload.usable === true` (explícitamente booleano `true`)
 *     5) `verifiedThroughBlock` presente y entero positivo válido (`^\d+$` y `> 0`)
 *     6) Latencia dentro del umbral (`<= 8000 ms`; si excede, reporta `degraded` + `P2`)
 *   Si llega HTTP 200 sin cumplir las condiciones 1-5, falla críticamente (`P1`,
 *   `EXCHANGE_QUEUE_NOT_READY_ON_200`, `exitCode = 1`).
 * - HTTP 503 con `chainId === "11155420"` y estado controlado de sincronización
 *   o fail-closed (`usable === false` o `status` en `syncing|stale|warming|
 *   initializing|fail-closed|maintenance`): reporta `degraded` + alerta `P2`.
 *   En modo diagnóstico (`--fail-on-degraded` desactivado) conserva `exitCode = 0`;
 *   en modo readiness estricto (`--fail-on-degraded` / `--strict-readiness`)
 *   devuelve `exitCode = 1` para evitar verdes indefinidos ante indisponibilidad sostenida.
 * - `chainId` ausente o distinto de `"11155420"`, HTTP 500/4xx/3xx, JSON inválido
 *   o timeout: fallo crítico `P1 / critical` con `exitCode = 1`.
 * ============================================================================
 */

const fs = require('node:fs');
const path = require('node:path');

// Lista blanca inmutable de hosts Demo autorizados (prohibido Producción o hosts arbitrarios)
const ALLOWED_DEMO_HOSTS = Object.freeze([
    'demo.wintoncoin.com',
    'wintoncoin-backend-demo.onrender.com'
]);

// Identificadores canónicos de red y despliegue esperados en Demo V6 (OP Sepolia)
const EXPECTED_DEMO_CHAIN_ID = '11155420';
const EXPECTED_DEMO_EPOCH = 'V6_DEMO';

// Parámetros por defecto de tiempo de espera y umbral de latencia de cola
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_ALLOWED_TIMEOUT_MS = 30000;
const DEFAULT_EXCHANGE_QUEUE_WARN_LATENCY_MS = 8000;

// Estados controlados reconocidos en respuestas HTTP 503 fail-closed del indexador
const CONTROLLED_QUEUE_503_STATUSES = Object.freeze([
    'syncing',
    'stale',
    'warming',
    'initializing',
    'fail-closed',
    'maintenance'
]);

// Patrones de referencias a backend productivo que NUNCA deben aparecer en HTML de Demo
const PRODUCTION_BACKEND_REFERENCE_PATTERNS = Object.freeze([
    /wintoncoin-backend\.onrender\.com/i,
    /api\.wintoncoin\.com/i,
    /wintoncoin-prod\.onrender\.com/i
]);

// Patrón del bundle compilado de Estado de Cuenta Web3 (ej. /assets/estadoCuenta.BoPWzzwi.js)
const ESTADO_CUENTA_BUNDLE_REGEX = /estadoCuenta\.[A-Za-z0-9_-]+\.js/;

// Marcadores esperados de entorno Demo en el HTML servido por demo.wintoncoin.com
const DEMO_HTML_MARKER_PATTERNS = Object.freeze([
    /data-winton-environment\s*=\s*["']demo["']/i,
    /<title[^>]*>[^<]*\[DEMO\][^<]*<\/title>/i
]);

// Objetivos canónicos read-only de Demo
const DEFAULT_TARGETS = Object.freeze({
    frontendHome: 'https://demo.wintoncoin.com/',
    frontendEstadoCuenta: 'https://demo.wintoncoin.com/estado-cuenta.html',
    backendDeployment: 'https://wintoncoin-backend-demo.onrender.com/api/web3/deployment',
    backendExchangeQueue: 'https://wintoncoin-backend-demo.onrender.com/api/web3/exchange-queue'
});

/**
 * Redacta credenciales embebidas (`user:pass@`) en cualquier URL antes de incluirla
 * en reportes JSON o mensajes de auditoría (Zero Hardcoded Secrets / Cero PII).
 *
 * @param {unknown} rawUrl - Valor candidato de URL.
 * @returns {string|null} URL sanitizada sin credenciales, o null si no es string.
 */
function redactUrlCredentials(rawUrl) {
    if (typeof rawUrl !== 'string') {
        return null;
    }
    const trimmed = rawUrl.trim();
    if (trimmed.length === 0) {
        return '';
    }
    try {
        const parsed = new URL(trimmed);
        if (parsed.username || parsed.password) {
            // Reconstruimos explícitamente sin usuario ni contraseña
            return `${parsed.protocol}//[REDACTED]@${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
        return trimmed;
    } catch {
        // Fallback defensivo si la URL está malformada pero contiene credenciales `scheme://user:pass@`
        return trimmed.replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/@\s]+)@/g, '$1[REDACTED]@');
    }
}

/**
 * Valida que un número de bloque verificado (`verifiedThroughBlock`) sea un
 * entero positivo válido (`^\d+$` y `> 0`), evitando falsos OK con `null`, `0` o cadenas vacías.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isPositiveIntegerBlock(value) {
    if (typeof value === 'number') {
        return Number.isSafeInteger(value) && value > 0;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return /^\d+$/.test(trimmed) && BigInt(trimmed) > 0n;
    }
    return false;
}

/**
 * Valida una URL objetivo contra la allowlist estricta de Demo ANTES de realizar
 * cualquier solicitud de red.
 *
 * @param {string} rawUrl - URL candidata a consultar.
 * @param {readonly string[]} [allowedHosts=ALLOWED_DEMO_HOSTS] - Hosts permitidos.
 * @returns {{ valid: boolean, normalizedUrl: string|null, redactedUrl: string|null, host: string|null, reason: string|null }}
 */
function validateDemoSmokeTarget(rawUrl, allowedHosts = ALLOWED_DEMO_HOSTS) {
    const redactedUrl = redactUrlCredentials(rawUrl);

    // Validación de tipo y contenido mínimo
    if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
        return {
            valid: false,
            normalizedUrl: null,
            redactedUrl,
            host: null,
            reason: 'URL vacía o tipo inválido.'
        };
    }

    let parsed;
    try {
        parsed = new URL(rawUrl.trim());
    } catch {
        return {
            valid: false,
            normalizedUrl: null,
            redactedUrl,
            host: null,
            reason: 'URL malformada.'
        };
    }

    // Exigimos HTTPS estricto para evitar downgrade o tráfico en texto plano
    if (parsed.protocol !== 'https:') {
        return {
            valid: false,
            normalizedUrl: null,
            redactedUrl,
            host: parsed.hostname.toLowerCase(),
            reason: `Protocolo no permitido "${parsed.protocol}"; solo se permite https:.`
        };
    }

    // Bloqueamos credenciales embebidas en la URL (Zero Hardcoded Secrets / SSRF)
    if (parsed.username || parsed.password) {
        return {
            valid: false,
            normalizedUrl: null,
            redactedUrl,
            host: parsed.hostname.toLowerCase(),
            reason: 'No se permiten credenciales embebidas en la URL.'
        };
    }

    // Bloqueamos puertos explícitos no estándar (solo 443 implícito de HTTPS)
    if (parsed.port && parsed.port !== '443') {
        return {
            valid: false,
            normalizedUrl: null,
            redactedUrl,
            host: parsed.hostname.toLowerCase(),
            reason: `Puerto no permitido "${parsed.port}"; solo se permite HTTPS estándar.`
        };
    }

    const host = parsed.hostname.toLowerCase();
    const allowSet = new Set(Array.from(allowedHosts, (h) => String(h).toLowerCase()));

    // Verificación exacta contra allowlist (evita bypass por subdominio o sufijo engañoso)
    if (!allowSet.has(host)) {
        return {
            valid: false,
            normalizedUrl: null,
            redactedUrl,
            host,
            reason: `Host "${host}" fuera de la allowlist Demo (${Array.from(allowSet).join(', ')}).`
        };
    }

    return {
        valid: true,
        normalizedUrl: parsed.toString(),
        redactedUrl: parsed.toString(),
        host,
        reason: null
    };
}

/**
 * Resuelve y valida una ruta de salida opcional `--out`, garantizando que
 * permanezca estrictamente confinada dentro de `<repoRoot>/backend/scratch/`.
 *
 * @param {string} outPath - Ruta relativa o absoluta solicitada por CLI.
 * @param {string} [repoRoot] - Raíz del repositorio.
 * @returns {string} Ruta absoluta segura dentro de `backend/scratch/`.
 */
function resolveSafeScratchOutPath(outPath, repoRoot = path.resolve(__dirname, '..')) {
    if (typeof outPath !== 'string' || outPath.trim().length === 0) {
        throw new Error('La ruta --out no puede estar vacía.');
    }

    const scratchRoot = path.resolve(repoRoot, 'backend', 'scratch');
    const resolvedTarget = path.resolve(repoRoot, outPath.trim());
    const relativeToScratch = path.relative(scratchRoot, resolvedTarget);

    // Rechazamos cualquier escape fuera de backend/scratch/ (path traversal o raíz distinta)
    if (
        relativeToScratch.length === 0 ||
        relativeToScratch.startsWith('..') ||
        path.isAbsolute(relativeToScratch)
    ) {
        throw new Error(
            `Ruta --out rechazada por seguridad: debe ubicarse dentro de "backend/scratch/" (recibido: "${outPath}").`
        );
    }

    return resolvedTarget;
}

/**
 * Detecta si un documento HTML contiene referencias prohibidas al backend productivo.
 *
 * @param {string} html - Contenido HTML recibido.
 * @returns {string[]} Lista de patrones productivos detectados (vacía si está limpio).
 */
function findProductionBackendReferences(html) {
    if (typeof html !== 'string' || html.length === 0) {
        return [];
    }
    const matches = [];
    for (const pattern of PRODUCTION_BACKEND_REFERENCE_PATTERNS) {
        if (pattern.test(html)) {
            matches.push(pattern.source);
        }
    }
    return matches;
}

/**
 * Verifica que el HTML contenga al menos un marcador inequívoco de entorno Demo.
 *
 * @param {string} html - Contenido HTML recibido.
 * @returns {boolean}
 */
function hasDemoHtmlMarker(html) {
    if (typeof html !== 'string' || html.length === 0) {
        return false;
    }
    return DEMO_HTML_MARKER_PATTERNS.some((pattern) => pattern.test(html));
}

/**
 * Ejecuta una única solicitud HTTP GET read-only con timeout estricto y cero reintentos.
 * Nunca sigue redirecciones automáticamente (`redirect: 'manual'`) para impedir saltos
 * fuera de la allowlist Demo.
 *
 * @param {string} url - URL ya validada por `validateDemoSmokeTarget`.
 * @param {object} options
 * @param {number} options.timeoutMs - Timeout estricto en milisegundos.
 * @param {Function} options.fetchImpl - Implementación de fetch (global o mock en tests).
 * @returns {Promise<{ ok: boolean, status: number|null, latencyMs: number, bodyText: string|null, redirectLocation: string|null, errorCode: string|null, errorMessage: string|null }>}
 */
async function performReadonlyGet(url, { timeoutMs, fetchImpl }) {
    const controller = new AbortController();
    const startedAt = Date.now();
    let timedOut = false;

    // Temporizador estricto que aborta la solicitud al vencer timeoutMs
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort(new Error(`Timeout de ${timeoutMs} ms excedido`));
    }, timeoutMs);

    // Evitamos mantener el event loop abierto innecesariamente si el proceso finaliza
    if (typeof timer.unref === 'function') {
        timer.unref();
    }

    try {
        const response = await fetchImpl(url, {
            method: 'GET',
            redirect: 'manual',
            headers: {
                Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
                'Cache-Control': 'no-cache',
                'User-Agent': 'WintonCoin-AG07-DemoReadonlySmoke/1.0'
            },
            signal: controller.signal
        });

        const latencyMs = Date.now() - startedAt;
        const status = Number(response.status);
        const redirectLocation =
            status >= 300 && status < 400 && response.headers && typeof response.headers.get === 'function'
                ? response.headers.get('location')
                : null;
        const bodyText = typeof response.text === 'function' ? await response.text() : '';

        return {
            ok: true,
            status,
            latencyMs,
            bodyText,
            redirectLocation,
            errorCode: null,
            errorMessage: null
        };
    } catch (error) {
        const latencyMs = Date.now() - startedAt;
        const isTimeout =
            timedOut ||
            (error && (error.name === 'AbortError' || error.name === 'TimeoutError'));

        return {
            ok: false,
            status: null,
            latencyMs,
            bodyText: null,
            redirectLocation: null,
            errorCode: isTimeout ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
            errorMessage: isTimeout
                ? `Tiempo de espera agotado tras ${timeoutMs} ms.`
                : String(error && error.message ? error.message : 'Error de red desconocido')
        };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Construye una entrada de alerta accionable normalizada.
 */
function createAlert({ checkId, priority, severity, code, message, recommendedAction }) {
    return {
        checkId,
        priority,
        severity,
        code,
        message,
        recommendedAction
    };
}

/**
 * Ejecuta la batería completa de supervisión 100% read-only sobre Demo.
 * Es determinista y testeable sin red mediante inyección de `fetchImpl`.
 *
 * @param {object} [options]
 * @param {Partial<typeof DEFAULT_TARGETS>} [options.targets] - URLs objetivo (deben pasar allowlist).
 * @param {number} [options.timeoutMs=15000] - Timeout estricto por solicitud.
 * @param {number} [options.exchangeQueueLatencyWarnMs=8000] - Umbral de latencia de advertencia para exchange-queue.
 * @param {Function} [options.fetchImpl=global.fetch] - Función fetch inyectable para pruebas unitarias.
 * @param {Function} [options.nowFn=Date.now] - Reloj inyectable para trazabilidad determinista.
 * @returns {Promise<object>} Reporte JSON estructurado sin secretos ni PII.
 */
async function runDemoReadonlySmoke(options = {}) {
    const fetchImpl = options.fetchImpl || global.fetch;
    const nowFn = typeof options.nowFn === 'function' ? options.nowFn : Date.now;
    const failOnDegraded = Boolean(options.failOnDegraded || options.strictReadiness);
    const startedMs = nowFn();
    const startedAt = new Date(startedMs).toISOString();

    const requestedTimeout = Number(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const timeoutMs =
        Number.isFinite(requestedTimeout) && requestedTimeout > 0
            ? Math.min(Math.floor(requestedTimeout), MAX_ALLOWED_TIMEOUT_MS)
            : DEFAULT_TIMEOUT_MS;

    const requestedWarnLatency = Number(
        options.exchangeQueueLatencyWarnMs ?? DEFAULT_EXCHANGE_QUEUE_WARN_LATENCY_MS
    );
    const exchangeQueueLatencyWarnMs =
        Number.isFinite(requestedWarnLatency) && requestedWarnLatency > 0
            ? Math.floor(requestedWarnLatency)
            : DEFAULT_EXCHANGE_QUEUE_WARN_LATENCY_MS;

    const targets = {
        ...DEFAULT_TARGETS,
        ...(options.targets || {})
    };

    const checks = [];
    const alerts = [];

    // ------------------------------------------------------------------------
    // FASE 1: Validación estricta de allowlist ANTES de cualquier fetch
    // ------------------------------------------------------------------------
    const targetEntries = [
        ['frontend_home', targets.frontendHome],
        ['frontend_estado_cuenta', targets.frontendEstadoCuenta],
        ['backend_web3_deployment', targets.backendDeployment],
        ['backend_web3_exchange_queue', targets.backendExchangeQueue]
    ];

    const allowlistViolations = [];
    const validatedTargets = {};

    for (const [checkId, rawUrl] of targetEntries) {
        const validation = validateDemoSmokeTarget(rawUrl);
        if (!validation.valid) {
            const safeUrlForReport = validation.redactedUrl;
            allowlistViolations.push({
                checkId,
                rawUrl: safeUrlForReport !== null ? safeUrlForReport : String(rawUrl),
                reason: validation.reason
            });
            checks.push({
                id: checkId,
                url: safeUrlForReport,
                status: 'fail',
                severity: 'critical',
                httpStatus: null,
                latencyMs: 0,
                details: {
                    allowlistRejected: true,
                    reason: validation.reason
                }
            });
            alerts.push(
                createAlert({
                    checkId,
                    priority: 'P1',
                    severity: 'critical',
                    code: 'ALLOWLIST_VIOLATION',
                    message: `Objetivo rechazado antes de conectar: ${validation.reason}`,
                    recommendedAction:
                        'Corregir la configuración para usar exclusivamente https://demo.wintoncoin.com y https://wintoncoin-backend-demo.onrender.com.'
                })
            );
        } else {
            validatedTargets[checkId] = validation.normalizedUrl;
        }
    }

    // Si existe CUALQUIER violación de allowlist, abortamos de inmediato con 0 llamadas de red
    if (allowlistViolations.length > 0) {
        const finishedMs = nowFn();
        return {
            schemaVersion: '1.0.0',
            service: 'demo-readonly-smoke',
            environment: 'demo',
            readOnly: true,
            startedAt,
            finishedAt: new Date(finishedMs).toISOString(),
            durationMs: Math.max(0, finishedMs - startedMs),
            overallStatus: 'fail',
            exitCode: 1,
            policy: {
                allowedHosts: [...ALLOWED_DEMO_HOSTS],
                expectedChainId: EXPECTED_DEMO_CHAIN_ID,
                expectedEpoch: EXPECTED_DEMO_EPOCH,
                timeoutMs,
                exchangeQueueLatencyWarnMs,
                failOnDegraded,
                maxRetries: 0,
                exchangeQueue503Policy:
                    'HTTP 503 con chainId 11155420 y estado controlado (syncing/stale/fail-closed) reporta degraded + alerta P2 (exitCode 0 en diagnóstico, exitCode 1 con --fail-on-degraded); cualquier otro 5xx/4xx/timeout/deriva de chainId o 200 no listo falla con exitCode 1.'
            },
            summary: {
                total: checks.length,
                ok: 0,
                degraded: 0,
                failed: checks.length
            },
            alerts,
            checks
        };
    }

    if (typeof fetchImpl !== 'function') {
        throw new Error('No se encontró una implementación válida de fetch (se requiere Node.js 18+ o fetchImpl).');
    }

    // ------------------------------------------------------------------------
    // FASE 2: Ejecución de los 4 checks read-only contra Demo
    // ------------------------------------------------------------------------

    // Check 1: Frontend Home Demo (https://demo.wintoncoin.com/)
    {
        const checkId = 'frontend_home';
        const url = validatedTargets[checkId];
        const res = await performReadonlyGet(url, { timeoutMs, fetchImpl });

        if (!res.ok) {
            checks.push({
                id: checkId,
                url,
                status: 'fail',
                severity: 'critical',
                httpStatus: null,
                latencyMs: res.latencyMs,
                details: { errorCode: res.errorCode, errorMessage: res.errorMessage }
            });
            alerts.push(
                createAlert({
                    checkId,
                    priority: 'P1',
                    severity: 'critical',
                    code: res.errorCode,
                    message: `Fallo al consultar ${url}: ${res.errorMessage}`,
                    recommendedAction: 'Verificar disponibilidad de GitHub Pages / Cloudflare / DNS para demo.wintoncoin.com.'
                })
            );
        } else if (res.status !== 200) {
            checks.push({
                id: checkId,
                url,
                status: 'fail',
                severity: 'critical',
                httpStatus: res.status,
                latencyMs: res.latencyMs,
                details: {
                    expectedHttpStatus: 200,
                    redirectBlocked: res.redirectLocation !== null
                }
            });
            alerts.push(
                createAlert({
                    checkId,
                    priority: 'P1',
                    severity: 'critical',
                    code: 'UNEXPECTED_HTTP_STATUS',
                    message: `Se esperaba HTTP 200 en ${url} y se recibió HTTP ${res.status}.`,
                    recommendedAction: 'Inspeccionar el despliegue del frontend Demo y descartar redirecciones o caídas.'
                })
            );
        } else {
            const hasDemoMarker = hasDemoHtmlMarker(res.bodyText);
            const prodRefs = findProductionBackendReferences(res.bodyText);
            const passed = hasDemoMarker && prodRefs.length === 0;

            checks.push({
                id: checkId,
                url,
                status: passed ? 'ok' : 'fail',
                severity: passed ? 'info' : 'critical',
                httpStatus: res.status,
                latencyMs: res.latencyMs,
                details: {
                    hasDemoMarker,
                    productionBackendReferencesFound: prodRefs
                }
            });

            if (!hasDemoMarker) {
                alerts.push(
                    createAlert({
                        checkId,
                        priority: 'P1',
                        severity: 'critical',
                        code: 'MISSING_DEMO_MARKER',
                        message: `El HTML de ${url} no contiene el marcador inequívoco de entorno Demo.`,
                        recommendedAction: 'Verificar que el build desplegado en demo.wintoncoin.com se compiló con build:demo.'
                    })
                );
            }
            if (prodRefs.length > 0) {
                alerts.push(
                    createAlert({
                        checkId,
                        priority: 'P1',
                        severity: 'critical',
                        code: 'PRODUCTION_REFERENCE_LEAK',
                        message: `Se detectaron referencias al backend productivo en ${url}: ${prodRefs.join(', ')}.`,
                        recommendedAction: 'Detener pruebas y corregir de inmediato las variables de entorno del build Demo.'
                    })
                );
            }
        }
    }

    // Check 2: Frontend Estado de Cuenta (https://demo.wintoncoin.com/estado-cuenta.html)
    {
        const checkId = 'frontend_estado_cuenta';
        const url = validatedTargets[checkId];
        const res = await performReadonlyGet(url, { timeoutMs, fetchImpl });

        if (!res.ok) {
            checks.push({
                id: checkId,
                url,
                status: 'fail',
                severity: 'critical',
                httpStatus: null,
                latencyMs: res.latencyMs,
                details: { errorCode: res.errorCode, errorMessage: res.errorMessage }
            });
            alerts.push(
                createAlert({
                    checkId,
                    priority: 'P1',
                    severity: 'critical',
                    code: res.errorCode,
                    message: `Fallo al consultar ${url}: ${res.errorMessage}`,
                    recommendedAction: 'Verificar disponibilidad de estado-cuenta.html en el despliegue Demo.'
                })
            );
        } else if (res.status !== 200) {
            checks.push({
                id: checkId,
                url,
                status: 'fail',
                severity: 'critical',
                httpStatus: res.status,
                latencyMs: res.latencyMs,
                details: {
                    expectedHttpStatus: 200,
                    redirectBlocked: res.redirectLocation !== null
                }
            });
            alerts.push(
                createAlert({
                    checkId,
                    priority: 'P1',
                    severity: 'critical',
                    code: 'UNEXPECTED_HTTP_STATUS',
                    message: `Se esperaba HTTP 200 en ${url} y se recibió HTTP ${res.status}.`,
                    recommendedAction: 'Revisar el build de Vite y el enrutamiento estático de estado-cuenta.html en Demo.'
                })
            );
        } else {
            const bundleMatch = ESTADO_CUENTA_BUNDLE_REGEX.exec(res.bodyText || '');
            const hasBundle = Boolean(bundleMatch);
            const prodRefs = findProductionBackendReferences(res.bodyText);
            const passed = hasBundle && prodRefs.length === 0;

            checks.push({
                id: checkId,
                url,
                status: passed ? 'ok' : 'fail',
                severity: passed ? 'info' : 'critical',
                httpStatus: res.status,
                latencyMs: res.latencyMs,
                details: {
                    hasEstadoCuentaBundle: hasBundle,
                    bundleAsset: bundleMatch ? bundleMatch[0] : null,
                    productionBackendReferencesFound: prodRefs
                }
            });

            if (!hasBundle) {
                alerts.push(
                    createAlert({
                        checkId,
                        priority: 'P1',
                        severity: 'critical',
                        code: 'MISSING_ESTADO_CUENTA_BUNDLE',
                        message: `El HTML de ${url} no referencia un bundle compilado estadoCuenta.*.js.`,
                        recommendedAction: 'Verificar vite.config.js y reconstruir/desplegar frontend Demo.'
                    })
                );
            }
            if (prodRefs.length > 0) {
                alerts.push(
                    createAlert({
                        checkId,
                        priority: 'P1',
                        severity: 'critical',
                        code: 'PRODUCTION_REFERENCE_LEAK',
                        message: `Se detectaron referencias al backend productivo en ${url}: ${prodRefs.join(', ')}.`,
                        recommendedAction: 'Corregir el aislamiento de variables de entorno del build Demo.'
                    })
                );
            }
        }
    }

    // Check 3: Backend Web3 Deployment (https://wintoncoin-backend-demo.onrender.com/api/web3/deployment)
    {
        const checkId = 'backend_web3_deployment';
        const url = validatedTargets[checkId];
        const res = await performReadonlyGet(url, { timeoutMs, fetchImpl });

        if (!res.ok) {
            checks.push({
                id: checkId,
                url,
                status: 'fail',
                severity: 'critical',
                httpStatus: null,
                latencyMs: res.latencyMs,
                details: { errorCode: res.errorCode, errorMessage: res.errorMessage }
            });
            alerts.push(
                createAlert({
                    checkId,
                    priority: 'P1',
                    severity: 'critical',
                    code: res.errorCode,
                    message: `Fallo al consultar ${url}: ${res.errorMessage}`,
                    recommendedAction: 'Revisar salud, cold-start o logs de Render en wintoncoin-backend-demo.'
                })
            );
        } else if (res.status !== 200) {
            checks.push({
                id: checkId,
                url,
                status: 'fail',
                severity: 'critical',
                httpStatus: res.status,
                latencyMs: res.latencyMs,
                details: { expectedHttpStatus: 200 }
            });
            alerts.push(
                createAlert({
                    checkId,
                    priority: 'P1',
                    severity: 'critical',
                    code: 'UNEXPECTED_HTTP_STATUS',
                    message: `Se esperaba HTTP 200 en ${url} y se recibió HTTP ${res.status}.`,
                    recommendedAction: 'Inspeccionar el servicio wintoncoin-backend-demo en Render.'
                })
            );
        } else {
            let payload = null;
            let parseError = null;
            try {
                payload = JSON.parse(res.bodyText || '');
            } catch (err) {
                parseError = err.message;
            }

            if (!payload || typeof payload !== 'object' || parseError) {
                checks.push({
                    id: checkId,
                    url,
                    status: 'fail',
                    severity: 'critical',
                    httpStatus: res.status,
                    latencyMs: res.latencyMs,
                    details: { validJson: false, parseError }
                });
                alerts.push(
                    createAlert({
                        checkId,
                        priority: 'P1',
                        severity: 'critical',
                        code: 'INVALID_JSON_RESPONSE',
                        message: `Respuesta JSON inválida en ${url}.`,
                        recommendedAction: 'Revisar el controlador /api/web3/deployment en backend Demo.'
                    })
                );
            } else {
                const successOk = payload.success === true;
                const chainId = payload.chainId !== undefined && payload.chainId !== null
                    ? String(payload.chainId)
                    : null;
                const epoch = typeof payload.epoch === 'string' ? payload.epoch : null;
                const chainIdOk = chainId === EXPECTED_DEMO_CHAIN_ID;
                const epochOk = epoch === EXPECTED_DEMO_EPOCH;

                // Verificamos explícitamente la señal de disponibilidad del indexador
                // soportando las variantes canónicas del contrato (`payload.indexerReady`,
                // `payload.indexer.ready` y `payload.operations.indexerReady`).
                const indexerReadySignal =
                    typeof payload.indexerReady === 'boolean'
                        ? payload.indexerReady
                        : payload.indexer && typeof payload.indexer.ready === 'boolean'
                            ? payload.indexer.ready
                            : payload.operations && typeof payload.operations.indexerReady === 'boolean'
                                ? payload.operations.indexerReady
                                : null;
                const indexerExplicitlyNotReady = indexerReadySignal === false;

                const criticalPassed = successOk && chainIdOk && epochOk;
                const checkStatus = !criticalPassed
                    ? 'fail'
                    : indexerExplicitlyNotReady
                        ? 'degraded'
                        : 'ok';
                const severity = !criticalPassed
                    ? 'critical'
                    : indexerExplicitlyNotReady
                        ? 'warning'
                        : 'info';

                checks.push({
                    id: checkId,
                    url,
                    status: checkStatus,
                    severity,
                    httpStatus: res.status,
                    latencyMs: res.latencyMs,
                    details: {
                        success: payload.success === true,
                        chainId,
                        expectedChainId: EXPECTED_DEMO_CHAIN_ID,
                        epoch,
                        expectedEpoch: EXPECTED_DEMO_EPOCH,
                        mode: typeof payload.mode === 'string' ? payload.mode : null,
                        blockNumber: payload.blockNumber ?? null,
                        indexerReady: indexerReadySignal
                    }
                });

                if (!chainIdOk) {
                    alerts.push(
                        createAlert({
                            checkId,
                            priority: 'P1',
                            severity: 'critical',
                            code: 'CHAIN_ID_DRIFT',
                            message: `Deriva de red detectada en ${url}: se esperaba chainId "${EXPECTED_DEMO_CHAIN_ID}" y se recibió "${chainId}".`,
                            recommendedAction: 'Verificar inmediatamente RPC_URL y configuración de red en wintoncoin-backend-demo.'
                        })
                    );
                }
                if (!epochOk) {
                    alerts.push(
                        createAlert({
                            checkId,
                            priority: 'P1',
                            severity: 'critical',
                            code: 'DEPLOYMENT_EPOCH_MISMATCH',
                            message: `Epoch inesperado en ${url}: se esperaba "${EXPECTED_DEMO_EPOCH}" y se recibió "${epoch}".`,
                            recommendedAction: 'Verificar manifiesto V6_DEMO desplegado en el backend Demo.'
                        })
                    );
                }
                if (!successOk) {
                    alerts.push(
                        createAlert({
                            checkId,
                            priority: 'P1',
                            severity: 'critical',
                            code: 'DEPLOYMENT_SUCCESS_FALSE',
                            message: `El endpoint ${url} devolvió success !== true.`,
                            recommendedAction: 'Revisar los logs de arranque Web3 en wintoncoin-backend-demo.'
                        })
                    );
                }
                if (criticalPassed && indexerExplicitlyNotReady) {
                    alerts.push(
                        createAlert({
                            checkId,
                            priority: 'P2',
                            severity: 'warning',
                            code: 'DEPLOYMENT_INDEXER_NOT_READY',
                            message: `El despliegue ${url} reporta indexerReady=false; el entorno Demo está degradado.`,
                            recommendedAction:
                                'Revisar el estado del indexador V6 en wintoncoin-backend-demo; usar --fail-on-degraded si se requiere readiness estricto.'
                        })
                    );
                }
            }
        }
    }

    // Check 4: Backend Web3 Exchange Queue (https://wintoncoin-backend-demo.onrender.com/api/web3/exchange-queue)
    {
        const checkId = 'backend_web3_exchange_queue';
        const url = validatedTargets[checkId];
        const res = await performReadonlyGet(url, { timeoutMs, fetchImpl });

        if (!res.ok) {
            checks.push({
                id: checkId,
                url,
                status: 'fail',
                severity: 'critical',
                httpStatus: null,
                latencyMs: res.latencyMs,
                details: { errorCode: res.errorCode, errorMessage: res.errorMessage }
            });
            alerts.push(
                createAlert({
                    checkId,
                    priority: 'P1',
                    severity: 'critical',
                    code: res.errorCode,
                    message: `Fallo al consultar ${url}: ${res.errorMessage}`,
                    recommendedAction: 'Revisar disponibilidad del backend Demo y del indexador de exchange-queue.'
                })
            );
        } else {
            let payload = null;
            let parseError = null;
            try {
                payload = JSON.parse(res.bodyText || '');
            } catch (err) {
                parseError = err.message;
            }

            if (!payload || typeof payload !== 'object' || parseError) {
                checks.push({
                    id: checkId,
                    url,
                    status: 'fail',
                    severity: 'critical',
                    httpStatus: res.status,
                    latencyMs: res.latencyMs,
                    details: { validJson: false, parseError }
                });
                alerts.push(
                    createAlert({
                        checkId,
                        priority: 'P1',
                        severity: 'critical',
                        code: 'INVALID_JSON_RESPONSE',
                        message: `Respuesta JSON inválida en ${url} (HTTP ${res.status}).`,
                        recommendedAction: 'Inspeccionar el endpoint /api/web3/exchange-queue en backend Demo.'
                    })
                );
            } else {
                const chainId = payload.chainId !== undefined && payload.chainId !== null
                    ? String(payload.chainId)
                    : null;
                const queueStatus = typeof payload.status === 'string' ? payload.status : null;
                const usableIsExplicitTrue = payload.usable === true;
                const verifiedThroughBlock = payload.verifiedThroughBlock ?? null;
                const hasValidVerifiedBlock = isPositiveIntegerBlock(verifiedThroughBlock);
                const latencyExceeded = res.latencyMs > exchangeQueueLatencyWarnMs;

                // chainId ausente o distinto de 11155420 siempre es fallo crítico P1 (nunca pasa silenciosamente)
                if (chainId === null || chainId !== EXPECTED_DEMO_CHAIN_ID) {
                    checks.push({
                        id: checkId,
                        url,
                        status: 'fail',
                        severity: 'critical',
                        httpStatus: res.status,
                        latencyMs: res.latencyMs,
                        details: {
                            chainId,
                            expectedChainId: EXPECTED_DEMO_CHAIN_ID,
                            queueStatus,
                            usable: typeof payload.usable === 'boolean' ? payload.usable : null,
                            verifiedThroughBlock
                        }
                    });
                    alerts.push(
                        createAlert({
                            checkId,
                            priority: 'P1',
                            severity: 'critical',
                            code: 'CHAIN_ID_MISSING_OR_DRIFT',
                            message: `chainId ausente o con deriva en ${url}: se esperaba "${EXPECTED_DEMO_CHAIN_ID}" y se recibió "${chainId}".`,
                            recommendedAction: 'Verificar inmediatamente el indexador y RPC del entorno Demo.'
                        })
                    );
                } else if (res.status === 200) {
                    // En HTTP 200 exigimos TODAS las condiciones explícitas de readiness para marcar OK.
                    // Nunca asumimos fallback a "ready", nunca ignoramos usable !== true ni verifiedThroughBlock nulo.
                    const failedReadinessChecks = [];
                    if (payload.success !== true) {
                        failedReadinessChecks.push('success !== true');
                    }
                    if (queueStatus !== 'ready') {
                        failedReadinessChecks.push(`status="${queueStatus}" !== "ready"`);
                    }
                    if (!usableIsExplicitTrue) {
                        failedReadinessChecks.push(`usable=${String(payload.usable)} !== true`);
                    }
                    if (!hasValidVerifiedBlock) {
                        failedReadinessChecks.push(
                            `verifiedThroughBlock=${String(verifiedThroughBlock)} no es entero positivo`
                        );
                    }

                    if (failedReadinessChecks.length > 0) {
                        checks.push({
                            id: checkId,
                            url,
                            status: 'fail',
                            severity: 'critical',
                            httpStatus: res.status,
                            latencyMs: res.latencyMs,
                            details: {
                                chainId,
                                success: payload.success === true,
                                queueStatus,
                                usable: typeof payload.usable === 'boolean' ? payload.usable : null,
                                verifiedThroughBlock,
                                failedReadinessChecks,
                                latencyExceeded,
                                latencyWarnThresholdMs: exchangeQueueLatencyWarnMs
                            }
                        });
                        alerts.push(
                            createAlert({
                                checkId,
                                priority: 'P1',
                                severity: 'critical',
                                code: 'EXCHANGE_QUEUE_NOT_READY_ON_200',
                                message: `HTTP 200 en ${url} sin cumplir readiness completo (${failedReadinessChecks.join('; ')}).`,
                                recommendedAction:
                                    'Inspeccionar el controlador /api/web3/exchange-queue y el indexador V6: una cola no utilizable no debe reportarse como lista.'
                            })
                        );
                    } else {
                        const checkStatus = latencyExceeded ? 'degraded' : 'ok';
                        const severity = latencyExceeded ? 'warning' : 'info';

                        checks.push({
                            id: checkId,
                            url,
                            status: checkStatus,
                            severity,
                            httpStatus: res.status,
                            latencyMs: res.latencyMs,
                            details: {
                                chainId,
                                queueStatus,
                                usable: true,
                                verifiedThroughBlock: String(verifiedThroughBlock),
                                latencyExceeded,
                                latencyWarnThresholdMs: exchangeQueueLatencyWarnMs
                            }
                        });

                        if (latencyExceeded) {
                            alerts.push(
                                createAlert({
                                    checkId,
                                    priority: 'P2',
                                    severity: 'warning',
                                    code: 'EXCHANGE_QUEUE_HIGH_LATENCY',
                                    message: `Latencia elevada en ${url}: ${res.latencyMs} ms (umbral: ${exchangeQueueLatencyWarnMs} ms).`,
                                    recommendedAction: 'Revisar carga de PostgreSQL y tiempo de respuesta del indexador V6 en Demo.'
                                })
                            );
                        }
                    }
                } else if (
                    res.status === 503 &&
                    (CONTROLLED_QUEUE_503_STATUSES.includes(String(queueStatus || '').toLowerCase()) ||
                        payload.usable === false)
                ) {
                    // 503 controlado (syncing / stale / fail-closed):
                    // en modo diagnóstico reporta degraded + alerta P2 (exitCode 0);
                    // en modo --fail-on-degraded devuelve exitCode 1.
                    checks.push({
                        id: checkId,
                        url,
                        status: 'degraded',
                        severity: 'warning',
                        httpStatus: res.status,
                        latencyMs: res.latencyMs,
                        details: {
                            chainId,
                            queueStatus: queueStatus || 'fail-closed',
                            usable: false,
                            controlledFailClosed: true,
                            verifiedThroughBlock,
                            latencyExceeded,
                            latencyWarnThresholdMs: exchangeQueueLatencyWarnMs
                        }
                    });

                    alerts.push(
                        createAlert({
                            checkId,
                            priority: 'P2',
                            severity: 'warning',
                            code: 'EXCHANGE_QUEUE_CONTROLLED_503',
                            message: `Cola de intercambio en fail-closed controlado (HTTP 503, status="${queueStatus || 'unknown'}", verifiedThroughBlock="${verifiedThroughBlock ?? 'n/a'}").`,
                            recommendedAction:
                                'Verificar si el worker exchangeIndexerV6 en Demo está resincronizando bloques; usar --fail-on-degraded para exigir readiness sostenido.'
                        })
                    );
                } else {
                    checks.push({
                        id: checkId,
                        url,
                        status: 'fail',
                        severity: 'critical',
                        httpStatus: res.status,
                        latencyMs: res.latencyMs,
                        details: {
                            chainId,
                            queueStatus,
                            usable: typeof payload.usable === 'boolean' ? payload.usable : null,
                            verifiedThroughBlock,
                            controlledFailClosed: false
                        }
                    });
                    alerts.push(
                        createAlert({
                            checkId,
                            priority: 'P1',
                            severity: 'critical',
                            code: 'EXCHANGE_QUEUE_UNEXPECTED_STATE',
                            message: `Estado inesperado en ${url}: HTTP ${res.status}, success=${String(payload.success)}, status="${queueStatus}".`,
                            recommendedAction: 'Inspeccionar logs del backend Demo y el estado del indexador V6.'
                        })
                    );
                }
            }
        }
    }

    // ------------------------------------------------------------------------
    // FASE 3: Consolidación de veredicto y métricas
    // ------------------------------------------------------------------------
    const summary = {
        total: checks.length,
        ok: checks.filter((c) => c.status === 'ok').length,
        degraded: checks.filter((c) => c.status === 'degraded').length,
        failed: checks.filter((c) => c.status === 'fail').length
    };

    const overallStatus =
        summary.failed > 0 ? 'fail' : summary.degraded > 0 ? 'degraded' : 'ok';
    const exitCode =
        summary.failed > 0 || (failOnDegraded && summary.degraded > 0) ? 1 : 0;
    const finishedMs = nowFn();

    return {
        schemaVersion: '1.0.0',
        service: 'demo-readonly-smoke',
        environment: 'demo',
        readOnly: true,
        startedAt,
        finishedAt: new Date(finishedMs).toISOString(),
        durationMs: Math.max(0, finishedMs - startedMs),
        overallStatus,
        exitCode,
        policy: {
            allowedHosts: [...ALLOWED_DEMO_HOSTS],
            expectedChainId: EXPECTED_DEMO_CHAIN_ID,
            expectedEpoch: EXPECTED_DEMO_EPOCH,
            timeoutMs,
            exchangeQueueLatencyWarnMs,
            failOnDegraded,
            maxRetries: 0,
            exchangeQueue503Policy:
                'HTTP 503 con chainId 11155420 y estado controlado (syncing/stale/fail-closed) reporta degraded + alerta P2 (exitCode 0 en diagnóstico, exitCode 1 con --fail-on-degraded); cualquier otro 5xx/4xx/timeout/deriva de chainId o 200 no listo falla con exitCode 1.'
        },
        summary,
        alerts,
        checks
    };
}

/**
 * Parsea argumentos CLI mínimos (`--out <ruta>`, `--timeout-ms <ms>`,
 * `--fail-on-degraded`, `--strict-readiness`).
 *
 * @param {string[]} argv
 * @returns {{ outPath: string|null, timeoutMs: number|undefined, failOnDegraded: boolean }}
 */
function parseCliArgs(argv) {
    let outPath = null;
    let timeoutMs;
    let failOnDegraded = false;

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--out') {
            outPath = argv[i + 1] || '';
            i += 1;
        } else if (arg.startsWith('--out=')) {
            outPath = arg.slice('--out='.length);
        } else if (arg === '--timeout-ms') {
            timeoutMs = Number(argv[i + 1]);
            i += 1;
        } else if (arg.startsWith('--timeout-ms=')) {
            timeoutMs = Number(arg.slice('--timeout-ms='.length));
        } else if (arg === '--fail-on-degraded' || arg === '--strict-readiness') {
            failOnDegraded = true;
        }
    }

    return { outPath, timeoutMs, failOnDegraded };
}

/**
 * Punto de entrada CLI: ejecuta el smoke read-only, imprime JSON limpio en stdout
 * y opcionalmente guarda una copia en `backend/scratch/` si se indicó `--out`.
 */
async function main() {
    const { outPath, timeoutMs, failOnDegraded } = parseCliArgs(process.argv.slice(2));
    let safeOutFile = null;

    if (outPath !== null) {
        safeOutFile = resolveSafeScratchOutPath(outPath);
    }

    const report = await runDemoReadonlySmoke({ timeoutMs, failOnDegraded });
    const serialized = JSON.stringify(report, null, 2);

    if (safeOutFile) {
        fs.mkdirSync(path.dirname(safeOutFile), { recursive: true });
        fs.writeFileSync(safeOutFile, `${serialized}\n`, 'utf8');
    }

    process.stdout.write(`${serialized}\n`);
    process.exitCode = report.exitCode;
}

if (require.main === module) {
    main().catch((error) => {
        const fatalReport = {
            schemaVersion: '1.0.0',
            service: 'demo-readonly-smoke',
            environment: 'demo',
            readOnly: true,
            overallStatus: 'fail',
            exitCode: 1,
            error: String(error && error.message ? error.message : 'Error fatal no controlado')
        };
        process.stdout.write(`${JSON.stringify(fatalReport, null, 2)}\n`);
        process.exitCode = 1;
    });
}

module.exports = {
    ALLOWED_DEMO_HOSTS,
    EXPECTED_DEMO_CHAIN_ID,
    EXPECTED_DEMO_EPOCH,
    DEFAULT_TIMEOUT_MS,
    DEFAULT_EXCHANGE_QUEUE_WARN_LATENCY_MS,
    CONTROLLED_QUEUE_503_STATUSES,
    DEFAULT_TARGETS,
    redactUrlCredentials,
    isPositiveIntegerBlock,
    validateDemoSmokeTarget,
    resolveSafeScratchOutPath,
    parseCliArgs,
    runDemoReadonlySmoke
};
