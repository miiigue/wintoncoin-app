// ============================================================================
// WintonCoin - Módulo de Configuración
// ============================================================================
// Configuración global de la aplicación y helpers de API
// ============================================================================

// Almacenamiento de configuración global
export const appSettings = {};

/**
 * Helper global para resolver la URL del API (soporta localhost y LAN).
 * @returns {string} La URL base del API
 */
export function getApiUrl() {
    const hostname = window.location.hostname;
    const isFileProtocol = window.location.protocol === 'file:';
    const isPrivateIp = /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || isPrivateIp || isFileProtocol;

    if (isFileProtocol) {
        return 'http://localhost:3000';
    }

    // Para entornos locales (localhost o IPs privadas), usar puerto 3000 del backend
    if (isLocal) {
        return `http://${hostname}:3000`;
    }

    return 'https://wintoncoin-backend.onrender.com';
}

/**
 * Carga las configuraciones desde el backend y las almacena en appSettings.
 * @returns {Promise<void>}
 */
export async function fetchAndStoreAppSettings() {
    // Usar la misma lógica que getApiUrl() para consistencia
    const API_URL = getApiUrl();

    try {
        // Si ya hemos cargado la configuración, no la volvemos a pedir.
        if (Object.keys(appSettings).length > 0) {
            return;
        }

        const response = await fetch(`${API_URL}/api/app-settings`);
        if (!response.ok) {
            throw new Error('No se pudo cargar la configuración de la aplicación.');
        }
        const settingsObject = await response.json();
        
        // Copiamos las propiedades al objeto appSettings
        Object.assign(appSettings, settingsObject);
        
        // Disparar un evento para notificar que la configuración está lista
        document.dispatchEvent(new CustomEvent('app-settings-loaded'));

    } catch (error) {
        console.error('Error de red al cargar la configuración de la aplicación:', error);
    }
}

/**
 * Verifica si el usuario está en un entorno local.
 * @returns {boolean}
 */
export function isLocalEnvironment() {
    const hostname = window.location.hostname;
    const isFileProtocol = window.location.protocol === 'file:';
    const isPrivateIp = /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
    return hostname === 'localhost' || hostname === '127.0.0.1' || isPrivateIp || isFileProtocol;
}
