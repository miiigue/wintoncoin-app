const express = require('express');

// Importar todos los routers de dominio
const userRoutes = require('./userRoutes');
const publicationRoutes = require('./publicationRoutes');
const adminRoutes = require('./adminRoutes');
const p2pRoutes = require('./p2pRoutes');
const transactionRoutes = require('./transactionRoutes');
const notificationRoutes = require('./notificationRoutes');
const authRoutes = require('./authRoutes');
const legalRoutes = require('./legalRoutes');
const momentumRoutes = require('./momentumRoutes');
const academyRoutes = require('./academyRoutes');
const solidarioRoutes = require('./solidarioRoutes');
const humanitarianUserRoutes = require('./humanitarianUserRoutes');
const humanitarianRoutes = require('./humanitarianRoutes');
const governanceRoutes = require('./governanceRoutes');
const recruitmentRoutes = require('./recruitmentRoutes');
const validationRoutes = require('./validationRoutes');
const uploadRoutes = require('./uploadRoutes');
const mediaRoutes = require('./mediaRoutes'); // [NUEVO] Rutas de medios R2/S3
const inAppNotificationRoutes = require('./inAppNotificationRoutes');
const minorRoutes = require('./minorRoutes');

const router = express.Router();

// Montar todos los routers de dominio bajo rutas base semánticas
router.use('/users', userRoutes);
router.use('/publications', publicationRoutes);
router.use('/admin', adminRoutes);
router.use('/p2p', p2pRoutes);
router.use('/me/transactions', transactionRoutes);
router.use('/notifications', notificationRoutes);
router.use('/auth', authRoutes);
router.use('/legal', legalRoutes);
router.use('/momentum', momentumRoutes);
router.use('/academy', academyRoutes);
router.use('/causes', humanitarianUserRoutes);
router.use('/humanitarian', humanitarianRoutes);
router.use('/governance', governanceRoutes);
router.use('/recruitment', recruitmentRoutes);
router.use('/validations', validationRoutes);
router.use('/uploads', uploadRoutes); // Admin Legacy uploads
router.use('/media', mediaRoutes); // [NUEVO] Subida de imágenes públicas
router.use('/inapp-notifications', inAppNotificationRoutes);
router.use('/minors', minorRoutes);

module.exports = router;
