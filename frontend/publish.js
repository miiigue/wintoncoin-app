document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica de API y Estado ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';
    const storedUsername = sessionStorage.getItem('username');

    // --- Elementos del DOM ---
    const publishForm = document.getElementById('publishForm');
    const costWrapper = document.getElementById('cost-wrapper');
    const sellWrapper = document.getElementById('sell-wrapper');
    const noticeContainer = document.getElementById('commission-notice-container');

    // --- Redirección y Seguridad ---
    if (!storedUsername) {
        showCustomAlert('Debes iniciar sesión para publicar.', () => { window.location.href = 'index.html'; });
        return;
    }

    // --- Lógica de Inicialización del Formulario ---
    // Determinar el tipo de publicación desde la URL (ej: ?type=request)
    const urlParams = new URLSearchParams(window.location.search);
    const publicationType = urlParams.get('type');

    if (publicationType === 'request') {
        costWrapper.style.display = 'block';
        sellWrapper.style.display = 'none';
    } else if (publicationType === 'sell' || publicationType === 'donation') {
        costWrapper.style.display = 'none';
        sellWrapper.style.display = 'block';
        // Cambiamos el texto del label si es una donación
        if (publicationType === 'donation') {
            const sellLabel = document.querySelector('#sell-wrapper label');
            if (sellLabel) {
                sellLabel.textContent = 'Monto Sugerido (en BLUE):';
            }
        }
    } else {
        showCustomAlert('Tipo de publicación no válido.', () => { window.location.href = 'contract_interaction.html'; });
        return;
    }

    // --- Lógica para Mostrar la Nota de Comisión ---
    // Escuchamos el evento personalizado que utils.js dispara cuando carga la configuración.
    document.addEventListener('app-settings-loaded', () => {
        const commissionPercentage = window.appSettings?.platform_commission_percentage || 0;

        if (noticeContainer && commissionPercentage > 0) {
            noticeContainer.innerHTML = `
                <div class="commission-notice">
                    <p>Nota: Al completarse, esta transacción generará una comisión del <strong>${commissionPercentage}%</strong> para la plataforma. La comisión se añade a la deuda RED del usuario que se beneficia del servicio/producto.</p>
                </div>
            `;
        }
    });

    // --- Lógica de Envío del Formulario ---
    publishForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Recolectar datos del formulario
        const formData = new FormData(publishForm);
        const data = Object.fromEntries(formData.entries());
        data.authorUsername = storedUsername;
        data.publicationType = publicationType; // Añadimos el tipo para que el backend sepa qué es

        // El valor de un checkbox no marcado no se envía, así que lo manejamos explícitamente.
        data.autoApprove = document.getElementById('autoApprove').checked;

        try {
            const response = await fetch(`${API_URL}/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                showCustomAlert(result.message || '¡Publicación creada con éxito!', () => {
                    window.location.href = 'contract_interaction.html';
                });
            } else {
                showCustomAlert(result.message || 'Ocurrió un error al crear la publicación.');
            }

        } catch (error) {
            console.error('Error de red al publicar:', error);
            showCustomAlert('No se pudo conectar con el servidor. Inténtalo de nuevo.');
        }
    });
}); 