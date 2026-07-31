const express = require('express');
const router = express.Router();
const SystemController = require('../controllers/systemController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { web3RpcLimiter } = require('../middleware/rateLimiters');

// Alias para verifyUserToken
const verifyUserToken = authenticateToken;

// ==========================================
// RUTAS DE SISTEMA Y CONFIGURACIÓN PÚBLICA
// ==========================================

// 1. Obtener info de Smart Contracts (Seguro y Cacheado)
router.get('/contracts/info', web3RpcLimiter, verifyUserToken, SystemController.getContractsInfo);

// 2. Obtener configuración de referidos (Público)
router.get('/referral-settings', SystemController.getReferralSettings);

// 3. Obtener fecha de vigencia de códigos de referido (Público)
router.get('/referral-expiry-date', SystemController.getReferralExpiryDate);

// 4. Lista de Obligaciones Vencidas (LOVE) (Público)
router.get('/love-list', SystemController.getLoveList);

// 5. Configuración pública de la app (Público)
router.get('/app-settings', SystemController.getAppSettings);

// 6. Configuración pública básica (Público, requerido por frontend / publicación)
router.get('/settings', SystemController.getPublicSettings);

// 7. Configuración de plataforma de lanzamiento (Público, requerido por frontend / publicación)
router.get('/platform-settings', SystemController.getPlatformSettings);

// 8. Configuración pública legacy (Público, requerido por suite de pruebas de publicación)
router.get('/public-settings', SystemController.getAppSettings);

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const victimUploadDir = path.join(__dirname, '../../public/uploads/victims');
if (!fs.existsSync(victimUploadDir)) {
    fs.mkdirSync(victimUploadDir, { recursive: true });
}

const victimStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, victimUploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'evidence-' + uniqueSuffix + ext);
    }
});

const victimUpload = multer({
    storage: victimStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/heic'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Formato de imagen no soportado. Permite JPG, PNG, WebP o HEIC.'));
        }
    }
});

const victimController = require('../controllers/victimController');

// 10. Registro, Verificación OTP y Subida de Fotos de Damnificados SOS Venezuela
router.post('/public/sos-venezuela/register-victim', victimController.registerVictimPublic);
router.post('/public/sos-venezuela/verify-otp', victimController.verifyVictimOtpPublic);
router.post('/public/sos-venezuela/upload-evidence', victimUpload.array('images', 5), victimController.uploadEvidencePublic);

module.exports = router;
