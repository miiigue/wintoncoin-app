document.addEventListener('DOMContentLoaded', function() {
    // Lógica para determinar la URL del API automáticamente
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';
    
    // Referencias a los elementos del DOM
    const registerForm = document.getElementById('registerForm');
    const verifyForm = document.getElementById('verifyForm');
    const step1Div = document.getElementById('registration-step-1');
    const step2Div = document.getElementById('verification-step-2');
    const container = document.querySelector('.container');

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
                    showCustomAlert(result.message);
                    // Transición al paso 2
                    document.getElementById('hiddenPhone').value = phone;
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
                    showCustomAlert(result.message + ' Serás redirigido para iniciar sesión.', () => {
                        window.location.href = 'index.html';
                    });
                } else {
                    showCustomAlert(`Error: ${result.message}`);
                }
            } catch (error) {
                console.error('Error de red o al conectar con el servidor:', error);
                showCustomAlert('No se pudo conectar con el servidor.');
            }
        });
    }
}); 