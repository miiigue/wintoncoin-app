// ============================================================================
// WintonCoin - Módulo de Sanitización XSS
// ============================================================================
// Funciones centralizadas para escapar datos del servidor antes de insertarlos
// en HTML. Previene ataques de Cross-Site Scripting (XSS) al neutralizar
// caracteres especiales que un navegador interpretaría como markup o script.
//
// Estándar: OWASP XSS Prevention Cheat Sheet
// Referencia: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Scripting_Prevention_Cheat_Sheet.html
// ============================================================================

/**
 * Escapa caracteres HTML peligrosos en texto que será insertado
 * dentro de elementos HTML (innerHTML, template literals).
 *
 * Neutraliza los 5 caracteres que pueden iniciar inyección XSS:
 * & < > " '
 *
 * @param {*} unsafeInput - Valor a escapar (se convierte a string)
 * @returns {string} Texto seguro para insertar en HTML
 *
 * @example
 * // Datos del servidor potencialmente maliciosos:
 * const username = '<script>alert("xss")</script>';
 * // Sin escapar → ejecuta el script en el navegador del usuario
 * // Con escapeHtml → muestra "&lt;script&gt;..." como texto inofensivo
 * element.innerHTML = `<span>${escapeHtml(username)}</span>`;
 */
export function escapeHtml(unsafeInput) {
    // Convertir a string de forma segura; null/undefined → cadena vacía
    const str = String(unsafeInput ?? '');

    // Si la cadena no contiene ningún carácter peligroso, retornar tal cual
    // (micro-optimización para el caso común donde no hay nada que escapar)
    if (!/[&<>"']/.test(str)) return str;

    // Reemplazar cada carácter peligroso por su entidad HTML equivalente
    return str
        .replace(/&/g, '&amp;')   // & debe ir primero para no re-escapar
        .replace(/</g, '&lt;')    // < inicia tags HTML
        .replace(/>/g, '&gt;')    // > cierra tags HTML
        .replace(/"/g, '&quot;')  // " rompe atributos con comillas dobles
        .replace(/'/g, '&#39;');  // ' rompe atributos con comillas simples
}

/**
 * Escapa un valor para uso seguro dentro de atributos HTML.
 * Aplica el mismo escape que escapeHtml, ya que los 5 caracteres
 * cubiertos protegen tanto contenido como atributos.
 *
 * @param {*} unsafeInput - Valor a escapar para atributo
 * @returns {string} Valor seguro para insertar en atributos HTML
 *
 * @example
 * const username = '" onclick="alert(1)" data-x="';
 * // Sin escapar → inyecta evento onclick malicioso
 * // Con escapeAttr → el valor queda como texto inerte en el atributo
 * html = `<div data-author="${escapeAttr(username)}">`;
 */
export function escapeAttr(unsafeInput) {
    return escapeHtml(unsafeInput);
}
