// ============================================================================
// WintonCoin - Página de Recuperación de Contraseña
// ============================================================================
// Flujo de 3 pasos: (1) Ingresar email → (2) Código + nueva contraseña → (3) Éxito
// ============================================================================

import { getApiUrl, showCustomAlert } from '../modules/index.js';
import { togglePasswordVisibility } from '../modules/password-toggle.js';

// Hacer toggle disponible globalmente para el onclick del HTML
window.togglePasswordVisibility = togglePasswordVisibility;

// --- Estado del módulo ---
let storedEmail = '';
let resendTimer = null;
let resendCountdown = 60;

// --- Helpers ---

/**
 * Muestra un paso y oculta los demás.
 * @param {number} stepNumber - 1, 2 o 3
 */
function showStep(stepNumber) {
    document.querySelectorAll('.forgot-password-step').forEach(el => {
        el.classList.remove('active');
    });
    const target = document.getElementById(`forgot-step-${stepNumber}`);
    if (target) {
        target.classList.add('active');
    }
}

/**
 * Inicia el timer de cooldown para reenviar código.
 */
function startResendTimer() {
    resendCountdown = 60;
    const btn = document.getElementById('forgot-resend-btn');
    const display = document.getElementById('forgot-timer-display');
    if (!btn || !display) return;

    btn.disabled = true;
    btn.style.cursor = 'not-allowed';
    btn.style.color = 'var(--text-secondary-color)';
    display.textContent = resendCountdown;

    if (resendTimer) clearInterval(resendTimer);

    resendTimer = setInterval(() => {
        resendCountdown--;
        display.textContent = resendCountdown;

        if (resendCountdown <= 0) {
            clearInterval(resendTimer);
            resendTimer = null;
            btn.disabled = false;
            btn.style.cursor = 'pointer';
            btn.style.color = 'var(--primary-color)';
            btn.textContent = 'Reenviar código';
        }
    }, 1000);
}

/**
 * Deshabilita/habilita un botón y muestra texto de carga.
 */
function setButtonLoading(btnId, isLoading, originalText) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Procesando...' : originalText;
}

// --- Paso 1: Solicitar código ---

function initStep1() {
    const form = document.getElementById('forgotStep1Form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailInput = document.getElementById('forgot-email');
        const email = emailInput.value.trim();

        if (!email) {
            showCustomAlert('Por favor, ingresa tu correo electrónico.');
            return;
        }

        setButtonLoading('forgot-request-btn', true, 'Enviar código');

        try {
            const API_URL = getApiUrl();
            const response = await fetch(`${API_URL}/forgot-password/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                storedEmail = email;

                // Actualizar la UI del paso 2
                const emailDisplay = document.getElementById('forgot-email-display');
                if (emailDisplay) {
                    emailDisplay.textContent = email;
                }

                showStep(2);
                startResendTimer();

                // Focus en el campo de código
                const codeInput = document.getElementById('forgot-code');
                if (codeInput) codeInput.focus();
            } else {
                showCustomAlert(data.message || 'Error al procesar la solicitud.');
            }
        } catch (error) {
            console.error('Error en forgot-password request:', error);
            showCustomAlert('No se pudo conectar con el servidor. Inténtalo más tarde.');
        } finally {
            setButtonLoading('forgot-request-btn', false, 'Enviar código');
        }
    });
}

// --- Paso 2: Verificar código + nueva contraseña ---

function initStep2() {
    const form = document.getElementById('forgotStep2Form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const code = document.getElementById('forgot-code').value.trim();
        const newPassword = document.getElementById('forgot-new-password').value;
        const confirmPassword = document.getElementById('forgot-confirm-password').value;

        // Validaciones del frontend
        if (!code || code.length !== 6) {
            showCustomAlert('Ingresa el código de 6 dígitos enviado a tu correo.');
            return;
        }

        if (newPassword.length < 8) {
            showCustomAlert('La nueva contraseña debe tener al menos 8 caracteres.');
            return;
        }

        if (newPassword !== confirmPassword) {
            showCustomAlert('Las contraseñas no coinciden.');
            return;
        }

        setButtonLoading('forgot-verify-btn', true, 'Restablecer contraseña');

        try {
            const API_URL = getApiUrl();
            const response = await fetch(`${API_URL}/forgot-password/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: storedEmail,
                    code,
                    newPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Limpiar timer de reenvío
                if (resendTimer) {
                    clearInterval(resendTimer);
                    resendTimer = null;
                }

                showStep(3);
            } else {
                showCustomAlert(data.message || 'Error al verificar el código.');
            }
        } catch (error) {
            console.error('Error en forgot-password verify:', error);
            showCustomAlert('No se pudo conectar con el servidor. Inténtalo más tarde.');
        } finally {
            setButtonLoading('forgot-verify-btn', false, 'Restablecer contraseña');
        }
    });

    // Botón de reenviar código
    const resendBtn = document.getElementById('forgot-resend-btn');
    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            if (resendBtn.disabled || !storedEmail) return;

            resendBtn.disabled = true;
            resendBtn.textContent = 'Enviando...';

            try {
                const API_URL = getApiUrl();
                const response = await fetch(`${API_URL}/forgot-password/request`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: storedEmail })
                });

                if (response.ok) {
                    showCustomAlert('Se ha enviado un nuevo código a tu correo.');
                    startResendTimer();
                } else {
                    const data = await response.json();
                    showCustomAlert(data.message || 'Error al reenviar el código.');
                    // Re-enable after error
                    resendBtn.disabled = false;
                    resendBtn.textContent = 'Reenviar código';
                }
            } catch (error) {
                console.error('Error al reenviar código:', error);
                showCustomAlert('No se pudo conectar con el servidor.');
                resendBtn.disabled = false;
                resendBtn.textContent = 'Reenviar código';
            }
        });
    }

    // Botón "Cambiar correo" (volver al paso 1)
    const backBtn = document.getElementById('forgot-back-to-step1');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (resendTimer) {
                clearInterval(resendTimer);
                resendTimer = null;
            }
            showStep(1);
        });
    }
}

// --- Inicialización ---

function initializeForgotPasswordPage() {
    initStep1();
    initStep2();
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeForgotPasswordPage);
} else {
    initializeForgotPasswordPage();
}

export { initializeForgotPasswordPage };
