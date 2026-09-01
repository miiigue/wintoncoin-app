// ============================================================================
// WintonCoin PWA — Native Bridge Module (Integración con Android Nativo)
// ============================================================================
// [FRONTEND CORE MODULE] Provee una API limpia, asíncrona y promisificada
// para interactuar con la capa nativa de Android (window.AndroidNative).
//
// Permite que la PWA invoque biometría nativa, cifrado Keystore y funciones
// del sistema operativo manteniendo 100% de compatibilidad con navegadores web.
// ============================================================================

class NativeBridgeManager {
    constructor() {
        this.isNative = typeof window !== 'undefined' && Boolean(window.AndroidNative);
        this.callbackCounter = 0;
    }

    /**
     * Comprueba si la PWA se está ejecutando dentro del contenedor nativo de Android.
     * @returns {boolean}
     */
    isNativeApp() {
        return typeof window !== 'undefined' && Boolean(window.AndroidNative);
    }

    /**
     * Obtiene detalles del entorno y dispositivo desde la capa nativa Android.
     * @returns {Object}
     */
    getDeviceInfo() {
        if (!this.isNativeApp()) {
            return {
                platform: 'Web',
                userAgent: navigator.userAgent,
                isNative: false
            };
        }
        try {
            const raw = window.AndroidNative.getDeviceInfo();
            return JSON.parse(raw);
        } catch (e) {
            console.error('[NATIVE_BRIDGE] Error parsing getDeviceInfo:', e);
            return { platform: 'Android', isNative: true };
        }
    }

    /**
     * Ejecuta el escaneo de integridad del dispositivo (RootDetector).
     * @returns {Object}
     */
    checkDeviceSecurity() {
        if (!this.isNativeApp()) {
            return { isSecure: true, platform: 'Web' };
        }
        try {
            const raw = window.AndroidNative.checkDeviceSecurity();
            return JSON.parse(raw);
        } catch (e) {
            console.error('[NATIVE_BRIDGE] Error checking security:', e);
            return { isSecure: true };
        }
    }

    /**
     * Solicita la autenticación biométrica nativa de Android (BiometricPrompt por huella/rostro).
     * @param {string} title - Título del diálogo biométrico
     * @param {string} subtitle - Subtítulo descriptivo
     * @returns {Promise<{success: boolean, message: string}>}
     */
    authenticateBiometric(title = 'Autenticación WintonCoin', subtitle = 'Confirme su identidad') {
        return new Promise((resolve) => {
            if (!this.isNativeApp()) {
                console.warn('[NATIVE_BRIDGE] Biometría nativa no disponible en navegador web estándar');
                resolve({ success: false, message: 'Navegador web sin sensor nativo' });
                return;
            }

            const callbackName = `_wintonBiometricCb_${Date.now()}_${++this.callbackCounter}`;

            // Registrar callback temporal en window
            window[callbackName] = (success, message) => {
                delete window[callbackName];
                resolve({ success: Boolean(success), message: message || '' });
            };

            try {
                window.AndroidNative.authenticateBiometric(title, subtitle, callbackName);
            } catch (e) {
                console.error('[NATIVE_BRIDGE] Error invocando biometría:', e);
                delete window[callbackName];
                resolve({ success: false, message: 'Error de comunicación nativa' });
            }
        });
    }

    /**
     * Recupera el token de sesión almacenado en Android Keystore cifrado (AES-256-GCM).
     * @returns {string}
     */
    getSecureToken() {
        if (!this.isNativeApp()) return null;
        try {
            return window.AndroidNative.getSecureToken() || null;
        } catch (e) {
            console.error('[NATIVE_BRIDGE] Error en getSecureToken:', e);
            return null;
        }
    }

    /**
     * Guarda el token de sesión en memoria cifrada de hardware en Android.
     * @param {string} token 
     */
    saveSecureToken(token) {
        if (!this.isNativeApp() || !token) return;
        try {
            window.AndroidNative.saveSecureToken(token);
        } catch (e) {
            console.error('[NATIVE_BRIDGE] Error en saveSecureToken:', e);
        }
    }

    /**
     * Limpia la sesión almacenada en Android Keystore.
     */
    clearSecureSession() {
        if (!this.isNativeApp()) return;
        try {
            window.AndroidNative.clearSecureSession();
        } catch (e) {
            console.error('[NATIVE_BRIDGE] Error en clearSecureSession:', e);
        }
    }

    /**
     * Envía eventos de auditoría desde JavaScript hacia el AuditLogger de Android.
     * @param {string} eventType 
     * @param {string} details 
     */
    logAudit(eventType, details) {
        if (!this.isNativeApp()) return;
        try {
            window.AndroidNative.logAudit(eventType, typeof details === 'object' ? JSON.stringify(details) : String(details));
        } catch (e) {
            // Ignorar errores no críticos de logging
        }
    }

    /**
     * Ejecuta una respuesta háptica (vibración leve de toque nativo).
     */
    triggerHapticFeedback() {
        if (!this.isNativeApp()) return;
        try {
            window.AndroidNative.triggerHapticFeedback();
        } catch (e) {
            // Ignorar
        }
    }
}

// Exportar instancia Singleton del NativeBridge
export const nativeBridge = new NativeBridgeManager();
if (typeof window !== 'undefined') {
    window.WintonNative = nativeBridge;
}
