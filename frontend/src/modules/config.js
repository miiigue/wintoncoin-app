// ============================================================================
// WintonCoin - Módulo de Configuración
// ============================================================================
// Configuración global de la aplicación y helpers de API
// ============================================================================

// Almacenamiento de configuración global
export const appSettings = {};

/**
 * Helper global para resolver la URL del API (soporta localhost, LAN, Demo y Producción).
 * Aplica el principio de Cero Confianza (Zero-Trust) y Aislamiento Estricto de Entornos.
 * Garantiza que cualquier petición originada en demo.wintoncoin.com se dirija única y
 * exclusivamente a wintoncoin-backend-demo.onrender.com, protegiendo el entorno de producción.
 * @returns {string} La URL base del API correspondiente al entorno activo
 */
export function getApiUrl() {
    // 1. Detección del contexto de ejecución en el navegador
    const hostname = window.location.hostname;
    const isFileProtocol = window.location.protocol === 'file:';
    const isPrivateIp = /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || isPrivateIp || isFileProtocol;
    const demoHosts = new Set(['demo.wintoncoin.com', 'www.demo.wintoncoin.com']);
    const productionHosts = new Set([
        'wintoncoin.com',
        'www.wintoncoin.com',
        'sc.wintoncoin.com',
        'www.sc.wintoncoin.com',
        'wintoncoin-frontend.onrender.com'
    ]);
    const isDemoBuild = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'demo';

    // 2. Si se ejecuta como archivo local plano (file://), redirigir al servidor local por defecto
    if (isFileProtocol) {
        return 'http://localhost:3000';
    }

    // 3. AISLAMIENTO ESTRICTO DE DEMO (Prioridad Inviolable de Seguridad):
    // Si el usuario está navegando en el dominio demo (demo.wintoncoin.com) o en modo demo,
    // FORZAR SIEMPRE el backend de Demo, anulando cualquier valor residual de build.
    if (isDemoBuild) {
        if (!demoHosts.has(hostname)) {
            throw new Error('El build Demo solo puede usar dominios Demo autorizados.');
        }
        return 'https://wintoncoin-backend-demo.onrender.com';
    }
    if (demoHosts.has(hostname)) {
        return 'https://wintoncoin-backend-demo.onrender.com';
    }

    // 4. Entornos Locales de Desarrollo (localhost / Red LAN)
    if (isLocal) {
        // Si hay una variable de entorno explícita configurada en desarrollo local, respetarla
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
            return import.meta.env.VITE_API_URL;
        }
        return `http://${hostname}:3000`;
    }

    // 5. Entornos de Staging / Variables de entorno explícitas
    if (productionHosts.has(hostname) && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }

    // 6. Dominios productivos conocidos conservan el backend anterior.
    if (productionHosts.has(hostname)) return 'https://wintoncoin-backend.onrender.com';

    // Un host no identificado nunca hereda silenciosamente otro ambiente.
    throw new Error('Dominio no autorizado para resolver el API de WintonCoin.');
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
