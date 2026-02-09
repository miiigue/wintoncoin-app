// ============================================================================
// WintonCoin - Notification Settings Module
// ============================================================================

import { getApiUrl, showCustomAlert, getAuthToken } from './index.js';

/**
 * Initializes notification settings modal and event listeners
 */
export function initializeNotificationSettings() {
    const modal = document.getElementById('settingsModal');
    const openBtn = document.getElementById('openSettingsModal');
    const closeBtn = document.getElementById('closeSettingsModal');
    const saveBtn = document.getElementById('saveNotificationSettings');

    if (!modal || !openBtn || !closeBtn || !saveBtn) {
        console.warn('[NotificationSettings] Required elements not found');
        return;
    }

    // Open modal
    openBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await loadNotificationSettings();
        modal.style.display = 'block';
    });

    // Close modal
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Save settings
    saveBtn.addEventListener('click', async () => {
        await saveNotificationSettings();
    });
}

/**
 * Loads current notification settings from server
 */
async function loadNotificationSettings() {
    const API_URL = getApiUrl();
    const token = getAuthToken();

    if (!token) {
        showCustomAlert('Debes iniciar sesión para acceder a la configuración.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/notifications/settings`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar preferencias');
        }

        const settings = await response.json();

        // Update UI
        document.getElementById('notifSecuritySwitch').checked = true; // Always true
        document.getElementById('notifSocialSwitch').checked = settings.social !== false;
        document.getElementById('notifMarketingSwitch').checked = settings.marketing !== false;

    } catch (error) {
        console.error('[NotificationSettings] Load error:', error);
        showCustomAlert('No se pudieron cargar las preferencias de notificaciones.');
    }
}

/**
 * Saves notification settings to server
 */
async function saveNotificationSettings() {
    const API_URL = getApiUrl();
    const token = getAuthToken();

    if (!token) {
        showCustomAlert('Debes iniciar sesión para guardar la configuración.');
        return;
    }

    try {
        const social = document.getElementById('notifSocialSwitch').checked;
        const marketing = document.getElementById('notifMarketingSwitch').checked;

        const response = await fetch(`${API_URL}/api/notifications/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ social, marketing })
        });

        if (!response.ok) {
            throw new Error('Error al guardar preferencias');
        }

        const result = await response.json();
        showCustomAlert('✅ Preferencias guardadas correctamente');

        // Close modal after success
        setTimeout(() => {
            document.getElementById('settingsModal').style.display = 'none';
        }, 1500);

    } catch (error) {
        console.error('[NotificationSettings] Save error:', error);
        showCustomAlert('❌ No se pudieron guardar las preferencias. Inténtalo de nuevo.');
    }
}
