const express = require('express');
const path = require('path');
const uploadRoutes = require('./uploadRoutes');

const router = express.Router();

// ============================================================================
// ENRUTADOR MAESTRO DE LA API (API GATEWAY INTERNO)
// ============================================================================
// Centraliza todas las rutas modulares de la aplicación para evitar engordar 
// el archivo server.js (evitando el anti-patrón del monolito).
// 
// Las rutas futuras extraídas del monolito deberán registrarse aquí.
// ============================================================================

// Servir la carpeta pública de archivos subidos (ej. imágenes de campañas)
// Así abstraemos la responsabilidad de servir estáticos fuera de server.js
router.use('/uploads', express.static(path.join(__dirname, '../../public/uploads')));

// Registrar rutas de subida de archivos (imágenes de campañas)
router.use('/upload', uploadRoutes);

// Exportar el enrutador central
module.exports = router;
