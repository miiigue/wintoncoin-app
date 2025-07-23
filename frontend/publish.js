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
    const preLaunchNoticeContainer = document.getElementById('prelaunch-notice-container'); // NUEVO

    // --- Redirección y Seguridad ---
    if (!storedUsername) {
        showCustomAlert('Debes iniciar sesión para publicar.', () => { window.location.href = 'index.html'; });
        return;
    }

    // --- NUEVO: Lógica para mostrar avisos condicionales ---
    async function displayNotices() {
        try {
            const response = await fetch(`${API_URL}/api/platform-settings`);
            if (!response.ok) return;
            const settings = await response.json();

            // Aviso de Pre-Lanzamiento
            if (preLaunchNoticeContainer && settings.pre_launch_mode_enabled) {
                preLaunchNoticeContainer.innerHTML = `
                    <div class="prelaunch-notice">
                        <h4>🚀 MODO PRE-LANZAMIENTO ACTIVO</h4>
                        <p>¡Gracias por ser de los primeros! Las recompensas de esta tarea se acumularán en tu <strong>Perfil de Impulsor</strong>. Durante esta fase, no se generará deuda RED.</p>
                    </div>
                `;
                preLaunchNoticeContainer.style.display = 'block';
            }

            // Aviso de Comisión (solo si el modo pre-lanzamiento está desactivado)
            if (noticeContainer && !settings.pre_launch_mode_enabled) {
                const commissionResponse = await fetch(`${API_URL}/api/settings`);
                if (!commissionResponse.ok) return;
                const generalSettings = await commissionResponse.json();
                const commissionPercentage = generalSettings.platform_commission_percentage || 0;

                if (commissionPercentage > 0) {
                    noticeContainer.innerHTML = `
                        <div class="commission-notice">
                            <p>Nota: Al completarse, esta transacción generará una comisión del <strong>${commissionPercentage}%</strong> para la plataforma. La comisión se añade a la deuda RED del usuario que se beneficia del servicio/producto.</p>
                        </div>
                    `;
                }
            }

        } catch (error) {
            console.error("Error al cargar la configuración de la plataforma:", error);
        }
    }

    // --- Lógica de Inicialización del Formulario ---
    displayNotices(); // Llamar a la nueva función
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