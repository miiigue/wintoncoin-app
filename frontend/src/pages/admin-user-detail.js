/**
 * Módulo Frontend: Ficha de Auditoría y Control de Usuario 360° (User 360° Audit Dossier)
 * ════════════════════════════════════════════════════════════════════════════════════════
 * Provee la lógica para visualizar e interactuar con el expediente integral del usuario
 * en el Panel de Administración de WintonCoin.
 *
 * Estándares de Ciberseguridad & FinTech:
 *   - Zero Hardcoded Secrets & Zero-Trust
 *   - Sanitización contra XSS en todos los campos dinámicos
 *   - Trazabilidad y "Auditar al Auditor" (SOC 2 Type II)
 *   - Manejo de credenciales mediante cookies seguras HttpOnly
 * ════════════════════════════════════════════════════════════════════════════════════════
 */

import {
    getApiUrl,
    showCustomAlert,
    showCustomConfirm,
    escapeHtml,
    formatBalance,
    copyTextToClipboard
} from '../modules/index.js';

document.addEventListener('DOMContentLoaded', async () => {
    const API_URL = getApiUrl();

    // 1. Obtener identificador del usuario desde la URL (?id=... o ?user=...)
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id') || urlParams.get('user');

    if (!userId) {
        showCustomAlert("No se especificó ningún ID de usuario para inspeccionar.", () => {
            window.location.href = 'admin-panel.html#users';
        });
        return;
    }

    // 2. Elementos del DOM
    const elements = {
        loadingSpinner: document.getElementById('dossierLoadingSpinner'),
        dossierContent: document.getElementById('dossierContent'),
        userAvatar: document.getElementById('userAvatar'),
        userTitleUsername: document.getElementById('userTitleUsername'),
        userTitleId: document.getElementById('userTitleId'),
        badgeAccountStatus: document.getElementById('badgeAccountStatus'),
        
        // Info Tarjeta 1
        infoUsername: document.getElementById('infoUsername'),
        infoEmail: document.getElementById('infoEmail'),
        infoPhone: document.getElementById('infoPhone'),
        infoWallet: document.getElementById('infoWallet'),
        infoKyc: document.getElementById('infoKyc'),
        infoDossiers: document.getElementById('infoDossiers'),
        infoSponsor: document.getElementById('infoSponsor'),
        infoMinor: document.getElementById('infoMinor'),

        // Info Tarjeta 2
        infoBlueLiquid: document.getElementById('infoBlueLiquid'),
        infoBlueEscrow: document.getElementById('infoBlueEscrow'),
        infoBlueIou: document.getElementById('infoBlueIou'),
        infoRedBalance: document.getElementById('infoRedBalance'),
        infoCreatedAt: document.getElementById('infoCreatedAt'),
        infoUpdatedAt: document.getElementById('infoUpdatedAt'),

        // Info Tarjeta 3
        badgeTrustLevel: document.getElementById('badgeTrustLevel'),
        infoTrustScore: document.getElementById('infoTrustScore'),
        infoCommunityRating: document.getElementById('infoCommunityRating'),
        infoRatingsCount: document.getElementById('infoRatingsCount'),
        infoDebtsCount: document.getElementById('infoDebtsCount'),
        infoReferralCode: document.getElementById('infoReferralCode'),

        // Badges Contadores de Pestañas
        countWeb3Tx: document.getElementById('countWeb3Tx'),
        countBoosterTx: document.getElementById('countBoosterTx'),
        countPubsCreated: document.getElementById('countPubsCreated'),
        countTasksWorked: document.getElementById('countTasksWorked'),
        countReferrals: document.getElementById('countReferrals'),
        countSolidario: document.getElementById('countSolidario'),
        countAudit: document.getElementById('countAudit'),

        // Tablas y Contenedores
        tbodyWeb3Transactions: document.getElementById('tbodyWeb3Transactions'),
        tbodyBoosterTransactions: document.getElementById('tbodyBoosterTransactions'),
        tbodyPublicationsCreated: document.getElementById('tbodyPublicationsCreated'),
        tbodyTasksWorked: document.getElementById('tbodyTasksWorked'),
        tbodyReferralsTree: document.getElementById('tbodyReferralsTree'),
        sosContainerDossier: document.getElementById('sosContainerDossier'),
        timelineAuditSecurity: document.getElementById('timelineAuditSecurity'),

        // Botones de Acción
        btnSyncKycOnChain: document.getElementById('btnSyncKycOnChain'),
        btnEditReferralCode: document.getElementById('btnEditReferralCode'),
        btnChangeStatus: document.getElementById('btnChangeStatus'),

        // Modales
        modalChangeStatus: document.getElementById('modalChangeStatus'),
        selectNewStatus: document.getElementById('selectNewStatus'),
        txtStatusReason: document.getElementById('txtStatusReason'),
        btnCancelStatusModal: document.getElementById('btnCancelStatusModal'),
        btnConfirmStatusChange: document.getElementById('btnConfirmStatusChange'),

        modalEditReferral: document.getElementById('modalEditReferral'),
        txtNewReferralCode: document.getElementById('txtNewReferralCode'),
        btnCancelReferralModal: document.getElementById('btnCancelReferralModal'),
        btnConfirmReferralChange: document.getElementById('btnConfirmReferralChange'),

        modalTaskEvidence: document.getElementById('modalTaskEvidence'),
        taskEvidenceModalTitle: document.getElementById('taskEvidenceModalTitle'),
        taskEvidenceModalContent: document.getElementById('taskEvidenceModalContent'),
        btnCloseEvidenceModal: document.getElementById('btnCloseEvidenceModal')
    };

    let currentDossier = null;

    /**
     * Realiza peticiones autenticadas al backend mediante credenciales HttpOnly.
     */
    async function apiFetch(endpoint, options = {}) {
        const url = `${API_URL}${endpoint}`;
        const defaultOptions = {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        };
        const response = await fetch(url, { ...defaultOptions, ...options });
        if (response.status === 401 || response.status === 403) {
            window.location.href = 'admin.html';
            throw new Error('Sesión de administrador inválida o expirada.');
        }
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Error del servidor (${response.status})`);
        }
        return response.json();
    }

    /**
     * Formatea fechas con hora de forma amigable y profesional.
     */
    function formatDateTime(dateString) {
        if (!dateString) return '-';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Renderiza las estrellas de calificación.
     */
    function renderStars(rating, count) {
        const num = parseFloat(rating) || 0;
        const total = parseInt(count, 10) || 0;
        if (total === 0) return '<span style="color: #64748b;">⭐ Sin calificaciones</span>';
        const stars = '★'.repeat(Math.round(num)) + '☆'.repeat(5 - Math.round(num));
        return `<span style="color: #f59e0b; font-weight: 600;">${stars}</span> <span style="font-size: 0.85rem; color: #94a3b8;">(${num.toFixed(1)} / ${total} reseña${total > 1 ? 's' : ''})</span>`;
    }

    /**
     * Carga y renderiza el expediente completo 360°.
     */
    async function loadUserDossier() {
        try {
            elements.loadingSpinner.style.display = 'block';
            elements.dossierContent.style.display = 'none';

            const response = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/dossier`);
            if (!response.success || !response.dossier) {
                throw new Error("Estructura de respuesta inválida del servidor.");
            }

            currentDossier = response.dossier;
            renderDossierData(currentDossier);

            elements.loadingSpinner.style.display = 'none';
            elements.dossierContent.style.display = 'block';

        } catch (error) {
            elements.loadingSpinner.innerHTML = `
                <div style="padding: 40px; text-align: center;">
                    <p style="color: #ef4444; font-size: 1.1rem; font-weight: 600;">❌ Error al cargar el expediente</p>
                    <p style="color: #94a3b8; font-size: 0.9rem;">${escapeHtml(error.message)}</p>
                    <a href="admin-panel.html#users" class="back-btn-admin" style="margin-top: 16px; display: inline-flex;">Volver a Usuarios</a>
                </div>
            `;
        }
    }

    /**
     * Distribuye la información del expediente en todos los componentes visuales.
     */
    function renderDossierData(dossier) {
        const { profile, balances } = dossier;

        // 1. Identidad y Cabecera
        elements.userTitleUsername.textContent = `@${profile.username}`;
        elements.userTitleId.textContent = `ID de Usuario: #${profile.id} • Registrado el ${formatDateTime(profile.created_at)}`;
        elements.userAvatar.textContent = profile.username.charAt(0).toUpperCase();

        const statusClass = profile.account_status || 'active';
        elements.badgeAccountStatus.className = `status-badge ${escapeHtml(statusClass)}`;
        elements.badgeAccountStatus.textContent = statusClass.toUpperCase();

        // 2. Tarjeta 1: Perfil e Identidad
        elements.infoUsername.textContent = profile.username;
        elements.infoEmail.textContent = profile.email || 'No registrado';
        elements.infoPhone.textContent = profile.phone_number || 'No registrado';
        
        if (profile.web3_wallet_address) {
            const addr = profile.web3_wallet_address;
            const truncated = addr.substring(0, 8) + '...' + addr.substring(addr.length - 6);
            elements.infoWallet.innerHTML = `
                <div style="display: flex; align-items: center; gap: 6px; justify-content: flex-end;">
                    <span>${truncated}</span>
                    <button class="copy-wallet-btn-admin" id="btnCopyWallet" style="background:none; border:none; color:#38bdf8; cursor:pointer; padding:0;" title="Copiar dirección completa">
                        📋
                    </button>
                </div>
            `;
            document.getElementById('btnCopyWallet')?.addEventListener('click', () => {
                copyTextToClipboard(addr).then(() => showCustomAlert("✅ Dirección Web3 copiada al portapapeles."));
            });
        } else {
            elements.infoWallet.innerHTML = '<span style="color: #64748b;">Sin billetera Web3</span>';
        }

        elements.infoKyc.innerHTML = profile.kyc_verified
            ? '<span style="color: #10b981; font-weight: 600;">✅ Verificado On-Chain</span>'
            : '<span style="color: #f59e0b; font-weight: 600;">⏳ No Verificado</span>';

        const dossiersList = [];
        if (profile.sos_dossier) dossiersList.push(`<span style="color: #f43f5e; font-weight:600; font-family: monospace;">🆘 ${escapeHtml(profile.sos_dossier)}</span>`);
        if (profile.vol_dossier) dossiersList.push(`<span style="color: #38bdf8; font-weight:600; font-family: monospace;">🤝 ${escapeHtml(profile.vol_dossier)}</span>`);
        elements.infoDossiers.innerHTML = dossiersList.length > 0 ? dossiersList.join(' • ') : '<span style="color: #64748b;">Ninguno</span>';

        elements.infoSponsor.innerHTML = profile.referrer_username
            ? `<a href="admin-user-detail.html?user=${encodeURIComponent(profile.referrer_username)}" style="color: #60a5fa; text-decoration: underline;">@${escapeHtml(profile.referrer_username)}</a>`
            : '<span style="color: #64748b;">Registro Orgánico (Sin patrocinador)</span>';

        elements.infoMinor.innerHTML = profile.is_minor
            ? `<span style="color: #f59e0b; font-weight: 600;">⚠️ Menor de Edad (Tutor: ${profile.tutor_username ? `@${escapeHtml(profile.tutor_username)}` : 'Pendiente'})</span>`
            : '<span style="color: #10b981;">Mayor de Edad (Legalmente Capaz)</span>';

        // 3. Tarjeta 2: Balances Contables
        elements.infoBlueLiquid.innerHTML = formatBalance(balances.liquid_blue_balance);
        elements.infoBlueEscrow.innerHTML = formatBalance(balances.escrow_blue_balance);
        elements.infoBlueIou.innerHTML = formatBalance(balances.booster_blue_balance);
        elements.infoRedBalance.innerHTML = formatBalance(balances.red_balance);
        elements.infoCreatedAt.textContent = formatDateTime(profile.created_at);
        elements.infoUpdatedAt.textContent = formatDateTime(profile.updated_at);

        // 4. Tarjeta 3: Scoring & Reputación
        elements.badgeTrustLevel.textContent = profile.trust_score_level || 'Standard';
        elements.infoTrustScore.textContent = `${profile.trust_score || 50} / 100 pts`;
        elements.infoCommunityRating.innerHTML = renderStars(profile.average_rating, profile.ratings_count);
        elements.infoRatingsCount.textContent = `${profile.ratings_count || 0} reseñas`;
        
        const penalizedCount = (dossier.debts || []).filter(d => d.is_penalized && !d.is_settled).length;
        elements.infoDebtsCount.innerHTML = penalizedCount > 0
            ? `<span style="color: #f43f5e; font-weight: 700;">⚠️ ${penalizedCount} en mora</span>`
            : '<span style="color: #10b981;">0 (Al día)</span>';

        elements.infoReferralCode.textContent = profile.referral_code || 'Sin código';

        // 5. Contadores de Pestañas
        elements.countWeb3Tx.textContent = (dossier.web3_transactions || []).length;
        elements.countBoosterTx.textContent = (dossier.booster_transactions || []).length;
        elements.countPubsCreated.textContent = (dossier.publications_created || []).length;
        elements.countTasksWorked.textContent = (dossier.tasks_accepted || []).length;
        elements.countReferrals.textContent = (dossier.referrals || []).length;
        
        const solidarioTotal = (dossier.sos_case ? 1 : 0) + (dossier.volunteer_case ? 1 : 0) + 
            (dossier.humanitarian?.causes_created?.length || 0) + (dossier.humanitarian?.donations_sent?.length || 0);
        elements.countSolidario.textContent = solidarioTotal;
        elements.countAudit.textContent = (dossier.audit_events || []).length + (dossier.legal_acceptances || []).length;

        // 6. Renderizar Pestaña 1: Ledger Web3
        renderWeb3Transactions(dossier.web3_transactions);

        // 7. Renderizar Pestaña 2: Ledger Impulsor
        renderBoosterTransactions(dossier.booster_transactions);

        // 8. Renderizar Pestaña 3: Publicaciones Creadas
        renderPublicationsCreated(dossier.publications_created);

        // 9. Renderizar Pestaña 4: Tareas Trabajadas
        renderTasksWorked(dossier.tasks_accepted);

        // 10. Renderizar Pestaña 5: Red de Referidos
        renderReferralsTree(dossier.referrals);

        // 11. Renderizar Pestaña 6: Solidario & SOS
        renderSolidarioSection(dossier);

        // 12. Renderizar Pestaña 7: Auditoría & Ciberseguridad
        renderAuditSecurity(dossier.audit_events, dossier.legal_acceptances);
    }

    /**
     * Renderiza la tabla de transacciones Web3.
     */
    function renderWeb3Transactions(txs) {
        if (!txs || txs.length === 0) {
            elements.tbodyWeb3Transactions.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">Sin transacciones Web3 registradas en la blockchain.</td></tr>';
            return;
        }

        elements.tbodyWeb3Transactions.innerHTML = txs.map(tx => {
            const hashTruncated = tx.tx_hash 
                ? `<span class="mono-val" style="color: #38bdf8;">${escapeHtml(tx.tx_hash.substring(0, 10))}...</span>`
                : '<span style="color: #64748b;">Off-Chain / Interno</span>';
            
            return `
                <tr>
                    <td>#${escapeHtml(tx.id)}</td>
                    <td><span class="status-badge active">${escapeHtml(tx.type)}</span></td>
                    <td style="text-align: right;" class="saldo-blue-text font-bold">${formatBalance(tx.amount)}</td>
                    <td>${hashTruncated}</td>
                    <td>${escapeHtml(tx.description || '-')}</td>
                    <td style="text-align: center; font-size: 0.82rem; color: var(--text-muted);">${formatDateTime(tx.created_at)}</td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Renderiza el ledger de impulsores (BLUE IOU).
     */
    function renderBoosterTransactions(txs) {
        if (!txs || txs.length === 0) {
            elements.tbodyBoosterTransactions.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">Sin movimientos de impulsor (BLUE IOU) registrados.</td></tr>';
            return;
        }

        elements.tbodyBoosterTransactions.innerHTML = txs.map(tx => `
            <tr>
                <td>#${escapeHtml(tx.id)}</td>
                <td><span class="status-badge" style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD;">${escapeHtml(tx.type)}</span></td>
                <td style="text-align: right;" class="saldo-booster-text font-bold">${formatBalance(tx.amount)}</td>
                <td>${escapeHtml(tx.description || '-')}</td>
                <td style="text-align: center; font-size: 0.82rem; color: var(--text-muted);">${formatDateTime(tx.created_at)}</td>
            </tr>
        `).join('');
    }

    /**
     * Renderiza las publicaciones creadas por el usuario.
     */
    function renderPublicationsCreated(pubs) {
        if (!pubs || pubs.length === 0) {
            elements.tbodyPublicationsCreated.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">El usuario no ha creado publicaciones.</td></tr>';
            return;
        }

        elements.tbodyPublicationsCreated.innerHTML = pubs.map(p => `
            <tr>
                <td>#${escapeHtml(p.id)}</td>
                <td><strong>${escapeHtml(p.title)}</strong></td>
                <td><span class="status-badge ${p.is_sell_post ? 'completed' : 'active'}">${p.is_sell_post ? 'Venta / Oferta' : 'Tarea / Solicitud'}</span></td>
                <td style="text-align: right;" class="saldo-blue-text font-bold">${formatBalance(p.blue_cost)}</td>
                <td style="text-align: center;">${escapeHtml(p.participants_count || 0)} / ${escapeHtml(p.available_slots || 1)}</td>
                <td style="text-align: center;"><span class="status-badge ${escapeHtml(p.status)}">${escapeHtml(p.status)}</span></td>
                <td style="text-align: center; font-size: 0.82rem; color: var(--text-muted);">${formatDateTime(p.created_at)}</td>
            </tr>
        `).join('');
    }

    /**
     * Renderiza las tareas trabajadas por el usuario y permite inspeccionar evidencias.
     */
    function renderTasksWorked(tasks) {
        if (!tasks || tasks.length === 0) {
            elements.tbodyTasksWorked.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">El usuario no ha trabajado en tareas de terceros.</td></tr>';
            return;
        }

        window._tasksWorkedCache = tasks;

        elements.tbodyTasksWorked.innerHTML = tasks.map((t, index) => {
            const hasEvidence = (t.evidence_urls && t.evidence_urls.length > 0) || (t.form_responses && Object.keys(t.form_responses).length > 0);
            const actionBtn = hasEvidence
                ? `<button class="btn-action-dossier secondary" style="font-size: 0.75rem; padding: 4px 10px;" onclick="window._showTaskEvidence(${index})">👁️ Ver Entrega</button>`
                : '<span style="color: #64748b; font-size: 0.8rem;">Sin respuestas</span>';

            return `
                <tr>
                    <td>#${escapeHtml(t.id)}</td>
                    <td><strong>${escapeHtml(t.publication_title)}</strong></td>
                    <td>@${escapeHtml(t.author_username)}</td>
                    <td style="text-align: right;" class="saldo-blue-text font-bold">${formatBalance(t.blue_cost)}</td>
                    <td style="text-align: center;"><span class="status-badge ${escapeHtml(t.status)}">${escapeHtml(t.status)}</span></td>
                    <td style="text-align: center;">${actionBtn}</td>
                    <td style="text-align: center; font-size: 0.82rem; color: var(--text-muted);">${formatDateTime(t.accepted_at)}</td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Modal para ver las respuestas y evidencias de la tarea.
     */
    window._showTaskEvidence = function(index) {
        const task = window._tasksWorkedCache?.[index];
        if (!task) return;

        elements.taskEvidenceModalTitle.textContent = `📋 Entrega de Tarea #${task.id} (${task.publication_title})`;
        
        let html = '';

        // Respuestas de Formulario
        if (task.form_responses && Object.keys(task.form_responses).length > 0) {
            html += `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #94a3b8; font-size: 0.85rem; text-transform: uppercase; margin-bottom: 10px;">Campos y Respuestas:</h4>
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--card-border); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 10px;">
            `;
            for (const [stepKey, stepVal] of Object.entries(task.form_responses)) {
                if (typeof stepVal === 'object' && stepVal !== null) {
                    for (const [field, val] of Object.entries(stepVal)) {
                        html += `<div><strong style="color: #38bdf8; font-size: 0.85rem;">${escapeHtml(field)}:</strong> <span style="font-size: 0.88rem; color: #fff;">${escapeHtml(val)}</span></div>`;
                    }
                } else {
                    html += `<div><strong style="color: #38bdf8; font-size: 0.85rem;">${escapeHtml(stepKey)}:</strong> <span style="font-size: 0.88rem; color: #fff;">${escapeHtml(stepVal)}</span></div>`;
                }
            }
            html += `</div></div>`;
        }

        // Evidencias Fotográficas
        if (task.evidence_urls && task.evidence_urls.length > 0) {
            html += `
                <div>
                    <h4 style="color: #94a3b8; font-size: 0.85rem; text-transform: uppercase; margin-bottom: 10px;">Capturas y Evidencias Adjuntas:</h4>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            `;
            task.evidence_urls.forEach(url => {
                const safeUrl = sanitizeUrl(url);
                if (safeUrl !== '#') {
                    html += `
                        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">
                            <img src="${safeUrl}" alt="Evidencia" style="width: 110px; height: 110px; object-fit: cover; border-radius: 8px; border: 1px solid var(--card-border); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        </a>
                    `;
                }
            });
            html += `</div></div>`;
        }

        elements.taskEvidenceModalContent.innerHTML = html;
        elements.modalTaskEvidence.classList.add('active');
    };

    /**
     * Sanitiza URLs para prevenir esquemas javascript: o data: maliciosos.
     * Solo permite https://, http://, /uploads/, o rutas relativas seguras.
     */
    function sanitizeUrl(url) {
        if (!url || typeof url !== 'string') return '#';
        const trimmed = url.trim();
        if (/^https?:\/\//i.test(trimmed) || /^\/uploads\//i.test(trimmed) || /^\.\//i.test(trimmed)) {
            return escapeHtml(trimmed);
        }
        return '#';
    }

    /**
     * Renderiza el árbol de referidos directos.
     */
    function renderReferralsTree(referrals) {
        if (!referrals || referrals.length === 0) {
            elements.tbodyReferralsTree.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">Este usuario no ha registrado referidos directos.</td></tr>';
            return;
        }

        elements.tbodyReferralsTree.innerHTML = referrals.map(r => `
            <tr>
                <td>#${escapeHtml(r.id)}</td>
                <td>
                    <a href="admin-user-detail.html?id=${escapeHtml(r.referred_id)}" style="color: #60a5fa; font-weight: 600; text-decoration: underline;">
                        @${escapeHtml(r.referred_username)}
                    </a>
                </td>
                <td style="text-align: center;"><span class="status-badge ${escapeHtml(r.account_status)}">${escapeHtml(r.account_status)}</span></td>
                <td style="text-align: center;">${r.kyc_verified ? '<span style="color:#10b981; font-weight:600;">✅ Sí</span>' : '<span style="color:#f59e0b;">⏳ No</span>'}</td>
                <td style="text-align: center; font-size: 0.82rem; color: var(--text-muted);">${formatDateTime(r.referral_date || r.registration_date)}</td>
            </tr>
        `).join('');
    }

    /**
     * Renderiza la sección solidaria y expedientes SOS.
     */
    function renderSolidarioSection(dossier) {
        let html = '';

        // Caso SOS
        if (dossier.sos_case) {
            const sos = dossier.sos_case;
            html += `
                <div class="summary-card" style="border-left: 4px solid #f43f5e;">
                    <div class="card-header-clean">
                        <h3 class="card-title-clean">🆘 Expediente SOS Damnificado: ${escapeHtml(sos.dossier_number)}</h3>
                        <span class="status-badge danger">${escapeHtml(sos.status)}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; font-size: 0.88rem;">
                        <div><span style="color: var(--text-muted);">Nombre Completo:</span> <strong>${escapeHtml(sos.full_name)}</strong></div>
                        <div><span style="color: var(--text-muted);">Cédula / ID:</span> <strong>${escapeHtml(sos.id_document)}</strong></div>
                        <div><span style="color: var(--text-muted);">Ubicación:</span> ${escapeHtml(sos.state)}, ${escapeHtml(sos.municipality)} (${escapeHtml(sos.sector)})</div>
                        <div><span style="color: var(--text-muted);">Afectación:</span> <strong>${escapeHtml(sos.affectation_level)}</strong> (Score: ${escapeHtml(sos.urgency_score)})</div>
                    </div>
                    <p style="margin: 12px 0 0 0; font-size: 0.85rem; color: #cbd5e1; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px;">
                        ${escapeHtml(sos.description || 'Sin descripción adicional')}
                    </p>
                </div>
            `;
        }

        // Registro Voluntario
        if (dossier.volunteer_case) {
            const vol = dossier.volunteer_case;
            html += `
                <div class="summary-card" style="border-left: 4px solid #38bdf8;">
                    <div class="card-header-clean">
                        <h3 class="card-title-clean">🤝 Expediente Voluntario de la Libertad: ${escapeHtml(vol.dossier_number)}</h3>
                        <span class="status-badge active">${escapeHtml(vol.status)}</span>
                    </div>
                    <div style="font-size: 0.88rem;">
                        <div><span style="color: var(--text-muted);">Habilidades Registradas:</span> <strong>${escapeHtml(vol.volunteer_skills || 'General')}</strong></div>
                    </div>
                </div>
            `;
        }

        // Causas Humanitarias
        const causes = dossier.humanitarian?.causes_created || [];
        if (causes.length > 0) {
            html += `
                <div class="dossier-table-card">
                    <div style="padding: 16px; font-weight: 700; border-bottom: 1px solid var(--card-border);">Causas Humanitarias Creadas</div>
                    <div class="table-responsive">
                        <table class="admin-table">
                            <thead><tr><th>ID</th><th>Título</th><th>Meta (BLUE)</th><th>Recaudado</th><th>Estado</th><th>Fecha</th></tr></thead>
                            <tbody>
                                ${causes.map(c => `
                                    <tr>
                                        <td>#${escapeHtml(c.id)}</td>
                                        <td><strong>${escapeHtml(c.title)}</strong></td>
                                        <td>${formatBalance(c.goal_amount)}</td>
                                        <td class="saldo-blue-text font-bold">${formatBalance(c.current_amount)}</td>
                                        <td><span class="status-badge ${escapeHtml(c.status)}">${escapeHtml(c.status)}</span></td>
                                        <td>${formatDateTime(c.created_at)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        if (!html) {
            html = '<div class="summary-card" style="text-align: center; color: var(--text-muted); padding: 40px;">No registra actividad humanitaria ni expedientes SOS.</div>';
        }

        elements.sosContainerDossier.innerHTML = html;
    }

    /**
     * Renderiza la línea de tiempo de auditoría inmutable (SOC 2).
     */
    function renderAuditSecurity(auditEvents, legalAcceptances) {
        const events = [...(auditEvents || [])];

        if (legalAcceptances && legalAcceptances.length > 0) {
            legalAcceptances.forEach(l => {
                events.push({
                    event_type: 'legal.terms_accepted',
                    actor_username: 'Usuario',
                    ip_address: l.ip_address,
                    created_at: l.accepted_at,
                    metadata: { document_type: l.document_type, version: l.document_version }
                });
            });
        }

        events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (events.length === 0) {
            elements.timelineAuditSecurity.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">Sin eventos de seguridad registrados para este usuario.</p>';
            return;
        }

        elements.timelineAuditSecurity.innerHTML = events.map(ev => {
            let icon = '🔒';
            if (ev.event_type.includes('login')) icon = '🔑';
            if (ev.event_type.includes('status')) icon = '⚙️';
            if (ev.event_type.includes('kyc')) icon = '⛓️';
            if (ev.event_type.includes('legal')) icon = '📜';
            if (ev.event_type.includes('dossier')) icon = '👁️';

            return `
                <div class="timeline-item">
                    <div class="timeline-icon">${icon}</div>
                    <div class="timeline-content">
                        <div class="timeline-title">
                            <span>${escapeHtml(ev.event_type)}</span>
                            <span class="timeline-meta">${formatDateTime(ev.created_at)}</span>
                        </div>
                        <div class="timeline-desc">
                            Actor: <strong>${escapeHtml(ev.actor_username || 'Sistema')}</strong> • IP: <span class="mono-val">${escapeHtml(ev.ip_address || 'N/A')}</span>
                            ${ev.metadata ? `<div style="font-size: 0.78rem; color: #94a3b8; margin-top: 4px; font-family: monospace;">${escapeHtml(JSON.stringify(ev.metadata))}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERACCIÓN Y MANEJADORES DE EVENTOS
    // ═══════════════════════════════════════════════════════════════════════════

    // Navegación por pestañas
    document.querySelectorAll('.tab-btn-dossier').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn-dossier').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane-dossier').forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.dataset.tab;
            document.getElementById(targetId)?.classList.add('active');
        });
    });

    // Sincronizar KYC On-Chain
    elements.btnSyncKycOnChain.addEventListener('click', async () => {
        if (!currentDossier?.profile?.id) return;
        if (!currentDossier.profile.web3_wallet_address) {
            showCustomAlert("⚠️ Este usuario no tiene una billetera Web3 vinculada. Se requiere una dirección pública (0x...) para verificar el registro en el Smart Contract.");
            return;
        }

        elements.btnSyncKycOnChain.disabled = true;
        elements.btnSyncKycOnChain.textContent = '⛓️ Consultando Blockchain...';

        try {
            const res = await apiFetch(`/api/admin/users/${currentDossier.profile.id}/kyc-status`);
            const statusMsg = res.kyc_verified ? "✅ Usuario verificado en el Smart Contract On-Chain." : "⏳ El Smart Contract indica que el usuario NO está verificado.";
            showCustomAlert(`${statusMsg}\n\nDetalles:\nBilletera: ${res.wallet_address || 'N/A'}\nNivel KYC: ${res.kyc_level || 0}`);
            await loadUserDossier();
        } catch (err) {
            showCustomAlert(`❌ Error al sincronizar con blockchain: ${err.message}`);
        } finally {
            elements.btnSyncKycOnChain.disabled = false;
            elements.btnSyncKycOnChain.textContent = '⛓️ Sync KYC On-Chain';
        }
    });

    // Cambiar Estado Modal
    elements.btnChangeStatus.addEventListener('click', () => {
        if (!currentDossier) return;
        elements.selectNewStatus.value = currentDossier.profile.account_status || 'active';
        elements.txtStatusReason.value = '';
        elements.modalChangeStatus.classList.add('active');
    });

    elements.btnCancelStatusModal.addEventListener('click', () => {
        elements.modalChangeStatus.classList.remove('active');
    });

    elements.btnConfirmStatusChange.addEventListener('click', async () => {
        const newStatus = elements.selectNewStatus.value;
        const reason = elements.txtStatusReason.value.trim();

        if (!reason) {
            showCustomAlert("Por favor ingresa un motivo para el log de auditoría bancaria (SOC 2).");
            return;
        }

        elements.btnConfirmStatusChange.disabled = true;
        elements.btnConfirmStatusChange.textContent = 'Guardando...';

        try {
            await apiFetch(`/api/admin/users/${currentDossier.profile.id}/status`, {
                method: 'POST',
                body: JSON.stringify({ status: newStatus, reason })
            });

            elements.modalChangeStatus.classList.remove('active');
            showCustomAlert(`✅ Estado de cuenta actualizado exitosamente a: ${newStatus.toUpperCase()}`);
            await loadUserDossier();
        } catch (err) {
            showCustomAlert(`❌ Error al cambiar estado: ${err.message}`);
        } finally {
            elements.btnConfirmStatusChange.disabled = false;
            elements.btnConfirmStatusChange.textContent = 'Guardar Cambios';
        }
    });

    // Editar Código de Referido Modal
    elements.btnEditReferralCode.addEventListener('click', () => {
        if (!currentDossier) return;
        elements.txtNewReferralCode.value = currentDossier.profile.referral_code || '';
        elements.modalEditReferral.classList.add('active');
    });

    elements.btnCancelReferralModal.addEventListener('click', () => {
        elements.modalEditReferral.classList.remove('active');
    });

    elements.btnConfirmReferralChange.addEventListener('click', async () => {
        const newCode = elements.txtNewReferralCode.value.trim().toUpperCase();
        if (!newCode) {
            showCustomAlert("Por favor ingresa un código de referido válido.");
            return;
        }

        elements.btnConfirmReferralChange.disabled = true;
        elements.btnConfirmReferralChange.textContent = 'Guardando...';

        try {
            await apiFetch(`/api/admin/users/${currentDossier.profile.id}/referral-code`, {
                method: 'PUT',
                body: JSON.stringify({ referral_code: newCode })
            });

            elements.modalEditReferral.classList.remove('active');
            showCustomAlert(`✅ Código de referido actualizado exitosamente a: ${newCode}`);
            await loadUserDossier();
        } catch (err) {
            showCustomAlert(`❌ Error al actualizar código: ${err.message}`);
        } finally {
            elements.btnConfirmReferralChange.disabled = false;
            elements.btnConfirmReferralChange.textContent = 'Actualizar Código';
        }
    });

    // Cerrar Modal de Evidencias
    elements.btnCloseEvidenceModal.addEventListener('click', () => {
        elements.modalTaskEvidence.classList.remove('active');
    });

    // Carga inicial
    await loadUserDossier();
});
