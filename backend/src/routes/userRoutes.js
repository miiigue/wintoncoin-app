const express = require('express');
const router = express.Router();

// Importamos el controlador de usuarios
const UserController = require('../controllers/userController');

// Importamos el middleware de seguridad OFICIAL
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAcceptedLegalByUsernameField } = require('../middleware/legalAcceptanceMiddleware');
const { rateLimit } = require('express-rate-limit');
// Additional request throttling; the persistent per-user PIN lock lives in walletService.
const pinLimiter = rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:true,legacyHeaders:false,
    keyGenerator:req=>String(req.user.userId),message:{message:'Demasiadas solicitudes de PIN. Intenta más tarde.'}});

// ==========================================
// RUTAS DE USUARIO (SEGURAS Y MODULARIZADAS)
// ==========================================

// 1. Obtener balance consolidado del usuario autenticado
router.get('/api/me/wallet-identity',authenticateToken,async(req,res)=>{
 res.set('Cache-Control','no-store');
 try{const result=await require('../config/db').query('SELECT username,web3_wallet_address,has_transaction_pin FROM users WHERE id=$1',[req.user.userId]);
 if(!result.rowCount)return res.status(404).json({message:'Cuenta no encontrada.'});res.json(result.rows[0]);}
 catch{res.status(503).json({message:'No se pudo verificar la cuenta.'});}
});
router.get('/api/me/balance', authenticateToken, UserController.getMyBalance);

// 1b. Registrar depósito/retiro de garantía en la Bóveda (Collateral Vault)
router.post('/api/me/collateral/sync', authenticateToken, UserController.syncCollateral);

// 2. Obtener saldos por username (Legacy para perfiles y operaciones admin-user)
router.get('/users/:username/balance', authenticateToken, UserController.getUserBalanceLegacy);

// 3. Obtener el perfil público de un usuario (ratings, stats)
router.get('/users/:username/profile', UserController.getUserProfile);

// 4. Obtener información básica de un usuario
router.get('/user/:username', UserController.getUserBasicInfo);

// 5. Obtener código de referido
router.get('/api/user/:username/referral-code', UserController.getReferralCode);

// 6. Obtener historial del usuario (Legacy)
router.get('/users/:username/history', authenticateToken, UserController.getUserHistoryLegacy);

// 7. Obtener historial del usuario (Profesional Auth)
router.get('/api/me/history', authenticateToken, UserController.getMyHistory);

// 8. Obtener perfil de impulsor (Booster Profile)
router.get('/api/me/booster-profile', authenticateToken, UserController.getMyBoosterProfile);

// 9. Quema de Tokens (Financial Transaction)
router.post('/users/burn', requireAcceptedLegalByUsernameField(['username']), UserController.burnTokens);

// 10. Crear una calificación (Mapeado de /rate)
router.post('/rate', requireAcceptedLegalByUsernameField(['rater_username']), UserController.createRating);

// 11. Obtener información de referidos
router.get('/api/users/:username/referral-info', UserController.getReferralInfo);

// 12. Obtener perfil de impulsor de un usuario por username
router.get('/api/users/:username/booster-profile', UserController.getUserBoosterProfile);

// 13. Consultar estado del PIN de seguridad (Autocustodia)
router.get('/api/me/pin-status', authenticateToken, UserController.getMyPinStatus);

// 14. Configurar o actualizar PIN de seguridad de 6 dígitos (Autocustodia)
router.post('/api/me/set-pin', authenticateToken, pinLimiter, (_req,res)=>res.status(410).json({message:"Configura tu acceso en Billetera. No envíes frases al servidor."}));

// 15. Validar PIN de seguridad de 6 dígitos antes de una operación sensible
router.post('/api/me/verify-pin', authenticateToken, pinLimiter, (_req,res)=>res.status(410).json({message:"Autoriza la operación en tu dispositivo."}));

module.exports = router;
