document.addEventListener('DOMContentLoaded', () => {
    // Primero, verificamos si el usuario ha iniciado sesión.
    const authorUsername = sessionStorage.getItem('username');
    if (!authorUsername) {
        showCustomAlert('Debes iniciar sesión para poder publicar.', () => {
            window.location.href = 'index.html';
        });
        return;
    }

    const publishForm = document.getElementById('publishForm');
    publishForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;
        const blueCost = document.getElementById('blueCost').value;
        
        // Lógica para determinar la URL del API automáticamente
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';
        const publishUrl = `${API_URL}/publish`;

        try {
            const response = await fetch(publishUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    description,
                    blueCost,
                    authorUsername // Enviamos el nombre del autor
                })
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