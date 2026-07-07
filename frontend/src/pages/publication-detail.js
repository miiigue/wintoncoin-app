/**
 * Publication Detail Page Module
 * Handles viewing and interacting with a single publication
 */

import { getApiUrl, showCustomAlert, showCustomConfirm, linkify, escapeHtml, escapeAttr, fetchAndStoreAppSettings, appSettings } from '../modules/index.js';

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

            const userParam = storedUsername ? `?user=${storedUsername}` : '';
            const publicationPromise = fetch(`${API_URL}/api/publications/${publicationId}${userParam}`);

            const [_, platformSettings, publicationResponse] = await Promise.all([settingsPromise, platformSettingsPromise, publicationPromise]);

            if (!publicationResponse.ok) {
                const errorData = await publicationResponse.json();
                throw new Error(errorData.message || 'Error al cargar la publicación.');
            }

            const publication = await publicationResponse.json();

            // --- REDIRECCIÓN DE ONBOARDING PARA INVITADOS ---
            // Si el visitante es un invitado (no autenticado), procedemos de la siguiente manera:
            if (!storedUsername || !storedToken) {
                const currentPath = 'publication-detail.html' + window.location.search;
                if (publication.category === 'donation') {
                    // Campaña de Donación: Redirigir al registro inyectando el código de referido del beneficiario
                    const refParam = publication.beneficiary_referral_code ? `&ref=${encodeURIComponent(publication.beneficiary_referral_code)}` : '';
                    window.location.href = `register.html?returnTo=${encodeURIComponent(currentPath)}${refParam}`;
                    return;
                } else {
                    // Otra publicación: Redirigir al registro estándar
                    window.location.href = `register.html?returnTo=${encodeURIComponent(currentPath)}`;
                    return;
                }
            }

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
        if (platformSettings?.pre_launch_mode_enabled) {
            return 'BLUE IOU';
        }
        return 'BLUE';
    }

    function renderPublication(pub, platformSettings) {
        const isDonation = pub.category === 'donation';
        const authorRatingHTML = generateStarRating(pub.author_average_rating, pub.author_ratings_count);

        // XSS Prevention: escapar username antes de insertar en HTML
        const safeAuthor = escapeHtml(pub.author_username);
        const authorNameHTML = appSettings.public_profiles_enabled
            ? `<a href="profile.html?user=${encodeURIComponent(pub.author_username)}" class="profile-link">${safeAuthor}</a>`
            : safeAuthor;

        let beneficiaryHTML = '';
        if (isDonation && pub.beneficiary_username) {
            const safeBeneficiary = escapeHtml(pub.beneficiary_username);
            const beneficiaryLinkHTML = appSettings.public_profiles_enabled
                ? `<a href="profile.html?user=${encodeURIComponent(pub.beneficiary_username)}" class="profile-link">@${safeBeneficiary}</a>`
                : `@${safeBeneficiary}`;
            beneficiaryHTML = `<div class="detail-beneficiary" style="margin-top: 8px; font-size: 0.95rem; color: #e83e8c;">🎁 Campaña a beneficio de: <strong>${beneficiaryLinkHTML}</strong></div>`;
        }

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
            ? `<div class="donation-meta-badge-detail">Meta: ${formatBalance(pub.goal_amount)} ${blueLabel}</div>`
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
                        <span><strong>${formatBalance(current)}</strong> recaudados de ${formatBalance(goal)} ${blueLabel}</span>
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
                <h1 class="detail-title">${escapeHtml(pub.title)}</h1>
                <div class="detail-meta">
                    Publicado por <strong>${authorNameHTML}</strong> ${authorRatingHTML}
                    <span class="detail-date">el ${new Date(pub.created_at).toLocaleDateString()}</span>
                    ${expirationInfo.html}
                </div>
                ${beneficiaryHTML}
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

    // ──────────────────────────────────────────────────────────
    // renderStepFlow: Renderiza el flujo de pasos con formularios dinámicos
    // ──────────────────────────────────────────────────────────
    // Soporta dos formatos de form_fields (retrocompatible):
    //   - Legacy:  {"1": ["Campo 1", "Campo 2"]}           → todos como input text
    //   - Nuevo:   {"1": [{label:"Campo 1", type:"textarea"}, {label:"Campo 2", type:"text"}]}
    // Seguridad:
    //   - Todos los labels se escapan con escapeHtml (previene XSS)
    //   - Los data-attributes se escapan con escapeAttr (previene inyección de atributos)
    //   - textarea tiene maxlength=5000 (coincide con límite del backend)
    //   - input text tiene maxlength=1000 (previene payload oversize)
    // ──────────────────────────────────────────────────────────
    function renderStepFlow(steps, formFields = null, userStatus = null) {
        if (!steps || steps.length === 0) return '';

        const itemsHTML = steps.map((step, index) => {
            const stepNum = index + 1;
            const stepNumStr = String(stepNum);
            const hasFormFields = formFields && formFields[stepNumStr] && formFields[stepNumStr].length > 0;

            let formInputsHTML = '';
            if (hasFormFields) {
                const fieldsHTML = formFields[stepNumStr].map((field, fieldIndex) => {
                    // ── Retrocompatibilidad: si el campo es string (formato legacy), convertir a objeto ──
                    const fieldLabel = typeof field === 'string' ? field : (field?.label || `Campo ${fieldIndex + 1}`);
                    const fieldType = (typeof field === 'object' && field?.type === 'textarea') ? 'textarea' : 'text';

                    // ── Renderizar textarea o input según el tipo definido ──
                    if (fieldType === 'textarea') {
                        // textarea: para reportes detallados, descripciones largas, pasos de reproducción
                        return `
                            <div class="step-form-field-user">
                                <label for="form-step-${stepNum}-field-${fieldIndex}">${escapeHtml(fieldLabel)}</label>
                                <textarea 
                                    id="form-step-${stepNum}-field-${fieldIndex}" 
                                    class="step-form-input step-form-textarea" 
                                    data-step="${stepNum}" 
                                    data-field="${escapeAttr(fieldLabel)}"
                                    placeholder="Escribe tu respuesta detallada..." 
                                    maxlength="5000"
                                    rows="4"
                                    required></textarea>
                                <span class="step-form-char-count" data-for="form-step-${stepNum}-field-${fieldIndex}">0 / 5000</span>
                            </div>
                        `;
                    } else {
                        // text: para URLs, respuestas cortas, nombres, Sí/No
                        return `
                            <div class="step-form-field-user">
                                <label for="form-step-${stepNum}-field-${fieldIndex}">${escapeHtml(fieldLabel)}</label>
                                <input type="text" 
                                       id="form-step-${stepNum}-field-${fieldIndex}" 
                                       class="step-form-input" 
                                       data-step="${stepNum}" 
                                       data-field="${escapeAttr(fieldLabel)}"
                                       placeholder="Escribe tu respuesta..." 
                                       maxlength="1000"
                                       required>
                            </div>
                        `;
                    }
                }).join('');

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

        // Determinar si la publicación es de tipo donación para mostrar montos donados
        // Esta variable debe declararse localmente ya que esta función tiene su propio scope
        const isDonation = pub.category === 'donation';

        const participantsList = pub.participants.map(p => {
            const ratingHTML = generateStarRating(p.average_rating, p.ratings_count);
            const statusText = getStatusText(p.status);
            let actionButtons = '';

            const safeParticipant = escapeHtml(p.username);
            const participantNameHTML = appSettings.public_profiles_enabled
                ? `<a href="profile.html?user=${encodeURIComponent(p.username)}" class="profile-link">${safeParticipant}</a>`
                : safeParticipant;

            // Formatear fecha y hora de solicitud
            const acceptedAtHTML = p.accepted_at
                ? `<span class="participant-accepted-at">Solicitó: ${formatDateTime(p.accepted_at)}</span>`
                : '';

            if (p.status === 'pending_approval') {
                actionButtons = `
                    <button class="action-button approve" data-action="approve" data-user="${escapeAttr(p.username)}">Aprobar</button>
                    <button class="action-button discard" data-action="discard" data-user="${escapeAttr(p.username)}">Descartar</button>
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
                    <button class="action-button confirm" data-action="confirm-payment" data-user="${escapeAttr(p.username)}">Confirmar Pago</button>
                `;
            }

            // Mostrar respuestas del formulario si existen
            let formResponsesHTML = '';
            if (p.form_responses && Object.keys(p.form_responses).length > 0) {
                const responsesContent = Object.entries(p.form_responses).map(([stepNum, fields]) => {
                    const fieldsHTML = Object.entries(fields).map(([fieldName, value]) => `
                        <div class="form-response-field">
                            <span class="form-response-label">${escapeHtml(fieldName)}:</span>
                            <span class="form-response-value">${escapeHtml(value)}</span>
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
                messageHTML = `<div class="action-message">Estás a punto de pagar <strong>${formatBalance(pub.blue_cost)} ${blueLabel}</strong> a <strong>${escapeHtml(pub.author_username)}</strong>.</div>`;
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

    // ──────────────────────────────────────────────────────────
    // collectFormResponses: Recopila respuestas de formularios dinámicos
    // ──────────────────────────────────────────────────────────
    // Captura valores tanto de <input> como de <textarea> (ambos usan .step-form-input).
    // Seguridad:
    //   - Solo recopila valores string (typeof check)
    //   - Trunca a 5000 caracteres por valor (defense in depth, coincide con backend)
    //   - Elimina caracteres nulos (seguridad PostgreSQL)
    // ──────────────────────────────────────────────────────────
    function collectFormResponses() {
        const formResponses = {};
        const formContainers = document.querySelectorAll('.step-form-container');
        const MAX_CLIENT_VALUE_LENGTH = 5000; // Coincide con MAX_RESPONSE_VALUE_LENGTH del backend

        formContainers.forEach((container) => {
            const stepNum = container.getAttribute('data-step');
            // Selector captura tanto <input> como <textarea> con la misma clase
            const inputs = container.querySelectorAll('.step-form-input');

            if (inputs.length > 0) {
                formResponses[stepNum] = {};
                inputs.forEach((input) => {
                    const field = input.getAttribute('data-field');
                    // .value funciona tanto para input como para textarea
                    const rawValue = input.value.trim();
                    if (field && rawValue) {
                        // Sanitizar en el frontend también (defense in depth)
                        formResponses[stepNum][field] = rawValue
                            .replace(/\0/g, '')  // Eliminar caracteres nulos
                            .substring(0, MAX_CLIENT_VALUE_LENGTH);
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

    // ── Event listener delegado para contador de caracteres en textareas ──
    // Actualiza el contador en tiempo real para que el usuario sepa cuántos caracteres le quedan.
    // Usa event delegation para capturar textareas renderizados dinámicamente.
    document.addEventListener('input', (event) => {
        if (event.target.classList.contains('step-form-textarea')) {
            const textarea = event.target;
            const maxLen = parseInt(textarea.getAttribute('maxlength'), 10) || 5000;
            const currentLen = textarea.value.length;
            const countSpan = textarea.parentElement.querySelector('.step-form-char-count');
            if (countSpan) {
                countSpan.textContent = `${currentLen} / ${maxLen}`;
                // Visual feedback: cambiar color si se acerca al límite
                if (currentLen > maxLen * 0.9) {
                    countSpan.style.color = '#ff4444'; // Rojo cuando queda <10%
                } else if (currentLen > maxLen * 0.7) {
                    countSpan.style.color = '#ff9800'; // Naranja cuando queda <30%
                } else {
                    countSpan.style.color = ''; // Color por defecto
                }
            }
        }
    });

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
                showCustomConfirm(`¿Deseas donar ${amount} BLUE a ${author}?\n\nRecuerda que esto generará un compromiso de reciprocidad RED equivalente en tu cuenta.`, async () => {
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
                try {
                    const authorUsername = document.querySelector('.detail-meta strong a')?.innerText || document.querySelector('.detail-meta strong')?.innerText;
                    await confirmPaymentAndRate(publicationId, authorUsername, userInAction);
                } catch (err) {
                    showCustomAlert("Error JS: " + err.message);
                }
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

            const baseText = `Hola!
Te comparto esta publicacion,te puede ser util

"${title}" por ${author}
Puedes ver los detalles aquí:`;

            if (navigator.share) {
                // OPTIMIZACIÓN WEB SHARE API: No incluimos la URL dentro de baseText para la llamada nativa,
                // ya que la API del navegador la añadirá automáticamente de forma unificada.
                await navigator.share({
                    title: `Tarea en WintonCoin: ${title}`,
                    text: baseText,
                    url: publicationUrl,
                });
                showCustomAlert('¡Gracias por compartir!');
            } else {
                // FALLBACK ESCRITORIO: Concatenar el texto descriptivo con la URL antes de copiar al portapapeles.
                const fullText = `${baseText}\n${publicationUrl}`;
                await copyTextToClipboard(fullText);
                showCustomAlert('¡Mensaje para compartir copiado al portapapeles!');
            }

        } catch (error) {
            console.error('Error al compartir la publicación:', error);
            // Ignorar de forma silenciosa si el usuario canceló la acción (AbortError)
            if (error.name !== 'AbortError') {
                showCustomAlert(error.message || 'Ocurrió un error al intentar compartir.');
            }
        }
    }

    async function confirmPaymentAndRate(pubId, authorUsername, acceptorUsername) {
        try {
            console.log("DEBUG: Enviando confirm-payment al servidor...", { pubId, authorUsername, acceptorUsername });
            const result = await fetchFromServer(`/publications/${pubId}/confirm-payment`, 'POST', { confirmerUsername: storedUsername, workerUsername: acceptorUsername });
            console.log("DEBUG: Respuesta confirm-payment:", result);
            if (result) {
                openRatingModal(pubId, authorUsername, acceptorUsername);
            } else {
                console.log("DEBUG: result fue nulo, modal no abierto.");
            }
        } catch (error) {
            console.error("DEBUG: Error capturado en confirmPaymentAndRate:", error);
            showCustomAlert("Error inesperado: " + error.message);
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
                // Interceptar bloqueo por Términos y Condiciones pendientes (403 LEGAL_ACCEPTANCE_REQUIRED)
                if (response.status === 403 && result.code === 'LEGAL_ACCEPTANCE_REQUIRED') {
                    return new Promise((resolve, reject) => {
                        window.showLegalAcceptanceModal(
                            result.pending_documents,
                            async (acceptResult) => {
                                console.log('[LEGAL] Términos aceptados desde modal (detalle de tarea). Reintentando...');
                                try {
                                    const retryResult = await fetchFromServer(endpoint, method, body);
                                    resolve(retryResult);
                                } catch (retryErr) {
                                    reject(retryErr);
                                }
                            },
                            () => {
                                reject(new Error('Acción cancelada: Debes aceptar los términos y condiciones vigentes.'));
                            }
                        );
                    });
                }

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
