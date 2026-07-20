/**
 * Publish Page Module
 * Handles creating new publications (request, sell, donation)
 */

import { getApiUrl, showCustomAlert, handleSessionExpired } from '../modules/index.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- API and State ---
    const API_URL = getApiUrl();
    const storedUsername = localStorage.getItem('username');

    // --- DOM Elements ---
    const publishForm = document.getElementById('publishForm');
    const costWrapper = document.getElementById('cost-wrapper');
    const sellWrapper = document.getElementById('sell-wrapper');
    const repeatWrapper = document.getElementById('repeat-wrapper');
    const repeatLimitWrapper = document.getElementById('repeatLimitWrapper');
    const repeatLimitInput = document.getElementById('repeatLimit');
    const repeatCooldownWrapper = document.getElementById('repeatCooldownWrapper');
    const repeatCooldownDaysInput = document.getElementById('repeatCooldownDays');
    const repeatCooldownHoursInput = document.getElementById('repeatCooldownHours');
    const repeatCooldownMinutesInput = document.getElementById('repeatCooldownMinutes');
    const noticeContainer = document.getElementById('commission-notice-container');
    const preLaunchNoticeContainer = document.getElementById('prelaunch-notice-container');
    const setExpirationCheckbox = document.getElementById('setExpiration');
    const expirationInputsContainer = document.getElementById('expiration-inputs');
    const stepInstructionsContainer = document.getElementById('step-instructions-container');
    const stepInstructionsPanel = document.getElementById('stepInstructionsPanel');
    const stepInputs = document.getElementById('stepInputs');
    const addStepBtn = document.getElementById('addStepBtn');

    // --- Form elements to modify ---
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

    // --- Donation Warning Modal ---
    const donationWarningModal = document.getElementById('donationWarningModal');
    const donationModalActions = document.querySelector('#donationWarningModal .modal-actions');
    const donationWarningCloseButton = document.querySelector('.donation-warning-close');

    // --- Tutor Required Modal (Minors) ---
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

    // Handle tutor form submission
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
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/api/minor/add-tutor`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token && { 'Authorization': `Bearer ${token}` })
                    },
                    body: JSON.stringify({
                        minorUsername: username,
                        tutorUsernameOrEmail: tutorUsernameOrEmail.trim()
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    showCustomAlert(result.message || 'Tutor agregado exitosamente. Ahora puedes realizar transacciones.', () => {
                        closeTutorModal();
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

    // --- Redirect if not logged in ---
    setTimeout(() => {
        if (!storedUsername) {
            showCustomAlert('Debes iniciar sesión para publicar.', () => { window.location.href = 'index.html'; });
            return;
        }
    }, 100);

    // --- Expiration toggle logic ---
    expirationInputsContainer.style.display = 'none';
    setExpirationCheckbox.checked = false;

    setExpirationCheckbox.addEventListener('change', () => {
        const isChecked = setExpirationCheckbox.checked;
        if (isChecked) {
            expirationInputsContainer.style.display = 'block';
            setTimeout(() => {
                expirationInputsContainer.classList.add('expanded');
            }, 10);
        } else {
            expirationInputsContainer.classList.remove('expanded');
            setTimeout(() => {
                expirationInputsContainer.style.display = 'none';
            }, 300);
        }
    });

    // --- Step-by-step instructions logic ---
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

    // --- Display notices ---
    async function displayNotices() {
        try {
            const response = await fetch(`${API_URL}/api/platform-settings`);
            if (!response.ok) return;
            const settings = await response.json();

            // Pre-launch notice
            if (preLaunchNoticeContainer && settings.pre_launch_mode_enabled) {
                preLaunchNoticeContainer.innerHTML = `
                    <div class="prelaunch-notice">
                        <h4>🚀 MODO PRE-LANZAMIENTO ACTIVO</h4>
                        <p>¡Gracias por ser de los primeros!</p>
                    </div>
                `;
                preLaunchNoticeContainer.style.display = 'block';

                // Bloquear botón de publicar para usuarios normales
                const currentUser = localStorage.getItem('username');
                // Asumir 'wintoncoin' o el que venga en settings, si no hay settings.platform_username, usar un valor seguro.
                const platformUser = (settings.platform_username || 'wintoncoin').toLowerCase();

                const isPlatform = currentUser && (currentUser.toLowerCase() === platformUser || currentUser.toLowerCase() === 'plataforma');

                if (!isPlatform && submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = "Publicación Deshabilitada (Pre-lanzamiento)";
                    submitButton.style.opacity = "0.6";
                    submitButton.style.cursor = "not-allowed";

                    // Aviso adicional junto al botón
                    const existingWarning = document.getElementById('prelaunch-submit-warning');
                    if (!existingWarning) {
                        const warningMsg = document.createElement('p');
                        warningMsg.id = 'prelaunch-submit-warning';
                        warningMsg.style.color = '#ff9800'; // Naranja advertencia
                        warningMsg.style.fontSize = '0.9rem';
                        warningMsg.style.marginTop = '10px';
                        warningMsg.style.textAlign = 'center';
                        warningMsg.innerHTML = '🔒 Solo la plataforma puede publicar durante la fase pre-lanzamiento.';
                        submitButton.parentElement.appendChild(warningMsg);
                    }
                }
            }

            // Commission notice (only if pre-launch is off)
            if (noticeContainer && !settings.pre_launch_mode_enabled) {
                const commissionResponse = await fetch(`${API_URL}/api/settings`);
                if (!commissionResponse.ok) return;
                const generalSettings = await commissionResponse.json();
                const commissionPercentage = generalSettings.platform_commission_percentage || 0;

                if (commissionPercentage > 0) {
                    noticeContainer.innerHTML = `
                        <div class="commission-notice">
                            <p>Nota: Al completarse, esta transacción generará una comisión del <strong>${commissionPercentage}%</strong> para la plataforma. La comisión se añade al compromiso RED del usuario que se beneficia del servicio/producto.</p>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error("Error al cargar la configuración de la plataforma:", error);
        }
    }

    // --- Form initialization based on type ---
    displayNotices();
    const urlParams = new URLSearchParams(window.location.search);
    const publicationType = urlParams.get('type');

    if (publicationType === 'request') {
        costWrapper.style.display = 'block';
        sellWrapper.style.display = 'none';
        if (stepInstructionsContainer) stepInstructionsContainer.style.display = 'block';
    } else if (publicationType === 'sell') {
        costWrapper.style.display = 'none';
        sellWrapper.style.display = 'block';
        if (repeatWrapper) repeatWrapper.style.display = 'none';
        if (repeatLimitWrapper) repeatLimitWrapper.style.display = 'none';
        if (repeatCooldownWrapper) repeatCooldownWrapper.style.display = 'none';
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
        if (repeatWrapper) repeatWrapper.style.display = 'none';
        if (repeatLimitWrapper) repeatLimitWrapper.style.display = 'none';
        if (repeatCooldownWrapper) repeatCooldownWrapper.style.display = 'none';
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

        // Ocultar campos innecesarios para donaciones
        const autoApproveWrapper = document.getElementById('autoApprove')?.closest('.form-group') || document.getElementById('autoApprove')?.parentElement;
        if (autoApproveWrapper) autoApproveWrapper.style.display = 'none';

        const slotsWrapper = document.getElementById('availableSlots')?.closest('.form-group') || document.getElementById('availableSlots')?.parentElement;
        if (slotsWrapper) slotsWrapper.style.display = 'none';

        // Show initial warning
        // Show initial warning always
        showDonationWarningModal('initial');

        // Mostrar campo del código de referido del beneficiario
        const beneficiaryRefWrapper = document.getElementById('beneficiary-ref-wrapper');
        if (beneficiaryRefWrapper) beneficiaryRefWrapper.style.display = 'block';
    } else {
        showCustomAlert('Tipo de publicación no válido.', () => { window.location.href = 'contract_interaction.html'; });
        return;
    }

    const repeatCheckbox = document.getElementById('allowRepeatParticipation');
    if (repeatCheckbox && repeatLimitWrapper && repeatCooldownWrapper) {
        const updateRepeatVisibility = () => {
            repeatLimitWrapper.style.display = repeatCheckbox.checked ? 'flex' : 'none';
            repeatCooldownWrapper.style.display = repeatCheckbox.checked ? 'flex' : 'none';
            if (!repeatCheckbox.checked && repeatLimitInput) {
                repeatLimitInput.value = '2';
            }
            if (!repeatCheckbox.checked) {
                if (repeatCooldownDaysInput) repeatCooldownDaysInput.value = '0';
                if (repeatCooldownHoursInput) repeatCooldownHoursInput.value = '0';
                if (repeatCooldownMinutesInput) repeatCooldownMinutesInput.value = '12';
            }
        };
        repeatCheckbox.addEventListener('change', updateRepeatVisibility);
        updateRepeatVisibility();
    }

    // --- Image Upload Logic ---
    let uploadedImagesUrls = [];
    const dropzone = document.getElementById('mediaDropzone');
    const fileInput = document.getElementById('mediaFileInput');
    const previewContainer = document.getElementById('mediaPreviewContainer');
    const dropzoneLimitMsg = document.getElementById('dropzone-limit-message');
    let maxImagesAllowed = 1;

    async function loadImageLimits(pubType) {
        try {
            const res = await fetch(`${API_URL}/api/platform-settings`);
            if (res.ok) {
                const settings = await res.json();
                maxImagesAllowed = parseInt(settings[`max_images_${pubType}`] || '1', 10);
                if (dropzoneLimitMsg) {
                    dropzoneLimitMsg.textContent = `Puedes subir hasta ${maxImagesAllowed} imagen${maxImagesAllowed !== 1 ? 'es' : ''}.`;
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    const urlParamsForUpload = new URLSearchParams(window.location.search);
    const pubTypeForUpload = urlParamsForUpload.get('type') || 'request';
    loadImageLimits(pubTypeForUpload);

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            handleMediaFiles(e.dataTransfer.files);
        });
        fileInput.addEventListener('change', (e) => handleMediaFiles(e.target.files));
    }

    async function handleMediaFiles(files) {
        const remainingSlots = maxImagesAllowed - uploadedImagesUrls.length;
        if (remainingSlots <= 0) {
            showCustomAlert(`Solo puedes subir un máximo de ${maxImagesAllowed} imágenes.`);
            return;
        }

        const filesToUpload = Array.from(files).slice(0, remainingSlots);
        
        for (const file of filesToUpload) {
            if (!file.type.startsWith('image/')) continue;
            
            const item = document.createElement('div');
            item.className = 'media-preview-item';
            
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            
            const progress = document.createElement('div');
            progress.className = 'upload-progress';
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.type = 'button';
            removeBtn.style.display = 'none';

            item.appendChild(img);
            item.appendChild(progress);
            item.appendChild(removeBtn);
            previewContainer.appendChild(item);

            const formData = new FormData();
            formData.append('images', file);
            
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/api/media/upload`, {
                    method: 'POST',
                    headers: { ...(token && { 'Authorization': `Bearer ${token}` }) },
                    body: formData
                });
                
                if (res.ok) {
                    const data = await res.json();
                    if (data.urls && data.urls.length > 0) {
                        const uploadedUrl = data.urls[0];
                        uploadedImagesUrls.push(uploadedUrl);
                        
                        progress.style.width = '100%';
                        setTimeout(() => progress.style.display = 'none', 500);
                        img.classList.add('loaded');
                        removeBtn.style.display = 'block';
                        
                        removeBtn.onclick = (e) => {
                            e.stopPropagation(); 
                            uploadedImagesUrls = uploadedImagesUrls.filter(u => u !== uploadedUrl);
                            item.remove();
                        };
                    }
                } else {
                    item.remove();
                    let errMsg = 'Error al subir la imagen.';
                    try {
                        const errData = await res.json();
                        const detailText = [errData.message, errData.details].filter(Boolean).join(' - ');
                        if (detailText) {
                            errMsg += ` Detalle: ${detailText}`;
                        }
                    } catch (e) {}
                    showCustomAlert(errMsg);
                }
            } catch (err) {
                console.error(err);
                item.remove();
                showCustomAlert(`Error de red al subir la imagen: ${err.message}`);
            }
        }
    }

    // --- Donation warning modal ---
    function showDonationWarningModal(mode) {
        if (!donationWarningModal || !donationModalActions) return;

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
                submitPublicationForm();
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

    if (donationWarningCloseButton) {
        donationWarningCloseButton.addEventListener('click', hideDonationWarningModal);
    }
    window.addEventListener('click', (event) => {
        if (event.target === donationWarningModal) {
            hideDonationWarningModal();
        }
    });

    // --- Form submission ---
    publishForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (publicationType === 'donation') {
            showDonationWarningModal('confirm');
            return;
        }

        submitPublicationForm();
    });

    async function submitPublicationForm() {
        const formData = new FormData(publishForm);
        const data = Object.fromEntries(formData.entries());
        data.authorUsername = storedUsername;
        data.publicationType = publicationType;
        data.image_urls = uploadedImagesUrls;
        data.requires_evidence = document.getElementById('requiresEvidence')?.checked || false;

        data.autoApprove = document.getElementById('autoApprove').checked;
        data.allowRepeatParticipation = document.getElementById('allowRepeatParticipation').checked;
        if (data.allowRepeatParticipation) {
            const repeatLimit = repeatLimitInput ? parseInt(repeatLimitInput.value, 10) : NaN;
            if (!Number.isFinite(repeatLimit) || repeatLimit < 2) {
                showCustomAlert('Indica el máximo de repeticiones por usuario (mínimo 2).');
                return;
            }
            data.maxRepeatPerUser = repeatLimit;
            const repeatDays = repeatCooldownDaysInput ? parseInt(repeatCooldownDaysInput.value, 10) : 0;
            const repeatHours = repeatCooldownHoursInput ? parseInt(repeatCooldownHoursInput.value, 10) : 0;
            const repeatMinutes = repeatCooldownMinutesInput ? parseInt(repeatCooldownMinutesInput.value, 10) : 0;
            const safeDays = Number.isFinite(repeatDays) ? repeatDays : 0;
            const safeHours = Number.isFinite(repeatHours) ? repeatHours : 0;
            const safeMinutes = Number.isFinite(repeatMinutes) ? repeatMinutes : 0;
            const totalMinutes = (safeDays * 24 * 60) + (safeHours * 60) + safeMinutes;
            if (totalMinutes < 1) {
                showCustomAlert('Indica un tiempo mínimo para repetir (mínimo 1 minuto).');
                return;
            }
            data.repeatCooldownDays = safeDays;
            data.repeatCooldownHours = safeHours;
            data.repeatCooldownMinutes = safeMinutes;
        } else {
            data.maxRepeatPerUser = 1;
            data.repeatCooldownDays = 0;
            data.repeatCooldownHours = 0;
            data.repeatCooldownMinutes = 12;
        }

        if (setExpirationCheckbox.checked) {
            data.duration_days = document.getElementById('durationDays').value || 0;
            data.duration_hours = document.getElementById('durationHours').value || 0;
            data.duration_minutes = document.getElementById('durationMinutes').value || 0;

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

        // Si es una donación, mapeamos el valor de 'blueSell' a 'goalAmount'
        if (publicationType === 'donation') {
            data.goalAmount = data.blueSell;
            // No necesitamos enviar blueSell ni blueCost para donaciones 
            // ya que usamos goal_amount en el backend
            delete data.blueSell;
            delete data.blueCost;

            if (!data.beneficiaryReferralCode || !data.beneficiaryReferralCode.trim()) {
                showCustomAlert('Por favor, ingresa el código de referido del beneficiario.');
                return;
            }
        } else {
            delete data.beneficiaryReferralCode;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify(data)
            });
            // Si el token expiró, redirigir al login
            if (handleSessionExpired(response)) return;

            const result = await response.json();

            if (response.ok) {
                showCustomAlert(result.message || '¡Publicación creada con éxito!', () => {
                    window.location.href = 'contract_interaction.html';
                });
            } else {
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
