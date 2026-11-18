// ============================================================================
// WintonCoin - Módulo Centralizado de Contexto de Referidos (DRY & Zero-Trust)
// ============================================================================
// Centraliza la extracción, validación, sanitización, persistencia y
// construcción segura de URLs de registro para evitar:
// - XSS reflejado o almacenado mediante parámetros ?ref= maliciosos (OWASP A03)
// - Open Redirect al redirigir desde la Landing hacia el registro (OWASP A01)
// - Pérdida de atribución del referente entre navegaciones o recargas OTP
// ============================================================================

const PENDING_REFERRAL_STORAGE_KEY = 'pending_referral_code';
const REFERRAL_CODE_ALLOWLIST_REGEX = /^[A-Z0-9_-]{2,40}$/;

/**
 * Normaliza y valida un código de referido contra una lista blanca estricta.
 * Rechaza cualquier cadena con caracteres especiales, HTML o scripts.
 *
 * @param {unknown} rawCode - Valor crudo recibido desde URL, storage o input.
 * @returns {string} Código en mayúsculas si es válido, o cadena vacía si no lo es.
 */
export function sanitizeReferralCode(rawCode) {
  if (typeof rawCode !== 'string') return '';
  const normalized = rawCode.trim().toUpperCase();
  return REFERRAL_CODE_ALLOWLIST_REGEX.test(normalized) ? normalized : '';
}

/**
 * Extrae y sanitiza el código de referido desde una query string (?ref=, ?referral=, ?r=).
 *
 * @param {string} [search=window.location.search] - Query string a inspeccionar.
 * @returns {string} Código sanitizado o cadena vacía.
 */
export function extractReferralFromSearch(search = typeof window !== 'undefined' ? window.location.search : '') {
  if (!search || typeof search !== 'string') return '';
  try {
    const params = new URLSearchParams(search);
    const candidate = params.get('ref') || params.get('referral') || params.get('r') || '';
    return sanitizeReferralCode(candidate);
  } catch {
    return '';
  }
}

/**
 * Guarda de forma defensiva el código de referido pendiente en localStorage.
 *
 * @param {unknown} rawCode - Código candidato.
 * @returns {string} Código guardado si fue válido; de lo contrario, cadena vacía.
 */
export function persistPendingReferralCode(rawCode) {
  const cleanCode = sanitizeReferralCode(rawCode);
  if (!cleanCode) return '';
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(PENDING_REFERRAL_STORAGE_KEY, cleanCode);
    }
  } catch {
    // Algunos modos privados restringen localStorage; continuamos con el flujo en URL.
  }
  return cleanCode;
}

/**
 * Recupera y re-valida el código de referido almacenado en localStorage.
 *
 * @returns {string} Código válido o cadena vacía.
 */
export function getPendingReferralCode() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return '';
    return sanitizeReferralCode(window.localStorage.getItem(PENDING_REFERRAL_STORAGE_KEY));
  } catch {
    return '';
  }
}

/**
 * Limpia el código de referido pendiente una vez completado el registro.
 */
export function clearPendingReferralCode() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(PENDING_REFERRAL_STORAGE_KEY);
    }
  } catch {
    // Ignorar fallo de acceso a storage en modos restrictivos.
  }
}

/**
 * Construye una URL relativa estrictamente del mismo origen hacia /register.
 * Protege contra Open Redirect al fijar la ruta permitida.
 *
 * @param {unknown} rawCode - Código de referido opcional.
 * @param {'/register'|'/register.html'} [basePath='/register'] - Ruta fija permitida.
 * @returns {string} Ruta relativa segura con query string codificada si aplica.
 */
export function buildSafeRegisterUrl(rawCode, basePath = '/register') {
  const safePath = basePath === '/register.html' ? '/register.html' : '/register';
  const cleanCode = sanitizeReferralCode(rawCode);
  return cleanCode ? `${safePath}?ref=${encodeURIComponent(cleanCode)}` : safePath;
}
