// ============================================================================
// WintonCoin Service Worker v1.5.0
// ============================================================================
// Estrategia: Network First con Cache Fallback para HTML/API
//             Cache First para assets estáticos (CSS, JS, imágenes)
// ============================================================================

const CACHE_VERSION = 'v1.5.0';
const CACHE_NAME = `wintoncoin-${CACHE_VERSION}`;

// Assets que se cachean en la instalación (App Shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/contract_interaction.html',
  '/style.v1.5.0.css',
  '/utils.v1.5.0.js',
  '/interaction.v1.5.0.js',
  '/login.v1.5.0.js',
  '/manifest.json',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400&family=Poppins:wght@300;400;600&display=swap'
];

// Páginas que se cachean dinámicamente cuando el usuario las visita
const DYNAMIC_PAGES = [
  '/register.html',
  '/booster-profile.html',
  '/history.html',
  '/referrals.html',
  '/transactions.html',
  '/publish.html',
  '/publication-detail.html',
  '/p2p.html',
  '/p2p-history.html',
  '/como-funciona.html',
  '/profile.html',
  '/love.html',
  '/terms.html',
  '/privacy.html'
];

// ============================================================================
// INSTALL: Cachear App Shell
// ============================================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker v' + CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching App Shell');
        // Usamos addAll con catch individual para no fallar si un recurso no existe
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err => console.warn('[SW] Failed to cache:', url, err))
          )
        );
      })
      .then(() => {
        console.log('[SW] App Shell cached successfully');
        return self.skipWaiting(); // Activar inmediatamente
      })
  );
});

// ============================================================================
// ACTIVATE: Limpiar caches viejos
// ============================================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker v' + CACHE_VERSION);

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('wintoncoin-') && name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Old caches cleared');
        return self.clients.claim(); // Tomar control de todas las pestañas
      })
  );
});

// ============================================================================
// FETCH: Estrategia de cache según tipo de recurso
// ============================================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests que no son GET
  if (request.method !== 'GET') {
    return;
  }

  // Ignorar requests a otros dominios (excepto fonts y CDNs conocidos)
  const allowedOrigins = [
    self.location.origin,
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://cdn.rawgit.com'
  ];

  if (!allowedOrigins.some(origin => request.url.startsWith(origin))) {
    return;
  }

  // API calls: Network Only (no cachear datos dinámicos)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/notifications')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Offline: devolver respuesta de error amigable para APIs
          return new Response(
            JSON.stringify({ error: 'offline', message: 'Sin conexión a internet' }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Assets estáticos (CSS, JS, imágenes, fonts): Cache First
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Actualizar cache en background (stale-while-revalidate)
            fetch(request)
              .then(response => {
                if (response && response.status === 200) {
                  caches.open(CACHE_NAME)
                    .then(cache => cache.put(request, response));
                }
              })
              .catch(() => { });
            return cachedResponse;
          }
          return fetch(request)
            .then(response => {
              if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(request, responseClone));
              }
              return response;
            });
        })
    );
    return;
  }

  // Páginas HTML: Network First con Cache Fallback
  if (request.headers.get('accept')?.includes('text/html') || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cachear la respuesta para uso offline
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Offline: intentar servir desde cache
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Si no está en cache, mostrar página offline
              return caches.match('/index.html');
            });
        })
    );
    return;
  }

  // Default: Network First
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ============================================================================
// HELPER: Determinar si es un asset estático
// ============================================================================
function isStaticAsset(pathname) {
  const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
  return staticExtensions.some(ext => pathname.endsWith(ext));
}

// ============================================================================
// PUSH NOTIFICATIONS (preparado para Firebase)
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
      // Intentar parsear como JSON
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      // Si falla (es texto plano), usar el texto como cuerpo del mensaje
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
// NOTIFICATION CLICK: Abrir la app al tocar la notificación
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
        // Si ya hay una ventana abierta, enfocarla
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Intentar navegar si la URL es diferente
            if (client.url !== urlToOpen) {
              client.navigate(urlToOpen).catch(err => console.warn('[SW] Navigation failed:', err));
            }
            return client.focus();
          }
        }
        // Si no hay ventana, abrir una nueva
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ============================================================================
// BACKGROUND SYNC (para enviar datos cuando vuelve la conexión)
// ============================================================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-notifications') {
    event.waitUntil(
      // Aquí se podría sincronizar notificaciones pendientes
      Promise.resolve()
    );
  }
});

console.log('[SW] Service Worker loaded - v' + CACHE_VERSION);
