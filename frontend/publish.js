document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica de API y Estado ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';
    const storedUsername = localStorage.getItem('username');

    // --- Elementos del DOM ---
    const publishForm = document.getElementById('publishForm');
    const costWrapper = document.getElementById('cost-wrapper');
    const sellWrapper = document.getElementById('sell-wrapper');
    const repeatWrapper = document.getElementById('repeat-wrapper');
    const noticeContainer = document.getElementById('commission-notice-container');
    const preLaunchNoticeContainer = document.getElementById('prelaunch-notice-container');
    const setExpirationCheckbox = document.getElementById('setExpiration');
    const expirationInputsContainer = document.getElementById('expiration-inputs');
    const stepInstructionsContainer = document.getElementById('step-instructions-container');
    const stepInstructionsPanel = document.getElementById('stepInstructionsPanel');
    const stepInputs = document.getElementById('stepInputs');
    const addStepBtn = document.getElementById('addStepBtn');

    // --- Elementos del formulario que cambiaremos ---
    const pageTitle = document.querySelector('.container h1');
    const titleLabel = document.querySelector('label[for="title"]');
    const titleInput = document.getElementById('title');
    const titleHint = document.querySelector('label[for="title"] + input + small');
    const descriptionLabel = document.querySelector('label[for="description"]');
    const descriptionInput = document.getElementById('description');
    const descriptionHint = document.querySelector('label[for="description"] + textarea + small');
    const submitButton = document.querySelector('#publishForm button[type="submit"]');
    const blueCostInput = document.getElementById('blueCost');
    const blueSellInput = document.getElementById('blueSell');
    const STEP_MARKER_START = '[[INSTRUCTIONS_STEPS]]';
    const STEP_MARKER_END = '[[/INSTRUCTIONS_STEPS]]';

    // --- NUEVO: Elementos del Modal de Advertencia de Donación ---
    const donationWarningModal = document.getElementById('donationWarningModal');
    const donationModalActions = document.querySelector('#donationWarningModal .modal-actions');
    const donationWarningCloseButton = document.querySelector('.donation-warning-close');
    
    // --- NUEVO: Modal para Solicitar Tutor (Menores de Edad) ---
    const tutorModal = document.getElementById('tutorRequiredModal');
    const tutorForm = document.getElementById('addTutorForm');
    const tutorCloseButtons = document.querySelectorAll('.tutor-modal-close');
    
    function showTutorRequiredModal() {
        if (tutorModal) {
            tutorModal.style.display = 'flex';
        }
    }
    
    function closeTutorModal() {
        if (tutorModal) {
            tutorModal.style.display = 'none';
            if (tutorForm) tutorForm.reset();
        }
    }
    
    tutorCloseButtons.forEach(button => {
        button.addEventListener('click', closeTutorModal);
    });
    
    if (tutorModal) {
        window.addEventListener('click', (event) => {
            if (event.target === tutorModal) closeTutorModal();
        });
    }
    
    // Manejar envío del formulario de tutor
    if (tutorForm) {
        tutorForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const tutorUsernameOrEmail = document.getElementById('tutorUsernameOrEmail').value;
            const username = localStorage.getItem('username');
            
            if (!username) {
                showCustomAlert('Error: No se pudo obtener tu nombre de usuario. Por favor, inicia sesión nuevamente.');
                return;
            }
            
            if (!tutorUsernameOrEmail) {
                showCustomAlert('Por favor, ingresa el usuario o email del tutor.');
                return;
            }
            
            try {
                const response = await fetch(`${API_URL}/api/minor/add-tutor`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        minorUsername: username,
                        tutorUsernameOrEmail: tutorUsernameOrEmail.trim()
                    })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showCustomAlert(result.message || 'Tutor agregado exitosamente. Ahora puedes realizar transacciones.', () => {
                        closeTutorModal();
                        // Recargar la página para actualizar el estado
                        window.location.reload();
                    });
                } else {
                    showCustomAlert(result.message || 'Error al agregar tutor. Por favor, verifica que el tutor tenga una cuenta activa.');
                }
            } catch (error) {
                console.error('Error al agregar tutor:', error);
                showCustomAlert('No se pudo conectar con el servidor. Inténtalo de nuevo.');
            }
        });
    }


    // --- Redirección y Seguridad ---
    // Envolvemos la comprobación en un pequeño timeout para darle tiempo al localStorage a sincronizarse entre páginas.
    setTimeout(() => {
        if (!storedUsername) {
            showCustomAlert('Debes iniciar sesión para publicar.', () => { window.location.href = 'index.html'; });
            return;
        }
    }, 100); // 100ms de retraso como medida de seguridad adicional

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

    // --- NUEVO: Lógica para instrucciones paso a paso ---
    if (stepInstructionsPanel) {
        stepInstructionsPanel.style.display = 'block';
    }


    if (addStepBtn && stepInputs) {
        addStepBtn.addEventListener('click', () => {
            const maxSteps = 20;
            const currentCount = stepInputs.querySelectorAll('.step-input').length;
            if (currentCount >= maxSteps) {
                addStepBtn.disabled = true;
                return;
            }

            const nextIndex = currentCount + 1;
            const wrapper = document.createElement('div');
            wrapper.className = 'step-input';

            const label = document.createElement('label');
            label.setAttribute('for', `stepInstruction${nextIndex}`);
            label.textContent = `Paso ${nextIndex}`;

            const input = document.createElement('input');
            input.type = 'text';
            input.id = `stepInstruction${nextIndex}`;
            input.name = `stepInstruction${nextIndex}`;
            input.placeholder = `Describe el paso ${nextIndex}`;

            wrapper.appendChild(label);
            wrapper.appendChild(input);
            stepInputs.appendChild(wrapper);

            if (stepInputs.querySelectorAll('.step-input').length >= maxSteps) {
                addStepBtn.disabled = true;
            }
        });
    }

    function getStepValues() {
        if (!stepInputs) return [];
        return Array.from(stepInputs.querySelectorAll('input'))
            .map(input => input.value.trim())
            .filter(value => value.length > 0);
    }

    function stripStepBlock(text) {
        if (!text) return '';
        const pattern = new RegExp(`${STEP_MARKER_START}[\\s\\S]*?${STEP_MARKER_END}`, 'g');
        return text.replace(pattern, '').trim();
    }

    function mergeDescriptionWithSteps(description, steps) {
        if (!steps.length) return description;
        const baseText = stripStepBlock(description || '');
        return `${baseText}\n\n${STEP_MARKER_START}\n${steps.join('\n')}\n${STEP_MARKER_END}`.trim();
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
        // No se necesitan cambios de texto para 'request', usa los valores por defecto.
        if (stepInstructionsContainer) stepInstructionsContainer.style.display = 'block';
    } else if (publicationType === 'sell') {
        costWrapper.style.display = 'none';
        sellWrapper.style.display = 'block';
        if (repeatWrapper) repeatWrapper.style.display = 'none'; // No tiene sentido repetir compras
        // Lógica específica para Venta
        pageTitle.textContent = 'Crear una Oferta de Venta';
        titleLabel.textContent = '¿Qué ofreces a cambio de BLUE?';
        titleInput.placeholder = 'Ej: 50 USD por PayPal o Ej: Diseño de logo profesional';
        titleHint.textContent = 'Un nombre claro y conciso para lo que ofreces.';
        descriptionLabel.textContent = 'Descripción y Condiciones:';
        descriptionInput.placeholder = 'Ej: Ofrezco mis servicios para crear un logo vectorial de alta calidad. Incluye 3 revisiones...';
        descriptionHint.textContent = 'Detalla tu oferta. Si ofreces dinero, especifica el método de pago (banco, etc.) y cualquier condición.';
        
        const sellLabel = document.querySelector('#sell-wrapper label');
        if (sellLabel) {
            sellLabel.textContent = 'Cantidad de BLUE que quieres recibir:';
        }
        submitButton.textContent = 'Crear Oferta';

    } else if (publicationType === 'donation') {
        costWrapper.style.display = 'none';
        sellWrapper.style.display = 'block';
        if (repeatWrapper) repeatWrapper.style.display = 'none'; // No tiene sentido repetir donaciones en este contexto
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

        // --- NUEVO: Lógica del Modal de Advertencia ---
        // 1. Mostrar advertencia inicial al entrar a la página
        if (sessionStorage.getItem('donationWarningShown') !== 'true') {
            showDonationWarningModal('initial');
            sessionStorage.setItem('donationWarningShown', 'true');
        }

    } else {
        showCustomAlert('Tipo de publicación no válido.', () => { window.location.href = 'contract_interaction.html'; });
        return;
    }

    // --- NUEVO: Funciones para manejar el modal de advertencia ---
    function showDonationWarningModal(mode) {
        if (!donationWarningModal || !donationModalActions) return;

        // Limpiar botones anteriores
        donationModalActions.innerHTML = '';

        if (mode === 'initial') {
            const okButton = document.createElement('button');
            okButton.textContent = 'Entendido';
            okButton.className = 'ok-button';
            okButton.onclick = hideDonationWarningModal;
            donationModalActions.appendChild(okButton);
        } else if (mode === 'confirm') {
            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancelar';
            cancelButton.className = 'cancel-button';
            cancelButton.onclick = hideDonationWarningModal;

            const confirmButton = document.createElement('button');
            confirmButton.textContent = 'Confirmar y Publicar';
            confirmButton.className = 'confirm-button';
            confirmButton.onclick = () => {
                hideDonationWarningModal();
                submitPublicationForm(); // Llama a la función que realmente envía el form
            };
            
            donationModalActions.appendChild(cancelButton);
            donationModalActions.appendChild(confirmButton);
        }

        donationWarningModal.style.display = 'flex';
    }

    function hideDonationWarningModal() {
        if (donationWarningModal) {
            donationWarningModal.style.display = 'none';
        }
    }

    // Event listeners para cerrar el modal
    if (donationWarningCloseButton) {
        donationWarningCloseButton.addEventListener('click', hideDonationWarningModal);
    }
    window.addEventListener('click', (event) => {
        if (event.target === donationWarningModal) {
            hideDonationWarningModal();
        }
    });


    // --- Lógica de Envío del Formulario ---
    publishForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // --- NUEVO: Interceptación para confirmación de donación ---
        if (publicationType === 'donation') {
            showDonationWarningModal('confirm');
            return; // Detiene la ejecución aquí hasta que el usuario confirme
        }

        // Si no es donación, o si ya se confirmó, se llama a la función de envío
        submitPublicationForm();
    });

    // --- NUEVO: Función refactorizada para enviar el formulario ---
    async function submitPublicationForm() {
        // Recolectar datos del formulario
        const formData = new FormData(publishForm);
        const data = Object.fromEntries(formData.entries());
        data.authorUsername = storedUsername;
        data.publicationType = publicationType; // Añadimos el tipo para que el backend sepa qué es

        // El valor de un checkbox no marcado no se envía, así que lo manejamos explícitamente.
        data.autoApprove = document.getElementById('autoApprove').checked;
        data.allowRepeatParticipation = document.getElementById('allowRepeatParticipation').checked;

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

        if (publicationType === 'request') {
            const steps = getStepValues();
            if (steps.length) {
                data.description = mergeDescriptionWithSteps(data.description, steps);
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
                // Verificar si requiere tutor
                if (result.requires_tutor && result.is_minor) {
                    showTutorRequiredModal();
                } else {
                    showCustomAlert(result.message || 'Ocurrió un error al crear la publicación.');
                }
            }

        } catch (error) {
            console.error('Error de red al publicar:', error);
            showCustomAlert('No se pudo conectar con el servidor. Inténtalo de nuevo.');
        }
    }
}); 