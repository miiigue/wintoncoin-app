// ============================================================================
// WintonCoin - Página de Login de Admin
// ============================================================================

import { getApiUrl, showCustomAlert } from '../modules/index.js';

function initializeAdminLoginPage() {
    const API_URL = getApiUrl();
    const adminLoginForm = document.getElementById('adminLoginForm');

    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            // Obtener el nombre de usuario y contraseña desde la interfaz
            const username = document.getElementById('adminUsername').value;
            const password = document.getElementById('adminPassword').value;

            try {
                // Petición POST al endpoint seguro de login administrativo
                const response = await fetch(`${API_URL}/api/admin/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // Enviamos usuario y contraseña (bcrypt hash se realiza en backend)
                    body: JSON.stringify({ username, password }),
                    credentials: 'include' // Necesario para cookies HttpOnly (admin_token)
                });

                const result = await response.json();

                if (response.ok) {
                    // Guardar el nombre de usuario del administrador en localStorage para visualización en el panel
                    localStorage.setItem('admin_username', result.username || username);
                    window.location.href = 'admin-panel.html';
                } else {
                    showCustomAlert(result.message || 'Error de autenticación.');
                    // Limpiar la contraseña por seguridad
                    document.getElementById('adminPassword').value = '';
                }
            } catch (error) {
                console.error('Error de red durante el login de administrador:', error);
                showCustomAlert('No se pudo conectar con el servidor. Inténtalo de nuevo.');
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAdminLoginPage);
} else {
    initializeAdminLoginPage();
}

export { initializeAdminLoginPage };
