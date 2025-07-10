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
        burnModalBalances: document.getElementById('burnModalBalances'),
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
        debtCountdownText: document.getElementById('debt-countdown-text'),
        // --- Elementos para el contador de escrow ---
        saldoEscrowBlue: document.getElementById('saldoEscrowBlue'),
        escrowCountdownContainer: document.getElementById('escrow-countdown-container'),
        escrowCountdownText: document.getElementById('escrow-countdown-text'),
        authoredList: document.getElementById('authored-publications-list'),
        completedList: document.getElementById('completed-publications-list')
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
                        // Llamamos a la función para marcar como leído.
                        markNotificationsAsRead();
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
            
            elements.burnModalBalances.innerHTML = `
                <div class="balance-line">
                    <span>Disponible</span>
                    <span class="saldo-blue-text">${formatBalance(blueBalance)} BLUE</span>
                </div>
                <div class="balance-line">
                    <span>Pendientes</span>
                    <span class="saldo-escrow-text">${formatBalance(escrowBlueBalance)} BLUE</span>
                </div>
                <div class="balance-line">
                    <span>Deuda</span>
                    <span class="saldo-red-text">${formatBalance(redBalance)} RED</span>
                </div>
            `;
            
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

        // Event listener delegado para las acciones dentro del menú de notificaciones
        elements.notificationDropdown.addEventListener('click', async (event) => {
            const dismissButton = event.target.closest('.notification-dismiss');
            const clearAllLink = event.target.closest('.notification-footer-link');

            if (dismissButton) {
                event.preventDefault();
                const notificationId = dismissButton.dataset.id;
                await dismissNotification(notificationId);
            }

            if (clearAllLink) {
                event.preventDefault();
                await clearAllNotifications();
            }
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
        const formData = new FormData(event.target);
        const body = Object.fromEntries(formData.entries());
        
        try {
            await postToServer('/rate', body);
            // El modal se cierra y los datos se recargan gracias a postToServer
            elements.ratingModal.style.display = 'none';
        } catch(error) {
            console.error("La calificación falló.", error);
        }
    }

    async function postToServer(endpoint, body, options = {}) {
        const { silent = false, reload = true } = options; // `reload` es true por defecto
        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const result = await response.json();
            
            if (!response.ok) {
                showCustomAlert(result.message || `Error en el servidor: ${response.status}`);
                throw new Error(result.message || `Error en el servidor`);
            }

            if (!silent && result.message) {
                showCustomAlert(result.message);
            }
            
            if (response.ok && reload) {
                loadAllData(); // Recargar datos si la operación fue exitosa y se debe recargar
            }
            
            return result;

        } catch (error) {
            console.error(`Error en postToServer (${endpoint}):`, error);
            throw error;
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
        const rewardText = `${formatBalance(pub.blue_cost)} BLUE`;
        const ribbonClass = pub.is_sell_post ? 'sell-ribbon' : '';

        const slotsClass = pub.available_slots > 0 ? 'available' : 'full';
        const slotsText = pub.available_slots > 0 
            ? `${pub.available_slots} cupo${pub.available_slots > 1 ? 's' : ''} disponible${pub.available_slots > 1 ? 's' : ''}`
            : `Cupos agotados`;

        // Lógica de enlace de perfil
        const authorNameHTML = window.appSettings.public_profiles_enabled
            ? `<a href="profile.html?user=${pub.author_username}" class="profile-link">${pub.author_username}</a>`
            : pub.author_username;

        const costRibbon = `<div class="cost-ribbon ${ribbonClass}">${rewardText}</div>`;

        return `
            <div class="publication-item" data-id="${pub.id}" data-author="${pub.author_username}">
                <div class="cost-ribbon ${ribbonClass}">${rewardText}</div>
                
                <div class="publication-header">
                    <h3>${pub.title}</h3>
                </div>
                
                <p class="pub-description">${linkify(pub.description)}</p>
                
                <div class="publication-footer">
                    <div class="pub-meta">
                        <span>Por: <strong>${authorNameHTML}</strong></span>
                        ${ratingHTML}
                    </div>
                    <div class="slots-info ${slotsClass}">
                        ${slotsText}
                    </div>
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
        const userStatus = pub.user_acceptance_status; // Esta línea es la que faltaba.
        let messageHTML = '';
        let actionHTML = '';

        if (currentUser === pub.author_username) {
            // --- VISTA DEL AUTOR ---
            const participants = pub.participants || [];
            const hasAnyParticipants = participants.length > 0;

            if (hasAnyParticipants) {
                actionHTML += getAuthorParticipantsHTML(pub); // Siempre mostrar la lista de participantes si existe
            } else {
                messageHTML = `<div class="status-pending">Aún no hay solicitudes para esta tarea.</div>`;
            }

            const hasActiveParticipants = hasAnyParticipants && participants.some(p => ['approved', 'completed'].includes(p.status));
            const allParticipantsPaid = hasAnyParticipants && participants.every(p => p.status === 'confirmed_paid');
            const isTaskFinished = allParticipantsPaid;
            const canDelete = !hasActiveParticipants;
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
            if (pub.is_sell_post) {
                // --- VISTA PARA PUBLICACIONES DE VENTA ---
                switch (userStatus) {
                    case 'completed':
                        messageHTML = `<p class="action-message status-pending">Has marcado la compra como completada. Esperando confirmación final del vendedor.</p>`;
                        break;
                    case 'confirmed_paid':
                        messageHTML = `<p class="action-message status-info">¡Compra completada!</p>`;
                        if (pub.available_slots > 0) {
                            actionHTML = `
                                <button class="action-button accept" data-action="accept" data-id="${pub.id}">Comprar de nuevo</button>
                                <button class="action-button hide" data-action="hide" data-id="${pub.id}">Ocultar</button>
                            `;
                        } else {
                            actionHTML = `<button class="action-button hide" data-action="hide" data-id="${pub.id}">Ocultar</button>`;
                        }
                        break;
                    default: // 'open', null, o cualquier otro estado.
                        if (pub.available_slots > 0 && !pub.is_paused) {
                            actionHTML += `<button class="action-button accept" data-id="${pub.id}" data-action="accept">Comprar</button>`;
                        } else if (pub.is_paused) {
                            messageHTML = `<div class="status-pending">El autor ha pausado la venta de este artículo.</div>`;
                        } else {
                            messageHTML = `<div class="status-accepted">Artículo agotado.</div>`;
                        }
                        // Solo añadir ocultar si el usuario no está ya en un proceso activo
                        if (userStatus !== 'pending_approval' && userStatus !== 'approved' && userStatus !== 'completed') {
                            actionHTML += `<button class="action-button hide" data-id="${pub.id}" data-action="hide">Ocultar</button>`;
                        }
                        break;
                }
            } else {
                // --- VISTA PARA PUBLICACIONES DE SOLICITUD DE TAREA ---
                switch (userStatus) {
                    case 'pending_approval':
                        messageHTML = `<div class="status-pending">Tu solicitud ha sido enviada. Esperando aprobación del autor.</div>`;
                        break;
                    case 'approved':
                        messageHTML = `<div class="action-message">¡Has sido aprobado! Ahora puedes completar la tarea.</div>`;
                        actionHTML = `<button class="action-button complete" data-id="${pub.id}" data-action="complete">Marcar como Culminada</button>`;
                        break;
                    case 'completed':
                         messageHTML = `<p class="action-message status-pending">Tarea culminada. Esperando confirmación y pago del autor.</p>`;
                        break;
                    case 'confirmed_paid':
                        messageHTML = `<p class="action-message status-info">Felicidades, te pagaron.</p>`;
                        if (pub.available_slots > 0) {
                            actionHTML = `
                                <button class="action-button accept" data-action="accept" data-id="${pub.id}">Aceptar nuevamente</button>
                                <button class="action-button hide" data-action="hide" data-id="${pub.id}">Ocultar</button>
                            `;
                        } else {
                            actionHTML = `<button class="action-button hide" data-action="hide" data-id="${pub.id}">Ocultar</button>`;
                        }
                        break;
                    default: // 'open' or null
                        if (pub.available_slots > 0 && !pub.is_paused) {
                            actionHTML += `<button class="action-button accept" data-id="${pub.id}" data-action="accept">Aceptar Tarea</button>`;
                        } else if (pub.is_paused) {
                            messageHTML = `<div class="status-pending">El autor ha pausado las nuevas solicitudes para esta tarea.</div>`;
                        } else {
                            messageHTML = `<div class="status-accepted">Todos los cupos para esta tarea están llenos.</div>`;
                        }
                        actionHTML += `<button class="action-button hide" data-id="${pub.id}" data-action="hide">Ocultar</button>`;
                        break;
                }
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
                <ul class="participants-list" data-pub-id="${pub.id}">
                    ${participantsList}
                </ul>
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
        try {
            const response = await fetch(`${API_URL}/notifications/${storedUsername}`);
            if (!response.ok) throw new Error('Error al cargar notificaciones.');
            
            const notifications = await response.json();
            const dropdown = document.getElementById('notificationDropdown');
            dropdown.innerHTML = ''; // Limpiar notificaciones viejas

            if (notifications.length === 0) {
                dropdown.innerHTML = '<div class="no-notifications">No tienes notificaciones nuevas.</div>';
            } else {
                notifications.forEach(notification => {
                    const item = document.createElement('div');
                    item.className = 'notification-item';
                    item.dataset.id = notification.id; // Guardamos el ID en el elemento
                    item.innerHTML = `
                        <p>${notification.message}</p>
                        <span class="notification-dismiss" data-id="${notification.id}" title="Descartar">&times;</span>
                    `;
                    dropdown.appendChild(item);
                });

                // Añadir el pie de página para limpiar todo
                const footer = document.createElement('div');
                footer.className = 'notification-footer';
                footer.innerHTML = '<a href="#" class="notification-footer-link">Limpiar todas las notificaciones</a>';
                dropdown.appendChild(footer);
            }

            updateNotificationBadge(notifications.length);

        } catch (error) {
            console.error(error.message);
            updateNotificationBadge(0);
        }
    }

    function updateNotificationBadge(count) {
        const badge = document.getElementById('notificationBadge');
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // NUEVA FUNCIÓN para marcar como leído sin limpiar la UI
    async function markNotificationsAsRead() {
        const badge = document.getElementById('notificationBadge');
        if (badge.style.display === 'none') return; // No hacer nada si no hay notificaciones

        try {
            // Llamada silenciosa y sin recarga de toda la página
            await postToServer('/notifications/mark-read', { username: storedUsername }, { silent: true, reload: false });
            updateNotificationBadge(0); // Ocultar la pastilla roja inmediatamente
        } catch (error) {
            console.error("Error al marcar notificaciones como leídas:", error);
        }
    }

    async function dismissNotification(notificationId) {
        const notificationElement = document.querySelector(`.notification-item[data-id='${notificationId}']`);
        
        // Optimistic UI: remove immediately
        if (notificationElement) {
            notificationElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            notificationElement.style.opacity = '0';
            notificationElement.style.transform = 'translateX(20px)';
            setTimeout(() => {
                notificationElement.remove();
                const remaining = document.querySelectorAll('.notification-item').length;
                updateNotificationBadge(remaining);
                if (remaining === 0) {
                    fetchNotifications(); // Recargar para mostrar el mensaje "sin notificaciones"
                }
            }, 300);
        }
        
        try {
            // Llamada silenciosa y sin recarga
            await postToServer(`/notifications/${notificationId}/dismiss`, { username: storedUsername }, { silent: true, reload: false });
        } catch (error) {
            console.error("Error al descartar la notificación en el servidor:", error);
        }
    }

    async function clearAllNotifications() {
        try {
            // Llamada silenciosa y sin recarga
            const response = await postToServer('/notifications/mark-read', { username: storedUsername }, { silent: true, reload: false });
            if (response.success) {
                const dropdown = document.getElementById('notificationDropdown');
                dropdown.innerHTML = '<div class="no-notifications">No tienes notificaciones nuevas.</div>';
                updateNotificationBadge(0);
            }
        } catch (error) {
            console.error("Error al limpiar todas las notificaciones:", error);
        }
    }

    async function fetchAndDisplayBalances() {
        try {
            // Añadimos un parámetro que cambia con el tiempo para evitar la caché del navegador.
            const response = await fetch(`${API_URL}/users/${storedUsername}/balance?t=${new Date().getTime()}`);
            if (response.ok) {
                const data = await response.json();
                elements.saldoBlue.innerHTML = formatBalance(data.blue_balance);
                elements.saldoEscrowBlue.innerHTML = formatBalance(data.escrow_blue_balance);
                elements.saldoRed.innerHTML = formatBalance(data.red_balance);
                sessionStorage.setItem('blue_balance', data.blue_balance);
                sessionStorage.setItem('escrow_blue_balance', data.escrow_blue_balance);
                sessionStorage.setItem('red_balance', data.red_balance);

                // NO actualizamos el modal de quemado aquí. Se hará solo al abrirlo.

                if (data.next_due_at && parseFloat(data.next_due_amount) > 0) {
                    elements.debtCountdownContainer.style.display = 'block';
                    startDebtCountdown(data.next_due_at, data.next_due_amount);
                } else {
                    elements.debtCountdownContainer.style.display = 'none';
                    if (debtCountdownInterval) clearInterval(debtCountdownInterval);
                }

                if (data.next_unlock_at && parseFloat(data.next_unlock_amount) > 0) {
                    elements.escrowCountdownContainer.style.display = 'block';
                    startEscrowCountdown(data.next_unlock_at, data.next_unlock_amount);
                } else {
                    elements.escrowCountdownContainer.style.display = 'none';
                    if (escrowCountdownInterval) clearInterval(escrowCountdownInterval);
                }

            }
        } catch (error) {
            console.error('Error al obtener saldos:', error);
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
                body: JSON.stringify({ username: storedUsername, amount: amount })
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
    function startDebtCountdown(dueDateString, dueAmount) {
        if (debtCountdownInterval) clearInterval(debtCountdownInterval);
        const formattedAmount = formatBalance(dueAmount);

        const updateTimer = () => {
            const now = new Date();
            const dueDate = new Date(dueDateString);
            const diff = dueDate - now;

            if (diff <= 0) {
                elements.debtCountdownText.innerHTML = `<strong class="expired">URGENTE! ${formattedAmount} VENCIDOS!</strong>`;
                clearInterval(debtCountdownInterval);
                fetchAndDisplayBalances(); // Para asegurar consistencia de datos
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            let timeString = '';
            if (days > 0) {
                timeString = `${days}d y ${hours}h`;
            } else if (hours > 0) {
                timeString = `${hours}h y ${minutes}m`;
            } else if (minutes > 0) {
                timeString = `${minutes}m y ${seconds}s`;
            } else {
                timeString = `${seconds}s`;
            }

            elements.debtCountdownText.innerHTML = `próximo vencimiento <strong class="saldo-red-text">${formattedAmount}</strong> en <strong>${timeString}</strong>`;
        };

        updateTimer();
        debtCountdownInterval = setInterval(updateTimer, 1000);
    }

    /**
     * Inicia y actualiza el contador de liberación de escrow cada segundo.
     * @param {string} unlockDateString La fecha de liberación en formato ISO (viene del backend).
     */
    function startEscrowCountdown(unlockDateString, unlockAmount) {
        if (escrowCountdownInterval) clearInterval(escrowCountdownInterval);
        const formattedAmount = formatBalance(unlockAmount);

        const updateTimer = () => {
            const now = new Date();
            const unlockDate = new Date(unlockDateString);
            const diff = unlockDate - now;

            if (diff <= 0) {
                elements.escrowCountdownContainer.style.display = 'none';
                clearInterval(escrowCountdownInterval);
                fetchAndDisplayBalances(); // Actualizar saldos al liberar
                return;
            }
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            let timeString = '';
            if (days > 0) {
                timeString = `${days}d y ${hours}h`;
            } else if (hours > 0) {
                timeString = `${hours}h y ${minutes}m`;
            } else if (minutes > 0) {
                timeString = `${minutes}m y ${seconds}s`;
            } else {
                timeString = `${seconds}s`;
            }

            elements.escrowCountdownText.innerHTML = `Disponible <strong class="saldo-blue-text">${formattedAmount}</strong> en <strong>${timeString}</strong>`;
        };
        
        updateTimer();
        escrowCountdownInterval = setInterval(updateTimer, 1000);
    }
}); 