document.addEventListener('DOMContentLoaded', async function() {
    // Lógica para determinar la URL del API automáticamente
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';
    
    // Referencias a los elementos del DOM
    const registerForm = document.getElementById('registerForm');
    const verifyForm = document.getElementById('verifyForm');
    const step1Div = document.getElementById('registration-step-1');
    const step2Div = document.getElementById('verification-step-2');
    const container = document.querySelector('.container');

    // --- NUEVO: Lógica para recordar el estado de verificación pendiente ---
    const pendingPhone = localStorage.getItem('pendingVerificationPhone');
    if (pendingPhone) {
        // Si encontramos un teléfono en localStorage, significa que hay una verificación pendiente.
        // Saltamos directamente al paso 2.
        step1Div.style.display = 'none';
        step2Div.style.display = 'block';
        document.getElementById('hiddenPhone').value = pendingPhone;
        // También intentamos restaurar el email para la función de reenviar código
        const pendingEmail = localStorage.getItem('pendingVerificationEmail');
        if (pendingEmail) {
            document.getElementById('email').value = pendingEmail;
        }
    }

    // --- NUEVO: Comprobar el estado de autenticación al cargar la página ---
    const session = await window.checkAuthStatus();

    // Si el usuario está logueado pero no verificado, saltar directamente al paso 2
    if (session.isAuthenticated && !session.is_verified) {
        showCustomAlert('Hemos detectado que tienes una verificación pendiente. Por favor, introduce el código que te enviamos.');
        
        // Ocultamos el paso 1 y mostramos el paso 2
        step1Div.style.display = 'none';
        step2Div.style.display = 'block';

        // Guardamos el email para la función de reenviar código
        // Asumimos que el email está en el token, lo cual necesita ser añadido en el backend
        // Por ahora, lo guardamos si lo tenemos. El username ya lo devuelve el status.
        // Una mejora futura sería que /api/auth/status devuelva también el email.
        localStorage.setItem('pending_verification_email', session.email || ''); // Ajustar si el backend no devuelve email

    } else if (session.isAuthenticated && session.is_verified) {
        // Si ya está verificado y logueado, lo redirigimos al perfil.
        window.location.href = 'profile.html';
        return; // Detenemos la ejecución para evitar que se muestre el formulario.
    }


    // --- Lógica para el manejo de los acuerdos y el botón de registro ---
    const termsGeneralCheck = document.getElementById('terms-general');
    const termsEconomicCheck = document.getElementById('terms-economic');
    const termsPublicDebtCheck = document.getElementById('terms-public-debt');
    const registerRequestBtn = document.getElementById('register-request-btn');

    // Comprobar si los elementos existen para evitar errores si no estamos en la página de registro
    if (termsGeneralCheck && termsEconomicCheck && termsPublicDebtCheck && registerRequestBtn) {
        const allCheckboxes = [termsGeneralCheck, termsEconomicCheck, termsPublicDebtCheck];

        function checkAgreements() {
            const allChecked = allCheckboxes.every(checkbox => checkbox.checked);
            registerRequestBtn.disabled = !allChecked;
        }

        allCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', checkAgreements);
        });
    }

    // --- Lógica para el modal de advertencia de cuenta única ---
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

    showPolicyModal();
    closeButtons.forEach(button => button.addEventListener('click', closePolicyModal));
    window.addEventListener('click', (event) => {
        if (event.target === policyModal) closePolicyModal();
    });

    // --- Lógica para auto-rellenar el código de referido desde la URL ---
    const referralCodeInput = document.getElementById('referral_code');
    const urlParams = new URLSearchParams(window.location.search);
    const refCodeFromUrl = urlParams.get('ref');

    if (refCodeFromUrl && referralCodeInput) {
        referralCodeInput.value = refCodeFromUrl.trim().toUpperCase();
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

            if (password !== confirmPassword) {
                showCustomAlert('Las contraseñas no coinciden. Por favor, inténtalo de nuevo.');
                return;
            }

            const registerUrl = `${API_URL}/api/register-request`;

            try {
                const response = await fetch(registerUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, email, phone })
                });

                const result = await response.json();

                if (response.ok) {
                    // LÓGICA PROFESIONAL CORRECTA PARA EL PASO 1:
                    // Simplemente mostramos el mensaje y cambiamos la vista al paso 2.
                    showCustomAlert(result.message);
                    
                    // Guardamos el teléfono en un campo oculto para usarlo en el paso 2
                    document.getElementById('hiddenPhone').value = phone;

                    // --- NUEVO: Guardamos el estado en localStorage para persistir la recarga ---
                    localStorage.setItem('pendingVerificationPhone', phone);
                    localStorage.setItem('pendingVerificationEmail', email);

                    // Ocultamos el paso 1 y mostramos el paso 2
                    step1Div.style.display = 'none';
                    step2Div.style.display = 'block';

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
            const phone = document.getElementById('hiddenPhone').value;
            const referral_code = document.getElementById('referral_code').value; // Lo obtenemos del primer formulario

            const verifyUrl = `${API_URL}/api/register-verify`;

            try {
                const response = await fetch(verifyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone, verificationCode, referral_code })
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
    
    // Iniciar el temporizador cuando se pasa del paso 1 al 2
    registerForm.addEventListener('submit', async function(event) {
        // ... (código existente del submit)
        // Buscamos si la transición al paso 2 fue exitosa antes de iniciar
        const originalFetch = fetch;
        fetch = async (...args) => {
            const response = await originalFetch(...args);
            if (args[0] === `${API_URL}/api/register-request` && response.ok) {
                startResendTimer();
            }
            return response;
        };
    });


    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            // Para reenviar, necesitamos el email que el usuario introdujo en el paso 1.
            const email = document.getElementById('email').value || localStorage.getItem('pending_verification_email');
            
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