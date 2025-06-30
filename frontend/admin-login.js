document.addEventListener('DOMContentLoaded', () => {
    // Lógica para determinar la URL del API automáticamente
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';

    const adminLoginForm = document.getElementById('adminLoginForm');

    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const password = document.getElementById('adminPassword').value;

            try {
                const response = await fetch(`${API_URL}/api/admin/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });

                const result = await response.json();

                if (response.ok) {
                    // El estándar profesional es usar un token (JWT) para la autenticación.
                    // Lo guardamos en sessionStorage.
                    sessionStorage.setItem('adminToken', result.token);
                    // Redirigimos al futuro panel de administración.
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
}); 