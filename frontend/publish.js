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

    const publishForm = document.getElementById('publishForm');
    const blueCostInput = document.getElementById('blueCost');
    const blueSellInput = document.getElementById('blueSell');

    // Lógica para deshabilitar un campo si el otro tiene valor
    blueCostInput.addEventListener('input', () => {
        if (blueCostInput.value) {
            blueSellInput.disabled = true;
            blueSellInput.value = ''; // Limpiar para evitar enviar ambos valores
        } else {
            blueSellInput.disabled = false;
        }
    });

    blueSellInput.addEventListener('input', () => {
        if (blueSellInput.value) {
            blueCostInput.disabled = true;
            blueCostInput.value = ''; // Limpiar para evitar enviar ambos valores
        } else {
            blueCostInput.disabled = false;
        }
    });

    publishForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;
        const blueCost = blueCostInput.value;
        const blueSell = blueSellInput.value;

        // Validar que al menos uno de los dos campos de coste/venta tenga valor
        if (!blueCost && !blueSell) {
            showCustomAlert('Debes especificar una cantidad de BLUE a pagar o a vender.');
            return;
        }
        
        const publishData = {
            title,
            description,
            authorUsername // Enviamos el nombre del autor
        };

        // Determinamos si es una venta o una publicación normal
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