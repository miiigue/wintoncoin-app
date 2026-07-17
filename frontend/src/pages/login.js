// ============================================================================
// WintonCoin - Página de Login
// ============================================================================
// Entry point para la página de inicio de sesión
// ============================================================================

import { getApiUrl, showCustomAlert } from '../modules/index.js';
import { togglePasswordVisibility } from '../modules/password-toggle.js';
import { initPWAInstall, isPWAInstalled } from '../modules/pwa-install.js';
import { syncPendingPushSubscription } from '../modules/pushManager.js';
import { initInAppDetector } from '../modules/in-app-detector.js';

// Hacer toggle disponible globalmente para el onclick del HTML
window.togglePasswordVisibility = togglePasswordVisibility;

/**
 * Verifica si hay un código de referido pendiente y redirige a registro
 * SOLO la primera vez que se abre la app en esta sesión.
 * Después, el usuario puede navegar libremente entre login y registro.
 */
function checkPendingReferralAndRedirect() {
    const pendingRefCode = localStorage.getItem('pending_referral_code');
    const token = localStorage.getItem('token');
    const alreadyRedirected = sessionStorage.getItem('referral_redirect_done');

    // Si hay código de referido pendiente, NO hay sesión activa,
    // y NO hemos redirigido ya en esta sesión
    if (pendingRefCode && !token && !alreadyRedirected) {
        console.log('[Login] Primera apertura con código de referido - redirigiendo a registro...');
        // Marcar que ya redirigimos para no hacerlo de nuevo en esta sesión
        sessionStorage.setItem('referral_redirect_done', 'true');
        // window.location.href = 'register.html';
        return false; // CORRECCIÓN: No estamos redirigiendo, permitir cargar el login
    }

    return false; // No se redirige
}

/**
 * Inicializa el modal de política de cuenta única
 */
function initializePolicyModal() {
    const policyModal = document.getElementById('oneAccountPolicyModal');
    const closeButtons = document.querySelectorAll('.policy-close-button');

    const showPolicyModal = () => {
        if (policyModal && sessionStorage.getItem('policyModalShown') !== 'true') {
            policyModal.style.display = 'flex';
            sessionStorage.setItem('policyModalShown', 'true');
        }
    };

    const closePolicyModal = () => {
        if (policyModal) {
            policyModal.style.display = 'none';
        }
    };

    // Mostrar el modal al cargar la página
    showPolicyModal();

    // Añadir eventos a los botones de cierre
    closeButtons.forEach(button => {
        button.addEventListener('click', closePolicyModal);
    });

    // Cerrar el modal si se hace clic fuera de él
    window.addEventListener('click', (event) => {
        if (event.target === policyModal) {
            closePolicyModal();
        }
    });
}

/**
 * Valida que una URL de retorno sea segura (misma origen, ruta relativa interna).
 * Previene ataques de Open Redirect aceptando solo rutas .html del propio sitio.
 * @param {string} raw - Valor crudo del parámetro returnTo
 * @returns {string|null} Ruta segura o null si es inválida
 */
function _getSafeReturnTo(raw) {
    if (!raw || typeof raw !== 'string') return null;

    // URLSearchParams.get() ya decodifica, así que raw llega como texto plano.
    const value = raw;

    if (value.includes('://') || value.startsWith('//')) return null;
    if (value.includes('javascript:') || value.includes('data:')) return null;

    // SEGURIDAD FINTECH (SOC 2): Whitelist estricta de páginas internas permitidas para redirección segura
    // previniendo cualquier ataque de redirección abierta (Open Redirect) hacia dominios externos maliciosos.
    const ALLOWED_PAGES = [
        'governance-panel.html',
        'contract_interaction.html',
        'admin-panel.html',
        'causa-solidaria.html',
        'publication-detail.html'
    ];

    const pagePart = value.split('?')[0].replace(/^\//, '');
    if (!ALLOWED_PAGES.includes(pagePart)) return null;

    return value;
}

/**
 * Inicializa el formulario de login
 */
function initializeLoginForm() {
    const API_URL = getApiUrl();
    const loginForm = document.getElementById('loginForm');

    if (!loginForm) {
        console.error('El formulario con id "loginForm" no fue encontrado.');
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const returnTo = _getSafeReturnTo(urlParams.get('returnTo'));

    loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const identifier = document.getElementById('identifier').value.trim();
        const password = document.getElementById('password').value;
        const loginUrl = `${API_URL}/login`;

        try {
            const response = await fetch(loginUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ identifier, password })
            });

            if (response.ok) {
                const result = await response.json();

                if (result.token && result.username) {
                    localStorage.setItem('token', result.token);
                    localStorage.setItem('username', result.username);

                    if (result.requires_terms_acceptance) {
                        localStorage.setItem('requires_terms_acceptance', 'true');
                    } else {
                        localStorage.removeItem('requires_terms_acceptance');
                    }

                    // Sincronizar suscripción push pendiente (si existe)
                    await syncPendingPushSubscription();

                    if (result.requires_terms_acceptance) {
                        showCustomAlert(
                            'Tu sesión está activa, pero necesitas aceptar los documentos legales vigentes para operar. Podrás entrar y explorar, pero las acciones estarán bloqueadas hasta aceptar.'
                        );
                    }

                    window.location.href = returnTo || 'contract_interaction.html';
                } else {
                    showCustomAlert('Error: La respuesta del servidor no incluyó un token de sesión.');
                }
            } else {
                const errorResult = await response.json();
                showCustomAlert(`Error: ${errorResult.message}`);
                document.getElementById('password').value = '';
            }
        } catch (error) {
            console.error('Error de red o al conectar con el servidor:', error);
            showCustomAlert('No se pudo conectar con el servidor. Asegúrate de que está en funcionamiento.');
        }
    });
}

/**
 * Inicialización principal de la página de login
 */
function initializeLoginPage() {
    // Detectar y orientar si se corre en el navegador interno de WhatsApp/Instagram
    initInAppDetector();

    // PRIMERO: Verificar si hay código de referido pendiente
    // Si lo hay, redirigir a registro y no continuar
    if (checkPendingReferralAndRedirect()) {
        return; // Salir, ya que se está redirigiendo
    }

    initializePolicyModal();
    initializeLoginForm();
    initPWAInstall(); // Inicializar botón de instalación PWA

    // OPTIMIZACIÓN DE ADQUISICIÓN: Si existe returnTo en la URL, propagarlo al enlace de registro (Registrarse)
    // para asegurar que si el usuario decide crearse una cuenta en lugar de ingresar con una existente,
    // el contexto de redirección original no se pierda.
    const urlParams = new URLSearchParams(window.location.search);
    const returnTo = urlParams.get('returnTo');
    if (returnTo) {
        const registerLink = document.querySelector('a[href="register.html"], a.secondary-action-button');
        if (registerLink) {
            registerLink.href = `register.html?returnTo=${encodeURIComponent(returnTo)}`;
        }
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLoginPage);
} else {
    initializeLoginPage();
}

// Exportar funciones para uso en tests o extensiones
export { initializeLoginPage, initializePolicyModal, initializeLoginForm };
