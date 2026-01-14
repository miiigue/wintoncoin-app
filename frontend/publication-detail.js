document.addEventListener('DOMContentLoaded', () => {

    // --- Configuración y Estado ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';
    
    const storedUsername = localStorage.getItem('username');
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

    // --- Inicialización ---
    // Carga paralela de la configuración y los datos de la publicación para optimizar la velocidad.
    async function initializePage() {
        try {
            // Iniciar ambas solicitudes en paralelo
            const settingsPromise = window.fetchAndStoreAppSettings(); // de utils.js
            const platformSettingsPromise = fetch(`${API_URL}/api/platform-settings`).then(async (response) => {
                if (!response.ok) return {};
                return response.json();
            });
            const publicationPromise = fetch(`${API_URL}/api/publications/${publicationId}?user=${storedUsername}`);

            // Esperar a que ambas se completen
            const [_, platformSettings, publicationResponse] = await Promise.all([settingsPromise, platformSettingsPromise, publicationPromise]);

            if (!publicationResponse.ok) {
                const errorData = await publicationResponse.json();
                throw new Error(errorData.message || 'Error al cargar la publicación.');
            }
            
            const publication = await publicationResponse.json();
            
            // Ahora que tenemos todo, renderizamos la página y configuramos los eventos
            renderPublication(publication, platformSettings);
            setupEventListeners();

        } catch (error) {
            console.error('Error al inicializar la página de detalle:', error);
            elements.content.innerHTML = `<p class="error-message">No se pudo cargar la publicación. ${error.message}</p>`;
        }
    }

    initializePage();

    // La función fetchAndRenderPublication() ya no es necesaria, su lógica ha sido integrada en initializePage().


    // --- Lógica de Renderizado ---
    function normalizeMultilineText(text) {
        // Normaliza saltos de línea y elimina indentación común
        // para mejorar legibilidad en móvil (evita "primera línea corrida/centrada").
        const raw = String(text || '').replace(/\r\n/g, '\n');
        const lines = raw.split('\n').map(l => l.replace(/[ \t]+$/g, '')); // trim end

        const indents = lines
            .filter(l => l.trim().length > 0)
            .map(l => (l.match(/^[ \t]*/) || [''])[0].length);

        const minIndent = indents.length ? Math.min(...indents) : 0;
        const normalized = lines.map(l => l.slice(minIndent));

        return normalized.join('\n').trim();
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

    function renderPublication(pub, platformSettings) {
        const authorRatingHTML = generateStarRating(pub.author_average_rating, pub.author_ratings_count);
        
        const authorNameHTML = window.appSettings.public_profiles_enabled
            ? `<a href="profile.html?user=${pub.author_username}" class="profile-link">${pub.author_username}</a>`
            : pub.author_username;

        // NUEVO: Obtener el estado de la vigencia
        const expirationInfo = getExpirationStatusHTML(pub);

        // Lógica para añadir el botón de compartir en la cabecera
        // Ahora el botón se muestra siempre, permitiendo al autor compartir su propia publicación.
        const shareButtonHTML = `<button class="action-button share share-button-header" data-action="share">🔗 Compartir</button>`;

        const blueLabel = getBlueUnitLabel(pub, platformSettings);
        const { messageHTML, actionHTML } = getActionAndMessageHTML(pub, expirationInfo.isExpired, blueLabel);

        let ribbonClass = '';
        if (pub.category === 'donation') {
            ribbonClass = 'donation-ribbon';
        } else if (pub.is_sell_post) {
            ribbonClass = 'sell-ribbon';
        }

        const publicationHTML = `
            <div class="detail-header">
                <span class="detail-cost-badge ${ribbonClass}">${formatBalance(pub.blue_cost)} ${blueLabel}</span>
                <h1 class="detail-title">${pub.title}</h1>
                <div class="detail-meta">
                    Publicado por <strong>${authorNameHTML}</strong> ${authorRatingHTML}
                    <span class="detail-date">el ${new Date(pub.created_at).toLocaleDateString()}</span>
                    ${expirationInfo.html}
                </div>
            </div>

            <div class="share-button-container">
                ${shareButtonHTML}
            </div>

            <hr>

            <div class="detail-description">
                ${linkify(normalizeMultilineText(pub.description))}
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
            } else if (p.status === 'approved') {
                // NUEVO: Si el participante está aprobado, el autor ve el botón de WhatsApp
                if (p.phone_number) {
                    const whatsappLink = `https://wa.me/${p.phone_number.replace(/\D/g, '')}`;
                    actionButtons += `
                        <a href="${whatsappLink}" target="_blank" class="action-button whatsapp-button" title="Contactar por WhatsApp">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                            Contactar
                        </a>
                    `;
                }
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

    function getActionAndMessageHTML(pub, isExpired, blueLabel = 'BLUE') {
        const currentUser = storedUsername;

        // --- LÓGICA ESPECIAL PARA VENTA RÁPIDA ---
        if (pub.is_quick_sale) {
            let messageHTML = '';
            let actionHTML = '';

            if (isExpired) {
                messageHTML = `<div class="status-info">Esta Venta Rápida ha expirado.</div>`;
                return { messageHTML, actionHTML };
            }

            const isAuthor = currentUser === pub.author_username;
            const isTargetedBuyer = currentUser === pub.target_username;
            const isPublicSale = !pub.target_username;

            if (isAuthor) {
                // VISTA DEL VENDEDOR: Mostrar el QR y el enlace
                const publicationUrl = `${window.location.origin}/publication-detail.html?id=${pub.id}`;
                actionHTML = `
                    <div class="qr-code-container">
                        <h2>Comparte este QR para recibir tu pago</h2>
                        <p>El enlace de pago es válido por 5 minutos desde su creación.</p>
                        <div id="qrCodeOutput_detail"></div>
                        <input type="text" id="qrCodeUrl_detail" value="${publicationUrl}" readonly>
                        <button id="copyQrCodeUrl_detail" class="action-button">Copiar Enlace</button>
                    </div>
                `;
                // Usamos un setTimeout para asegurarnos de que el HTML esté en el DOM antes de generar el QR
                setTimeout(() => {
                    new QRCode(document.getElementById("qrCodeOutput_detail"), {
                        text: publicationUrl,
                        width: 200,
                        height: 200
                    });
                    document.getElementById('copyQrCodeUrl_detail').addEventListener('click', () => {
                        const urlInput = document.getElementById('qrCodeUrl_detail');
                        urlInput.select();
                        document.execCommand('copy');
                        showCustomAlert('¡Enlace copiado al portapapeles!');
                    });
                }, 100);

            } else if (isTargetedBuyer || (isPublicSale && !isAuthor)) {
                // VISTA DEL COMPRADOR
                messageHTML = `<div class="action-message">Estás a punto de pagar <strong>${formatBalance(pub.blue_cost)} ${blueLabel}</strong> a <strong>${pub.author_username}</strong>.</div>`;
                actionHTML = `<button class="action-button confirm" data-action="pay-quick-sale">Pagar Ahora</button>`;
            } else {
                // Si alguien que no es ni el autor ni el comprador objetivo intenta acceder
                // (aunque el backend ya debería haberlo bloqueado con un 404, esta es una capa extra)
                 messageHTML = `<div class="status-info">No tienes permiso para ver o actuar en esta venta.</div>`;
            }
            return { messageHTML, actionHTML };
        }
        // --- FIN DE LÓGICA ESPECIAL ---

        // Lógica original para publicaciones normales
        const userStatus = pub.user_acceptance_status;
        let messageHTML = '';
        let actionHTML = '';

        if (currentUser === pub.author_username) {
            const hasActiveParticipants = pub.participants.some(p => ['approved', 'completed'].includes(p.status));
            const allParticipantsPaid = pub.participants.every(p => p.status === 'confirmed_paid');
            const canDelete = !hasActiveParticipants;
            const canManagePause = !allParticipantsPaid && !isExpired;

            if (pub.participants.length === 0 && !isExpired) {
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
            let verb;
            if (pub.category === 'donation') {
                verb = 'Donar/Ayudar';
            } else {
                verb = pub.is_sell_post ? 'Comprar' : 'Aceptar Tarea';
            }
            const action = pub.is_sell_post ? 'comprado' : 'realizado';
            
            if (isExpired) {
                messageHTML = `<div class="status-info">Esta tarea ha expirado y ya no acepta nuevos participantes.</div>`;
                return { messageHTML, actionHTML };
            }

            switch (userStatus) {
                case 'pending_approval':
                    messageHTML = `<div class="status-pending">Tu solicitud ha sido enviada. Esperando aprobación del autor.</div>`;
                    break;
                case 'approved':
                    messageHTML = `<div class="action-message">¡Has sido aprobado! Ahora puedes proceder.</div>`;
                    actionHTML += `<button class="action-button complete" data-action="complete">${pub.is_sell_post ? 'He Recibido, Pagar' : 'Marcar como Culminada'}</button>`;
                    break;
                case 'completed':
                    messageHTML = `<p class="action-message status-pending">Has marcado la tarea como ${action}. Esperando confirmación final del autor.</p>`;
                    break;
                case 'confirmed_paid':
                    messageHTML = `<p class="action-message status-info">¡Transacción completada!</p>`;
                    if (pub.available_slots > 0) {
                        actionHTML += `<button class="action-button accept" data-action="accept">${verb} de nuevo</button>`;
                    }
                    break;
                case 'not_participating':
                default:
                    if (pub.available_slots > 0 && !pub.is_paused) {
                        actionHTML += `<button class="action-button accept" data-action="accept">${verb}</button>`;
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

    // --- Copiamos la función de `interaction.js` ---
    function getExpirationStatusHTML(pub) {
        if (!pub.expires_at) {
            return { html: '', isExpired: false };
        }

        const now = new Date();
        const expirationDate = new Date(pub.expires_at);
        const diff = expirationDate - now;

        if (diff <= 0) {
            return {
                html: `<span class="expiration-info expired"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Expirada</span>`,
                isExpired: true
            };
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        let timeLeft = '';
        if (days > 1) timeLeft = `Vence en ${days} días`;
        else if (days === 1) timeLeft = `Vence en ${days} día`;
        else if (hours > 1) timeLeft = `Vence en ${hours} horas`;
        else if (hours === 1) timeLeft = `Vence en ${hours} hora`;
        else if (minutes > 0) timeLeft = `Vence en ${minutes} min`;
        else timeLeft = `Vence en <1 min`;

        return {
            html: `<span class="expiration-info"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${timeLeft}</span>`,
            isExpired: false
        };
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
            case 'pay-quick-sale':
                showCustomConfirm(`¿Confirmas el pago de ${document.querySelector('.detail-cost-badge').innerText} a ${document.querySelector('.detail-meta strong').innerText}?`, async () => {
                    endpoint = `/api/quick-sale/${publicationId}/pay`;
                    body = { buyerUsername: storedUsername };
                    await fetchFromServer(endpoint, 'POST', body);
                });
                return; // Importante para no continuar
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
            case 'share':
                await sharePublication();
                return; // No necesita llamar a fetchFromServer
            default:
                return;
        }

        await fetchFromServer(endpoint, method, body);
    }

    async function sharePublication() {
        try {
            // 1. Obtener la información de la publicación actual (ya la tenemos en memoria, pero la buscamos para estar seguros)
            const pubContent = document.getElementById('publication-content');
            const title = pubContent.querySelector('.detail-title').textContent;
            const author = pubContent.querySelector('.detail-meta strong').textContent;

            // 2. Obtener el código de referido y el monto de la recompensa del usuario actual
            const referralResponse = await fetch(`${API_URL}/api/user/${storedUsername}/referral-code`);
            if (!referralResponse.ok) throw new Error('No se pudo obtener tu código de referido.');
            const referralData = await referralResponse.json();
            const referralCode = referralData.referral_code;

            // La cantidad de la recompensa la obtenemos de la configuración global de la app
            const rewardAmount = window.appSettings.referral_reward_amount;

            // 3. Construir el mensaje para compartir
            const publicationUrl = window.location.href;
            const registrationUrl = `${window.location.origin}/register.html?ref=${referralCode}`;
            
            const textToShare = `¡Echa un vistazo a esta publicación en WintonCoin! 🪙

"${title}" por ${author}
Puedes ver los detalles aquí:
${publicationUrl}

---
**¿Aún no tienes cuenta?**
¡Usa mi código, regístrate y ambos ganaremos **${rewardAmount} BLUE**! 💰
${registrationUrl}`;

            // 4. Usar la API para compartir o copiar al portapapeles
            if (navigator.share) {
                await navigator.share({
                    title: `Tarea en WintonCoin: ${title}`,
                    text: textToShare,
                    url: publicationUrl, // URL principal a compartir
                });
                showCustomAlert('¡Gracias por compartir!');
            } else {
                await navigator.clipboard.writeText(textToShare);
                showCustomAlert('¡Mensaje para compartir copiado al portapapeles!');
            }

        } catch (error) {
            console.error('Error al compartir la publicación:', error);
            showCustomAlert(error.message || 'Ocurrió un error al intentar compartir.');
        }
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
            
            const responseText = await response.text();
            let result;

            try {
                result = JSON.parse(responseText);
            } catch (e) {
                console.error("Respuesta no-JSON del servidor:", responseText);
                showCustomAlert(responseText || `Error inesperado del servidor.`);
                throw new Error("Respuesta no-JSON del servidor");
            }
            
            if (!response.ok) {
                showCustomAlert(result.message || `Error en el servidor: ${response.status}`);
                throw new Error(result.message);
            }

            if (result.message) {
                showCustomAlert(result.message);
            }
            
            initializePage(); // Recargar siempre para reflejar el estado más reciente
            return result;

        } catch (error) {
            console.error(`Error en fetchFromServer (${endpoint}):`, error);
            // El mensaje ya se habrá mostrado. Solo devolvemos null para indicar el fallo.
            return null;
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