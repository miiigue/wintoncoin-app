const express = require('express');
const router = express.Router();

// Middlewares
const { authenticateToken: verifyUserToken } = require('../middleware/authMiddleware');
const { verifyAdminToken } = require('../middleware/adminAuthMiddleware');
const { requireAcceptedLegalForAuthenticatedUser } = require('../middleware/legalAcceptanceMiddleware');

// Controladores
const p2pController = require('../controllers/p2pController');

// Rutas de Ofertas
router.get('/api/p2p/payment-methods', verifyUserToken, p2pController.getPaymentMethods);
router.post('/api/p2p/offers', verifyUserToken, requireAcceptedLegalForAuthenticatedUser(), p2pController.createOffer);
router.get('/api/p2p/offers', verifyUserToken, p2pController.getOffers);
router.get('/api/p2p/offers/mine', verifyUserToken, p2pController.getMyOffers);

// Rutas de Órdenes
router.post('/api/p2p/orders', verifyUserToken, requireAcceptedLegalForAuthenticatedUser(), p2pController.createOrder);
router.get('/api/p2p/orders', verifyUserToken, p2pController.getOrders);
router.post('/api/p2p/orders/:id/mark-paid', verifyUserToken, requireAcceptedLegalForAuthenticatedUser(), p2pController.markOrderPaid);
router.post('/api/p2p/orders/:id/release', verifyUserToken, requireAcceptedLegalForAuthenticatedUser(), p2pController.releaseOrder);
router.post('/api/p2p/orders/:id/cancel', verifyUserToken, requireAcceptedLegalForAuthenticatedUser(), p2pController.cancelOrder);
router.post('/api/p2p/orders/:id/request-extension', verifyUserToken, requireAcceptedLegalForAuthenticatedUser(), p2pController.requestExtension);
router.post('/api/p2p/orders/:id/dispute', verifyUserToken, requireAcceptedLegalForAuthenticatedUser(), p2pController.disputeOrder);
router.post('/api/p2p/orders/:id/rate', verifyUserToken, requireAcceptedLegalForAuthenticatedUser(), p2pController.rateOrder);

// Rutas de Administrador
router.post('/api/admin/p2p/disputes/:id/resolve', verifyAdminToken, p2pController.resolveDisputeAdmin);

module.exports = router;
