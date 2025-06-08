document.addEventListener('DOMContentLoaded', () => {
    // Primero, verificamos si el usuario ha iniciado sesión.
    const authorUsername = sessionStorage.getItem('username');
    if (!authorUsername) {
        alert('Debes iniciar sesión para poder publicar.');
        window.location.href = 'index.html';
        return;
    }

    const publishForm = document.getElementById('publishForm');
    publishForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;
        const blueCost = document.getElementById('blueCost').value;
        
        const publishUrl = 'https://wintoncoin-backend.onrender.com/publish';

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
                alert(result.message);
                window.location.href = 'contract_interaction.html'; // Volver al panel para ver la publicación
            } else {
                alert(`Error: ${result.message}`);
            }

        } catch (error) {
            console.error('Error de red al publicar:', error);
            alert('No se pudo conectar con el servidor para publicar.');
        }
    });
}); 