import { getApiUrl } from './config.js';

const API_URL = getApiUrl();

/**
 * Registra las notificaciones push si el navegador lo soporta y el usuario acepta.
 */
/**
 * Registra las notificaciones push de manera resiliente (Auto-Reparación).
 * Estándar Fintech: Sincronización en cada carga y manejo de cambios de suscripción.
 */
export async function registerPushNotifications() {
    console.log('[PUSH] Inicializando motor de notificaciones resiliente...');

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('[PUSH] Notificaciones push no soportadas en este navegador');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;

        // 1. Verificar estado actual
        let subscription = await registration.pushManager.getSubscription();

        // 2. Si no hay suscripción, intentar suscribir (si el usuario ya dio permiso o nunca se le preguntó)
        if (!subscription) {
            // Solo intentar si no está explícitamente denegado
            if (Notification.permission !== 'denied') {
                console.log('[PUSH] No hay suscripción activa, intentando crear nueva...');
                subscription = await subscribeUser(registration);
            }
        } else {
            // 3. Si YA existe, verificar si es necesario "refrescarla" en el servidor
            // (Auto-Reparación Capa 1: Sincronización Silenciosa)
            console.log('[PUSH] Suscripción local detectada, sincronizando con servidor...');
            await sendSubscriptionToServer(subscription);
        }

    } catch (e) {
        console.error('[PUSH] Error crítico en gestor de notificaciones:', e);
    }
}

/**
 * Función helper para realizar la suscripción técnica a VAPID
 */
async function subscribeUser(registration) {
    try {
        // CRÍTICO: Solicitar permiso explícitamente ANTES de suscribir
        // Esto es necesario en navegadores móviles (Chrome Android, Safari iOS)
        if (Notification.permission === 'default') {
            console.log('[PUSH] Solicitando permiso de notificaciones al usuario...');
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.warn('[PUSH] Usuario rechazó el permiso de notificaciones');
                return null;
            }
        }

        const response = await fetch(`${API_URL}/notifications/vapid-public-key`);
        if (!response.ok) throw new Error('Error obteniendo VAPID key');
        const { publicKey } = await response.json();

        if (!publicKey) throw new Error('VAPID key vacía del servidor');

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        console.log('[PUSH] Nueva suscripción criptográfica generada.');
        await sendSubscriptionToServer(subscription);
        return subscription;

    } catch (error) {
        console.error('[PUSH] Fallo al suscribir usuario:', error);
        return null;
    }
}

/**
 * Envía la suscripción al Backend para guardarla/actualizarla.
 * Maneja internamente la autenticación.
 * 
 * CRÍTICO: Si el usuario NO está logueado, guarda la suscripción localmente
 * para sincronizarla cuando haga login (UX estándar de PWAs).
 */
async function sendSubscriptionToServer(subscription) {
    if (!subscription) return;

    try {
        // Obtener token (soporte para ambos storages por si acaso)
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');

        // Si no hay token, GUARDAR LOCALMENTE para sincronizar después
        if (!token) {
            console.log('[PUSH] Usuario no logueado, guardando suscripción localmente para sincronización diferida...');
            localStorage.setItem('pendingPushSubscription', JSON.stringify(subscription));
            return;
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(`${API_URL}/notifications/subscribe`, {
            method: 'POST',
            body: JSON.stringify({
                subscription,
                userAgent: navigator.userAgent,
                // Metadata extra para debugging
                platform: navigator.platform,
                language: navigator.language
            }),
            headers: headers
        });

        if (!response.ok) {
            // Si el servidor dice 401/403, el token expiró. No podemos hacer nada.
            if (response.status === 401) console.warn('[PUSH] Token expirado al sincronizar.');
            throw new Error(`Server status: ${response.status}`);
        }

        console.log('✅ [PUSH] Sincronización con servidor completada.');

    } catch (error) {
        console.error('[PUSH] Fallo al enviar al servidor:', error);
    }
}

/**
 * Utilidad conversora VAPID key
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Sincroniza una suscripción pendiente que fue guardada antes del login.
 * Esta función debe ser llamada DESPUÉS de que el usuario se loguee exitosamente.
 * 
 * Estándar de la industria: Las PWAs deben poder solicitar permisos ANTES del login,
 * y sincronizar automáticamente cuando el usuario se autentica.
 */
export async function syncPendingPushSubscription() {
    try {
        const pendingSubscription = localStorage.getItem('pendingPushSubscription');

        if (!pendingSubscription) {
            console.log('[PUSH] No hay suscripción pendiente para sincronizar.');
            return;
        }

        console.log('[PUSH] Detectada suscripción pendiente, sincronizando con servidor...');

        const subscription = JSON.parse(pendingSubscription);
        await sendSubscriptionToServer(subscription);

        // Limpiar después de sincronizar exitosamente
        localStorage.removeItem('pendingPushSubscription');
        console.log('[PUSH] ✅ Suscripción pendiente sincronizada exitosamente.');

    } catch (error) {
        console.error('[PUSH] Error sincronizando suscripción pendiente:', error);
        // No eliminamos la suscripción pendiente para reintentar después
    }
}
