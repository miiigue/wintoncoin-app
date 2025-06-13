document.addEventListener('DOMContentLoaded', () => {

    // --- Configuración Global ---
    // Lógica para determinar la URL del API automáticamente
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
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
        ratingComment: document.getElementById('ratingComment')
    };

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
    elements.saldoBlue.textContent = sessionStorage.getItem('blue_balance') || '0';
    elements.saldoRed.textContent = sessionStorage.getItem('red_balance') || '0';

    // Carga inicial y configuración de listeners
    loadAllData();
    setupDropdowns();
    setupEventListeners();

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
            const redBalance = sessionStorage.getItem('red_balance') || '0';
            elements.burnModalBlue.textContent = `${blueBalance} BLUE`;
            elements.burnModalRed.textContent = `${redBalance} RED`;
            
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
        });
        elements.burnForm.addEventListener('submit', handleBurnSubmit);

        // Listeners para el modal de calificación
        elements.closeRatingModalBtn.addEventListener('click', () => {
            elements.ratingModal.style.display = 'none';
        });
        elements.ratingForm.addEventListener('submit', handleRatingSubmit);
    }
    
    // --- Handlers de Eventos ---
    function handleLogout(event) {
        event.preventDefault();
        // Limpiamos todos los datos de la sesión al salir
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('blue_balance');
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

        // Buscamos la publicación en el DOM para obtener los nombres de usuario
        const publicationElement = button.closest('.publication-item');
        const authorUsername = publicationElement.dataset.author;
        const acceptorUsername = publicationElement.dataset.acceptor;


        let endpoint, body = {};

        switch (action) {
            case 'accept':
                endpoint = `/publications/${pubId}/accept`;
                body = { acceptorUsername: storedUsername };
                await postToServer(endpoint, body);
                break;
            case 'approve':
                endpoint = `/publications/${pubId}/approve`;
                body = { approverUsername: storedUsername };
                await postToServer(endpoint, body);
                break;
            case 'complete':
                endpoint = `/publications/${pubId}/complete`;
                body = { completerUsername: storedUsername };
                await postToServer(endpoint, body);
                break;
            case 'confirm-payment':
                // Para confirmar pago, el flujo es especial
                await confirmPaymentAndRate(pubId, authorUsername, acceptorUsername);
                break;
        }
    }

    async function confirmPaymentAndRate(pubId, authorUsername, acceptorUsername) {
        try {
            const response = await fetch(`${API_URL}/publications/${pubId}/confirm-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmerUsername: storedUsername })
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
            if (!response.ok) throw new Error('Error al obtener publicaciones.');
            const publications = await response.json();

            // --- PASO 0: Manejo no destructivo del mensaje de "no hay publicaciones" ---
            const noPubsMessage = elements.publicationsList.querySelector('.no-publications-message');
            if (publications.length === 0) {
                if (!noPubsMessage) {
                    elements.publicationsList.innerHTML = '<p class="no-publications-message">Aún no hay publicaciones. ¡Sé el primero!</p>';
                }
                return;
            } else if (noPubsMessage) {
                noPubsMessage.remove();
            }

            // --- PASO 1: Obtener todos los datos de calificación en paralelo ---
            const ratingsPromises = publications.map(pub =>
                fetch(`${API_URL}/user/${pub.author_username}`).then(res => res.ok ? res.json() : null)
            );
            const userRatings = await Promise.all(ratingsPromises);

            const newPublicationsMap = new Map();
            publications.forEach((pub, index) => {
                newPublicationsMap.set(pub.id.toString(), { pub, userData: userRatings[index] });
            });

            const currentElementsMap = new Map(
                Array.from(elements.publicationsList.children)
                     .filter(el => el.dataset.id)
                     .map(el => [el.dataset.id, el])
            );

            // --- PASO 2: Actualizar y Añadir (Lógica Data-Driven) ---
            newPublicationsMap.forEach(({ pub, userData }, pubId) => {
                const average_rating = userData ? userData.average_rating : 0;
                const ratings_count = userData ? userData.ratings_count : 0;

                if (currentElementsMap.has(pubId)) {
                    // La publicación ya existe, actualizamos solo si los datos han cambiado.
                    const element = currentElementsMap.get(pubId);

                    // Actualizamos el 'acceptor' por si ha cambiado (p. ej. de null a un nombre de usuario)
                    element.dataset.acceptor = pub.accepted_by_username || '';

                    // Actualización del rating basada en datos
                    const currentRating = parseFloat(element.dataset.rating || 0);
                    const currentRatingCount = parseInt(element.dataset.ratingCount || 0, 10);
                    if (currentRating !== average_rating || currentRatingCount !== ratings_count) {
                        element.querySelector('.rating-display').innerHTML = generateStarRating(average_rating, ratings_count);
                        element.dataset.rating = average_rating;
                        element.dataset.ratingCount = ratings_count;
                    }

                    // Actualización de acciones basada en el estado
                    if (element.dataset.status !== pub.status) {
                        const { messageHTML, actionHTML } = getActionAndMessageHTML(pub);
                        element.querySelector('.publication-actions').innerHTML = messageHTML + actionHTML;
                        element.dataset.status = pub.status;
                    }
                } else {
                    // Es una publicación nueva, la creamos y la añadimos.
                    const item = document.createElement('div');
                    item.className = 'publication-item';
                    item.dataset.id = pub.id;
                    item.dataset.status = pub.status;
                    item.dataset.rating = average_rating;
                    item.dataset.ratingCount = ratings_count;
                    item.dataset.author = pub.author_username;
                    item.dataset.acceptor = pub.accepted_by_username || '';

                    const ratingHTML = generateStarRating(average_rating, ratings_count);
                    const { messageHTML, actionHTML } = getActionAndMessageHTML(pub);
                    item.innerHTML = getFullPublicationHTML(pub, ratingHTML, messageHTML, actionHTML);
                    elements.publicationsList.prepend(item);
                }
            });

            // --- PASO 3: Eliminar las antiguas ---
            currentElementsMap.forEach((element, pubId) => {
                if (!newPublicationsMap.has(pubId)) {
                    element.remove();
                }
            });

        } catch (error) {
            console.error('Error en fetchAndDisplayPublications:', error);
        }
    }

    // Separa la lógica de obtener el HTML completo de la lógica de las acciones
    function getFullPublicationHTML(pub, ratingHTML, messageHTML, actionHTML) {
        const formattedId = `#${String(pub.id).padStart(7, '0')}`;
        return `
            <div class="cost-ribbon">${pub.blue_cost} BLUE</div>
            <div class="publication-id">${formattedId}</div>
            <h3>${pub.title}</h3>
            <p class="pub-description">${pub.description}</p>
            <div class="pub-meta">
                <span>Autor: <strong>${pub.author_username}</strong></span>
                <span class="rating-display">${ratingHTML}</span>
            </div>
            <div class="publication-actions">
                ${messageHTML}
                ${actionHTML}
            </div>
        `;
    }

    // Esta función ahora solo devuelve las partes dinámicas
    function getActionAndMessageHTML(pub) {
        let actionHTML = '';
        let messageHTML = '';
        const isAuthor = pub.author_username === storedUsername;
        const isAcceptor = pub.accepted_by_username === storedUsername;

        switch (pub.status) {
            case 'open':
                if (isAuthor) {
                    actionHTML = `<div class="status-pending">Esperando respuesta</div>`;
                } else {
                    actionHTML = `<button class="action-button accept" data-id="${pub.id}" data-action="accept">Aceptar</button>`;
                }
                break;
            case 'pending_approval':
                if (isAuthor) {
                    messageHTML = `<div class="action-message"><strong>${pub.accepted_by_username}</strong> quiere hacer esta tarea.</div>`;
                    actionHTML = `<button class="action-button approve" data-id="${pub.id}" data-action="approve">Aprobar Solicitud</button>`;
                } else {
                    actionHTML = `<div class="status-pending">Solicitud enviada. Esperando aprobación.</div>`;
                }
                break;
            case 'approved':
                if (isAcceptor) {
                    messageHTML = `<div class="action-message">Fuiste aprobado. ¡Completa la tarea!</div>`;
                    actionHTML = `<button class="action-button complete" data-id="${pub.id}" data-action="complete">Tarea Culminada</button>`;
                } else {
                    actionHTML = `<div class="status-progress">Tarea en progreso por ${pub.accepted_by_username}</div>`;
                }
                break;
            case 'completed':
                if (isAuthor) {
                    messageHTML = `<div class="action-message"><strong>${pub.accepted_by_username}</strong> ha culminado la tarea.</div>`;
                    actionHTML = `<button class="action-button confirm" data-id="${pub.id}" data-action="confirm-payment">Conforme y Pagar</button>`;
                } else {
                    actionHTML = `<div class="status-progress">Tarea completada. Esperando pago.</div>`;
                }
                break;
            case 'confirmed_paid':
                actionHTML = `<div class="status-accepted">Tarea finalizada y pagada a ${pub.accepted_by_username}</div>`;
                if (isAcceptor) {
                    // actionHTML += `<button class="action-button rate" data-id="${pub.id}" data-action="rate-author">Calificar al publicador</button>`;
                }
                break;
        }
        return { messageHTML, actionHTML };
    }

    async function fetchNotifications() {
        const response = await fetch(`${API_URL}/notifications/${storedUsername}`);
        const notifications = await response.json();
        
        const unreadCount = notifications.filter(n => n.is_read === 0).length;
        updateNotificationBadge(unreadCount);

        // Limpiar notificaciones anteriores para evitar duplicados al refrescar
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
        // Solo enviar la petición si hay notificaciones sin leer.
        if (elements.notificationBadge.style.display === 'none') return;

        try {
            await fetch(`${API_URL}/notifications/mark-read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: storedUsername })
            });
            // Ocultar visualmente el badge de inmediato para una respuesta rápida.
            updateNotificationBadge(0);
        } catch (error) {
            console.error('Error marcando notificaciones como leídas:', error);
        }
    }

    async function fetchAndDisplayBalances() {
        try {
            const response = await fetch(`${API_URL}/users/${storedUsername}/balance`);
            if (response.ok) {
                const balances = await response.json();
                elements.saldoBlue.textContent = balances.blue_balance;
                elements.saldoRed.textContent = balances.red_balance;
                // También actualizamos sessionStorage para que esté fresco
                sessionStorage.setItem('blue_balance', balances.blue_balance);
                sessionStorage.setItem('red_balance', balances.red_balance);
            }
        } catch (error) {
            console.error('Error al obtener los saldos:', error);
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
                elements.burnModal.style.display = 'none'; // Cierra el modal
                elements.burnForm.reset(); // Limpia el formulario
                loadAllData(); // Recarga todo para ver los nuevos saldos
            }
        } catch (error) {
            console.error('Error al quemar tokens:', error);
            showCustomAlert('Error de red al intentar quemar tokens.');
        }
    }

    // --- Funciones de Utilidad ---
    // La función showCustomAlert se ha movido a utils.js para ser usada globalmente.

    function openRatingModal(publicationId, raterUsername, rateeUsername) {
        // Primero, reseteamos el formulario para limpiar cualquier dato anterior (incluyendo estrellas seleccionadas).
        elements.ratingForm.reset(); 
        
        // Ahora, establecemos los nuevos valores en los campos ocultos.
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
        if (halfStar) starsHTML += '½'; // O podrías usar otro ícono para media estrella
        for (let i = 0; i < emptyStars; i++) starsHTML += '☆';
        
        return `<span class="stars">${starsHTML}</span> <span class="rating-count">(${count})</span>`;
    }
});