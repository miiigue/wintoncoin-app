// ============================================================================
// WintonCoin - Página de Referidos
// ============================================================================

import { getApiUrl, showCustomAlert } from '../modules/index.js';

function initializeReferralsPage() {
    const API_URL = getApiUrl();
    const storedUsername = localStorage.getItem('username');

    const elements = {
        codeSection: document.getElementById('referral-code-section'),
        historySection: document.getElementById('referral-history-section'),
        referredUsersList: document.getElementById('referred-users-list')
    };

    if (!storedUsername) {
        showCustomAlert('Debes iniciar sesión para ver esta página.', () => { window.location.href = 'index.html'; });
        return;
    }

    fetchReferralInfo();

    async function fetchReferralInfo() {
        try {
            const response = await fetch(`${API_URL}/api/users/${storedUsername}/referral-info`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al cargar la información de referidos.');
            }
            const data = await response.json();
            renderReferralInfo(data);
        } catch (error) {
            console.error('Error al cargar datos de referidos:', error);
            elements.codeSection.innerHTML = `<p class="error-message">No se pudo cargar tu código de referido.</p>`;
            elements.historySection.innerHTML = `<p class="error-message">No se pudo cargar tu historial de referidos.</p>`;
        }
    }

    function renderReferralInfo(data) {
        renderReferralCode(data.referral_code);
        renderReferredUsers(data.referred_users);
    }

    function renderReferralCode(code) {
        if (!code) {
            elements.codeSection.innerHTML = `<p class="error-message">No se pudo generar tu código de referido. Contacta a soporte.</p>`;
            return;
        }

        const referralLink = `${window.location.origin}/register.html?ref=${code}`;

        elements.codeSection.innerHTML = `
            <h4>Tu Código de Referido</h4>
            <div style="text-align: center; margin: 1.5rem 0;">
                <p class="referral-code-display" style="font-size: 2rem; font-weight: 800; color: #4F46E5; margin: 0; letter-spacing: 2px; line-height: 1.2;">
                    ${code}
                </p>
                <button id="copyCodeBtn" class="action-button" style="margin-top: 1rem;">
                    Copiar Código
                </button>
            </div>
            <p class="referral-description">Comparte este código o el enlace de abajo con tus amigos. Cuando se registren, ¡ambos recibirán una recompensa!</p>
            <div class="referral-link-container">
                <input type="text" id="referralLinkInput" value="${referralLink}" readonly>
                <button id="copyLinkBtn" class="action-button">Copiar Enlace</button>
            </div>
        `;

        // Evento para Copiar CÓDIGO
        document.getElementById('copyCodeBtn').addEventListener('click', () => {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(code).then(() => {
                    showCustomAlert('¡Código copiado al portapapeles!');
                }).catch(err => {
                    console.error('Error al copiar código:', err);
                    fallbackCopy(code);
                });
            } else {
                fallbackCopy(code);
            }
        });

        // Evento para Copiar ENLACE
        document.getElementById('copyLinkBtn').addEventListener('click', () => {
            const linkInput = document.getElementById('referralLinkInput');
            linkInput.select();
            linkInput.setSelectionRange(0, 99999);

            if (navigator.clipboard) {
                navigator.clipboard.writeText(linkInput.value).then(() => {
                    showCustomAlert('¡Enlace de referido copiado al portapapeles!');
                }).catch(err => {
                    fallbackCopy(linkInput.value);
                });
            } else {
                fallbackCopy(linkInput.value);
            }
        });

        function fallbackCopy(text) {
            const textArea = document.createElement("textarea");
            textArea.value = text;

            // Evitar scroll al insertar
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";

            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                document.execCommand('copy');
                showCustomAlert('¡Copiado al portapapeles!');
            } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
            }

            document.body.removeChild(textArea);
        }
    }

    function renderReferredUsers(users) {
        if (!users || users.length === 0) {
            elements.referredUsersList.innerHTML = '<p class="empty-message">Aún no has referido a ningún usuario. ¡Comparte tu código!</p>';
            return;
        }

        const tableHTML = `
            <table id="referrals-table">
                <thead>
                    <tr>
                        <th style="width: 80px; text-align: center;">KYC</th>
                        <th>Usuario</th>
                        <th>Fecha de Registro</th>
                        <th>BLUE iou acumulado</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => getReferredUserRowHTML(user)).join('')}
                </tbody>
            </table>
        `;
        elements.referredUsersList.innerHTML = tableHTML;
    }

    function getReferredUserRowHTML(user) {
        const registrationDate = formatShortDate(user.created_at);
        const totalBoosterBlue = formatBlueAmount(user.total_booster_blue);

        const userNameHTML = window.appSettings?.public_profiles_enabled
            ? `<a href="profile.html?user=${user.referred_username}" class="profile-link">${user.referred_username}</a>`
            : user.referred_username;

        // Indicador visual de KYC
        const kycIndicator = user.kyc_verified
            ? `<span style="color: #10B981; font-weight: bold; font-size: 1.1rem; display: block; text-align: center;" title="KYC Aprobado">✅</span>`
            : `<span style="color: #F59E0B; font-weight: bold; font-size: 1.1rem; display: block; text-align: center;" title="KYC Pendiente">⏳</span>`;

        return `<tr><td style="text-align: center;">${kycIndicator}</td><td>${userNameHTML}</td><td>${registrationDate}</td><td>${totalBoosterBlue}</td></tr>`;
    }

    function formatBlueAmount(value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return '0,0000';
        return numericValue.toLocaleString('es-ES', {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4
        });
    }

    function formatShortDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '--/--/--';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        return `${day}/${month}/${year}`;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeReferralsPage);
} else {
    initializeReferralsPage();
}

export { initializeReferralsPage };
