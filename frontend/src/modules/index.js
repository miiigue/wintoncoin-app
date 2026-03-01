// ============================================================================
// WintonCoin - Módulo Principal (Re-exports)
// ============================================================================
// Este archivo re-exporta todas las funciones de los módulos individuales
// y mantiene compatibilidad con el código existente que usa window.funcName
// ============================================================================

// Re-exportar todo desde los módulos individuales
export * from './alerts.js';
export * from './config.js';
export * from './auth.js';
export * from './tooltips.js';
export * from './banner.js';
export * from './linkify.js';
export * from './password-toggle.js';

// ============================================================================
// COMPATIBILIDAD GLOBAL (window.*)
// ============================================================================
// Esto permite que el código existente que usa window.funcName siga funcionando
// durante la migración gradual a módulos ES.
// ============================================================================

import {
    showCustomAlert,
    closeCustomAlert,
    showCustomConfirm,
    closeCustomConfirm,
    handleConfirm,
    initializeAlertListeners
} from './alerts.js';

import {
    appSettings,
    getApiUrl,
    fetchAndStoreAppSettings,
    isLocalEnvironment
} from './config.js';

import {
    userSession,
    checkAuthStatus,
    logout,
    getAuthToken,
    setAuthToken,
    handleSessionExpired
} from './auth.js';

import {
    initializeGlobalTooltipListeners,
    initializeInfoTooltip,
    initializeAllInfoTooltips
} from './tooltips.js';

import {
    initializeValueTooltip,
    initializeValueBanner
} from './banner.js';

import { linkify } from './linkify.js';
import { togglePasswordVisibility } from './password-toggle.js';

// Solo ejecutar en el navegador (no en Node.js)
if (typeof window !== 'undefined') {
    // --- Alertas ---
    window.showCustomAlert = showCustomAlert;
    window.closeCustomAlert = closeCustomAlert;
    window.showCustomConfirm = showCustomConfirm;
    window.closeCustomConfirm = closeCustomConfirm;
    window.handleConfirm = handleConfirm;

    // --- Configuración ---
    window.appSettings = appSettings;
    window.getApiUrl = getApiUrl;
    window.fetchAndStoreAppSettings = fetchAndStoreAppSettings;

    // --- Autenticación ---
    window.userSession = userSession;
    window.checkAuthStatus = checkAuthStatus;

    // --- Utilidades ---
    window.linkify = linkify;

    // --- Tooltips ---
    window.initializeInfoTooltip = initializeInfoTooltip;
    window.initializeAllInfoTooltips = initializeAllInfoTooltips;

    // --- Banner ---
    window.initializeValueBanner = initializeValueBanner;
}

// ============================================================================
// INICIALIZACIÓN AUTOMÁTICA
// ============================================================================
// Cuando el DOM esté listo, inicializamos los componentes necesarios
// ============================================================================

function initializeApp() {
    // Servicio removido para prevenir bloqueos de CORS en desarrollo estático

    // Inicializar listeners de alertas
    initializeAlertListeners();

    // Inicializar tooltips
    initializeAllInfoTooltips();

    // Inicializar banner de valor
    initializeValueBanner();
}

// Solo inicializar si estamos en el navegador
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        // DOMContentLoaded ya ocurrió
        initializeApp();
    }
}
