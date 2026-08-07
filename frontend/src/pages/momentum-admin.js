// ============================================================================
// WintonCoin - Momentum Admin Panel Logic
// ============================================================================
// Panel completo del administrador para gestionar el ecosistema Momentum:
//
// TABS:
//   1. Config Global    → Editar multiplicador, fase, cupos
//   2. Postulantes      → Ver y asignar tiers a nuevos influencers
//   3. Influencers      → Listado de influencers activos con sus niveles
//   4. Campañas         → Crear/editar misiones con pagos por tier
//   5. Verificar        → Aprobar/Rechazar entregas de tareas
//
// Autenticación: admin_token (cookie httpOnly) — gestionado por el backend
// ============================================================================

import { getApiUrl, showCustomConfirm } from '../modules/index.js';

const API_URL = getApiUrl();

// ============================================================================
// ESTADO GLOBAL
// ============================================================================

/** @type {string|null} Tab activa actual */
let activeTab = 'config';

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[MOMENTUM ADMIN] Inicializando panel...');

    // 1. Configurar navegación por tabs
    setupTabs();

    // 2. Cargar datos de la tab activa
    await loadTabData('config');

    // 3. Event listeners de botones globales
    setupGlobalListeners();
});

// ============================================================================
// NAVEGACIÓN POR TABS
// ============================================================================

/**
 * Configura la navegación por tabs.
 * Cada tab carga sus datos bajo demanda (lazy loading).
 */
function setupTabs() {
    const tabs = document.querySelectorAll('.mma-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            const panel = tab.dataset.panel;
            if (panel === activeTab) return;

            // Cambiar tab activa visualmente
            tabs.forEach(t => t.classList.remove('--active'));
            tab.classList.add('--active');

            // Ocultar todos los paneles, mostrar el seleccionado
            document.querySelectorAll('.mma-panel').forEach(p => p.classList.remove('--active'));
            const panelEl = document.getElementById(`mma-panel-${panel}`);
            if (panelEl) panelEl.classList.add('--active');

            activeTab = panel;
            await loadTabData(panel);
        });
    });
}

/**
 * Carga los datos de una tab específica.
 */
async function loadTabData(tab) {
    switch (tab) {
        case 'config': await loadConfig(); break;
        case 'applicants': await loadApplicants(); break;
        case 'profiles': await loadProfiles(); break;
        case 'campaigns': await loadCampaigns(); break;
        case 'verify': await loadSubmissions(); break;
    }
}

// ============================================================================
// TAB: CONFIGURACIÓN GLOBAL
// ============================================================================

/**
 * Carga la configuración global de Momentum y llena los inputs.
 */
async function loadConfig() {
    try {
        const response = await adminFetch('/api/momentum/admin/config');
        if (!response.ok) throw new Error('Error al cargar config');

        const config = await response.json();

        // Llenar los inputs con los valores actuales
        setInputValue('mma-cfg-multiplier', config.multiplier);
        setInputValue('mma-cfg-phase', config.phase_name);
        setInputValue('mma-cfg-total-slots', config.total_slots);
        setInputValue('mma-cfg-occupied', config.occupied_slots);

        // Formatear la fecha para el input datetime-local
        if (config.phase_end_date) {
            const date = new Date(config.phase_end_date);
            const localISO = date.toISOString().slice(0, 16);
            setInputValue('mma-cfg-end-date', localISO);
        }
    } catch (error) {
        console.error('[MOMENTUM ADMIN] Error cargando config:', error);
        showToast('Error al cargar configuración.', 'error');
    }
}

/**
 * Guarda la configuración global.
 */
async function saveConfig() {
    const data = {
        multiplier: parseFloat(document.getElementById('mma-cfg-multiplier')?.value) || 1,
        phase_name: document.getElementById('mma-cfg-phase')?.value || '',
        total_slots: parseInt(document.getElementById('mma-cfg-total-slots')?.value) || 0,
        occupied_slots: parseInt(document.getElementById('mma-cfg-occupied')?.value) || 0,
        phase_end_date: document.getElementById('mma-cfg-end-date')?.value || null
    };

    try {
        const response = await adminFetch('/api/momentum/admin/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showToast('✅ Configuración guardada correctamente.', 'success');
        } else {
            const result = await response.json();
            showToast(result.message || 'Error al guardar.', 'error');
        }
    } catch (error) {
        console.error('[MOMENTUM ADMIN] Error guardando config:', error);
        showToast('Error de conexión.', 'error');
    }
}

// ============================================================================
// TAB: POSTULANTES (Nuevos Influencers Pendientes)
// ============================================================================

async function loadApplicants() {
    const listEl = document.getElementById('mma-applicants-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="mmd-loading"><div class="mmd-spinner"></div></div>';

    try {
        const response = await adminFetch('/api/momentum/admin/applicants');
        if (!response.ok) throw new Error('Error');

        const applicants = await response.json();

        if (applicants.length === 0) {
            listEl.innerHTML = '<div class="mmd-empty">No hay postulantes pendientes.</div>';
            return;
        }

        listEl.innerHTML = `
            <div class="mma-table-wrap">
                <div class="mma-table-scroll">
                    <table class="mma-table">
                        <thead>
                            <tr>
                                <th>Usuario</th>
                                <th>Nickname</th>
                                <th>Plataforma</th>
                                <th>Seguidores</th>
                                <th>Link</th>
                                <th>Nicho</th>
                                <th>Asignar Tier</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${applicants.map(a => `
                                <tr>
                                    <td><strong>${escapeHtml(a.username)}</strong></td>
                                    <td>${escapeHtml(a.nickname)}</td>
                                    <td>${escapeHtml(a.social_platform)}</td>
                                    <td>${(a.followers_count || 0).toLocaleString('es-ES')}</td>
                                    <td><a href="${escapeAttr(a.social_link)}" target="_blank" rel="noopener" style="color: var(--mma-blue); font-weight: 600;">Ver ↗</a></td>
                                    <td>${escapeHtml(a.niche || '—')}</td>
                                    <td>
                                        <select class="mma-tier-select" data-profile-id="${a.id}">
                                            <option value="">Seleccionar...</option>
                                            <option value="VISIONARIO">👀 Visionario</option>
                                            <option value="BRONCE">🥉 Bronce</option>
                                            <option value="PLATA">🥈 Plata</option>
                                            <option value="ORO">🥇 Oro</option>
                                        </select>
                                        <button class="mma-btn mma-btn--gold mma-btn--small mma-assign-tier-btn" 
                                                data-profile-id="${a.id}" style="margin-left: 6px;">
                                            ✓ Asignar
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Agregar listeners a los botones de asignar tier
        listEl.querySelectorAll('.mma-assign-tier-btn').forEach(btn => {
            btn.addEventListener('click', () => assignTier(btn.dataset.profileId));
        });
    } catch (error) {
        console.error('[MOMENTUM ADMIN] Error cargando postulantes:', error);
        listEl.innerHTML = '<div class="mmd-empty">Error al cargar postulantes.</div>';
    }
}

/**
 * Asigna un tier a un postulante.
 */
async function assignTier(profileId) {
    const select = document.querySelector(`select[data-profile-id="${profileId}"]`);
    const tier = select?.value;

    if (!tier) {
        showToast('Selecciona un tier primero.', 'error');
        return;
    }

    try {
        const response = await adminFetch(`/api/momentum/admin/profiles/${profileId}/tier`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tier })
        });

        const result = await response.json();

        if (response.ok) {
            showToast(`✅ Tier ${tier} asignado correctamente.`, 'success');
            // Recargar la lista
            await loadApplicants();
        } else {
            showToast(result.message || 'Error al asignar tier.', 'error');
        }
    } catch (error) {
        showToast('Error de conexión.', 'error');
    }
}

// ============================================================================
// TAB: INFLUENCERS (Todos los perfiles)
// ============================================================================

async function loadProfiles() {
    const listEl = document.getElementById('mma-profiles-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="mmd-loading"><div class="mmd-spinner"></div></div>';

    try {
        const response = await adminFetch('/api/momentum/admin/profiles');
        if (!response.ok) throw new Error('Error');

        const profiles = await response.json();

        if (profiles.length === 0) {
            listEl.innerHTML = '<div class="mmd-empty">No hay influencers registrados.</div>';
            return;
        }

        listEl.innerHTML = `
            <div class="mma-stats-row">
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${profiles.length}</div>
                    <div class="mma-stat-card__label">Total Influencers</div>
                </div>
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${profiles.filter(p => p.tier === 'VISIONARIO').length}</div>
                    <div class="mma-stat-card__label">👀 Visionario</div>
                </div>
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${profiles.filter(p => p.tier === 'BRONCE').length}</div>
                    <div class="mma-stat-card__label">🥉 Bronce</div>
                </div>
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${profiles.filter(p => p.tier === 'PLATA').length}</div>
                    <div class="mma-stat-card__label">🥈 Plata</div>
                </div>
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${profiles.filter(p => p.tier === 'ORO').length}</div>
                    <div class="mma-stat-card__label">🥇 Oro</div>
                </div>
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${profiles.filter(p => p.tier === 'PLATINO').length}</div>
                    <div class="mma-stat-card__label">💎 Platino</div>
                </div>
            </div>
            <div class="mma-table-wrap">
                <div class="mma-table-scroll">
                    <table class="mma-table">
                        <thead>
                            <tr>
                                <th>Nickname</th>
                                <th>Usuario</th>
                                <th>Tier</th>
                                <th>Plataforma</th>
                                <th>Seguidores</th>
                                <th>Creado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${profiles.map(p => {
                const tierBadge = `<span class="mma-badge --${p.tier.toLowerCase()}">${p.tier}</span>`;
                const date = new Date(p.created_at).toLocaleDateString('es-ES');
                return `
                                    <tr>
                                        <td><strong>${escapeHtml(p.nickname)}</strong></td>
                                        <td>${escapeHtml(p.username)}</td>
                                        <td>${tierBadge}</td>
                                        <td>${escapeHtml(p.social_platform)}</td>
                                        <td>${(p.followers_count || 0).toLocaleString('es-ES')}</td>
                                        <td>${date}</td>
                                    </tr>
                                `;
            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('[MOMENTUM ADMIN] Error cargando perfiles:', error);
        listEl.innerHTML = '<div class="mmd-empty">Error al cargar influencers.</div>';
    }
}

// ============================================================================
// TAB: CAMPAÑAS
// ============================================================================
let allCampaignsCache = [];

async function loadCampaigns() {
    const listEl = document.getElementById('mma-campaigns-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="mmd-loading"><div class="mmd-spinner"></div></div>';

    try {
        const response = await adminFetch('/api/momentum/admin/campaigns');
        if (!response.ok) throw new Error('Error');

        const campaigns = await response.json();
        allCampaignsCache = campaigns;

        if (campaigns.length === 0) {
            listEl.innerHTML = '<div class="mmd-empty">No hay campañas creadas. ¡Crea la primera arriba!</div>';
            return;
        }

        listEl.innerHTML = `
            <div class="mma-table-wrap">
                <div class="mma-table-scroll">
                    <table class="mma-table">
                        <thead>
                            <tr>
                                <th>Título</th>
                                <th>Estado</th>
                                <th>Tipo</th>
                                <th>👀 Visionario</th>
                                <th>🥉 Bronce</th>
                                <th>🥈 Plata</th>
                                <th>🥇 Oro</th>
                                <th>💎 Platino</th>
                                <th>Creada</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${campaigns.map(c => {
                const active = c.is_active;
                const statusBadge = active
                    ? '<span class="mma-badge --aprobado">Activa</span>'
                    : '<span class="mma-badge --rechazado">Inactiva</span>';
                const typeBadge = c.allow_multiple
                    ? '<span class="mma-badge --visionario">Repetible</span>'
                    : '<span class="mma-badge --pendiente">Única</span>';
                const date = new Date(c.created_at).toLocaleDateString('es-ES');
                return `
                                    <tr>
                                        <td><strong>${escapeHtml(c.title)}</strong></td>
                                        <td>${statusBadge}</td>
                                        <td>${typeBadge}</td>
                                        <td>${parseFloat(c.base_pay_visionario || 0).toLocaleString('es-ES')}</td>
                                        <td>${parseFloat(c.base_pay_bronce).toLocaleString('es-ES')}</td>
                                        <td>${parseFloat(c.base_pay_plata).toLocaleString('es-ES')}</td>
                                        <td>${parseFloat(c.base_pay_oro).toLocaleString('es-ES')}</td>
                                        <td>${parseFloat(c.base_pay_platino || 0).toLocaleString('es-ES')}</td>
                                        <td>${date}</td>
                                        <td>
                                            <button class="mma-btn mma-btn--ghost mma-btn--small mma-toggle-status-btn" 
                                                    data-id="${c.id}" data-active="${active}">
                                                ${active ? '⏸️ Pausar' : '▶️ Activar'}
                                            </button>
                                            <button class="mma-btn mma-btn--ghost mma-btn--small mma-edit-campaign-btn" style="margin-left: 5px;" data-id="${c.id}">
                                                ✏️ Editar
                                            </button>
                                        </td>
                                    </tr>
                                `;
            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Listeners: pausar/activar campaña
        listEl.querySelectorAll('.mma-toggle-status-btn').forEach(btn => {
            btn.addEventListener('click', () => toggleCampaignStatus(btn.dataset.id, btn.dataset.active === 'true'));
        });

        // Listeners: editar campaña
        listEl.querySelectorAll('.mma-edit-campaign-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditCampaignModal(btn.dataset.id));
        });
    } catch (error) {
        console.error('[MOMENTUM ADMIN] Error cargando campañas:', error);
        listEl.innerHTML = '<div class="mmd-empty">Error al cargar campañas.</div>';
    }
}

/**
 * Crear una nueva campaña.
 */
async function createCampaign() {
    const title = document.getElementById('mma-camp-title')?.value?.trim();
    const description = document.getElementById('mma-camp-desc')?.value?.trim();
    const base_pay_visionario = parseFloat(document.getElementById('mma-camp-visionario')?.value) || 0;
    const base_pay_bronce = parseFloat(document.getElementById('mma-camp-bronce')?.value) || 0;
    const base_pay_plata = parseFloat(document.getElementById('mma-camp-plata')?.value) || 0;
    const base_pay_oro = parseFloat(document.getElementById('mma-camp-oro')?.value) || 0;
    const base_pay_platino = parseFloat(document.getElementById('mma-camp-platino')?.value) || 0;
    const allow_multiple = document.getElementById('mma-camp-multiple')?.checked || false;

    if (!title) {
        showToast('El título de la campaña es obligatorio.', 'error');
        return;
    }

    if (base_pay_visionario <= 0 && base_pay_bronce <= 0 && base_pay_plata <= 0 && base_pay_oro <= 0 && base_pay_platino <= 0) {
        showToast('Al menos un pago base debe ser mayor a 0.', 'error');
        return;
    }

    try {
        const response = await adminFetch('/api/momentum/admin/campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, base_pay_visionario, base_pay_bronce, base_pay_plata, base_pay_oro, base_pay_platino, allow_multiple })
        });

        const result = await response.json();

        if (response.ok) {
            showToast('🎯 Campaña creada exitosamente.', 'success');
            // Limpiar formulario
            document.getElementById('mma-camp-title').value = '';
            document.getElementById('mma-camp-desc').value = '';
            document.getElementById('mma-camp-visionario').value = '';
            document.getElementById('mma-camp-bronce').value = '';
            document.getElementById('mma-camp-plata').value = '';
            document.getElementById('mma-camp-oro').value = '';
            document.getElementById('mma-camp-platino').value = '';
            document.getElementById('mma-camp-multiple').checked = false;
            // Recargar lista
            await loadCampaigns();
        } else {
            showToast(result.message || 'Error al crear campaña.', 'error');
        }
    } catch (error) {
        showToast('Error de conexión.', 'error');
    }
}

/**
 * Pausar o Reactivar una campaña de forma profesional.
 */
function toggleCampaignStatus(campaignId, currentlyActive) {
    const actionLabel = currentlyActive ? 'pausar' : 'reactivar';
    const newStatus = !currentlyActive;

    showCustomConfirm(
        `¿Estás seguro de que deseas ${actionLabel} esta campaña?`,
        async () => {
            try {
                const response = await adminFetch(`/api/momentum/admin/campaigns/${campaignId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_active: newStatus })
                });

                if (response.ok) {
                    showToast(`Campaña ${newStatus ? 'reactivada' : 'pausada'} correctamente.`, 'success');
                    await loadCampaigns();
                } else {
                    const result = await response.json();
                    showToast(result.message || `Error al ${actionLabel}.`, 'error');
                }
            } catch (error) {
                showToast('Error de conexión.', 'error');
            }
        }
    );
}

// ============================================================================
// TAB: VERIFICACIÓN DE ENTREGAS
// ============================================================================

async function loadSubmissions() {
    const listEl = document.getElementById('mma-verify-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="mmd-loading"><div class="mmd-spinner"></div></div>';

    try {
        const response = await adminFetch('/api/momentum/admin/submissions?status=PENDIENTE');
        if (!response.ok) throw new Error('Error');

        const submissions = await response.json();

        if (submissions.length === 0) {
            listEl.innerHTML = '<div class="mmd-empty">🎉 No hay entregas pendientes de verificación.</div>';
            return;
        }

        listEl.innerHTML = submissions.map(s => {
            const date = new Date(s.submitted_at).toLocaleDateString('es-ES');
            // Validar que la URL del comprobante comience obligatoriamente con http:// o https:// (protección anti-XSS via javascript:)
            const safeProofLink = (s.proof_link && (s.proof_link.startsWith('http://') || s.proof_link.startsWith('https://')))
                ? s.proof_link
                : '#';

            return `
                <div class="mma-verify-card" id="mma-verify-${s.id}">
                    <div class="mma-verify-card__header">
                        <div>
                            <div class="mma-verify-card__user">${escapeHtml(s.nickname)} (@${escapeHtml(s.username)})</div>
                            <div class="mma-verify-card__campaign">
                                🎯 ${escapeHtml(s.campaign_title)} · Tier: <strong>${escapeHtml(s.tier)}</strong> · Enviado: ${date}
                            </div>
                        </div>
                        <span class="mma-badge --pendiente">Pendiente</span>
                    </div>
                    <a href="${escapeAttr(safeProofLink)}" target="_blank" rel="noopener noreferrer" class="mma-verify-card__link">
                        📎 ${escapeHtml(s.proof_link)} ↗
                    </a>
                    <div class="mma-verify-card__actions">
                        <input type="number" step="0.01" min="0" placeholder="Bono extra (opcional)" 
                               class="mma-bonus-input" data-id="${s.id}">
                        <input type="text" placeholder="Nota (obligatoria para rechazar)" 
                               class="mma-note-input" data-id="${s.id}">
                        <button class="mma-btn mma-btn--gold mma-btn--small mma-approve-btn" data-id="${s.id}">
                            ✅ Aprobar
                        </button>
                        <button class="mma-btn mma-btn--ghost mma-btn--small mma-reject-btn" data-id="${s.id}" 
                                style="border-color: var(--mma-red); color: var(--mma-red);">
                            ❌ Rechazar
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Listeners: aprobar / rechazar
        listEl.querySelectorAll('.mma-approve-btn').forEach(btn => {
            btn.addEventListener('click', () => approveSubmission(btn.dataset.id));
        });
        listEl.querySelectorAll('.mma-reject-btn').forEach(btn => {
            btn.addEventListener('click', () => rejectSubmission(btn.dataset.id));
        });
    } catch (error) {
        console.error('[MOMENTUM ADMIN] Error cargando submissions:', error);
        listEl.innerHTML = '<div class="mmd-empty">Error al cargar entregas.</div>';
    }
}

/**
 * Aprueba una entrega. Calcula el pago base × multiplicador + bono extra.
 */
async function approveSubmission(submissionId) {
    const bonusInput = document.querySelector(`.mma-bonus-input[data-id="${submissionId}"]`);
    const noteInput = document.querySelector(`.mma-note-input[data-id="${submissionId}"]`);
    const bonus_extra = parseFloat(bonusInput?.value) || 0;
    const admin_note = noteInput?.value?.trim() || '';

    try {
        const response = await adminFetch(`/api/momentum/admin/submissions/${submissionId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bonus_extra, admin_note })
        });

        const result = await response.json();

        if (response.ok) {
            const paid = parseFloat(result.paid_amount).toLocaleString('es-ES', { maximumFractionDigits: 4 });
            showToast(`✅ Aprobada — ${paid} BLUE IOU acreditados.`, 'success');
            // Remover la tarjeta con animación
            const card = document.getElementById(`mma-verify-${submissionId}`);
            if (card) {
                card.style.opacity = '0';
                card.style.transform = 'translateX(100px)';
                card.style.transition = 'all 0.4s ease';
                setTimeout(() => card.remove(), 400);
            }
        } else {
            showToast(result.message || 'Error al aprobar.', 'error');
        }
    } catch (error) {
        showToast('Error de conexión.', 'error');
    }
}

/**
 * Rechaza una entrega. Requiere nota de administrador obligatoriamente.
 */
function rejectSubmission(submissionId) {
    const noteInput = document.querySelector(`.mma-note-input[data-id="${submissionId}"]`);
    const admin_note = noteInput?.value?.trim();

    if (!admin_note) {
        showToast('La nota es OBLIGATORIA para rechazar una entrega.', 'error');
        if (noteInput) {
            noteInput.style.borderColor = 'var(--mm-red)';
            noteInput.focus();
        }
        return;
    }

    showCustomConfirm(
        '¿Rechazar esta entrega? Esta acción es irreversible.',
        async () => {
            try {
                const response = await adminFetch(`/api/momentum/admin/submissions/${submissionId}/reject`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ admin_note })
                });

                const result = await response.json();

                if (response.ok) {
                    showToast('❌ Entrega rechazada.', 'info');
                    // Remover la tarjeta con animación
                    const card = document.getElementById(`mma-verify-${submissionId}`);
                    if (card) {
                        card.style.opacity = '0';
                        card.style.transform = 'translateX(-100px)';
                        card.style.transition = 'all 0.4s ease';
                        setTimeout(() => card.remove(), 400);
                    }
                } else {
                    showToast(result.message || 'Error al rechazar.', 'error');
                }
            } catch (error) {
                showToast('Error de conexión.', 'error');
            }
        }
    );
}

// ============================================================================
// EVENT LISTENERS GLOBALES
// ============================================================================

function setupGlobalListeners() {
    // Guardar configuración
    const saveConfigBtn = document.getElementById('mma-save-config');
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', saveConfig);
    }

    // Crear campaña
    const createCampaignBtn = document.getElementById('mma-create-campaign-btn');
    if (createCampaignBtn) {
        createCampaignBtn.addEventListener('click', createCampaign);
    }
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Fetch wrapper que envía las cookies de admin (credentials: 'include').
 * Todas las llamadas admin usan httpOnly cookies, no Bearer token.
 */
async function adminFetch(path, options = {}) {
    return fetch(`${API_URL}${path}`, {
        ...options,
        credentials: 'include'  // CRÍTICO: enviar cookies de sesión admin
    });
}

function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el && value !== null && value !== undefined) el.value = value;
}

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

/**
 * Lógica para Modal de Edición de Campañas
 */
function openEditCampaignModal(campaignId) {
    const campaign = allCampaignsCache.find(c => c.id == campaignId);
    if (!campaign) return;

    document.getElementById('edit-camp-id').value = campaign.id;
    document.getElementById('edit-camp-title').value = campaign.title || '';
    document.getElementById('edit-camp-desc').value = campaign.description || '';
    document.getElementById('edit-camp-visionario').value = parseFloat(campaign.base_pay_visionario || 0);
    document.getElementById('edit-camp-bronce').value = parseFloat(campaign.base_pay_bronce || 0);
    document.getElementById('edit-camp-plata').value = parseFloat(campaign.base_pay_plata || 0);
    document.getElementById('edit-camp-oro').value = parseFloat(campaign.base_pay_oro || 0);
    document.getElementById('edit-camp-platino').value = parseFloat(campaign.base_pay_platino || 0);
    if (document.getElementById('edit-camp-multiple')) {
        document.getElementById('edit-camp-multiple').checked = !!campaign.allow_multiple;
    }

    const modal = document.getElementById('mmaEditCampaignModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeEditCampaignModal() {
    const modal = document.getElementById('mmaEditCampaignModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function saveEditCampaign() {
    const id = document.getElementById('edit-camp-id').value;
    const title = document.getElementById('edit-camp-title').value.trim();
    const description = document.getElementById('edit-camp-desc').value.trim();
    const base_pay_visionario = parseFloat(document.getElementById('edit-camp-visionario').value) || 0;
    const base_pay_bronce = parseFloat(document.getElementById('edit-camp-bronce').value) || 0;
    const base_pay_plata = parseFloat(document.getElementById('edit-camp-plata').value) || 0;
    const base_pay_oro = parseFloat(document.getElementById('edit-camp-oro').value) || 0;
    const base_pay_platino = parseFloat(document.getElementById('edit-camp-platino').value) || 0;
    const allow_multiple = document.getElementById('edit-camp-multiple')?.checked || false;

    if (!title) {
        showToast('El título de la campaña es obligatorio.', 'error');
        return;
    }

    try {
        const response = await adminFetch(`/api/momentum/admin/campaigns/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title, description, 
                base_pay_visionario, base_pay_bronce, base_pay_plata, base_pay_oro, base_pay_platino, 
                allow_multiple 
            })
        });

        const result = await response.json();
        if (response.ok) {
            showToast('Campaña actualizada exitosamente.', 'success');
            closeEditCampaignModal();
            loadCampaigns();
        } else {
            showToast(result.message || 'Error al actualizar la campaña.', 'error');
        }
    } catch (error) {
        console.error('[MOMENTUM ADMIN] Error actualizando campaña:', error);
        showToast('Error de red o servidor.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Escuchar el botón de guardar en el modal
    const saveBtn = document.getElementById('btn-save-edit-campaign');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveEditCampaign);
    }

    // Escuchar el botón de cerrar en el modal
    const closeBtn = document.getElementById('closeEditCampaignModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeEditCampaignModal);
    }
});
