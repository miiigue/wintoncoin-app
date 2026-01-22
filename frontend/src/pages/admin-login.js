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
            const password = document.getElementById('adminPassword').value;

            try {
                const response = await fetch(`${API_URL}/api/admin/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password }),
                    credentials: 'include'
                });

                const result = await response.json();

                if (response.ok) {
                    window.location.href = 'admin-panel.html';
                } else {
                    showCustomAlert(result.message || 'Error de autenticación.');
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
