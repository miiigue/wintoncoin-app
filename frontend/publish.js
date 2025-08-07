document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica de API y Estado ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';
    const storedUsername = localStorage.getItem('username');

    // --- Elementos del DOM ---
    const publishForm = document.getElementById('publishForm');
    const costWrapper = document.getElementById('cost-wrapper');
    const sellWrapper = document.getElementById('sell-wrapper');
    const noticeContainer = document.getElementById('commission-notice-container');
    const preLaunchNoticeContainer = document.getElementById('prelaunch-notice-container');
    const setExpirationCheckbox = document.getElementById('setExpiration');
    const expirationInputsContainer = document.getElementById('expiration-inputs');

    // --- Elementos del formulario que cambiaremos ---
    const pageTitle = document.querySelector('.container h1');
    const titleLabel = document.querySelector('label[for="title"]');
    const titleInput = document.getElementById('title');
    const titleHint = document.querySelector('label[for="title"] + input + small');
    const descriptionLabel = document.querySelector('label[for="description"]');
    const descriptionInput = document.getElementById('description');
    const descriptionHint = document.querySelector('label[for="description"] + textarea + small');
    const submitButton = document.querySelector('#publishForm button[type="submit"]');

    // --- Redirección y Seguridad ---
    if (!storedUsername) {
        showCustomAlert('Debes iniciar sesión para publicar.', () => { window.location.href = 'index.html'; });
        return;
    }

    // --- Lógica para el colapsable de la vigencia ---
    expirationInputsContainer.style.display = 'none'; // Oculto por defecto con JS por si el CSS no carga
    setExpirationCheckbox.checked = false;

    setExpirationCheckbox.addEventListener('change', () => {
        const isChecked = setExpirationCheckbox.checked;
        if (isChecked) {
            expirationInputsContainer.style.display = 'block';
            // Para la animación de CSS
            setTimeout(() => {
                expirationInputsContainer.classList.add('expanded');
            }, 10);
        } else {
            expirationInputsContainer.classList.remove('expanded');
            // Esperar a que la animación termine para ocultarlo
            setTimeout(() => {
                expirationInputsContainer.style.display = 'none';
            }, 300); // 300ms es la duración de la transición en el CSS
        }
    });


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
        // No se necesitan cambios de texto para 'request', usa los valores por defecto.
    } else if (publicationType === 'sell') {
        costWrapper.style.display = 'none';
        sellWrapper.style.display = 'block';
        // Lógica específica para Venta
        pageTitle.textContent = 'Poner un Artículo o Servicio a la Venta';
        titleLabel.textContent = 'Nombre del Artículo/Servicio:';
        titleInput.placeholder = 'Ej: Diseño de logo profesional';
        titleHint.textContent = 'Un nombre claro y conciso para lo que ofreces.';
        descriptionLabel.textContent = 'Descripción del Artículo/Servicio:';
        descriptionInput.placeholder = 'Ej: Ofrezco mis servicios para crear un logo vectorial de alta calidad. Incluye 3 revisiones...';
        descriptionHint.textContent = 'Detalla qué incluye, tus habilidades, tiempos de entrega, etc.';
        submitButton.textContent = 'Poner a la Venta';

    } else if (publicationType === 'donation') {
        costWrapper.style.display = 'none';
        sellWrapper.style.display = 'block';
        // Lógica específica para Donación
        pageTitle.textContent = 'Crear una Campaña de Donación';
        titleLabel.textContent = 'Título de tu Causa o Campaña:';
        titleInput.placeholder = 'Ej: Ayuda para medicinas, paraalimentos de nuestro refugio, ';
        titleHint.textContent = 'Un título inspirador que resuma tu necesidad.';
        descriptionLabel.textContent = 'Describe tu Causa:';
        descriptionInput.placeholder = 'Ej: Somos un refugio de animales que necesita fondos para comprar 100kg de alimento este mes...';
        descriptionHint.textContent = 'Explica por qué necesitas apoyo, para qué se usarán los fondos y cualquier detalle que genere confianza.';
        
        const sellLabel = document.querySelector('#sell-wrapper label');
        if (sellLabel) {
            sellLabel.textContent = 'Meta de Recaudación (en BLUE):';
        }
        submitButton.textContent = 'Crear Campaña';

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

        // Añadimos la lógica de la fecha de expiración
        if (setExpirationCheckbox.checked) {
            data.duration_days = document.getElementById('durationDays').value || 0;
            data.duration_hours = document.getElementById('durationHours').value || 0;
            data.duration_minutes = document.getElementById('durationMinutes').value || 0;

            // Validación simple: al menos uno debe ser mayor que cero
            if (data.duration_days <= 0 && data.duration_hours <= 0 && data.duration_minutes <= 0) {
                showCustomAlert('Si estableces un límite de tiempo, la duración debe ser mayor a cero.');
                return;
            }
        }

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