document.addEventListener('DOMContentLoaded', async function() {
    // Lógica para determinar la URL del API automáticamente
    const API_URL = window.getApiUrl();
    
    // Referencias a los elementos del DOM
    const registerForm = document.getElementById('registerForm');
    const verifyForm = document.getElementById('verifyForm');
    const step1Div = document.getElementById('registration-step-1');
    const step2Div = document.getElementById('verification-step-2');
    const container = document.querySelector('.container');

    // --- NUEVO (Fintech UX): Banner de sesión activa / verificación pendiente ---
    const sessionBanner = document.getElementById('session-banner');
    const sessionBannerTitle = document.getElementById('session-banner-title');
    const sessionBannerMessage = document.getElementById('session-banner-message');
    const sessionPrimaryBtn = document.getElementById('session-action-primary');
    const sessionSecondaryBtn = document.getElementById('session-action-secondary');
    const sessionLogoutBtn = document.getElementById('session-action-logout');

    function safeShow(el) {
        if (el) el.style.display = 'block';
    }
    function safeHide(el) {
        if (el) el.style.display = 'none';
    }

    function clearRegisterClientState() {
        // Limpieza explícita para pruebas + comportamiento profesional (evita estados fantasma)
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('pendingVerificationPhone');
        localStorage.removeItem('pendingVerificationEmail');
        localStorage.removeItem('pending_verification_email');
    }

    function configureSessionBanner({ title, message, primaryText, onPrimary, secondaryText, onSecondary }) {
        if (!sessionBanner) return;

        sessionBannerTitle.textContent = title || 'Sesión detectada';
        sessionBannerMessage.textContent = message || '';

        sessionPrimaryBtn.textContent = primaryText || 'Continuar';
        sessionSecondaryBtn.textContent = secondaryText || 'Ir al perfil';

        // Reasignamos handlers sin acumular listeners
        sessionPrimaryBtn.onclick = typeof onPrimary === 'function' ? onPrimary : null;
        sessionSecondaryBtn.onclick = typeof onSecondary === 'function' ? onSecondary : () => { window.location.href = 'profile.html'; };
        sessionLogoutBtn.onclick = () => {
            clearRegisterClientState();
            // Recargamos para volver al paso 1 limpio
            window.location.reload();
        };

        safeShow(sessionBanner);
    }

    // --- LÓGICA MEJORADA Y ROBUSTA PARA MANEJAR ESTADO PENDIENTE ---
    const pendingPhone = localStorage.getItem('pendingVerificationPhone');
    const pendingEmail = localStorage.getItem('pendingVerificationEmail');

    async function validateAndSetInitialStep() {
        // Solo intentamos validar si tenemos AMBOS datos
        if (pendingPhone && pendingEmail) {
            // Encontramos datos en localStorage. No confiamos ciegamente, validamos con el backend.
            try {
                const response = await fetch(`${API_URL}/api/auth/pending-status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: pendingPhone, email: pendingEmail })
                });

                // Si el servidor devuelve 404 o 500, puede que no esté listo, pero no borramos
                // a menos que sea una respuesta explícita de "inválido".
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.isValid) {
                         console.log("Recuperando sesión de verificación pendiente...");
                        // El backend confirma que la verificación es válida. Mostramos el paso 2.
                        step1Div.style.display = 'none';
                        step2Div.style.display = 'block';
                        
                        // Restaurar valores en los inputs
                        const hiddenEmailInput = document.getElementById('hiddenEmail');
                        const emailInputVal = document.getElementById('email');
                        
                        if(hiddenEmailInput) hiddenEmailInput.value = pendingEmail;
                        if(emailInputVal) emailInputVal.value = pendingEmail;

                    } else {
                        // El backend dice explícitamente que NO es válido (ej. expiró).
                        console.log("Sesión pendiente expirada o inválida según backend.");
                        localStorage.removeItem('pendingVerificationPhone');
                        localStorage.removeItem('pendingVerificationEmail');
                        // Nos aseguramos que se vea el paso 1
                        step1Div.style.display = 'block';
                        step2Div.style.display = 'none';
                    }
                } else {
                     // Si hay error de servidor (no de lógica), mejor no borrar para que el usuario pueda reintentar F5
                     console.warn("Servidor retornó error al verificar estado pendiente:", response.status);
                }

            } catch (error) {
                console.error('Error de conexión al validar estado pendiente:', error);
                // Si no hay conexión, no borramos nada para que al volver pueda intentar.
            }
        }
    }

    // Llamamos a la validación, pero NO esperamos a que termine para seguir ejecutando el resto
    // Esto evita que la UI se congele si el backend tarda.
    validateAndSetInitialStep();

    // --- NUEVO: Comprobar el estado de autenticación al cargar la página ---
    const session = await window.checkAuthStatus();

    // --- Gate profesional: si hay sesión activa, NO mostramos el registro (evita confusión y cumple antifraude) ---
    if (session.isAuthenticated) {
        // Ocultamos ambos pasos por defecto; el usuario debe elegir (ir al perfil / continuar verificación / logout).
        safeHide(step1Div);
        safeHide(step2Div);

        const username = session.username || 'tu cuenta';

        if (!session.is_verified) {
            // Caso: sesión iniciada pero sin verificación completa
            configureSessionBanner({
                title: 'Verificación pendiente',
                message: `Tienes una sesión activa como "${username}" pero tu cuenta aún no está verificada. Para mantener seguridad y auditoría (estándar fintech), debes completar la verificación o cerrar sesión antes de crear otra cuenta.`,
                primaryText: 'Continuar verificación',
                onPrimary: () => {
                    // Mostramos el paso 2 (código) de manera explícita
                    safeHide(step1Div);
                    safeShow(step2Div);
                    // También mostramos un aviso (usando modal custom si está disponible)
                    showCustomAlert('Introduce el código de verificación que te enviamos para completar tu registro.');
                },
                secondaryText: 'Ir al perfil',
                onSecondary: () => { window.location.href = 'profile.html'; }
            });
        } else {
            // Caso: sesión completa y verificada (no se debe registrar otra cuenta sin logout)
            configureSessionBanner({
                title: 'Sesión activa',
                message: `Ya tienes una sesión iniciada como "${username}". Por estándar profesional, el registro se bloquea mientras exista una sesión activa. Puedes ir a tu perfil o cerrar sesión para registrar otra cuenta de prueba.`,
                primaryText: 'Ir al perfil',
                onPrimary: () => { window.location.href = 'profile.html'; },
                secondaryText: 'Volver al inicio',
                onSecondary: () => { window.location.href = 'index.html'; }
            });
        }

        // Salimos para evitar que se muestre el formulario de registro debajo.
        return;
    }


    // --- Lógica para el manejo de los acuerdos y el botón de registro ---
    const termsGeneralCheck = document.getElementById('terms-general');
    const termsPreLaunchCheck = document.getElementById('terms-pre-launch');
    const termsEconomicCheck = document.getElementById('terms-economic');
    const termsDebtCheck = document.getElementById('terms-debt');
    const termsRiskCheck = document.getElementById('terms-risk');
    const registerRequestBtn = document.getElementById('register-request-btn');
    
    // Nuevos elementos para validación de usuario, email y teléfono
    const usernameInput = document.getElementById('username');
    const usernameFeedback = document.getElementById('username-feedback');
    const emailInput = document.getElementById('email');
    const emailFeedback = document.getElementById('email-feedback');
    const phoneInput = document.getElementById('phone');
    const phoneFeedback = document.getElementById('phone-feedback');
    
    let isUsernameTaken = false;
    let isEmailTaken = false;
    let isPhoneTaken = false;

    // Comprobar si los elementos existen para evitar errores si no estamos en la página de registro
    if (termsGeneralCheck && termsPreLaunchCheck && termsEconomicCheck && termsDebtCheck && 
        termsRiskCheck && registerRequestBtn) {
        const allCheckboxes = [
            termsGeneralCheck, 
            termsPreLaunchCheck, 
            termsEconomicCheck, 
            termsDebtCheck,
            termsRiskCheck
        ];

        function checkAgreements() {
            const allChecked = allCheckboxes.every(checkbox => checkbox.checked);
            // El botón se deshabilita si no se aceptan los términos O si alguno de los campos únicos ya existe
            registerRequestBtn.disabled = !allChecked || isUsernameTaken || isEmailTaken || isPhoneTaken;
        }

        // Verificar estado inicial
        checkAgreements();

        allCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', checkAgreements);
        });
        
        // --- INTEGRACIÓN: Validación de usuario en tiempo real ---
        if (usernameInput && usernameFeedback) {
            usernameInput.addEventListener('blur', async () => {
                const username = usernameInput.value.trim();
                
                // Resetear estado visual
                usernameFeedback.style.display = 'none';
                usernameInput.style.borderColor = ''; 
                
                if (!username) return;

                // Validación básica
                if (username.length < 3) {
                    usernameFeedback.textContent = 'El usuario debe tener al menos 3 caracteres.';
                    usernameFeedback.style.color = '#dc3545';
                    usernameFeedback.style.display = 'block';
                    return;
                }

                try {
                    // Consultar al backend
                    const response = await fetch(`${API_URL}/api/check-username/${username}`);
                    if (!response.ok) throw new Error('Error de red');
                    
                    const data = await response.json();

                    if (!data.available) {
                        // Usuario NO disponible
                        usernameFeedback.textContent = data.message;
                        usernameFeedback.style.color = '#dc3545';
                        usernameFeedback.style.display = 'block';
                        usernameFeedback.style.fontWeight = 'bold';
                        usernameInput.style.borderColor = '#dc3545';
                        
                        isUsernameTaken = true;
                    } else {
                        // Usuario disponible
                        usernameFeedback.textContent = '¡Usuario disponible!';
                        usernameFeedback.style.color = '#28a745';
                        usernameFeedback.style.display = 'block';
                        usernameFeedback.style.fontWeight = 'bold';
                        usernameInput.style.borderColor = '#28a745';
                        
                        isUsernameTaken = false;
                    }
                    // Actualizar estado del botón
                    checkAgreements();

                } catch (error) {
                    console.error('Error verificando usuario:', error);
                }
            });

            // Limpiar error al escribir
            usernameInput.addEventListener('input', () => {
                if (isUsernameTaken) {
                    isUsernameTaken = false; 
                    usernameFeedback.style.display = 'none';
                    usernameInput.style.borderColor = '';
                    checkAgreements(); 
                }
            });
        }

        // --- INTEGRACIÓN: Validación de email en tiempo real ---
        if (emailInput && emailFeedback) {
            emailInput.addEventListener('blur', async () => {
                const email = emailInput.value.trim();
                
                emailFeedback.style.display = 'none';
                emailInput.style.borderColor = '';
                
                if (!email) return;

                // Validación formato básico frontend
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

        // --- INTEGRACIÓN: Validación de teléfono en tiempo real ---
        if (phoneInput && phoneFeedback) {
            phoneInput.addEventListener('blur', async () => {
                const phone = phoneInput.value.trim();
                
                phoneFeedback.style.display = 'none';
                phoneInput.style.borderColor = '';
                
                if (!phone) return;

                // Validación básica de longitud para teléfono (al menos 7 dígitos)
                if (phone.length < 7) {
                    phoneFeedback.textContent = 'El teléfono parece demasiado corto.';
                    phoneFeedback.style.color = '#dc3545';
                    phoneFeedback.style.display = 'block';
                    return;
                }

                try {
                    // IMPORTANTE: encodeURIComponent es vital aquí porque los teléfonos tienen '+'
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

    // --- Lógica para el modal de código de referido ---
    const referralModal = document.getElementById('referralCodeModal');
    const referralCloseButtons = document.querySelectorAll('.referral-close-button');
    const getReferralCodeBtn = document.getElementById('getReferralCodeBtn');
    let policyModalTimeout = null;

    const showReferralModal = () => {
        if (referralModal && sessionStorage.getItem('referralModalShown') !== 'true') {
            referralModal.style.display = 'flex';
            sessionStorage.setItem('referralModalShown', 'true');
        }
    };

    const closeReferralModal = () => {
        if (referralModal) {
            referralModal.style.display = 'none';
            // Después de cerrar el modal de código, esperar 10 segundos antes de mostrar el de política
            if (policyModalTimeout) {
                clearTimeout(policyModalTimeout);
            }
            policyModalTimeout = setTimeout(() => {
                showPolicyModal();
            }, 10000); // 10 segundos de delay
        }
    };

    // Botón "Conseguir Código" - abre www.wintoncoin.com en nueva pestaña y cierra el modal
    if (getReferralCodeBtn) {
        getReferralCodeBtn.addEventListener('click', () => {
            window.open('https://www.wintoncoin.com', '_blank', 'noopener,noreferrer');
            closeReferralModal();
        });
    }

    // Cerrar modal con botones de cerrar
    referralCloseButtons.forEach(button => button.addEventListener('click', closeReferralModal));
    
    // Cerrar modal al hacer clic fuera del contenido
    if (referralModal) {
        window.addEventListener('click', (event) => {
            if (event.target === referralModal) {
                closeReferralModal();
            }
        });
    }

    // Cerrar modal con tecla ESC
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && referralModal && referralModal.style.display === 'flex') {
            closeReferralModal();
        }
    });

    // --- Lógica para el modal de advertencia de cuenta única ---
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
            // Cancelar el timeout si existe (por si el usuario cierra el modal antes de que aparezca)
            if (policyModalTimeout) {
                clearTimeout(policyModalTimeout);
                policyModalTimeout = null;
            }
        }
    };

    policyCloseButtons.forEach(button => button.addEventListener('click', closePolicyModal));
    window.addEventListener('click', (event) => {
        if (event.target === policyModal) closePolicyModal();
    });

    // --- Lógica para decidir qué modal mostrar al cargar la página ---
    // Verificar si hay código de referido en la URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCodeFromUrl = urlParams.get('ref');

    // Auto-rellenar el campo de código de referido si viene en la URL
    const referralCodeInput = document.getElementById('referral_code');
    if (refCodeFromUrl && referralCodeInput) {
        referralCodeInput.value = refCodeFromUrl.trim().toUpperCase();
    }

    // Si NO hay código en la URL, mostrar el modal de código de referido
    // Si SÍ hay código, mostrar solo el modal de política
    if (!refCodeFromUrl) {
        // No hay código → verificar si ya vio el modal de código
        const referralModalShown = sessionStorage.getItem('referralModalShown') === 'true';
        const policyModalShown = sessionStorage.getItem('policyModalShown') === 'true';
        
        if (!referralModalShown) {
            // No ha visto el modal de código → mostrarlo primero
            showReferralModal();
        } else if (!policyModalShown) {
            // Ya vio el modal de código pero no el de política → mostrar política inmediatamente
            showPolicyModal();
        }
        // Si ya vio ambos modales, no mostrar nada
    } else {
        // Hay código → mostrar solo modal de política (sin delay)
        showPolicyModal();
    }

    // --- Lógica para mostrar/ocultar campos de menor según fecha de nacimiento ---
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

            // Mostrar campos informativos si es menor de 18 años
            if (age >= 13 && age < 18) {
                minorFieldsDiv.style.display = 'block';
            } else {
                minorFieldsDiv.style.display = 'none';
            }
        }

        dateOfBirthInput.addEventListener('change', checkAgeAndShowMinorFields);
    }

    // --- Lógica para deshabilitar si los registros están cerrados ---
    document.addEventListener('app-settings-loaded', () => {
        if (!window.appSettings.allow_new_registrations) {
            container.innerHTML = `
                <h1>Registro Cerrado</h1>
                <p>En este momento no se aceptan nuevos registros. Por favor, inténtalo de nuevo más tarde.</p>
                <p><a href="index.html">Volver a inicio de sesión</a></p>
            `;
        }
    });

    // --- PASO 1: Manejar el envío del formulario de registro inicial ---
    if (registerForm) {
        registerForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const dateOfBirth = document.getElementById('date_of_birth').value;

            if (password !== confirmPassword) {
                showCustomAlert('Las contraseñas no coinciden. Por favor, inténtalo de nuevo.');
                return;
            }

            // Validar fecha de nacimiento
            if (!dateOfBirth) {
                showCustomAlert('Por favor, proporciona tu fecha de nacimiento.');
                return;
            }

            // Calcular edad
            const birthDate = new Date(dateOfBirth);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }

            // Validar edad mínima
            if (age < 13) {
                showCustomAlert('Debes tener al menos 13 años para registrarte en WintonCoin. Los menores de 13 años no pueden utilizar la plataforma.');
                return;
            }

            const registerUrl = `${API_URL}/api/register-request`;

            try {
                const response = await fetch(registerUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, email, phone, date_of_birth: dateOfBirth })
                });

                const result = await response.json();

                if (response.ok) {
                    // LÓGICA PROFESIONAL CORRECTA PARA EL PASO 1:
                    // Simplemente mostramos el mensaje y cambiamos la vista al paso 2.
                    showCustomAlert(result.message);
                    
                    // Guardamos el email en un campo oculto para usarlo en el paso 2 (OTP por correo)
                    const hiddenEmailInput = document.getElementById('hiddenEmail');
                    if (hiddenEmailInput) hiddenEmailInput.value = email;

                    // --- NUEVO: Guardamos el estado en localStorage para persistir la recarga ---
                    localStorage.setItem('pendingVerificationPhone', phone);
                    localStorage.setItem('pendingVerificationEmail', email);

                    // Ocultamos el paso 1 y mostramos el paso 2
                    step1Div.style.display = 'none';
                    step2Div.style.display = 'block';
                    
                    // Iniciar temporizador de reenvío (no dependemos de hacks sobre fetch)
                    startResendTimer();

                } else {
                    showCustomAlert(`Error: ${result.message}`);
                }
            } catch (error) {
                console.error('Error de red o al conectar con el servidor:', error);
                showCustomAlert('No se pudo conectar con el servidor. Asegúrate de que está en funcionamiento.');
            }
        });
    }

    // --- PASO 2: Manejar el envío del formulario de verificación ---
    if (verifyForm) {
        verifyForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const verificationCode = document.getElementById('verificationCode').value;
            const email = (document.getElementById('hiddenEmail')?.value || document.getElementById('email')?.value || '').trim();
            const referral_code = document.getElementById('referral_code').value; // Lo obtenemos del primer formulario

            const verifyUrl = `${API_URL}/api/register-verify`;

            try {
                const response = await fetch(verifyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, verificationCode, referral_code })
                });

                const result = await response.json();

                if (response.ok) {
                    // LÓGICA PROFESIONAL CORRECTA PARA EL PASO 2:
                    // Al verificar, guardamos la sesión y redirigimos.
                    showCustomAlert(result.message + ' Has iniciado sesión correctamente.');
                    localStorage.setItem('token', result.token);
                    localStorage.setItem('username', result.username);

                    // --- NUEVO: Limpiamos el estado de localStorage al completar el registro ---
                    localStorage.removeItem('pendingVerificationPhone');
                    localStorage.removeItem('pendingVerificationEmail');
                    localStorage.removeItem('pending_verification_email');
                    
                    window.location.href = 'contract_interaction.html';
                } else {
                    showCustomAlert(`Error: ${result.message}`);
                }
            } catch (error) {
                console.error('Error de red o al conectar con el servidor:', error);
                showCustomAlert('No se pudo conectar con el servidor.');
            }
        });
    }

    // --- NUEVO: Lógica para el reenvío de código de verificación ---
    const resendBtn = document.getElementById('resend-code-btn');
    const resendTimerSpan = document.getElementById('resend-timer');
    let countdown;
    let timer = 60;

    function startResendTimer() {
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

    // Iniciar el temporizador si el paso 2 es visible al cargar la página
    if (step2Div.style.display === 'block') {
        startResendTimer();
    }


    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            // Para reenviar, necesitamos el email que el usuario introdujo en el paso 1.
            const email = document.getElementById('email').value || localStorage.getItem('pendingVerificationEmail');
            
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
                    startResendTimer(); // Reiniciar el temporizador
                } else {
                    showCustomAlert(`Error: ${result.message}`);
                }
            } catch (error) {
                console.error('Error de red al reenviar el código:', error);
                showCustomAlert('No se pudo conectar con el servidor para reenviar el código.');
            }
        });
    }
});
