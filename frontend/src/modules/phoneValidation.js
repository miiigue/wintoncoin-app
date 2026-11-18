// ============================================================================
// WintonCoin - Validación y Normalización Telefónica Internacional (E.164)
// ============================================================================
// Cumple estándar ITU-T E.164 (+[1-9] seguido de 7 a 15 dígitos en total)
// respetando dinámicamente el switch de restricción geográfica del Admin.
// ============================================================================

const E164_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

/**
 * Elimina espacios, guiones y paréntesis conservando el '+' inicial.
 * @param {unknown} rawPhone
 * @returns {string}
 */
export function normalizePhoneNumber(rawPhone) {
  if (typeof rawPhone !== 'string') return '';
  return rawPhone.trim().replace(/[\s\-()]/g, '');
}

/**
 * Valida un número telefónico según el estado de restricción geográfica del Admin.
 *
 * @param {string} rawPhone
 * @param {{ isCountryRestrictionEnabled: boolean, allowedPrefixes: string[] }} options
 * @returns {{ valid: boolean, cleaned: string, title?: string, text?: string, type?: string }}
 */
export function validatePhoneNumber(rawPhone, { isCountryRestrictionEnabled, allowedPrefixes = ['+58'] }) {
  const cleaned = normalizePhoneNumber(rawPhone);
  if (!cleaned || cleaned === '+') {
    return {
      valid: false,
      cleaned,
      title: 'Teléfono Requerido',
      text: 'Ingresa tu número telefónico con código de país (ej: +54 1122334455).',
      type: 'format'
    };
  }

  if (isCountryRestrictionEnabled) {
    const prefixes = Array.isArray(allowedPrefixes) && allowedPrefixes.length > 0 ? allowedPrefixes : ['+58'];
    const isAllowed = prefixes.some((prefix) => cleaned.startsWith(prefix));
    if (!isAllowed) {
      return {
        valid: false,
        cleaned,
        title: 'Formato o Prefijo no Admitido',
        text: prefixes.includes('+58')
          ? `Por ahora solo se admiten registros con prefijo ${prefixes.join(' o ')} (Venezuela). Escribe tu número iniciando con +58 o directamente 0414...`
          : `Por ahora solo se admiten registros con prefijo ${prefixes.join(' o ')}.`,
        type: 'format'
      };
    }

    if (!E164_PHONE_REGEX.test(cleaned) || cleaned.length < 11) {
      return {
        valid: false,
        cleaned,
        title: 'Número Incompleto',
        text: 'El número telefónico parece demasiado corto o contiene caracteres inválidos.',
        type: 'format'
      };
    }

    return { valid: true, cleaned };
  }

  // Modo internacional abierto (restricción por país desactivada)
  if (!cleaned.startsWith('+')) {
    return {
      valid: false,
      cleaned,
      title: 'Código de País Requerido',
      text: 'Incluye el signo + seguido del código de tu país (ej: +54 1122334455).',
      type: 'format'
    };
  }

  if (!E164_PHONE_REGEX.test(cleaned)) {
    const tooShort = /^\+[1-9]\d{0,5}$/.test(cleaned);
    return {
      valid: false,
      cleaned,
      title: tooShort ? 'Número Incompleto' : 'Formato Inválido',
      text: tooShort
        ? 'El número telefónico parece demasiado corto. Incluye el código de país y tu número completo (ej: +54 1122334455).'
        : 'Usa el formato internacional con + y entre 7 y 15 dígitos numéricos (ej: +54 1122334455).',
      type: 'format'
    };
  }

  return { valid: true, cleaned };
}
