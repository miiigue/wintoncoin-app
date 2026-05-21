// ============================================================================
// WintonCoin - Transaction Routes (Enrutamiento de Transacciones)
// ============================================================================
// Define la asignación de rutas Express para el módulo de consulta de transacciones.
// Utiliza una arquitectura de factoría (Factory Pattern) para inyectar los
// middlewares de seguridad definidos en el nucleo del servidor (server.js).
//
// NOTA: Este Router se registra en server.js de la siguiente forma:
//   const createTransactionRouter = require('./src/routes/transactionRoutes');
//   app.use('/', createTransactionRouter(verifyUserToken));
// ============================================================================

'use strict';

const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

/**
 * Constructor del enrutador de transacciones.
 * Inyecta las dependencias de control de tokens para mantener el desacoplamiento.
 * 
 * @param {function} verifyUserToken - Middleware global de autenticación de tokens JWT
 * @returns {express.Router} El router configurado
 */
function createTransactionRouter(verifyUserToken) {
    
    // --- RUTA PROFESIONAL (Basada en JWT/userId) ---
    // Mapea a la obtención de transacciones filtradas por el ID del token.
    // Aplicamos el middleware verifyUserToken específicamente a esta ruta para evitar colisiones globales.
    router.get('/api/me/transactions', verifyUserToken, transactionController.getMyTransactions);
 
    // --- RUTA LEGACY (Basada en parámetros de URL) ---
    // Mapea al método legacy manteniendo compatibilidad con posibles llamadas antiguas del frontend/móvil.
    // Aplicamos el middleware verifyUserToken específicamente a esta ruta.
    router.get('/users/:username/transactions', verifyUserToken, transactionController.getUserTransactionsLegacy);
 
    return router;
}

module.exports = createTransactionRouter;
//
