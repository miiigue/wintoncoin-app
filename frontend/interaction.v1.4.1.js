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

    function formatBalanceWithGrouping(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) {
            return formatBalance(value);
        }
        const fixed = num.toFixed(4);
        const [integerPart, decimalPart] = fixed.split('.');
        const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${grouped},<span class="decimal-part">${decimalPart}</span>`;
    }

    // --- Configuración Global ---
    // Lógica para determinar la URL del API automáticamente
    const API_URL = window.getApiUrl();

    // --- Estado Global y Elementos del DOM ---
    const storedUsername = localStorage.getItem('username');
    const elements = {
        usernameDisplay: document.getElementById('usernameDisplay'),
        profileTrigger: document.querySelector('.profile-trigger'),
        profileDropdown: document.getElementById('profileDropdown'),
        notificationTrigger: document.querySelector('.notification-trigger'),
        notificationDropdown: document.getElementById('notificationDropdown'),
        notificationBadge: document.getElementById('notificationBadge'),
        logoutLink: document.getElementById('logoutLink'),
        publicationsList: document.getElementById('publications-list'),
        publicationSortFilter: document.getElementById('publicationSortFilter'),
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
        // --- Elementos para el contador de disponibles ---
        availableCountdownContainer: document.getElementById('available-countdown-container'),
        availableCountdownText: document.getElementById('available-countdown-text'),
        publicationsCount: document.getElementById('publicationsCount'),
        boosterSummary: document.getElementById('boosterSummary'),
        boosterTotalBlue: document.getElementById('boosterTotalBlue'),
        boosterProgressText: document.getElementById('boosterProgressText'),
        boosterProgressFill: document.getElementById('boosterProgressFill'),
        authoredList: document.getElementById('authored-publications-list'),
        completedList: document.getElementById('completed-publications-list')
    };

    // Variable global para el intervalo del contador, para poder detenerlo
    let debtCountdownInterval = null;
    let escrowCountdownInterval = null;
    let availableCountdownInterval = null; // Nuevo intervalo para el saldo disponible
    let lastBoosterFetch = 0;

    // --- Lógica de Control de Funcionalidades ---
    // Escuchamos el evento personalizado para actualizar la UI según los permisos
    document.addEventListener('app-settings-loaded', checkPublicationPermissions);

    // NUEVO: Almacenamiento en caché para la configuración de la plataforma
    let platformSettingsCache = null;
    let publicationsCache = [];

    async function getPlatformSettings() {
        if (platformSettingsCache) {
            return platformSettingsCache;
        }
        try {
            const response = await fetch(`${API_URL}/api/platform-settings`);
            if (!response.ok) throw new Error('No se pudo cargar la configuración de la plataforma.');
            platformSettingsCache = await response.json();
            return platformSettingsCache;
        } catch (error) {
            console.error(error);
            // Devolver un objeto predeterminado en caso de error para no bloquear la UI
            return {
                pre_launch_mode_enabled: false,
                allow_request_publications: true,
                allow_sell_publications: true,
                allow_donation_publications: true
            };
        }
    }

    async function checkPublicationPermissions() {
        const settings = await getPlatformSettings();

        // 1. Manejo del Modal de Nueva Publicación (Solicitud, Venta, Donación)
        const modal = document.getElementById('publicationTypeModal');
        if (modal) {
        // Opciones del modal
        const requestOption = modal.querySelector('.modal-option-button.request');
        const sellOption = modal.querySelector('.modal-option-button.sell');
        const donationOption = modal.querySelector('.modal-option-button.donation');

        // Función para habilitar/deshabilitar opciones
        const toggleOption = (element, isEnabled) => {
            if (element) {
                element.classList.toggle('disabled', !isEnabled);
                if (!isEnabled) {
                    element.removeAttribute('onclick');
                    element.style.cursor = 'not-allowed';
            } else {
                    // Restaurar el comportamiento de clic con un event listener más robusto
const type = element.classList.contains('request') ? 'request' : (element.classList.contains('sell') ? 'sell' : 'donation');
// Limpiamos cualquier listener anterior para evitar duplicados
const newElement = element.cloneNode(true);
element.parentNode.replaceChild(newElement, element);
// Añadimos el nuevo listener
newElement.addEventListener('click', () => {
    // Pequeña demora para asegurar que el estado de la sesión se propague
    setTimeout(() => {
        window.location.href = `publish.html?type=${type}`;
    }, 50); // 50ms es imperceptible para el usuario
});
newElement.style.cursor = 'pointer';
                }
            }
        };

        toggleOption(requestOption, settings.allow_request_publications);
        toggleOption(sellOption, settings.allow_sell_publications);
        toggleOption(donationOption, settings.allow_donation_publications);

        // Mostrar un mensaje si todas están deshabilitadas
        const noOptionsMessage = modal.querySelector('#no-options-message');
        if (!settings.allow_request_publications && !settings.allow_sell_publications && !settings.allow_donation_publications) {
            if (noOptionsMessage) {
                noOptionsMessage.style.display = 'block';
            } else {
                const messageDiv = document.createElement('p');
                messageDiv.id = 'no-options-message';
                messageDiv.textContent = 'La creación de nuevas publicaciones está temporalmente desactivada.';
                messageDiv.style.textAlign = 'center';
                messageDiv.style.marginTop = '1rem';
                modal.querySelector('.modal-options').appendChild(messageDiv);
            }
        } else {
            if (noOptionsMessage) noOptionsMessage.style.display = 'none';
            }
        }

        // 2. Manejo del Botón de Venta Rápida
        const quickSaleBtn = document.getElementById('openQuickSaleModalBtn');
        if (quickSaleBtn) {
            if (settings.allow_quick_sale_publications === false) {
                quickSaleBtn.style.display = 'none';
            } else {
                quickSaleBtn.style.display = 'inline-flex'; // O 'flex' según el CSS original, inline-flex suele ser seguro para botones
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
    elements.saldoBlue.innerHTML = formatBalance(localStorage.getItem('blue_balance'));
    elements.saldoEscrowBlue.innerHTML = formatBalance(localStorage.getItem('escrow_blue_balance'));
    elements.saldoRed.innerHTML = formatBalance(localStorage.getItem('red_balance'));

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
        fetchBoosterSummary();
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
                    // NOTA: Ya no marcamos automáticamente como leídas al abrir el dropdown
                    // Las notificaciones solo se marcan como leídas cuando el usuario hace clic en la X individual
                    // o en "Limpiar todas las notificaciones"
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
        if (elements.publicationSortFilter) {
            elements.publicationSortFilter.addEventListener('change', () => {
                // Reaplica el orden/filtro al cambiar la selección.
                renderPublicationsWithFilters();
            });
        }
        elements.burnTriggerBtn.addEventListener('click', () => {
            // Actualizamos los saldos en el modal cada vez que se abre
            const blueBalance = localStorage.getItem('blue_balance') || '0';
            const escrowBlueBalance = localStorage.getItem('escrow_blue_balance') || '0';
            const redBalance = localStorage.getItem('red_balance') || '0';
            const penalizedDebt = localStorage.getItem('penalized_debt') || '0';

            let penalizedDebtHTML = '';
            // Solo mostramos la línea de vencidos si la cantidad es mayor a cero.
            if (parseFloat(penalizedDebt) > 0.00009) {
                penalizedDebtHTML = `
                    <div class="balance-line">
                        <span>Vencidos</span>
                        <span class="saldo-red-text">${formatBalance(penalizedDebt)} RED</span>
                    </div>
                `;
            }
            
            elements.burnModalBalances.innerHTML = `
                <div class="balance-line">
                    <span>Disponible</span>
                    <span class="saldo-blue-text">${formatBalance(blueBalance)} BLUE</span>
                </div>
                <div class="balance-line">
                    <span>Pendientes</span>
                    <span class="saldo-escrow-text">${formatBalance(escrowBlueBalance)} BLUE</span>
                </div>
                <hr class="burn-modal-divider">
                <div class="balance-line">
                    <span>Deuda Total</span>
                    <span class="saldo-red-text">${formatBalance(redBalance)} RED</span>
                </div>
                ${penalizedDebtHTML}
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
            // NUEVO: Verificar permisos antes de mostrar
            checkPublicationPermissions(); 
            document.getElementById('publicationTypeModal').style.display = 'flex';
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
        localStorage.removeItem('username');
        localStorage.removeItem('blue_balance');
        localStorage.removeItem('escrow_blue_balance');
        localStorage.removeItem('red_balance');
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
    const { silent = false, reload = true } = options;
    try {
        // Profesional: adjuntar el token si existe para que el backend use userId como fuente de verdad.
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        // Leemos la respuesta como texto para evitar errores de parseo JSON.
        const responseText = await response.text();
        let result;

        try {
            // Intentamos interpretar el texto como JSON.
            result = JSON.parse(responseText);
        } catch (e) {
            // Si falla, es que el servidor devolvió un error no-JSON (ej. HTML de error).
            // Lo tratamos como un error y mostramos el texto.
            console.error("Respuesta no-JSON del servidor:", responseText);
            // Mostramos el texto del error en nuestro modal personalizado.
            showCustomAlert(responseText || `Error inesperado del servidor.`);
            throw new Error("Respuesta no-JSON del servidor");
        }

        if (!response.ok) {
            showCustomAlert(result.message || `Error en el servidor: ${response.status}`);
            throw new Error(result.message || `Error en el servidor`);
        }

        if (!silent && result.message) {
            showCustomAlert(result.message);
        }

        if (response.ok && reload) {
            loadAllData();
        }

        return result;

    } catch (error) {
        // Este catch ahora solo se activará para errores de red o los que lanzamos nosotros.
        // El mensaje ya se habrá mostrado al usuario.
        console.error(`Error en postToServer (${endpoint}):`, error);
        // Devolvemos una promesa rechazada para que las funciones que llaman a esta sepan que falló.
        return Promise.reject(error);
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
                updatePublicationsCount([]);
            return;
            }

            publicationsCache = publications;
            await renderPublicationsWithFilters();

        } catch (error) {
            console.error('Error al obtener publicaciones:', error);
            elements.publicationsList.innerHTML = '<p>No se pudo conectar con el servidor para obtener las publicaciones.</p>';
        }
    }

    async function fetchBoosterSummary() {
        if (!elements.boosterSummary) {
            return;
        }

        const now = Date.now();
        if (now - lastBoosterFetch < 60000) {
            return;
        }
        lastBoosterFetch = now;

        const token = localStorage.getItem('token');
        if (!token) {
            elements.boosterSummary.style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/me/booster-profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();

            if (!response.ok || !result?.is_booster) {
                elements.boosterSummary.style.display = 'none';
                return;
            }

            const totalBoosterBlue = Number(result.total_booster_blue || 0);
            const currentLevel = Number(result.booster_level || 0);
            const tasksCompleted = Number(result.booster_tasks_completed_count || 0);
            const nextLevel = result.next_level_info;
            const nextMin = nextLevel ? Number(nextLevel.min_blue_required || 0) : 0;

            if (elements.boosterTotalBlue) {
                const formattedBlue = formatBalance(totalBoosterBlue);
                const formattedGroupedBlue = formatBalanceWithGrouping(totalBoosterBlue);
                elements.boosterTotalBlue.innerHTML = `<span class="booster-total-value">${formattedGroupedBlue}</span> <span class="booster-total-unit">BLUE iou</span>`;
            }

            let progressPercent = 100;
            let progressText = 'Nivel máximo alcanzado';
            if (nextMin > 0) {
                progressPercent = Math.min(100, (totalBoosterBlue / nextMin) * 100);
                progressText = `${totalBoosterBlue.toFixed(4)} / ${nextMin.toFixed(4)} BLUE iou`;
            }

            if (elements.boosterProgressText) {
                elements.boosterProgressText.textContent = progressText;
            }
            if (elements.boosterProgressFill) {
                elements.boosterProgressFill.style.width = `${progressPercent}%`;
            }

            elements.boosterSummary.style.display = 'block';
        } catch (error) {
            console.error('Error al cargar el resumen de impulsor:', error);
            elements.boosterSummary.style.display = 'none';
        }
    }

    function getPublicationType(pub) {
        // Determina el tipo de publicación para filtrar.
        if (pub.category === 'donation') {
            return 'donation';
        }
        if (pub.is_sell_post) {
            return 'sell';
        }
        return 'request';
    }

    function getPublicationTimestamp(pub) {
        // Usa la fecha de creación si existe; si no, usa el ID como fallback.
        const dateValue = pub.created_at || pub.createdAt || pub.created_date || pub.createdDate;
        const date = dateValue ? new Date(dateValue) : null;
        if (date && !Number.isNaN(date.getTime())) {
            return date.getTime();
        }
        return Number(pub.id) || 0;
    }

    function applySortAndFilter(publications) {
        // Aplica el criterio seleccionado (orden o filtro por tipo).
        const selected = elements.publicationSortFilter?.value || 'recent';
        let result = [...publications];

        if (!selected) {
            return sortByPendingPriority(result);
        }

        if (selected === 'type_request' || selected === 'type_sell' || selected === 'type_donation') {
            const desiredType = selected.replace('type_', '');
            result = result.filter((pub) => getPublicationType(pub) === desiredType);
        }

        if (selected === 'pending') {
            result = result.filter((pub) => isPendingForUser(pub));
            return sortByPendingPriority(result);
        }

        if (selected === 'recent' || selected === 'oldest') {
            result.sort((a, b) => {
                const diff = getPublicationTimestamp(b) - getPublicationTimestamp(a);
                return selected === 'recent' ? diff : -diff;
            });
        }

        if (selected === 'reward_desc' || selected === 'reward_asc') {
            result.sort((a, b) => {
                const diff = (Number(b.blue_cost) || 0) - (Number(a.blue_cost) || 0);
                return selected === 'reward_desc' ? diff : -diff;
            });
        }

        return result;
    }

    function updatePublicationsCount(publications) {
        if (!elements.publicationsCount) {
            return;
        }
        const totalCount = (publications || []).length;
        elements.publicationsCount.textContent = String(totalCount);
    }

    function isPendingForUser(pub) {
        const status = pub.user_acceptance_status;
        return status === 'approved' || status === 'pending_approval' || status === 'completed';
    }

    function getPendingPriority(pub) {
        const status = pub.user_acceptance_status;
        if (status === 'approved') return 0;
        if (status === 'pending_approval') return 1;
        if (status === 'completed') return 2;
        return 3;
    }

    function sortByPendingPriority(publications) {
        return [...publications].sort((a, b) => {
            const priorityDiff = getPendingPriority(a) - getPendingPriority(b);
            if (priorityDiff !== 0) return priorityDiff;
            return getPublicationTimestamp(b) - getPublicationTimestamp(a);
        });
    }

    async function renderPublicationsWithFilters() {
        if (!elements.publicationsList) {
            return;
        }
        const filteredPublications = applySortAndFilter(publicationsCache);
        if (filteredPublications.length === 0) {
            elements.publicationsList.innerHTML = '<p class="empty-message">No hay publicaciones para este filtro.</p>';
            updatePublicationsCount([]);
            return;
        }

        updatePublicationsCount(filteredPublications);
        const platformSettings = await getPlatformSettings();

        // Un mapa para cachear las calificaciones de los usuarios.
        const userRatingsCache = new Map();

        // Usamos Promise.all para obtener todas las calificaciones en paralelo, lo que es más eficiente.
        const publicationsHTML = await Promise.all(filteredPublications.map(async (pub) => {
            // 1. Obtener calificación del AUTOR
            if (!userRatingsCache.has(pub.author_username)) {
                const ratingData = await fetchUserRating(pub.author_username);
                userRatingsCache.set(pub.author_username, ratingData);
            }
            const authorRating = userRatingsCache.get(pub.author_username);
            const authorRatingHTML = generateStarRating(authorRating.average, authorRating.count);

            // 2. OBTENER EL MENSAJE DE ESTADO PARA LA TARJETA
            const statusMessageHTML = getCardStatusMessageHTML(pub);

            // 3. Pasamos la publicación completa y los datos generados para crear el HTML
            return getFullPublicationHTML(pub, authorRatingHTML, statusMessageHTML, platformSettings);
        }));

        elements.publicationsList.innerHTML = publicationsHTML.join('');
    }

    // --- Funciones de Renderizado ---

    /**
     * NUEVO: Genera un banner de estado para la tarjeta si el usuario actual tiene un estado específico.
     * @param {object} pub La publicación.
     * @returns {string} El HTML del banner o un string vacío.
     */
    function getCardStatusMessageHTML(pub) {
        const userStatus = pub.user_acceptance_status;
        let message = '';
        let className = '';
    
        if (userStatus === 'approved') {
            // Lógica diferencial para 'Aprobado'
            if (pub.is_sell_post) {
                message = 'Completa el pago para recibir el producto.';
            } else {
                message = '¡Aprobado! Ya puedes realizar la tarea.';
            }
            className = 'status-approved';
        } else if (userStatus === 'completed') {
            // Lógica diferencial para 'Culminado'
            if (pub.is_sell_post) {
                message = 'Pago realizado. Esperando confirmación del vendedor.';
            } else {
                message = 'Tarea culminada. Esperando confirmación.';
            }
            className = 'status-completed';
        } else if (userStatus === 'pending_approval') {
            message = 'Solicitud enviada. Esperando aprobación.';
            className = 'status-pending';
        }
    
        if (message) {
            return `<div class="publication-status-banner ${className}">${message}</div>`;
        }
        return '';
    }
    
    function isPlatformPublication(pub, platformSettings) {
        const platformUsername = String(platformSettings?.platform_username || 'Plataforma WintonCoin').toLowerCase();
        const author = String(pub.author_username || '').toLowerCase();
        return author === platformUsername || author === 'plataforma';
    }

    function getBlueUnitLabel(pub, platformSettings) {
        if (platformSettings?.pre_launch_mode_enabled && isPlatformPublication(pub, platformSettings)) {
            return 'BLUE iou';
        }
        return 'BLUE';
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

    function getFullPublicationHTML(pub, ratingHTML, statusMessageHTML, platformSettings) {
        const rewardText = `${formatBalance(pub.blue_cost)} ${getBlueUnitLabel(pub, platformSettings)}`;
        const { mainText } = splitDescriptionWithSteps(pub.description);

        // Determinamos la clase de la cinta según la categoría y si es de impulsor
        let ribbonClass = '';
        if (pub.is_booster_task) {
            ribbonClass = 'booster-ribbon';
        } else if (pub.category === 'donation') {
            ribbonClass = 'donation-ribbon';
        } else if (pub.is_sell_post) {
            ribbonClass = 'sell-ribbon';
        }

        const slotsClass = pub.available_slots > 0 ? 'available' : 'full';
        const slotsText = pub.available_slots > 0
            ? `${pub.available_slots} cupo${pub.available_slots > 1 ? 's' : ''} disponible${pub.available_slots > 1 ? 's' : ''}`
            : `Cupos agotados`;

        // NUEVO: Lógica de expiración
        const expirationInfo = getExpirationStatusHTML(pub);
    
        const authorNameHTML = window.appSettings.public_profiles_enabled
            ? `<a href="profile.html?user=${pub.author_username}" class="profile-link" onclick="event.stopPropagation()">${pub.author_username}</a>`
            : pub.author_username;
    
        // Envolvemos toda la tarjeta en una etiqueta <a> para que sea un enlace.
        // El `onclick="event.stopPropagation()"` en el enlace del perfil evita que al hacer clic en el nombre también se dispare el clic de la tarjeta.
        return `
            <a href="publication-detail.html?id=${pub.id}" class="publication-item-link">
                <div class="publication-item ${expirationInfo.isExpired ? 'expired' : ''}" data-id="${pub.id}" data-author="${pub.author_username}">
                    ${statusMessageHTML}
                    <div class="cost-ribbon ${ribbonClass}">${rewardText}</div>
                    
                    <div class="publication-header">
                        <h3>${pub.title}</h3>
                    </div>
                    
                    <p class="pub-description">${linkify(mainText)}</p>
                    
                    <div class="publication-footer">
                        <div class="pub-meta">
                            <span>Por: <strong>${authorNameHTML}</strong></span>
                            ${ratingHTML}
                        </div>
                        <div class="pub-meta-right">
                            <div class="slots-info ${slotsClass}">
                                ${slotsText}
                            </div>
                            ${expirationInfo.html}
                        </div>
                    </div>
    
                    <!-- Las acciones y mensajes ahora se mostrarán en la página de detalle, 
                         pero podemos dejar un resumen o un indicador si es necesario. 
                         Por ahora, lo mantenemos limpio. -->
                </div>
            </a>
        `;
    }

    /**
     * NUEVO: Calcula y formatea el estado de expiración de una publicación.
     * @param {object} pub La publicación.
     * @returns {{html: string, isExpired: boolean}}
     */
    function getExpirationStatusHTML(pub) {
        if (!pub.expires_at) {
            return { html: '', isExpired: false };
        }

        const now = new Date();
        const expirationDate = new Date(pub.expires_at);
        const diff = expirationDate - now;

        if (diff <= 0) {
            return {
                html: `<div class="expiration-info expired"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Expirada</div>`,
                isExpired: true
            };
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        let timeLeft = '';
        if (days > 1) {
            timeLeft = `Vence en ${days} días`;
        } else if (days === 1) {
            timeLeft = `Vence en ${days} día`;
        } else if (hours > 1) {
            timeLeft = `Vence en ${hours} horas`;
        } else if (hours === 1) {
             timeLeft = `Vence en ${hours} hora`;
        } else if (minutes > 0) {
            timeLeft = `Vence en ${minutes} min`;
        } else {
            timeLeft = `Vence en <1 min`;
        }

        return {
            html: `<div class="expiration-info"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${timeLeft}</div>`,
            isExpired: false
        };
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
                    case 'pending_approval':
                        messageHTML = `<div class="status-pending">Tu solicitud de compra ha sido enviada. Esperando aprobación del vendedor.</div>`;
                        break;
                    case 'approved':
                        messageHTML = `<div class="action-message">¡Aprobado! Por favor, confirma el pago una vez que hayas recibido el producto o servicio.</div>`;
                        actionHTML = `<button class="action-button complete" data-id="${pub.id}" data-action="complete">He Recibido, Pagar</button>`;
                        break;
                    case 'completed':
                        messageHTML = `<p class="action-message status-pending">Has marcado la compra como completada. Esperando confirmación final del vendedor.</p>`;
                        break;
                    case 'confirmed_paid':
                        messageHTML = `<p class="action-message status-info">¡Compra completada!</p>`;
                        // Solo permitir "comprar de nuevo" si la publicación permite repetición
                        if (pub.available_slots > 0 && pub.allow_repeat_participation) {
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
                        // Solo permitir "aceptar nuevamente" si la publicación permite repetición
                        if (pub.available_slots > 0 && pub.allow_repeat_participation) {
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
            // Profesional: traer mis notificaciones vía token (no por username en URL).
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/me/notifications`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
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
            await postToServer('/api/me/notifications/mark-read', {}, { silent: true, reload: false });
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
            await postToServer(`/api/me/notifications/${notificationId}/dismiss`, {}, { silent: true, reload: false });
        } catch (error) {
            console.error("Error al descartar la notificación en el servidor:", error);
        }
    }

    async function clearAllNotifications() {
        try {
            // Llamada silenciosa y sin recarga
            const response = await postToServer('/api/me/notifications/mark-read', {}, { silent: true, reload: false });
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
            const token = localStorage.getItem('token');
            // Añadimos un parámetro que cambia con el tiempo para evitar la caché del navegador.
            const response = await fetch(`${API_URL}/api/me/balance?t=${new Date().getTime()}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (response.ok) {
                const data = await response.json();
                elements.saldoBlue.innerHTML = formatBalance(data.blue_balance);
                elements.saldoEscrowBlue.innerHTML = formatBalance(data.escrow_blue_balance);
                elements.saldoRed.innerHTML = formatBalance(data.red_balance);
                localStorage.setItem('blue_balance', data.blue_balance);
                localStorage.setItem('escrow_blue_balance', data.escrow_blue_balance);
                localStorage.setItem('red_balance', data.red_balance);
                localStorage.setItem('penalized_debt', data.penalized_debt);

                // NO actualizamos el modal de quemado aquí. Se hará solo al abrirlo.

                // --- Contador para Saldo Disponible (BLUE) ---
                if (data.next_available_at && parseFloat(data.next_available_amount) > 0) {
                    elements.availableCountdownContainer.style.display = 'block';
                    startAvailableCountdown(data.next_available_at, data.next_available_amount);
                } else {
                    elements.availableCountdownContainer.style.display = 'none';
                    if (availableCountdownInterval) clearInterval(availableCountdownInterval);
                }

                // --- Contador para Deuda (RED) ---
                if (data.next_due_at && parseFloat(data.next_due_amount) > 0) {
                    elements.debtCountdownContainer.style.display = 'block';
                    startDebtCountdown(data.next_due_at, data.next_due_amount);
                } else {
                    elements.debtCountdownContainer.style.display = 'none';
                    if (debtCountdownInterval) clearInterval(debtCountdownInterval);
                }

                // --- Contador para Escrow (PENDIENTES) ---
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
            // Si falla la carga, también ocultamos todos los contadores para evitar mostrar datos incorrectos
            if (debtCountdownInterval) clearInterval(debtCountdownInterval);
            if (elements.debtCountdownContainer) elements.debtCountdownContainer.style.display = 'none';
            if (escrowCountdownInterval) clearInterval(escrowCountdownInterval);
            if (elements.escrowCountdownContainer) elements.escrowCountdownContainer.style.display = 'none';
            if (availableCountdownInterval) clearInterval(availableCountdownInterval);
            if (elements.availableCountdownContainer) elements.availableCountdownContainer.style.display = 'none';
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

    /**
     * Inicia y actualiza el contador de saldo disponible (BLUE) cada segundo.
     * @param {string} availableDateString La fecha de liberación en formato ISO (viene del backend).
     */
    function startAvailableCountdown(availableDateString, availableAmount) {
        if (availableCountdownInterval) clearInterval(availableCountdownInterval);
        const formattedAmount = formatBalance(availableAmount);

        const updateTimer = () => {
            const now = new Date();
            const availableDate = new Date(availableDateString);
            const diff = availableDate - now;

            if (diff <= 0) {
                elements.availableCountdownContainer.style.display = 'none';
                clearInterval(availableCountdownInterval);
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

            elements.availableCountdownText.innerHTML = `Disponible <strong class="saldo-blue-text">${formattedAmount}</strong> en <strong>${timeString}</strong>`;
        };
        
        updateTimer();
        availableCountdownInterval = setInterval(updateTimer, 1000);
    }

    /**
     * Carga la configuración de referidos desde el backend y actualiza el monto mostrado.
     */
    async function loadReferralSettings() {
        try {
            console.log('🔄 Cargando configuración de referidos...');
            const response = await fetch(`${API_URL}/api/referral-settings`);
            console.log('📡 Respuesta del servidor:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('📊 Datos recibidos:', data);
                
                const amountElement = document.getElementById('referralAmount');
                console.log('🎯 Elemento encontrado:', amountElement);
                
                if (amountElement && data.referral_bonus_amount) {
                    // Intentar parsear como número
                    const amount = parseInt(parseFloat(data.referral_bonus_amount));
                    console.log('💰 Monto calculado:', amount);
                    
                    if (!isNaN(amount)) {
                        amountElement.textContent = amount;
                        console.log('✅ Monto actualizado en el DOM:', amount);
                    } else {
                        console.log('❌ Valor no es un número válido:', data.referral_bonus_amount);
                        amountElement.textContent = '10'; // Valor por defecto
                    }
                } else {
                    console.log('❌ Elemento no encontrado o datos faltantes');
                    console.log('Elemento:', amountElement);
                    console.log('Datos:', data);
                }
            } else {
                console.log('❌ Error en la respuesta:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('❌ Error al cargar configuración de referidos:', error);
        }
    }

    // Cargar configuración de referidos al inicializar
    loadReferralSettings();

    /**
     * Función para compartir el código de referido
     */
    async function shareReferralCode() {
        try {
            const username = localStorage.getItem('username');
            if (!username) {
                showCustomAlert('Error: No se pudo obtener tu información de usuario.');
                return;
            }

            // Obtener el código de referido del usuario actual y la fecha de vigencia
            const [referralResponse, expiryResponse] = await Promise.all([
                fetch(`${API_URL}/api/users/${username}/referral-info`),
                fetch(`${API_URL}/api/referral-expiry-date`)
            ]);

            if (referralResponse.ok) {
                const data = await referralResponse.json();
                const referralCode = data.referral_code;
                const rewardAmount = document.getElementById('referralAmount').textContent || '50';
                const registrationUrl = `${window.location.origin}/register.html?ref=${referralCode}`;
                
                // Formatear fecha de vigencia si está disponible
                let expiryText = '';
                if (expiryResponse.ok) {
                    try {
                        const expiryData = await expiryResponse.json();
                        if (expiryData.expiry_date) {
                            const expiryDate = new Date(expiryData.expiry_date);
                            // Validar que la fecha sea válida antes de formatear
                            if (!isNaN(expiryDate.getTime())) {
                                const formattedDate = expiryDate.toLocaleDateString('es-ES', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                });
                                expiryText = `\n⏰ Válido hasta el ${formattedDate}\n`;
                            }
                        }
                    } catch (error) {
                        console.warn('Error al formatear fecha de vigencia:', error);
                        // Continuar sin fecha si hay error
                    }
                }
                
                const textToShare = `¡Únete a WintonCoin! 🪙\n\n` +
                                  `Entra a mi enlace de referidos y acumula ${rewardAmount} BLUE (IOU) al registrarte:\n` +
                                  `*${referralCode}*` +
                                  expiryText + `\n` +
                                  `¡Lo mejor es que tú también ganarás ${rewardAmount} BLUE por cada amigo que invites!\n\n` +
                                  `Regístrate aquí: ${registrationUrl}`;

                // Intentar usar la API de Web Share si está disponible
                if (navigator.share) {
                    await navigator.share({
                        title: '¡Únete a WintonCoin!',
                        text: textToShare,
                        url: registrationUrl
                    });
                } else {
                    // Fallback: copiar al portapapeles
                    await navigator.clipboard.writeText(textToShare);
                    showCustomAlert('¡Mensaje de invitación copiado! Compártelo con tus amigos.');
                }
            } else {
                showCustomAlert('Error al obtener tu código de referido.');
            }
        } catch (error) {
            console.error('Error al compartir código de referido:', error);
            showCustomAlert('Error al compartir el código de referido.');
        }
    }

    // Agregar event listener para el botón de compartir
    const shareReferralCard = document.getElementById('shareReferralCard');
    if (shareReferralCard) {
        shareReferralCard.addEventListener('click', shareReferralCode);
    }

    // --- NUEVO: Lógica para Venta Rápida ---
    const quickSaleModal = document.getElementById('quickSaleModal');
    const openQuickSaleModalBtn = document.getElementById('openQuickSaleModalBtn');
    const quickSaleCloseBtn = document.querySelector('.quick-sale-close');
    const quickSaleForm = document.getElementById('quickSaleForm');

    const qrCodeModal = document.getElementById('qrCodeModal');
    const qrCodeCloseBtn = document.querySelector('.qr-code-close');
    const qrCodeOutput = document.getElementById('qrCodeOutput');
    const qrCodeUrlInput = document.getElementById('qrCodeUrl');
    const copyQrCodeUrlBtn = document.getElementById('copyQrCodeUrl');

    let qrCodeInstance = null; // Para mantener la instancia del QR y poder limpiarla

    openQuickSaleModalBtn.addEventListener('click', (e) => {
        e.preventDefault();
        quickSaleModal.style.display = 'flex';
    });

    quickSaleCloseBtn.addEventListener('click', () => {
        quickSaleModal.style.display = 'none';
    });
    
    qrCodeCloseBtn.addEventListener('click', () => {
        qrCodeModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == quickSaleModal) {
            quickSaleModal.style.display = 'none';
        }
        if (event.target == qrCodeModal) {
            qrCodeModal.style.display = 'none';
        }
    });

    quickSaleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(quickSaleForm);
        const data = {
            title: formData.get('title'),
            amount: formData.get('amount'),
            targetUsername: formData.get('targetUsername'),
            authorUsername: storedUsername
        };

        try {
            // Usamos nuestra función robusta para manejar la petición y los errores.
            // La opción reload: false evita que se recargue toda la lista de publicaciones.
            const result = await postToServer('/api/quick-sale', data, { reload: false });

            if (result) {
                // 1. Ocultar modal de formulario y resetearlo
                quickSaleModal.style.display = 'none';
                quickSaleForm.reset();

                // 2. Generar URL y mostrar modal de QR
                const publicationUrl = `${window.location.origin}/publication-detail.html?id=${result.publicationId}`;
                
                // Limpiar QR anterior si existe
                qrCodeOutput.innerHTML = ''; 
                
                // Crear nueva instancia de QRCode
                qrCodeInstance = new QRCode(qrCodeOutput, {
                    text: publicationUrl,
                    width: 256,
                    height: 256,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.H
                });

                qrCodeUrlInput.value = publicationUrl;
                qrCodeModal.style.display = 'flex';
            }
            // El `else` ya no es necesario, porque si hay un error, postToServer lo lanzará y será capturado abajo.

        } catch (error) {
            // El error ya fue mostrado al usuario por postToServer.
            // Simplemente lo registramos en la consola para depuración.
            console.error('Error al crear la Venta Rápida:', error);
        }
    });

    copyQrCodeUrlBtn.addEventListener('click', () => {
        qrCodeUrlInput.select();
        document.execCommand('copy');
        showCustomAlert('¡Enlace copiado al portapapeles!');
    });
}); 
