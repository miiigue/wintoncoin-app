const express = require('express');
const multer = require('multer');
const { authenticateUserOrAdmin } = require('../middleware/authMiddleware');
const mediaController = require('../controllers/mediaController');

const router = express.Router();

// ============================================================================
// CONFIGURACIÓN DE MULTER (MEMORY STORAGE) - Seguridad FinTech
// ============================================================================
// Los archivos se guardan en RAM temporalmente para ser pasados a Sharp.
// Límite estricto de 10MB por archivo crudo para evitar Heap OOM (Out Of Memory).
// ============================================================================

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Validar mimetypes estrictamente (anti-webshells)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/heic'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Formato de archivo inválido. Solo se permiten imágenes (JPG, PNG, WebP).'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 Megabytes de límite para el archivo original
    },
    fileFilter: fileFilter
});

// Middleware atrapa-errores de Multer
const multerErrorHandler = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'Una de las imágenes excede el límite de peso inicial de 10MB.' });
        }
        return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next();
};

// ============================================================================
// RUTAS DE MEDIOS
// ============================================================================
// Protegido por JWT. Acepta hasta 5 imágenes concurrentes en una sola llamada.
// ============================================================================

router.post(
    '/upload', 
    authenticateUserOrAdmin, // Permite que tanto usuarios comunes como administradores suban imágenes
    upload.array('images', 5), // 'images' es el nombre del campo FormData, máx 5
    multerErrorHandler,
    mediaController.uploadImages
);

module.exports = router;
