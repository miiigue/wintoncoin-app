// ============================================================================
// WintonCoin - Página de Perfil de Usuario
// ============================================================================

import { getApiUrl, showCustomAlert } from '../modules/index.js';

function initializeProfilePage() {
    const API_URL = getApiUrl();
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username') || urlParams.get('user') || localStorage.getItem('username');

    const elements = {
        profileHeader: document.getElementById('profile-header'),
        ratingsList: document.getElementById('ratings-list')
    };

    if (!username) {
        displayError("Debes iniciar sesión para ver tu perfil de usuario.", true);
        setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        return;
    }

    fetchProfileData();

    async function fetchProfileData() {
        try {
            const response = await fetch(`${API_URL}/users/${username}/profile`);
            
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

    function renderProfile(data) {
        renderHeader(data.user);
        renderRatings(data.ratings);
        fetchMySosCase(data.user.username);
    }

    async function fetchMySosCase(userUsername) {
        const container = document.getElementById('sos-my-case-section');
        if (!container) return;

        try {
            const response = await fetch(`${API_URL}/public/sos-venezuela/my-case?username=${encodeURIComponent(userUsername)}`);
            if (!response.ok) return;

            const data = await response.json();
            if (!data.success || !data.has_case || !data.case) {
                container.innerHTML = '';
                return;
            }

            const c = data.case;
            let statusBadge = `<span style="background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">En Verificación Manual</span>`;
            if (c.status === 'approved') {
                statusBadge = `<span style="background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">Aprobado</span>`;
            } else if (c.status === 'disbursed') {
                statusBadge = `<span style="background: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">Ayuda Desembolsada</span>`;
            } else if (c.status === 'rejected') {
                statusBadge = `<span style="background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">Rechazado</span>`;
            }

            let affectationLabel = 'Necesidades Básicas Urgentes';
            if (c.affectation_level === 'total_loss') affectationLabel = 'Pérdida Total de Vivienda / Enseres';
            else if (c.affectation_level === 'medical_emergency') affectationLabel = 'Emergencia Médica / Lesionados';
            else if (c.affectation_level === 'partial_damage') affectationLabel = 'Daño Parcial en Vivienda';

            const familyStr = `${c.dependents_minors || 0} menor(es), ${c.dependents_elderly || 0} adulto(s) mayor(es), ${c.dependents_disabled || 0} persona(s) con discapacidad`;
            const locationStr = `${c.state}, ${c.municipality}, ${c.sector} (${c.address_details})`;

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
                                        <span style="font-size: 0.8rem; color: #64748b; margin-left: 8px;">${new Date(d.disbursed_at).toLocaleDateString()}</span>
                                    </div>
                                    <span style="font-size: 0.85rem; color: #475569;">${d.notes || 'Acreditado'}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            container.innerHTML = `
                <div style="background: linear-gradient(135deg, #fff5f5 0%, #ffffff 100%); border: 1px solid #fecdd3; border-radius: 12px; padding: 20px; box-shadow: 0 4px 12px rgba(219, 39, 119, 0.08); margin-bottom: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #fecdd3; padding-bottom: 10px; margin-bottom: 12px;">
                        <h3 style="margin: 0; color: #9f1239; font-size: 1.25rem; display: flex; align-items: center; gap: 8px;">
                            🚨 Mi caso <span style="font-size: 0.9rem; color: #db2777; font-weight: normal;">(#${c.dossier_number})</span>
                        </h3>
                        ${statusBadge}
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 0.95rem; color: #334155;">
                        <div><strong>Cédula:</strong> ${c.id_document}</div>
                        <div><strong>Edad:</strong> ${c.age || 18} años</div>
                        <div><strong>Ubicación:</strong> ${locationStr}</div>
                        <div><strong>Censo Familiar:</strong> ${familyStr}</div>
                        <div><strong>Gravedad:</strong> ${affectationLabel}</div>
                        <div><strong>Fecha de Registro:</strong> ${new Date(c.created_at).toLocaleDateString()}</div>
                    </div>

                    <div style="margin-top: 10px; background: rgba(255,255,255,0.7); padding: 10px 12px; border-radius: 8px; border: 1px solid #f1f5f9;">
                        <strong style="color: #0f172a; display: block; margin-bottom: 4px;">Relato / Solicitud:</strong>
                        <p style="margin: 0; font-size: 0.9rem; color: #475569; font-style: italic;">"${c.description}"</p>
                    </div>

                    ${disbursementsHTML}
                </div>
            `;
        } catch (err) {
            console.error('Error al cargar datos de Mi caso SOS:', err);
        }
    }

    function renderHeader(user) {
        const ratingHTML = generateStarRating(user.average_rating, user.ratings_count);
        
        let walletHTML = '';
        if (user.web3_wallet_address) {
            const addr = user.web3_wallet_address;
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

        elements.profileHeader.innerHTML = `
            <h1 class="profile-username">${user.username}</h1>
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

    function renderRatings(ratings) {
        if (ratings.length === 0) {
            elements.ratingsList.innerHTML = '<p class="empty-message">Este usuario aún no ha recibido ninguna calificación.</p>';
            return;
        }
        elements.ratingsList.innerHTML = ratings.map(rating => getRatingHTML(rating)).join('');
    }

    function getRatingHTML(rating) {
        const stars = '★'.repeat(rating.rating) + '☆'.repeat(5 - rating.rating);
        const formattedDate = new Date(rating.created_at).toLocaleDateString('es-ES', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        return `
            <div class="rating-item">
                <div class="rating-item-header">
                    <span class="rating-item-rater">De: <strong>${rating.rater_username}</strong></span>
                    <span class="rating-item-stars">${stars}</span>
                </div>
                ${rating.comment ? `<p class="rating-item-comment">"${rating.comment}"</p>` : ''}
                <div class="rating-item-footer"><span>${formattedDate}</span></div>
            </div>
        `;
    }

    function displayError(message, redirect = false) {
        elements.profileHeader.innerHTML = '';
        elements.ratingsList.innerHTML = '';
        showCustomAlert(message, () => {
            if (redirect) {
                window.location.href = 'contract_interaction.html';
            }
        });
    }

    function generateStarRating(rating, count) {
        if (count === 0) {
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeProfilePage);
} else {
    initializeProfilePage();
}

export { initializeProfilePage };
