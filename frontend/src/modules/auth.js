// ============================================================================
// WintonCoin - Módulo de Autenticación
// ============================================================================
// Gestión del estado de autenticación del usuario
// ============================================================================

// Variable global para almacenar la sesión del usuario.
export const userSession = {
    isAuthenticated: false,
    is_verified: false,
    username: null,
    requires_terms_acceptance: false,
    pending_documents: []
};

/**
 * Verifica el estado de autenticación del usuario contra el backend.
 * Almacena el resultado en userSession.
 * @returns {Promise<object>} El estado de la sesión del usuario.
 */
export async function checkAuthStatus() {
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';
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
    localStorage.removeItem('token');
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
        // Limpiar datos de sesión
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        
        // Resetear estado de sesión
        userSession.isAuthenticated = false;
        userSession.is_verified = false;
        userSession.username = null;
        userSession.requires_terms_acceptance = false;
        userSession.pending_documents = [];
        
        // Importar showCustomAlert dinámicamente para evitar dependencia circular
        import('./alerts.js').then(({ showCustomAlert }) => {
            showCustomAlert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', () => {
                window.location.href = 'index.html';
            });
        }).catch(() => {
            // Fallback si falla la importación
            alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
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
