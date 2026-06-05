const express = require('express');
const router = express.Router();
const minorController = require('../controllers/minorController');
const { requireAcceptedLegalByUsernameField } = require('../middleware/legalAcceptanceMiddleware');

// ============================================================================
// RUTAS LEGALES PARA CUENTAS DE MENORES
// ============================================================================

// POST /api/minor/add-tutor
// Seguridad Legal: Exige que el menor haya aceptado los TyC antes de proceder
router.post(
    '/add-tutor',
    requireAcceptedLegalByUsernameField(['minorUsername']),
    minorController.addTutor
);

module.exports = router;
