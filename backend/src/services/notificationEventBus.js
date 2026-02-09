const EventEmitter = require('events');
const notificationService = require('./notificationService');
const pool = require('../config/db');

class NotificationEventBus extends EventEmitter { }
const eventBus = new NotificationEventBus();

// --- DEFINICIÓN DE EVENTOS DEL SISTEMA ---
// Centralizamos aquí toda la lógica de "Qué pasa cuando X ocurre"
// Esto desacopla el código de negocio del código de notificación.

// 1. TAREA/PUBLICACIÓN CREADA (Opcional: Solo si se quiere notificar a seguidores o admin)
// eventBus.on('PUBLICATION_CREATED', async (data) => { ... });

// 2. SOLICITUD DE PARTICIPACIÓN (Al dueño de la publicación)
eventBus.on('PARTICIPATION_REQUESTED', async ({ publicationId, publicationTitle, ownerId, applicantUsername }) => {
    try {
        await notificationService.sendNotificationToUser(ownerId, {
            title: 'Nueva Solicitud',
            body: `${applicantUsername} quiere realizar tu tarea: "${publicationTitle}"`,
            icon: '/assets/icons/icon-192x192.png',
            data: { url: `/publication.html?id=${publicationId}` } // Lleva directo a la publicación
        });
    } catch (err) {
        console.error('[EVENT-BUS] Error en PARTICIPATION_REQUESTED:', err);
    }
});

// 3. SOLICITUD ACEPTADA (Al participante)
eventBus.on('PARTICIPATION_ACCEPTED', async ({ publicationId, publicationTitle, participantId }) => {
    try {
        await notificationService.sendNotificationToUser(participantId, {
            title: '¡Solicitud Aceptada!',
            body: `Puedes comenzar la tarea: "${publicationTitle}"`,
            icon: '/assets/icons/icon-192x192.png',
            data: { url: `/publication.html?id=${publicationId}` }
        });
    } catch (err) {
        console.error('[EVENT-BUS] Error en PARTICIPATION_ACCEPTED:', err);
    }
});

// 4. TAREA COMPLETADA/ENTREGADA (Al dueño, para que revise)
eventBus.on('TASK_DELIVERED', async ({ publicationId, publicationTitle, ownerId, participantUsername }) => {
    try {
        await notificationService.sendNotificationToUser(ownerId, {
            title: 'Tarea Entregada',
            body: `${participantUsername} ha marcado "${publicationTitle}" como completada. ¡Revisa y paga!`,
            icon: '/assets/icons/icon-192x192.png',
            data: { url: `/publication.html?id=${publicationId}` }
        });
    } catch (err) {
        console.error('[EVENT-BUS] Error en TASK_DELIVERED:', err);
    }
});

// 5. TAREA PAGADA (Al participante)
eventBus.on('TASK_PAID', async ({ publicationId, publicationTitle, participantId, amount }) => {
    try {
        await notificationService.sendNotificationToUser(participantId, {
            title: '¡Pago Recibido!',
            body: `Has recibido ${amount} BLUE por la tarea "${publicationTitle}".`,
            icon: '/assets/icons/icon-192x192.png',
            data: { url: '/contract_interaction.html' } // Lleva a la billetera/historial
        });
    } catch (err) {
        console.error('[EVENT-BUS] Error en TASK_PAID:', err);
    }
});

// 6. MENSAJE P2P / CHAT (Al receptor)
eventBus.on('P2P_MESSAGE_RECEIVED', async ({ orderId, receiverId, senderUsername, messagePreview }) => {
    try {
        await notificationService.sendNotificationToUser(receiverId, {
            title: `Mensaje de ${senderUsername}`,
            body: messagePreview || 'Tienes un nuevo mensaje en la orden P2P.',
            icon: '/assets/icons/icon-192x192.png',
            data: { url: `/p2p/orders/${orderId}` } // ¡Importante! URL dinámica a la orden específica (si soportas rutas así en frontend)
            // Si tu frontend usa HashRouter o Query params: data: { url: `/p2p-order.html?id=${orderId}` }
        });
    } catch (err) {
        console.error('[EVENT-BUS] Error en P2P_MESSAGE_RECEIVED:', err);
    }
});

// 7. SEGURIDAD: NUEVO LOGIN (Al usuario)
eventBus.on('SECURITY_LOGIN_ALERT', async ({ userId, ip, device }) => {
    // Implementar lógica para no spammear (ej: solo si es IP nueva)
    // Por ahora, simple alerta
    try {
        await notificationService.sendNotificationToUser(userId, {
            title: 'Nuevo Inicio de Sesión',
            body: `Detectamos un acceso desde ${device} (${ip}). Si no fuiste tú, revisa tu seguridad.`,
            icon: '/assets/icons/icon-192x192.png',
            data: { url: '/profile.html' }
        });
    } catch (err) {
        console.error('[EVENT-BUS] Error en SECURITY_LOGIN_ALERT:', err);
    }
});

// 8. P2P: ORDEN CREADA (A los usuarios relevantes o "Makers" que coincidan - Lógica avanzada para futuro)
// eventBus.on('P2P_ORDER_CREATED', ...);

// 9. P2P: ORDEN TOMADA/MATCH (Al creador de la orden)
eventBus.on('P2P_ORDER_TAKEN', async ({ orderId, ownerId, takerUsername, type }) => {
    const action = type === 'buy' ? 'comprar tus' : 'venderte';
    try {
        await notificationService.sendNotificationToUser(ownerId, {
            title: 'Orden P2P Actualizada',
            body: `${takerUsername} quiere ${action} BLUE. Revisa la orden #${orderId}.`,
            icon: '/assets/icons/icon-192x192.png',
            data: { url: `/p2p-order.html?id=${orderId}` } // Ajustar a tu ruta real
        });
    } catch (err) {
        console.error('[EVENT-BUS] Error en P2P_ORDER_TAKEN:', err);
    }
});


module.exports = eventBus;
