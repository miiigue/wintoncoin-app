// Espera a que todo el contenido del HTML esté cargado antes de ejecutar el script
document.addEventListener('DOMContentLoaded', function() {
    // Lógica para determinar la URL del API automáticamente
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';

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
                    // Si el inicio de sesión es exitoso, el backend ahora devuelve más datos
                    const result = await response.json();
                    
                    // Guardamos los datos del usuario en sessionStorage para usarlos en otras páginas
                    sessionStorage.setItem('username', result.username);
                    sessionStorage.setItem('blue_balance', result.blue_balance);
                    sessionStorage.setItem('red_balance', result.red_balance);

                    // Redirigimos al usuario a la página principal de la aplicación
                    window.location.href = 'contract_interaction.html';
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