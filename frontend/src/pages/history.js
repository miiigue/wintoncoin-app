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
    fetchHistory();

    async function fetchHistory() {
        try {
            const response = await fetch(`${API_URL}/users/${storedUsername}/history`);
            if (!response.ok) {
                throw new Error('No se pudo cargar el historial.');
            }
            const history = await response.json();
            renderAuthoredPublications(history.authored);
            renderCompletedPublications(history.completed);
        } catch (error) {
            console.error('Error al cargar el historial:', error);
            elements.authoredList.innerHTML = '<p class="error-message">Error al cargar tus publicaciones.</p>';
            elements.completedList.innerHTML = '<p class="error-message">Error al cargar tus tareas completadas.</p>';
        }
    }

    function renderAuthoredPublications(publications) {
        elements.authoredList.innerHTML = '';
        if (publications.length === 0) {
            elements.authoredList.innerHTML = `<p>No has creado ninguna publicación todavía.</p>`;
            return;
        }

        publications.forEach(pub => {
            authoredById.set(String(pub.id), pub);
            const item = document.createElement('div');
            item.className = 'publication-item history-item';
            item.innerHTML = getAuthoredPublicationHTML(pub);
            elements.authoredList.appendChild(item);
            fetchAndRenderParticipants(pub.id);
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

        const authorNameHTML = window.appSettings?.public_profiles_enabled
            ? `<a href="profile.html?user=${pub.author_username}" class="profile-link">${pub.author_username}</a>`
            : pub.author_username;

        return `
            <div class="publication-details">
                <h3>${pub.title}</h3>
                <div class="history-badges">${badgesHTML}</div>
                <p class="pub-description">${linkify(pub.description)}</p>
                <ul class="pub-meta-list">
                    <li>Autor: <strong>${authorNameHTML}</strong></li>
                    <li>Costo: <strong>${formatBalance(pub.blue_cost)} BLUE</strong></li>
                    <li>Estado: <span class="status-badge ${pub.user_acceptance_status}">${statusText}</span></li>
                </ul>
                ${paymentInfo}
            </div>
            <div class="publication-actions">
                <button class="action-button hide" data-pub-id="${pub.id}">Ocultar del Historial</button>
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

    function getPublicationBadgesHTML(pub, { view }) {
        const badges = [];
        const isDeleted = !!pub.is_deleted || !!pub.deleted_at;
        const isExpired = !!pub.is_expired || (pub.expires_at && new Date(pub.expires_at) < new Date());
        const isCompletedPublication = !!pub.is_completed_publication;
        const isPaused = !!pub.is_paused;

        if (isDeleted) badges.push(`<span class="status-badge deleted">ELIMINADA</span>`);
        else if (isExpired) badges.push(`<span class="status-badge expired">EXPIRADA</span>`);
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

    elements.completedList.addEventListener('click', async (event) => {
        const button = event.target;
        if (button.classList.contains('hide')) {
            const pubId = button.dataset.pubId;
            showCustomConfirm('¿Seguro que quieres ocultar esta tarea de tu historial? No la volverás a ver aquí.', async () => {
                await postToServer(`/publications/${pubId}/hide`, { username: storedUsername });
            });
        }
    });

    async function postToServer(endpoint, body) {
        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await response.json();
            showCustomAlert(result.message);
            if (response.ok) fetchHistory();
        } catch (error) {
            console.error('Error en postToServer:', error);
            showCustomAlert('Error de red al realizar la acción.');
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHistoryPage);
} else {
    initializeHistoryPage();
}

export { initializeHistoryPage };
