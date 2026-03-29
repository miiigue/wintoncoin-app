/**
 * Governance Panel — Frontend del Sistema Winton-Consensus
 *
 * Auth: JWT Bearer (guardian = usuario regular con rol de guardián)
 * API: /api/governance/*
 */

import { getApiUrl, showCustomAlert, showCustomConfirm, initializeAlertListeners } from '../modules/index.js';

window.getApiUrl = getApiUrl;
window.showCustomAlert = showCustomAlert;
window.showCustomConfirm = showCustomConfirm;

document.addEventListener('DOMContentLoaded', async () => {

    // Modales de confirmación (governance-panel.html)
    initializeAlertListeners();

    const API_URL = getApiUrl();
    const token = localStorage.getItem('token');

    // Enlace desde correo de votante: ?id=…&focus=vote — vista reducida (el proponente recibe ?id=… sin focus)
    const urlParams = new URLSearchParams(window.location.search);
    const voteFocusMode = urlParams.get('focus') === 'vote' && Boolean(urlParams.get('id'));

    function _redirectToLogin() {
        const currentPath = window.location.pathname.split('/').pop() + window.location.search;
        window.location.href = `login.html?returnTo=${encodeURIComponent(currentPath)}`;
    }

    if (!token) {
        _redirectToLogin();
        return;
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    async function govFetch(endpoint, options = {}) {
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...(options.headers || {}) };
        delete options.headers;

        const response = await fetch(`${API_URL}${endpoint}`, { headers, ...options });

        if (response.status === 401) {
            showCustomAlert('Sesión expirada. Inicia sesión nuevamente.');
            _redirectToLogin();
            throw new Error('Sesión expirada');
        }

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || data.message || `Error ${response.status}`);
        return data;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('es-ES', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });
    }

    function formatGovValue(raw, actionType) {
        if (!raw) return '—';
        try {
            const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (typeof obj !== 'object' || obj === null) return escapeHtml(String(raw));

            if (actionType === 'membership_change' && obj.action) {
                const ACTIONS = { add: 'Agregar', remove: 'Remover', update: 'Actualizar' };
                const ROLES = { supervisor: 'Supervisor', auxiliary: 'Auxiliar' };
                const actionLabel = ACTIONS[obj.action] || obj.action;
                const roleLabel = ROLES[obj.role] || '';
                const userRef = obj.userId ? `usuario #${obj.userId}` : '';
                if (obj.action === 'remove') return escapeHtml(`${actionLabel} ${userRef}`);
                return escapeHtml(`${actionLabel} ${userRef} como ${roleLabel}`).trim();
            }

            if (actionType === 'config_change') return escapeHtml(String(raw));

            return escapeHtml(JSON.stringify(obj));
        } catch {
            return escapeHtml(String(raw));
        }
    }

    const SETTINGS_DISPLAY_MAP = {
        'allow_new_registrations': 'Permitir Nuevos Registros',
        'allow_new_publications': 'Permitir Nuevas Publicaciones',
        'public_profiles_enabled': 'Perfiles Públicos',
        'debt_system_enabled': 'Sistema de Deuda (Tokens RED)',
        'debt_cycle_days': 'Ciclo de Deuda RED — Días',
        'debt_cycle_hours': 'Ciclo de Deuda RED — Horas',
        'debt_cycle_minutes': 'Ciclo de Deuda RED — Minutos',
        'blue_escrow_days': 'Depósito BLUE (Escrow) — Días',
        'blue_escrow_hours': 'Depósito BLUE (Escrow) — Horas',
        'blue_escrow_minutes': 'Depósito BLUE (Escrow) — Minutos',
        'platform_commission_percentage': 'Comisión de Plataforma (%)',
        'booster_system_enabled': 'Sistema de Impulsores',
        'referral_system_enabled': 'Sistema de Referidos',
        'referral_reward_amount': 'Recompensa por Referido (BLUE)',
        'referral_reward_after_expiry': 'Recompensa después de la Promo (BLUE)',
        'referral_codes_expiry_date': 'Vigencia de Códigos de Referido',
        'welcome_bonus_enabled': 'Bono de Bienvenida',
        'welcome_bonus_amount': 'Monto del Bono de Bienvenida (BLUE)',
        'pre_launch_mode_enabled': 'Modo Pre-Lanzamiento',
        'allow_request_publications': 'Permitir Publicaciones de "Solicitud"',
        'allow_sell_publications': 'Permitir Publicaciones de "Venta"',
        'allow_donation_publications': 'Permitir Publicaciones de "Donación"',
        'allow_quick_sale_publications': 'Permitir Publicaciones de "Venta Rápida"',
        'p2p_enabled': 'P2P — Habilitado',
        'p2p_price_min': 'P2P — Precio Mínimo (USD)',
        'p2p_price_max': 'P2P — Precio Máximo (USD)',
        'p2p_fee_percentage': 'P2P — Comisión (%)',
        'p2p_payment_window_minutes': 'P2P — Ventana de Pago (min)',
        'p2p_extension_minutes': 'P2P — Extensión (min)',
        'p2p_extension_limit': 'P2P — Límite de Extensiones',
        'p2p_cash_min_rating': 'P2P — Reputación Mínima para Efectivo',
    };
    function settingLabel(key) { return SETTINGS_DISPLAY_MAP[key] || key; }

    function statusLabel(status) {
        const map = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', executed: 'Ejecutada', expired: 'Expirada', cancelled: 'Cancelada' };
        return map[status] || status;
    }

    function actionLabel(type) {
        return type === 'config_change' ? 'Configuración' : type === 'membership_change' ? 'Membresía' : type;
    }

    // ═══════════════════════════════════════════════════════════════
    // NAVIGATION
    // ═══════════════════════════════════════════════════════════════

    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    const sections = document.querySelectorAll('.admin-section');

    /** Cierra el drawer lateral en móvil tras navegar o tocar fuera. */
    function closeMobileGovNav() {
        document.body.classList.remove('gov-mobile-nav-open');
        const btn = document.getElementById('govMobileMenuBtn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    function toggleMobileGovNav() {
        const open = document.body.classList.toggle('gov-mobile-nav-open');
        const btn = document.getElementById('govMobileMenuBtn');
        if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function showSection(sectionId) {
        sections.forEach(s => s.classList.remove('active-section'));
        navLinks.forEach(l => l.classList.remove('active'));

        const sectionEl = document.getElementById(`${sectionId}-section`);
        const navEl = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
        if (sectionEl) sectionEl.classList.add('active-section');
        if (navEl) navEl.classList.add('active');

        if (sectionId === 'status') loadGuardianStatus();
        else if (sectionId === 'requests') loadRequests();
        else if (sectionId === 'create') { /* form is static */ }
        else if (sectionId === 'break-glass') { /* form is static */ }

        closeMobileGovNav();
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const sectionId = link.getAttribute('data-section');
            if (sectionId) {
                e.preventDefault();
                if (voteFocusMode) {
                    closeMobileGovNav();
                    showCustomAlert('Estás en modo votación. Solo puedes ver y votar la solicitud asignada.');
                    return;
                }
                showSection(sectionId);
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════
    let guardianData = null;

    // ═══════════════════════════════════════════════════════════════
    // GATE: Verificar que el usuario sea guardián ANTES de mostrar UI
    // ═══════════════════════════════════════════════════════════════
    async function verifyGuardianAccess() {
        try {
            const data = await govFetch('/api/governance/me');
            if (!data.isGuardian) {
                document.querySelector('.admin-grid-container').innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; width: 100vw; background: var(--admin-bg);">
                        <div style="text-align: center; max-width: 400px; padding: 40px;">
                            <p style="font-size: 2rem; margin-bottom: 16px;">🚫</p>
                            <h2 style="color: var(--admin-text); margin-bottom: 12px;">Acceso Denegado</h2>
                            <p style="color: var(--admin-text-secondary); line-height: 1.6; margin-bottom: 24px;">
                                Tu cuenta no tiene permisos de guardián en el sistema Winton-Consensus.
                                Solo los guardianes activos pueden acceder a este panel.
                            </p>
                            <button onclick="history.back()" style="padding: 10px 24px; border-radius: 8px; background: var(--admin-primary); color: white; border: none; cursor: pointer; font-size: 0.95rem;">Volver</button>
                        </div>
                    </div>`;
                return false;
            }
            guardianData = data.guardian;
            return true;
        } catch (err) {
            document.querySelector('.admin-grid-container').innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100vh; width: 100vw; background: var(--admin-bg);">
                    <div style="text-align: center; max-width: 400px; padding: 40px;">
                        <p style="font-size: 2rem; margin-bottom: 16px;">⚠️</p>
                        <h2 style="color: var(--admin-text); margin-bottom: 12px;">Error de Acceso</h2>
                        <p style="color: #EF4444; margin-bottom: 24px;">${escapeHtml(err.message)}</p>
                        <button id="govErrorLoginBtn" style="padding: 10px 24px; border-radius: 8px; background: var(--admin-primary); color: white; border: none; cursor: pointer; font-size: 0.95rem;">Iniciar Sesión</button>
                    </div>
                </div>`;
            document.getElementById('govErrorLoginBtn')?.addEventListener('click', _redirectToLogin);
            return false;
        }
    }

    const hasAccess = await verifyGuardianAccess();
    if (!hasAccess) return;

    /**
     * Oculta "Nueva solicitud" y "Emergencia" cuando el usuario puede votar en el detalle actual
     * o cuando viene del correo con focus=vote.
     */
    function setRestrictedNavForVoting(active) {
        const grid = document.querySelector('.admin-grid-container');
        if (!grid) return;
        if (voteFocusMode) {
            grid.classList.add('gov-vote-focus');
            return;
        }
        grid.classList.toggle('gov-vote-focus', !!active);
    }

    // Modo enfoque: ocultar menú lateral extra y lista de solicitudes
    if (voteFocusMode) {
        document.querySelector('.admin-grid-container')?.classList.add('gov-vote-focus');
        const reqSection = document.getElementById('requests-section');
        const h1 = reqSection?.querySelector('h1');
        const sub = reqSection?.querySelector(':scope > p');
        if (h1 && !h1.dataset.defaultSaved) {
            h1.dataset.defaultSaved = '1';
            h1.dataset.defaultText = h1.textContent;
            h1.textContent = 'Tu voto es requerido';
        }
        if (sub && !sub.dataset.defaultSaved) {
            sub.dataset.defaultSaved = '1';
            sub.dataset.defaultText = sub.textContent;
            sub.textContent = 'Revisa los detalles de la solicitud y confirma tu decisión.';
        }
        document.querySelector('#requests-section .gov-tabs')?.style.setProperty('display', 'none');
        document.getElementById('requests-list-container')?.style.setProperty('display', 'none');
    }

    // Handle URL params (from email / push)
    const paramRequestId = urlParams.get('id');
    if (paramRequestId) {
        showSection('requests');
        setTimeout(() => loadRequestDetail(parseInt(paramRequestId, 10)), 400);
    } else {
        showSection('status');
    }

    document.getElementById('govLogoutBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileGovNav();
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    });

    // Menú hamburguesa (móvil)
    document.getElementById('govMobileMenuBtn')?.addEventListener('click', () => toggleMobileGovNav());
    document.getElementById('govMobileBackdrop')?.addEventListener('click', () => closeMobileGovNav());

    // ═══════════════════════════════════════════════════════════════
    // SECCIÓN: MI ESTADO
    // ═══════════════════════════════════════════════════════════════

    async function loadGuardianStatus() {
        const container = document.getElementById('guardian-status-container');
        container.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const data = await govFetch('/api/governance/me');

            if (!data.isGuardian) {
                container.innerHTML = `
                    <div class="gov-empty-state">
                        <p style="font-size: 1.5rem;">🚫</p>
                        <p><strong>No eres guardián</strong></p>
                        <p>Tu cuenta no tiene rol de guardián en el sistema Winton-Consensus.</p>
                    </div>`;
                return;
            }

            guardianData = data.guardian;

            container.innerHTML = `
                <div class="gov-card">
                    <h3>Información del Guardián</h3>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Usuario</span>
                        <span class="gov-info-value">${escapeHtml(guardianData.username)}</span>
                    </div>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Rol</span>
                        <span class="gov-info-value" style="text-transform: capitalize;">${escapeHtml(guardianData.role)}</span>
                    </div>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Estado</span>
                        <span class="gov-status-badge ${guardianData.status}">${statusLabel(guardianData.status)}</span>
                    </div>
                </div>

                <div class="gov-card">
                    <h3>Seguridad</h3>
                    <div class="gov-webauthn-status registered">
                        <span style="font-size: 1.5rem;">🔒</span>
                        <div>
                            <strong>Votación protegida por JWT</strong>
                            <p style="margin: 4px 0 0; font-size: 0.85rem; color: #9CA3AF;">
                                Tus votos se validan con tu sesión autenticada. La verificación biométrica estará disponible próximamente.
                            </p>
                        </div>
                    </div>
                </div>`;


        } catch (err) {
            container.innerHTML = `<div class="gov-empty-state"><p style="color: #EF4444;">Error: ${escapeHtml(err.message)}</p></div>`;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SECCIÓN: SOLICITUDES
    // ═══════════════════════════════════════════════════════════════

    let currentFilter = 'pending';

    document.querySelectorAll('.gov-tab[data-filter]').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.gov-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.getAttribute('data-filter');
            document.getElementById('request-detail-container').style.display = 'none';
            loadRequests();
        });
    });

    async function loadRequests() {
        const container = document.getElementById('requests-list-container');
        container.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const params = currentFilter !== 'all' ? `?status=${currentFilter}` : '?limit=50';
            const data = await govFetch(`/api/governance/requests${params}`);

            if (!data.requests || data.requests.length === 0) {
                container.innerHTML = `<div class="gov-empty-state"><p>No hay solicitudes ${currentFilter !== 'all' ? statusLabel(currentFilter).toLowerCase() + 's' : ''}.</p></div>`;
                return;
            }

            container.innerHTML = data.requests.map(r => `
                <div class="gov-request-card" data-request-id="${r.id}">
                    <div class="gov-request-header">
                        <span class="gov-request-id">#${r.id}</span>
                        <span class="gov-status-badge ${r.status}">${statusLabel(r.status)}</span>
                    </div>
                    <div class="gov-request-desc">${escapeHtml(r.description)}</div>
                    <div class="gov-request-meta">
                        <span>${actionLabel(r.action_type)}</span>
                        <span>Por: ${escapeHtml(r.requester_username || '?')}</span>
                        <span>Expira: ${formatDate(r.expires_at)}</span>
                        ${r.approve_count !== undefined ? `<span>✅ ${r.approve_count} | ❌ ${r.reject_count}</span>` : ''}
                    </div>
                </div>
            `).join('');

            container.querySelectorAll('.gov-request-card').forEach(card => {
                card.addEventListener('click', () => {
                    loadRequestDetail(parseInt(card.getAttribute('data-request-id'), 10));
                });
            });

            // Update badge
            const pendingCount = data.requests.filter(r => r.status === 'pending').length;
            const badge = document.getElementById('pendingRequestsBadge');
            if (badge) badge.textContent = pendingCount > 0 ? pendingCount : '';

        } catch (err) {
            container.innerHTML = `<div class="gov-empty-state"><p style="color: #EF4444;">Error: ${escapeHtml(err.message)}</p></div>`;
        }
    }

    async function loadRequestDetail(requestId) {
        const container = document.getElementById('request-detail-container');
        container.style.display = 'block';
        container.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const data = await govFetch(`/api/governance/requests/${requestId}`);
            const r = data.request;
            const q = r.quorum || {};

            const isRequester = guardianData && r.requester_id === guardianData.userId;
            const myUserId = guardianData?.userId;
            const alreadyVoted = (r.votes || []).some((v) => Number(v.guardian_user_id) === Number(myUserId));
            const canVote = r.status === 'pending' && guardianData && guardianData.status === 'active' && !isRequester && !alreadyVoted;
            const canWithdraw = r.status === 'pending' && isRequester;
            const canTimeLockCancel = r.status === 'approved' && guardianData && guardianData.status === 'active';
            const canCancel = canWithdraw || canTimeLockCancel;

            const votesHtml = (r.votes || []).map(v => `
                <li>
                    <span>${escapeHtml(v.guardian_username)} <span style="color:#6B7280;">(${v.guardian_role})</span></span>
                    <span class="gov-status-badge ${v.vote === 'approve' ? 'active' : 'rejected'}">${v.vote === 'approve' ? 'Aprobó' : 'Rechazó'}</span>
                </li>
            `).join('') || '<li style="color:#6B7280;">Aún no hay votos.</li>';

            const supApproved = q.approved?.supervisor || 0;
            const supTotal = q.totals?.supervisor || 1;
            const supPct = Math.round((supApproved / supTotal) * 100);

            container.innerHTML = `
                <div class="gov-card" style="border-color: var(--admin-primary);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h3 style="margin: 0;">Solicitud #${r.id}</h3>
                        <span class="gov-status-badge ${r.status}">${statusLabel(r.status)}</span>
                    </div>

                    <div class="gov-info-row">
                        <span class="gov-info-label">Tipo</span>
                        <span class="gov-info-value">${actionLabel(r.action_type)}</span>
                    </div>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Proponente</span>
                        <span class="gov-info-value">${escapeHtml(r.requester_username)}</span>
                    </div>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Descripción</span>
                        <span class="gov-info-value">${escapeHtml(r.description)}</span>
                    </div>
                    ${r.target_key ? `
                    <div class="gov-info-row">
                        <span class="gov-info-label">Configuración</span>
                        <span class="gov-info-value">${escapeHtml(settingLabel(r.target_key))}</span>
                    </div>` : ''}
                    ${r.old_value ? `
                    <div class="gov-info-row">
                        <span class="gov-info-label">Valor Anterior</span>
                        <span class="gov-info-value">${formatGovValue(r.old_value, r.action_type)}</span>
                    </div>` : ''}
                    ${r.new_value ? `
                    <div class="gov-info-row">
                        <span class="gov-info-label">Valor Propuesto</span>
                        <span class="gov-info-value">${formatGovValue(r.new_value, r.action_type)}</span>
                    </div>` : ''}
                    <div class="gov-info-row">
                        <span class="gov-info-label">Creada</span>
                        <span class="gov-info-value">${formatDate(r.created_at)}</span>
                    </div>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Expira</span>
                        <span class="gov-info-value">${formatDate(r.expires_at)}</span>
                    </div>
                    ${r.execution_time ? `
                    <div class="gov-info-row">
                        <span class="gov-info-label">Ejecución Programada</span>
                        <span class="gov-info-value">${formatDate(r.execution_time)}</span>
                    </div>` : ''}

                    <div class="gov-detail-section">
                        <h4>Quórum de Supervisores</h4>
                        <div class="gov-quorum-bar">
                            <div class="gov-quorum-fill" style="width: ${supPct}%; background: ${supPct >= 67 ? '#059669' : '#3B82F6'};"></div>
                        </div>
                        <p style="font-size: 0.8rem; color: #9CA3AF;">
                            ${supApproved} de ${supTotal} supervisores aprobaron (umbral: ${q.thresholds?.supervisor || q.supThreshold || '?'})
                        </p>
                    </div>

                    <div class="gov-detail-section">
                        <h4>Votos Registrados</h4>
                        <ul class="gov-vote-list">${votesHtml}</ul>
                    </div>

                    ${alreadyVoted && r.status === 'pending' && !isRequester ? `
                    <div class="gov-vote-done-notice">
                        <strong>Ya emitiste tu voto</strong> en esta solicitud. No puedes cambiarlo ni votar de nuevo (así evitamos dobles firmas y confusiones).
                    </div>` : ''}

                    ${canVote ? `
                    <div class="gov-vote-buttons">
                        <button type="button" class="gov-btn-approve" id="voteApproveBtn">✅ Aprobar</button>
                        <button type="button" class="gov-btn-reject" id="voteRejectBtn">❌ Rechazar</button>
                    </div>` : ''}

                    <div style="display: flex; gap: 12px; margin-top: 20px;">
                        ${!voteFocusMode ? '<button type="button" id="backToListBtn" style="flex: 1; padding: 10px; border-radius: 8px; background: transparent; border: 1px solid var(--admin-border); color: var(--admin-text-secondary); cursor: pointer; font-family: inherit; font-size: 0.9rem;">← Volver a la Lista</button>' : ''}
                        ${canWithdraw ? `<button id="cancelRequestBtn" data-reason="withdraw" style="flex: 1; padding: 10px; border-radius: 8px; background: #D97706; border: none; color: white; cursor: pointer; font-family: inherit; font-size: 0.9rem; font-weight: 600;">Retirar mi Solicitud</button>` : ''}
                        ${canTimeLockCancel ? `<button id="cancelRequestBtn" data-reason="timelock" style="flex: 1; padding: 10px; border-radius: 8px; background: #6B7280; border: none; color: white; cursor: pointer; font-family: inherit; font-size: 0.9rem; font-weight: 600;">Cancelar (Time-Lock)</button>` : ''}
                    </div>
                </div>`;

            document.getElementById('backToListBtn')?.addEventListener('click', () => {
                setRestrictedNavForVoting(false);
                container.style.display = 'none';
            });

            document.getElementById('voteApproveBtn')?.addEventListener('click', () => submitVote(r.id, 'approve'));
            document.getElementById('voteRejectBtn')?.addEventListener('click', () => submitVote(r.id, 'reject'));
            document.getElementById('cancelRequestBtn')?.addEventListener('click', (e) => {
                const reason = e.currentTarget.getAttribute('data-reason');
                cancelRequest(r.id, reason);
            });

            setRestrictedNavForVoting(canVote);
        } catch (err) {
            setRestrictedNavForVoting(false);
            container.innerHTML = `<div class="gov-empty-state"><p style="color: #EF4444;">Error: ${escapeHtml(err.message)}</p></div>`;
        }
    }

    async function submitVote(requestId, vote) {
        const verb = vote === 'approve' ? 'APROBAR' : 'RECHAZAR';
        const confirmMsg =
            `Usted está votando para ${verb} la solicitud #${requestId}.\n\n` +
            'Esta acción no se puede deshacer. Una vez confirmada, no podrá cambiar su voto.\n\n' +
            '¿Está de acuerdo?';

        showCustomConfirm(confirmMsg, async () => {
            const approveBtn = document.getElementById('voteApproveBtn');
            const rejectBtn = document.getElementById('voteRejectBtn');

            const setVotingBusy = (busy) => {
                [approveBtn, rejectBtn].forEach((btn) => {
                    if (!btn) return;
                    btn.disabled = busy;
                    btn.style.opacity = busy ? '0.5' : '1';
                });
            };

            setVotingBusy(true);

            try {
                const result = await govFetch(`/api/governance/requests/${requestId}/vote`, {
                    method: 'POST',
                    body: JSON.stringify({ vote }),
                });

                showCustomAlert(result.message || 'Voto registrado exitosamente.');
                await loadRequestDetail(requestId);
                if (!voteFocusMode) loadRequests();
            } catch (err) {
                setVotingBusy(false);
                showCustomAlert(`Error al votar: ${err.message}`);
            }
        });
    }

    async function cancelRequest(requestId, reason) {
        const msg = reason === 'withdraw'
            ? `¿Confirmas que deseas RETIRAR tu solicitud #${requestId}? Podrás crear una nueva con los datos correctos.`
            : `¿Confirmas la CANCELACIÓN de la solicitud #${requestId} durante la ventana de Time-Lock? Esta acción no se puede deshacer.`;
        showCustomConfirm(msg, async () => {
            try {
                const result = await govFetch(`/api/governance/requests/${requestId}/cancel`, { method: 'POST' });
                showCustomAlert(result.message || 'Solicitud cancelada.');
                loadRequestDetail(requestId);
                loadRequests();
            } catch (err) {
                showCustomAlert(`Error: ${err.message}`);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // SECCIÓN: CREAR SOLICITUD
    // ═══════════════════════════════════════════════════════════════

    const actionTypeSelect = document.getElementById('govActionType');
    const configFields = document.getElementById('configFields');
    const membershipFields = document.getElementById('membershipFields');
    const memberActionSelect = document.getElementById('govMemberAction');
    const memberRoleGroup = document.getElementById('govMemberRoleGroup');

    let settingsCatalog = [];
    let catalogLoaded = false;
    let highlightedIndex = -1;

    async function loadSettingsCatalog() {
        if (catalogLoaded) return;
        try {
            const data = await govFetch('/api/governance/settings-catalog');
            settingsCatalog = data.settings || [];
            catalogLoaded = true;
        } catch (err) {
            console.error('Error loading settings catalog:', err);
        }
    }

    const searchInput = document.getElementById('govSettingSearch');
    const hiddenKeyInput = document.getElementById('govTargetKey');
    const oldValueInput = document.getElementById('govOldValue');
    const dropdown = document.getElementById('govSettingDropdown');

    function renderDropdownItems(items) {
        if (items.length === 0) {
            dropdown.innerHTML = '<div class="gov-autocomplete-item" style="color: #6B7280; cursor: default;">No se encontraron configuraciones.</div>';
            dropdown.classList.add('visible');
            return;
        }

        highlightedIndex = -1;
        dropdown.innerHTML = items.map((item, idx) => `
            <div class="gov-autocomplete-item" data-index="${idx}" data-key="${escapeHtml(item.key)}" data-value="${escapeHtml(item.currentValue)}" data-label="${escapeHtml(item.label)}">
                <span class="item-label">${escapeHtml(item.label)}</span>
                <span class="item-key">(${escapeHtml(item.key)})</span>
                <span class="item-value">Actual: ${escapeHtml(item.currentValue)}</span>
            </div>
        `).join('');
        dropdown.classList.add('visible');

        dropdown.querySelectorAll('.gov-autocomplete-item[data-key]').forEach(el => {
            el.addEventListener('click', () => selectSetting(el));
        });
    }

    function selectSetting(el) {
        const key = el.getAttribute('data-key');
        const value = el.getAttribute('data-value');
        const label = el.getAttribute('data-label');

        hiddenKeyInput.value = key;
        searchInput.value = `${label} (${key})`;
        oldValueInput.value = value;
        dropdown.classList.remove('visible');
        document.getElementById('govNewValue').focus();
    }

    searchInput?.addEventListener('focus', async () => {
        await loadSettingsCatalog();
        renderDropdownItems(settingsCatalog);
    });

    searchInput?.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        hiddenKeyInput.value = '';
        oldValueInput.value = '';

        if (!query) {
            renderDropdownItems(settingsCatalog);
            return;
        }

        const filtered = settingsCatalog.filter(s =>
            s.label.toLowerCase().includes(query) ||
            s.key.toLowerCase().includes(query)
        );
        renderDropdownItems(filtered);
    });

    searchInput?.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.gov-autocomplete-item[data-key]');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
            items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightedIndex));
            items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightedIndex = Math.max(highlightedIndex - 1, 0);
            items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightedIndex));
            items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
            e.preventDefault();
            selectSetting(items[highlightedIndex]);
        } else if (e.key === 'Escape') {
            dropdown.classList.remove('visible');
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#govSettingSearch') && !e.target.closest('#govSettingDropdown')) {
            dropdown?.classList.remove('visible');
        }
    });

    actionTypeSelect?.addEventListener('change', async () => {
        const val = actionTypeSelect.value;
        configFields.style.display = val === 'config_change' ? 'block' : 'none';
        membershipFields.style.display = val === 'membership_change' ? 'block' : 'none';
        if (val === 'config_change') await loadSettingsCatalog();
    });

    memberActionSelect?.addEventListener('change', () => {
        memberRoleGroup.style.display = memberActionSelect.value === 'remove' ? 'none' : 'block';
    });

    document.getElementById('createRequestForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const actionType = actionTypeSelect.value;
        const description = document.getElementById('govDescription').value.trim();

        if (!actionType || !description) {
            showCustomAlert('Completa todos los campos obligatorios.');
            return;
        }

        let targetKey = null, oldValue = null, newValue = null;

        if (actionType === 'config_change') {
            targetKey = hiddenKeyInput.value.trim();
            oldValue = oldValueInput.value.trim();
            newValue = document.getElementById('govNewValue').value.trim();
            if (!targetKey) {
                showCustomAlert('Selecciona una configuración de la lista.');
                return;
            }
            if (!newValue) {
                showCustomAlert('Ingresa el nuevo valor propuesto.');
                return;
            }
        } else if (actionType === 'membership_change') {
            const action = memberActionSelect.value;
            const userId = parseInt(document.getElementById('govMemberUserId').value, 10);
            const role = document.getElementById('govMemberRole').value;
            if (!userId) {
                showCustomAlert('Especifica el ID del usuario.');
                return;
            }
            targetKey = `guardian:${userId}`;
            newValue = { action, userId, role: action !== 'remove' ? role : undefined };
        }

        try {
            const result = await govFetch('/api/governance/requests', {
                method: 'POST',
                body: JSON.stringify({ actionType, targetKey, oldValue, newValue, description }),
            });

            showCustomAlert(result.message || 'Solicitud creada exitosamente.');
            document.getElementById('createRequestForm').reset();
            searchInput.value = '';
            hiddenKeyInput.value = '';
            oldValueInput.value = '';
            configFields.style.display = 'none';
            membershipFields.style.display = 'none';
            catalogLoaded = false;
            showSection('requests');

        } catch (err) {
            showCustomAlert(`Error: ${err.message}`);
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // SECCIÓN: BREAK GLASS
    // ═══════════════════════════════════════════════════════════════

    const bgActionSelect = document.getElementById('bgAction');
    const bgGuardiansCard = document.getElementById('bgGuardiansCard');
    const bgGuardiansList = document.getElementById('bgGuardiansList');
    let bgGuardianCount = 0;

    function addGuardianRow() {
        bgGuardianCount++;
        const idx = bgGuardianCount;
        const row = document.createElement('div');
        row.className = 'bg-guardian-row';
        row.setAttribute('data-row-idx', idx);
        row.style.cssText = 'display: flex; gap: 10px; align-items: flex-end; margin-bottom: 10px; flex-wrap: wrap;';
        row.innerHTML = `
            <div style="flex: 1; min-width: 120px;">
                <label style="display: block; margin-bottom: 4px; font-size: 0.8rem; color: #9CA3AF;">ID del Usuario</label>
                <input type="number" class="bg-guardian-userId" placeholder="Ej: 5" min="1" required
                       style="width: 100%; padding: 10px; background: var(--admin-bg); border: 1px solid var(--admin-border); border-radius: 8px; color: var(--admin-text); font-size: 0.9rem; box-sizing: border-box;">
            </div>
            <div style="flex: 1; min-width: 160px;">
                <label style="display: block; margin-bottom: 4px; font-size: 0.8rem; color: #9CA3AF;">Rol</label>
                <select class="bg-guardian-role" required
                        style="width: 100%; padding: 10px; background: var(--admin-bg); border: 1px solid var(--admin-border); border-radius: 8px; color: var(--admin-text); font-size: 0.9rem; box-sizing: border-box;">
                    <option value="supervisor">Supervisor</option>
                    <option value="auxiliary">Auxiliar</option>
                </select>
            </div>
            <div style="flex: 0 0 auto;">
                <button type="button" class="bg-remove-guardian" title="Eliminar guardián" style="padding: 10px 14px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; color: #EF4444; cursor: pointer; font-size: 0.9rem;">&times;</button>
            </div>`;

        bgGuardiansList.appendChild(row);

        row.querySelector('.bg-remove-guardian').addEventListener('click', () => {
            row.remove();
            updateGuardianLabels();
        });
    }

    function updateGuardianLabels() {
        const rows = bgGuardiansList.querySelectorAll('.bg-guardian-row');
        rows.forEach((row, i) => {
            const label = row.querySelector('label');
            if (label) label.textContent = `ID del Usuario`;
        });
    }

    function getGuardiansFromForm() {
        const rows = bgGuardiansList.querySelectorAll('.bg-guardian-row');
        const guardians = [];
        for (const row of rows) {
            const userIdInput = row.querySelector('.bg-guardian-userId');
            const roleSelect = row.querySelector('.bg-guardian-role');
            const userId = parseInt(userIdInput.value, 10);
            const role = roleSelect.value;

            if (!userId || userId <= 0) return { error: 'Todos los campos de ID de usuario deben contener un número válido mayor a 0.' };
            if (!['supervisor', 'auxiliary'].includes(role)) return { error: 'El rol debe ser "supervisor" o "auxiliary".' };

            if (guardians.some(g => g.userId === userId)) {
                return { error: `El usuario con ID ${userId} está duplicado. Cada guardián debe ser único.` };
            }

            guardians.push({ userId, role });
        }
        return { guardians };
    }

    bgActionSelect?.addEventListener('change', () => {
        bgGuardiansCard.style.display = bgActionSelect.value === 'reset_guardians' ? 'block' : 'none';
        if (bgActionSelect.value === 'reset_guardians' && bgGuardiansList.children.length === 0) {
            addGuardianRow();
            addGuardianRow();
        }
    });

    document.getElementById('bgAddGuardianBtn')?.addEventListener('click', addGuardianRow);

    document.querySelectorAll('.bg-toggle-visibility').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.getAttribute('data-target'));
            if (!input) return;
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            btn.textContent = isPassword ? '🙈' : '👁️';
            btn.title = isPassword ? 'Ocultar código' : 'Mostrar código';
        });
    });

    document.getElementById('breakGlassForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const codes = [
            document.getElementById('bgCode1').value.trim(),
            document.getElementById('bgCode2').value.trim(),
            document.getElementById('bgCode3').value.trim(),
        ].filter(Boolean);

        const actionValue = bgActionSelect.value;
        const reason = document.getElementById('bgReason').value.trim();

        if (codes.length < 3) {
            showCustomAlert('Se requieren al menos 3 códigos de recuperación válidos (esquema 3 de 5).');
            return;
        }

        if (!actionValue) {
            showCustomAlert('Selecciona una acción de emergencia.');
            return;
        }

        if (reason.length < 10) {
            showCustomAlert('La razón de emergencia debe tener al menos 10 caracteres.');
            return;
        }

        let actionPayload = { action: actionValue, reason };

        if (actionValue === 'reset_guardians') {
            const { guardians, error } = getGuardiansFromForm();
            if (error) {
                showCustomAlert(error);
                return;
            }
            if (guardians.length < 2) {
                showCustomAlert('Debes definir al menos 2 nuevos guardianes.');
                return;
            }
            const supervisors = guardians.filter(g => g.role === 'supervisor');
            if (supervisors.length < 2) {
                showCustomAlert('Se requieren al menos 2 supervisores entre los nuevos guardianes.');
                return;
            }
            actionPayload.guardians = guardians;
        }

        showCustomConfirm(
            'PROTOCOLO BREAK GLASS: Esta acción desactivará TODOS los guardianes actuales, invalidará los códigos de recuperación existentes y asignará nuevos guardianes. Se generarán nuevos códigos que deberás guardar de forma segura. Esta operación es IRREVERSIBLE. ¿Confirmas la ejecución?',
            async () => {
                const submitBtn = document.getElementById('bgSubmitBtn');
                const originalText = submitBtn.textContent;
                submitBtn.disabled = true;
                submitBtn.textContent = 'Ejecutando...';

                try {
                    const result = await govFetch('/api/governance/break-glass', {
                        method: 'POST',
                        body: JSON.stringify({ codes, action: actionPayload }),
                    });

                    document.getElementById('breakGlassForm').style.display = 'none';

                    if (result.newRecoveryCodes) {
                        const AUTO_CLEAR_MS = 5 * 60 * 1000;
                        let codesCleared = false;
                        let plainCodesRef = result.newRecoveryCodes.join('\n');

                        const codesHtml = result.newRecoveryCodes.map((c, i) =>
                            `<div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(0,0,0,0.3); border-radius: 8px; margin-bottom: 6px; font-family: monospace; font-size: 0.95rem; color: var(--admin-text);">
                                <span style="color: #6B7280; min-width: 24px;">${i + 1}.</span>
                                <span class="bg-code-text" style="flex: 1; word-break: break-all;">${escapeHtml(c)}</span>
                            </div>`
                        ).join('');

                        const resultContainer = document.getElementById('bgRecoveryCodesResult');
                        resultContainer.style.display = 'block';
                        resultContainer.innerHTML = `
                            <div class="gov-card" style="border-color: #F59E0B; background: rgba(245, 158, 11, 0.05);">
                                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                                    <span style="font-size: 1.5rem;">🔑</span>
                                    <div>
                                        <h3 style="color: #F59E0B; margin: 0;">Nuevos Códigos de Recuperación</h3>
                                        <p style="color: #EF4444; font-weight: 700; font-size: 0.85rem; margin: 4px 0 0;">GUARDA ESTOS CÓDIGOS EN UN LUGAR SEGURO. NO SE MOSTRARÁN DE NUEVO.</p>
                                    </div>
                                </div>
                                <div id="bgCodesDisplay" style="margin-bottom: 16px;">${codesHtml}</div>
                                <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                                    <button type="button" id="bgCopyCodesBtn" class="action-button" style="flex: 1; background: #D97706;">Copiar Códigos al Portapapeles</button>
                                    <button type="button" id="bgDownloadCodesBtn" class="action-button" style="flex: 1; background: #059669;">Descargar como Archivo</button>
                                </div>
                                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 14px; margin-bottom: 12px;">
                                    <p style="color: #F59E0B; font-size: 0.85rem; margin: 0 0 8px 0; font-weight: 600;">
                                        Los códigos se borrarán automáticamente en <span id="bgCountdown">5:00</span> minutos por seguridad.
                                    </p>
                                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.85rem; color: var(--admin-text);">
                                        <input type="checkbox" id="bgConfirmSaved" style="width: 18px; height: 18px; accent-color: #059669; cursor: pointer;">
                                        Confirmo que he guardado los códigos de forma segura
                                    </label>
                                </div>
                                <button type="button" id="bgClearCodesBtn" class="action-button" disabled style="width: 100%; background: #374151; opacity: 0.5; cursor: not-allowed;">
                                    Borrar códigos de pantalla y continuar
                                </button>
                                <p style="color: #9CA3AF; font-size: 0.75rem; margin-top: 10px; text-align: center;">
                                    Los guardianes han sido restablecidos. Si copiaste al portapapeles, recuerda limpiar el clipboard después.
                                </p>
                            </div>`;

                        function clearCodesFromScreen() {
                            if (codesCleared) return;
                            codesCleared = true;
                            plainCodesRef = '';
                            const display = document.getElementById('bgCodesDisplay');
                            if (display) {
                                display.innerHTML = '<p style="color: #6B7280; text-align: center; padding: 20px;">Los códigos han sido eliminados de la pantalla por seguridad.</p>';
                            }
                            const copyBtn = document.getElementById('bgCopyCodesBtn');
                            const dlBtn = document.getElementById('bgDownloadCodesBtn');
                            const clearBtn = document.getElementById('bgClearCodesBtn');
                            if (copyBtn) { copyBtn.disabled = true; copyBtn.style.opacity = '0.3'; }
                            if (dlBtn) { dlBtn.disabled = true; dlBtn.style.opacity = '0.3'; }
                            if (clearBtn) { clearBtn.textContent = 'Códigos eliminados'; clearBtn.disabled = true; }
                            const countdown = document.getElementById('bgCountdown');
                            if (countdown) countdown.textContent = '0:00';
                        }

                        const autoTimer = setTimeout(clearCodesFromScreen, AUTO_CLEAR_MS);

                        let remaining = AUTO_CLEAR_MS / 1000;
                        const countdownInterval = setInterval(() => {
                            remaining--;
                            if (remaining <= 0) { clearInterval(countdownInterval); return; }
                            const mins = Math.floor(remaining / 60);
                            const secs = remaining % 60;
                            const el = document.getElementById('bgCountdown');
                            if (el) el.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
                        }, 1000);

                        function handleVisibilityChange() {
                            if (document.hidden && !codesCleared) {
                                document.querySelectorAll('.bg-code-text').forEach(el => {
                                    el.style.filter = 'blur(8px)';
                                });
                            } else if (!codesCleared) {
                                document.querySelectorAll('.bg-code-text').forEach(el => {
                                    el.style.filter = 'none';
                                });
                            }
                        }
                        document.addEventListener('visibilitychange', handleVisibilityChange);

                        document.getElementById('bgConfirmSaved')?.addEventListener('change', (e) => {
                            const btn = document.getElementById('bgClearCodesBtn');
                            if (btn) {
                                btn.disabled = !e.target.checked;
                                btn.style.opacity = e.target.checked ? '1' : '0.5';
                                btn.style.cursor = e.target.checked ? 'pointer' : 'not-allowed';
                                if (e.target.checked) btn.style.background = '#DC2626';
                            }
                        });

                        document.getElementById('bgClearCodesBtn')?.addEventListener('click', () => {
                            clearTimeout(autoTimer);
                            clearInterval(countdownInterval);
                            clearCodesFromScreen();
                            document.removeEventListener('visibilitychange', handleVisibilityChange);
                        });

                        document.getElementById('bgCopyCodesBtn')?.addEventListener('click', () => {
                            if (codesCleared) return;
                            navigator.clipboard.writeText(plainCodesRef)
                                .then(() => showCustomAlert('Códigos copiados al portapapeles. Recuerda limpiar el clipboard después de guardarlos.'))
                                .catch(() => showCustomAlert('No se pudieron copiar automáticamente. Cópialos manualmente.'));
                        });

                        document.getElementById('bgDownloadCodesBtn')?.addEventListener('click', () => {
                            if (codesCleared) return;
                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                            const content = `WINTON-CONSENSUS — CÓDIGOS DE RECUPERACIÓN BREAK GLASS\nGenerados: ${new Date().toLocaleString('es-ES')}\n${'═'.repeat(60)}\n\n${result.newRecoveryCodes.map((c, i) => `Código ${i + 1}: ${c}`).join('\n')}\n\n${'═'.repeat(60)}\nADVERTENCIA: Guarda este archivo en un lugar seguro y offline.\nEstos códigos NO se pueden recuperar si se pierden.\n`;
                            const blob = new Blob([content], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `winton-recovery-codes-${timestamp}.txt`;
                            a.click();
                            URL.revokeObjectURL(url);
                        });
                    }

                    showCustomAlert(result.message || 'Break Glass ejecutado exitosamente.');

                } catch (err) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                    showCustomAlert(`Error en Break Glass: ${err.message}`);
                }
            }
        );
    });

});
