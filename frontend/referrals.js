document.addEventListener('DOMContentLoaded', () => {

    // --- Configuración y Estado ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? 'http://localhost:3000' : 'https://wintoncoin-backend.onrender.com';
    
    const storedUsername = sessionStorage.getItem('username');

    const elements = {
        codeSection: document.getElementById('referral-code-section'),
        historySection: document.getElementById('referral-history-section'),
        referredUsersList: document.getElementById('referred-users-list')
    };

    // --- Inicialización ---
    if (!storedUsername) {
        showCustomAlert('Debes iniciar sesión para ver esta página.', () => { window.location.href = 'index.html'; });
        return;
    }

    fetchReferralInfo();

    // --- Lógica de Datos (Fetch) ---
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

    // --- Lógica de Renderizado ---
    function renderReferralInfo(data) {
        renderReferralCode(data.referral_code);
        renderReferredUsers(data.referred_users);
    }

    function renderReferralCode(code) {
        if (!code) {
            elements.codeSection.innerHTML = `<p class="error-message">No se pudo generar tu código de referido. Contacta a soporte.</p>`;
            return;
        }

        // Construimos el enlace completo para compartir
        const referralLink = `${window.location.origin}/register.html?ref=${code}`;

        elements.codeSection.innerHTML = `
            <h4>Tu Código de Referido</h4>
            <p class="referral-code-display">${code}</p>
            <p class="referral-description">Comparte este código o el enlace de abajo con tus amigos. Cuando se registren, ¡ambos recibirán una recompensa!</p>
            <div class="referral-link-container">
                <input type="text" id="referralLinkInput" value="${referralLink}" readonly>
                <button id="copyLinkBtn" class="action-button">Copiar Enlace</button>
            </div>
        `;

        // Añadimos el event listener al botón de copiar después de que exista en el DOM
        document.getElementById('copyLinkBtn').addEventListener('click', () => {
            const linkInput = document.getElementById('referralLinkInput');
            linkInput.select();
            linkInput.setSelectionRange(0, 99999); // Para móviles
            
            try {
                // Usamos la API del portapapeles, que es más moderna y segura
                navigator.clipboard.writeText(linkInput.value).then(() => {
                    showCustomAlert('¡Enlace de referido copiado al portapapeles!');
                });
            } catch (err) {
                // Fallback para navegadores antiguos
                document.execCommand('copy');
                showCustomAlert('¡Enlace de referido copiado al portapapeles!');
            }
        });
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
                        <th>Usuario Registrado</th>
                        <th>Fecha de Registro</th>
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
        const registrationDate = new Date(user.created_at).toLocaleString('es-ES', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        // Hacemos el nombre de usuario un enlace a su perfil si los perfiles públicos están activos
        const userNameHTML = window.appSettings.public_profiles_enabled
            ? `<a href="profile.html?user=${user.referred_username}" class="profile-link">${user.referred_username}</a>`
            : user.referred_username;

        return `
            <tr>
                <td>${userNameHTML}</td>
                <td>${registrationDate}</td>
            </tr>
        `;
    }
}); 