// ============================================================================
// WintonCoin - Momentum Dashboard Logic
// ============================================================================
// Panel privado del influencer: saldos, marketplace de misiones,
// entregas de tareas e historial de movimientos.
//
// Requiere autenticación (JWT). Redirige a login si no hay sesión.
// ============================================================================

import { getApiUrl } from '../modules/config.js';
import { checkAuthStatus } from '../modules/auth.js';

// ============================================================================
// CONSTANTES
// ============================================================================

const API_URL = getApiUrl();
let authToken = null;
let userProfile = null;  // Perfil de Momentum del usuario

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[MOMENTUM DASHBOARD] Inicializando...');

    // 1. Verificar autenticación
    authToken = localStorage.getItem('token');
    if (!authToken) {
        showToast('Debes iniciar sesión para acceder.', 'error');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
        return;
    }

    const authResult = await checkAuthStatus();
    if (!authResult || !authResult.isAuthenticated) {
        window.location.href = 'index.html';
        return;
    }

    // Mostrar nombre de usuario en el header
    const usernameEl = document.getElementById('mmd-username');
    if (usernameEl && authResult.username) {
        usernameEl.textContent = `@${authResult.username}`;
    }

    // 2. Cargar perfil de Momentum
    await loadProfile();

    // 3. Configurar modal de entrega
    setupModal();

    // 4. Delegación de eventos global para el dashboard
    const mainEl = document.getElementById('mmd-main');
    if (mainEl) {
        mainEl.addEventListener('click', (e) => {
            // Caso 1: Click en el botón "Entregar"
            const btn = e.target.closest('.mmd-submit-trigger');
            // Caso 2: Click en cualquier parte de la tarjeta
            const card = e.target.closest('.mmd-campaign-card');

            if (btn || card) {
                const target = btn || card;
                e.preventDefault();
                e.stopPropagation();

                const campaignId = target.dataset.campaignId || target.dataset.id;
                const campaignTitle = target.dataset.campaignTitle || target.dataset.title;
                const campaignDesc = target.dataset.campaignDesc;

                openModal(campaignId, campaignTitle, campaignDesc);
            }
        });
    }
});

// ============================================================================
// PERFIL Y DATOS
// ============================================================================

/**
 * Carga el perfil de Momentum del usuario.
 * Si no tiene perfil, redirige a la landing.
 * Si tiene tier PENDIENTE, muestra estado de espera.
 */
async function loadProfile() {
    const mainEl = document.getElementById('mmd-main');
    const loadingEl = document.getElementById('mmd-loading');

    try {
        const response = await fetch(`${API_URL}/api/momentum/profile`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.status === 404) {
            // No tiene perfil → a la landing para postularse
            showToast('Primero debes postularte como creador.', 'info');
            setTimeout(() => { window.location.href = 'momentum-landing.html'; }, 2000);
            return;
        }

        if (!response.ok) throw new Error('Error al cargar perfil');

        userProfile = await response.json();

        // Actualizar tier badge en el header
        const tierBadge = document.getElementById('mmd-tier-badge');
        if (tierBadge) {
            const tierEmoji = { PENDIENTE: '⏳', BRONCE: '🥉', PLATA: '🥈', ORO: '🥇' };
            tierBadge.textContent = `${tierEmoji[userProfile.tier] || ''} ${userProfile.tier}`;
            tierBadge.className = `mmd-header__tier --${userProfile.tier.toLowerCase()}`;
        }

        // Si el tier es PENDIENTE, mostrar estado de espera
        if (userProfile.tier === 'PENDIENTE') {
            if (loadingEl) loadingEl.style.display = 'none';
            mainEl.innerHTML = `
                <div class="mmd-pending-state">
                    <div class="mmd-pending-state__icon">⏳</div>
                    <h2 class="mmd-pending-state__title">Perfil en Revisión</h2>
                    <p class="mmd-pending-state__desc">
                        Tu postulación está siendo evaluada por un administrador.
                        Pronto recibirás una notificación con tu nivel asignado y podrás acceder a las misiones.
                    </p>
                </div>
            `;
            return;
        }

        // Tier activo: cargar dashboard completo
        if (loadingEl) loadingEl.style.display = 'none';
        await renderDashboard();

    } catch (error) {
        console.error('[MOMENTUM DASHBOARD] Error:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (mainEl) {
            mainEl.innerHTML = `
                <div class="mmd-empty">❌ Error al cargar tu perfil. Intenta recargar la página.</div>
            `;
        }
    }
}

/**
 * Renderiza el dashboard completo: saldos + campañas + historial.
 */
async function renderDashboard() {
    const mainEl = document.getElementById('mmd-main');

    // Cargar datos en paralelo
    const [balanceData, campaignsData, submissionsData] = await Promise.all([
        fetchBalance(),
        fetchCampaigns(),
        fetchSubmissions()
    ]);

    mainEl.innerHTML = `
        <!-- Saldos -->
        <section class="mmd-balance-row">
            ${renderBalanceCards(balanceData)}
        </section>

        <!-- Marketplace de Misiones -->
        <section class="mmd-campaigns">
            <h3 class="mmd-section-title">🎯 Misiones Disponibles</h3>
            <div class="mmd-campaigns-grid" id="mmd-campaigns-grid">
                ${renderCampaigns(campaignsData)}
            </div>
        </section>

        <!-- Historial de Entregas -->
        <section class="mmd-submissions">
            <h3 class="mmd-section-title">📋 Mis Entregas</h3>
            <div id="mmd-submissions-list">
                ${renderSubmissions(submissionsData)}
            </div>
        </section>
    `;

}

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

async function fetchBalance() {
    try {
        const response = await fetch(`${API_URL}/api/momentum/balance`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) return null;
        return await response.json();
    } catch { return null; }
}

async function fetchCampaigns() {
    try {
        const response = await fetch(`${API_URL}/api/momentum/campaigns`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) return { campaigns: [] };
        return await response.json();
    } catch { return { campaigns: [] }; }
}

async function fetchSubmissions() {
    try {
        const response = await fetch(`${API_URL}/api/momentum/submissions`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) return [];
        return await response.json();
    } catch { return []; }
}

// ============================================================================
// RENDER FUNCTIONS
// ============================================================================

function renderBalanceCards(data) {
    if (!data) {
        return `
            <div class="mmd-balance-card --confirmed">
                <div class="mmd-balance-card__label">Saldo Confirmado</div>
                <div class="mmd-balance-card__value">—</div>
                <div class="mmd-balance-card__unit">BLUE IOU</div>
            </div>
        `;
    }

    const confirmed = parseFloat(data.confirmed_balance).toLocaleString('es-ES', { maximumFractionDigits: 4 });
    const pending = parseFloat(data.pending_verification).toLocaleString('es-ES', { maximumFractionDigits: 4 });
    const earned = parseFloat(data.total_earned_momentum).toLocaleString('es-ES', { maximumFractionDigits: 4 });

    return `
        <div class="mmd-balance-card --confirmed">
            <div class="mmd-balance-card__label">Saldo Total Confirmado</div>
            <div class="mmd-balance-card__value">${confirmed}</div>
            <div class="mmd-balance-card__unit">BLUE IOU (acreditado)</div>
        </div>
        <div class="mmd-balance-card --pending">
            <div class="mmd-balance-card__label">Pendiente de Verificación</div>
            <div class="mmd-balance-card__value">${pending}</div>
            <div class="mmd-balance-card__unit">BLUE IOU (estimado)</div>
        </div>
        <div class="mmd-balance-card --info">
            <div class="mmd-balance-card__label">Ganado en Momentum</div>
            <div class="mmd-balance-card__value">${earned}</div>
            <div class="mmd-balance-card__unit">BLUE IOU (total histórico)</div>
        </div>
    `;
}

function renderCampaigns(data) {
    const campaigns = data?.campaigns || [];

    if (campaigns.length === 0) {
        return `<div class="mmd-empty">🎯 No hay misiones disponibles en este momento. ¡Pronto habrá nuevas!</div>`;
    }

    return campaigns.map(c => {
        const pay = parseFloat(c.my_final_pay).toLocaleString('es-ES', { maximumFractionDigits: 2 });
        const basePay = parseFloat(c.my_base_pay).toLocaleString('es-ES', { maximumFractionDigits: 2 });
        const isRepeatable = c.allow_multiple;

        return `
            <div class="mmd-campaign-card" 
                 data-campaign-id="${c.id}" 
                 data-campaign-title="${escapeAttr(c.title)}" 
                 data-campaign-desc="${escapeAttr(c.description)}">
                <div class="mmd-campaign-card__header">
                    <h4 class="mmd-campaign-card__title">
                        ${escapeHtml(c.title)}
                        ${isRepeatable ? '<span class="mmd-status-badge" style="font-size: 0.6rem; vertical-align: middle; margin-left: 6px; background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-color: rgba(59, 130, 246, 0.2);">Repetible</span>' : ''}
                    </h4>
                    <span class="mmd-campaign-card__pay">${pay} BLUE IOU</span>
                </div>
                <p class="mmd-campaign-card__desc">${escapeHtml(c.description)}</p>
                <div class="mmd-campaign-card__footer">
                    <span class="mmd-campaign-card__meta">Base: ${basePay} × ${c.applied_multiplier}</span>
                    <button class="mmd-btn mmd-btn--gold mmd-btn--small mmd-submit-trigger" 
                            data-id="${c.id}" 
                            data-title="${escapeAttr(c.title)}"
                            data-campaign-desc="${escapeAttr(c.description)}">
                        📤 Entregar
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderSubmissions(submissions) {
    if (!submissions || submissions.length === 0) {
        return `<div class="mmd-empty">📋 Aún no has enviado entregas. ¡Selecciona una misión para comenzar!</div>`;
    }

    return submissions.map(s => {
        const statusClass = `--${s.status.toLowerCase()}`;
        const statusLabel = { PENDIENTE: 'Pendiente', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado' };
        const date = new Date(s.submitted_at).toLocaleDateString('es-ES');
        const paidText = s.paid_amount ? `+${parseFloat(s.paid_amount).toLocaleString('es-ES', { maximumFractionDigits: 2 })} BLUE IOU` : '';

        return `
            <div class="mmd-submission-item">
                <div class="mmd-submission-item__left">
                    <div class="mmd-submission-item__title">${escapeHtml(s.campaign_title)}</div>
                    <div class="mmd-submission-item__date">${date}</div>
                    ${s.admin_note ? `<div class="mmd-submission-item__date" style="color: var(--mm-text-secondary);">📝 ${escapeHtml(s.admin_note)}</div>` : ''}
                </div>
                <div class="mmd-submission-item__right">
                    ${paidText ? `<span style="color: var(--mm-green); font-weight: 700;">${paidText}</span>` : ''}
                    <span class="mmd-status-badge ${statusClass}">${statusLabel[s.status] || s.status}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================================
// MODAL DE ENTREGA
// ============================================================================

function setupModal() {
    const overlay = document.getElementById('mmd-modal-overlay');
    const cancelBtn = document.getElementById('mmd-modal-cancel');
    const form = document.getElementById('mmd-submit-form');

    // Cerrar modal
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => closeModal());
    }
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }

    // Enviar entrega
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitTask();
        });
    }
}

function openModal(campaignId, campaignTitle, campaignDesc) {
    const overlay = document.getElementById('mmd-modal-overlay');
    const titleEl = document.getElementById('mmd-modal-title');
    const subtitleEl = document.getElementById('mmd-modal-subtitle');
    const descEl = document.getElementById('mmd-modal-mission-desc');
    const campaignIdInput = document.getElementById('mmd-modal-campaign-id');
    const proofInput = document.getElementById('mmd-proof-link');

    if (titleEl) titleEl.textContent = `📋 Detalle: ${campaignTitle}`;
    if (subtitleEl) subtitleEl.textContent = 'Revisa las instrucciones y pega el link de tu contenido.';

    if (descEl) {
        descEl.textContent = campaignDesc || 'Sin descripción disponible.';
    }

    if (campaignIdInput) campaignIdInput.value = campaignId;
    if (proofInput) proofInput.value = '';

    if (overlay) overlay.classList.add('--visible');
}

function closeModal() {
    const overlay = document.getElementById('mmd-modal-overlay');
    if (overlay) overlay.classList.remove('--visible');
}

async function submitTask() {
    const campaignId = document.getElementById('mmd-modal-campaign-id')?.value;
    const proofLink = document.getElementById('mmd-proof-link')?.value?.trim();
    const submitBtn = document.getElementById('mmd-modal-submit');

    if (!campaignId || !proofLink) {
        showToast('Completa todos los campos.', 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Enviando...';

    try {
        const response = await fetch(`${API_URL}/api/momentum/submissions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                campaign_id: parseInt(campaignId),
                proof_link: proofLink
            })
        });

        const data = await response.json();

        if (response.ok) {
            showToast(data.message || '¡Entrega enviada!', 'success');
            closeModal();
            // Recargar el dashboard para reflejar la nueva entrega
            await renderDashboard();
        } else {
            showToast(data.message || 'Error al enviar entrega.', 'error');
        }
    } catch (error) {
        console.error('[MOMENTUM] Error en envío:', error);
        showToast('Error de conexión. Intenta nuevamente.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '📤 Enviar Entrega';
    }
}


// ============================================================================
// UTILIDADES
// ============================================================================

function showToast(message, type = 'info') {
    const toast = document.getElementById('mmd-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `mmd-toast --${type} --visible`;
    setTimeout(() => { toast.classList.remove('--visible'); }, 4000);
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
