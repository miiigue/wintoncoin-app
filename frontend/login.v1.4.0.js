// Espera a que todo el contenido del HTML esté cargado antes de ejecutar el script
document.addEventListener('DOMContentLoaded', function() {
    // Lógica para determinar la URL del API automáticamente
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';

    // --- NUEVO: Lógica para el modal de advertencia de cuenta única ---
    const policyModal = document.getElementById('oneAccountPolicyModal');
    const closeButtons = document.querySelectorAll('.policy-close-button');

    // Función para mostrar el modal
    const showPolicyModal = () => {
        if (policyModal && sessionStorage.getItem('policyModalShown') !== 'true') {
            policyModal.style.display = 'flex'; // Usamos flex para centrarlo
            sessionStorage.setItem('policyModalShown', 'true');
        }
    };

    // Función para cerrar el modal
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
    // --- Fin de la nueva lógica ---

    // Obtener el formulario de login por su ID
    const loginForm = document.getElementById('loginForm');

    // Verificar si el formulario existe en la página
    if (loginForm) {
        // Añadir un 'escuchador de eventos' para cuando se intente enviar el formulario
        loginForm.addEventListener('submit', async function(event) {
            // Prevenir el comportamiento por defecto del formulario (que es recargar la página)
            event.preventDefault();

            // Obtener los valores ingresados por el usuario
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            const loginUrl = `${API_URL}/login`;

            try {
                // Usamos 'fetch' para hacer la petición de red al backend
                const response = await fetch(loginUrl, {
                    method: 'POST', // Usamos el método POST
                    headers: {
                        'Content-Type': 'application/json' // Le decimos al servidor que estamos enviando JSON
                    },
                    body: JSON.stringify({ username, password }) // Convertimos nuestros datos a un string JSON
                });

                // 'response.ok' es true si el código de estado es 2xx (ej. 200 OK)
                if (response.ok) {
                    const result = await response.json();
                    
                    // PASO 2: Guardar la credencial (token) en la memoria compartida del navegador.
                    if (result.token && result.username) {
                        localStorage.setItem('token', result.token);
                        localStorage.setItem('username', result.username);
                        
                        // Redirigimos al usuario a la página principal de la aplicación
                        window.location.href = 'contract_interaction.html';
                    } else {
                        showCustomAlert('Error: La respuesta del servidor no incluyó un token de sesión.');
                    }

                } else {
                    // Si hay un error (ej. 401 credenciales inválidas)
                    const errorResult = await response.json();
                    showCustomAlert(`Error: ${errorResult.message}`);
                    document.getElementById('password').value = ''; // Limpiar campo de contraseña
                }
            } catch (error) {
                // Este bloque se ejecuta si hay un problema de red (ej. el servidor no está corriendo)
                console.error('Error de red o al conectar con el servidor:', error);
                showCustomAlert('No se pudo conectar con el servidor. Asegúrate de que está en funcionamiento.');
            }
        });
    } else {
        console.error('El formulario con id "loginForm" no fue encontrado.');
    }
});
