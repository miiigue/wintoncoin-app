// ============================================================================
// MÓDULO: Página Pública de Causa Solidaria (causa-solidaria.js)
// ============================================================================
// Responsabilidad: Renderizar la página pública de una causa humanitaria,
//                  permitir donaciones de BLUE IOU y compartir por redes.
//
// Flujo:
//   1. Lee el parámetro ?id=XX de la URL
//   2. Consulta la API para obtener los detalles de la causa
//   3. Renderiza: historia, progreso, lista de donaciones
//   4. Permite donar (con modal de confirmación)
//   5. Permite compartir enlace por WhatsApp/Web Share API
//
// Seguridad:
//   - Requiere autenticación (authenticateToken)
//   - El backend valida saldo, auto-donación y estado de la causa
//   - El frontend no toma decisiones de negocio, solo presenta datos
//   - XSS prevention con escapeHtml en todo dato del usuario
//
// Accesibilidad:
//   - IDs únicos para cada elemento interactivo (testing/auditoría)
//   - Responsive design para móviles
// ============================================================================

import {
    getApiUrl,
    showCustomAlert,
    showCustomConfirm,
    handleSessionExpired
} from '../modules/index.js';

// ============================================================================
// CONSTANTES
// ============================================================================
const API_URL = getApiUrl();

// Función helper para formatear porcentajes con decimales significativos cuando es menor a 0.1% pero mayor a 0
function formatPercentage(raised, goal) {
    if (!goal || goal <= 0) return '0.0';
    if (raised <= 0) return '0.0';
    
    const pct = (raised / goal) * 100;
    if (pct >= 0.1) {
        return pct.toFixed(1);
    }
    
    const pctStr = pct.toFixed(10);
    const match = pctStr.match(/^0\.0*[1-9]/);
    if (match) {
        return match[0];
    }
    return pct.toFixed(6).replace(/\.?0+$/, '');
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Redirección al hacer clic en "Disponible para donaciones:"
    const balanceHint = document.getElementById('balanceHintClickable');
    if (balanceHint) {
        balanceHint.addEventListener('click', () => {
            window.location.href = 'booster-profile.html';
        });
    }

    // Obtener el ID de la causa desde la URL
    const params = new URLSearchParams(window.location.search);
    const causeId = params.get('id');

    // Validar que existe un ID válido
    if (!causeId || isNaN(parseInt(causeId))) {
        showErrorPage('No se especificó una causa válida.', true);
        return;
    }

    await loadCauseData(parseInt(causeId));
});

// ============================================================================
// CARGA DE DATOS
// ============================================================================
// Consulta la API y renderiza toda la página con los datos obtenidos
// ============================================================================
async function loadCauseData(causeId) {
    const container = document.getElementById('solidarioPageContainer');
    const loading = document.getElementById('solidarioLoading');

    try {
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        // Consultar detalle de la causa (incluye donaciones)
        const response = await fetch(`${API_URL}/api/humanitarian/causes/${causeId}`, {
            headers
        });

        // Manejar sesión expirada
        if (handleSessionExpired(response)) return;

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Causa no encontrada.');
        }

        const data = await response.json();

        if (!data.success || !data.cause) {
            showErrorPage('Causa no encontrada o no disponible.');
            return;
        }

        // Ocultar loading
        loading.style.display = 'none';

        // Renderizar la causa
        const cause = data.cause;
        const storedUsername = localStorage.getItem('username');
        const isOwner = cause.creator_username === storedUsername;



        const donations = data.donations || { donations: [], summary: {} };

        window.currentCause = cause;
        container.innerHTML = buildCauseHTML(cause, donations);

        // Inicializar interactividad
        initDonateButton(cause);
        initShareButton(cause);
        initDonationsList(donations);
        initCancelButton(cause);
        initTabs(cause);
        if (isOwner) {
            initAuthorPanel(cause);
        }

    } catch (err) {
        console.error('[SOLIDARIO] Error al cargar causa:', err);
        
        // Esconder el spinner de carga para revelar el mensaje de error
        if (loading) loading.style.display = 'none';

        // Si el error es de autenticación, redirigir al login
        if (err.message && (err.message.includes('401') || err.message.includes('Acceso denegado') || err.message.includes('Token'))) {
            showErrorPage('Debes iniciar sesión para ver esta causa.', true);
        } else {
            showErrorPage(err.message || 'Error al cargar la causa.');
        }
    }
}

// ============================================================================
// CONSTRUCCIÓN DEL HTML
// ============================================================================
// Genera todo el HTML de la causa con datos reales del backend
// ============================================================================
function buildCauseHTML(cause, donations) {
    const currentAmount = parseFloat(cause.current_amount) || 0;
    const goalAmount = parseFloat(cause.goal_amount) || 0;

    const summary = donations.summary || {};
    const totalOnHold = summary.total_on_hold || 0;
    const countDonations = (summary.count_released || 0) + (summary.count_on_hold || 0);

    // Opción A: Barra de Progreso Apilada (Suma Total)
    const totalRaised = currentAmount + totalOnHold;
    const percentageReleased = goalAmount > 0 ? Math.min((currentAmount / goalAmount) * 100, 100) : 0;
    const percentageOnHold = goalAmount > 0 ? Math.min((totalOnHold / goalAmount) * 100, 100 - percentageReleased) : 0;
    const percentageTotal = percentageReleased + percentageOnHold;

    // Formatear fecha y hora de creación
    const dateObj = new Date(cause.created_at);
    const createdDate = dateObj.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) + ' a las ' + dateObj.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }) + ' hs';

    // Determinar si la causa alcanzó su meta o está culminada
    const isCompleted = cause.status === 'completed' || (goalAmount > 0 && totalRaised >= goalAmount);

    // Iconos
    const heartIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
    const shareIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 14 20 9 15 4"></polyline><path d="M4 20v-7a4 4 0 0 1 4-4h12"></path></svg>`;
    // Identificar si el usuario actual es el autor para mostrar botón cancelar
    const storedUsername = localStorage.getItem('username');
    const isOwner = cause.creator_username === storedUsername;
    const canCancel = isOwner && (cause.status === 'pending' || cause.status === 'approved');

    let badgeOrCancelBtn = '';
    if (canCancel) {
        badgeOrCancelBtn = `
            <button id="solidarioDetailCancelBtn" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; border-radius: 8px; padding: 6px 12px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: none;">
                🛑 Cancelar y Cerrar Causa Actual
            </button>
        `;
    }



    // [Seguridad / Redirección] Resolver enlace social para el creador (influencer)
    let creatorLink = `profile.html?user=${encodeURIComponent(cause.creator_username)}`;
    let creatorTarget = '';
    let isCreatorExternal = false;
    if (cause.evidence_urls && Array.isArray(cause.evidence_urls) && cause.evidence_urls.length > 1) {
        const firstSocial = cause.evidence_urls[1];
        if (firstSocial && firstSocial.trim() !== '') {
            creatorLink = firstSocial.trim();
            creatorTarget = ' target="_blank" rel="noopener noreferrer"';
            isCreatorExternal = true;
        }
    }

    // [Seguridad / Redirección] Resolver enlace social para el beneficiario
    let beneficiaryLink = `profile.html?user=${encodeURIComponent(cause.beneficiary_username)}`;
    let beneficiaryTarget = '';
    let isBeneficiaryExternal = false;
    if (cause.beneficiary_socials && cause.beneficiary_socials.trim() !== '') {
        const socials = cause.beneficiary_socials.trim().split(/\s+/);
        if (socials[0] && socials[0].trim() !== '') {
            beneficiaryLink = socials[0].trim();
            beneficiaryTarget = ' target="_blank" rel="noopener noreferrer"';
            isBeneficiaryExternal = true;
        }
    }

    const creatorIcon = getSocialIcon(creatorLink, isCreatorExternal);
    const beneficiaryIcon = getSocialIcon(beneficiaryLink, isBeneficiaryExternal);

    let authorToolbarHTML = '';
    if (isOwner) {
        authorToolbarHTML = `
            <div class="author-toolbar">
                <div class="author-toolbar-title">
                    ⚙️ Panel de Control de tu Causa
                </div>
                <div class="author-toolbar-actions">
                    <button class="author-btn author-btn-edit" id="authorEditCauseBtn">
                        ✏️ Editar Causa
                    </button>
                    <button class="author-btn author-btn-update" id="authorPublishUpdateBtn">
                        📢 Publicar Novedad
                    </button>
                </div>
            </div>
        `;
    }

    return `
        <!-- HEADER: Navegación + Badge -->
        <div class="solidario-header">
            <a href="contract_interaction.html" class="solidario-back-btn" id="solidarioBackBtn">
                ← Volver
            </a>
            <div class="solidario-badge-container">
                ${badgeOrCancelBtn}
            </div>
        </div>

        ${authorToolbarHTML}

        <!-- TARJETA PRINCIPAL -->
        ${/* [FILTRO] Extraer solo URLs de imágenes reales (R2 uploads / extensiones gráficas) */''}
        <div class="solidario-cause-card ${((() => { const imgs = (cause.evidence_urls || []).filter(u => u && (u.toLowerCase().includes('/uploads/') || /\.(webp|png|jpg|jpeg|gif)(\?.*)?$/i.test(u))); return imgs.length > 0; })()) ? 'has-images' : ''}" style="position: relative;">
            ${(() => {
                // [SEGURIDAD VISUAL] Filtrar evidence_urls para retener solo imágenes reales
                // Excluir enlaces de Drive, Instagram, TikTok, etc. que causan cajas negras
                const realImages = (cause.evidence_urls || []).filter(u => {
                    if (!u || typeof u !== 'string') return false;
                    const lower = u.toLowerCase();
                    return lower.includes('/uploads/') || /\.(webp|png|jpg|jpeg|gif)(\?.*)?$/i.test(lower);
                });
                if (realImages.length === 0) return '';
                // Guardar referencia para el lightbox
                window._currentCauseRealImages = realImages;
                return `
                    <div class="cause-carousel-wrapper" style="margin: -20px -20px 20px -20px; border-radius: 16px 16px 0 0; overflow: hidden; position: relative; background: #0a0a14;">
                        <div class="cause-carousel-track" onscroll="const idx = Math.round(this.scrollLeft / this.offsetWidth); this.parentElement.querySelectorAll('.carousel-dot').forEach((d, i) => d.style.background = i === idx ? 'white' : 'rgba(255,255,255,0.4)');" style="display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; -webkit-overflow-scrolling: touch;">
                            ${realImages.map(url => `<img src="${escapeAttr(url)}" alt="Evidencia de causa" loading="lazy" style="flex: 0 0 100%; width: 100%; height: 280px; object-fit: cover; scroll-snap-align: center; cursor: pointer;">`).join('')}
                        </div>
                        ${realImages.length > 1 ? `
                            <button class="carousel-arrow carousel-arrow-left" onclick="this.parentElement.querySelector('.cause-carousel-track').scrollBy({left: -this.parentElement.offsetWidth, behavior: 'smooth'})" aria-label="Imagen anterior" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);color:white;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0.7;transition:opacity 0.3s;">❮</button>
                            <button class="carousel-arrow carousel-arrow-right" onclick="this.parentElement.querySelector('.cause-carousel-track').scrollBy({left: this.parentElement.offsetWidth, behavior: 'smooth'})" aria-label="Imagen siguiente" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);color:white;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0.7;transition:opacity 0.3s;">❯</button>
                            <div class="carousel-dots" style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);display:flex;gap:6px;">
                                ${realImages.map((_, i) => `<span class="carousel-dot" style="width:8px;height:8px;border-radius:50%;background:${i === 0 ? 'white' : 'rgba(255,255,255,0.4)'};transition:background 0.3s;"></span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                `;
            })()}
            <h1 class="solidario-cause-title" id="solidarioCauseTitle">${escapeHtml(cause.title)}</h1>
            <div class="solidario-cause-meta">
                <span>👤 Creador: <strong><a href="${creatorLink}"${creatorTarget} class="profile-link" style="color: #a5b4fc; text-decoration: underline;">${creatorIcon}${escapeHtml(cause.creator_username || 'Creador')}</a></strong></span>
                ${cause.beneficiary_username && cause.beneficiary_username !== cause.creator_username ? `<span>💖 Beneficiario: <strong><a href="${beneficiaryLink}"${beneficiaryTarget} class="profile-link" style="color: #a5b4fc; text-decoration: underline;">${beneficiaryIcon}${escapeHtml(cause.beneficiary_username)}</a>${cause.foundation_name ? ` (${escapeHtml(cause.foundation_name)})` : ''}</strong></span>` : ''}
                <span>📅 ${createdDate}</span>
            </div>
            <div class="solidario-cause-story" id="solidarioCauseStory">${escapeHtml(cause.story)}</div>
        </div>

        <!-- BARRA DE PROGRESO (OPCIÓN A) -->
        <div class="solidario-progress-section" id="solidarioProgressSection">
            <div class="solidario-progress-amounts">
                <span class="solidario-progress-current">
                    ${formatBalance(totalRaised)} <span class="unit">BLUE IOU</span>
                </span>
                <span class="solidario-progress-goal">
                    Meta: ${formatBalance(goalAmount)} BLUE IOU
                </span>
            </div>
            
            <div class="solidario-progress-bar-wrapper">
                <div class="solidario-progress-bar-fill" style="width: ${percentageReleased.toFixed(1)}%; background: #e83e8c; border-radius: ${percentageOnHold > 0 ? '3px 0 0 3px' : '3px'};"></div>
                ${percentageOnHold > 0 ? `<div class="solidario-progress-bar-fill-hold" style="width: ${percentageOnHold.toFixed(1)}%; background: repeating-linear-gradient(45deg, rgba(232, 62, 140, 0.4), rgba(232, 62, 140, 0.4) 10px, rgba(232, 62, 140, 0.6) 10px, rgba(232, 62, 140, 0.6) 20px); border-radius: 0 3px 3px 0;"></div>` : ''}
            </div>
            
            <div class="solidario-progress-percentage-wrapper" style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                <span class="solidario-progress-percentage">${formatPercentage(totalRaised, goalAmount)}% total recaudado</span>
            </div>

            <div class="solidario-breakdown" style="font-size: 0.8em; color: rgba(255,255,255,0.6); margin-top: 8px; padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 4px;">
                <div style="display:flex; justify-content:space-between;">
                    <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#e83e8c; margin-right:6px;"></span>Disponible:</span>
                    <strong>${formatBalance(currentAmount)} BLUE IOU</strong>
                </div>
                ${totalOnHold > 0 ? `
                <div style="display:flex; justify-content:space-between;">
                    <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:rgba(232,62,140,0.5); margin-right:6px;"></span>En espera (KYC):</span>
                    <strong>${formatBalance(totalOnHold)} BLUE IOU</strong>
                </div>` : ''}
            </div>
        </div>

        <!-- BOTONES DE ACCIÓN -->
        <div class="solidario-actions" id="solidarioActions">
            <button class="solidario-btn-donate" id="solidarioDonateBtn"
                ${isCompleted ? 'disabled' : ''} style="display:flex; align-items:center; justify-content:center; gap:8px; background-color: #e83e8c; color: white;">
                ${isCompleted ? 'Meta Alcanzada' : `${heartIcon} Donar BLUE IOU`}
            </button>
            <button class="solidario-btn-share" id="solidarioShareBtn" style="display:flex; align-items:center; justify-content:center; gap:8px;">
                ${shareIcon} Compartir
            </button>
        </div>

        <!-- SISTEMA DE PESTAÑAS (TABS) -->
        <div class="solidario-tabs">
            <button class="solidario-tab-btn active" id="tabDonationsBtn">Donaciones (${countDonations})</button>
            <button class="solidario-tab-btn" id="tabUpdatesBtn">Novedades (<span id="updatesCountBadge">0</span>)</button>
            <button class="solidario-tab-btn" id="tabHistoryBtn">Historial de Cambios</button>
        </div>

        <!-- CONTENIDO PESTAÑA: DONACIONES -->
        <div class="solidario-tab-content active" id="tabContentDonations">
            <div class="solidario-donations-section" id="solidarioDonationsSection" style="margin-top:0; border:1px solid rgba(255,255,255,0.06); border-radius:16px;">
                <div class="solidario-donations-title" style="display:flex; align-items:center; gap:8px;">
                    <span style="color:#e83e8c;">${heartIcon}</span> ${countDonations} ${countDonations === 1 ? 'Donación recibida' : 'Donaciones recibidas'}
                </div>
                <div id="solidarioDonationsList">
                    <!-- Se llena dinámicamente -->
                </div>
            </div>
        </div>

        <!-- CONTENIDO PESTAÑA: NOVEDADES -->
        <div class="solidario-tab-content" id="tabContentUpdates">
            <div class="solidario-donations-section" style="margin-top:0; border:1px solid rgba(255,255,255,0.06); border-radius:16px;">
                <div id="updatesListContainer">
                    <div class="solidario-empty-donations">No hay novedades registradas todavía.</div>
                </div>
            </div>
        </div>

        <!-- CONTENIDO PESTAÑA: HISTORIAL -->
        <div class="solidario-tab-content" id="tabContentHistory">
            <div class="solidario-donations-section" style="margin-top:0; border:1px solid rgba(255,255,255,0.06); border-radius:16px;">
                <div id="historyListContent">
                    <div class="solidario-empty-donations">No hay historial de cambios registrado.</div>
                </div>
            </div>
        </div>
    `;
}

// ============================================================================
// INTERACTIVIDAD: Botón de Donar
// ============================================================================
// Al presionar "Donar", consulta el saldo actual del donante y
// abre el modal de donación con la información pre-llenada.
// ============================================================================
function initDonateButton(cause) {
    const donateBtn = document.getElementById('solidarioDonateBtn');
    if (!donateBtn || donateBtn.disabled) return;

    donateBtn.addEventListener('click', async () => {
        try {
            const token = localStorage.getItem('token');
            const username = localStorage.getItem('username');

            if (!token || !username) {
                const currentPath = 'causa-solidaria.html' + window.location.search;
                const refParam = cause.beneficiary_referral_code ? `&ref=${encodeURIComponent(cause.beneficiary_referral_code)}` : '';
                window.location.href = `register.html?returnTo=${encodeURIComponent(currentPath)}${refParam}`;
                return;
            }

            // Obtener saldo del booster (fuente de verdad para BLUE IOU)
            const profileRes = await fetch(`${API_URL}/api/users/${username}/booster-profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!profileRes.ok) {
                showCustomAlert('Error al obtener tu saldo de impulsor.');
                return;
            }

            const profileData = await profileRes.json();
            // LÓGICA FINTECH: Usar base_eligible_booster_blue (saldo seguro: bono bienvenida + tareas)
            // en lugar de total_booster_blue para donar. Esto impide comprometer referidos sin KYC.
            const balance = parseFloat(profileData.base_eligible_booster_blue !== undefined ? profileData.base_eligible_booster_blue : profileData.total_booster_blue) || 0;

            // Mostrar saldo en el modal
            document.getElementById('donorBalanceDisplay').textContent = formatBalance(balance);

            // Verificar si el usuario tiene KYC Web3 aprobado
            // NOTA: Se usa kyc_verified (migración 055) y NO is_verified (email OTP)
            // porque el mecanismo Hold & Release del Trigger de BD (migración 056/068)
            // evalúa kyc_verified para liberar donaciones retenidas
            const userRes = await fetch(`${API_URL}/api/auth/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            let isVerified = false;
            if (userRes.ok) {
                const userData = await userRes.json();
                isVerified = userData.kyc_verified === true;
            }

            // Mostrar/ocultar aviso de KYC
            const kycWarning = document.getElementById('donateKycWarning');
            if (kycWarning) {
                kycWarning.style.display = isVerified ? 'none' : 'flex';
            }

            // Abrir modal
            const overlay = document.getElementById('donateModalOverlay');
            overlay.classList.add('active');

            // Configurar eventos del modal
            setupDonateModal(cause, balance);

        } catch (err) {
            console.error('[SOLIDARIO] Error al preparar donación:', err);
            showCustomAlert('Error al obtener tu saldo. Intenta nuevamente.');
        }
    });
}

// ============================================================================
// MODAL DE DONACIÓN: Configuración y manejo de eventos
// ============================================================================
// Maneja la interacción completa del modal: validación de monto,
// envío al backend y recarga de página al completar.
// ============================================================================
function setupDonateModal(cause, donorBalance) {
    const overlay = document.getElementById('donateModalOverlay');
    const cancelBtn = document.getElementById('donateCancelBtn');
    const confirmBtn = document.getElementById('donateConfirmBtn');
    const amountInput = document.getElementById('donateAmountInput');
    const termsCheckbox = document.getElementById('donateTermsCheckbox');

    // Limpiar input y resetear estado
    amountInput.value = '';
    
    // Lógica Clickwrap: botón deshabilitado hasta aceptar términos
    if (termsCheckbox) {
        termsCheckbox.checked = false;
        confirmBtn.disabled = true;
        termsCheckbox.onchange = () => {
            confirmBtn.disabled = !termsCheckbox.checked;
        };
    } else {
        confirmBtn.disabled = false;
    }
    
    confirmBtn.textContent = 'Confirmar Donación';

    // Función para cerrar modal
    const closeModal = () => {
        overlay.classList.remove('active');
    };

    // Cerrar con botón cancelar
    cancelBtn.onclick = closeModal;

    // Cerrar al hacer clic fuera del modal
    overlay.onclick = (e) => {
        if (e.target === overlay) closeModal();
    };

    // Confirmar donación
    confirmBtn.onclick = async () => {
        // Normalizar entrada (aceptar coma o punto como decimal)
        const rawAmount = amountInput.value.replace(',', '.');
        const amount = parseFloat(rawAmount);

        // Validaciones del lado del cliente (el backend también valida)
        if (isNaN(amount) || amount <= 0) {
            showCustomAlert('Ingresa un monto válido.');
            return;
        }

        if (amount > donorBalance) {
            showCustomAlert(`Saldo insuficiente. Tienes ${formatBalance(donorBalance)} BLUE IOU disponibles.`);
            return;
        }

        // Deshabilitar botón para evitar doble clic (anti-fraude)
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Procesando...';

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/humanitarian/causes/${cause.id}/donate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ amount, accepted_terms: true })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Error al procesar la donación.');
            }

            // Cerrar modal y mostrar resultado
            closeModal();
            showCustomAlert(result.message || '¡Donación procesada exitosamente!');

            // Recargar la página para actualizar datos (2 segundos de delay para leer mensaje)
            setTimeout(() => {
                window.location.reload();
            }, 2500);

        } catch (err) {
            console.error('[SOLIDARIO] Error al donar:', err);
            showCustomAlert(err.message || 'Error al procesar la donación.');
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirmar Donación';
        }
    };
}

// ============================================================================
// INTERACTIVIDAD: Botón de Compartir
// ============================================================================
// Usa Web Share API (nativa en móviles) o fallback a WhatsApp Web
// para compartir el enlace de la causa con otros usuarios.
// ============================================================================
function initShareButton(cause) {
    const shareBtn = document.getElementById('solidarioShareBtn');
    if (!shareBtn) return;

    shareBtn.addEventListener('click', () => {
        const url = window.location.href;
        // OPTIMIZACIÓN WEB SHARE API: Separar el mensaje descriptivo base del enlace URL.
        // Evita que navegadores como Chrome/Safari en iOS/Android dupliquen el enlace al concatenarlos automáticamente.
        const baseText = `💙 Ayuda a ${cause.beneficiary_username || 'un usuario'} con su causa "${cause.title}" en WintonCoin.\n\nDona tus BLUE IOU y marca la diferencia:`;

        // Intentar usar Web Share API (nativa en móviles y navegadores compatibles)
        if (navigator.share) {
            navigator.share({
                title: `Winton Solidario: ${cause.title}`,
                text: baseText,
                url: url
            }).catch(() => {
                // Si el usuario cancela, no hacer nada (es comportamiento esperado del usuario)
            });
        } else {
            // FALLBACK ESCRITORIO: Concatenar manualmente el texto base y la URL para compartir en WhatsApp Web
            const fullText = `${baseText}\n${url}`;
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
            window.open(whatsappUrl, '_blank');
        }
    });
}

// ============================================================================
// INTERACTIVIDAD: Botón Cancelar Causa
// ============================================================================
function initCancelButton(cause) {
    const cancelBtn = document.getElementById('solidarioDetailCancelBtn');
    if (!cancelBtn) return;

    cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        showCustomConfirm(
            '¿Estás seguro de que deseas cancelar y cerrar esta causa? Si lo haces, ya no podrás recibir más donaciones en esta y quedará marcada como culminada.',
            async () => {
                cancelBtn.disabled = true;
                cancelBtn.textContent = 'Cancelando...';
                try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`${API_URL}/api/humanitarian/causes/${cause.id}/cancel`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const result = await res.json();
                    if (res.ok) {
                        showCustomAlert(result.message || 'Causa cancelada exitosamente.', () => {
                            window.location.reload();
                        });
                    } else {
                        showCustomAlert(result.message || 'Error al cancelar la causa.');
                        cancelBtn.disabled = false;
                        cancelBtn.textContent = '🛑 Cancelar y Cerrar Causa Actual';
                    }
                } catch (err) {
                    console.error('Error canceling cause:', err);
                    showCustomAlert('Error de red al intentar cancelar.');
                    cancelBtn.disabled = false;
                    cancelBtn.textContent = '🛑 Cancelar y Cerrar Causa Actual';
                }
            }
        );
    });
}

// ============================================================================
// LISTA DE DONACIONES: Renderizado
// ============================================================================
// Muestra el historial de donaciones recibidas por la causa,
// indicando el estado de cada una (released/on_hold).
// ============================================================================
function initDonationsList(donationsData) {
    const listContainer = document.getElementById('solidarioDonationsList');
    if (!listContainer) return;

    const donations = donationsData.donations || [];

    if (donations.length === 0) {
        listContainer.innerHTML = `
            <div class="solidario-empty-donations">
                <p>Aún no hay donaciones. ¡Sé el primero en apoyar!</p>
            </div>
        `;
        return;
    }

    // Renderizar cada donación como una fila con información del donante
    listContainer.innerHTML = donations.map(d => {
        const amount = parseFloat(d.amount);
        const date = new Date(d.created_at).toLocaleDateString('es-ES', {
            month: 'short',
            day: 'numeric'
        });
        const statusClass = d.status === 'released' ? 'released' : 'on_hold';
        const statusLabel = d.status === 'released' ? 'Acreditada' : 'En espera';

        // Clasificación de tipo de donación
        const isReferral = d.donation_type === 'referral';
        const typeLabel = isReferral ? 'Por código' : 'Donado';
        const typeClass = isReferral ? 'referral' : 'voluntary';

        return `
            <div class="solidario-donation-item">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="solidario-donation-user">@${escapeHtml(d.donor_username)}</div>
                        <span class="donation-type-badge ${typeClass}">${typeLabel}</span>
                    </div>
                    <span style="font-size:0.75em; color:#64748B;">${date}</span>
                </div>
                <div style="text-align:right;">
                    <div class="solidario-donation-amount">${formatBalance(amount)} BLUE IOU</div>
                    <span class="solidario-donation-status ${statusClass}">${statusLabel}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Resuelve iconos sociales dinámicos de forma premium
 * @param {string} link - URL de destino
 * @param {boolean} isExternal - Si es un enlace de red externa
 * @returns {string} Código SVG del icono
 */
function getSocialIcon(link, isExternal) {
    if (!isExternal) {
        // Icono de perfil interno de la plataforma (WintonCoin User)
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px; opacity:0.8;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    }
    
    const lowLink = link.toLowerCase();
    if (lowLink.includes('instagram.com') || lowLink.includes('instagr.am')) {
        // Icono oficial de Instagram
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px; color:#e83e8c;"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`;
    } else if (lowLink.includes('facebook.com') || lowLink.includes('fb.com')) {
        // Icono oficial de Facebook
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px; color:#1877F2;"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>`;
    } else if (lowLink.includes('twitter.com') || lowLink.includes('x.com')) {
        // Icono oficial de Twitter / X
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px; color:#cbd5e1;"><path d="M4 4l11.733 16h4.267l-11.733 -16z"></path><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"></path></svg>`;
    } else if (lowLink.includes('youtube.com') || lowLink.includes('youtu.be')) {
        // Icono oficial de YouTube
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px; color:#FF0000;"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>`;
    }
    
    // Icono de enlace genérico en caso de otras webs/blogs
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px; opacity:0.8;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
}

/**
 * Escapa HTML para prevenir XSS (seguridad obligatoria en fintech)
 * Convierte caracteres especiales a entidades HTML seguras
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Formatea un número como balance con 4 decimales y separador de miles
 * Ejemplo: 1500.5 → "1.500,5000"
 */
function formatBalance(value) {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('es-ES', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
    });
}

/**
 * Muestra un error en la página (reemplaza el contenido con mensaje de error)
 * @param {string} message - Mensaje de error a mostrar
 * @param {boolean} showLogin - Si true, muestra enlace al login
 */
function showErrorPage(message, showLogin = false) {
    const container = document.getElementById('solidarioPageContainer');
    container.innerHTML = `
        <div class="solidario-error">
            <h2>⚠️</h2>
            <p>${escapeHtml(message)}</p>
            ${showLogin ? '<p><a href="login.html">Iniciar sesión</a></p>' : ''}
            <p><a href="contract_interaction.html">Volver al inicio</a></p>
        </div>
    `;
}

// ============================================================================
// SISTEMA DE PESTAÑAS (TABS) INTERACTIVAS
// ============================================================================
function initTabs(cause) {
    const tabDonationsBtn = document.getElementById('tabDonationsBtn');
    const tabUpdatesBtn = document.getElementById('tabUpdatesBtn');
    const tabHistoryBtn = document.getElementById('tabHistoryBtn');

    const tabContentDonations = document.getElementById('tabContentDonations');
    const tabContentUpdates = document.getElementById('tabContentUpdates');
    const tabContentHistory = document.getElementById('tabContentHistory');

    if (!tabDonationsBtn) return;

    // Cambiar pestañas al hacer clic
    tabDonationsBtn.onclick = () => switchTab(tabDonationsBtn, tabContentDonations);
    tabUpdatesBtn.onclick = () => {
        switchTab(tabUpdatesBtn, tabContentUpdates);
        loadUpdates(cause.id);
    };
    tabHistoryBtn.onclick = () => {
        switchTab(tabHistoryBtn, tabContentHistory);
        loadHistory(cause.id);
    };

    // Consultar cantidad de novedades en segundo plano
    fetchUpdatesCount(cause.id);
}

function switchTab(activeBtn, activeContent) {
    // Desactivar botones de tab
    document.querySelectorAll('.solidario-tab-btn').forEach(btn => btn.classList.remove('active'));
    // Ocultar todos los tab contents
    document.querySelectorAll('.solidario-tab-content').forEach(content => content.classList.remove('active'));

    // Activar los seleccionados
    activeBtn.classList.add('active');
    activeContent.classList.add('active');
}

async function fetchUpdatesCount(causeId) {
    try {
        const response = await fetch(`${API_URL}/api/humanitarian/causes/${causeId}/updates`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.updates) {
                const countBadge = document.getElementById('updatesCountBadge');
                if (countBadge) countBadge.textContent = data.updates.length;
            }
        }
    } catch (e) {
        console.error('Error al obtener cantidad de novedades:', e);
    }
}

async function loadUpdates(causeId) {
    const container = document.getElementById('updatesListContainer');
    if (!container) return;

    try {
        const response = await fetch(`${API_URL}/api/humanitarian/causes/${causeId}/updates`);
        if (!response.ok) throw new Error('No se pudieron obtener las novedades.');
        const data = await response.json();

        if (!data.success || !data.updates || data.updates.length === 0) {
            container.innerHTML = `<div class="solidario-empty-donations">No hay novedades registradas todavía.</div>`;
            return;
        }

        container.innerHTML = data.updates.map(update => {
            const dateStr = new Date(update.created_at).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) + ' hs';
            return `
                <div class="update-item">
                    <div class="update-item-header">
                        <span class="update-item-title">${escapeHtml(update.update_title)}</span>
                        <span class="update-item-date">${dateStr}</span>
                    </div>
                    <div class="update-item-body">${escapeHtml(update.update_text)}</div>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<div class="solidario-empty-donations" style="color:#ef4444;">${err.message}</div>`;
    }
}

async function loadHistory(causeId) {
    const container = document.getElementById('historyListContent');
    if (!container) return;

    try {
        const response = await fetch(`${API_URL}/api/humanitarian/causes/${causeId}/history`);
        if (!response.ok) throw new Error('No se pudo obtener el historial de ediciones.');
        const data = await response.json();

        if (!data.success || !data.history || data.history.length === 0) {
            container.innerHTML = `<div class="solidario-empty-donations">No hay historial de cambios registrado para la historia principal de la causa.</div>`;
            return;
        }

        container.innerHTML = data.history.map(item => {
            const dateStr = new Date(item.created_at).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) + ' hs';
            return `
                <div class="history-item">
                    <div class="history-item-header">
                        <span>Editado por <strong class="history-item-editor">@${escapeHtml(item.editor_username)}</strong></span>
                        <span>${dateStr}</span>
                    </div>
                    <div class="history-diff-container">
                        <div class="diff-section removed">
                            <strong>Antes:</strong><br>
                            ${escapeHtml(item.old_story)}
                        </div>
                        <div class="diff-section added">
                            <strong>Después:</strong><br>
                            ${escapeHtml(item.new_story)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<div class="solidario-empty-donations" style="color:#ef4444;">${err.message}</div>`;
    }
}

// ============================================================================
// PANEL DE ADMINISTRACIÓN DEL AUTOR DE LA CAUSA
// ============================================================================
function initAuthorPanel(cause) {
    const authorEditCauseBtn = document.getElementById('authorEditCauseBtn');
    const authorPublishUpdateBtn = document.getElementById('authorPublishUpdateBtn');

    const editCauseModalOverlay = document.getElementById('editCauseModalOverlay');
    const publishUpdateModalOverlay = document.getElementById('publishUpdateModalOverlay');

    const editCancelBtn = document.getElementById('editCancelBtn');
    const editConfirmBtn = document.getElementById('editConfirmBtn');
    const editGoalInput = document.getElementById('editGoalInput');
    const editStoryInput = document.getElementById('editStoryInput');
    const editStoryCounter = document.getElementById('editStoryCounter');
    const editStoryLimitWarning = document.getElementById('editStoryLimitWarning');

    // Uploader de imágenes adicionales (Dropzone)
    const editCauseDropzone = document.getElementById('editCauseDropzone');
    const editCauseFileInput = document.getElementById('editCauseFileInput');
    const editCausePreviewContainer = document.getElementById('editCausePreviewContainer');
    let newUploadedImages = [];

    const updateCancelBtn = document.getElementById('updateCancelBtn');
    const updateConfirmBtn = document.getElementById('updateConfirmBtn');
    const updateTitleInput = document.getElementById('updateTitleInput');
    const updateTextInput = document.getElementById('updateTextInput');

    if (!authorEditCauseBtn) return;

    // --- RENDER DE MINIATURAS PREVIAS ---
    function renderEditCausePreviews() {
        editCausePreviewContainer.innerHTML = '';
        newUploadedImages.forEach((url, index) => {
            const div = document.createElement('div');
            div.style.position = 'relative';
            div.style.width = '70px';
            div.style.height = '70px';
            div.style.borderRadius = '8px';
            div.style.overflow = 'hidden';
            div.style.border = '1px solid rgba(255,255,255,0.1)';

            const img = document.createElement('img');
            img.src = url;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';

            const btn = document.createElement('button');
            btn.innerHTML = '&times;';
            btn.style.position = 'absolute';
            btn.style.top = '2px';
            btn.style.right = '2px';
            btn.style.width = '18px';
            btn.style.height = '18px';
            btn.style.background = 'rgba(239, 68, 68, 0.9)';
            btn.style.color = 'white';
            btn.style.border = 'none';
            btn.style.borderRadius = '50%';
            btn.style.cursor = 'pointer';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.fontSize = '12px';
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                newUploadedImages.splice(index, 1);
                renderEditCausePreviews();
            };

            div.appendChild(img);
            div.appendChild(btn);
            editCausePreviewContainer.appendChild(div);
        });
    }

    const resetEditUploader = () => {
        newUploadedImages = [];
        editCausePreviewContainer.innerHTML = '';
        if (editCauseDropzone) {
            editCauseDropzone.style.borderColor = 'rgba(255,255,255,0.15)';
            const p = editCauseDropzone.querySelector('p');
            if (p) p.textContent = 'Arrastra nuevas imágenes o haz clic aquí';
        }
    };

    // --- EVENTOS DEL DROPZONE ---
    if (editCauseDropzone && editCauseFileInput) {
        // [FIX] Abrir el selector de archivos al hacer clic en el dropzone
        editCauseDropzone.onclick = (e) => {
            e.stopPropagation(); // Evitar burbujeo que causa doble apertura del explorador
            editCauseFileInput.click();
        };

        // [FIX] Detener burbujeo del input file para no re-disparar el onclick del dropzone
        editCauseFileInput.onclick = (e) => {
            e.stopPropagation();
        };

        editCauseDropzone.ondragover = (e) => {
            e.preventDefault();
            editCauseDropzone.style.borderColor = '#3B82F6';
        };

        editCauseDropzone.ondragleave = () => {
            editCauseDropzone.style.borderColor = 'rgba(255,255,255,0.15)';
        };

        editCauseDropzone.ondrop = async (e) => {
            e.preventDefault();
            editCauseDropzone.style.borderColor = 'rgba(255,255,255,0.15)';
            const files = Array.from(e.dataTransfer.files);
            await handleFilesUpload(files);
        };

        editCauseFileInput.onchange = async () => {
            const files = Array.from(editCauseFileInput.files);
            await handleFilesUpload(files);
            editCauseFileInput.value = '';
        };
    }

    async function handleFilesUpload(files) {
        const token = localStorage.getItem('token');
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) return;

        if (newUploadedImages.length + imageFiles.length > 3) {
            showCustomAlert('Solo puedes agregar un máximo de 3 nuevas imágenes por cada actualización.');
            return;
        }

        const label = editCauseDropzone.querySelector('p');
        const originalText = label ? label.textContent : '';
        if (label) label.textContent = 'Subiendo...';

        try {
            for (const file of imageFiles) {
                const formData = new FormData();
                formData.append('images', file);
                formData.append('max_images', 3);

                const uploadRes = await fetch(`${API_URL}/api/media/upload`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                const uploadData = await uploadRes.json();
                if (!uploadRes.ok) {
                    throw new Error(uploadData.message || 'Error al subir la imagen.');
                }

                if (uploadData.urls && uploadData.urls.length > 0) {
                    newUploadedImages.push(uploadData.urls[0]);
                }
            }
            renderEditCausePreviews();
        } catch (error) {
            showCustomAlert(`Error al subir imágenes: ${error.message}`);
        } finally {
            if (label) label.textContent = originalText;
        }
    }

    // --- MODAL DE EDICIÓN ---
    authorEditCauseBtn.onclick = () => {
        editGoalInput.value = cause.goal_amount;
        editStoryInput.value = cause.story;
        editStoryCounter.textContent = `${cause.story.length} caracteres`;
        editStoryLimitWarning.style.display = 'none';
        resetEditUploader();
        editCauseModalOverlay.classList.add('active');
    };

    editCancelBtn.onclick = () => {
        editCauseModalOverlay.classList.remove('active');
        resetEditUploader();
    };

    // Contador de caracteres y cálculo aproximado del diff de historia
    editStoryInput.oninput = () => {
        const len = editStoryInput.value.length;
        editStoryCounter.textContent = `${len} caracteres (min 100)`;
        
        const originalLen = cause.story.length;
        const diffLen = Math.abs(originalLen - len);
        const percentChange = originalLen > 0 ? (diffLen / originalLen) * 100 : 0;
        
        if (percentChange > 15) {
            editStoryLimitWarning.style.display = 'inline';
        } else {
            editStoryLimitWarning.style.display = 'none';
        }
    };

    editConfirmBtn.onclick = async () => {
        const token = localStorage.getItem('token');
        const goalVal = editGoalInput.value.trim();
        const storyVal = editStoryInput.value.trim();

        if (isNaN(parseFloat(goalVal)) || parseFloat(goalVal) <= 0) {
            showCustomAlert('Por favor, ingresa una meta válida.');
            return;
        }

        if (storyVal.length < 100) {
            showCustomAlert('La historia debe tener al menos 100 caracteres.');
            return;
        }

        editConfirmBtn.disabled = true;
        editConfirmBtn.textContent = 'Guardando...';

        try {
            const response = await fetch(`${API_URL}/api/humanitarian/causes/${cause.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    goal_amount: parseFloat(goalVal),
                    story: storyVal,
                    new_evidence_urls: newUploadedImages
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Error al actualizar causa.');

            editCauseModalOverlay.classList.remove('active');
            resetEditUploader();
            showCustomAlert('Causa actualizada exitosamente.', () => {
                window.location.reload();
            });
        } catch (err) {
            showCustomAlert(err.message);
        } finally {
            editConfirmBtn.disabled = false;
            editConfirmBtn.textContent = 'Guardar Cambios';
        }
    };

    // --- MODAL DE NOVEDADES ---
    authorPublishUpdateBtn.onclick = () => {
        updateTitleInput.value = '';
        updateTextInput.value = '';
        publishUpdateModalOverlay.classList.add('active');
    };

    updateCancelBtn.onclick = () => {
        publishUpdateModalOverlay.classList.remove('active');
    };

    updateConfirmBtn.onclick = async () => {
        const token = localStorage.getItem('token');
        const titleVal = updateTitleInput.value.trim();
        const textVal = updateTextInput.value.trim();

        if (titleVal.length < 5) {
            showCustomAlert('El título de la novedad debe tener al menos 5 caracteres.');
            return;
        }

        if (textVal.length < 20) {
            showCustomAlert('El contenido de la novedad debe tener al menos 20 caracteres.');
            return;
        }

        updateConfirmBtn.disabled = true;
        updateConfirmBtn.textContent = 'Publicando...';

        try {
            const response = await fetch(`${API_URL}/api/humanitarian/causes/${cause.id}/updates`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    update_title: titleVal,
                    update_text: textVal
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Error al publicar novedad.');

            publishUpdateModalOverlay.classList.remove('active');
            showCustomAlert('Novedad publicada y correos transaccionales enviados con éxito.', () => {
                window.location.reload();
            });
        } catch (err) {
            showCustomAlert(err.message);
        } finally {
            updateConfirmBtn.disabled = false;
            updateConfirmBtn.textContent = 'Publicar y Notificar';
        }
    };
}

// --- MANEJO DE LIGHTBOX PARA IMÁGENES DE LA CAUSA ---
document.addEventListener('click', (e) => {
    // [FIX] Soportar el nuevo selector del carrusel (.cause-carousel-track img) y el anterior
    const pubImg = e.target.closest('.cause-carousel-track img, .card-images-container img');
    if (pubImg) {
        const evidenceLightboxModal = document.getElementById('evidenceLightboxModal');
        const container = document.getElementById('lightboxImagesContainer');
        if (evidenceLightboxModal && container) {
            // [FILTRO] Solo mostrar imágenes reales en el lightbox, no enlaces de Drive/redes
            const rawUrls = window.currentCause?.evidence_urls || [];
            const imgUrls = rawUrls.filter(u => {
                if (!u || typeof u !== 'string') return false;
                const lower = u.toLowerCase();
                return lower.includes('/uploads/') || /\.(webp|png|jpg|jpeg|gif)(\?.*)?$/i.test(lower);
            });
            if (imgUrls.length > 0) {
                container.innerHTML = imgUrls.map(url => `
                    <img src="${escapeAttr(url)}" style="max-height: 85vh; max-width: 100%; object-fit: contain; scroll-snap-align: center; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
                `).join('');

                const clickedUrl = pubImg.getAttribute('src');
                const clickedIndex = imgUrls.indexOf(clickedUrl);
                if (clickedIndex !== -1 && container.children[clickedIndex]) {
                    setTimeout(() => {
                        container.children[clickedIndex].scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
                    }, 50);
                }
                evidenceLightboxModal.style.display = 'flex';
            }
        }
    }

    // Cerrar Lightbox al hacer clic en cerrar o fuera de la imagen
    if (e.target.closest('.lightbox-close-button') || e.target.id === 'evidenceLightboxModal') {
        const evidenceLightboxModal = document.getElementById('evidenceLightboxModal');
        if (evidenceLightboxModal) {
            evidenceLightboxModal.style.display = 'none';
        }
    }
});
