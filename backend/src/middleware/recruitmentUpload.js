/**
 * Recruitment Upload Middleware - Winton Smart-Contract
 * 
 * Configura Multer para la subida segura de CVs.
 * - Validación estricta de extensiones (Solo .pdf).
 * - Limitación de tamaño (5MB).
 * - Renombrado criptográfico para evitar Path Traversal.
 */

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// 1. Asegurar que el directorio de destino existe
const uploadDir = path.join(__dirname, '../../uploads/recruitment');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Configuración de almacenamiento
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generar nombre de archivo único para seguridad bancaria
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        cb(null, `cv_${Date.now()}_${uniqueSuffix}.pdf`);
    }
});

// 3. Filtro de archivos (Solo PDF)
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf' || file.mimetype !== 'application/pdf') {
        return cb(new Error('Solo se permiten archivos en formato PDF.'), false);
    }
    cb(null, true);
};

// 4. Exportar el middleware configurado (límite 5MB)
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 Megabytes
    }
});

module.exports = upload;
