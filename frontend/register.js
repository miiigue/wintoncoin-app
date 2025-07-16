document.addEventListener('DOMContentLoaded', function() {
    // Lógica para determinar la URL del API automáticamente
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';
    
    const registerForm = document.getElementById('registerForm');
    const container = document.querySelector('.container');

    // --- NUEVO: Lógica para auto-rellenar el código de referido desde la URL ---
    const referralCodeInput = document.getElementById('referral_code');
    const urlParams = new URLSearchParams(window.location.search);
    const refCodeFromUrl = urlParams.get('ref');

    if (refCodeFromUrl && referralCodeInput) {
        // Ponemos el código en mayúsculas y limpiamos espacios para consistencia
        referralCodeInput.value = refCodeFromUrl.trim().toUpperCase();
    }
    // --- Fin de la nueva lógica ---

    // Escuchamos el evento personalizado que disparamos desde utils.js
    document.addEventListener('app-settings-loaded', () => {
        if (!window.appSettings.allow_new_registrations) {
            // Deshabilitar completamente la funcionalidad si los registros están cerrados
            container.innerHTML = `
                <h1>Registro Cerrado</h1>
                <p>En este momento no se aceptan nuevos registros. Por favor, inténtalo de nuevo más tarde.</p>
                <p><a href="index.html">Volver a inicio de sesión</a></p>
            `;
        }
    });

    if (registerForm) {
        registerForm.addEventListener('submit', async function(event) {
            // Prevenir el comportamiento por defecto del formulario
            event.preventDefault();

            // Obtener los valores ingresados por el usuario
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const referral_code = document.getElementById('referral_code').value;

            // Comprobación de seguridad: las contraseñas deben coincidir
            if (password !== confirmPassword) {
                showCustomAlert('Las contraseñas no coinciden. Por favor, inténtalo de nuevo.');
                return; // Detiene el envío del formulario si no coinciden
            }

            // La URL a la que enviaremos la petición de registro
            const registerUrl = `${API_URL}/register`;

            try {
                // Hacemos la petición 'fetch' al backend
                const response = await fetch(registerUrl, {
                    method: 'POST', // Usamos el método POST
                    headers: {
                        'Content-Type': 'application/json' // Le decimos al servidor que enviamos JSON
                    },
                    // Convertimos todos los datos a un string JSON
                    body: JSON.stringify({ username, password, email, phone, referral_code })
                });

                // Convertimos la respuesta del servidor a un objeto JSON
                const result = await response.json();

                if (response.ok) { // Éxito (ej. código 201 Created)
                    // Pasamos la redirección como callback
                    showCustomAlert(result.message + ' Ahora puedes iniciar sesión.', () => {
                        window.location.href = 'index.html'; // 4. Redirigir a la página de login
                    });
                } else { // Error (ej. 409 Conflict - usuario ya existe)
                    showCustomAlert(`Error: ${result.message}`);
                }
            } catch (error) {
                console.error('Error de red o al conectar con el servidor:', error);
                showCustomAlert('No se pudo conectar con el servidor. Asegúrate de que está en funcionamiento.');
            }
        });
    } else {
        console.error('El formulario con id "registerForm" no fue encontrado.');
    }
}); 