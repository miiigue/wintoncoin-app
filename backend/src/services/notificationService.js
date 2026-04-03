// ============================================================================
// WintonCoin — Push Notification Service (VAPID / Web Push)
// ============================================================================
// Estándar Fintech: Normalización de payloads, tipos validados con whitelist,
// contadores de entrega precisos, protección contra SQL injection,
// y verificación de configuración VAPID antes de cada envío.
// ============================================================================

const webpush = require('web-push');
const pool = require('../config/db');

// ============================================================================
// CONSTANTES Y CONFIGURACIÓN
// ============================================================================

// Whitelist de tipos de notificación permitidos (estándar fintech)
// SECURITY: nunca se puede bloquear por preferencias del usuario
// SOCIAL: interacciones entre usuarios (tareas, participaciones, mensajes)
// MARKETING: promociones, anuncios, campañas
// TRANSACTIONAL: pagos, cobros, movimientos de fondos
// GOVERNANCE: sistema Winton-Consensus (guardianes, votaciones)
const VALID_NOTIFICATION_TYPES = ['SECURITY', 'SOCIAL', 'MARKETING', 'TRANSACTIONAL', 'GOVERNANCE'];

// Tipos que NUNCA pueden ser bloqueados por preferencias del usuario
// En fintech/bancario, alertas de seguridad y transacciones son obligatorias
const MANDATORY_TYPES = ['SECURITY', 'TRANSACTIONAL'];

// Icono y badge por defecto (centralizado para consistencia visual)
const DEFAULT_ICON = '/assets/icons/icon-192x192.png';
const DEFAULT_BADGE = '/assets/icons/icon-72x72.png';
const DEFAULT_URL = '/contract_interaction.html';

// Flag interno para saber si VAPID fue configurado correctamente
let vapidInitialized = false;

// ============================================================================
// INICIALIZACIÓN VAPID
// ============================================================================

/**
 * Configura las credenciales VAPID para Web Push.
 * Se ejecuta una sola vez al cargar el módulo.
 * Si las claves no están en .env, marca el servicio como no disponible.
 */
function initializeWebPush() {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        console.error('[PUSH SERVICE] ALERTA CRÍTICA: Claves VAPID no configuradas en .env — Push deshabilitado');
        vapidInitialized = false;
        return;
    }

    try {
        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:admin@wintoncoin.com',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
        vapidInitialized = true;
        console.log('[PUSH SERVICE] VAPID inicializado correctamente');
    } catch (err) {
        console.error('[PUSH SERVICE] Error al inicializar VAPID:', err.message);
        vapidInitialized = false;
    }
}

// Ejecutar al cargar el módulo
initializeWebPush();

// ============================================================================
// UTILIDADES INTERNAS
// ============================================================================

/**
 * Verifica que VAPID esté configurado antes de intentar enviar.
 * Lanza error descriptivo si no está disponible.
 */
function assertVapidReady() {
    if (!vapidInitialized) {
        throw new Error('[PUSH SERVICE] VAPID no inicializado. Verifique VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en .env');
    }
}

/**
 * Valida y normaliza el tipo de notificación contra la whitelist.
 * Si el tipo no es válido, usa 'SOCIAL' como fallback seguro y loguea advertencia.
 * @param {string} type - Tipo recibido del caller
 * @returns {string} Tipo normalizado en MAYÚSCULAS
 */
function normalizeType(type) {
    const normalized = String(type || 'SOCIAL').toUpperCase().trim();
    if (!VALID_NOTIFICATION_TYPES.includes(normalized)) {
        console.warn(`[PUSH SERVICE] Tipo de notificación desconocido: "${type}" — Usando SOCIAL como fallback`);
        return 'SOCIAL';
    }
    return normalized;
}

/**
 * Normaliza el payload para garantizar que el Service Worker siempre reciba
 * una estructura consistente con `data.url` para la navegación al hacer click.
 *
 * PROBLEMA RESUELTO: Antes, algunos callers enviaban `url` en la raíz del
 * payload y otros dentro de `data: { url }`. El SW solo lee `data.url`,
 * así que las notificaciones con `url` en la raíz no navegaban correctamente.
 *
 * Esta función acepta ambos formatos y produce siempre el correcto.
 *
 * @param {Object} rawPayload - Payload crudo del caller
 * @returns {Object} Payload normalizado listo para webpush.sendNotification
 */
function normalizePayload(rawPayload) {
    if (!rawPayload || typeof rawPayload !== 'object') {
        return {
            title: 'WintonCoin',
            body: 'Tienes una nueva notificación',
            icon: DEFAULT_ICON,
            badge: DEFAULT_BADGE,
            data: { url: DEFAULT_URL }
        };
    }

    // Determinar la URL de navegación:
    // Prioridad 1: data.url (formato correcto)
    // Prioridad 2: url en raíz (formato legacy que se corrige aquí)
    // Prioridad 3: URL por defecto
    const navigationUrl = rawPayload.data?.url || rawPayload.url || DEFAULT_URL;

    // Generar tag único si no se provee uno explícito.
    // Sin tag único, el SW del navegador agrupa/reemplaza notificaciones con el mismo tag.
    // Resultado: si llegan 2 notificaciones seguidas, la segunda sobrescribe la primera.
    // Con tag único, cada notificación se muestra independientemente en el dispositivo.
    const tag = rawPayload.tag || `wintoncoin-${Date.now()}`;

    return {
        title: rawPayload.title || 'WintonCoin',
        body: rawPayload.body || 'Tienes una nueva notificación',
        icon: rawPayload.icon || DEFAULT_ICON,
        badge: rawPayload.badge || DEFAULT_BADGE,
        tag,
        data: { url: navigationUrl }
    };
}

/**
 * Determina si una notificación debe enviarse según las preferencias del usuario.
 * Regla fintech: SECURITY y TRANSACTIONAL nunca se bloquean.
 *
 * @param {Object} preferences - JSONB de preferencias del usuario
 * @param {string} type - Tipo normalizado de notificación
 * @returns {boolean} true si debe enviarse
 */
function shouldSendByPreference(preferences, type) {
    // Tipos obligatorios: siempre se envían (estándar bancario)
    if (MANDATORY_TYPES.includes(type)) {
        return true;
    }

    // Para tipos opcionales, verificar preferencia explícita del usuario
    const prefs = preferences || {};
    const typeKey = type.toLowerCase();

    // Solo bloquear si el usuario explícitamente desactivó (=== false)
    // undefined o true = permitido (opt-out model, estándar de la industria)
    return prefs[typeKey] !== false;
}

// ============================================================================
// API PÚBLICA
// ============================================================================

/**
 * Retorna la clave pública VAPID para que el frontend configure PushManager.
 * @returns {string} Clave pública VAPID en base64url
 * @throws {Error} Si las claves no están configuradas
 */
const getVapidPublicKey = () => {
    if (!process.env.VAPID_PUBLIC_KEY) {
        throw new Error('Servidor no configurado para notificaciones push');
    }
    return process.env.VAPID_PUBLIC_KEY;
};

/**
 * Guarda o actualiza la suscripción push de un usuario en la base de datos.
 * Usa UPSERT por endpoint (cada endpoint es único por dispositivo/navegador).
 *
 * @param {number} userId - ID del usuario
 * @param {Object} subscription - Objeto PushSubscription del navegador
 * @param {string} userAgent - User-Agent del navegador (para diagnóstico)
 * @returns {Object} { success: true }
 * @throws {Error} Si el objeto de suscripción es inválido o hay error de BD
 */
const saveSubscription = async (userId, subscription, userAgent) => {
    // Validación estricta del objeto de suscripción
    if (!subscription || !subscription.endpoint || !subscription.keys) {
        throw new Error('Objeto de suscripción inválido: faltan endpoint o keys');
    }

    if (!subscription.keys.p256dh || !subscription.keys.auth) {
        throw new Error('Objeto de suscripción inválido: faltan claves criptográficas p256dh o auth');
    }

    const { endpoint, keys } = subscription;

    // UPSERT: si el endpoint ya existe, actualiza las claves y el user_id
    // Esto maneja el caso donde un dispositivo cambia de usuario (re-login)
    const query = `
        INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth, user_agent)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (endpoint)
        DO UPDATE SET
            user_id = EXCLUDED.user_id,
            keys_p256dh = EXCLUDED.keys_p256dh,
            keys_auth = EXCLUDED.keys_auth,
            created_at = CURRENT_TIMESTAMP
        RETURNING id
    `;

    try {
        await pool.query(query, [userId, endpoint, keys.p256dh, keys.auth, userAgent]);
        return { success: true };
    } catch (error) {
        console.error('[PUSH SERVICE] Error al guardar suscripción:', error.message);
        throw new Error('Error de base de datos al guardar suscripción');
    }
};

/**
 * Envía una notificación push a TODOS los dispositivos suscritos de un usuario.
 *
 * Normaliza el payload automáticamente para garantizar que `data.url` siempre
 * esté presente (resuelve el bug histórico de `url` en raíz vs `data.url`).
 *
 * Respeta preferencias del usuario excepto para tipos MANDATORY (SECURITY, TRANSACTIONAL).
 *
 * @param {number} userId - ID del usuario destino
 * @param {Object} rawPayload - Payload (se normaliza internamente)
 * @param {string} [type='SOCIAL'] - Tipo de notificación (ver VALID_NOTIFICATION_TYPES)
 * @returns {Object} { sent: N, failed: N, message?: string }
 */
const sendNotificationToUser = async (userId, rawPayload, type = 'SOCIAL') => {
    try {
        // Verificar que VAPID esté configurado
        assertVapidReady();

        // Normalizar tipo y payload antes de procesar
        const normalizedType = normalizeType(type);
        const payload = normalizePayload(rawPayload);

        // Obtener suscripciones del usuario junto con sus preferencias
        const query = `
            SELECT ps.id, ps.endpoint, ps.keys_p256dh, ps.keys_auth,
                   u.notification_preferences
            FROM push_subscriptions ps
            JOIN users u ON ps.user_id = u.id
            WHERE ps.user_id = $1
        `;
        const result = await pool.query(query, [userId]);

        // Sin dispositivos suscritos: retorno silencioso (no es error)
        if (result.rows.length === 0) {
            return { sent: 0, failed: 0, message: 'Usuario sin dispositivos suscritos' };
        }

        // Verificar preferencias del usuario antes de enviar
        const userPrefs = result.rows[0].notification_preferences || {};
        if (!shouldSendByPreference(userPrefs, normalizedType)) {
            console.log(`[PUSH SERVICE] Notificación ${normalizedType} bloqueada por preferencia del usuario ${userId}`);
            return { sent: 0, failed: 0, message: 'Filtrada por preferencias del usuario' };
        }

        // Enviar a todos los dispositivos del usuario en paralelo
        const payloadString = JSON.stringify(payload);
        let successCount = 0;
        let failCount = 0;

        const promises = result.rows.map(async (sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth }
            };

            try {
                await webpush.sendNotification(pushSubscription, payloadString);
                successCount++;
            } catch (err) {
                failCount++;
                // HTTP 410 Gone o 404 Not Found = suscripción expirada/inválida
                // Limpieza automática: eliminar de la BD para no reintentar
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id])
                        .catch(dbErr => console.error('[PUSH SERVICE] Error limpiando suscripción expirada:', dbErr.message));
                } else {
                    console.error(`[PUSH SERVICE] Error enviando push a dispositivo ${sub.id}:`, err.message);
                }
            }
        });

        await Promise.allSettled(promises);

        return { sent: successCount, failed: failCount };

    } catch (error) {
        console.error('[PUSH SERVICE] Error en sendNotificationToUser:', error.message);
        return { sent: 0, failed: 0, error: error.message };
    }
};

/**
 * Envía una notificación push masiva (Broadcast) a TODOS los usuarios suscritos.
 *
 * Características:
 * - Normaliza payload automáticamente
 * - Usa query parametrizada para evitar SQL injection
 * - Procesa en lotes para no saturar recursos
 * - Limpia automáticamente suscripciones expiradas (410/404)
 * - Contadores de entrega precisos (solo cuenta éxitos reales)
 *
 * @param {Object} rawPayload - Payload (se normaliza internamente)
 * @param {string} [type='SOCIAL'] - Tipo de notificación
 * @param {number} [batchSize=50] - Tamaño del lote de procesamiento paralelo
 * @returns {Object} { sent: N, failed: N, total: N }
 */
const sendNotificationToAll = async (rawPayload, type = 'SOCIAL', batchSize = 50) => {
    try {
        // Verificar que VAPID esté configurado
        assertVapidReady();

        // Normalizar tipo y payload
        const normalizedType = normalizeType(type);
        const payload = normalizePayload(rawPayload);

        console.log(`[PUSH BROADCAST] Iniciando broadcast. Tipo: ${normalizedType}`);

        // Query parametrizada para evitar SQL injection
        // Antes se concatenaba typeKey directamente en el SQL — vulnerabilidad corregida
        let query;
        let queryParams;

        if (MANDATORY_TYPES.includes(normalizedType)) {
            // Para tipos obligatorios, enviar a TODOS sin filtrar preferencias
            query = 'SELECT ps.id, ps.endpoint, ps.keys_p256dh, ps.keys_auth FROM push_subscriptions ps JOIN users u ON ps.user_id = u.id';
            queryParams = [];
        } else {
            // Para tipos opcionales, filtrar por preferencias del usuario
            // Usa parametrización segura en lugar de concatenación de strings
            query = `
                SELECT ps.id, ps.endpoint, ps.keys_p256dh, ps.keys_auth
                FROM push_subscriptions ps
                JOIN users u ON ps.user_id = u.id
                WHERE COALESCE((u.notification_preferences->>$1)::boolean, TRUE) = TRUE
            `;
            queryParams = [normalizedType.toLowerCase()];
        }

        const result = await pool.query(query, queryParams);
        const total = result.rows.length;

        console.log(`[PUSH BROADCAST] Suscripciones elegibles: ${total}`);

        if (total === 0) {
            return { sent: 0, failed: 0, total: 0 };
        }

        let successCount = 0;
        let failCount = 0;
        const payloadString = JSON.stringify(payload);

        // Procesar en lotes para no saturar conexiones simultáneas
        for (let i = 0; i < total; i += batchSize) {
            const chunk = result.rows.slice(i, i + batchSize);

            const promises = chunk.map(async (sub) => {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth }
                };

                try {
                    await webpush.sendNotification(pushSubscription, payloadString);
                    successCount++;
                } catch (err) {
                    failCount++;
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id])
                            .catch(dbErr => console.error('[PUSH BROADCAST] Error limpiando suscripción expirada:', dbErr.message));
                    }
                }
            });

            await Promise.all(promises);
            console.log(`[PUSH BROADCAST] Lote ${Math.floor(i / batchSize) + 1} procesado. Acumulado: ${successCount} éxitos, ${failCount} fallos`);
        }

        console.log(`[PUSH BROADCAST] Finalizado. ÉXITOS: ${successCount}, FALLOS: ${failCount}, TOTAL: ${total}`);
        return { sent: successCount, failed: failCount, total };

    } catch (error) {
        console.error('[PUSH BROADCAST] Error crítico:', error.message);
        throw error;
    }
};

/**
 * Obtiene las preferencias de notificación de un usuario.
 * Retorna valores por defecto si el usuario no tiene preferencias guardadas.
 *
 * @param {number} userId - ID del usuario
 * @returns {Object} Objeto con las preferencias (security siempre true)
 */
const getUserPreferences = async (userId) => {
    const result = await pool.query('SELECT notification_preferences FROM users WHERE id = $1', [userId]);
    return result.rows[0]?.notification_preferences || {
        security: true,
        social: true,
        marketing: true,
        transactional: true,
        governance: true
    };
};

/**
 * Actualiza las preferencias de notificación de un usuario.
 * REGLA FINTECH: `security` y `transactional` SIEMPRE son true (inmutables por el usuario).
 *
 * @param {number} userId - ID del usuario
 * @param {Object} newPrefs - Nuevas preferencias (solo social, marketing, governance son editables)
 * @returns {Object} Preferencias guardadas (normalizadas)
 */
const updateUserPreferences = async (userId, newPrefs) => {
    // Obtener preferencias actuales para merge seguro (no perder datos)
    const currentPrefs = await getUserPreferences(userId);

    // Merge: solo actualizar campos que el usuario puede controlar
    // SECURITY y TRANSACTIONAL se fuerzan a true (estándar bancario: no desactivables)
    const cleanPrefs = {
        security: true,
        transactional: true,
        social: newPrefs?.social !== undefined ? !!newPrefs.social : currentPrefs.social,
        marketing: newPrefs?.marketing !== undefined ? !!newPrefs.marketing : currentPrefs.marketing,
        governance: newPrefs?.governance !== undefined ? !!newPrefs.governance : currentPrefs.governance
    };

    await pool.query('UPDATE users SET notification_preferences = $1 WHERE id = $2', [cleanPrefs, userId]);
    return cleanPrefs;
};

// ============================================================================
// EXPORTACIONES
// ============================================================================

module.exports = {
    getVapidPublicKey,
    saveSubscription,
    getUserPreferences,
    updateUserPreferences,
    sendNotificationToUser,
    sendNotificationToAll,
    // Exponer constantes para que otros módulos puedan validar
    VALID_NOTIFICATION_TYPES,
    MANDATORY_TYPES
};
