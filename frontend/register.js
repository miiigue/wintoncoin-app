document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('registerForm');

    if (registerForm) {
        registerForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            // 1. Verificar que las contraseñas coincidan
            if (password !== confirmPassword) {
                showCustomAlert('Las contraseñas no coinciden. Inténtalo de nuevo.');
                return; // Detiene la ejecución si no coinciden
            }

            // Dirección del endpoint de registro en nuestro backend
            const registerUrl = 'https://wintoncoin-backend.onrender.com/register';

            try {
                // 2. Hacer la petición 'fetch' al backend
                const response = await fetch(registerUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

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