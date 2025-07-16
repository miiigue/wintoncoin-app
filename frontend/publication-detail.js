document.addEventListener('DOMContentLoaded', () => {

    // --- Configuración y Estado ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';
    
    const storedUsername = sessionStorage.getItem('username');
    const urlParams = new URLSearchParams(window.location.search);
    const publicationId = urlParams.get('id');

    const elements = {
        container: document.getElementById('publication-detail-container'),
        content: document.getElementById('publication-content'),
        // Añadiremos elementos del modal de calificación para que funcione aquí también
        ratingModal: document.getElementById('ratingModal'),
        ratingForm: document.getElementById('ratingForm'),
        ratingModalTitle: document.getElementById('ratingModalTitle'),
        ratingPublicationId: document.getElementById('ratingPublicationId'),
        ratingRaterUsername: document.getElementById('ratingRaterUsername'),
        ratingRateeUsername: document.getElementById('ratingRateeUsername'),
    };

    // --- Inicialización ---
    if (!storedUsername) {
        showCustomAlert('Debes iniciar sesión para ver esta página.', () => { window.location.href = 'index.html'; });
        return;
    }
    if (!publicationId) {
        showCustomAlert('No se ha especificado una publicación.', () => { window.location.href = 'contract_interaction.html'; });
        return;
    }

    fetchAndRenderPublication();
    setupEventListeners();

    // --- Lógica de Datos (Fetch) ---
    async function fetchAndRenderPublication() {
        try {
            const response = await fetch(`${API_URL}/api/publications/${publicationId}?user=${storedUsername}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al cargar la publicación.');
            }
            const publication = await response.json();
            renderPublication(publication);
        } catch (error) {
            console.error('Error al cargar la publicación:', error);
            elements.content.innerHTML = `<p class="error-message">No se pudo cargar la publicación. ${error.message}</p>`;
        }
    }

    // --- Lógica de Renderizado ---
    function renderPublication(pub) {
        const authorRatingHTML = generateStarRating(pub.author_average_rating, pub.author_ratings_count);
        
        // Lógica de enlace de perfil del autor
        const authorNameHTML = window.appSettings.public_profiles_enabled
            ? `<a href="profile.html?user=${pub.author_username}" class="profile-link">${pub.author_username}</a>`
            : pub.author_username;

        const { messageHTML, actionHTML } = getActionAndMessageHTML(pub);

        // Determinamos la clase de la cinta según la categoría de la publicación
        let ribbonClass = '';
        if (pub.category === 'donation') {
            ribbonClass = 'donation-ribbon';
        } else if (pub.is_sell_post) {
            ribbonClass = 'sell-ribbon';
        }

        const publicationHTML = `
            <div class="detail-header">
                <span class="detail-cost-badge ${ribbonClass}">${formatBalance(pub.blue_cost)} BLUE</span>
                <h1 class="detail-title">${pub.title}</h1>
                <div class="detail-meta">
                    Publicado por <strong>${authorNameHTML}</strong> ${authorRatingHTML}
                    <span class="detail-date">el ${new Date(pub.created_at).toLocaleDateString()}</span>
                </div>
            </div>

            <hr>

            <div class="detail-description">
                ${linkify(pub.description)}
            </div>

            <hr>
            
            <div class="detail-actions-section">
                ${messageHTML}
                ${actionHTML}
            </div>

            ${getParticipantsSectionHTML(pub)}
        `;
        elements.content.innerHTML = publicationHTML;
    }
    
    function getParticipantsSectionHTML(pub) {
        // Solo mostramos la sección de participantes si el usuario actual es el autor.
        if (pub.author_username !== storedUsername || !pub.participants || pub.participants.length === 0) {
            return '';
        }
    
        const participantsList = pub.participants.map(p => {
            const ratingHTML = generateStarRating(p.average_rating, p.ratings_count);
            const statusText = getStatusText(p.status);
            let actionButtons = '';
    
            const participantNameHTML = window.appSettings.public_profiles_enabled
                ? `<a href="profile.html?user=${p.username}" class="profile-link">${p.username}</a>`
                : p.username;
    
            if (p.status === 'pending_approval') {
                actionButtons = `
                    <button class="action-button approve" data-action="approve" data-user="${p.username}">Aprobar</button>
                    <button class="action-button discard" data-action="discard" data-user="${p.username}">Descartar</button>
                `;
            } else if (p.status === 'completed') {
                actionButtons = `
                    <button class="action-button confirm" data-action="confirm-payment" data-user="${p.username}">Confirmar Pago</button>
                `;
            }
    
            return `
                <li class="participant-item">
                    <div class="participant-info">
                        <strong>${participantNameHTML}</strong>
                        <span class="rating-display">${ratingHTML}</span>
                    </div>
                    <div class="participant-status">
                        <span class="status-badge ${p.status}">${statusText}</span>
                        ${actionButtons}
                    </div>
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

    function getActionAndMessageHTML(pub) {
        // Esta función es muy similar a la de interaction.js, pero adaptada a la vista de detalle
        // y usando los datos de `pub` que ya están completos.
        const currentUser = storedUsername;
        const userStatus = pub.user_acceptance_status;
        let messageHTML = '';
        let actionHTML = '';

        if (currentUser === pub.author_username) {
            // --- VISTA DEL AUTOR ---
            const hasActiveParticipants = pub.participants.some(p => ['approved', 'completed'].includes(p.status));
            const allParticipantsPaid = pub.participants.every(p => p.status === 'confirmed_paid');
            const canDelete = !hasActiveParticipants;
            const canManagePause = !allParticipantsPaid;

            if (pub.participants.length === 0) {
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
            // --- VISTA DE OTROS USUARIOS ---
            // Determinamos el verbo principal de la acción según la categoría
            let verb;
            if (pub.category === 'donation') {
                verb = 'Donar/Ayudar';
            } else {
                verb = pub.is_sell_post ? 'Comprar' : 'Aceptar Tarea';
            }

            const action = pub.is_sell_post ? 'comprado' : 'realizado';

            switch (userStatus) {
                case 'pending_approval':
                    messageHTML = `<div class="status-pending">Tu solicitud ha sido enviada. Esperando aprobación del autor.</div>`;
                    break;
                case 'approved':
                    messageHTML = `<div class="action-message">¡Has sido aprobado! Ahora puedes proceder.</div>`;
                    actionHTML = `<button class="action-button complete" data-action="complete">${pub.is_sell_post ? 'He Recibido, Pagar' : 'Marcar como Culminada'}</button>`;
                    break;
                case 'completed':
                    messageHTML = `<p class="action-message status-pending">Has marcado la tarea como ${action}. Esperando confirmación final del autor.</p>`;
                    break;
                case 'confirmed_paid':
                    messageHTML = `<p class="action-message status-info">¡Transacción completada!</p>`;
                    if (pub.available_slots > 0) {
                        actionHTML = `<button class="action-button accept" data-action="accept">${verb} de nuevo</button>`;
                    }
                    break;
                case 'not_participating':
                default:
                    if (pub.available_slots > 0 && !pub.is_paused) {
                        actionHTML = `<button class="action-button accept" data-action="accept">${verb}</button>`;
                    } else if (pub.is_paused) {
                        messageHTML = `<div class="status-pending">El autor ha pausado las nuevas solicitudes para esta tarea.</div>`;
                    } else {
                        messageHTML = `<div class="status-accepted">Todos los cupos para esta tarea están llenos.</div>`;
                    }
                    break;
            }
        }
        return { messageHTML, actionHTML };
    }

    // --- Handlers de Eventos ---
    function setupEventListeners() {
        elements.content.addEventListener('click', handleActionClick);
        elements.ratingForm.addEventListener('submit', handleRatingSubmit);
        
        // Cierre del modal de calificación
        const closeRatingBtn = elements.ratingModal.querySelector('.rating-close-button');
        if(closeRatingBtn) {
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
        const userInAction = button.dataset.user; // Para aprobar, descartar, pagar...

        let endpoint, body = {}, method = 'POST';

        switch (action) {
            case 'accept':
                endpoint = `/publications/${publicationId}/accept`;
                body = { acceptorUsername: storedUsername };
                break;
            case 'approve':
                endpoint = `/publications/${publicationId}/approve`;
                body = { approverUsername: storedUsername, userToApprove: userInAction };
                break;
            case 'complete':
                endpoint = `/publications/${publicationId}/complete`;
                body = { completerUsername: storedUsername };
                break;
            case 'confirm-payment':
                // Para este caso, la lógica es más compleja y requiere abrir el modal de calificación
                const authorUsername = document.querySelector('.detail-meta strong a').innerText;
                await confirmPaymentAndRate(publicationId, authorUsername, userInAction);
                return; // Salimos para evitar el postToServer genérico
            case 'delete':
                showCustomConfirm('¿Deseas eliminar esta tarea? Esta acción no se puede deshacer.', async () => {
                    await fetchFromServer(`/publications/${publicationId}`, 'DELETE', { deleterUsername: storedUsername });
                    // Si se elimina, redirigimos
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
            default:
                return;
        }

        await fetchFromServer(endpoint, method, body);
    }
    
    async function confirmPaymentAndRate(pubId, authorUsername, acceptorUsername) {
        try {
            const result = await fetchFromServer(`/publications/${pubId}/confirm-payment`, 'POST', { confirmerUsername: storedUsername, workerUsername: acceptorUsername });
            if (result) {
                // Si el pago es exitoso, abrimos el modal para calificar
                openRatingModal(pubId, authorUsername, acceptorUsername);
            }
        } catch (error) {
            // El error ya se muestra en fetchFromServer
        }
    }

    async function handleRatingSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const body = Object.fromEntries(formData.entries());
        try {
            await fetchFromServer('/rate', 'POST', body);
            elements.ratingModal.style.display = 'none';
        } catch(error) {
            // El error ya se muestra en fetchFromServer
        }
    }

    // --- Función Genérica para Peticiones ---
    async function fetchFromServer(endpoint, method = 'POST', body = null) {
        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' },
            };
            if (body) {
                options.body = JSON.stringify(body);
            }
            const response = await fetch(`${API_URL}${endpoint}`, options);
            const result = await response.json();
            
            if (!response.ok) {
                showCustomAlert(result.message || `Error en el servidor: ${response.status}`);
                throw new Error(result.message);
            }

            if (result.message) {
                showCustomAlert(result.message);
            }
            
            fetchAndRenderPublication(); // Recargar siempre para reflejar el estado más reciente
            return result;

        } catch (error) {
            console.error(`Error en fetchFromServer (${endpoint}):`, error);
            // No mostramos alerta aquí porque ya se hace en el bloque `if (!response.ok)`
            return null; // Devolvemos null para indicar que la operación falló
        }
    }

    // --- Helpers de Renderizado ---
    function formatBalance(value) {
        // ... (código duplicado de otros archivos, se puede refactorizar a utils.js)
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