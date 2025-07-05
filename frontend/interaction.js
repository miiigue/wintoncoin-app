document.addEventListener('DOMContentLoaded', () => {

    // --- Función de Utilidad para Formatear Saldos ---
    function formatBalance(value) {
        const num = Number(value) || 0;
        // Formato español: separador de miles con punto, decimal con coma.
        const formattedString = num.toLocaleString('es-ES', {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4
        });
        const parts = formattedString.split(',');
        // Si el número tiene decimales, envolvemos la parte decimal en un span para darle estilo.
        if (parts.length === 2) {
            return `${parts[0]},<span class="decimal-part">${parts[1]}</span>`;
        }
        return formattedString;
    }

    // --- Configuración Global ---
    // Lógica para determinar la URL del API automáticamente
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';

    // --- Estado Global y Elementos del DOM ---
    const storedUsername = sessionStorage.getItem('username');
    const elements = {
        usernameDisplay: document.getElementById('usernameDisplay'),
        profileTrigger: document.querySelector('.profile-trigger'),
        profileDropdown: document.getElementById('profileDropdown'),
        notificationTrigger: document.querySelector('.notification-trigger'),
        notificationDropdown: document.getElementById('notificationDropdown'),
        notificationBadge: document.getElementById('notificationBadge'),
        logoutLink: document.getElementById('logoutLink'),
        publicationsList: document.getElementById('publications-list'),
        saldoBlue: document.getElementById('saldoBlue'),
        saldoRed: document.getElementById('saldoRed'),
        burnModal: document.getElementById('burnModal'),
        burnTriggerBtn: document.getElementById('burnTriggerBtn'),
        closeModalBtn: document.querySelector('.close-button'),
        burnForm: document.getElementById('burnForm'),
        burnModalBlue: document.getElementById('burnModalBlue'),
        burnModalRed: document.getElementById('burnModalRed'),
        // --- Elementos para el Modal de Calificación ---
        ratingModal: document.getElementById('ratingModal'),
        ratingForm: document.getElementById('ratingForm'),
        ratingModalTitle: document.getElementById('ratingModalTitle'),
        closeRatingModalBtn: document.querySelector('.rating-close-button'),
        ratingPublicationId: document.getElementById('ratingPublicationId'),
        ratingRaterUsername: document.getElementById('ratingRaterUsername'),
        ratingRateeUsername: document.getElementById('ratingRateeUsername'),
        ratingComment: document.getElementById('ratingComment'),
        // --- Elementos para el Modal de Tipo de Publicación ---
        openPublicationModalBtn: document.getElementById('openPublicationModalBtn'),
        publicationTypeModal: document.getElementById('publicationTypeModal'),
        closePublicationTypeModalBtn: document.querySelector('.publication-type-close'),
        // --- Elementos para el contador de deuda ---
        debtCountdownContainer: document.getElementById('debt-countdown-container'),
        debtCountdownTimer: document.getElementById('debt-countdown-timer'),
        // --- Elementos para el contador de escrow ---
        saldoEscrowBlue: document.getElementById('saldoEscrowBlue'),
        escrowCountdownContainer: document.getElementById('escrow-countdown-container'),
        escrowCountdownTimer: document.getElementById('escrow-countdown-timer')
    };

    // Variable global para el intervalo del contador, para poder detenerlo
    let debtCountdownInterval = null;
    let escrowCountdownInterval = null;

    // --- Lógica de Control de Funcionalidades ---
    // Escuchamos el evento personalizado para actualizar la UI según los permisos
    document.addEventListener('app-settings-loaded', checkPublicationPermissions);

    function checkPublicationPermissions() {
        if (window.appSettings && elements.openPublicationModalBtn) {
            if (window.appSettings.allow_new_publications === false) {
                elements.openPublicationModalBtn.style.display = 'none';
            } else {
                elements.openPublicationModalBtn.style.display = 'inline-block';
            }
        }
    }

    // --- Inicialización ---
    if (!storedUsername) {
        // Ahora, la redirección se pasa como un callback.
        showCustomAlert('Debes iniciar sesión para acceder a esta página.', () => {
        window.location.href = 'index.html';
        });
        return;
    }
    elements.usernameDisplay.textContent = storedUsername;

    // Mostramos los saldos guardados en la sesión inmediatamente.
    // La función fetchAndDisplayBalances los actualizará después con los datos más recientes.
    elements.saldoBlue.innerHTML = formatBalance(sessionStorage.getItem('blue_balance'));
    elements.saldoEscrowBlue.innerHTML = formatBalance(sessionStorage.getItem('escrow_blue_balance'));
    elements.saldoRed.innerHTML = formatBalance(sessionStorage.getItem('red_balance'));

    // Carga inicial y configuración de listeners
    loadAllData();
    setupDropdowns();
    setupEventListeners();
    checkPublicationPermissions(); // <-- Llamada inicial por si las settings cargan antes que el DOM

    // --- Actualización Automática (Polling) ---
    // Hacemos que la página se actualice sola cada 5 segundos para mantener los datos frescos.
    setInterval(loadAllData, 5000); // 5000 milisegundos = 5 segundos

    // --- Carga de Datos ---
    function loadAllData() {
        fetchAndDisplayPublications();
        fetchNotifications();
        fetchAndDisplayBalances();
    }

    // --- Lógica de la Interfaz (Menús, etc.) ---
    function setupDropdowns() {
        const setup = (trigger, dropdown) => {
            trigger.addEventListener('click', (event) => {
                event.stopPropagation();
                const isOpening = !dropdown.classList.contains('show');
                closeAllDropdowns();
                if (isOpening) {
                    dropdown.classList.toggle('show');
                    // Si el dropdown que se abre es el de notificaciones, márcalas como leídas.
                    if (dropdown.id === 'notificationDropdown') {
                        // Usamos un pequeño retraso para que el usuario vea el badge antes de que desaparezca.
                        setTimeout(markNotificationsAsRead, 1000);
                    }
                }
            });
        };
        setup(elements.profileTrigger, elements.profileDropdown);
        setup(elements.notificationTrigger, elements.notificationDropdown);
    }

    function closeAllDropdowns() {
        elements.profileDropdown.classList.remove('show');
        elements.notificationDropdown.classList.remove('show');
    }

    function setupEventListeners() {
        window.addEventListener('click', closeAllDropdowns);
        elements.logoutLink.addEventListener('click', handleLogout);
        elements.publicationsList.addEventListener('click', handlePublicationAction);
        elements.burnTriggerBtn.addEventListener('click', () => {
            // Actualizamos los saldos en el modal cada vez que se abre
            const blueBalance = sessionStorage.getItem('blue_balance') || '0';
            const escrowBlueBalance = sessionStorage.getItem('escrow_blue_balance') || '0';
            const redBalance = sessionStorage.getItem('red_balance') || '0';
            elements.burnModalBlue.innerHTML = `Disponible: <span class="saldo-blue-text">${formatBalance(blueBalance)} BLUE</span><br>Pendientes: <span class="saldo-escrow-text">${formatBalance(escrowBlueBalance)} BLUE</span>`;
            elements.burnModalRed.innerHTML = `${formatBalance(redBalance)} RED`;
            
            elements.burnModal.style.display = 'flex';
        });
        elements.closeModalBtn.addEventListener('click', () => {
            elements.burnModal.style.display = 'none';
        });
        window.addEventListener('click', (event) => {
            if (event.target == elements.burnModal) {
                elements.burnModal.style.display = 'none';
            }
            // Cerrar también el modal de calificación si se hace clic fuera
            if (event.target == elements.ratingModal) {
                elements.ratingModal.style.display = 'none';
            }
            // Cerrar el nuevo modal si se hace clic fuera
            if (event.target == elements.publicationTypeModal) {
                elements.publicationTypeModal.style.display = 'none';
            }
        });
        elements.burnForm.addEventListener('submit', handleBurnSubmit);

        // Listeners para el modal de calificación
        elements.closeRatingModalBtn.addEventListener('click', () => {
            elements.ratingModal.style.display = 'none';
        });
        elements.ratingForm.addEventListener('submit', handleRatingSubmit);

        // Listeners para el nuevo modal de selección de publicación
        elements.openPublicationModalBtn.addEventListener('click', (event) => {
            event.preventDefault(); // Evitar que el enlace '#' mueva la página
            elements.publicationTypeModal.style.display = 'flex';
        });
        elements.closePublicationTypeModalBtn.addEventListener('click', () => {
            elements.publicationTypeModal.style.display = 'none';
        });
    }
    
    // --- Handlers de Eventos ---
    function handleLogout(event) {
        event.preventDefault();
        // Limpiamos todos los datos de la sesión al salir
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('blue_balance');
        sessionStorage.removeItem('escrow_blue_balance');
        sessionStorage.removeItem('red_balance');
        showCustomAlert('Has cerrado la sesión.', () => {
        window.location.href = 'index.html';
        });
    }

    async function handlePublicationAction(event) {
        const button = event.target.closest('[data-action]');
        if (!button) {
            return;
        }

        const pubId = button.dataset.id;
        const action = button.dataset.action;

        // Buscamos la publicación en el DOM para obtener el nombre del autor.
        const publicationElement = button.closest('.publication-item');
        const authorUsername = publicationElement.dataset.author;
        
        // El usuario específico para una acción (aprobar, descartar, pagar) se obtiene del botón.
        const userInAction = button.dataset.user; 

        let endpoint, body = {};

        switch (action) {
            case 'accept':
                endpoint = `/publications/${pubId}/accept`;
                body = { acceptorUsername: storedUsername };
                await postToServer(endpoint, body);
                break;
            case 'approve':
                endpoint = `/publications/${pubId}/approve`;
                // Usamos 'userInAction' que contiene el nombre del usuario a aprobar.
                body = { approverUsername: storedUsername, userToApprove: userInAction };
                await postToServer(endpoint, body);
                break;
            case 'complete':
                endpoint = `/publications/${pubId}/complete`;
                body = { completerUsername: storedUsername };
                await postToServer(endpoint, body);
                break;
            case 'confirm-payment':
                // Para confirmar el pago, necesitamos el autor (confirmer) y el trabajador (userInAction).
                await confirmPaymentAndRate(pubId, authorUsername, userInAction);
                break;
            case 'delete':
                showCustomConfirm('¿Deseas eliminar esta tarea? Esta acción no se puede deshacer.', async () => {
                    await deleteFromServer(`/publications/${pubId}`, { deleterUsername: storedUsername });
                });
                break;
            case 'discard':
                showCustomConfirm(`¿Seguro que quieres descartar la solicitud de ${userInAction}?`, async () => {
                    await postToServer(`/publications/${pubId}/discard`, { discarderUsername: storedUsername, userToDiscard: userInAction });
                });
                break;
            case 'toggle-pause':
                // La acción es la misma para pausar o reanudar, el backend se encarga de cambiar el estado.
                await postToServer(`/publications/${pubId}/toggle-pause`, { username: storedUsername });
                break;
            case 'hide':
                // Ocultamos la publicación de la vista del usuario actual
                await postToServer(`/publications/${pubId}/hide`, { username: storedUsername });
                break;
        }
    }

    async function confirmPaymentAndRate(pubId, authorUsername, acceptorUsername) {
        try {
            const response = await fetch(`${API_URL}/publications/${pubId}/confirm-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // El backend ahora necesita tanto el confirmer como el worker
                body: JSON.stringify({ confirmerUsername: storedUsername, workerUsername: acceptorUsername })
            });

            const result = await response.json();
            
            if (response.ok) {
                showCustomAlert(result.message); // Primero muestra el mensaje de pago exitoso
                loadAllData(); // Recargamos datos para que todo se actualice
                
                // Ahora, abrimos el modal para calificar
                // El publicador (author) califica al trabajador (acceptor)
                openRatingModal(pubId, authorUsername, acceptorUsername);

            } else {
                showCustomAlert(result.message || "Error al confirmar el pago.");
            }
        } catch (error) {
            console.error('Error en confirmPaymentAndRate:', error);
            showCustomAlert('Error de red al confirmar el pago.');
        }
    }

    async function handleRatingSubmit(event) {
        event.preventDefault();
        
        const ratingValue = elements.ratingForm.querySelector('input[name="rating"]:checked');
        if (!ratingValue) {
            showCustomAlert("Por favor, selecciona una calificación en estrellas.");
            return;
        }

        const body = {
            publicationId: parseInt(elements.ratingPublicationId.value, 10),
            raterUsername: elements.ratingRaterUsername.value,
            rateeUsername: elements.ratingRateeUsername.value,
            rating: parseInt(ratingValue.value, 10),
            comment: elements.ratingComment.value
        };

        try {
            const response = await fetch(`${API_URL}/rate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const result = await response.json();
            showCustomAlert(result.message);

            if (response.ok) {
                elements.ratingModal.style.display = 'none'; // Cerrar modal
                elements.ratingForm.reset(); // Limpiar formulario
                loadAllData(); // Recargar para mostrar nuevas calificaciones
            }
        } catch (error) {
            console.error('Error al enviar la calificación:', error);
            showCustomAlert('Error de red al enviar la calificación.');
        }
    }


    async function postToServer(endpoint, body) {
        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await response.json();
            // Usamos el modal personalizado
            showCustomAlert(result.message);
            if (response.ok) {
                loadAllData(); // Recargar TODO para reflejar todos los cambios
            }
        } catch (error) {
            console.error('Error en postToServer:', error);
            showCustomAlert('Error de red al realizar la acción. Revisa la consola para más detalles.');
        }
    }

    // --- Lógica de Renderizado ---
    async function fetchAndDisplayPublications() {
        try {
            const response = await fetch(`${API_URL}/publications/active?user=${storedUsername}`);
            if (!response.ok) {
                elements.publicationsList.innerHTML = '<p>Error al cargar las publicaciones.</p>';
                return;
            }
        const publications = await response.json();
            
        if (publications.length === 0) {
                elements.publicationsList.innerHTML = '<p class="empty-message">No hay publicaciones disponibles en este momento. ¡Sé el primero en crear una!</p>';
            return;
            }

            // Un mapa para cachear las calificaciones de los usuarios.
            const userRatingsCache = new Map();

            // Usamos Promise.all para obtener todas las calificaciones en paralelo, lo que es más eficiente.
            const publicationsHTML = await Promise.all(publications.map(async (pub) => {
                // 1. Obtener calificación del AUTOR
                if (!userRatingsCache.has(pub.author_username)) {
                    const ratingData = await fetchUserRating(pub.author_username);
                    userRatingsCache.set(pub.author_username, ratingData);
                }
                const authorRating = userRatingsCache.get(pub.author_username);
                const authorRatingHTML = generateStarRating(authorRating.average, authorRating.count);

                // 2. Obtener calificación del ACEPTANTE (si existe)
                let acceptorRatingData = null;
                if (pub.accepted_by_username) {
                    if (!userRatingsCache.has(pub.accepted_by_username)) {
                        const ratingData = await fetchUserRating(pub.accepted_by_username);
                        userRatingsCache.set(pub.accepted_by_username, ratingData);
                    }
                    acceptorRatingData = userRatingsCache.get(pub.accepted_by_username);
                }

                // 3. Generar HTML pasando la calificación del aceptante
                const { messageHTML, actionHTML } = getActionAndMessageHTML(pub, acceptorRatingData);

                // Pasamos la publicación completa para tener acceso a todos sus datos
                return getFullPublicationHTML(pub, authorRatingHTML, messageHTML, actionHTML);
            }));

            elements.publicationsList.innerHTML = publicationsHTML.join('');

        } catch (error) {
            console.error('Error al obtener publicaciones:', error);
            elements.publicationsList.innerHTML = '<p>No se pudo conectar con el servidor para obtener las publicaciones.</p>';
        }
    }

    // --- Funciones de Renderizado ---
    
    function getFullPublicationHTML(pub, ratingHTML, messageHTML, actionHTML) {
        // El acceptor username ahora puede venir de diferentes partes, así que lo manejamos con cuidado.
        // La API ahora devuelve accepted_by_username solo si el usuario actual ha aceptado.
        // Necesitaremos una forma de obtener todos los participantes si queremos mostrarlos.
        const acceptor = pub.accepted_by_username || ''; 
        const formattedId = `#${String(pub.id).padStart(7, '0')}`;
        const rewardText = `${pub.blue_cost} BLUE`;
        const ribbonClass = pub.is_sell_post ? 'sell-ribbon' : '';
        // Mostramos los cupos disponibles.
        const slotsText = pub.available_slots > 0 
            ? `<span class="slots-available">${pub.available_slots} cupos disponibles</span>`
            : `<span class="slots-full">Cupos agotados</span>`;

        // Lógica de enlace de perfil
        const authorNameHTML = window.appSettings.public_profiles_enabled
            ? `<a href="profile.html?user=${pub.author_username}" class="profile-link">${pub.author_username}</a>`
            : pub.author_username;

        return `
            <div class="publication-item" data-id="${pub.id}" data-author="${pub.author_username}" data-acceptor="${acceptor}" data-status="${pub.user_acceptance_status || 'open'}">
                <div class="cost-ribbon ${ribbonClass}">${rewardText}</div>
                <div class="publication-id">${formattedId}</div>
                <h3>${pub.title}</h3>
                <p class="pub-description">${pub.description}</p>
                <div class="pub-meta">
                    <span>Autor: <strong>${authorNameHTML}</strong></span>
                    <span class="rating-display">${ratingHTML}</span>
                </div>
                <div class="publication-footer">
                    ${slotsText}
                </div>
                <div class="publication-actions">
                    ${messageHTML}
                    ${actionHTML}
                </div>
            </div>
        `;
    }

    function getActionAndMessageHTML(pub, acceptorRatingData) {
        const currentUser = storedUsername;
        let messageHTML = '';
        let actionHTML = '';

        // La nueva lógica se basa en pub.user_acceptance_status y si el usuario es el autor
        const userStatus = pub.user_acceptance_status;

        if (currentUser === pub.author_username) {
            // --- VISTA DEL AUTOR ---
            // El backend ahora nos da una lista de participantes para las publicaciones del autor
            if (pub.participants && pub.participants.length > 0) {
                actionHTML += getAuthorParticipantsHTML(pub);
            } else {
                messageHTML = `<div class="status-pending">Aún no hay solicitudes para esta tarea.</div>`;
            }

            // Lógica de botones para el autor, más robusta y profesional:
            const hasAnyParticipants = pub.participants.length > 0;
            const hasActiveParticipants = pub.participants.some(p => ['approved', 'completed'].includes(p.status));
            const allParticipantsPaid = hasAnyParticipants && pub.participants.every(p => p.status === 'confirmed_paid');

            // La tarea se considera "finalizada" cuando todos los que participaron han cobrado.
            const isTaskFinished = allParticipantsPaid;

            // Se puede eliminar si no hay nadie trabajando activamente.
            // Esto permite eliminarla si está vacía, si solo hay pendientes, o si ya todos cobraron.
            const canDelete = !hasActiveParticipants;

            // Se puede pausar/reanudar mientras la tarea no esté completamente finalizada.
            const canManagePause = !isTaskFinished;

            if (canManagePause) {
                actionHTML += `
                    <button class="action-button pause" data-id="${pub.id}" data-action="toggle-pause">
                        ${pub.is_paused ? 'Reanudar Solicitudes' : 'Pausar Solicitudes'}
                    </button>
                `;
            }
             
            actionHTML += `
                <button class="action-button delete" data-id="${pub.id}" data-action="delete" ${canDelete ? '' : 'disabled'}>
                    Eliminar Tarea
                </button>
            `;
            if (!canDelete) {
                 messageHTML += `<div class="status-info">No puedes eliminar una tarea con participantes activos.</div>`;
            }

        } else {
            // --- VISTA DE OTROS USUARIOS ---
            // Lógica final y correcta: el botón de ocultar es independiente.
            switch (userStatus) {
                case null: // El usuario no ha interactuado con esta publicación.
                    
                    // Primero, definimos qué mensaje o botón de acción principal mostrar.
                    if (pub.available_slots > 0 && !pub.is_paused) {
                        actionHTML += `<button class="action-button accept" data-id="${pub.id}" data-action="accept">Aceptar Tarea</button>`;
                    } else if (pub.is_paused) {
                        messageHTML = `<div class="status-pending">El autor ha pausado las nuevas solicitudes para esta tarea.</div>`;
                    } else {
                        messageHTML = `<div class="status-accepted">Todos los cupos para esta tarea están llenos.</div>`;
                    }

                    // Después, añadimos SIEMPRE el botón de ocultar para darle control al usuario.
                    actionHTML += `<button class="action-button hide" data-id="${pub.id}" data-action="hide">Ocultar</button>`;
                    break;
                case 'pending_approval':
                    actionHTML = `<div class="status-pending">Tu solicitud ha sido enviada. Esperando aprobación del autor.</div>`;
                    break;
                case 'approved':
                    messageHTML = `<div class="action-message">¡Has sido aprobado! Ahora puedes completar la tarea.</div>`;
                    actionHTML = `<button class="action-button complete" data-id="${pub.id}" data-action="complete">Marcar como Culminada</button>`;
                    break;
                case 'completed':
                    actionHTML = `<div class="status-progress">Tarea marcada como completada. Esperando confirmación y pago del autor.</div>`;
                    break;
                case 'confirmed_paid':
                    actionHTML = `<div class="status-accepted">¡Felicidades! Esta tarea ha sido finalizada y pagada.</div>`;
                    break;
            }
        }
        return { messageHTML, actionHTML };
    }

    /**
     * Genera el HTML para la lista de participantes desde la vista del autor.
     * @param {object} pub La publicación con su array de participantes.
     * @returns {string} El bloque de HTML.
     */
    function getAuthorParticipantsHTML(pub) {
        const participantsList = pub.participants.map(p => {
            const ratingHTML = generateStarRating(p.average_rating, p.ratings_count);
            const statusText = getStatusText(p.status);
            let actionButtons = '';

            // Lógica de enlace de perfil para participantes
            const participantNameHTML = window.appSettings.public_profiles_enabled
                ? `<a href="profile.html?user=${p.username}" class="profile-link">${p.username}</a>`
                : p.username;

            // Si el participante está pendiente, el autor puede aprobarlo o descartarlo.
            if (p.status === 'pending_approval') {
                actionButtons = `
                    <button class="action-button approve" data-id="${pub.id}" data-action="approve" data-user="${p.username}">Aprobar</button>
                    <button class="action-button discard" data-id="${pub.id}" data-action="discard" data-user="${p.username}">Descartar</button>
                `;
            } else if (p.status === 'completed') {
                // Si el participante ha culminado la tarea, el autor puede confirmar el pago.
                actionButtons = `
                    <button class="action-button confirm" data-id="${pub.id}" data-action="confirm-payment" data-user="${p.username}">Confirmar Pago</button>
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
            <div class="participants-section">
                <h4>Solicitudes de Participantes</h4>
                <ul class="participants-list">${participantsList}</ul>
            </div>
        `;
    }

    function getStatusText(status) {
        const statusMap = {
            'open': 'Abierta',
            'pending_approval': 'Pendiente',
            'approved': 'Aprobado',
            'completed': 'Culminado',
            'confirmed_paid': 'Pagado'
        };
        return statusMap[status] || status;
    }

    async function fetchNotifications() {
        const response = await fetch(`${API_URL}/notifications/${storedUsername}`);
        const notifications = await response.json();
        
        const unreadCount = notifications.filter(n => n.is_read === 0).length;
        updateNotificationBadge(unreadCount);

        elements.notificationDropdown.innerHTML = '';

        if (notifications.length === 0) {
            elements.notificationDropdown.innerHTML = '<div class="no-notifications">No tienes notificaciones.</div>';
            return;
        }

        notifications.forEach(notif => {
            const item = document.createElement('div');
            item.className = 'notification-item' + (notif.is_read === 0 ? ' unread' : '');
            item.innerHTML = `<p>${notif.message}</p>`;
            elements.notificationDropdown.appendChild(item);
        });
    }

    function updateNotificationBadge(count) {
        if (count > 0) {
            elements.notificationBadge.textContent = count;
            elements.notificationBadge.style.display = 'flex';
        } else {
            elements.notificationBadge.style.display = 'none';
        }
    }

    async function markNotificationsAsRead() {
        if (elements.notificationBadge.style.display === 'none') return;

        try {
            await fetch(`${API_URL}/notifications/mark-read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: storedUsername })
        });
            updateNotificationBadge(0);
        } catch (error) {
            console.error('Error marcando notificaciones como leídas:', error);
        }
    }

    async function fetchAndDisplayBalances() {
        try {
            // Añadimos un parámetro que cambia con el tiempo para evitar la caché del navegador.
            const response = await fetch(`${API_URL}/users/${storedUsername}/balance?t=${new Date().getTime()}`);
            if (response.ok) {
                const balances = await response.json();
                elements.saldoBlue.innerHTML = formatBalance(balances.blue_balance);
                elements.saldoEscrowBlue.innerHTML = formatBalance(balances.escrow_blue_balance);
                elements.saldoRed.innerHTML = formatBalance(balances.red_balance);
                sessionStorage.setItem('blue_balance', balances.blue_balance);
                sessionStorage.setItem('escrow_blue_balance', balances.escrow_blue_balance);
                sessionStorage.setItem('red_balance', balances.red_balance);

                // --- Lógica del Contador de Deuda ---
                if (balances.next_due_at && balances.red_balance > 0) {
                    startDebtCountdown(balances.next_due_at);
                    elements.debtCountdownContainer.style.display = 'block';
                } else {
                    // Si no hay fecha de vencimiento, nos aseguramos de que el contador esté oculto y detenido.
                    if (debtCountdownInterval) clearInterval(debtCountdownInterval);
                    elements.debtCountdownContainer.style.display = 'none';
                }

                // --- Lógica del Contador de Escrow ---
                if (balances.next_unlock_at && balances.escrow_blue_balance > 0) {
                    startEscrowCountdown(balances.next_unlock_at);
                    elements.escrowCountdownContainer.style.display = 'block';
                } else {
                    // Si no hay fecha de liberación, nos aseguramos de que el contador esté oculto y detenido.
                    if (escrowCountdownInterval) clearInterval(escrowCountdownInterval);
                    elements.escrowCountdownContainer.style.display = 'none';
                }

            }
        } catch (error) {
            console.error('Error al obtener los saldos:', error);
            // Si falla la carga, también ocultamos el contador para evitar mostrar datos incorrectos
            if (debtCountdownInterval) clearInterval(debtCountdownInterval);
            if (elements.debtCountdownContainer) elements.debtCountdownContainer.style.display = 'none';
            if (escrowCountdownInterval) clearInterval(escrowCountdownInterval);
            if (elements.escrowCountdownContainer) elements.escrowCountdownContainer.style.display = 'none';
        }
    }

    async function handleBurnSubmit(event) {
        event.preventDefault();
        const amountInput = document.getElementById('burnAmount');
        const amount = amountInput.value;

        if (!amount || amount <= 0) {
            showCustomAlert('Por favor, introduce una cantidad válida para quemar.');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/users/burn`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: storedUsername, amount: parseInt(amount) })
            });
            const result = await response.json();
            showCustomAlert(result.message);

            if (response.ok) {
                elements.burnModal.style.display = 'none';
                elements.burnForm.reset();
                loadAllData();
            }
        } catch (error) {
            console.error('Error al quemar tokens:', error);
            showCustomAlert('Error de red al intentar quemar tokens.');
        }
    }

    function openRatingModal(publicationId, raterUsername, rateeUsername) {
        elements.ratingForm.reset(); 
        elements.ratingPublicationId.value = publicationId;
        elements.ratingRaterUsername.value = raterUsername;
        elements.ratingRateeUsername.value = rateeUsername;
        elements.ratingModalTitle.textContent = `Calificar a ${rateeUsername}`;
        elements.ratingModal.style.display = 'flex';
    }

    function generateStarRating(rating, count) {
        if (count === 0) {
            return '<span class="no-rating">Sin calificaciones</span>';
        }

        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5 ? 1 : 0;
        const emptyStars = 5 - fullStars - halfStar;
        let starsHTML = '';

        for (let i = 0; i < fullStars; i++) starsHTML += '★';
        if (halfStar) starsHTML += '½';
        for (let i = 0; i < emptyStars; i++) starsHTML += '☆';
        
        return `<span class="stars">${starsHTML}</span> <span class="rating-count">(${count})</span>`;
    }

    /**
     * Genera un fragmento de HTML para una calificación corta (ej: "4.5 ★").
     * @param {object} ratingData Objeto con { average, count }.
     * @returns {string} El HTML de la calificación corta.
     */
    function getShortRatingHTML(ratingData) {
        if (!ratingData || ratingData.count === 0) {
            return ''; // No mostrar nada si no hay calificaciones
        }
        // toFixed(1) asegura que haya un decimal (ej. 4.0 o 4.5)
        const formattedRating = parseFloat(ratingData.average).toFixed(1);
        // Usamos un 'title' para mostrar el número de calificaciones al pasar el ratón.
        return ` <span class="short-rating" title="${ratingData.count} calificaciones">${formattedRating} ★</span>`;
    }

    async function fetchUserRating(username) {
        try {
            const response = await fetch(`${API_URL}/user/${username}`);
            if (!response.ok) {
                console.warn(`Could not fetch rating for user ${username}. Status: ${response.status}`);
                return { average: 0, count: 0 };
            }
            const data = await response.json();
            return { average: data.average_rating, count: data.ratings_count };
        } catch (error) {
            console.error(`Error fetching rating for ${username}:`, error);
            return { average: 0, count: 0 };
        }
    }

    async function deleteFromServer(endpoint, body) {
        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await response.json();
            showCustomAlert(result.message);
            if (response.ok) {
                loadAllData(); // Recargar para que la publicación desaparezca
            }
        } catch (error) {
            console.error('Error en deleteFromServer:', error);
            showCustomAlert('Error de red al intentar eliminar.');
        }
    }

    /**
     * Inicia y actualiza el contador de deuda cada segundo.
     * @param {string} dueDateString La fecha de vencimiento en formato ISO (viene del backend).
     */
    function startDebtCountdown(dueDateString) {
        // Detenemos cualquier contador anterior para evitar múltiples intervalos corriendo a la vez.
        if (debtCountdownInterval) {
            clearInterval(debtCountdownInterval);
        }

        const dueDate = new Date(dueDateString);

        // Función que se ejecuta cada segundo
        const updateTimer = () => {
            const now = new Date();
            const distance = dueDate - now;

            if (distance < 0) {
                clearInterval(debtCountdownInterval);
                elements.debtCountdownTimer.textContent = "¡VENCIDO!";
                elements.debtCountdownTimer.classList.add('expired');
                // Forzamos una recarga de datos para que el sistema procese la deuda vencida.
                setTimeout(loadAllData, 2000); // Pequeña espera antes de recargar
                return;
            }

            // Cálculos de tiempo
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            // Formatear para que siempre tengan dos dígitos (ej: 09 en vez de 9)
            const fDays = String(days).padStart(2, '0');
            const fHours = String(hours).padStart(2, '0');
            const fMinutes = String(minutes).padStart(2, '0');
            const fSeconds = String(seconds).padStart(2, '0');
            
            elements.debtCountdownTimer.textContent = `${fDays}d : ${fHours}h : ${fMinutes}m : ${fSeconds}s`;
            elements.debtCountdownTimer.classList.remove('expired');
        };

        // Ejecutamos la función una vez de inmediato para no esperar el primer segundo.
        updateTimer(); 
        // Y luego la configuramos para que se repita.
        debtCountdownInterval = setInterval(updateTimer, 1000);
    }

    /**
     * Inicia y actualiza el contador de liberación de escrow cada segundo.
     * @param {string} unlockDateString La fecha de liberación en formato ISO (viene del backend).
     */
    function startEscrowCountdown(unlockDateString) {
        if (escrowCountdownInterval) {
            clearInterval(escrowCountdownInterval);
        }

        const unlockDate = new Date(unlockDateString);

        const updateTimer = () => {
            const now = new Date();
            const distance = unlockDate - now;

            if (distance < 0) {
                clearInterval(escrowCountdownInterval);
                elements.escrowCountdownTimer.textContent = "¡LIBERANDO!";
                // Forzamos una recarga de datos para que el sistema procese la liberación.
                setTimeout(loadAllData, 2000); // Pequeña espera antes de recargar
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            const fDays = String(days).padStart(2, '0');
            const fHours = String(hours).padStart(2, '0');
            const fMinutes = String(minutes).padStart(2, '0');
            const fSeconds = String(seconds).padStart(2, '0');
            
            elements.escrowCountdownTimer.textContent = `${fDays}d : ${fHours}h : ${fMinutes}m : ${fSeconds}s`;
        };

        updateTimer();
        escrowCountdownInterval = setInterval(updateTimer, 1000);
    }
}); 