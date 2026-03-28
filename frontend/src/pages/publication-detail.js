/**
 * Publication Detail Page Module
 * Handles viewing and interacting with a single publication
 */

import { getApiUrl, showCustomAlert, showCustomConfirm, linkify, fetchAndStoreAppSettings, appSettings } from '../modules/index.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration and State ---
    const API_URL = getApiUrl();

    const storedUsername = localStorage.getItem('username');
    const storedToken = localStorage.getItem('token');
    const urlParams = new URLSearchParams(window.location.search);
    const publicationId = urlParams.get('id');

    let modalDismissed = false; // Flag para evitar que el modal reaparezca al refrescar con acciones

    const elements = {
        container: document.getElementById('publication-detail-container'),
        content: document.getElementById('publication-content'),
        ratingModal: document.getElementById('ratingModal'),
        ratingForm: document.getElementById('ratingForm'),
        ratingModalTitle: document.getElementById('ratingModalTitle'),
        ratingPublicationId: document.getElementById('ratingPublicationId'),
        ratingRaterUsername: document.getElementById('ratingRaterUsername'),
        ratingRateeUsername: document.getElementById('ratingRateeUsername'),
        preflightModal: document.getElementById('preflightModal'),
        preflightTitle: document.getElementById('preflightTitle'),
        preflightMessage: document.getElementById('preflightMessage'),
        preflightContinueBtn: document.getElementById('preflightContinueBtn'),
    };

    // --- Initialization ---
    if (!storedUsername) {
        showCustomAlert('Debes iniciar sesión para ver esta página.', () => { window.location.href = 'index.html'; });
        return;
    }
    if (!publicationId) {
        showCustomAlert('No se ha especificado una publicación.', () => { window.location.href = 'contract_interaction.html'; });
        return;
    }

    async function initializePage() {
        try {
            const settingsPromise = fetchAndStoreAppSettings();
            const platformSettingsPromise = fetch(`${API_URL}/api/platform-settings`).then(async (response) => {
                if (!response.ok) return {};
                return response.json();
            });
            const publicationPromise = fetch(`${API_URL}/api/publications/${publicationId}?user=${storedUsername}`);

            const [_, platformSettings, publicationResponse] = await Promise.all([settingsPromise, platformSettingsPromise, publicationPromise]);

            if (!publicationResponse.ok) {
                const errorData = await publicationResponse.json();
                throw new Error(errorData.message || 'Error al cargar la publicación.');
            }

            const publication = await publicationResponse.json();

            // --- NUEVO: Mostrar Modal Intersticial si es necesario ---
            if (publication.preflight_modal && !modalDismissed) {
                showPreflightModal(publication.preflight_modal);
            }

            renderPublication(publication, platformSettings);
            setupEventListeners();

        } catch (error) {
            console.error('Error al inicializar la página de detalle:', error);
            elements.content.innerHTML = `<p class="error-message">No se pudo cargar la publicación. ${error.message}</p>`;
        }
    }

    initializePage();

    // --- Rendering Logic ---
    function normalizeMultilineText(text) {
        const raw = String(text || '').replace(/\r\n/g, '\n');
        const lines = raw.split('\n').map(l => l.replace(/[ \t]+$/g, ''));

        const indents = lines
            .filter(l => l.trim().length > 0)
            .map(l => (l.match(/^[ \t]*/) || [''])[0].length);

        const minIndent = indents.length ? Math.min(...indents) : 0;
        const normalized = lines.map(l => l.slice(minIndent));

        return normalized.join('\n').trim();
    }

    function showPreflightModal(modalData) {
        if (!elements.preflightModal) return;

        elements.preflightTitle.textContent = modalData.title;
        elements.preflightMessage.textContent = modalData.message;
        elements.preflightModal.style.display = 'flex';

        elements.preflightContinueBtn.onclick = () => {
            elements.preflightModal.style.display = 'none';
            modalDismissed = true; // Marcar como visto
        };
    }

    function isPlatformPublication(pub, platformSettings) {
        const platformUsername = String(platformSettings?.platform_username || 'Plataforma WintonCoin').toLowerCase();
        const author = String(pub.author_username || '').toLowerCase();
        return author === platformUsername || author === 'plataforma';
    }

    function getBlueUnitLabel(pub, platformSettings) {
        if (platformSettings?.pre_launch_mode_enabled && isPlatformPublication(pub, platformSettings)) {
            return 'BLUE iou';
        }
        return 'BLUE';
    }

    function renderPublication(pub, platformSettings) {
        const isDonation = pub.category === 'donation';
        const authorRatingHTML = generateStarRating(pub.author_average_rating, pub.author_ratings_count);

        const authorNameHTML = appSettings.public_profiles_enabled
            ? `<a href="profile.html?user=${pub.author_username}" class="profile-link">${pub.author_username}</a>`
            : pub.author_username;

        const expirationInfo = getExpirationStatusHTML(pub);
        const shareButtonHTML = `
            <button class="share-link-button" data-action="share" aria-label="Compartir publicación">
                <svg class="share-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                </svg>
                Compartir
            </button>
        `;

        const blueLabel = getBlueUnitLabel(pub, platformSettings);
        const { messageHTML, actionHTML, acceptButtonHTML, duplicateCompleteButtonHTML } = getActionAndMessageHTML(pub, expirationInfo.isExpired, blueLabel);
        const { mainText, steps } = splitDescriptionWithSteps(pub.description);
        const stepsHTML = renderStepFlow(steps, pub.form_fields, pub.user_acceptance_status);

        let ribbonClass = '';
        if (isDonation) {
            ribbonClass = 'donation-ribbon';
        } else if (pub.is_sell_post) {
            ribbonClass = 'sell-ribbon';
        }

        const costLabel = isDonation ? `Meta: ${formatBalance(pub.goal_amount)} ${blueLabel}` : `${formatBalance(pub.blue_cost)} ${blueLabel}`;

        const metaBadgeHTML = isDonation
            ? `<div class="donation-meta-badge-detail">Meta: ${formatBalance(pub.goal_amount)} BLUE</div>`
            : '';

        // Barra de progreso para donaciones
        let progressHTML = '';
        if (isDonation) {
            const current = parseFloat(pub.current_amount || 0);
            const goal = parseFloat(pub.goal_amount || 0);
            const percent = goal > 0 ? Math.min(100, Math.floor((current / goal) * 100)) : 0;
            progressHTML = `
                <div class="donation-progress-container detail-progress">
                    <div class="donation-progress-labels">
                        <span><strong>${formatBalance(current)}</strong> recaudados de ${formatBalance(goal)} BLUE</span>
                        <span>${percent}%</span>
                    </div>
                    <div class="donation-progress-bar">
                        <div class="donation-progress-fill" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        }

        const publicationHTML = `
            <div class="detail-header">
                ${metaBadgeHTML}
                <h1 class="detail-title">${pub.title}</h1>
                <div class="detail-meta">
                    Publicado por <strong>${authorNameHTML}</strong> ${authorRatingHTML}
                    <span class="detail-date">el ${new Date(pub.created_at).toLocaleDateString()}</span>
                    ${expirationInfo.html}
                </div>
            </div>

            <div class="share-button-container">
                ${acceptButtonHTML || ''}
                ${shareButtonHTML}
            </div>

            ${progressHTML}

            <hr>

            <div class="detail-description">
                ${linkify(normalizeMultilineText(mainText))}
            </div>

            ${stepsHTML}

            <hr>
            
            <div class="detail-actions-section">
                ${duplicateCompleteButtonHTML || ''}
                ${messageHTML}
                ${actionHTML}
            </div>

            ${getParticipantsSectionHTML(pub)}
        `;
        elements.content.innerHTML = publicationHTML;
    }

    function splitDescriptionWithSteps(description) {
        const STEP_MARKER_START = '[[INSTRUCTIONS_STEPS]]';
        const STEP_MARKER_END = '[[/INSTRUCTIONS_STEPS]]';
        if (!description || !description.includes(STEP_MARKER_START)) {
            return { mainText: description || '', steps: [] };
        }

        const startIndex = description.indexOf(STEP_MARKER_START);
        const endIndex = description.indexOf(STEP_MARKER_END);
        if (endIndex === -1) {
            return { mainText: description || '', steps: [] };
        }

        const mainText = description.slice(0, startIndex).trim();
        const stepsRaw = description
            .slice(startIndex + STEP_MARKER_START.length, endIndex)
            .split('\n')
            .map(step => step.trim())
            .filter(step => step.length > 0);

        return { mainText, steps: stepsRaw };
    }

    function renderStepFlow(steps, formFields = null, userStatus = null) {
        if (!steps || steps.length === 0) return '';

        const itemsHTML = steps.map((step, index) => {
            const stepNum = index + 1;
            const stepNumStr = String(stepNum);
            const hasFormFields = formFields && formFields[stepNumStr] && formFields[stepNumStr].length > 0;

            let formInputsHTML = '';
            if (hasFormFields) {
                const fieldsHTML = formFields[stepNumStr].map((field, fieldIndex) => `
                    <div class="step-form-field-user">
                        <label for="form-step-${stepNum}-field-${fieldIndex}">${field}</label>
                        <input type="text" 
                               id="form-step-${stepNum}-field-${fieldIndex}" 
                               class="step-form-input" 
                               data-step="${stepNum}" 
                               data-field="${field}"
                               placeholder="Escribe tu respuesta..." 
                               required>
                    </div>
                `).join('');

                formInputsHTML = `
                    <div class="step-form-container" data-step="${stepNum}">
                        <div class="step-form-header">
                            <span class="step-form-icon">📝</span>
                            <span class="step-form-label">Completa los siguientes datos:</span>
                        </div>
                        <div class="step-form-fields-user">
                            ${fieldsHTML}
                        </div>
                    </div>
                `;
            }

            return `
                <li class="detail-step-item">
                    <div class="detail-step-node">
                        <span class="detail-step-index">${stepNum}</span>
                    </div>
                    <div class="detail-step-content">
                        <div class="detail-step-badge">Paso ${stepNum}</div>
                        <div class="detail-step-text">${linkify(step)}</div>
                        ${formInputsHTML}
                    </div>
                </li>
            `;
        }).join('');

        return `
            <div class="detail-steps">
                <h3 class="detail-steps-title">Sigue las instrucciones paso a paso sin saltar ninguno</h3>
                <ol class="detail-steps-flow">
                    ${itemsHTML}
                </ol>
            </div>
        `;
    }

    function getParticipantsSectionHTML(pub) {
        if (pub.author_username !== storedUsername || !pub.participants || pub.participants.length === 0) {
            return '';
        }

        const participantsList = pub.participants.map(p => {
            const ratingHTML = generateStarRating(p.average_rating, p.ratings_count);
            const statusText = getStatusText(p.status);
            let actionButtons = '';

            const participantNameHTML = appSettings.public_profiles_enabled
                ? `<a href="profile.html?user=${p.username}" class="profile-link">${p.username}</a>`
                : p.username;

            // Formatear fecha y hora de solicitud
            const acceptedAtHTML = p.accepted_at
                ? `<span class="participant-accepted-at">Solicitó: ${formatDateTime(p.accepted_at)}</span>`
                : '';

            if (p.status === 'pending_approval') {
                actionButtons = `
                    <button class="action-button approve" data-action="approve" data-user="${p.username}">Aprobar</button>
                    <button class="action-button discard" data-action="discard" data-user="${p.username}">Descartar</button>
                `;
            } else if (p.status === 'approved') {
                if (p.phone_number) {
                    const whatsappLink = `https://wa.me/${p.phone_number.replace(/\D/g, '')}`;
                    actionButtons += `
                        <a href="${whatsappLink}" target="_blank" class="action-button whatsapp-button" title="Contactar por WhatsApp">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                            Contactar
                        </a>
                    `;
                }
            } else if (p.status === 'completed') {
                actionButtons = `
                    <button class="action-button confirm" data-action="confirm-payment" data-user="${p.username}">Confirmar Pago</button>
                `;
            }

            // Mostrar respuestas del formulario si existen
            let formResponsesHTML = '';
            if (p.form_responses && Object.keys(p.form_responses).length > 0) {
                const responsesContent = Object.entries(p.form_responses).map(([stepNum, fields]) => {
                    const fieldsHTML = Object.entries(fields).map(([fieldName, value]) => `
                        <div class="form-response-field">
                            <span class="form-response-label">${fieldName}:</span>
                            <span class="form-response-value">${value}</span>
                        </div>
                    `).join('');
                    return `
                        <div class="form-response-step">
                            <span class="form-response-step-badge">Paso ${stepNum}</span>
                            ${fieldsHTML}
                        </div>
                    `;
                }).join('');

                formResponsesHTML = `
                    <div class="participant-form-responses">
                        <div class="form-responses-header">
                            <span class="form-responses-icon">📝</span>
                            <span class="form-responses-title">Respuestas del formulario:</span>
                        </div>
                        <div class="form-responses-content">
                            ${responsesContent}
                        </div>
                    </div>
                `;
            }

            const donationAmountHTML = (isDonation && p.blue_cost)
                ? `<span class="participant-donation-amount">+${formatBalance(p.blue_cost)} BLUE</span>`
                : '';

            return `
                <li class="participant-item ${p.form_responses ? 'has-responses' : ''}">
                    <div class="participant-info">
                        <strong>${participantNameHTML}</strong>
                        <span class="rating-display">${ratingHTML}</span>
                        ${donationAmountHTML}
                        ${acceptedAtHTML}
                    </div>
                    <div class="participant-status">
                        <span class="status-badge ${p.status}">${statusText}</span>
                        ${actionButtons}
                    </div>
                    ${formResponsesHTML}
                </li>
            `;
        }).join('');

        return `
            <div class="detail-participants-section">
                <h2>Participantes</h2>
                <ul class="participants-list">
                    ${participantsList}
                </ul>
            </div>
        `;
    }

    function formatDateTime(dateString) {
        const date = new Date(dateString);
        const options = {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('es-ES', options);
    }

    function getActionAndMessageHTML(pub, isExpired, blueLabel = 'BLUE') {
        const currentUser = storedUsername;
        const isDonation = pub.category === 'donation';

        // Quick sale logic
        if (pub.is_quick_sale) {
            let messageHTML = '';
            let actionHTML = '';

            if (isExpired) {
                messageHTML = `<div class="status-info">Esta Venta Rápida ha expirado.</div>`;
                return { messageHTML, actionHTML };
            }

            const isAuthor = currentUser === pub.author_username;
            const isTargetedBuyer = currentUser === pub.target_username;
            const isPublicSale = !pub.target_username;

            if (isAuthor) {
                const publicationUrl = `${window.location.origin}/publication-detail.html?id=${pub.id}`;
                actionHTML = `
                    <div class="qr-code-container">
                        <h2>Comparte este QR para recibir tu pago</h2>
                        <p>El enlace de pago es válido por 5 minutos desde su creación.</p>
                        <div id="qrCodeOutput_detail"></div>
                        <input type="text" id="qrCodeUrl_detail" value="${publicationUrl}" readonly>
                        <button id="copyQrCodeUrl_detail" class="action-button">Copiar Enlace</button>
                    </div>
                `;
                setTimeout(() => {
                    if (typeof QRCode !== 'undefined') {
                        new QRCode(document.getElementById("qrCodeOutput_detail"), {
                            text: publicationUrl,
                            width: 200,
                            height: 200
                        });
                    }
                    document.getElementById('copyQrCodeUrl_detail')?.addEventListener('click', () => {
                        const urlInput = document.getElementById('qrCodeUrl_detail');
                        urlInput.select();
                        document.execCommand('copy');
                        showCustomAlert('¡Enlace copiado al portapapeles!');
                    });
                }, 100);

            } else if (isTargetedBuyer || (isPublicSale && !isAuthor)) {
                messageHTML = `<div class="action-message">Estás a punto de pagar <strong>${formatBalance(pub.blue_cost)} ${blueLabel}</strong> a <strong>${pub.author_username}</strong>.</div>`;
                actionHTML = `<button class="action-button confirm" data-action="pay-quick-sale">Pagar Ahora</button>`;
            } else {
                messageHTML = `<div class="status-info">No tienes permiso para ver o actuar en esta venta.</div>`;
            }
            return { messageHTML, actionHTML, acceptButtonHTML: '', duplicateCompleteButtonHTML: '' };
        }

        // Normal publication logic
        const userStatus = pub.user_acceptance_status;
        let messageHTML = '';
        let actionHTML = '';
        let acceptButtonHTML = '';
        let duplicateCompleteButtonHTML = '';

        if (currentUser === pub.author_username) {
            const hasActiveParticipants = pub.participants.some(p => ['approved', 'completed'].includes(p.status));
            const allParticipantsPaid = pub.participants.every(p => p.status === 'confirmed_paid');
            const canDelete = !hasActiveParticipants;
            const canManagePause = !allParticipantsPaid && !isExpired;

            if (pub.participants.length === 0 && !isExpired) {
                messageHTML = `<div class="status-pending">Aún no hay solicitudes para esta tarea.</div>`;
            }

            if (canManagePause) {
                actionHTML += `<button class="action-button pause" data-action="toggle-pause">${pub.is_paused ? 'Reanudar Solicitudes' : 'Pausar Solicitudes'}</button>`;
            }
            actionHTML += `<button class="action-button delete" data-action="delete" ${canDelete ? '' : 'disabled'}>Eliminar Tarea</button>`;

            if (!canDelete) {
                messageHTML += `<div class="status-info">No puedes eliminar una tarea con participantes activos.</div>`;
            }

        } else {
            if (isExpired) {
                messageHTML = `<div class="status-info">Esta tarea ha expirado y ya no acepta nuevos participantes.</div>`;
                return { messageHTML, actionHTML, acceptButtonHTML };
            }

            if (isDonation) {
                // FLUJO ESPECIAL DE DONACIÓN EN DETALLE
                acceptButtonHTML = `
                    <div class="donation-detail-flow">
                        <div class="donation-input-group">
                            <input type="number" step="any" placeholder="Monto a donar" class="donation-input" id="detail-don-input" min="1">
                            <button class="donation-btn detail-don-btn" data-action="direct-donation">Donar Ahora</button>
                        </div>
                    </div>
                `;
            } else {
                const verb = pub.is_sell_post ? 'Comprar' : 'Aceptar Tarea';
                const action = pub.is_sell_post ? 'comprado' : 'realizado';

                switch (userStatus) {
                    case 'pending_approval':
                        messageHTML = `<div class="status-pending">Tu solicitud ha sido enviada. Esperando aprobación del autor.</div>`;
                        break;
                    case 'approved': {
                        const completeLabel = pub.is_sell_post ? 'He Recibido, Pagar' : 'He culminado';
                        acceptButtonHTML = `
                            <div class="detail-primary-actions">
                                <span class="detail-primary-note">¡Has sido aprobado! Ahora puedes proceder a realizar la tarea.</span>
                                <button class="action-button complete" data-action="complete">${completeLabel}</button>
                            </div>
                        `;
                        duplicateCompleteButtonHTML = `<button class="action-button complete" data-action="complete">${completeLabel}</button>`;
                        break;
                    }
                    case 'completed':
                        messageHTML = `<p class="action-message status-pending">Has marcado la tarea como ${action}. Esperando confirmación final del autor.</p>`;
                        break;
                    case 'confirmed_paid':
                        // No se muestra mensaje — el usuario ya completó el flujo y no necesita feedback redundante
                        if (pub.available_slots > 0) {
                            acceptButtonHTML = `<button class="action-button accept" data-action="accept">${verb} de nuevo</button>`;
                        }
                        break;
                    case 'not_participating':
                    default:
                        if (pub.available_slots > 0 && !pub.is_paused) {
                            acceptButtonHTML = `<button class="action-button accept" data-action="accept">${verb}</button>`;
                        } else if (pub.is_paused) {
                            messageHTML = `<div class="status-pending">El autor ha pausado las nuevas solicitudes para esta tarea.</div>`;
                        } else {
                            messageHTML = `<div class="status-accepted">Todos los cupos para esta tarea están llenos.</div>`;
                        }
                        break;
                }
            }
        }
        return { messageHTML, actionHTML, acceptButtonHTML, duplicateCompleteButtonHTML };
    }

    function getExpirationStatusHTML(pub) {
        if (!pub.expires_at) {
            return { html: '', isExpired: false };
        }

        const now = new Date();
        const expirationDate = new Date(pub.expires_at);
        const diff = expirationDate - now;

        if (diff <= 0) {
            return {
                html: `<span class="expiration-info expired"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Expirada</span>`,
                isExpired: true
            };
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        let timeLeft = '';
        if (days > 1) timeLeft = `Vence en ${days} días`;
        else if (days === 1) timeLeft = `Vence en ${days} día`;
        else if (hours > 1) timeLeft = `Vence en ${hours} horas`;
        else if (hours === 1) timeLeft = `Vence en ${hours} hora`;
        else if (minutes > 0) timeLeft = `Vence en ${minutes} min`;
        else timeLeft = `Vence en <1 min`;

        return {
            html: `<span class="expiration-info"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${timeLeft}</span>`,
            isExpired: false
        };
    }

    // --- Función para recopilar respuestas del formulario dinámico ---
    function collectFormResponses() {
        const formResponses = {};
        const formContainers = document.querySelectorAll('.step-form-container');

        formContainers.forEach((container) => {
            const stepNum = container.getAttribute('data-step');
            const inputs = container.querySelectorAll('.step-form-input');

            if (inputs.length > 0) {
                formResponses[stepNum] = {};
                inputs.forEach((input) => {
                    const field = input.getAttribute('data-field');
                    const value = input.value.trim();
                    if (field && value) {
                        formResponses[stepNum][field] = value;
                    }
                });

                // Si no hay respuestas para este paso, eliminarlo
                if (Object.keys(formResponses[stepNum]).length === 0) {
                    delete formResponses[stepNum];
                }
            }
        });

        return formResponses;
    }

    // --- Event Handlers ---
    function setupEventListeners() {
        elements.content.addEventListener('click', handleActionClick);
        elements.ratingForm.addEventListener('submit', handleRatingSubmit);

        const closeRatingBtn = elements.ratingModal.querySelector('.rating-close-button');
        if (closeRatingBtn) {
            closeRatingBtn.addEventListener('click', () => elements.ratingModal.style.display = 'none');
        }
        window.addEventListener('click', (event) => {
            if (event.target == elements.ratingModal) {
                elements.ratingModal.style.display = 'none';
            }
        });
    }

    async function handleActionClick(event) {
        const button = event.target.closest('[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const userInAction = button.dataset.user;

        let endpoint, body = {}, method = 'POST';

        switch (action) {
            case 'pay-quick-sale':
                showCustomConfirm(`¿Confirmas el pago de ${document.querySelector('.detail-cost-badge').innerText} a ${document.querySelector('.detail-meta strong').innerText}?`, async () => {
                    endpoint = `/api/quick-sale/${publicationId}/pay`;
                    body = { buyerUsername: storedUsername };
                    await fetchFromServer(endpoint, 'POST', body);
                });
                return;
            case 'accept':
                endpoint = `/publications/${publicationId}/accept`;
                body = { acceptorUsername: storedUsername };
                break;
            case 'direct-donation': {
                const amountInput = document.getElementById('detail-don-input');
                const amount = parseFloat(amountInput?.value);
                if (!amount || amount <= 0 || isNaN(amount)) {
                    showCustomAlert('Indica un monto válido para donar.');
                    return;
                }
                const author = document.querySelector('.detail-meta strong').textContent.trim();
                showCustomConfirm(`¿Deseas donar ${amount} BLUE a ${author}?\n\nRecuerda que esto generará deuda RED en tu cuenta.`, async () => {
                    await fetchFromServer(`/publications/${publicationId}/accept`, 'POST', {
                        acceptorUsername: storedUsername,
                        donationAmount: amount
                    });
                });
                return;
            }
            case 'approve':
                endpoint = `/publications/${publicationId}/approve`;
                body = { approverUsername: storedUsername, userToApprove: userInAction };
                break;
            case 'complete':
                endpoint = `/publications/${publicationId}/complete`;
                // Recopilar respuestas del formulario si existen
                const formResponses = collectFormResponses();
                body = { completerUsername: storedUsername };
                // Validar que todos los campos requeridos estén completos
                const requiredFields = document.querySelectorAll('.step-form-input[required]');
                if (requiredFields.length > 0) {
                    let allFilled = true;
                    requiredFields.forEach(input => {
                        if (!input.value.trim()) {
                            allFilled = false;
                            input.classList.add('input-error');
                        } else {
                            input.classList.remove('input-error');
                        }
                    });
                    if (!allFilled) {
                        showCustomAlert('Por favor, completa todos los campos requeridos antes de marcar como culminada.');
                        return;
                    }
                }
                if (formResponses && Object.keys(formResponses).length > 0) {
                    body.formResponses = formResponses;
                }
                break;
            case 'confirm-payment':
                const authorUsername = document.querySelector('.detail-meta strong a')?.innerText || document.querySelector('.detail-meta strong')?.innerText;
                await confirmPaymentAndRate(publicationId, authorUsername, userInAction);
                return;
            case 'delete':
                showCustomConfirm('¿Deseas eliminar esta tarea? Esta acción no se puede deshacer.', async () => {
                    await fetchFromServer(`/publications/${publicationId}`, 'DELETE', { deleterUsername: storedUsername });
                    window.location.href = 'contract_interaction.html';
                });
                return;
            case 'discard':
                showCustomConfirm(`¿Seguro que quieres descartar la solicitud de ${userInAction}?`, async () => {
                    await fetchFromServer(`/publications/${publicationId}/discard`, 'POST', { discarderUsername: storedUsername, userToDiscard: userInAction });
                });
                return;
            case 'toggle-pause':
                endpoint = `/publications/${publicationId}/toggle-pause`;
                body = { username: storedUsername };
                break;
            case 'share':
                await sharePublication();
                return;
            default:
                return;
        }

        await fetchFromServer(endpoint, method, body);
    }

    async function sharePublication() {
        try {
            const pubContent = document.getElementById('publication-content');
            const title = pubContent.querySelector('.detail-title').textContent;
            const author = pubContent.querySelector('.detail-meta strong').textContent;

            const publicationUrl = window.location.href;

            const textToShare = `Hola!
Te comparto esta publicacion,te puede ser util

"${title}" por ${author}
Puedes ver los detalles aquí:
${publicationUrl}`;

            if (navigator.share) {
                await navigator.share({
                    title: `Tarea en WintonCoin: ${title}`,
                    text: textToShare,
                    url: publicationUrl,
                });
                showCustomAlert('¡Gracias por compartir!');
            } else {
                await navigator.clipboard.writeText(textToShare);
                showCustomAlert('¡Mensaje para compartir copiado al portapapeles!');
            }

        } catch (error) {
            console.error('Error al compartir la publicación:', error);
            showCustomAlert(error.message || 'Ocurrió un error al intentar compartir.');
        }
    }

    async function confirmPaymentAndRate(pubId, authorUsername, acceptorUsername) {
        try {
            const result = await fetchFromServer(`/publications/${pubId}/confirm-payment`, 'POST', { confirmerUsername: storedUsername, workerUsername: acceptorUsername });
            if (result) {
                openRatingModal(pubId, authorUsername, acceptorUsername);
            }
        } catch (error) {
            // Error already shown in fetchFromServer
        }
    }

    async function handleRatingSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const body = Object.fromEntries(formData.entries());
        try {
            await fetchFromServer('/rate', 'POST', body);
            elements.ratingModal.style.display = 'none';
        } catch (error) {
            // Error already shown in fetchFromServer
        }
    }

    // --- Generic Server Request ---
    async function fetchFromServer(endpoint, method = 'POST', body = null) {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (storedToken) {
                headers['Authorization'] = 'Bearer ' + storedToken;
            }
            const options = {
                method,
                headers,
            };
            if (body) {
                options.body = JSON.stringify(body);
            }
            const response = await fetch(`${API_URL}${endpoint}`, options);

            const responseText = await response.text();
            let result;

            try {
                result = JSON.parse(responseText);
            } catch (e) {
                console.error("Respuesta no-JSON del servidor:", responseText);
                showCustomAlert(responseText || `Error inesperado del servidor.`);
                throw new Error("Respuesta no-JSON del servidor");
            }

            if (!response.ok) {
                showCustomAlert(result.message || `Error en el servidor: ${response.status}`);
                throw new Error(result.message);
            }

            if (result.message) {
                showCustomAlert(result.message);
            }

            initializePage();
            return result;

        } catch (error) {
            console.error(`Error en fetchFromServer (${endpoint}):`, error);
            return null;
        }
    }

    // --- Rendering Helpers ---
    function formatBalance(value) {
        const num = Number(value) || 0;
        const formattedString = num.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
        const parts = formattedString.split(',');
        if (parts.length === 2) return `${parts[0]},<span class="decimal-part">${parts[1]}</span>`;
        return formattedString;
    }

    function getStatusText(status) {
        const statusMap = {
            'open': 'Abierta', 'pending_approval': 'Pendiente', 'approved': 'Aprobado',
            'completed': 'Culminado', 'confirmed_paid': 'Pagado'
        };
        return statusMap[status] || status;
    }

    function generateStarRating(rating, count) {
        if (count === 0) return '<span class="no-rating">Sin calificaciones</span>';
        const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
        return `<span class="stars" title="${parseFloat(rating).toFixed(1)} de 5">${stars}</span> <span class="rating-count">(${count})</span>`;
    }

    function openRatingModal(publicationId, raterUsername, rateeUsername) {
        elements.ratingForm.reset();
        elements.ratingPublicationId.value = publicationId;
        elements.ratingRaterUsername.value = raterUsername;
        elements.ratingRateeUsername.value = rateeUsername;
        elements.ratingModalTitle.textContent = `Calificar a ${rateeUsername}`;
        elements.ratingModal.style.display = 'flex';
    }
});
