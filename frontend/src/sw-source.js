// ============================================================================
// WintonCoin Service Worker - Source para InjectManifest (VitePWA/Workbox)
// ============================================================================
// Este archivo es procesado por Workbox InjectManifest.
// Workbox inyectará automáticamente el precache manifest en self.__WB_MANIFEST.
// INCLUYE: Push Notification handlers que generateSW no soporta.
// ============================================================================

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { clientsClaim } from 'workbox-core';

// ============================================================================
// WORKBOX CONFIGURATION
// ============================================================================
self.skipWaiting();
clientsClaim();

// Precache manifest (inyectado automáticamente por Workbox)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ============================================================================
// NAVIGATION FALLBACK
// ============================================================================
registerRoute(
    new NavigationRoute(
        createHandlerBoundToURL('index.html'),
        { denylist: [/^\/api\//] }
    )
);

// ============================================================================
// RUNTIME CACHING STRATEGIES
// ============================================================================

// HTML: Network First
registerRoute(
    /\.html$/,
    new NetworkFirst({
        cacheName: 'wintoncoin-html-v1',
        networkTimeoutSeconds: 10,
        plugins: [
            new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 86400 }),
            new CacheableResponsePlugin({ statuses: [0, 200] })
        ]
    })
);

// CSS/JS con hash: Cache First
// Vite puede generar hashes alfanuméricos (incluye mayúsculas, "_" y "-"),
// por eso no usamos un patrón solo hexadecimal.
registerRoute(
    /\/assets\/.*\.[A-Za-z0-9_-]{8,}\.(css|js)$/,
    new CacheFirst({
        cacheName: 'wintoncoin-assets-v1',
        plugins: [
            new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 31536000 }),
            new CacheableResponsePlugin({ statuses: [0, 200] })
        ]
    })
);

// Imágenes: Cache First
registerRoute(
    /\.(png|jpg|jpeg|svg|gif|ico|webp)$/,
    new CacheFirst({
        cacheName: 'wintoncoin-images-v1',
        plugins: [
            new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 2592000 }),
            new CacheableResponsePlugin({ statuses: [0, 200] })
        ]
    })
);

// Fonts: Cache First
registerRoute(
    /\.(woff|woff2|ttf|otf)$/,
    new CacheFirst({
        cacheName: 'wintoncoin-fonts-v1',
        plugins: [
            new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 31536000 }),
            new CacheableResponsePlugin({ statuses: [0, 200] })
        ]
    })
);

// Google Fonts
registerRoute(
    /^https:\/\/fonts\.googleapis\.com/,
    new StaleWhileRevalidate({
        cacheName: 'google-fonts-stylesheets',
        plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 31536000 })]
    })
);
registerRoute(
    /^https:\/\/fonts\.gstatic\.com/,
    new CacheFirst({
        cacheName: 'google-fonts-webfonts',
        plugins: [
            new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 31536000 }),
            new CacheableResponsePlugin({ statuses: [0, 200] })
        ]
    })
);

// API: Network Only
registerRoute(
    /\/api\//,
    new NetworkOnly({
        plugins: [new BackgroundSyncPlugin('wintoncoin-api-queue', { maxRetentionTime: 1440 })]
    })
);

// CDN: Cache First
registerRoute(
    /^https:\/\/cdn\.rawgit\.com/,
    new CacheFirst({
        cacheName: 'external-cdn',
        plugins: [
            new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 2592000 }),
            new CacheableResponsePlugin({ statuses: [0, 200] })
        ]
    })
);

// ============================================================================
// PUSH NOTIFICATIONS
// ============================================================================
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received');

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
            console.warn('[SW] Push data is not JSON, using as text:', e);
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

// ============================================================================
// NOTIFICATION CLICK
// ============================================================================
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked');

    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    const urlToOpen = event.notification.data?.url || '/contract_interaction.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        if (client.url !== urlToOpen) {
                            client.navigate(urlToOpen).catch(err => console.warn('[SW] Navigation failed:', err));
                        }
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// ============================================================================
// BACKGROUND SYNC
// ============================================================================
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync triggered:', event.tag);
    if (event.tag === 'sync-notifications') {
        event.waitUntil(Promise.resolve());
    }
});

console.log('[SW] Service Worker loaded with Push Notifications support');
