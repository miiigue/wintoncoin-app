// Cargar variables de entorno de forma dinámica y centralizada
require('../config');

const pool = require('../src/config/db');
const notificationService = require('../src/services/notificationService');

async function main() {
    const username = process.argv[2];

    if (!username) {
        console.error('Uso: node check-push.js <username>');
        process.exit(1);
    }

    console.log(`[TEST] Buscando usuario: ${username}`);

    try {
        // 1. Obtener ID del usuario
        // Nota: Podríamos mover esto a un servicio de usuarios, pero por ahora está bien aquí
        const res = await pool.query('SELECT id FROM users WHERE username = $1', [username]);

        if (res.rows.length === 0) {
            console.error('[ERROR] Usuario no encontrado.');
            process.exit(1);
        }

        const userId = res.rows[0].id;
        console.log(`[TEST] ID encontrado: ${userId}`);

        // 2. Enviar notificación usando el servicio profesional
        console.log('[TEST] Enviando notificación...');

        const result = await notificationService.sendNotificationToUser(userId, {
            title: 'WintonCoin Admin',
            body: `Hola ${username}, esta es una prueba desde el script de mantenimiento.`,
            icon: '/assets/icons/icon-192x192.png',
            data: { url: '/contract_interaction.html' }
        });

        console.log('---------------------------------------------------');
        console.log(`Resultado: ${result.sent} enviados.`);

        if (result.error) {
            console.error('[ERROR] Hubo problemas:', result.error);
        } else if (result.sent === 0) {
            console.warn('[WARN] No se envió nada (¿Usuario sin suscripciones?)');
        } else {
            console.log('¡ÉXITO! Notificación despachada.');
        }

    } catch (error) {
        console.error('[CRITICAL] Error inesperado:', error);
    } finally {
        // Cerrar conexión a DB
        await pool.end();
    }
}

main();
