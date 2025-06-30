document.addEventListener('DOMContentLoaded', () => {

    // Lógica para determinar la URL del API automáticamente
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';

    // --- Estado y Elementos del DOM ---
    const storedUsername = sessionStorage.getItem('username');
    const elements = {
        historyUsername: document.getElementById('historyUsername'),
        authoredList: document.getElementById('authored-publications-list'),
        completedList: document.getElementById('completed-publications-list'),
    };

    // --- Inicialización ---
    if (!storedUsername) {
        showCustomAlert('Debes iniciar sesión para ver tu historial.', () => {
            window.location.href = 'index.html';
        });
        return;
    }

    elements.historyUsername.textContent = `Historial para ${storedUsername}`;
    fetchHistory();

    // --- Lógica de Datos ---
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

    // --- LÓGICA PARA PUBLICACIONES CREADAS (VISTA DE AUTOR) ---
    function renderAuthoredPublications(publications) {
        elements.authoredList.innerHTML = '';
        if (publications.length === 0) {
            elements.authoredList.innerHTML = `<p>No has creado ninguna publicación todavía.</p>`;
            return;
        }

        publications.forEach(pub => {
            const item = document.createElement('div');
            item.className = 'publication-item history-item';
            // Se inyecta un placeholder para los participantes, que se llenará de forma asíncrona
            item.innerHTML = getAuthoredPublicationHTML(pub);
            elements.authoredList.appendChild(item);
            
            // Ahora, buscamos la lista de participantes para esta publicación
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

    // --- LÓGICA PARA TAREAS COMPLETADAS (VISTA DE TRABAJADOR) ---
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

    // --- HTML TEMPLATES ---
    function getAuthoredPublicationHTML(pub) {
        return `
            <h3>${pub.title}</h3>
            <p class="pub-description">${pub.description}</p>
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

        // Lógica de enlace de perfil
        const participantNameHTML = window.appSettings.public_profiles_enabled
            ? `<a href="profile.html?user=${participant.acceptor_username}" class="profile-link">${participant.acceptor_username}</a>`
            : participant.acceptor_username;

        if (participant.status === 'pending_approval') {
            actionButton = `<button class="action-button approve" data-pub-id="${pubId}" data-user-to-approve="${participant.acceptor_username}">Aprobar</button>`;
        } else if (participant.status === 'completed') {
            actionButton = `<button class="action-button confirm" data-pub-id="${pubId}" data-worker-username="${participant.acceptor_username}">Confirmar Pago</button>`;
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
            </li>
        `;
    }

    function getCompletedPublicationHTML(pub) {
        const statusText = getStatusText(pub.user_acceptance_status);

        // Lógica de enlace de perfil
        const authorNameHTML = window.appSettings.public_profiles_enabled
            ? `<a href="profile.html?user=${pub.author_username}" class="profile-link">${pub.author_username}</a>`
            : pub.author_username;

        return `
            <div class="publication-details">
                <h3>${pub.title}</h3>
                <p class="pub-description">${pub.description}</p>
                <ul class="pub-meta-list">
                    <li>Autor: <strong>${authorNameHTML}</strong></li>
                    <li>Costo: <strong>${pub.blue_cost} BLUE</strong></li>
                    <li>Estado: <span class="status-badge ${pub.user_acceptance_status}">${statusText}</span></li>
                </ul>
            </div>
            <div class="publication-actions">
                <button class="action-button hide" data-pub-id="${pub.id}">Ocultar del Historial</button>
            </div>
        `;
    }
    
    // --- HELPERS ---
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

    function generateStarRating(rating, count) {
        if (count === 0) return '<span class="no-rating">Sin calif.</span>';
        const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
        return `<span class="stars" title="${parseFloat(rating).toFixed(1)} de 5">${stars}</span> <span class="rating-count">(${count})</span>`;
    }

    // --- MANEJO DE ACCIONES ---
    elements.authoredList.addEventListener('click', async (event) => {
        const button = event.target;
        const pubId = button.dataset.pubId;

        if (button.classList.contains('approve')) {
            const userToApprove = button.dataset.userToApprove;
            await postToServer(`/publications/${pubId}/approve`, { approverUsername: storedUsername, userToApprove });
        }
        
        if (button.classList.contains('confirm')) {
            const workerUsername = button.dataset.workerUsername;
            // Aquí podríamos reusar la lógica de interaction.js para confirmar y calificar, 
            // pero por simplicidad, solo confirmamos el pago.
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
            if (response.ok) fetchHistory(); // Recargar todo el historial para reflejar cambios
        } catch (error) {
            console.error('Error en postToServer:', error);
            showCustomAlert('Error de red al realizar la acción.');
        }
    }
}); 