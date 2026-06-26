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

        // --- REDIRECCIÓN DE ONBOARDING PARA INVITADOS ---
        // Si el usuario no está autenticado (no hay token), lo redirigimos al registro
        // pre-llenando el código de referido del beneficiario de la causa.
        if (!token) {
            const currentPath = 'causa-solidaria.html' + window.location.search;
            const refParam = cause.beneficiary_referral_code ? `&ref=${encodeURIComponent(cause.beneficiary_referral_code)}` : '';
            window.location.href = `register.html?returnTo=${encodeURIComponent(currentPath)}${refParam}`;
            return;
        }

        const donations = data.donations || { donations: [], summary: {} };

        container.innerHTML = buildCauseHTML(cause, donations);

        // Inicializar interactividad
        initDonateButton(cause);
        initShareButton(cause);
        initDonationsList(donations);
        initCancelButton(cause);

    } catch (err) {
        console.error('[SOLIDARIO] Error al cargar causa:', err);

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

    // Formatear fecha de creación
    const createdDate = new Date(cause.created_at).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

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

        <!-- TARJETA PRINCIPAL -->
        <div class="solidario-cause-card">
            <h1 class="solidario-cause-title" id="solidarioCauseTitle">${escapeHtml(cause.title)}</h1>
            <div class="solidario-cause-meta">
                <span>👤 Creador: <strong><a href="profile.html?user=${encodeURIComponent(cause.creator_username)}" class="profile-link" style="color: #a5b4fc; text-decoration: underline;">${escapeHtml(cause.creator_username || 'Creador')}</a></strong></span>
                ${cause.beneficiary_username && cause.beneficiary_username !== cause.creator_username ? `<span>💖 Beneficiario: <strong>${cause.foundation_name ? `${escapeHtml(cause.foundation_name)} ` : ''}<a href="profile.html?user=${encodeURIComponent(cause.beneficiary_username)}" class="profile-link" style="color: #a5b4fc; text-decoration: underline;">(@${escapeHtml(cause.beneficiary_username)})</a></strong></span>` : ''}
                <span>📅 ${createdDate}</span>
                <span style="display:flex; align-items:center; gap:4px; color:#60a5fa;">${heartIcon} ${countDonations} ${countDonations === 1 ? 'donación' : 'donaciones'}</span>
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

        <!-- LISTA DE DONACIONES -->
        <div class="solidario-donations-section" id="solidarioDonationsSection">
            <div class="solidario-donations-title" style="display:flex; align-items:center; gap:8px;">
                <span style="color:#e83e8c;">${heartIcon}</span> Donaciones recibidas
            </div>
            <div id="solidarioDonationsList">
                <!-- Se llena dinámicamente -->
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
                showCustomAlert('Debes iniciar sesión para donar.');
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
            const balance = parseFloat(profileData.total_booster_blue) || 0;

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

    // Limpiar input y resetear estado
    amountInput.value = '';
    confirmBtn.disabled = false;
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
                body: JSON.stringify({ amount })
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

    cancelBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (confirm('¿Estás seguro de que deseas cancelar y cerrar esta causa? Si lo haces, ya no podrás recibir más donaciones en esta y quedará marcada como culminada.')) {
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
                    alert(result.message || 'Causa cancelada exitosamente.');
                    window.location.reload();
                } else {
                    alert(result.message || 'Error al cancelar la causa.');
                    cancelBtn.disabled = false;
                    cancelBtn.textContent = '🛑 Cancelar y Cerrar Causa Actual';
                }
            } catch (err) {
                console.error('Error canceling cause:', err);
                alert('Error de red al intentar cancelar.');
                cancelBtn.disabled = false;
                cancelBtn.textContent = '🛑 Cancelar y Cerrar Causa Actual';
            }
        }
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

        return `
            <div class="solidario-donation-item">
                <div>
                    <div class="solidario-donation-user">@${escapeHtml(d.donor_username)}</div>
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
 * Escapa HTML para prevenir XSS (seguridad obligatoria en fintech)
 * Convierte caracteres especiales a entidades HTML seguras
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
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
