document.addEventListener('DOMContentLoaded', () => {

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
        burnModalRed: document.getElementById('burnModalRed')
    };

    // --- Inicialización ---
    if (!storedUsername) {
        alert('Debes iniciar sesión para acceder a esta página.');
        window.location.href = 'index.html';
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
                if (isOpening) dropdown.classList.toggle('show');
                if (isOpening && dropdown.id === 'notificationDropdown') {
                    // Lógica para marcar como leídas se movió al handler de la notificación
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
        elements.notificationDropdown.addEventListener('click', handleNotificationAction);
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
        });
        elements.burnForm.addEventListener('submit', handleBurnSubmit);
    }
    
    // --- Handlers de Eventos ---
    function handleLogout(event) {
        event.preventDefault();
        // Limpiamos todos los datos de la sesión al salir
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('blue_balance');
        sessionStorage.removeItem('red_balance');
        alert('Has cerrado la sesión.');
        window.location.href = 'index.html';
    }

    async function handlePublicationAction(event) {
        const button = event.target.closest('[data-action]');
        if (!button) return;

        const pubId = button.dataset.id;
        const action = button.dataset.action;
        let endpoint, body = {};

        switch (action) {
            case 'accept':
                endpoint = `/publications/${pubId}/accept`;
                body = { acceptorUsername: storedUsername };
                break;
            case 'approve':
                endpoint = `/publications/${pubId}/approve`;
                body = { approverUsername: storedUsername };
                break;
            case 'complete':
                endpoint = `/publications/${pubId}/complete`;
                body = { completerUsername: storedUsername };
                break;
            case 'confirm-payment':
                endpoint = `/publications/${pubId}/confirm-payment`;
                body = { confirmerUsername: storedUsername };
                break;
        }
        if (endpoint) await postToServer(endpoint, body);
    }

    async function handleNotificationAction(event) {
        const button = event.target.closest('[data-action]');
        if (button) {
            const notifId = button.dataset.id;
            const action = button.dataset.action;
            let endpoint, body;
            
            if (action === 'approve') {
                endpoint = `/notifications/${notifId}/approve`;
                body = { approverUsername: storedUsername };
            } else if (action === 'complete') {
                endpoint = `/notifications/${notifId}/complete`;
                body = { completerUsername: storedUsername };
            } else if (action === 'confirm-payment') {
                endpoint = `/notifications/${notifId}/confirm-payment`;
                body = { confirmerUsername: storedUsername };
            }
            
            if (endpoint) await postToServer(endpoint, body);
        }
    }

    async function postToServer(endpoint, body) {
        try {
            const response = await fetch(`http://localhost:3000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await response.json();
            alert(result.message);
            if (response.ok) {
                loadAllData(); // Recargar TODO para reflejar todos los cambios
            }
        } catch (error) {
            alert('Error de red al realizar la acción.');
        }
    }

    // --- Lógica de Renderizado ---
    async function fetchAndDisplayPublications() {
        const response = await fetch('http://localhost:3000/publications');
        const publications = await response.json();
        elements.publicationsList.innerHTML = '';
        if (publications.length === 0) {
            elements.publicationsList.innerHTML = '<p>Aún no hay publicaciones. ¡Sé el primero!</p>';
            return;
        }
        publications.forEach(pub => {
            const item = document.createElement('div');
            item.className = 'publication-item';
            item.innerHTML = getPublicationHTML(pub);
            elements.publicationsList.appendChild(item);
        });
    }

    function getPublicationHTML(pub) {
        let actionHTML = '';
        let messageHTML = '';
        const isAuthor = pub.author_username === storedUsername;
        const isAcceptor = pub.accepted_by_username === storedUsername;

        switch (pub.status) {
            case 'open':
                if (!isAuthor) {
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
                break;
        }

        return `
            <h3>${pub.title}</h3>
            <p class="pub-description">${pub.description}</p>
            <div class="pub-meta">
                <span>Autor: <strong>${pub.author_username}</strong></span>
                <span>Costo: <strong>${pub.blue_cost} BLUE</strong></span>
            </div>
            ${messageHTML}
            ${actionHTML}
        `;
    }

    async function fetchNotifications() {
        const response = await fetch(`http://localhost:3000/notifications/${storedUsername}`);
        const notifications = await response.json();
        
        const unreadCount = notifications.filter(n => n.is_read === 0).length;
        updateNotificationBadge(unreadCount);

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
        await fetch('http://localhost:3000/notifications/mark-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: storedUsername })
        });
        loadAllData();
    }

    async function fetchAndDisplayBalances() {
        try {
            const response = await fetch(`http://localhost:3000/users/${storedUsername}/balance`);
            const balances = await response.json();
            if (response.ok) {
                // Actualizamos la interfaz
                elements.saldoBlue.textContent = balances.blue_balance;
                elements.saldoRed.textContent = balances.red_balance;
                // Y también actualizamos el sessionStorage para mantenerlo sincronizado
                sessionStorage.setItem('blue_balance', balances.blue_balance);
                sessionStorage.setItem('red_balance', balances.red_balance);
            } else {
                console.error("Error al obtener saldos:", balances.message);
                elements.saldoBlue.textContent = 'Error';
                elements.saldoRed.textContent = 'Error';
            }
        } catch (error) {
            console.error("Error de red al obtener saldos:", error);
            elements.saldoBlue.textContent = 'Error';
            elements.saldoRed.textContent = 'Error';
        }
    }

    async function handleBurnSubmit(event) {
        event.preventDefault();
        const amountToBurn = parseInt(document.getElementById('burnAmount').value);
        const currentBlue = parseInt(elements.saldoBlue.textContent);

        // Validación del lado del cliente
        if (isNaN(amountToBurn) || amountToBurn <= 0) {
            alert("Por favor, ingresa un número positivo.");
            return;
        }
        if (amountToBurn > currentBlue) {
            alert("No puedes quemar más BLUE de los que tienes.");
            return;
        }
        
        const confirmation = confirm(`¿Estás seguro de que quieres quemar ${amountToBurn} BLUE y ${amountToBurn} RED? Esta acción no se puede deshacer.`);
        if (!confirmation) {
            return;
        }

        // Llamada al servidor
        await postToServer('/users/burn', { username: storedUsername, amount: amountToBurn });
        elements.burnModal.style.display = 'none'; // Cerrar el modal después del intento
        document.getElementById('burnAmount').value = ''; // Limpiar el input
    }
}); 