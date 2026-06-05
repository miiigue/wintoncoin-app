// ============================================================================
// WintonCoin - Settings Page Module
// ============================================================================

import { getApiUrl, showCustomAlert, handleSessionExpired } from '../modules/index.js';
import { initSettingsInstallButton } from '../modules/pwa-install.js';

function initializeSettingsPage() {
    const API_URL = getApiUrl();
    const token = localStorage.getItem('token');
    
    if (!token) {
        showCustomAlert('Debes iniciar sesión para acceder a la configuración.', () => {
            window.location.href = 'index.html';
        });
        return;
    }

    loadNotificationSettings();
    initSettingsInstallButton(); // Inicializar botón "Descargar App" en página de Configuración

    document.getElementById('saveNotificationSettings').addEventListener('click', async (e) => {
        const btn = e.target;
        const originalText = btn.innerText;
        btn.innerText = 'Guardando...';
        btn.disabled = true;
        
        await saveNotificationSettings();
        
        btn.innerText = originalText;
        btn.disabled = false;
    });

    async function loadNotificationSettings() {
        try {
            const response = await fetch(`${API_URL}/api/notifications/settings`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (handleSessionExpired(response)) return;

            if (!response.ok) {
                throw new Error('Error al cargar preferencias');
            }

            const settings = await response.json();

            // Update UI
            document.getElementById('notifSecuritySwitch').checked = true; // Always true
            document.getElementById('notifSocialSwitch').checked = settings.social !== false;
            document.getElementById('notifMarketingSwitch').checked = settings.marketing !== false;

        } catch (error) {
            console.error('[Settings] Load error:', error);
            showCustomAlert('No se pudieron cargar las preferencias de notificaciones.');
        }
    }

    async function saveNotificationSettings() {
        try {
            const social = document.getElementById('notifSocialSwitch').checked;
            const marketing = document.getElementById('notifMarketingSwitch').checked;

            const response = await fetch(`${API_URL}/api/notifications/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    settings: { social, marketing }
                })
            });

            if (handleSessionExpired(response)) return;

            if (!response.ok) {
                throw new Error('Error al guardar preferencias');
            }

            const result = await response.json();
            showCustomAlert('✅ Preferencias de notificaciones guardadas correctamente');

        } catch (error) {
            console.error('[Settings] Save error:', error);
            showCustomAlert('❌ No se pudieron guardar las preferencias. Inténtalo de nuevo.');
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSettingsPage);
} else {
    initializeSettingsPage();
}

export { initializeSettingsPage };
