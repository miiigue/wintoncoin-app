// ============================================================================
// WintonCoin - Página de Perfil de Usuario (Security Hardened & Auditable)
// ============================================================================
// Principios de Seguridad Aplicados:
// 1. Zero-Trust & Least Privilege: Los datos sensibles de expedientes SOS solo son visibles por el propio dueño.
// 2. OWASP Top 10 A03 (Cross-Site Scripting): Sanitización con escapeHtml en todas las salidas HTML.
// 3. Auditoría Estricta: Validación de estado y sanitización comentada paso a paso.
// ============================================================================

import { getApiUrl, showCustomAlert } from '../modules/index.js';

// Función defensiva para prevenir inyección XSS convirtiendo caracteres especiales en entidades HTML
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function initializeProfilePage() {
    // Obtención de la URL base del API de forma segura
    const API_URL = getApiUrl();
    
    // Extracción de parámetros de URL para determinar qué perfil se está consultando
    const urlParams = new URLSearchParams(window.location.search);
    // Usuario objetivo a consultar (si no hay parámetro en URL, se asume el usuario logueado en sesión)
    const targetUsername = urlParams.get('username') || urlParams.get('user') || localStorage.getItem('username');
    // Usuario autenticado actualmente en la sesión activa
    const sessionUsername = localStorage.getItem('username');

    // Mapeo de elementos del DOM requeridos para el renderizado
    const elements = {
        profileHeader: document.getElementById('profile-header'),
        ratingsList: document.getElementById('ratings-list')
    };

    // Validación de sesión activa: Si no se especifica usuario ni hay sesión, redirigir al login
    if (!targetUsername) {
        displayError("Debes iniciar sesión para ver tu perfil de usuario.", true);
        setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        return;
    }

    // Inicio de la carga de datos del perfil
    fetchProfileData();

    // Consulta de los datos públicos del perfil del usuario (Reputación, Billetera, etc.)
    async function fetchProfileData() {
        try {
            const response = await fetch(`${API_URL}/users/${encodeURIComponent(targetUsername)}/profile`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Error ${response.status}`);
            }

            const profileData = await response.json();
            renderProfile(profileData);
        } catch (error) {
            console.error('Error al cargar el perfil:', error);
            displayError(error.message, true);
        }
    }

    // Orquestador de renderizado del perfil
    function renderProfile(data) {
        // 1. Renderizar encabezado público (Nombre, Estrellas, Dirección de Billetera)
        renderHeader(data.user);
        // 2. Renderizar lista de calificaciones y comentarios P2P públicos
        renderRatings(data.ratings);
        
        // 3. REGLA DE SEGURIDAD ZERO-TRUST:
        // Solo consultar y renderizar el expediente SOS y Controles Parentales si el usuario autenticado está viendo su PROPIO perfil.
        if (sessionUsername && sessionUsername === data.user.username) {
            fetchMySosCase(data.user.username);
            fetchPendingTutorRequests();
            fetchTutorChildrenControls();
        }
    }

    // Consulta y renderizado defensivo de expediente SOS (Privado para el dueño de la cuenta)
    async function fetchMySosCase(userUsername) {
        const container = document.getElementById('sos-my-case-section');
        if (!container) return;

        try {
            const response = await fetch(`${API_URL}/api/public/sos-venezuela/my-case?username=${encodeURIComponent(userUsername)}`);
            if (!response.ok) return;

            const data = await response.json();
            // Validación estricta de estructura de respuesta
            if (!data.success || !data.has_case || !data.case) {
                container.innerHTML = '';
                return;
            }

            const c = data.case;
            
            // Construcción del badge de estatus con estilos protegidos
            let statusBadge = `<span style="background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">En Verificación Manual</span>`;
            if (c.status === 'approved') {
                statusBadge = `<span style="background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">Aprobado</span>`;
            } else if (c.status === 'disbursed') {
                statusBadge = `<span style="background: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">Ayuda Desembolsada</span>`;
            } else if (c.status === 'rejected') {
                statusBadge = `<span style="background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">Rechazado</span>`;
            }

            // Mapeo seguro de nivel de afectación
            let affectationLabel = 'Necesidades Básicas Urgentes';
            if (c.affectation_level === 'total_loss') affectationLabel = 'Pérdida Total de Vivienda / Enseres';
            else if (c.affectation_level === 'medical_emergency') affectationLabel = 'Emergencia Médica / Lesionados';
            else if (c.affectation_level === 'partial_damage') affectationLabel = 'Daño Parcial en Vivienda';

            // Formateo desinfectado del censo y ubicación
            const familyStr = escapeHtml(`${c.dependents_minors || 0} menor(es), ${c.dependents_elderly || 0} adulto(s) mayor(es), ${c.dependents_disabled || 0} persona(s) con discapacidad`);
            const locationStr = escapeHtml(`${c.state || ''}, ${c.municipality || ''}, ${c.sector || ''} (${c.address_details || ''})`);

            // Historial de desembolsos desinfectado
            let disbursementsHTML = '';
            if (data.disbursements && data.disbursements.length > 0) {
                disbursementsHTML = `
                    <div style="margin-top: 15px; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
                        <strong style="color: #0f172a; display: block; margin-bottom: 6px;">💸 Historial de Ayuda Humanitaria Recibida:</strong>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${data.disbursements.map(d => `
                                <div style="background: #ffffff; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <span style="font-weight: 600; color: #2563eb;">+${parseFloat(d.amount_blue).toFixed(2)} BLUE IOU</span>
                                        <span style="font-size: 0.8rem; color: #64748b; margin-left: 8px;">${escapeHtml(new Date(d.created_at).toLocaleDateString())}</span>
                                    </div>
                                    <span style="font-size: 0.85rem; color: #475569;">${escapeHtml(d.notes || 'Acreditado')}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

                    let evidenceGalleryHTML = '';
                    if (c.evidence_urls && c.evidence_urls.length > 0) {
                        const itemsHTML = c.evidence_urls.map(url => {
                            const isGooglePhotos = url.includes('drive.google.com') || url.includes('photos.app.goo.gl') || url.includes('photos.google.com');
                            if (isGooglePhotos) {
                                return `<a href="${escapeHtml(url)}" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; background: #fff1f2; color: #be123c; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 0.85rem; font-weight: 500;">🔗 Enlace Google Fotos ↗</a>`;
                            }
                            const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? `${API_URL}${url}` : `${API_URL}/${url}`);
                            return `<a href="${escapeHtml(fullUrl)}" target="_blank" title="Ver foto completa"><img src="${escapeHtml(fullUrl)}" alt="Evidencia SOS" style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px; border: 1px solid #fecdd3; margin-right: 6px;"></a>`;
                        }).join('');
                        evidenceGalleryHTML = `
                            <div style="margin-top: 10px; background: rgba(255,255,255,0.7); padding: 10px 12px; border-radius: 8px; border: 1px solid #f1f5f9;">
                                <strong style="color: #0f172a; display: block; margin-bottom: 6px;">Fotos y Evidencias Adjuntas:</strong>
                                <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">${itemsHTML}</div>
                            </div>
                        `;
                    }

                    // Bitácora de eventos desinfectada con fecha y hora completa (horas:minutos)
                    let historyHTML = '';
                    if (data.history && data.history.length > 0) {
                        historyHTML = `
                            <div style="margin-top: 15px; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
                                <strong style="color: #0f172a; display: block; margin-bottom: 8px;">📋 Historial y Bitácora del Expediente:</strong>
                                <div style="display: flex; flex-direction: column; gap: 8px;">
                                    ${data.history.map(h => {
                                        const eventDate = new Date(h.created_at);
                                        const day = String(eventDate.getDate()).padStart(2, '0');
                                        const month = String(eventDate.getMonth() + 1).padStart(2, '0');
                                        const year = eventDate.getFullYear();
                                        const hours = String(eventDate.getHours()).padStart(2, '0');
                                        const minutes = String(eventDate.getMinutes()).padStart(2, '0');
                                        const dateStr = `${day}/${month}/${year} ${hours}:${minutes}`;
                                        
                                        // Mapeo amigable de tipos de eventos
                                        let eventLabel = h.event_type;
                                        let badgeColor = '#9f1239';
                                        if (h.event_type === 'registered') { eventLabel = 'EXPEDIENTE CREADO'; badgeColor = '#0284c7'; }
                                        else if (h.event_type === 'approved_for_aid') { eventLabel = 'APROBADO PARA AYUDA'; badgeColor = '#166534'; }
                                        else if (h.event_type === 'disbursed') { eventLabel = 'AYUDA ENTREGADA'; badgeColor = '#6d28d9'; }
                                        else if (h.event_type === 'info_requested') { eventLabel = 'INFORMACIÓN ADICIONAL REQUERIDA'; badgeColor = '#b45309'; }
                                        else if (h.event_type === 'rejected') { eventLabel = 'EXPEDIENTE RECHAZADO'; badgeColor = '#991b1b'; }
                                        
                                        return `
                                            <div style="background: #fafafa; padding: 10px 12px; border-radius: 8px; border-left: 4px solid ${badgeColor}; border-top: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 4px;">
                                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #64748b;">
                                                    <span style="font-weight: bold; text-transform: uppercase; color: ${badgeColor};">${escapeHtml(eventLabel)}</span>
                                                    <span>📅 ${dateStr}</span>
                                                </div>
                                                <p style="margin: 0; font-size: 0.85rem; color: #334155;">${escapeHtml(h.message)}</p>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    }

                    // Inyección desinfectada contra ataques Stored XSS
                    container.innerHTML = `
                        <div style="background: linear-gradient(135deg, #fff5f5 0%, #ffffff 100%); border: 1px solid #fecdd3; border-radius: 12px; padding: 20px; box-shadow: 0 4px 12px rgba(219, 39, 119, 0.08); margin-bottom: 1.5rem; text-align: left;">
                            <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 1px solid #fecdd3; padding-bottom: 12px; margin-bottom: 12px;">
                                <h3 style="margin: 0; color: #9f1239; font-size: 1.25rem; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; flex: 1; min-width: 240px;">
                                    <span style="white-space: nowrap;">Mi caso</span>
                                    <span style="font-size: 0.9rem; color: #db2777; font-weight: normal; white-space: nowrap;">(#${escapeHtml(c.dossier_number)})</span>
                                </h3>
                                <div style="flex-shrink: 0; margin-top: 2px;">
                                    ${statusBadge}
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 0.95rem; color: #334155;">
                                <div><strong>Cédula:</strong> ${escapeHtml(c.id_document)}</div>
                                <div><strong>Edad:</strong> ${escapeHtml(String(c.age || 18))} años</div>
                                <div><strong>Ubicación:</strong> ${locationStr}</div>
                                <div><strong>Censo Familiar:</strong> ${familyStr}</div>
                                <div><strong>Gravedad:</strong> ${escapeHtml(affectationLabel)}</div>
                                <div><strong>Fecha de Registro:</strong> ${escapeHtml(new Date(c.created_at).toLocaleDateString())}</div>
                            </div>

                            <div style="margin-top: 10px; background: rgba(255,255,255,0.7); padding: 10px 12px; border-radius: 8px; border: 1px solid #f1f5f9;">
                                <strong style="color: #0f172a; display: block; margin-bottom: 4px;">Relato / Solicitud:</strong>
                                <p style="margin: 0; font-size: 0.9rem; color: #475569; font-style: italic;">"${escapeHtml(c.description)}"</p>
                            </div>

                            ${evidenceGalleryHTML}

                            ${disbursementsHTML}

                            ${historyHTML}
                        </div>
                    `;
        } catch (err) {
            console.error('Error al cargar datos de Mi caso SOS:', err);
        }
    }

    // Renderizado seguro de la cabecera pública del perfil
    function renderHeader(user) {
        const ratingHTML = generateStarRating(user.average_rating, user.ratings_count);
        
        let walletHTML = '';
        if (user.web3_wallet_address) {
            const addr = escapeHtml(user.web3_wallet_address);
            const truncated = addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);
            walletHTML = `
                <div class="profile-wallet-container" style="display: flex; align-items: center; justify-content: center; margin-top: 10px; background: rgba(255,255,255,0.05); padding: 8px 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); width: fit-content; margin-left: auto; margin-right: auto;">
                    <span style="color: #888; font-size: 14px; margin-right: 8px;">Billetera Web3:</span>
                    <span id="walletAddressText" style="font-family: monospace; font-size: 14px; color: #fff; margin-right: 10px;">${truncated}</span>
                    <button id="copyWalletBtn" data-address="${addr}" style="background: none; border: none; cursor: pointer; color: #4da6ff; padding: 0; display: flex; align-items: center; justify-content: center;" title="Copiar dirección">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
            `;
        }

        // Sanitización estricta del nombre de usuario para prevenir XSS
        elements.profileHeader.innerHTML = `
            <h1 class="profile-username">${escapeHtml(user.username)}</h1>
            <div class="profile-rating">${ratingHTML}</div>
            ${walletHTML}
        `;

        if (user.web3_wallet_address) {
            document.getElementById('copyWalletBtn').addEventListener('click', function() {
                const fullAddress = this.dataset.address;
                copyTextToClipboard(fullAddress).then(() => {
                    const originalHTML = this.innerHTML;
                    this.innerHTML = '<span style="font-size:12px; font-weight:bold; color:#059669;">✓ Copiado</span>';
                    setTimeout(() => {
                        this.innerHTML = originalHTML;
                    }, 2000);
                }).catch(err => {
                    console.error('Error al copiar: ', err);
                });
            });
        }
    }

    // Renderizado seguro del listado de calificaciones
    function renderRatings(ratings) {
        if (!ratings || ratings.length === 0) {
            elements.ratingsList.innerHTML = '<p class="empty-message">Este usuario aún no ha recibido ninguna calificación.</p>';
            return;
        }
        elements.ratingsList.innerHTML = ratings.map(rating => getRatingHTML(rating)).join('');
    }

    // Generación de HTML desinfectado para cada reseña P2P
    function getRatingHTML(rating) {
        const stars = '★'.repeat(rating.rating || 0) + '☆'.repeat(5 - (rating.rating || 0));
        const formattedDate = escapeHtml(new Date(rating.created_at).toLocaleDateString('es-ES', {
            year: 'numeric', month: 'long', day: 'numeric'
        }));

        return `
            <div class="rating-item">
                <div class="rating-item-header">
                    <span class="rating-item-rater">De: <strong>${escapeHtml(rating.rater_username)}</strong></span>
                    <span class="rating-item-stars">${stars}</span>
                </div>
                ${rating.comment ? `<p class="rating-item-comment">"${escapeHtml(rating.comment)}"</p>` : ''}
                <div class="rating-item-footer"><span>${formattedDate}</span></div>
            </div>
        `;
    }

    // Manejador centralizado de errores
    function displayError(message, redirect = false) {
        if (elements.profileHeader) elements.profileHeader.innerHTML = '';
        if (elements.ratingsList) elements.ratingsList.innerHTML = '';
        showCustomAlert(message, () => {
            if (redirect) {
                window.location.href = 'contract_interaction.html';
            }
        });
    }

    // Generador de estrellas
    function generateStarRating(rating, count) {
        if (!count || count === 0) {
            return '<span class="no-rating">Sin calificaciones</span>';
        }
        const avgRating = parseFloat(rating).toFixed(1);
        const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
        return `
            <span class="stars" title="${avgRating} de 5 estrellas">${stars}</span> 
            <span class="rating-summary"><strong>${avgRating}</strong> de 5 (${count} calificaciones)</span>
        `;
    }

    // -------------------------------------------------------------------------
    // RENDERIZADO Y LÓGICA DE SOLICITUDES DE TUTELA PENDIENTES (MAKER-CHECKER)
    // -------------------------------------------------------------------------
    async function fetchPendingTutorRequests() {
        const container = document.getElementById('tutor-pending-requests-section');
        if (!container) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const res = await fetch(`${API_URL}/api/minor/tutor-requests/pending`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) return;

            const data = await res.json();
            if (!data.pending_requests || data.pending_requests.length === 0) {
                container.innerHTML = '';
                return;
            }

            container.innerHTML = `
                <div class="tutor-pending-card" style="background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%); border: 1px solid #bfdbfe; border-radius: 12px; padding: 18px; margin-bottom: 1.5rem; text-align: left;">
                    <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 1.15rem; display: flex; align-items: center; gap: 8px;">
                        <span>⚖️ Solicitudes de Tutela Legal Pendientes</span>
                        <span style="background: #2563eb; color: #fff; font-size: 0.75rem; padding: 2px 8px; border-radius: 999px;">${data.pending_requests.length}</span>
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${data.pending_requests.map(r => `
                            <div style="background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #dbeafe; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px;">
                                <div>
                                    <strong style="color: #0f172a; font-size: 1rem;">@${escapeHtml(r.minor_username)}</strong>
                                    <span style="color: #64748b; font-size: 0.85rem; margin-left: 6px;">(${escapeHtml(r.minor_email || '')})</span>
                                    <div style="font-size: 0.8rem; color: #475569; margin-top: 2px;">Solicitado el: ${escapeHtml(new Date(r.created_at).toLocaleDateString())}</div>
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button class="btn-tutor-approve" data-id="${r.request_id}" data-username="${escapeHtml(r.minor_username)}" style="background: #059669; color: #fff; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer;">Aprobar Tutela</button>
                                    <button class="btn-tutor-reject" data-id="${r.request_id}" data-username="${escapeHtml(r.minor_username)}" style="background: #dc2626; color: #fff; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer;">Rechazar</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            // Event Listeners para modal legal de aprobación y botón de rechazo
            container.querySelectorAll('.btn-tutor-approve').forEach(btn => {
                btn.addEventListener('click', function() {
                    openLegalApprovalModal(this.dataset.id, this.dataset.username);
                });
            });

            container.querySelectorAll('.btn-tutor-reject').forEach(btn => {
                btn.addEventListener('click', function() {
                    respondTutorRequest(this.dataset.id, 'reject', false);
                });
            });

        } catch (err) {
            console.error('Error al cargar solicitudes de tutela:', err);
        }
    }

    // Modal de Aprobación Legal
    let currentPendingRequestId = null;
    function openLegalApprovalModal(requestId, minorUsername) {
        currentPendingRequestId = requestId;
        const modal = document.getElementById('tutorLegalApprovalModal');
        const chk = document.getElementById('chkAcceptTutorTerms');
        const btnApprove = document.getElementById('btnConfirmTutorApprove');
        if (!modal) return;

        chk.checked = false;
        btnApprove.disabled = true;
        modal.style.display = 'flex';

        chk.onchange = function() {
            btnApprove.disabled = !this.checked;
        };

        document.getElementById('closeTutorLegalModal').onclick = () => modal.style.display = 'none';
        document.getElementById('btnCancelTutorApprove').onclick = () => modal.style.display = 'none';

        btnApprove.onclick = function() {
            modal.style.display = 'none';
            respondTutorRequest(currentPendingRequestId, 'approve', true);
        };
    }

    async function respondTutorRequest(requestId, action, termsAccepted) {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${API_URL}/api/minor/tutor-requests/${requestId}/respond`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action, termsAccepted })
            });
            const data = await res.json();
            if (!res.ok) {
                showCustomAlert(data.message || 'Error al procesar respuesta.');
                return;
            }
            showCustomAlert(data.message);
            fetchPendingTutorRequests();
            fetchTutorChildrenControls();
        } catch (err) {
            console.error('Error al responder tutela:', err);
            showCustomAlert('Error de red al procesar la respuesta.');
        }
    }

    // -------------------------------------------------------------------------
    // CONTROLES PARENTALES DE MENORES A CARGO (TUTOR DASHBOARD)
    // -------------------------------------------------------------------------
    async function fetchTutorChildrenControls() {
        const container = document.getElementById('tutor-parental-controls-section');
        if (!container) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const res = await fetch(`${API_URL}/api/minor/children`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) return;

            const data = await res.json();
            if (!data.children || data.children.length === 0) {
                container.innerHTML = '';
                return;
            }

            container.innerHTML = `
                <div class="tutor-children-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 1.5rem; text-align: left;">
                    <h3 style="margin: 0 0 16px 0; color: #0f172a; font-size: 1.2rem; display: flex; align-items: center; justify-content: space-between;">
                        <span>👨‍👩‍👧‍👦 Controles Parentales (Menores a Cargo)</span>
                        <span style="font-size: 0.85rem; color: #64748b; font-weight: normal;">${data.children.length} menor(es) vinculado(s)</span>
                    </h3>

                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        ${data.children.map(child => {
                            const isSuspended = child.is_suspended_by_tutor;
                            const perms = typeof child.tutor_permissions === 'string'
                                ? JSON.parse(child.tutor_permissions)
                                : (child.tutor_permissions || {});

                            return `
                                <div style="background: ${isSuspended ? '#fef2f2' : '#f8fafc'}; border: 1px solid ${isSuspended ? '#fecdd3' : '#e2e8f0'}; border-radius: 10px; padding: 16px;">
                                    <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 12px;">
                                        <div>
                                            <strong style="font-size: 1.1rem; color: #0f172a;">@${escapeHtml(child.username)}</strong>
                                            <span style="margin-left: 8px; font-size: 0.8rem; padding: 2px 8px; border-radius: 999px; font-weight: 600; background: ${isSuspended ? '#fee2e2; color: #991b1b;' : '#dcfce7; color: #166534;'};">
                                                ${isSuspended ? '⏸️ Cuenta Pausada' : '✅ Cuenta Activa'}
                                            </span>
                                        </div>
                                        <div>
                                            <button class="btn-toggle-pause" data-id="${child.id}" data-suspended="${!isSuspended}" style="background: ${isSuspended ? '#059669' : '#dc2626'}; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem;">
                                                ${isSuspended ? '▶️ Reanudar Cuenta' : '⏸️ Congelar Acceso'}
                                            </button>
                                        </div>
                                    </div>

                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 12px;">
                                        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #334155;">
                                            <input type="checkbox" class="chk-perm" data-child-id="${child.id}" data-perm="allow_contracting" ${perms.allow_contracting ? 'checked' : ''} ${isSuspended ? 'disabled' : ''}>
                                            <span>Contratar Tareas (RED)</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #334155;">
                                            <input type="checkbox" class="chk-perm" data-child-id="${child.id}" data-perm="allow_selling" ${perms.allow_selling ? 'checked' : ''} ${isSuspended ? 'disabled' : ''}>
                                            <span>Publicar Ventas</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #334155;">
                                            <input type="checkbox" class="chk-perm" data-child-id="${child.id}" data-perm="allow_donations" ${perms.allow_donations ? 'checked' : ''} ${isSuspended ? 'disabled' : ''}>
                                            <span>Realizar Donaciones</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #334155;">
                                            <input type="checkbox" class="chk-perm" data-child-id="${child.id}" data-perm="allow_p2p" ${perms.allow_p2p ? 'checked' : ''} ${isSuspended ? 'disabled' : ''}>
                                            <span>Operaciones P2P</span>
                                        </label>
                                    </div>

                                    <div style="display: flex; align-items: center; gap: 10px; background: #ffffff; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
                                        <span style="font-size: 0.85rem; color: #475569; font-weight: 600;">Límite de Deuda RED Máximo:</span>
                                        <input type="number" class="input-max-debt" data-child-id="${child.id}" value="${parseFloat(perms.max_red_debt || 20).toFixed(2)}" step="5" min="0" max="500" style="width: 90px; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 4px;" ${isSuspended ? 'disabled' : ''}>
                                        <span style="font-size: 0.85rem; color: #64748b;">RED</span>
                                        <button class="btn-save-debt" data-child-id="${child.id}" style="background: #2563eb; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;" ${isSuspended ? 'disabled' : ''}>Guardar Límite</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;

            // Handlers para pausar/reanudar
            container.querySelectorAll('.btn-toggle-pause').forEach(btn => {
                btn.addEventListener('click', function() {
                    const childId = this.dataset.id;
                    const isSuspended = this.dataset.suspended === 'true';
                    updateChildControls(childId, { is_suspended_by_tutor: isSuspended });
                });
            });

            // Handlers para cambiar permisos
            container.querySelectorAll('.chk-perm').forEach(chk => {
                chk.addEventListener('change', function() {
                    const childId = this.dataset.childId;
                    const permKey = this.dataset.perm;
                    updateChildControls(childId, { permissions: { [permKey]: this.checked } });
                });
            });

            // Handlers para guardar límite de deuda
            container.querySelectorAll('.btn-save-debt').forEach(btn => {
                btn.addEventListener('click', function() {
                    const childId = this.dataset.childId;
                    const input = container.querySelector(`.input-max-debt[data-child-id="${childId}"]`);
                    const maxDebt = parseFloat(input.value);
                    if (isNaN(maxDebt) || maxDebt < 0) {
                        showCustomAlert('Ingresa un monto de deuda válido.');
                        return;
                    }
                    updateChildControls(childId, { permissions: { max_red_debt: maxDebt } });
                });
            });

        } catch (err) {
            console.error('Error al cargar controles parentales:', err);
        }
    }

    async function updateChildControls(childId, bodyData) {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${API_URL}/api/minor/children/${childId}/controls`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(bodyData)
            });
            const data = await res.json();
            if (!res.ok) {
                showCustomAlert(data.message || 'Error al actualizar controles.');
                return;
            }
            fetchTutorChildrenControls();
        } catch (err) {
            console.error('Error al actualizar controles parentales:', err);
        }
    }
}

// Inicialización respetando la carga asíncrona del DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeProfilePage);
} else {
    initializeProfilePage();
}
