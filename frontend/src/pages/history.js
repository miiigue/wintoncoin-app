// ============================================================================
// WintonCoin - Página de Historial
// ============================================================================

import { getApiUrl, showCustomAlert, showCustomConfirm, linkify } from '../modules/index.js';

function initializeHistoryPage() {
    const API_URL = getApiUrl();
    const storedUsername = localStorage.getItem('username');
    const authoredById = new Map();
    
    const elements = {
        historyUsername: document.getElementById('historyUsername'),
        authoredList: document.getElementById('authored-publications-list'),
        completedList: document.getElementById('completed-publications-list'),
    };

    if (!storedUsername) {
        showCustomAlert('Debes iniciar sesión para ver tu historial.', () => {
            window.location.href = 'index.html';
        });
        return;
    }

    elements.historyUsername.textContent = `Historial para ${storedUsername}`;
    setupTabSelector(); // [UX] Inicializar el selector de pestañas
    fetchHistory();

    async function fetchHistory() {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const response = await fetch(`${API_URL}/api/me/history`, { headers });
            if (!response.ok) {
                throw new Error('No se pudo cargar el historial.');
            }
            const history = await response.json();
            renderAuthoredPublications(history.authored);
            renderCompletedPublications(history.completed);
            renderDonations(history.donations || []); // [Auditoría] Renderizar historial de donaciones realizadas
        } catch (error) {
            console.error('Error al cargar el historial:', error);
            elements.authoredList.innerHTML = '<p class="error-message">Error al cargar tus publicaciones.</p>';
            elements.completedList.innerHTML = '<p class="error-message">Error al cargar tus tareas completadas.</p>';
            const donationsContainer = document.getElementById('donations-list');
            if (donationsContainer) {
                donationsContainer.innerHTML = '<p class="error-message">Error al cargar tus donaciones.</p>';
            }
        }
    }

    function renderAuthoredPublications(publications) {
        elements.authoredList.innerHTML = '';
        if (publications.length === 0) {
            elements.authoredList.innerHTML = `<p>No has creado ninguna publicación todavía.</p>`;
            return;
        }

        publications.forEach(pub => {
            // [Seguridad / Control de ID] Evitar colisión de IDs guardando en el mapa
            // únicamente aquellas publicaciones comerciales. Las causas no tienen participantes.
            if (!pub.is_humanitarian) {
                authoredById.set(String(pub.id), pub);
            }
            const item = document.createElement('div');
            item.className = 'publication-item history-item';
            item.innerHTML = getAuthoredPublicationHTML(pub);
            elements.authoredList.appendChild(item);
            
            // [Rendimiento / Lógica] Solo obtener participantes para tareas comerciales.
            // Las causas humanitarias no poseen el flujo tradicional de participantes/trabajadores.
            if (!pub.is_humanitarian) {
                fetchAndRenderParticipants(pub.id);
            }
        });
    }

    async function fetchAndRenderParticipants(pubId) {
        try {
            const response = await fetch(`${API_URL}/publications/${pubId}/participants`);
            const participants = await response.json();
            const container = document.querySelector(`.participants-list[data-pub-id="${pubId}"]`);
            
            if (!container) return;

            if (participants.length === 0) {
                container.innerHTML = '<li class="no-participants">Aún no hay participantes para esta tarea.</li>';
                return;
            }

            container.innerHTML = participants.map(p => getParticipantHTML(pubId, p)).join('');
        } catch (error) {
            console.error(`Error cargando participantes para la pub ${pubId}:`, error);
        }
    }

    function renderCompletedPublications(publications) {
        elements.completedList.innerHTML = '';
        if (publications.length === 0) {
            elements.completedList.innerHTML = `<p>No has completado ninguna tarea todavía.</p>`;
            return;
        }

        publications.forEach(pub => {
            const item = document.createElement('div');
            item.className = 'publication-item history-item';
            item.innerHTML = getCompletedPublicationHTML(pub);
            elements.completedList.appendChild(item);
        });
    }

    function getAuthoredPublicationHTML(pub) {
        const badgesHTML = getPublicationBadgesHTML(pub, { view: 'authored' });
        
        // [Lógica / Presentación] Renderizado premium y específico para causas humanitarias
        if (pub.is_humanitarian) {
            return `
                <h3><a href="causa-solidaria.html?id=${pub.id}" class="profile-link" style="color: #a5b4fc; text-decoration: underline; font-weight: bold;">${escapeHtml(pub.title)}</a></h3>
                <div class="history-badges">${badgesHTML}</div>
                <p class="pub-description">${linkify(pub.description || '')}</p>
                <div class="humanitarian-progress-summary" style="margin-top: 12px; font-size: 0.85em; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.03); display: flex; flex-direction: column; gap: 4px; border: 1px solid rgba(255,255,255,0.08);">
                    <div style="display:flex; justify-content:space-between;">
                        <span>Meta de Recaudación:</span>
                        <strong>${formatBalance(pub.blue_cost)} BLUE IOU</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>Recaudado Disponible:</span>
                        <strong style="color: #e83e8c;">${formatBalance(pub.current_amount || 0)} BLUE IOU</strong>
                    </div>
                </div>
            `;
        }

        return `
            <h3>${pub.title}</h3>
            <div class="history-badges">${badgesHTML}</div>
            <p class="pub-description">${linkify(pub.description)}</p>
            <div class="participants-section">
                <h4>Participantes</h4>
                <ul class="participants-list" data-pub-id="${pub.id}"><li class="loading-participants">Cargando...</li></ul>
            </div>
        `;
    }

    function getParticipantHTML(pubId, participant) {
        const rating = generateStarRating(participant.average_rating, participant.ratings_count);
        const statusText = getStatusText(participant.status);
        let actionButton = '';
        const pub = authoredById.get(String(pubId));
        const isPubDeleted = !!pub?.is_deleted;
        const paymentInfo = getPaymentDirectionText(pub, participant);

        const participantNameHTML = window.appSettings?.public_profiles_enabled
            ? `<a href="profile.html?user=${participant.acceptor_username}" class="profile-link">${participant.acceptor_username}</a>`
            : participant.acceptor_username;

        if (!isPubDeleted) {
            if (participant.status === 'pending_approval') {
                actionButton = `<button class="action-button approve" data-pub-id="${pubId}" data-user-to-approve="${participant.acceptor_username}">Aprobar</button>`;
            } else if (participant.status === 'completed') {
                actionButton = `<button class="action-button confirm" data-pub-id="${pubId}" data-worker-username="${participant.acceptor_username}">Confirmar Pago</button>`;
            }
        }
        
        return `
            <li class="participant-item">
                <div class="participant-info">
                    <strong>${participantNameHTML}</strong>
                    <span class="rating-display">${rating}</span>
                </div>
                <div class="participant-status">
                    <span class="status-badge ${participant.status}">${statusText}</span>
                    ${actionButton}
                </div>
                ${paymentInfo}
            </li>
        `;
    }

    function getCompletedPublicationHTML(pub) {
        const statusText = getStatusText(pub.user_acceptance_status);
        const badgesHTML = getPublicationBadgesHTML(pub, { view: 'completed' });
        const paymentInfo = getCompletedPaymentDirectionText(pub);
        const formResponsesHTML = getFormResponsesHTML(pub.form_responses);

        const authorNameHTML = window.appSettings?.public_profiles_enabled
            ? `<a href="profile.html?user=${pub.author_username}" class="profile-link">${pub.author_username}</a>`
            : pub.author_username;

        return `
            <div class="publication-details">
                <h3>${pub.title}</h3>
                <div class="history-badges">${badgesHTML}</div>
                <p class="pub-description">${linkify(pub.description)}</p>
                ${formResponsesHTML}
                <ul class="pub-meta-list">
                    <li>Autor: <strong>${authorNameHTML}</strong></li>
                    <li>Costo: <strong>${formatBalance(pub.blue_cost)} BLUE</strong></li>
                    <li>Estado: <span class="status-badge ${pub.user_acceptance_status}">${statusText}</span></li>
                </ul>
                ${paymentInfo}
            </div>
        `;
    }
    
    function formatBalance(value) {
        const num = Number(value) || 0;
        const formattedString = num.toLocaleString('es-ES', {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4
        });
        const parts = formattedString.split(',');
        if (parts.length === 2) {
            return `${parts[0]},<span class="decimal-part">${parts[1]}</span>`;
        }
        return formattedString;
    }

    function getStatusText(status) {
        const statusMap = {
            'open': 'Abierta',
            'pending_approval': 'Pendiente de Aprobación',
            'approved': 'Aprobada',
            'completed': 'Culminada',
            'confirmed_paid': 'Finalizada y Pagada'
        };
        return statusMap[status] || status;
    }

    function getFormResponsesHTML(formResponses) {
        if (!formResponses || Object.keys(formResponses).length === 0) return '';
        const itemsHTML = Object.entries(formResponses)
            .flatMap(([, fields]) => Object.entries(fields || {}))
            .map(([fieldName, value]) => `
                <div class="history-form-item">
                    <span class="history-form-label">${escapeHtml(fieldName)}:</span>
                    <span class="history-form-value">${escapeHtml(value)}</span>
                </div>
            `).join('');

        if (!itemsHTML) return '';

        return `
            <div class="history-form-responses">
                <h4>Tus respuestas</h4>
                <div class="history-form-grid">
                    ${itemsHTML}
                </div>
            </div>
        `;
    }

    function getPublicationBadgesHTML(pub, { view }) {
        const badges = [];

        // [Lógica / Presentación] Gestión de badges con diseño premium para causas solidarias
        if (pub.is_humanitarian) {
            const statusMap = {
                'pending': '<span class="status-badge pending" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24;">PENDIENTE</span>',
                'approved': '<span class="status-badge active" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399;">ACTIVA</span>',
                'rejected': '<span class="status-badge rejected" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171;">RECHAZADA</span>',
                'completed': '<span class="status-badge completed" style="background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); color: #60a5fa;">CULMINADA</span>'
            };
            badges.push(statusMap[pub.status] || `<span class="status-badge">${pub.status.toUpperCase()}</span>`);
            return badges.join(' ');
        }

        const isDeleted = !!pub.is_deleted || !!pub.deleted_at;
        const isExpired = !!pub.is_expired || (pub.expires_at && new Date(pub.expires_at) < new Date());
        const isCompletedPublication = !!pub.is_completed_publication;
        const isPaused = !!pub.is_paused;

        if (isExpired) badges.push(`<span class="status-badge expired">EXPIRADA</span>`);
        else if (isCompletedPublication) badges.push(`<span class="status-badge completed">COMPLETADA</span>`);
        else if (isPaused) badges.push(`<span class="status-badge pausada">PAUSADA</span>`);
        else badges.push(`<span class="status-badge active">ACTIVA</span>`);

        return badges.join(' ');
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getPaymentDirectionText(pub, participant) {
        if (!pub || pub.category !== 'request') return '';
        if (participant.status !== 'confirmed_paid') return '';
        const author = escapeHtml(pub.author_username || '');
        const worker = escapeHtml(participant.acceptor_username || '');
        return `<div class="payment-direction"><small>Pago aplicado: BLUE → ${worker} | RED → ${author}</small></div>`;
    }

    function getCompletedPaymentDirectionText(pub) {
        if (!pub || pub.category !== 'request') return '';
        if (pub.user_acceptance_status !== 'confirmed_paid') return '';
        const author = escapeHtml(pub.author_username || '');
        const worker = escapeHtml(storedUsername || '');
        return `<div class="payment-direction"><small>Pago aplicado: BLUE → ${worker} | RED → ${author}</small></div>`;
    }

    function generateStarRating(rating, count) {
        if (count === 0) return '<span class="no-rating">Sin calif.</span>';
        const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
        return `<span class="stars" title="${parseFloat(rating).toFixed(1)} de 5">${stars}</span> <span class="rating-count">(${count})</span>`;
    }

    // Event listeners para acciones
    elements.authoredList.addEventListener('click', async (event) => {
        const button = event.target;
        const pubId = button.dataset.pubId;

        if (button.classList.contains('approve')) {
            const userToApprove = button.dataset.userToApprove;
            await postToServer(`/publications/${pubId}/approve`, { approverUsername: storedUsername, userToApprove });
        }
        
        if (button.classList.contains('confirm')) {
            const workerUsername = button.dataset.workerUsername;
            await postToServer(`/publications/${pubId}/confirm-payment`, { confirmerUsername: storedUsername, workerUsername });
        }
    });

    async function postToServer(endpoint, body) {
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });
            const result = await response.json();
            showCustomAlert(result.message);
            if (response.ok) fetchHistory();
        } catch (error) {
            showCustomAlert('Error de red al realizar la acción.');
        }
    }

    // ============================================================================
    // SISTEMA DE PESTAÑAS (TAB SELECTOR)
    // ============================================================================
    // Controla la interactividad del selector de pestañas en el frontend
    // de manera responsiva y fluida, evitando scroll excesivo.
    // ============================================================================
    function setupTabSelector() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        const tabsContainer = document.querySelector('.history-tabs');

        // [UX / Desktop] Traducir scroll vertical a desplazamiento horizontal en la barra de pestañas.
        // Se deshabilita el comportamiento pasivo (passive: false) para permitir que evt.preventDefault() funcione,
        // y se normaliza el scroll del mouse (deltaMode) para evitar scroll extremadamente lento en Windows/Chrome.
        if (tabsContainer) {
            tabsContainer.addEventListener('wheel', (evt) => {
                if (evt.deltaY === 0) return;
                evt.preventDefault(); // Evitar desplazamiento vertical nativo de la página
                
                // Normalización de desplazamiento según el tipo de delta (píxeles, líneas o páginas)
                let scrollAmount = 0;
                if (evt.deltaMode === 1) { // Modo de desplazamiento por líneas (común en ratones estándar en Windows)
                    scrollAmount = evt.deltaY * 33; // Multiplicar por una altura estimada de línea (33px)
                } else if (evt.deltaMode === 2) { // Modo de desplazamiento por páginas completas
                    scrollAmount = evt.deltaY * tabsContainer.clientWidth;
                } else { // Modo de desplazamiento por píxeles directos
                    scrollAmount = evt.deltaY;
                }
                
                tabsContainer.scrollLeft += scrollAmount;
            }, { passive: false });
        }

        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;

                // Actualizar estado activo en botones
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Cambiar visibilidad y activar micro-animaciones
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `tab-${targetTab}`) {
                        content.style.display = 'block';
                        // Retardo mínimo para forzar el reflujo del navegador y disparar transición CSS
                        setTimeout(() => {
                            content.classList.add('active');
                        }, 20);
                    } else {
                        content.style.display = 'none';
                    }
                });
            });
        });
        
        // Inicializar estados de visualización para que solo cargue la pestaña activa
        tabContents.forEach(content => {
            if (content.classList.contains('active')) {
                content.style.display = 'block';
            } else {
                content.style.display = 'none';
            }
        });
    }

    // ============================================================================
    // RENDIMIENTO Y RENDERIZADO: Donaciones Realizadas
    // ============================================================================
    // Renderiza la lista de donaciones hechas por el usuario con badges de
    // estado contable y enlace de historia.
    // ============================================================================
    function renderDonations(donations) {
        const listContainer = document.getElementById('donations-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';

        if (donations.length === 0) {
            listContainer.innerHTML = `<p>No has realizado ninguna donación todavía.</p>`;
            return;
        }

        donations.forEach(d => {
            const item = document.createElement('div');
            item.className = 'publication-item history-item';
            item.innerHTML = getDonationHTML(d);
            listContainer.appendChild(item);
        });
    }

    function getDonationHTML(d) {
        // [Auditoría] Mapear los badges del estado contable de la donación
        let donationStatusBadge = '';
        if (d.donation_status === 'on_hold') {
            donationStatusBadge = '<span class="status-badge pending" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24;">EN ESPERA POR KYC</span>';
        } else if (d.donation_status === 'released') {
            donationStatusBadge = '<span class="status-badge active" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399;">ACREDITADA</span>';
        } else if (d.donation_status === 'refunded') {
            donationStatusBadge = '<span class="status-badge rejected" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171;">REEMBOLSADA</span>';
        } else {
            donationStatusBadge = `<span class="status-badge">${d.donation_status.toUpperCase()}</span>`;
        }

        // [Auditoría] Mapear los badges del estado de la causa solidaria
        let causeStatusBadge = '';
        const causeStatus = String(d.cause_status).toLowerCase();
        if (causeStatus === 'pending') {
            causeStatusBadge = '<span class="status-badge pending" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); color: rgba(251, 191, 36, 0.8); font-size: 0.75em;">Causa Pendiente</span>';
        } else if (causeStatus === 'approved') {
            causeStatusBadge = '<span class="status-badge active" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); color: rgba(52, 211, 153, 0.8); font-size: 0.75em;">Causa Activa</span>';
        } else if (causeStatus === 'completed') {
            causeStatusBadge = '<span class="status-badge completed" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); color: rgba(96, 165, 250, 0.8); font-size: 0.75em;">Causa Culminada</span>';
        } else if (causeStatus === 'rejected') {
            causeStatusBadge = '<span class="status-badge rejected" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: rgba(248, 113, 113, 0.8); font-size: 0.75em;">Causa Rechazada</span>';
        }

        // Formatear fecha y hora
        const dateObj = new Date(d.donation_created_at);
        const formattedDate = dateObj.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) + ' a las ' + dateObj.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        }) + ' hs';

        return `
            <h3><a href="causa-solidaria.html?id=${d.cause_id}" class="profile-link" style="color: #a5b4fc; text-decoration: underline; font-weight: bold;">${escapeHtml(d.cause_title)}</a></h3>
            <div class="history-badges" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
                ${donationStatusBadge}
                ${causeStatusBadge}
            </div>
            <ul class="pub-meta-list" style="margin-top:12px; font-size:0.85em; color:rgba(255,255,255,0.7); display:flex; flex-direction:column; gap:4px;">
                <li>Monto Donado: <strong style="color:#e83e8c;">${formatBalance(d.amount)} BLUE IOU</strong></li>
                <li>Fecha de Donación: <strong>${formattedDate}</strong></li>
                <li>Creador de la Causa: <strong>@${escapeHtml(d.creator_username)}</strong></li>
            </ul>
        `;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHistoryPage);
} else {
    initializeHistoryPage();
}

export { initializeHistoryPage };
