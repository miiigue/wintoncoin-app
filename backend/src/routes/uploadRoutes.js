const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadController = require('../controllers/uploadController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

// ============================================================================
// CONFIGURACIÓN DE MULTER (SEGURIDAD FINTECH)
// ============================================================================
// Solo permitimos imágenes. Límite de 2MB para evitar saturación de storage.
// ============================================================================

// Asegurar que el directorio de campañas exista
const uploadDir = path.join(__dirname, '../../public/uploads/campaigns');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generar un nombre de archivo único, seguro e impredecible (prevención de sobrescritura/traversal)
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'campaign-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    // Validar extensiones de imagen permitidas de forma estricta
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Formato de archivo inválido. Solo se permiten JPG, PNG y WebP.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2 Megabytes
    },
    fileFilter: fileFilter
});

// Middleware para atrapar errores de multer limpiamente
const multerErrorHandler = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'La imagen excede el límite de 2MB.' });
        }
        return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next();
};

// ============================================================================
// RUTAS
// ============================================================================
// Todas las subidas están protegidas; requieren autenticación y rol de admin.
// ============================================================================

router.post(
    '/campaign-image', 
    verifyToken, 
    verifyAdmin, 
    upload.single('image'), 
    multerErrorHandler,
    uploadController.uploadCampaignImage
);

module.exports = router;
