const express = require('express');
const router = express.Router();
const academyController = require('../controllers/academyController');
const { authenticateAdmin } = require('../middleware/authMiddleware');

// ============================================
// RUTAS PUBLICAS WINTON ACADEMY
// ============================================
router.get('/public', academyController.getPublicVideos);

// ============================================
// RUTAS PROTEGIDAS DEL ADMIN PANEL
// ============================================
// Aplicamos el middleware que verifica que exista el admin_token y que el rol = ADMIN
router.use(authenticateAdmin);

router.get('/all', academyController.getAllVideos); // Listado de todos para la tabla del admin
router.post('/add', academyController.createVideo); // Agrega un nuevo video parseando la url de YouTube
router.put('/:id/status', academyController.updateVideoStatus); // Ocultar o cambiar orden
router.delete('/:id', academyController.deleteVideo); // Borrado físico

module.exports = router;
