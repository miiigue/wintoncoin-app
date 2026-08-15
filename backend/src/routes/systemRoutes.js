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

// 3.1 Verificar código de referido en tiempo real (Público/Admin - Soporta ambos prefijos por compatibilidad)
router.get('/verify-referral-code', SystemController.verifyReferralCode);
router.get('/system/verify-referral-code', SystemController.verifyReferralCode);

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

// 9. Multiplicador vigente actual y etapa activa del motor booster (Público)
router.get('/booster/current-multiplier', SystemController.getCurrentMultiplier);

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const victimUploadDir = path.join(__dirname, '../../public/uploads/victims');
if (!fs.existsSync(victimUploadDir)) {
    fs.mkdirSync(victimUploadDir, { recursive: true });
}

// ============================================================================
// CONFIGURACIÓN DE SEGURIDAD FINTECH PARA SUBIDA DE EVIDENCIAS SOS
// ============================================================================
// 1. Uso exclusivo de memoria RAM (memoryStorage) para evitar RCE (Remote Code Execution)
// 2. Filtro estricto de MIME-Types para bloquear archivos maliciosos (.php, .exe, webshells)
// 3. Límite máximo de 10MB por archivo para prevenir ataques DoS por agotamiento de RAM
// ============================================================================
const victimStorage = multer.memoryStorage();

const victimUpload = multer({
    storage: victimStorage,
    limits: { 
        fileSize: 10 * 1024 * 1024 // Límite estricto de 10MB para prevenir desbordamiento de memoria (OOM)
    },
    fileFilter: (req, file, cb) => {
        // Lista blanca estricta de tipos de imagen permitidos
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/heic'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Formato de imagen no soportado. Permite JPG, PNG, WebP o HEIC.'));
        }
    }
});

const victimController = require('../controllers/victimController');

// 10. Registro, Verificación OTP, Reenvío de Código, Subida de Fotos y Consulta de Expediente SOS Venezuela
router.post('/public/sos-venezuela/register-victim', victimController.registerVictimPublic);
router.post('/public/sos-venezuela/verify-otp', victimController.verifyVictimOtpPublic);
router.post('/public/sos-venezuela/resend-otp', victimController.resendVictimOtpPublic);
// Subida de evidencias SOS (Protegida en RAM + Transcodificación en Cloudflare R2 - Hasta 15 fotos)
router.post('/public/sos-venezuela/upload-evidence', victimUpload.array('images', 15), victimController.uploadEvidencePublic);
router.get('/public/sos-venezuela/my-case', victimController.getMyCasePublic);

module.exports = router;
