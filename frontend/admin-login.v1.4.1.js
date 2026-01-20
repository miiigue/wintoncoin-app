// admin-login.js
document.addEventListener('DOMContentLoaded', () => {
    // Lógica para determinar la URL del API automáticamente
    const API_URL = window.getApiUrl();

    const adminLoginForm = document.getElementById('adminLoginForm');

    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const password = document.getElementById('adminPassword').value;

            try {
                // Modificado: Usamos 'credentials: include' para permitir que el servidor establezca la cookie
                const response = await fetch(`${API_URL}/api/admin/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password }),
                    credentials: 'include' // CRÍTICO: Permite recibir cookies del servidor
                });

                const result = await response.json();

                if (response.ok) {
                    // YA NO guardamos el token en localStorage. 
                    // El servidor lo ha enviado en una cookie HttpOnly.
                    // localStorage.setItem('adminToken', result.token); <-- ELIMINADO POR SEGURIDAD
                    
                    // Redirigimos al panel
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
// admin-login.js
document.addEventListener('DOMContentLoaded', () => {
    // Lógica para determinar la URL del API automáticamente
    const API_URL = window.getApiUrl();

    const adminLoginForm = document.getElementById('adminLoginForm');

    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const password = document.getElementById('adminPassword').value;

            try {
                // Modificado: Usamos 'credentials: include' para permitir que el servidor establezca la cookie
                const response = await fetch(`${API_URL}/api/admin/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password }),
                    credentials: 'include' // CRÍTICO: Permite recibir cookies del servidor
                });

                const result = await response.json();

                if (response.ok) {
                    // YA NO guardamos el token en localStorage. 
                    // El servidor lo ha enviado en una cookie HttpOnly.
                    // localStorage.setItem('adminToken', result.token); <-- ELIMINADO POR SEGURIDAD
                    
                    // Redirigimos al panel
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
