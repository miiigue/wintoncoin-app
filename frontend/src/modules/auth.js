// ============================================================================
// WintonCoin - Módulo de Autenticación
// ============================================================================
// Gestión del estado de autenticación del usuario
// ============================================================================

// Variable global para almacenar la sesión del usuario.
export const userSession = {
    isAuthenticated: false,
    is_verified: false,
    username: null
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
