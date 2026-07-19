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
    const username = localStorage.getItem('username');
    
    // Si no hay token de acceso previo Y no hay username, se trata de un invitado: no hacemos nada
    if (!token && !username) {
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
                // Si es un error de no autorizado (401), la sesión es explícitamente inválida
                if (response.status === 401) {
                    throw { isSessionInvalid: true, message: 'Sesión expirada o inválida en el servidor.' };
                }
                // Si es otro error (500, 502, 503, 504), es un problema temporal del servidor. Conservamos credenciales.
                throw { isSessionInvalid: false, message: `Error temporal del servidor (${response.status}).` };
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
            console.warn('[AUTH] No se pudo refrescar la sesión:', error.message || error);
            
            // [SEGURIDAD FINTECH] Solo destruimos la sesión si el servidor nos confirmó explícitamente
            // que la sesión es inválida (401). Si el fallo es de red (TypeError) o por error 5xx
            // del servidor, no deslogueamos al usuario, evitamos arruinar su UX por un fallo temporal.
            if (error && error.isSessionInvalid === true) {
                localStorage.removeItem('token');
                localStorage.removeItem('username');
                
                userSession.isAuthenticated = false;
                userSession.is_verified = false;
                userSession.kyc_verified = false;
                userSession.requires_terms_acceptance = false;
                userSession.pending_documents = [];
                
                document.dispatchEvent(new CustomEvent('auth-status-checked', { detail: userSession }));
            }
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
        // [SEGURIDAD FINTECH] Guardamos el estado de si el usuario ya estaba logueado
        const wasLoggedIn = !!localStorage.getItem('username');

        // Cierra sesión destruyendo datos del storage local y cookies de refresco
        logout();
        
        // [MEJORA UX/UI] Si el usuario estaba logueado, mostrar la alerta de sesión expirada amigable y premium.
        // Si era un invitado que intentó entrar a una ruta privada de forma directa, lo redirigimos silenciosamente.
        if (wasLoggedIn) {
            showCustomAlert(
                'Por motivos de seguridad y resguardo de tus activos, tu sesión ha expirado tras un período de inactividad. Por favor, inicia sesión nuevamente para continuar operando en la plataforma.',
                () => {
                    window.location.href = 'index.html';
                },
                true // Marcada como alerta terminal/crítica para evitar que otras alertas la sobrescriban
            );
        } else {
            window.location.href = 'index.html';
        }
        
        return true; // Indica que la sesión expiró y fue manejada
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

// ============================================================================
// INTERCEPTOR DE PETICIONES GLOBAL (window.fetch)
// ============================================================================
// Intercepta todas las peticiones salientes al API de WintonCoin para:
// 1. Ejecutar automáticamente el refresco silencioso si el Access Token expiró.
// 2. Adjuntar la cabecera 'Authorization' de forma transparente.
// 3. Capturar errores 401 globales y disparar el modal de sesión expirada.
// ============================================================================
const originalFetch = window.fetch;
window.fetch = async function (input, init) {
    let url = '';
    if (typeof input === 'string') {
        url = input;
    } else if (input instanceof URL) {
        url = input.href;
    } else if (input && typeof input === 'object' && input.url) {
        url = input.url;
    }

    const API_URL = getApiUrl();
    const isApiCall = url.startsWith(API_URL) && url.includes('/api/');
    const isAuthRoute = url.includes('/api/auth/login') || 
                        url.includes('/api/auth/refresh') || 
                        url.includes('/api/auth/logout') ||
                        url.includes('/api/register-verify');
    const isAdminRoute = url.includes('/api/admin/');

    // Interceptamos solo peticiones de nuestra API que requieran autenticación de usuario normal
    if (isApiCall && !isAuthRoute && !isAdminRoute) {
        try {
            // Obtener o refrescar el token vigente de manera silenciosa
            const activeToken = await silentRefreshIfNeeded();

            if (activeToken) {
                init = init || {};
                init.headers = init.headers || {};

                if (init.headers instanceof Headers) {
                    init.headers.set('Authorization', `Bearer ${activeToken}`);
                } else if (Array.isArray(init.headers)) {
                    const authIdx = init.headers.findIndex(h => h[0].toLowerCase() === 'authorization');
                    if (authIdx !== -1) {
                        init.headers[authIdx][1] = `Bearer ${activeToken}`;
                    } else {
                        init.headers.push(['Authorization', `Bearer ${activeToken}`]);
                    }
                } else if (typeof init.headers === 'object') {
                    init.headers['Authorization'] = `Bearer ${activeToken}`;
                }
            }
        } catch (error) {
            console.error('[AUTH INTERCEPTOR] Error al pre-refrescar token:', error);
        }
    }

    // Ejecutar la petición original
    const response = await originalFetch.call(this, input, init);

    // Si el servidor nos responde 401 (Unauthorized) en un endpoint de usuario normal,
    // significa que la sesión es definitivamente inválida y debemos destruirla.
    if (response.status === 401 && isApiCall && !isAuthRoute && !isAdminRoute) {
        handleSessionExpired(response);
    }

    return response;
};

// Disparamos el refresco en segundo plano al cargar el script si hay un indicio de sesión
if (localStorage.getItem('username')) {
    silentRefreshIfNeeded().catch(err => console.error('[AUTH] Auto-refresh on boot failed:', err));
}
