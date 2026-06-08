// ============================================================================
// WintonCoin - Página para Reclamar Cuenta de Administrador Invitado
// ============================================================================

import { getApiUrl, showCustomAlert } from '../modules/index.js';

function initializeAdminRegisterPage() {
    const API_URL = getApiUrl();
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const errorText = document.getElementById('errorText');
    const formState = document.getElementById('formState');
    
    const inviteEmail = document.getElementById('inviteEmail');
    const inviteRole = document.getElementById('inviteRole');
    const adminClaimForm = document.getElementById('adminClaimForm');

    if (!token) {
        showError("Token de invitación faltante en la dirección URL.");
        return;
    }

    // 1. Validar el token en el servidor al cargar la vista
    verifyToken();

    async function verifyToken() {
        try {
            const response = await fetch(`${API_URL}/api/admin/invitations/verify/${token}`);
            const result = await response.json();

            if (response.ok) {
                // Configurar detalles de la invitación
                inviteEmail.textContent = result.email;
                inviteRole.textContent = result.role;
                
                // Mostrar formulario y ocultar estado de carga
                loadingState.style.display = 'none';
                formState.style.display = 'block';
            } else {
                showError(result.message || 'El enlace de invitación no es válido o ha expirado.');
            }
        } catch (error) {
            console.error('Error al verificar token:', error);
            showError('No se pudo establecer conexión con el servidor.');
        }
    }

    // 2. Controlar envío del formulario de registro
    if (adminClaimForm) {
        adminClaimForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const username = document.getElementById('adminUsername').value.trim();
            const password = document.getElementById('adminPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            // Validaciones básicas de robustez en cliente
            if (password !== confirmPassword) {
                showCustomAlert("Las contraseñas no coinciden.");
                return;
            }

            if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
                showCustomAlert("La contraseña debe tener al menos 8 caracteres, e incluir letras y números.");
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/admin/invitations/claim`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, username, password })
                });

                const result = await response.json();

                if (response.ok) {
                    // Informar y redirigir
                    showCustomAlert("Cuenta de administrador activada exitosamente. Serás redirigido al login.", () => {
                        window.location.href = 'admin.html';
                    });
                    
                    // Fallback de seguridad en caso de que no se resuelva el modal
                    setTimeout(() => {
                        window.location.href = 'admin.html';
                    }, 4000);
                } else {
                    showCustomAlert(result.message || "Error al crear la cuenta.");
                }
            } catch (error) {
                console.error("Error al registrar administrador:", error);
                showCustomAlert("Error de red. No se pudo conectar con el servidor.");
            }
        });
    }

    function showError(message) {
        loadingState.style.display = 'none';
        errorText.textContent = message;
        errorState.style.display = 'block';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAdminRegisterPage);
} else {
    initializeAdminRegisterPage();
}

export { initializeAdminRegisterPage };
