/**
 * ============================================================================
 * [WINTONCOIN] - PANEL DE INVENTARIO SQL DEMO (SOLO LECTURA)
 * ============================================================================
 * Componente React modular para la ruta administrativa canónica `/admin/web3`.
 *
 * Propósito:
 * Permitir al administrador generar una fotografía auditable de solo lectura
 * del inventario SQL en el entorno Demo (`GET /api/admin/web3/demo-inventory`),
 * visualizar el estado de migraciones (128..131) y conteos de conciliación,
 * y —únicamente bajo acción explícita— cargar el detalle para conciliación
 * (`?detail=true`), copiarlo o descargarlo en formato JSON.
 *
 * Garantías de Seguridad y Cumplimiento (Zero-Trust / SOC 2 / CODEX-209):
 * 1. Usa exclusivamente la sesión administrativa canónica (`credentials: 'include'`)
 *    y `cache: 'no-store'`. Cero secretos embebidos y cero URLs/hosts/SQL
 *    editables por el usuario.
 * 2. Cero persistencia en `localStorage` ni `sessionStorage`: el inventario
 *    (y especialmente el detalle con IDs/direcciones vinculables) vive solo en
 *    memoria React mientras la vista permanece abierta.
 * 3. Fail-closed en UI: si `completeness.sqlComplete === false` o
 *    `completeness.truncated === true`, se muestra una alerta explícita de
 *    inventario INCOMPLETO y jamás se presenta como apto.
 * 4. Solo lectura: el inventario no activa contratos, no modifica saldos ni
 *    reglas de paridad 1:1 (BLUE / compromiso RED) y no equivale a autorización
 *    de corte.
 * 5. Terminología canónica: siempre "compromiso RED" (nunca términos prohibidos).
 * ============================================================================
 */

import React, { useEffect, useRef, useState } from 'react';
import { getApiUrl } from '../../modules/config.js';

// Tiempo máximo de espera del cliente para la consulta administrativa (60s)
const CLIENT_TIMEOUT_MS = 60_000;

// Catálogo canónico de migraciones opcionales a reportar (128..131)
const CANONICAL_MIGRATIONS = Object.freeze([
  {
    key: '128_credit_penalty_episode',
    code: '128',
    label: 'Episodio de penalización de compromiso RED'
  },
  {
    key: '129_credit_notification_outbox',
    code: '129',
    label: 'Bandeja de salida de notificaciones de compromiso'
  },
  {
    key: '130_credit_referral_episode_awards',
    code: '130',
    label: 'Bonificaciones de referidos por episodio'
  },
  {
    key: '131_publication_base_precision',
    code: '131',
    label: 'Precisión NUMERIC(30,6) en publicaciones'
  }
]);

// Etiquetas legibles alineadas con las claves escalares reales de `summaryCounts` en adminDemoInventoryController.js
const RECONCILIATION_COUNT_LABELS = Object.freeze([
  { key: 'users', label: 'Usuarios registrados' },
  { key: 'publicationsActive', label: 'Publicaciones activas' },
  { key: 'publicationAcceptancesPending', label: 'Aceptaciones pendientes' },
  { key: 'escrowHoldsActive', label: 'Retenciones escrow activas' },
  { key: 'moraEpisodes', label: 'Episodios de mora (compromiso RED)' },
  { key: 'creditPolicyIssuesUnresolved', label: 'Incidencias de política sin resolver' },
  { key: 'deadLetterCount', label: 'Incidencias en dead-letter' },
  { key: 'outboxPending', label: 'Notificaciones outbox pendientes' },
  { key: 'referralAwardsActive', label: 'Premios de referidos activos' },
  { key: 'chainOpsActive', label: 'Operaciones on-chain activas' }
]);

/**
 * Construye el endpoint fijo del inventario SQL Demo.
 * No acepta hosts, rutas ni parámetros arbitrarios del usuario.
 */
export function buildInventoryEndpoint(apiUrl, includeDetail = false) {
  const base = typeof apiUrl === 'string' ? apiUrl.replace(/\/+$/, '') : '';
  const suffix = includeDetail ? '?detail=true' : '';
  return `${base}/api/admin/web3/demo-inventory${suffix}`;
}

/**
 * Traduce un fallo HTTP o de red a un mensaje accionable para el administrador,
 * sin filtrar credenciales ni fingir disponibilidad.
 */
export function formatInventoryError(httpStatus, payload, error) {
  if (error && error.name === 'AbortError') {
    return {
      code: 'CLIENT_TIMEOUT',
      title: 'Tiempo de espera agotado',
      message: 'La consulta del inventario Demo superó el tiempo de espera del navegador. Puedes reintentar sin riesgo: la operación es de solo lectura.',
      requiresRelogin: false
    };
  }

  const serverMessage =
    typeof payload?.message === 'string' && payload.message.trim().length > 0
      ? payload.message.trim()
      : null;

  const serverCode =
    typeof payload?.code === 'string' && payload.code.trim().length > 0
      ? payload.code.trim()
      : null;

  // Un HTTP 403 con código DEMO_* proviene de la guarda fail-closed del entorno Demo,
  // no de una sesión administrativa expirada o revocada.
  if (httpStatus === 403 && serverCode && serverCode.startsWith('DEMO_')) {
    return {
      code: serverCode,
      title: 'Configuración Demo no habilitada o incompleta',
      message:
        serverMessage ||
        'La guarda del entorno Demo bloqueó esta consulta por configuración o identidad de red.',
      requiresRelogin: false
    };
  }

  if (httpStatus === 401 || httpStatus === 403) {
    return {
      code: `HTTP_${httpStatus}`,
      title: 'Sesión administrativa no autorizada',
      message:
        serverMessage ||
        'Tu sesión administrativa no está autorizada o fue revocada. Vuelve a iniciar sesión como administrador.',
      requiresRelogin: true
    };
  }

  if (httpStatus === 404) {
    return {
      code: 'HTTP_404',
      title: 'Inventario Demo no disponible en este entorno',
      message:
        serverMessage ||
        'La ruta de inventario SQL Demo solo está habilitada en el entorno Demo autorizado.',
      requiresRelogin: false
    };
  }

  if (httpStatus === 409) {
    return {
      code: 'HTTP_409',
      title: 'Solicitud en conflicto o bloqueada temporalmente',
      message:
        serverMessage ||
        'Ya existe una generación de inventario en curso o la precondición del entorno Demo no se cumplió. Espera unos segundos y reintenta.',
      requiresRelogin: false
    };
  }

  if (httpStatus === 429) {
    return {
      code: 'HTTP_429',
      title: 'Límite de frecuencia alcanzado',
      message:
        serverMessage ||
        'Se alcanzó el límite temporal de consultas de inventario. Espera un momento antes de reintentar.',
      requiresRelogin: false
    };
  }

  if (typeof httpStatus === 'number' && httpStatus >= 500) {
    return {
      code: `HTTP_${httpStatus}`,
      title: `Error del servidor (HTTP ${httpStatus})`,
      message:
        serverMessage ||
        `El servidor no pudo completar la lectura del inventario SQL Demo (HTTP ${httpStatus}). Reintenta la operación.`,
      requiresRelogin: false
    };
  }

  return {
    code: httpStatus ? `HTTP_${httpStatus}` : 'NETWORK_ERROR',
    title: 'No se pudo obtener el inventario Demo',
    message:
      serverMessage ||
      (error?.message ? String(error.message) : 'Ocurrió un error de red al consultar el inventario SQL Demo.'),
    requiresRelogin: false
  };
}

/**
 * Clasifica la respuesta JSON del servidor en uno de tres estados seguros:
 * - 'error': respuesta inválida o fallida (HTTP != 200 o sin objeto JSON válido).
 * - 'incomplete': `completeness.sqlComplete === false` o `completeness.truncated === true`
 *   (fail-closed: jamás se marca como apto).
 * - 'success': snapshot SQL completo y no truncado.
 */
export function classifyInventoryResponse(httpStatus, payload) {
  if (httpStatus < 200 || httpStatus >= 300 || !payload || typeof payload !== 'object') {
    return {
      status: 'error',
      error: formatInventoryError(httpStatus, payload, null),
      data: null
    };
  }

  if (payload.success === false && !payload.completeness) {
    return {
      status: 'error',
      error: formatInventoryError(httpStatus, payload, null),
      data: null
    };
  }

  const completeness = payload.completeness && typeof payload.completeness === 'object'
    ? payload.completeness
    : null;

  const isSqlComplete = completeness
    ? completeness.sqlComplete === true
    : payload.sql?.complete === true;

  const isTruncated = completeness
    ? completeness.truncated === true
    : payload.truncated === true;

  // Regla fail-closed: si falta confirmación explícita de completitud o hubo truncamiento,
  // el inventario se clasifica como INCOMPLETO y nunca como apto.
  if (!isSqlComplete || isTruncated) {
    return {
      status: 'incomplete',
      error: null,
      data: payload,
      completenessFlags: {
        sqlComplete: Boolean(isSqlComplete),
        truncated: Boolean(isTruncated)
      }
    };
  }

  return {
    status: 'success',
    error: null,
    data: payload,
    completenessFlags: {
      sqlComplete: true,
      truncated: false
    }
  };
}

/**
 * Normaliza el estado de las migraciones 128..131 desde la estructura devuelta
 * por el backend (soporta ubicación en `migrations`, `schema.optionalMigrations`
 * o `sql.schema.optionalMigrations`).
 */
export function extractMigrationsStatus(payload) {
  const source =
    payload?.migrations ||
    payload?.schema?.optionalMigrations ||
    payload?.sql?.schema?.optionalMigrations ||
    {};

  return CANONICAL_MIGRATIONS.map((item) => {
    const entry = source[item.key] ?? source[item.code];
    let present = null;
    if (typeof entry === 'boolean') {
      present = entry;
    } else if (entry && typeof entry === 'object' && typeof entry.present === 'boolean') {
      present = entry.present;
    }

    return {
      ...item,
      present
    };
  });
}

/**
 * Extrae los conteos escalares de conciliación SQL sin inventar ceros cuando el
 * servidor no reportó una métrica concreta, ignorando objetos anidados para no
 * renderizar jamás "[object Object]".
 */
export function extractReconciliationCounts(payload) {
  // Fuente primaria canónica del controlador backend: `payload.summaryCounts`
  const explicitCounts =
    payload?.summaryCounts ||
    payload?.counts ||
    payload?.summary?.counts ||
    payload?.reconciliationCounts ||
    null;

  const sql = payload?.sql || null;

  const derived = {};
  if (explicitCounts && typeof explicitCounts === 'object') {
    for (const [k, v] of Object.entries(explicitCounts)) {
      // Aceptar únicamente valores escalares (string o number finito); ignorar objetos anidados
      // como publicationAcceptancesByStatus, creditPolicyIssuesByStatus, outboxByStatus,
      // referralAwardsByBaseline o countsByState.
      if (typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))) {
        derived[k] = String(v);
      }
    }
  }

  // Fallback seguro si se inyecta un bloque `sql` crudo sin `summaryCounts`
  if (sql && typeof sql === 'object') {
    const arrayCount = (arr) => (Array.isArray(arr) ? String(arr.length) : undefined);
    if (derived.users === undefined && arrayCount(sql.users) !== undefined) derived.users = arrayCount(sql.users);
    if (derived.publicationsActive === undefined && arrayCount(sql.publicationsActive) !== undefined) derived.publicationsActive = arrayCount(sql.publicationsActive);
    if (derived.publicationAcceptancesPending === undefined && arrayCount(sql.publicationAcceptancesPending) !== undefined) derived.publicationAcceptancesPending = arrayCount(sql.publicationAcceptancesPending);
    if (derived.escrowHoldsActive === undefined && arrayCount(sql.escrowHoldsActive) !== undefined) derived.escrowHoldsActive = arrayCount(sql.escrowHoldsActive);
    if (derived.moraEpisodes === undefined && arrayCount(sql.moraEpisodes) !== undefined) derived.moraEpisodes = arrayCount(sql.moraEpisodes);
    if (derived.creditPolicyIssuesUnresolved === undefined && arrayCount(sql.policy?.openCreditPolicyIssues) !== undefined) derived.creditPolicyIssuesUnresolved = arrayCount(sql.policy.openCreditPolicyIssues);
    if (derived.outboxPending === undefined && arrayCount(sql.creditNotificationOutbox?.pendingItems) !== undefined) derived.outboxPending = arrayCount(sql.creditNotificationOutbox.pendingItems);
    if (derived.referralAwardsActive === undefined && arrayCount(sql.creditReferralAwards?.activeAwards) !== undefined) derived.referralAwardsActive = arrayCount(sql.creditReferralAwards.activeAwards);
    if (derived.chainOpsActive === undefined && arrayCount(sql.chainOperations?.activeOperations) !== undefined) derived.chainOpsActive = arrayCount(sql.chainOperations.activeOperations);
  }

  const rows = [];
  const seen = new Set();

  for (const def of RECONCILIATION_COUNT_LABELS) {
    if (derived[def.key] !== undefined) {
      rows.push({ key: def.key, label: def.label, value: derived[def.key] });
      seen.add(def.key);
    }
  }

  // Incluir cualquier conteo adicional enviado por el backend para no perder visibilidad
  for (const [key, value] of Object.entries(derived)) {
    if (!seen.has(key) && (typeof value === 'string' || typeof value === 'number')) {
      rows.push({ key, label: key, value: String(value) });
    }
  }

  return rows;
}

/**
 * Extrae metadatos de identidad Demo para auditoría visual.
 */
export function extractDemoIdentity(payload) {
  const identity = payload?.demoIdentity || payload?.environment || {};
  return {
    environment: identity.environmentId || identity.environment || (identity.isDemo ? 'demo' : 'No reportado'),
    epoch: identity.epoch || 'V6_DEMO',
    chainId: identity.chainId !== undefined && identity.chainId !== null ? String(identity.chainId) : 'No reportado',
    databaseName:
      identity.databaseName ||
      identity.databaseNameObserved ||
      payload?.sql?.databaseNameObserved ||
      'No reportada',
    target: identity.target || payload?.sql?.target || 'No reportado',
    exporterVersion: payload?.exporterVersion || payload?.schemaVersion || 'No reportada'
  };
}

/**
 * Ejecuta la llamada autenticada de solo lectura al endpoint canónico
 * `GET /api/admin/web3/demo-inventory` (o con `?detail=true` bajo clic explícito).
 * No toca `localStorage` ni `sessionStorage`.
 */
export async function fetchDemoInventory({
  apiUrl = getApiUrl(),
  includeDetail = false,
  fetchImpl = globalThis.fetch,
  signal
} = {}) {
  const endpoint = buildInventoryEndpoint(apiUrl, includeDetail);
  try {
    const response = await fetchImpl(endpoint, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal,
      headers: {
        Accept: 'application/json'
      }
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const classified = classifyInventoryResponse(response.status, payload);
    return {
      ...classified,
      includeDetail: Boolean(includeDetail),
      httpStatus: response.status
    };
  } catch (error) {
    return {
      status: 'error',
      error: formatInventoryError(null, null, error),
      data: null,
      includeDetail: Boolean(includeDetail),
      httpStatus: null
    };
  }
}

/**
 * Formatea una fecha ISO para visualización legible manteniendo el valor exacto.
 */
function formatCapturedAt(rawTimestamp) {
  if (!rawTimestamp) return 'No reportado';
  const parsed = new Date(rawTimestamp);
  if (Number.isNaN(parsed.getTime())) return String(rawTimestamp);
  return `${parsed.toLocaleString()} (${rawTimestamp})`;
}

/**
 * Estilos responsivos autocontenidos coherentes con AdminWeb3Panel (dark glassmorphism).
 */
const PANEL_STYLES = {
  section: {
    background: 'rgba(15, 23, 42, 0.82)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(56, 189, 248, 0.25)',
    borderRadius: '1rem',
    padding: '1.25rem',
    marginBottom: '1.75rem',
    color: '#f1f5f9',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.35)'
  },
  headerRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '1rem'
  },
  title: {
    margin: '0 0 0.35rem 0',
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap'
  },
  badgeReadOnly: {
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '0.2rem 0.55rem',
    borderRadius: '9999px',
    background: 'rgba(56, 189, 248, 0.14)',
    color: '#38bdf8',
    border: '1px solid rgba(56, 189, 248, 0.35)'
  },
  subtitle: {
    margin: 0,
    fontSize: '0.86rem',
    color: '#94a3b8',
    lineHeight: 1.45,
    maxWidth: '70ch'
  },
  actionsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.65rem',
    alignItems: 'center'
  },
  primaryBtn: {
    background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '0.55rem',
    padding: '0.65rem 1.15rem',
    fontSize: '0.88rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '40px'
  },
  secondaryBtn: {
    background: 'rgba(30, 41, 59, 0.9)',
    color: '#e2e8f0',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    borderRadius: '0.55rem',
    padding: '0.6rem 1rem',
    fontSize: '0.84rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '38px'
  },
  disabledBtn: {
    opacity: 0.55,
    cursor: 'not-allowed'
  },
  noticeBox: {
    background: 'rgba(2, 6, 23, 0.5)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: '0.7rem',
    padding: '0.85rem 1rem',
    fontSize: '0.82rem',
    color: '#cbd5e1',
    lineHeight: 1.5,
    marginBottom: '1rem'
  },
  loadingBox: {
    background: 'rgba(14, 165, 233, 0.1)',
    border: '1px solid rgba(56, 189, 248, 0.35)',
    borderRadius: '0.75rem',
    padding: '1rem',
    color: '#bae6fd',
    fontSize: '0.88rem',
    marginTop: '0.75rem'
  },
  errorBox: {
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(248, 113, 113, 0.4)',
    borderRadius: '0.75rem',
    padding: '1rem',
    color: '#fecaca',
    marginTop: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem'
  },
  incompleteBox: {
    background: 'rgba(245, 158, 11, 0.14)',
    border: '1px solid rgba(251, 191, 36, 0.55)',
    borderRadius: '0.75rem',
    padding: '1rem',
    color: '#fde68a',
    marginTop: '0.75rem',
    marginBottom: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  successBanner: {
    background: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(52, 211, 153, 0.35)',
    borderRadius: '0.75rem',
    padding: '0.85rem 1rem',
    color: '#a7f3d0',
    fontSize: '0.86rem',
    marginTop: '0.75rem',
    marginBottom: '1rem'
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: '0.75rem',
    marginBottom: '1.15rem'
  },
  tile: {
    background: 'rgba(2, 6, 23, 0.52)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: '0.65rem',
    padding: '0.8rem 0.95rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    minWidth: 0
  },
  tileLabel: {
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#94a3b8',
    fontWeight: 600
  },
  tileValue: {
    fontSize: '0.92rem',
    fontWeight: 700,
    color: '#f8fafc',
    wordBreak: 'break-word'
  },
  subHeading: {
    margin: '1rem 0 0.6rem 0',
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#e2e8f0'
  },
  migrationsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '0.65rem',
    marginBottom: '1.1rem'
  },
  badgeOk: {
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: '0.3rem',
    background: 'rgba(16, 185, 129, 0.18)',
    color: '#34d399',
    fontSize: '0.75rem',
    fontWeight: 700
  },
  badgePending: {
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: '0.3rem',
    background: 'rgba(245, 158, 11, 0.18)',
    color: '#fbbf24',
    fontSize: '0.75rem',
    fontWeight: 700
  },
  badgeUnknown: {
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: '0.3rem',
    background: 'rgba(148, 163, 184, 0.18)',
    color: '#cbd5e1',
    fontSize: '0.75rem',
    fontWeight: 700
  },
  detailSection: {
    marginTop: '1.1rem',
    paddingTop: '1rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  privacyWarning: {
    background: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '0.65rem',
    padding: '0.75rem 0.9rem',
    fontSize: '0.8rem',
    color: '#fde68a',
    lineHeight: 1.45
  },
  jsonPreview: {
    background: 'rgba(2, 6, 23, 0.78)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: '0.65rem',
    padding: '0.85rem',
    color: '#cbd5e1',
    fontSize: '0.76rem',
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    overflowX: 'auto',
    maxHeight: '320px',
    margin: 0
  },
  feedbackMsg: {
    fontSize: '0.82rem',
    color: '#38bdf8',
    fontWeight: 600
  }
};

/**
 * Panel administrativo de inventario SQL Demo (solo lectura).
 * @param {object} props
 * @param {object} [props.initialState] Estado inicial opcional exclusivamente para pruebas deterministas de renderizado.
 */
export default function DemoInventoryPanel({ initialState = null } = {}) {
  const [status, setStatus] = useState(initialState?.status || 'idle'); // 'idle' | 'loading' | 'error' | 'incomplete' | 'success'
  const [loadingMode, setLoadingMode] = useState(initialState?.loadingMode || 'summary'); // 'summary' | 'detail'
  const [inventoryData, setInventoryData] = useState(initialState?.data || null);
  const [detailLoaded, setDetailLoaded] = useState(Boolean(initialState?.detailLoaded));
  const [errorInfo, setErrorInfo] = useState(initialState?.error || null);
  const [completenessFlags, setCompletenessFlags] = useState(initialState?.completenessFlags || null);
  const [actionFeedback, setActionFeedback] = useState('');

  // Referencia al AbortController activo para cancelar solicitudes si el componente se desmonta
  const activeControllerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }
    };
  }, []);

  const isLoading = status === 'loading';

  /**
   * Dispara la consulta de inventario (resumen por defecto o detalle bajo clic explícito).
   */
  const runInventoryRequest = async (includeDetail = false) => {
    if (isLoading) return;

    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    setStatus('loading');
    setLoadingMode(includeDetail ? 'detail' : 'summary');
    setErrorInfo(null);
    setActionFeedback('');

    try {
      const result = await fetchDemoInventory({
        apiUrl: getApiUrl(),
        includeDetail,
        signal: controller.signal
      });

      if (controller.signal.aborted && result.error?.code !== 'CLIENT_TIMEOUT') {
        return;
      }

      if (result.status === 'error') {
        setStatus('error');
        setErrorInfo(result.error);
        setInventoryData(null);
        setDetailLoaded(false);
        setCompletenessFlags(null);
        return;
      }

      setInventoryData(result.data);
      setCompletenessFlags(result.completenessFlags || null);
      setDetailLoaded(Boolean(includeDetail));
      setStatus(result.status); // 'success' | 'incomplete'
    } finally {
      clearTimeout(timeoutId);
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
    }
  };

  /**
   * Copia el JSON en memoria al portapapeles bajo acción explícita del administrador.
   */
  const handleCopyJson = async () => {
    if (!inventoryData) return;
    try {
      const serialized = JSON.stringify(inventoryData, null, 2);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(serialized);
        setActionFeedback('JSON copiado al portapapeles (sin persistencia local).');
      } else {
        setActionFeedback('Tu navegador no permite copia automática; utiliza "Descargar JSON".');
      }
    } catch {
      setActionFeedback('No se pudo copiar al portapapeles. Utiliza "Descargar JSON".');
    }
  };

  /**
   * Descarga el JSON en memoria como archivo local bajo acción explícita del administrador.
   */
  const handleDownloadJson = () => {
    if (!inventoryData) return;
    try {
      const serialized = JSON.stringify(inventoryData, null, 2);
      const blob = new Blob([serialized], { type: 'application/json;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);
      const stamp = (inventoryData.capturedAt || new Date().toISOString()).replace(/[:.]/g, '-');
      const scope = detailLoaded ? 'detail' : 'summary';
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `wintoncoin-demo-inventory-${scope}-${stamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
      setActionFeedback(`Archivo JSON (${scope}) descargado.`);
    } catch {
      setActionFeedback('No se pudo iniciar la descarga del archivo JSON.');
    }
  };

  const capturedAt = inventoryData?.capturedAt || inventoryData?.generatedAt || null;
  const demoIdentity = inventoryData ? extractDemoIdentity(inventoryData) : null;
  const migrations = inventoryData ? extractMigrationsStatus(inventoryData) : [];
  const counts = inventoryData ? extractReconciliationCounts(inventoryData) : [];
  const reportedErrors = Array.isArray(inventoryData?.errors)
    ? inventoryData.errors
    : Array.isArray(inventoryData?.errors?.sql)
      ? inventoryData.errors.sql
      : [];

  return (
    <section
      aria-label="Inventario SQL Demo (solo lectura)"
      aria-busy={isLoading}
      style={PANEL_STYLES.section}
    >
      <div style={PANEL_STYLES.headerRow}>
        <div>
          <h2 style={PANEL_STYLES.title}>
            <span>🧾 Inventario SQL Demo</span>
            <span style={PANEL_STYLES.badgeReadOnly}>Solo lectura</span>
          </h2>
          <p style={PANEL_STYLES.subtitle}>
            Genera un resumen auditable de la base de datos Demo en una transacción de solo lectura
            para verificar migraciones (128..131) y conteos de conciliación SQL.
          </p>
        </div>

        <div style={PANEL_STYLES.actionsRow}>
          <button
            type="button"
            onClick={() => runInventoryRequest(false)}
            disabled={isLoading}
            style={{
              ...PANEL_STYLES.primaryBtn,
              ...(isLoading ? PANEL_STYLES.disabledBtn : {})
            }}
          >
            {isLoading && loadingMode === 'summary'
              ? 'Generando inventario Demo…'
              : 'Generar inventario Demo'}
          </button>
        </div>
      </div>

      {/* Aviso permanente de alcance de solo lectura y paridad 1:1 */}
      <div style={PANEL_STYLES.noticeBox}>
        <strong>Alcance de solo lectura:</strong> este inventario consulta únicamente metadatos y
        conteos SQL del entorno Demo. <strong>No activa contratos</strong>,{' '}
        <strong>no modifica saldos ni reglas de paridad 1:1 (BLUE / compromiso RED)</strong> y{' '}
        <strong>no equivale a una autorización de corte o transición</strong>. Los datos SQL y
        on-chain tomados en momentos distintos no constituyen un snapshot atómico.
      </div>

      {/* Estado: Cargando */}
      {status === 'loading' && (
        <div role="status" aria-live="polite" style={PANEL_STYLES.loadingBox}>
          {loadingMode === 'detail'
            ? 'Cargando detalle SQL Demo para conciliación administrativa… Por favor espera sin recargar la página.'
            : 'Consultando inventario SQL Demo en transacción de solo lectura… Por favor espera.'}
        </div>
      )}

      {/* Estado: Error accionable */}
      {status === 'error' && errorInfo && (
        <div role="alert" style={PANEL_STYLES.errorBox}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            ⚠️ {errorInfo.title}
          </div>
          <div style={{ fontSize: '0.86rem', lineHeight: 1.45 }}>
            {errorInfo.message}
          </div>
          <div style={PANEL_STYLES.actionsRow}>
            <button
              type="button"
              onClick={() => runInventoryRequest(loadingMode === 'detail')}
              disabled={isLoading}
              style={PANEL_STYLES.secondaryBtn}
            >
              🔄 Reintentar
            </button>
            {errorInfo.requiresRelogin && (
              <a
                href="/admin.html"
                style={{
                  ...PANEL_STYLES.secondaryBtn,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                Iniciar sesión administrativa
              </a>
            )}
          </div>
        </div>
      )}

      {/* Estado: Incompleto / Truncado (fail-closed, jamás mostrar como apto) */}
      {status === 'incomplete' && inventoryData && (
        <div role="alert" style={PANEL_STYLES.incompleteBox}>
          <div style={{ fontWeight: 800, fontSize: '0.96rem' }}>
            ⛔ Inventario INCOMPLETO — No apto para conciliación ni corte
          </div>
          <div style={{ fontSize: '0.85rem', lineHeight: 1.45 }}>
            El servidor reportó una lectura incompleta o truncada (
            <code>sqlComplete: {String(completenessFlags?.sqlComplete)}</code>,{' '}
            <code>truncated: {String(completenessFlags?.truncated)}</code>). Este resultado{' '}
            <strong>no puede considerarse apto</strong> ni usarse como evidencia de completitud.
          </div>
          {reportedErrors.length > 0 && (
            <ul style={{ margin: '0.25rem 0 0 1.2rem', padding: 0, fontSize: '0.82rem' }}>
              {reportedErrors.map((errItem, idx) => (
                <li key={idx}>
                  {typeof errItem === 'string'
                    ? errItem
                    : `${errItem?.code || 'ERROR'}: ${errItem?.message || 'Error reportado en la lectura SQL.'}`}
                </li>
              ))}
            </ul>
          )}
          <div style={PANEL_STYLES.actionsRow}>
            <button
              type="button"
              onClick={() => runInventoryRequest(detailLoaded)}
              disabled={isLoading}
              style={PANEL_STYLES.secondaryBtn}
            >
              🔄 Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Estado: Éxito (resumen completo y no truncado) */}
      {status === 'success' && inventoryData && (
        <div role="status" aria-live="polite" style={PANEL_STYLES.successBanner}>
          ✅ Inventario SQL Demo capturado en modo solo lectura (
          {detailLoaded ? 'con detalle para conciliación' : 'resumen sin detalle vinculable'}). No
          activa contratos, no altera saldos ni compromisos RED y no autoriza corte.
        </div>
      )}

      {/* Bloque de resumen visible en 'success' e 'incomplete' (con advertencia explícita arriba) */}
      {(status === 'success' || status === 'incomplete') && inventoryData && (
        <div>
          {/* Metadatos de captura e identidad Demo */}
          <div style={PANEL_STYLES.metaGrid}>
            <div style={PANEL_STYLES.tile}>
              <span style={PANEL_STYLES.tileLabel}>Capturado en (capturedAt)</span>
              <span style={PANEL_STYLES.tileValue}>{formatCapturedAt(capturedAt)}</span>
            </div>
            <div style={PANEL_STYLES.tile}>
              <span style={PANEL_STYLES.tileLabel}>Entorno / Época Demo</span>
              <span style={PANEL_STYLES.tileValue}>
                {demoIdentity.environment} · {demoIdentity.epoch}
              </span>
            </div>
            <div style={PANEL_STYLES.tile}>
              <span style={PANEL_STYLES.tileLabel}>Chain ID / Base de datos</span>
              <span style={PANEL_STYLES.tileValue}>
                {demoIdentity.chainId} · {demoIdentity.databaseName}
              </span>
            </div>
            <div style={PANEL_STYLES.tile}>
              <span style={PANEL_STYLES.tileLabel}>Versión exportador</span>
              <span style={PANEL_STYLES.tileValue}>{demoIdentity.exporterVersion}</span>
            </div>
          </div>

          {/* Estado de migraciones 128..131 */}
          <h3 style={PANEL_STYLES.subHeading}>Estado de migraciones SQL (128..131)</h3>
          <div style={PANEL_STYLES.migrationsGrid}>
            {migrations.map((mig) => (
              <div key={mig.key} style={PANEL_STYLES.tile}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={PANEL_STYLES.tileLabel}>Migración {mig.code}</span>
                  <span
                    style={
                      mig.present === true
                        ? PANEL_STYLES.badgeOk
                        : mig.present === false
                          ? PANEL_STYLES.badgePending
                          : PANEL_STYLES.badgeUnknown
                    }
                  >
                    {mig.present === true
                      ? 'Aplicada'
                      : mig.present === false
                        ? 'Pendiente'
                        : 'No reportada'}
                  </span>
                </div>
                <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>{mig.label}</span>
              </div>
            ))}
          </div>

          {/* Conteos de conciliación SQL */}
          <h3 style={PANEL_STYLES.subHeading}>Conteos de conciliación SQL</h3>
          {counts.length > 0 ? (
            <div style={PANEL_STYLES.metaGrid}>
              {counts.map((item) => (
                <div key={item.key} style={PANEL_STYLES.tile}>
                  <span style={PANEL_STYLES.tileLabel}>{item.label}</span>
                  <span style={PANEL_STYLES.tileValue}>{item.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: 0 }}>
              El servidor no devolvió conteos de conciliación en esta respuesta.
            </p>
          )}

          {/* Acciones explícitas de conciliación y exportación */}
          <div style={PANEL_STYLES.detailSection}>
            <div style={PANEL_STYLES.privacyWarning}>
              <strong>Aviso administrativo sobre datos vinculables:</strong> el detalle para
              conciliación contiene identificadores internos y direcciones de billetera vinculables
              de uso exclusivamente administrativo. Esta información{' '}
              <strong>NO se guarda en localStorage ni sessionStorage</strong> y no debe compartirse
              por canales externos no autorizados.
            </div>

            <div style={PANEL_STYLES.actionsRow}>
              <button
                type="button"
                onClick={() => runInventoryRequest(true)}
                disabled={isLoading}
                style={{
                  ...PANEL_STYLES.secondaryBtn,
                  ...(isLoading ? PANEL_STYLES.disabledBtn : {})
                }}
              >
                {isLoading && loadingMode === 'detail'
                  ? 'Cargando detalle…'
                  : detailLoaded
                    ? 'Recargar detalle para conciliación'
                    : 'Cargar detalle para conciliación'}
              </button>

              <button
                type="button"
                onClick={handleCopyJson}
                disabled={isLoading}
                style={{
                  ...PANEL_STYLES.secondaryBtn,
                  ...(isLoading ? PANEL_STYLES.disabledBtn : {})
                }}
              >
                Copiar JSON
              </button>

              <button
                type="button"
                onClick={handleDownloadJson}
                disabled={isLoading}
                style={{
                  ...PANEL_STYLES.secondaryBtn,
                  ...(isLoading ? PANEL_STYLES.disabledBtn : {})
                }}
              >
                Descargar JSON
              </button>
            </div>

            {actionFeedback && (
              <div role="status" aria-live="polite" style={PANEL_STYLES.feedbackMsg}>
                {actionFeedback}
              </div>
            )}

            {detailLoaded && (
              <details open>
                <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.86rem', color: '#38bdf8' }}>
                  Vista previa del detalle para conciliación (solo memoria)
                </summary>
                <pre style={PANEL_STYLES.jsonPreview}>
                  {JSON.stringify(inventoryData, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
