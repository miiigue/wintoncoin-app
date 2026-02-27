// ============================================================================
// src/routes/publicationRoutes.js
// ============================================================================

const express = require('express');
const publicationController = require('../controllers/publicationController');

module.exports = function(pool, requireAcceptedLegalByUsernameField, verifyAdminToken, logAuditEvent) {
    const router = express.Router();
    publicationController(router, pool, requireAcceptedLegalByUsernameField, verifyAdminToken, logAuditEvent);
    return router;
};
