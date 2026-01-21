// ============================================================================
// WintonCoin - Módulo de Linkify
// ============================================================================
// Convierte URLs en texto plano a enlaces clicables
// ============================================================================

/**
 * Busca texto que parezca un enlace (http, https, www) y lo convierte en una etiqueta <a> clicable.
 * @param {string} text - El texto a procesar.
 * @returns {string} El texto con los enlaces convertidos a HTML.
 */
export function linkify(text) {
    if (!text) return '';
    
    // Primero, escapamos el HTML básico para evitar inyección de XSS simple.
    const escapedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Regex para encontrar URLs.
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;

    return escapedText.replace(urlRegex, function(url) {
        // Para los enlaces que empiezan con 'www', añadimos 'http://' para que funcionen.
        const fullUrl = url.startsWith('www.') ? 'http://' + url : url;
        const safeUrl = fullUrl.replace(/"/g, '%22');

        // Detectar si es un enlace de WhatsApp
        if (/wa\.me\/|api\.whatsapp\.com\//i.test(fullUrl)) {
            return `
                <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="embedded-link whatsapp-inline-link">
                    <span class="whatsapp-inline-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="16" height="16" role="img" aria-label="WhatsApp">
                            <path fill="currentColor" d="M20.52 3.48A11.84 11.84 0 0 0 12.06 0C5.55 0 .26 5.29.26 11.8c0 2.08.54 4.13 1.56 5.96L0 24l6.43-1.78a11.73 11.73 0 0 0 5.63 1.44h.01c6.5 0 11.79-5.29 11.79-11.8 0-3.15-1.23-6.11-3.34-8.38Zm-8.46 18.2h-.01a9.83 9.83 0 0 1-5-1.37l-.36-.21-3.81 1.05 1.02-3.72-.24-.38a9.78 9.78 0 0 1-1.5-5.25c0-5.4 4.39-9.8 9.8-9.8a9.74 9.74 0 0 1 6.93 2.87 9.74 9.74 0 0 1 2.86 6.93c0 5.4-4.39 9.8-9.79 9.8Zm5.39-7.34c-.3-.15-1.75-.86-2.03-.96-.28-.1-.48-.15-.69.15-.2.3-.79.96-.97 1.15-.18.2-.36.22-.66.07-.3-.15-1.27-.47-2.42-1.5-.89-.8-1.49-1.78-1.67-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.36.45-.54.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.69-1.66-.95-2.27-.25-.6-.5-.52-.69-.53h-.59c-.2 0-.53.07-.8.38-.28.3-1.06 1.04-1.06 2.53s1.09 2.93 1.24 3.14c.15.2 2.15 3.28 5.2 4.6.73.31 1.3.5 1.75.64.73.23 1.39.2 1.91.12.58-.09 1.75-.71 2-1.4.25-.69.25-1.28.18-1.4-.07-.12-.28-.2-.58-.35Z"/>
                        </svg>
                    </span>
                    Ir a WhatsApp
                </a>
            `;
        }

        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="embedded-link">${url}</a>`;
    });
}
