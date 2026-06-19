// ============================================================================
// WintonCoin - Módulo de Portapapeles (Clipboard)
// ============================================================================
// Proporciona copiado seguro al portapapeles compatible con contextos no seguros
// (HTTP, IPs locales como 192.168.x.x, etc.) donde navigator.clipboard no existe.
// ============================================================================

/**
 * Copia texto al portapapeles de manera robusta.
 * @param {string} text - El texto a copiar.
 * @returns {Promise<void>}
 */
export function copyTextToClipboard(text) {
    return new Promise((resolve, reject) => {
        // 1. Intentar usar la API moderna de Clipboard si está disponible (entorno HTTPS o localhost)
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(resolve).catch(reject);
        } else {
            // 2. Fallback de compatibilidad usando un textarea temporal (entorno HTTP IP local)
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed'; // Evita scroll y saltos de pantalla
            textarea.style.top = '0';
            textarea.style.left = '0';
            textarea.style.width = '2em';
            textarea.style.height = '2em';
            textarea.style.padding = '0';
            textarea.style.border = 'none';
            textarea.style.outline = 'none';
            textarea.style.boxShadow = 'none';
            textarea.style.background = 'transparent';
            textarea.style.opacity = '0';
            
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            
            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textarea);
                if (successful) {
                    resolve();
                } else {
                    reject(new Error('El comando execCommand("copy") no tuvo éxito.'));
                }
            } catch (err) {
                document.body.removeChild(textarea);
                reject(err);
            }
        }
    });
}
