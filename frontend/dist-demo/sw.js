// ============================================================================
// BRIDGE Service Worker - Transición de sw.js a sw-source.js
// ============================================================================
// Este archivo existe para que los dispositivos que todavía buscan "sw.js"
// encuentren un SW actualizado con push handlers.
// VitePWA ahora usa sw-source.js como SW principal.
// ============================================================================

self.skipWaiting();

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// ============================================================================
// PUSH NOTIFICATIONS - Copia del handler para dispositivos en transición
// ============================================================================
self.addEventListener('push', (event) => {
    console.log('[SW-BRIDGE] Push notification received');

    let data = {
        title: 'WintonCoin',
        body: 'Tienes una nueva notificación',
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/icon-72x72.png',
        tag: 'wintoncoin-notification',
        data: { url: '/contract_interaction.html' }
    };

    if (event.data) {
        try {
            const payload = event.data.json();
            data = { ...data, ...payload };
        } catch (e) {
            console.warn('[SW-BRIDGE] Push data is not JSON:', e);
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        tag: data.tag,
        data: data.data,
        vibrate: [200, 100, 200],
        requireInteraction: true,
        actions: [
            { action: 'open', title: 'Abrir' },
            { action: 'dismiss', title: 'Cerrar' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'dismiss') return;

    const urlToOpen = event.notification.data?.url || '/contract_interaction.html';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) return clients.openWindow(urlToOpen);
            })
    );
});

console.log('[SW-BRIDGE] Bridge Service Worker loaded with Push support');
