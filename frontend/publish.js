document.addEventListener('DOMContentLoaded', () => {
    // Lógica para determinar la URL del API automáticamente
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';

    // Primero, verificamos si el usuario ha iniciado sesión.
    const authorUsername = sessionStorage.getItem('username');
    if (!authorUsername) {
        showCustomAlert('Debes iniciar sesión para poder publicar.', () => {
            window.location.href = 'index.html';
        });
        return;
    }

    // --- Elementos del DOM ---
    const publishForm = document.getElementById('publishForm');
    const titleElement = document.querySelector('h1');
    const subtitleElement = document.querySelector('h2');
    const costWrapper = document.getElementById('cost-wrapper');
    const sellWrapper = document.getElementById('sell-wrapper');
    const blueCostInput = document.getElementById('blueCost');
    const blueSellInput = document.getElementById('blueSell');

    // --- Lógica de Formulario Dinámico ---
    const urlParams = new URLSearchParams(window.location.search);
    const publicationType = urlParams.get('type');

    if (publicationType === 'request') {
        // Configuración para "Solicitar Ayudante"
        titleElement.textContent = 'Solicitar un Ayudante/Pagar BLUE';
        subtitleElement.textContent = 'Describe la tarea y el precio en BLUE que ofreces.';
        
        costWrapper.style.display = 'block';
        costWrapper.querySelector('label').textContent = 'Recompensa (en BLUE):';
        blueCostInput.required = true;

        sellWrapper.style.display = 'none';
        blueSellInput.required = false;

    } else if (publicationType === 'sell') {
        // Configuración para "Ofrecer Venta/Servicio"
        titleElement.textContent = 'Ofrecer un Servicio o Venta';
        subtitleElement.textContent = 'Describe tu producto o servicio y establece el precio.';
        
        sellWrapper.style.display = 'block';
        sellWrapper.querySelector('label').textContent = 'Precio de Venta (en BLUE):';
        blueSellInput.required = true;
        
        costWrapper.style.display = 'none';
        blueCostInput.required = false;

    } else {
        // Redireccionar si no hay un tipo válido o se accede directamente
        showCustomAlert("Acción no especificada. Por favor, elige una opción desde el panel principal.", () => {
            window.location.href = 'contract_interaction.html';
        });
        return;
    }

    // --- Evento de Envío del Formulario ---
    publishForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;
        const blueCost = blueCostInput.value;
        const blueSell = blueSellInput.value;

        // La validación 'required' en el input se encarga de que uno de los dos campos tenga valor.
        // Este chequeo es una seguridad adicional.
        if (!blueCost && !blueSell) {
            showCustomAlert('Debes especificar un valor para la recompensa o el precio.');
            return;
        }
        
        const publishData = {
            title,
            description,
            authorUsername
        };

        // Determinamos si es una venta o una publicación normal basado en el campo que tiene valor
        if (blueSell) {
            publishData.blueSell = blueSell;
        } else {
            publishData.blueCost = blueCost;
        }

        const publishUrl = `${API_URL}/publish`;

        try {
            const response = await fetch(publishUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(publishData)
            });

            const result = await response.json();

            if (response.ok) {
                showCustomAlert(result.message, () => {
                    window.location.href = 'contract_interaction.html'; // Volver al panel para ver la publicación
                });
            } else {
                showCustomAlert(`Error: ${result.message}`);
            }

        } catch (error) {
            console.error('Error de red al publicar:', error);
            showCustomAlert('No se pudo conectar con el servidor para publicar.');
        }
    });
}); 