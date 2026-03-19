/**
 * Recruitment Routes - Winton Talent Portal
 * 
 * Expone el endpoint para recibir postulaciones externas.
 * - Registro de auditoría.
 * - Validación de archivos.
 * - Protección contra ataques XSS.
 */

const express = require('express');
const router = express.Router();
const recruitmentController = require('../controllers/recruitmentController');
const upload = require('../middleware/recruitmentUpload');

/**
 * @route   POST /api/recruitment/apply
 * @desc    Registra una postulación con archivo CV (PDF)
 * @access  Public (se registra IP para auditoría)
 */
router.post('/apply', 
    upload.single('cv'), // Procesa un solo archivo con la llave 'cv'
    recruitmentController.submitApplication
);

module.exports = router;
