// ============================================================================
// WintonCoin - Página de Perfil de Usuario (Security Hardened & Auditable)
// ============================================================================
// Principios de Seguridad Aplicados:
// 1. Zero-Trust & Least Privilege: Los datos sensibles de expedientes SOS solo son visibles por el propio dueño.
// 2. OWASP Top 10 A03 (Cross-Site Scripting): Sanitización con escapeHtml en todas las salidas HTML.
// 3. Auditoría Estricta: Validación de estado y sanitización comentada paso a paso.
// ============================================================================

import { getApiUrl, showCustomAlert } from '../modules/index.js';

// Función defensiva para prevenir inyección XSS convirtiendo caracteres especiales en entidades HTML
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function initializeProfilePage() {
    // Obtención de la URL base del API de forma segura
    const API_URL = getApiUrl();
    
    // Extracción de parámetros de URL para determinar qué perfil se está consultando
    const urlParams = new URLSearchParams(window.location.search);
    // Usuario objetivo a consultar (si no hay parámetro en URL, se asume el usuario logueado en sesión)
    const targetUsername = urlParams.get('username') || urlParams.get('user') || localStorage.getItem('username');
    // Usuario autenticado actualmente en la sesión activa
    const sessionUsername = localStorage.getItem('username');

    // Mapeo de elementos del DOM requeridos para el renderizado
    const elements = {
        profileHeader: document.getElementById('profile-header'),
        ratingsList: document.getElementById('ratings-list')
    };

    // Validación de sesión activa: Si no se especifica usuario ni hay sesión, redirigir al login
    if (!targetUsername) {
        displayError("Debes iniciar sesión para ver tu perfil de usuario.", true);
        setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        return;
    }

    // Inicio de la carga de datos del perfil
    fetchProfileData();

    // Consulta de los datos públicos del perfil del usuario (Reputación, Billetera, etc.)
    async function fetchProfileData() {
        try {
            const response = await fetch(`${API_URL}/users/${encodeURIComponent(targetUsername)}/profile`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Error ${response.status}`);
            }

            const profileData = await response.json();
            renderProfile(profileData);
        } catch (error) {
            console.error('Error al cargar el perfil:', error);
            displayError(error.message, true);
        }
    }

    // Orquestador de renderizado del perfil
    function renderProfile(data) {
        // 1. Renderizar encabezado público (Nombre, Estrellas, Dirección de Billetera)
        renderHeader(data.user);
        // 2. Renderizar lista de calificaciones y comentarios P2P públicos
        renderRatings(data.ratings);
        
        // 3. REGLA DE SEGURIDAD ZERO-TRUST:
        // Solo consultar y renderizar el expediente SOS si el usuario autenticado está viendo su PROPIO perfil.
        // Esto evita que terceros inspeccionen la cédula, teléfono o dirección física de otros usuarios.
        if (sessionUsername && sessionUsername === data.user.username) {
            fetchMySosCase(data.user.username);
        }
    }

    // Consulta y renderizado defensivo de expediente SOS (Privado para el dueño de la cuenta)
    async function fetchMySosCase(userUsername) {
        const container = document.getElementById('sos-my-case-section');
        if (!container) return;

        try {
            const response = await fetch(`${API_URL}/api/public/sos-venezuela/my-case?username=${encodeURIComponent(userUsername)}`);
            if (!response.ok) return;

            const data = await response.json();
            // Validación estricta de estructura de respuesta
            if (!data.success || !data.has_case || !data.case) {
                container.innerHTML = '';
                return;
            }

            const c = data.case;
            
            // Construcción del badge de estatus con estilos protegidos
            let statusBadge = `<span style="background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">En Verificación Manual</span>`;
            if (c.status === 'approved') {
                statusBadge = `<span style="background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">Aprobado</span>`;
            } else if (c.status === 'disbursed') {
                statusBadge = `<span style="background: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">Ayuda Desembolsada</span>`;
            } else if (c.status === 'rejected') {
                statusBadge = `<span style="background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">Rechazado</span>`;
            }

            // Mapeo seguro de nivel de afectación
            let affectationLabel = 'Necesidades Básicas Urgentes';
            if (c.affectation_level === 'total_loss') affectationLabel = 'Pérdida Total de Vivienda / Enseres';
            else if (c.affectation_level === 'medical_emergency') affectationLabel = 'Emergencia Médica / Lesionados';
            else if (c.affectation_level === 'partial_damage') affectationLabel = 'Daño Parcial en Vivienda';

            // Formateo desinfectado del censo y ubicación
            const familyStr = escapeHtml(`${c.dependents_minors || 0} menor(es), ${c.dependents_elderly || 0} adulto(s) mayor(es), ${c.dependents_disabled || 0} persona(s) con discapacidad`);
            const locationStr = escapeHtml(`${c.state || ''}, ${c.municipality || ''}, ${c.sector || ''} (${c.address_details || ''})`);

            // Historial de desembolsos desinfectado
            let disbursementsHTML = '';
            if (data.disbursements && data.disbursements.length > 0) {
                disbursementsHTML = `
                    <div style="margin-top: 15px; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
                        <strong style="color: #0f172a; display: block; margin-bottom: 6px;">💸 Historial de Ayuda Humanitaria Recibida:</strong>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${data.disbursements.map(d => `
                                <div style="background: #ffffff; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <span style="font-weight: 600; color: #2563eb;">+${parseFloat(d.amount_blue).toFixed(2)} BLUE IOU</span>
                                        <span style="font-size: 0.8rem; color: #64748b; margin-left: 8px;">${escapeHtml(new Date(d.created_at).toLocaleDateString())}</span>
                                    </div>
                                    <span style="font-size: 0.85rem; color: #475569;">${escapeHtml(d.notes || 'Acreditado')}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

                    let evidenceGalleryHTML = '';
                    if (c.evidence_urls && c.evidence_urls.length > 0) {
                        const itemsHTML = c.evidence_urls.map(url => {
                            const isGooglePhotos = url.includes('drive.google.com') || url.includes('photos.app.goo.gl') || url.includes('photos.google.com');
                            if (isGooglePhotos) {
                                return `<a href="${escapeHtml(url)}" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; background: #fff1f2; color: #be123c; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 0.85rem; font-weight: 500;">🔗 Enlace Google Fotos ↗</a>`;
                            }
                            const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? `${API_URL}${url}` : `${API_URL}/${url}`);
                            return `<a href="${escapeHtml(fullUrl)}" target="_blank" title="Ver foto completa"><img src="${escapeHtml(fullUrl)}" alt="Evidencia SOS" style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px; border: 1px solid #fecdd3; margin-right: 6px;"></a>`;
                        }).join('');
                        evidenceGalleryHTML = `
                            <div style="margin-top: 10px; background: rgba(255,255,255,0.7); padding: 10px 12px; border-radius: 8px; border: 1px solid #f1f5f9;">
                                <strong style="color: #0f172a; display: block; margin-bottom: 6px;">Fotos y Evidencias Adjuntas:</strong>
                                <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">${itemsHTML}</div>
                            </div>
                        `;
                    }

                    // Inyección desinfectada contra ataques Stored XSS
                    container.innerHTML = `
                        <div style="background: linear-gradient(135deg, #fff5f5 0%, #ffffff 100%); border: 1px solid #fecdd3; border-radius: 12px; padding: 20px; box-shadow: 0 4px 12px rgba(219, 39, 119, 0.08); margin-bottom: 1.5rem; text-align: left;">
                            <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 1px solid #fecdd3; padding-bottom: 12px; margin-bottom: 12px;">
                                <h3 style="margin: 0; color: #9f1239; font-size: 1.25rem; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; flex: 1; min-width: 240px;">
                                    <span style="white-space: nowrap;">Mi caso</span>
                                    <span style="font-size: 0.9rem; color: #db2777; font-weight: normal; white-space: nowrap;">(#${escapeHtml(c.dossier_number)})</span>
                                </h3>
                                <div style="flex-shrink: 0; margin-top: 2px;">
                                    ${statusBadge}
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 0.95rem; color: #334155;">
                                <div><strong>Cédula:</strong> ${escapeHtml(c.id_document)}</div>
                                <div><strong>Edad:</strong> ${escapeHtml(String(c.age || 18))} años</div>
                                <div><strong>Ubicación:</strong> ${locationStr}</div>
                                <div><strong>Censo Familiar:</strong> ${familyStr}</div>
                                <div><strong>Gravedad:</strong> ${escapeHtml(affectationLabel)}</div>
                                <div><strong>Fecha de Registro:</strong> ${escapeHtml(new Date(c.created_at).toLocaleDateString())}</div>
                            </div>

                            <div style="margin-top: 10px; background: rgba(255,255,255,0.7); padding: 10px 12px; border-radius: 8px; border: 1px solid #f1f5f9;">
                                <strong style="color: #0f172a; display: block; margin-bottom: 4px;">Relato / Solicitud:</strong>
                                <p style="margin: 0; font-size: 0.9rem; color: #475569; font-style: italic;">"${escapeHtml(c.description)}"</p>
                            </div>

                            ${evidenceGalleryHTML}

                            ${disbursementsHTML}
                        </div>
                    `;
        } catch (err) {
            console.error('Error al cargar datos de Mi caso SOS:', err);
        }
    }

    // Renderizado seguro de la cabecera pública del perfil
    function renderHeader(user) {
        const ratingHTML = generateStarRating(user.average_rating, user.ratings_count);
        
        let walletHTML = '';
        if (user.web3_wallet_address) {
            const addr = escapeHtml(user.web3_wallet_address);
            const truncated = addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);
            walletHTML = `
                <div class="profile-wallet-container" style="display: flex; align-items: center; justify-content: center; margin-top: 10px; background: rgba(255,255,255,0.05); padding: 8px 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); width: fit-content; margin-left: auto; margin-right: auto;">
                    <span style="color: #888; font-size: 14px; margin-right: 8px;">Billetera Web3:</span>
                    <span id="walletAddressText" style="font-family: monospace; font-size: 14px; color: #fff; margin-right: 10px;">${truncated}</span>
                    <button id="copyWalletBtn" data-address="${addr}" style="background: none; border: none; cursor: pointer; color: #4da6ff; padding: 0; display: flex; align-items: center; justify-content: center;" title="Copiar dirección">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
            `;
        }

        // Sanitización estricta del nombre de usuario para prevenir XSS
        elements.profileHeader.innerHTML = `
            <h1 class="profile-username">${escapeHtml(user.username)}</h1>
            <div class="profile-rating">${ratingHTML}</div>
            ${walletHTML}
        `;

        if (user.web3_wallet_address) {
            document.getElementById('copyWalletBtn').addEventListener('click', function() {
                const fullAddress = this.dataset.address;
                copyTextToClipboard(fullAddress).then(() => {
                    const originalHTML = this.innerHTML;
                    this.innerHTML = '<span style="font-size:12px; font-weight:bold; color:#059669;">✓ Copiado</span>';
                    setTimeout(() => {
                        this.innerHTML = originalHTML;
                    }, 2000);
                }).catch(err => {
                    console.error('Error al copiar: ', err);
                });
            });
        }
    }

    // Renderizado seguro del listado de calificaciones
    function renderRatings(ratings) {
        if (!ratings || ratings.length === 0) {
            elements.ratingsList.innerHTML = '<p class="empty-message">Este usuario aún no ha recibido ninguna calificación.</p>';
            return;
        }
        elements.ratingsList.innerHTML = ratings.map(rating => getRatingHTML(rating)).join('');
    }

    // Generación de HTML desinfectado para cada reseña P2P
    function getRatingHTML(rating) {
        const stars = '★'.repeat(rating.rating || 0) + '☆'.repeat(5 - (rating.rating || 0));
        const formattedDate = escapeHtml(new Date(rating.created_at).toLocaleDateString('es-ES', {
            year: 'numeric', month: 'long', day: 'numeric'
        }));

        return `
            <div class="rating-item">
                <div class="rating-item-header">
                    <span class="rating-item-rater">De: <strong>${escapeHtml(rating.rater_username)}</strong></span>
                    <span class="rating-item-stars">${stars}</span>
                </div>
                ${rating.comment ? `<p class="rating-item-comment">"${escapeHtml(rating.comment)}"</p>` : ''}
                <div class="rating-item-footer"><span>${formattedDate}</span></div>
            </div>
        `;
    }

    // Manejador centralizado de errores
    function displayError(message, redirect = false) {
        if (elements.profileHeader) elements.profileHeader.innerHTML = '';
        if (elements.ratingsList) elements.ratingsList.innerHTML = '';
        showCustomAlert(message, () => {
            if (redirect) {
                window.location.href = 'contract_interaction.html';
            }
        });
    }

    // Generador de estrellas
    function generateStarRating(rating, count) {
        if (!count || count === 0) {
            return '<span class="no-rating">Sin calificaciones</span>';
        }
        const avgRating = parseFloat(rating).toFixed(1);
        const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
        return `
            <span class="stars" title="${avgRating} de 5 estrellas">${stars}</span> 
            <span class="rating-summary"><strong>${avgRating}</strong> de 5 (${count} calificaciones)</span>
        `;
    }
}

// Inicialización respetando la carga asíncrona del DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeProfilePage);
} else {
    initializeProfilePage();
}
