// ============================================================================
// WintonCoin - Módulo de Autenticación
// ============================================================================
// Gestión del estado de autenticación del usuario
// ============================================================================

import { showCustomAlert } from './alerts.js';
import { getApiUrl } from './config.js';

// Variable global para almacenar la sesión del usuario.
export const userSession = {
    isAuthenticated: false,
    is_verified: false,
    username: null,
    requires_terms_acceptance: false,
    pending_documents: []
};

/**
 * [MÉTODO DE SEGURIDAD] Decodifica y comprueba si el token JWT de acceso ha expirado
 * o está muy cerca de expirar (dentro de los próximos 30 segundos).
 * @param {string} token - Token JWT
 * @returns {boolean} True si expiró o es inválido, False si es válido
 */
export function isTokenExpired(token) {
    if (!token) return true;
    try {
        const payloadBase64 = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(payloadBase64));
        const expTimestamp = decodedPayload.exp * 1000; // exp está en segundos
        return expTimestamp < Date.now() + 30000; // Considerar expirado si le quedan menos de 30 seg
    } catch (e) {
        return true;
    }
}

// Variable para encolar/unificar peticiones paralelas de refresco de sesión
let refreshPromise = null;

/**
 * [MÉTODO DE SEGURIDAD] Realiza el refresco silencioso del Access Token
 * comunicándose con el backend usando la cookie HttpOnly de refresco.
 * @returns {Promise<string|null>} Retorna el nuevo Access Token o null si falla.
 */
export async function silentRefreshIfNeeded() {
    const token = localStorage.getItem('token');
    
    // Si no hay token de acceso previo, se trata de un invitado: no hacemos nada
    if (!token) {
        return null;
    }

    // Si el token aún es válido, lo retornamos sin hacer llamada de red
    if (!isTokenExpired(token)) {
        return token;
    }

    // Evitamos llamadas concurrentes duplicadas; si ya hay un refresco en curso, esperamos a esa promesa
    if (refreshPromise) {
        return refreshPromise;
    }

    const API_URL = getApiUrl();

    refreshPromise = (async () => {
        try {
            console.log('[AUTH] Token expirado o por expirar. Iniciando refresco silencioso...');
            
            // Hacemos el fetch incluyendo 'credentials: include' para mandar las cookies HttpOnly
            const response = await fetch(`${API_URL}/api/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Fallo al validar la cookie de sesión en el servidor.');
            }

            const data = await response.json();
            
            // Guardar el nuevo Access Token y el username en el storage local de corta duración
            localStorage.setItem('token', data.token);
            if (data.username) {
                localStorage.setItem('username', data.username);
            }

            // Actualizar la sesión global en memoria
            userSession.isAuthenticated = true;
            userSession.is_verified = data.is_verified;
            userSession.kyc_verified = data.kyc_verified;
            userSession.requires_terms_acceptance = data.requires_terms_acceptance;
            userSession.pending_documents = data.pending_documents || [];
            
            document.dispatchEvent(new CustomEvent('auth-status-checked', { detail: userSession }));
            console.log('[AUTH] Token refrescado con éxito de manera silenciosa.');
            return data.token;

        } catch (error) {
            console.warn('[AUTH] No se pudo refrescar la sesión:', error.message);
            
            // Si el refresco falla, destruimos la sesión en localStorage preventivamente
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            
            userSession.isAuthenticated = false;
            userSession.is_verified = false;
            userSession.kyc_verified = false;
            userSession.requires_terms_acceptance = false;
            userSession.pending_documents = [];
            
            document.dispatchEvent(new CustomEvent('auth-status-checked', { detail: userSession }));
            return null;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

/**
 * Verifica el estado de autenticación del usuario contra el backend.
 * Almacena el resultado en userSession.
 * @returns {Promise<object>} El estado de la sesión del usuario.
 */
export async function checkAuthStatus() {
    const API_URL = getApiUrl();
    
    // [SEGURIDAD FINTECH] Refrescar silenciosamente el token si ha expirado antes de consultar estado
    await silentRefreshIfNeeded();
    
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${API_URL}/api/auth/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // Si la respuesta no es OK (ej. 500), asumimos no autenticado.
            throw new Error('Error del servidor al verificar el estado.');
        }

        const status = await response.json();
        
        // Actualizamos la sesión global
        Object.assign(userSession, status);

        // Disparamos un evento para que otras partes de la UI puedan reaccionar
        document.dispatchEvent(new CustomEvent('auth-status-checked', { detail: userSession }));

        return userSession;

    } catch (error) {
        console.error('Error al verificar el estado de autenticación:', error);
        
        // En caso de cualquier error, reseteamos al estado por defecto.
        userSession.isAuthenticated = false;
        userSession.is_verified = false;
        userSession.username = null;
        userSession.requires_terms_acceptance = false;
        userSession.pending_documents = [];
        
        document.dispatchEvent(new CustomEvent('auth-status-checked', { detail: userSession }));

        return userSession;
    }
}

/**
 * Cierra la sesión del usuario.
 */
export function logout() {
    const API_URL = getApiUrl();
    
    // [SEGURIDAD FINTECH] Notificar al servidor para destruir la cookie HttpOnly de refresco
    fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
    }).catch(err => console.error('[AUTH] Fallo al cerrar sesión en backend:', err.message));

    // Limpiar storage local de la interfaz
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    userSession.isAuthenticated = false;
    userSession.is_verified = false;
    userSession.username = null;
    userSession.requires_terms_acceptance = false;
    userSession.pending_documents = [];
    
    document.dispatchEvent(new CustomEvent('auth-logout'));
}

/**
 * Obtiene el token de autenticación almacenado.
 * @returns {string|null}
 */
export function getAuthToken() {
    return localStorage.getItem('token');
}

/**
 * Almacena un nuevo token de autenticación.
 * @param {string} token
 */
export function setAuthToken(token) {
    localStorage.setItem('token', token);
}

/**
 * Maneja respuestas de API que requieren autenticación.
 * Si la respuesta es 401 (no autenticado/token expirado), limpia la sesión
 * y redirige al login con un mensaje amigable.
 * 
 * @param {Response} response - La respuesta del fetch
 * @returns {boolean} true si la sesión expiró y se está redirigiendo, false si todo está bien
 * 
 * @example
 * const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }});
 * if (handleSessionExpired(response)) return; // Salir si la sesión expiró
 * // Continuar con el procesamiento normal...
 */
export function handleSessionExpired(response) {
    if (response.status === 401) {
        // [SEGURIDAD FINTECH] Cierra sesión destruyendo datos del storage local y cookies de refresco
        logout();
        
        // [MEJORA UX/UI] Mostrar alerta amigable, comprensible e instructiva utilizando el modal premium de la aplicación.
        // Se explica claramente el motivo de seguridad (inactividad) y la instrucción exacta a seguir (iniciar sesión).
        showCustomAlert('Por motivos de seguridad y resguardo de tus activos, tu sesión ha expirado tras un período de inactividad. Por favor, inicia sesión nuevamente para continuar operando en la plataforma.', () => {
            window.location.href = 'index.html';
        });
        
        return true; // Indica que la sesión expiró
    }
    return false; // La sesión está bien
}

/**
 * Indica si el usuario puede ejecutar acciones de negocio.
 * Si falta aceptación legal vigente, solo permitimos navegación/lectura.
 */
export function canPerformProtectedActions() {
    return !!userSession.isAuthenticated && !userSession.requires_terms_acceptance;
}
