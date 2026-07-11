// ============================================================================
// WintonCoin - Página de Registro
// ============================================================================
// Entry point para la página de registro de usuarios
// ============================================================================

import { getApiUrl, showCustomAlert, checkAuthStatus } from '../modules/index.js';
import { togglePasswordVisibility } from '../modules/password-toggle.js';
import { initPWAInstall, restoreReferralCode, isPWAInstalled } from '../modules/pwa-install.js';
import { syncPendingPushSubscription } from '../modules/pushManager.js';

// Hacer toggle disponible globalmente para el onclick del HTML
window.togglePasswordVisibility = togglePasswordVisibility;

// --- Variables globales del módulo ---
let isUsernameTaken = false;
let isEmailTaken = false;
let isPhoneTaken = false;
let policyModalTimeout = null;
let countdown;
let timer = 60;
let activeLegalDocuments = [];

// --- Funciones de utilidad ---
function safeShow(el) {
    if (el) el.style.display = 'block';
}

function safeHide(el) {
    if (el) el.style.display = 'none';
}

/**
 * Valida que una URL de retorno sea segura (misma origen, ruta relativa interna).
 * Previene ataques de Open Redirect en cumplimiento con estándares FinTech y auditorías SOC 2.
 * Acepta únicamente las páginas locales pre-autorizadas en la whitelist ALLOWED_PAGES.
 * @param {string} raw - Parámetro returnTo recibido sin procesar
 * @returns {string|null} URL segura o null en caso de detectar anomalía o dominio externo
 */
function _getSafeReturnTo(raw) {
    if (!raw || typeof raw !== 'string') return null;

    const value = raw;

    // Bloquear explícitamente URLs absolutas o esquemas no seguros (evitar suplantación de dominio)
    if (value.includes('://') || value.startsWith('//')) return null;
    if (value.includes('javascript:') || value.includes('data:')) return null;

    // Whitelist estricta de páginas seguras
    const ALLOWED_PAGES = [
        'governance-panel.html',
        'contract_interaction.html',
        'admin-panel.html',
        'causa-solidaria.html',
        'publication-detail.html'
    ];

    // Extraer únicamente el nombre del archivo de la ruta, ignorando parámetros query de momento
    const pagePart = value.split('?')[0].replace(/^\//, '');
    if (!ALLOWED_PAGES.includes(pagePart)) return null;

    return value;
}

function clearRegisterClientState() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('pendingVerificationPhone');
    localStorage.removeItem('pendingVerificationEmail');
    localStorage.removeItem('pending_verification_email');
}

// --- Configuración del banner de sesión ---
function configureSessionBanner(elements, { title, message, primaryText, onPrimary, secondaryText, onSecondary }) {
    const { sessionBanner, sessionBannerTitle, sessionBannerMessage, sessionPrimaryBtn, sessionSecondaryBtn, sessionLogoutBtn } = elements;

    if (!sessionBanner) return;

    sessionBannerTitle.textContent = title || 'Sesión detectada';
    sessionBannerMessage.textContent = message || '';

    sessionPrimaryBtn.textContent = primaryText || 'Continuar';
    sessionSecondaryBtn.textContent = secondaryText || 'Ir al perfil';

    sessionPrimaryBtn.onclick = typeof onPrimary === 'function' ? onPrimary : null;
    sessionSecondaryBtn.onclick = typeof onSecondary === 'function' ? onSecondary : () => { window.location.href = 'profile.html'; };
    sessionLogoutBtn.onclick = () => {
        clearRegisterClientState();
        window.location.reload();
    };

    safeShow(sessionBanner);
}

// --- Validación de estado pendiente con el backend ---
async function validateAndSetInitialStep(API_URL, pendingPhone, pendingEmail, step1Div, step2Div) {
    if (pendingPhone && pendingEmail) {
        try {
            const response = await fetch(`${API_URL}/api/auth/pending-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: pendingPhone, email: pendingEmail })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.isValid) {
                    console.log("Recuperando sesión de verificación pendiente...");
                    step1Div.style.display = 'none';
                    step2Div.style.display = 'block';

                    const hiddenEmailInput = document.getElementById('hiddenEmail');
                    const emailInputVal = document.getElementById('email');

                    if (hiddenEmailInput) hiddenEmailInput.value = pendingEmail;
                    if (emailInputVal) emailInputVal.value = pendingEmail;
                } else {
                    console.log("Sesión pendiente expirada o inválida según backend.");
                    localStorage.removeItem('pendingVerificationPhone');
                    localStorage.removeItem('pendingVerificationEmail');
                    step1Div.style.display = 'block';
                    step2Div.style.display = 'none';
                }
            } else {
                console.warn("Servidor retornó error al verificar estado pendiente:", response.status);
            }
        } catch (error) {
            console.error('Error de conexión al validar estado pendiente:', error);
        }
    }
}

// --- Temporizador para reenvío de código ---
function startResendTimer(resendBtn, resendTimerSpan) {
    resendBtn.disabled = true;
    timer = 60;
    resendTimerSpan.textContent = `(espera ${timer}s)`;

    countdown = setInterval(() => {
        timer--;
        resendTimerSpan.textContent = `(espera ${timer}s)`;
        if (timer <= 0) {
            clearInterval(countdown);
            resendTimerSpan.textContent = '';
            resendBtn.disabled = false;
        }
    }, 1000);
}

// --- Verificación de campos únicos ---
function setupFieldValidation(API_URL, checkAgreements) {
    const usernameInput = document.getElementById('username');
    const usernameFeedback = document.getElementById('username-feedback');
    const emailInput = document.getElementById('email');
    const emailFeedback = document.getElementById('email-feedback');
    const phoneInput = document.getElementById('phone');
    const phoneFeedback = document.getElementById('phone-feedback');

    // Validación de username
    if (usernameInput && usernameFeedback) {
        usernameInput.addEventListener('blur', async () => {
            const username = usernameInput.value.trim();
            usernameFeedback.style.display = 'none';
            usernameInput.style.borderColor = '';

            if (!username) return;

            // Validación: mínimo 3 caracteres
            if (username.length < 3) {
                usernameFeedback.textContent = 'El usuario debe tener al menos 3 caracteres.';
                usernameFeedback.style.color = '#dc3545';
                usernameFeedback.style.display = 'block';
                return;
            }

            // Validación: máximo 30 caracteres
            if (username.length > 30) {
                usernameFeedback.textContent = 'El usuario no puede tener más de 30 caracteres.';
                usernameFeedback.style.color = '#dc3545';
                usernameFeedback.style.display = 'block';
                return;
            }

            // Validación: solo alfanuméricos y guiones bajos, sin espacios
            const usernameRegex = /^[a-zA-Z0-9_]+$/;
            if (!usernameRegex.test(username)) {
                usernameFeedback.textContent = 'Solo letras, números y guiones bajos (_). Sin espacios ni caracteres especiales.';
                usernameFeedback.style.color = '#dc3545';
                usernameFeedback.style.display = 'block';
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/check-username/${username}`);
                if (!response.ok) throw new Error('Error de red');

                const data = await response.json();

                if (!data.available) {
                    usernameFeedback.textContent = data.message;
                    usernameFeedback.style.color = '#dc3545';
                    usernameFeedback.style.display = 'block';
                    usernameFeedback.style.fontWeight = 'bold';
                    usernameInput.style.borderColor = '#dc3545';
                    isUsernameTaken = true;
                } else {
                    usernameFeedback.textContent = '¡Usuario disponible!';
                    usernameFeedback.style.color = '#28a745';
                    usernameFeedback.style.display = 'block';
                    usernameFeedback.style.fontWeight = 'bold';
                    usernameInput.style.borderColor = '#28a745';
                    isUsernameTaken = false;
                }
                checkAgreements();
            } catch (error) {
                console.error('Error verificando usuario:', error);
            }
        });

        usernameInput.addEventListener('input', () => {
            if (isUsernameTaken) {
                isUsernameTaken = false;
                usernameFeedback.style.display = 'none';
                usernameInput.style.borderColor = '';
                checkAgreements();
            }
        });
    }

    // Validación de email
    if (emailInput && emailFeedback) {
        emailInput.addEventListener('blur', async () => {
            const email = emailInput.value.trim();
            emailFeedback.style.display = 'none';
            emailInput.style.borderColor = '';

            if (!email) return;

            if (!/^\S+@\S+\.\S+$/.test(email)) {
                emailFeedback.textContent = 'Formato de correo inválido.';
                emailFeedback.style.color = '#dc3545';
                emailFeedback.style.display = 'block';
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/check-email/${encodeURIComponent(email)}`);
                if (!response.ok) throw new Error('Error de red');

                const data = await response.json();

                if (!data.available) {
                    emailFeedback.textContent = data.message;
                    emailFeedback.style.color = '#dc3545';
                    emailFeedback.style.display = 'block';
                    emailFeedback.style.fontWeight = 'bold';
                    emailInput.style.borderColor = '#dc3545';
                    isEmailTaken = true;
                } else {
                    emailFeedback.textContent = 'Correo disponible.';
                    emailFeedback.style.color = '#28a745';
                    emailFeedback.style.display = 'block';
                    emailFeedback.style.fontWeight = 'bold';
                    emailInput.style.borderColor = '#28a745';
                    isEmailTaken = false;
                }
                checkAgreements();
            } catch (error) {
                console.error('Error verificando email:', error);
            }
        });

        emailInput.addEventListener('input', () => {
            if (isEmailTaken) {
                isEmailTaken = false;
                emailFeedback.style.display = 'none';
                emailInput.style.borderColor = '';
                checkAgreements();
            }
        });
    }

    // Validación de teléfono
    if (phoneInput && phoneFeedback) {
        phoneInput.addEventListener('blur', async () => {
            const phone = phoneInput.value.trim();
            phoneFeedback.style.display = 'none';
            phoneInput.style.borderColor = '';

            if (!phone) return;

            if (phone.length < 7) {
                phoneFeedback.textContent = 'El teléfono parece demasiado corto.';
                phoneFeedback.style.color = '#dc3545';
                phoneFeedback.style.display = 'block';
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/check-phone/${encodeURIComponent(phone)}`);
                if (!response.ok) throw new Error('Error de red');

                const data = await response.json();

                if (!data.available) {
                    phoneFeedback.textContent = data.message;
                    phoneFeedback.style.color = '#dc3545';
                    phoneFeedback.style.display = 'block';
                    phoneFeedback.style.fontWeight = 'bold';
                    phoneInput.style.borderColor = '#dc3545';
                    isPhoneTaken = true;
                } else {
                    phoneFeedback.textContent = 'Teléfono disponible.';
                    phoneFeedback.style.color = '#28a745';
                    phoneFeedback.style.display = 'block';
                    phoneFeedback.style.fontWeight = 'bold';
                    phoneInput.style.borderColor = '#28a745';
                    isPhoneTaken = false;
                }
                checkAgreements();
            } catch (error) {
                console.error('Error verificando teléfono:', error);
            }
        });

        phoneInput.addEventListener('input', () => {
            if (isPhoneTaken) {
                isPhoneTaken = false;
                phoneFeedback.style.display = 'none';
                phoneInput.style.borderColor = '';
                checkAgreements();
            }
        });
    }
}

// --- Manejo de modales ---
function setupModals() {
    const referralModal = document.getElementById('referralCodeModal');
    const referralCloseButtons = document.querySelectorAll('.referral-close-button');
    const getReferralCodeBtn = document.getElementById('getReferralCodeBtn');
    const policyModal = document.getElementById('oneAccountPolicyModal');
    const policyCloseButtons = document.querySelectorAll('.policy-close-button');

    const showPolicyModal = () => {
        if (policyModal && sessionStorage.getItem('policyModalShown') !== 'true') {
            policyModal.style.display = 'flex';
            sessionStorage.setItem('policyModalShown', 'true');
        }
    };

    const closePolicyModal = () => {
        if (policyModal) {
            policyModal.style.display = 'none';
            if (policyModalTimeout) {
                clearTimeout(policyModalTimeout);
                policyModalTimeout = null;
            }
        }
    };

    const showReferralModal = () => {
        if (referralModal && sessionStorage.getItem('referralModalShown') !== 'true') {
            referralModal.style.display = 'flex';
            sessionStorage.setItem('referralModalShown', 'true');
        }
    };

    const closeReferralModal = () => {
        if (referralModal) {
            referralModal.style.display = 'none';
            if (policyModalTimeout) {
                clearTimeout(policyModalTimeout);
            }
            policyModalTimeout = setTimeout(() => {
                showPolicyModal();
            }, 10000);
        }
    };

    // Event listeners para modal de referido
    if (getReferralCodeBtn) {
        getReferralCodeBtn.addEventListener('click', () => {
            window.open('/', '_blank', 'noopener,noreferrer');
            closeReferralModal();
        });
    }

    referralCloseButtons.forEach(button => button.addEventListener('click', closeReferralModal));

    if (referralModal) {
        window.addEventListener('click', (event) => {
            if (event.target === referralModal) {
                closeReferralModal();
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && referralModal && referralModal.style.display === 'flex') {
            closeReferralModal();
        }
    });

    // Event listeners para modal de política
    policyCloseButtons.forEach(button => button.addEventListener('click', closePolicyModal));
    window.addEventListener('click', (event) => {
        if (event.target === policyModal) closePolicyModal();
    });

    return { showReferralModal, showPolicyModal };
}

// --- Manejo de campos de menor de edad ---
function setupMinorFields() {
    const dateOfBirthInput = document.getElementById('date_of_birth');
    const minorFieldsDiv = document.getElementById('minor-fields');

    if (dateOfBirthInput && minorFieldsDiv) {
        function checkAgeAndShowMinorFields() {
            const dateOfBirth = dateOfBirthInput.value;
            if (!dateOfBirth) {
                minorFieldsDiv.style.display = 'none';
                return;
            }

            const birthDate = new Date(dateOfBirth);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }

            if (age >= 13 && age < 18) {
                minorFieldsDiv.style.display = 'block';
            } else {
                minorFieldsDiv.style.display = 'none';
            }
        }

        dateOfBirthInput.addEventListener('change', checkAgeAndShowMinorFields);
    }
}

// --- Inicialización principal ---
async function initializeRegisterPage() {
    const API_URL = getApiUrl();

    // Inicializar botón de instalación PWA
    initPWAInstall();

    // Referencias a elementos del DOM
    const registerForm = document.getElementById('registerForm');
    const verifyForm = document.getElementById('verifyForm');
    const step1Div = document.getElementById('registration-step-1');
    const step2Div = document.getElementById('verification-step-2');
    const container = document.querySelector('.container');
    const resendBtn = document.getElementById('resend-code-btn');
    const resendTimerSpan = document.getElementById('resend-timer');

    // Elementos del banner de sesión
    const sessionElements = {
        sessionBanner: document.getElementById('session-banner'),
        sessionBannerTitle: document.getElementById('session-banner-title'),
        sessionBannerMessage: document.getElementById('session-banner-message'),
        sessionPrimaryBtn: document.getElementById('session-action-primary'),
        sessionSecondaryBtn: document.getElementById('session-action-secondary'),
        sessionLogoutBtn: document.getElementById('session-action-logout')
    };

    // Verificar estado pendiente
    const pendingPhone = localStorage.getItem('pendingVerificationPhone');
    const pendingEmail = localStorage.getItem('pendingVerificationEmail');
    validateAndSetInitialStep(API_URL, pendingPhone, pendingEmail, step1Div, step2Div);

    async function loadActiveLegalDocuments() {
        try {
            const response = await fetch(`${API_URL}/api/legal/documents/active`);
            if (!response.ok) {
                throw new Error('No se pudieron cargar los documentos legales activos.');
            }
            const payload = await response.json();
            activeLegalDocuments = Array.isArray(payload.activeDocuments) ? payload.activeDocuments : [];
        } catch (error) {
            console.error('[Register] Error cargando documentos legales activos:', error);
            activeLegalDocuments = [];
        }
    }

    await loadActiveLegalDocuments();

    // Comprobar estado de autenticación
    const session = await checkAuthStatus();

    if (session.isAuthenticated) {
        safeHide(step1Div);
        safeHide(step2Div);

        const username = session.username || 'tu cuenta';

        if (!session.is_verified) {
            configureSessionBanner(sessionElements, {
                title: 'Verificación pendiente',
                message: `Tienes una sesión activa como "${username}" pero tu cuenta aún no está verificada. Para mantener seguridad y auditoría (estándar fintech), debes completar la verificación o cerrar sesión antes de crear otra cuenta.`,
                primaryText: 'Continuar verificación',
                onPrimary: () => {
                    safeHide(step1Div);
                    safeShow(step2Div);
                    showCustomAlert('Introduce el código de verificación que te enviamos para completar tu registro.');
                },
                secondaryText: 'Ir al perfil',
                onSecondary: () => { window.location.href = 'profile.html'; }
            });
        } else {
            configureSessionBanner(sessionElements, {
                title: 'Sesión activa',
                message: `Ya tienes una sesión iniciada como "${username}". Por estándar profesional, el registro se bloquea mientras exista una sesión activa. Puedes ir a tu perfil o cerrar sesión para registrar otra cuenta de prueba.`,
                primaryText: 'Ir al perfil',
                onPrimary: () => { window.location.href = 'profile.html'; },
                secondaryText: 'Volver al inicio',
                onSecondary: () => { window.location.href = 'index.html'; }
            });
        }
        return;
    }

    // Configurar checkboxes de términos
    const termsGeneralCheck = document.getElementById('terms-general');
    const privacyPolicyCheck = document.getElementById('privacy-policy');
    const termsPreLaunchCheck = document.getElementById('terms-pre-launch');
    const termsEconomicCheck = document.getElementById('terms-economic');
    const termsDebtCheck = document.getElementById('terms-debt');
    const termsRiskCheck = document.getElementById('terms-risk');
    const registerRequestBtn = document.getElementById('register-request-btn');

    if (termsGeneralCheck && privacyPolicyCheck && termsPreLaunchCheck && termsEconomicCheck && termsDebtCheck &&
        termsRiskCheck && registerRequestBtn) {
        const allCheckboxes = [
            termsGeneralCheck,
            privacyPolicyCheck,
            termsPreLaunchCheck,
            termsEconomicCheck,
            termsDebtCheck,
            termsRiskCheck
        ];

        function checkAgreements() {
            const allChecked = allCheckboxes.every(checkbox => checkbox.checked);
            registerRequestBtn.disabled = !allChecked || isUsernameTaken || isEmailTaken || isPhoneTaken;
        }

        checkAgreements();
        allCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', checkAgreements);
        });

        // Configurar validación de campos
        setupFieldValidation(API_URL, checkAgreements);
    }

    // Configurar modales
    const { showReferralModal, showPolicyModal } = setupModals();

    // Verificar código de referido en URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCodeFromUrl = urlParams.get('ref');
    const referralCodeInput = document.getElementById('referral_code');

    if (refCodeFromUrl && referralCodeInput) {
        referralCodeInput.value = refCodeFromUrl.trim().toUpperCase();
        // Guardar en localStorage para que persista después de instalar la PWA
        localStorage.setItem('pending_referral_code', refCodeFromUrl.trim().toUpperCase());
    } else if (isPWAInstalled()) {
        // Si estamos en la PWA instalada, restaurar código de referido guardado
        restoreReferralCode();
    }

    // Mostrar modales según corresponda
    if (!refCodeFromUrl) {
        const referralModalShown = sessionStorage.getItem('referralModalShown') === 'true';
        const policyModalShown = sessionStorage.getItem('policyModalShown') === 'true';

        if (!referralModalShown) {
            showReferralModal();
        } else if (!policyModalShown) {
            showPolicyModal();
        }
    } else {
        showPolicyModal();
    }

    // Configurar campos de menor de edad
    setupMinorFields();

    // OPTIMIZACIÓN DE ADQUISICIÓN: Si hay una redirección pendiente en la query string de la página,
    // propagarla al enlace de login ("Iniciar Sesión") por si el usuario ya posee una cuenta activa.
    const returnToParam = urlParams.get('returnTo');
    if (returnToParam) {
        const loginLink = document.querySelector('a.login-link-text');
        if (loginLink) {
            loginLink.href = `login.html?returnTo=${encodeURIComponent(returnToParam)}`;
        }
    }

    // Listener para cuando registros estén cerrados
    document.addEventListener('app-settings-loaded', () => {
        if (window.appSettings && !window.appSettings.allow_new_registrations) {
            container.innerHTML = `
                <h1>Registro Cerrado</h1>
                <p>En este momento no se aceptan nuevos registros. Por favor, inténtalo de nuevo más tarde.</p>
                <p><a href="index.html">Volver a inicio de sesión</a></p>
            `;
        }
    });

    // --- LÓGICA DEL WIZARD (Nuevo) ---
    function setupWizard() {
        const steps = document.querySelectorAll('.wizard-step');
        const dots = document.querySelectorAll('.wizard-step-dot');
        const progressFill = document.getElementById('progress-line-fill');
        const nextBtns = document.querySelectorAll('.next-step-btn');
        const prevBtns = document.querySelectorAll('.prev-step-btn');
        let currentStep = 1;

        // Actualizar barra de progreso
        function updateProgress(step) {
            // Calcular porcentaje de relleno de la barra
            // Total pasos = 3. 
            // Paso 1: 0% (inicio) o 50% (hacia 2)? 
            // Vamos a hacerlo visual: 
            // Step 1 -> 2: 50%
            // Step 2 -> 3: 100%
            const totalSteps = 3;
            const percentage = ((step - 1) / (totalSteps - 1)) * 100;
            if (progressFill) progressFill.style.width = `${percentage}%`;

            // Actualizar dots
            dots.forEach(dot => {
                const dotStep = parseInt(dot.dataset.step);
                dot.classList.remove('active', 'completed');
                if (dotStep === step) {
                    dot.classList.add('active');
                } else if (dotStep < step) {
                    dot.classList.add('completed');
                    // Cambiar el número por check? Opcional. 
                    dot.querySelector('.dot-circle').innerHTML = '✓';
                } else {
                    dot.querySelector('.dot-circle').innerHTML = dotStep;
                }
            });

            // Mostrar paso actual
            steps.forEach(s => {
                s.style.display = (parseInt(s.dataset.stepIndex) === step) ? 'block' : 'none';
                if (parseInt(s.dataset.stepIndex) === step) {
                    s.classList.add('active-step');
                } else {
                    s.classList.remove('active-step');
                }
            });

            currentStep = step;

            // Scroll arriba suave
            const wizardContainer = document.getElementById('wizard-progress-container');
            if (wizardContainer) wizardContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Validar Paso 1
        function validateStep1() {
            const email = document.getElementById('email').value.trim();
            const pass = document.getElementById('password').value;
            const confirm = document.getElementById('confirmPassword').value;
            const emailFeedback = document.getElementById('email-feedback');

            if (!email || !pass || !confirm) {
                showCustomAlert('Por favor completa todos los campos.');
                return false;
            }
            if (pass !== confirm) {
                showCustomAlert('Las contraseñas no coinciden.');
                return false;
            }
            if (pass.length < 8) {
                showCustomAlert('La contraseña debe tener al menos 8 caracteres.');
                return false;
            }

            // Comprobación básica de email (la validación asíncrona ocurre en blur, aquí checamos si ya dio error)
            if (isEmailTaken) {
                showCustomAlert('El correo electrónico ya está registrado o no es válido.');
                return false;
            }

            return true;
        }

        // Validar Paso 2
        function validateStep2() {
            const username = document.getElementById('username').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const dob = document.getElementById('date_of_birth').value;

            if (!username || !phone || !dob) {
                showCustomAlert('Por favor completa todos los campos de tu perfil.');
                return false;
            }

            if (isUsernameTaken) {
                showCustomAlert('El nombre de usuario no está disponible.');
                return false;
            }

            if (isPhoneTaken) {
                showCustomAlert('El teléfono ya está registrado o no es válido.');
                return false;
            }

            // Validar edad (copiado de lógica anterior)
            const birthDate = new Date(dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            if (age < 13) {
                showCustomAlert('Debes tener al menos 13 años para registrarte.');
                return false;
            }

            return true;
        }

        // Listeners Botones Siguiente
        nextBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const nextStep = parseInt(btn.dataset.next);

                // Validación antes de avanzar
                if (currentStep === 1 && !validateStep1()) return;
                if (currentStep === 2 && !validateStep2()) return;

                updateProgress(nextStep);
            });
        });

        // Listeners Botones Atrás
        prevBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const prevStep = parseInt(btn.dataset.prev);
                updateProgress(prevStep);
            });
        });

        // Inicializar
        updateProgress(1);
    }

    // Ejecutar setup wizard
    setupWizard();

    // --- PASO 1 (FINAL SUBMIT): Formulario de registro ---
    if (registerForm) {
        registerForm.addEventListener('submit', async function (event) {
            event.preventDefault();

            // Recopilar datos de TODOS los pasos (están en el mismo form)
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            // email, phone, dob ya validados
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const dateOfBirth = document.getElementById('date_of_birth').value;
            // referral code
            const referralCode = document.getElementById('referral_code')?.value;
            const termsGeneralAccepted = !!document.getElementById('terms-general')?.checked;
            const privacyPolicyAccepted = !!document.getElementById('privacy-policy')?.checked;

            const acceptedLegalDocuments = activeLegalDocuments.filter((doc) => {
                if (doc.type === 'terms_and_conditions') return termsGeneralAccepted;
                if (doc.type === 'privacy_policy') return privacyPolicyAccepted;
                return false;
            }).map((doc) => ({
                type: doc.type,
                version: doc.version,
                content_hash: doc.content_hash
            }));

            // ... (Resto de lógica de envío igual, pero ya validamos edad en el wizard)

            try {
                if (activeLegalDocuments.length === 0) {
                    showCustomAlert('No se pudieron cargar los documentos legales vigentes. Recarga la página e inténtalo nuevamente.');
                    return;
                }

                // Deshabilitar botón para evitar doble envío
                const submitBtn = document.getElementById('register-request-btn');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerText = 'Procesando...';
                }

                // Payload incluye referral_code si existe
                const payload = {
                    username,
                    password,
                    email,
                    phone,
                    date_of_birth: dateOfBirth,
                    referral_code: referralCode,
                    acceptedLegalDocuments
                };

                const response = await fetch(`${API_URL}/api/register-request`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (response.ok) {
                    showCustomAlert(result.message);

                    const hiddenEmailInput = document.getElementById('hiddenEmail');
                    if (hiddenEmailInput) hiddenEmailInput.value = email;

                    localStorage.setItem('pendingVerificationPhone', phone);
                    localStorage.setItem('pendingVerificationEmail', email);

                    // Ocultar wizard completo, mostrar paso verificación
                    const wizardContainer = document.getElementById('wizard-progress-container');
                    const formContainer = document.getElementById('registration-step-1'); // Ahora es wizard-form-container

                    if (wizardContainer) wizardContainer.style.display = 'none';
                    if (formContainer) formContainer.style.display = 'none';

                    step2Div.style.display = 'block';

                    startResendTimer(resendBtn, resendTimerSpan);
                } else {
                    showCustomAlert(`Error: ${result.message}`);
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = 'Crear Cuenta';
                    }
                }
            } catch (error) {
                console.error('Error de red o al conectar con el servidor:', error);
                showCustomAlert('No se pudo conectar con el servidor. Asegúrate de que está en funcionamiento.');
                const submitBtn = document.getElementById('register-request-btn');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'Crear Cuenta';
                }
            }
        });
    }

    // --- PASO 2: Formulario de verificación ---
    if (verifyForm) {
        verifyForm.addEventListener('submit', async function (event) {
            event.preventDefault();

            const verificationCode = document.getElementById('verificationCode').value;
            const email = (document.getElementById('hiddenEmail')?.value || document.getElementById('email')?.value || '').trim();
            const referral_code = document.getElementById('referral_code').value;

            try {
                const response = await fetch(`${API_URL}/api/register-verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ email, verificationCode, referral_code })
                });

                const result = await response.json();

                if (response.ok) {
                    showCustomAlert(result.message + ' Has iniciado sesión correctamente.');
                    localStorage.setItem('token', result.token);
                    localStorage.setItem('username', result.username);

                    localStorage.removeItem('pendingVerificationPhone');
                    localStorage.removeItem('pendingVerificationEmail');
                    localStorage.removeItem('pending_verification_email');
                    // Limpiar código de referido ya que el registro se completó
                    localStorage.removeItem('pending_referral_code');

                    // Sincronizar suscripción push pendiente (si existe)
                    await syncPendingPushSubscription();

                    // REDIRECCIÓN DE RETORNO SEGURA: Validar que el parámetro returnTo cumpla
                    // las directivas de seguridad para evitar redirecciones abiertas y redirigir.
                    const returnTo = _getSafeReturnTo(urlParams.get('returnTo'));
                    window.location.href = returnTo || 'contract_interaction.html';
                } else {
                    showCustomAlert(`Error: ${result.message}`);
                }
            } catch (error) {
                console.error('Error de red o al conectar con el servidor:', error);
                showCustomAlert('No se pudo conectar con el servidor.');
            }
        });
    }

    // Iniciar temporizador si paso 2 está visible
    if (step2Div && step2Div.style.display === 'block') {
        startResendTimer(resendBtn, resendTimerSpan);
    }

    // Botón de reenvío de código
    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            const email = document.getElementById('email')?.value || localStorage.getItem('pendingVerificationEmail');

            if (!email) {
                showCustomAlert('No se pudo encontrar el email para reenviar el código. Por favor, recarga la página e inténtalo de nuevo.');
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/auth/resend-code`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                });

                const result = await response.json();

                if (response.ok) {
                    showCustomAlert(result.message);
                    startResendTimer(resendBtn, resendTimerSpan);
                } else {
                    showCustomAlert(`Error: ${result.message}`);
                }
            } catch (error) {
                console.error('Error de red al reenviar el código:', error);
                showCustomAlert('No se pudo conectar con el servidor para reenviar el código.');
            }
        });
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeRegisterPage);
} else {
    initializeRegisterPage();
}

// Exportar funciones para uso en tests o extensiones
export { initializeRegisterPage };
