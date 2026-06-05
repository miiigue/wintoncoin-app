// 0. Cargar variables de entorno
require('dotenv').config();

// 1. Importar las librerías necesarias
const express = require('express');
const pool = require('./src/config/db'); // Importamos la conexión a BD centralizada
const bcrypt = require('bcrypt');
const cors = require('cors');
const cookieParser = require('cookie-parser'); // NECESARIO PARA COOKIES
const path = require('path');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit'); // <-- SEGURIDAD: Importar rate-limit
const cron = require('node-cron');
const crypto = require('crypto');
require('./config'); // Carga la configuración del entorno (development o production)
const { initializeDatabase, generateUniqueReferralCode } = require('./src/config/databaseInit');
const { generateOtp6, hashOtpForEmail, sendOtpEmail, sendTransactionEmail, sendAnnouncementEmail, processPendingBroadcasts, normalizeEmail, safeEqualHex } = require('./src/services/emailService');
const { logAuditEvent, startAuditCleanupJob } = require('./src/services/auditService');
const authRoutes = require('./src/routes/authRoutes');
const notificationService = require('./src/services/notificationService'); // Importamos el servicio de notificaciones
const eventBus = require('./src/services/notificationEventBus'); // BUS DE EVENTOS GLOBAL
const {
    requireAcceptedLegalForAuthenticatedUser,
    requireAcceptedLegalByUsernameField
} = require('./src/middleware/legalAcceptanceMiddleware');

// === SERVICIOS Y RUTAS MODULARIZADOS NUEVAS ===
const {
    resolveRepeatCooldownHours,
    updateUserBoosterLevel,
    getDebtResponsibleUser,
    getDebtResponsibleUserById,
    processRequestCompletion,
    processRequestPayment,
    processDirectPaymentCompletion
} = require('./src/services/publicationService');
const publicationRoutes = require('./src/routes/publicationRoutes');
const validationRoutes = require('./src/routes/validationRoutes');
const solidarioRoutes = require('./src/routes/solidarioRoutes');
const recruitmentRoutes = require('./src/routes/recruitmentRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const createTransactionRouter = require('./src/routes/transactionRoutes');

// --- NUEVO: Gestión profesional de la clave secreta de JWT ---
// Buscamos la clave secreta en las variables de entorno.
const jwtSecret = process.env.JWT_SECRET;

// En un entorno de producción, es CRÍTICO que la clave secreta esté definida.
// Si no lo está, la aplicación no debe arrancar para evitar correr en un estado inseguro.
if (!jwtSecret) {
    console.error(`
        *******************************************************************************
        * ERROR FATAL: La variable de entorno JWT_SECRET no está definida.            *
        *                                                                             *
        * Para iniciar la aplicación de forma segura, crea un archivo .env           *
        * en el directorio 'backend' y añade la siguiente línea:                      *
        * JWT_SECRET=tu_clave_secreta_muy_larga_y_dificil_de_adivinar                 *
        *                                                                             *
        * El servidor no se iniciará hasta que esta variable esté configurada.        *
        *******************************************************************************
    `);
    process.exit(1); // Detiene la ejecución con un código de error.
}

// Lógica de Email y OTP movida a src/services/emailService.js

// 2. Configuración inicial
const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10;

// Render (y la mayoría de PaaS) usa un proxy inverso que añade X-Forwarded-For.
// Para que express-rate-limit y req.ip funcionen correctamente en producción:
app.set('trust proxy', 1);

// Middleware de seguridad para limitar intentos de login
const {
    loginLimiter,
    registerRequestLimiter,
    registerVerifyLimiter,
    resendOtpLimiter,
    web3RpcLimiter
} = require('./src/middleware/rateLimiters');


// 3. Middlewares
// Configuración de CORS segura para permitir cookies
// CORS allowlist:
// - En producción: solo dominios reales (Hostinger/Render)
// - En desarrollo: además localhost para permitir trabajar sin abrir CORS globalmente
const ALLOWED_ORIGINS = [
    'https://wintoncoin-frontend.onrender.com',
    'https://sc.wintoncoin.com', // Hostinger (producción legacy)
    'https://www.sc.wintoncoin.com',
    'https://wintoncoin.com', // Producción (dominio principal)
    'https://www.wintoncoin.com', // Producción (con www)
    'https://demo.wintoncoin.com', // Entorno DEMO
    'https://www.demo.wintoncoin.com' // Entorno DEMO (con www)
];

if (process.env.NODE_ENV !== 'production') {
    ALLOWED_ORIGINS.push(
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500'
    );
}

app.use(cors({
    origin: (origin, callback) => {
        // Permitir requests sin Origin (ej: health checks, curl, server-to-server)
        if (!origin) return callback(null, true);

        // ✅ Dev convenience (sin bajar seguridad en producción):
        // Permitimos cualquier localhost/127.0.0.1 o IP de red local con cualquier puerto SOLO fuera de producción.
        if (process.env.NODE_ENV !== 'production') {
            const isLocalhostOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
            const isLanOrigin = /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin);
            if (isLocalhostOrigin || isLanOrigin) return callback(null, true);
        }

        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        if (process.env.NODE_ENV !== 'production') return callback(null, true);
        return callback(new Error('Origen no permitido por CORS'), false);
    },
    credentials: true // CRÍTICO: Permite cookies entre dominios
}));
app.use(express.json());
app.use(cookieParser()); // CRÍTICO: Parsea las cookies de las peticiones
app.use(express.static(path.join(__dirname, '../frontend')));

// 4. Conectar a la Base de Datos PostgreSQL
// 4. Conectar a la Base de Datos PostgreSQL -> MOVIDO a src/config/db.js
// La variable 'pool' ya fue importada al inicio del archivo.

// Lógica de Audit Log movida a src/services/auditService.js

// Función para verificar la conexión
async function checkDbConnection() {
    try {
        const client = await pool.connect();
        console.log("Conectado a la base de datos PostgreSQL.");
        client.release();
    } catch (err) {
        console.error("Error al conectar con PostgreSQL:", err);
        throw err;
    }
}

// Migraciones y lógica de inicialización movidas a src/config/databaseInit.js

// 5. Función principal asíncrona para iniciar el servidor
// 5. Función principal asíncrona para iniciar el servidor
async function startServer() {
    try {
        await checkDbConnection();

        // --- NUEVO: Ejecutar migraciones pendientes automáticamente ---
        const { runPendingMigrations } = require('./scripts/migrationRunner');
        await runPendingMigrations();

        await initializeDatabase();
        startAuditCleanupJob();
        console.log("Base de datos inicializada correctamente.");

        // --- AHORA DEFINIMOS LAS RUTAS ---
        app.use('/api', authRoutes); // Registrar rutas de autenticación
        app.use('/api', validationRoutes); // Registrar rutas de validación de disponibilidad
        app.use('/api/recruitment', recruitmentRoutes); // <<< ALTA PRIORIDAD
        app.use('/api/solidario', solidarioRoutes); // Registrar rutas de Winton Solidario
        app.use('/api/admin', adminRoutes); // <<< NUEVAS RUTAS MODULARES ADMIN

        // Registrar rutas de Publicaciones
        // Para publicaciones: permitir actor autenticado (autor) o administrador.
        // Esto evita bloquear flujos legítimos del autor sin abrir rutas admin-only globales.
        app.use('/', publicationRoutes(pool, requireAcceptedLegalByUsernameField, verifyAdminOrUserToken, logAuditEvent)); // Registrar rutas de autenticación

        // --- NUEVO: Ruta para Mensajes Intersticiales Globales ---
        const interstitialController = require('./src/controllers/interstitialController');
        app.get('/api/interstitial/global', interstitialController.getGlobalInterstitial);

        // --- NUEVO: Rutas de Notificaciones Push (VAPID) ---
        const notificationRoutes = require('./src/routes/notificationRoutes');
        app.use('/api/notifications', notificationRoutes(pool));

        // --- NUEVO: Rutas del módulo Winton Momentum (Gestión de Influencers) ---
        // El módulo es 100% autocontenido. Solo necesita pool, middlewares de auth y auditoría.
        const createMomentumRouter = require('./src/routes/momentumRoutes');
        app.use('/api/momentum', createMomentumRouter(pool, verifyUserToken, verifyAdminToken, logAuditEvent));

        // --- NUEVO: Rutas del módulo Winton Momentum (Gestión de Influencers) ---
        // --- NUEVO: Rutas de Winton Academy CMS ---
        const academyRoutes = require('./src/routes/academyRoutes');
        app.use('/api/academy', academyRoutes);

        // --- NUEVO: Rutas de Gestión Admin de Causas Humanitarias (Winton Solidario) ---
        const humanitarianRoutes = require('./src/routes/humanitarianRoutes');
        app.use('/api/admin/humanitarian', humanitarianRoutes);

        // --- NUEVO: Rutas Públicas de Winton Solidario (Donaciones BLUE IOU) ---
        // Permite a usuarios autenticados: postular causas, donar, y consultar estado
        const humanitarianUserRoutes = require('./src/routes/humanitarianUserRoutes');
        app.use('/api/humanitarian', humanitarianUserRoutes);

        // --- NUEVO: Sistema de Gobernanza Winton-Consensus (Multifirma + WebAuthn) ---
        // Bootstrap (admin), solicitudes, votación biométrica, break glass
        const createGovernanceRouter = require('./src/routes/governanceRoutes');
        const { requireActiveGuardian } = require('./src/middleware/authMiddleware');
        app.use('/api/governance', createGovernanceRouter(pool, verifyUserToken, verifyAdminToken, requireActiveGuardian, logAuditEvent));

        // Registrar rutas de Transacciones Web3 y del historial modularizado
        app.use('/', createTransactionRouter(verifyUserToken));

        // --- NUEVO: Rutas de Notificaciones In-App (Campanita) ---
        app.use('/', require('./src/routes/inAppNotificationRoutes'));


        // =================================================================================
        // ==  NUEVO FLUJO DE REGISTRO CON VERIFICACIÓN POR SMS (FASE 1: SOLICITUD)  ==
        // ==  (MOVIDO A validationRoutes.js)                                         ==
        // =================================================================================
        /*
        // Endpoint to check if username exists (Industry Standard for UX)
        app.get('/api/check-username/:username', async (req, res) => {
            const { username } = req.params;

            // Validation for safety
            if (!username) {
                return res.status(400).json({ error: 'Username is required' });
            }

            // Validación: mínimo 3 caracteres
            if (username.length < 3) {
                return res.json({ available: false, message: 'El usuario debe tener al menos 3 caracteres.' });
            }

            // Validación: máximo 30 caracteres
            if (username.length > 30) {
                return res.json({ available: false, message: 'El usuario no puede tener más de 30 caracteres.' });
            }

            // Validación: solo alfanuméricos y guiones bajos, sin espacios
            const usernameRegex = /^[a-zA-Z0-9_]+$/;
            if (!usernameRegex.test(username)) {
                return res.json({ available: false, message: 'Solo letras, números y guiones bajos (_). Sin espacios.' });
            }

            try {
                // Check case-insensitive to avoid "User" vs "user" duplicates
                // Using PostgreSQL syntax with pool
                const result = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);

                if (result.rows.length > 0) {
                    return res.json({ available: false, message: 'Este nombre de usuario ya está en uso.' });
                } else {
                    return res.json({ available: true, message: 'Nombre de usuario disponible.' });
                }
            } catch (err) {
                console.error('Error checking username:', err.message);
                return res.status(500).json({ error: 'Database error' });
            }
        });

        // Endpoint to check if email exists (UX Improvement)
        app.get('/api/check-email/:email', async (req, res) => {
            const { email } = req.params;

            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }

            try {
                const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

                if (result.rows.length > 0) {
                    return res.json({ available: false, message: 'Este correo electrónico ya está registrado.' });
                } else {
                    return res.json({ available: true, message: 'Correo disponible.' });
                }
            } catch (err) {
                console.error('Error checking email:', err.message);
                return res.status(500).json({ error: 'Database error' });
            }
        });

        // Endpoint to check if phone exists (UX Improvement)
        app.get('/api/check-phone/:phone', async (req, res) => {
            const { phone } = req.params;

            if (!phone) {
                return res.status(400).json({ error: 'Phone number is required' });
            }

            try {
                // NOTE: Ideally we should normalize phone numbers (e.g. remove spaces, dashes) before checking.
                // For now, we check exact match as stored in DB.
                const result = await pool.query('SELECT id FROM users WHERE phone_number = $1', [phone]);

                if (result.rows.length > 0) {
                    return res.json({ available: false, message: 'Este número de teléfono ya está registrado.' });
                } else {
                    return res.json({ available: true, message: 'Teléfono disponible.' });
                }
            } catch (err) {
                console.error('Error checking phone:', err.message);
                return res.status(500).json({ error: 'Database error' });
            }
        });
        */

        // =================================================================================
        // ==  ENDPOINT PARA VALIDAR CAUSAS ACTIVAS DE UN USUARIO (SOLIDARIO)           ==
        // ==  (MOVIDO A solidarioRoutes.js)                                          ==
        // =================================================================================
        /*
        app.get('/api/solidario/check-active/:username', async (req, res) => {
            const { username } = req.params;
            try {
                const userResult = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
                if (userResult.rowCount === 0) {
                    return res.status(404).json({ error: 'User not found' });
                }
                const userId = userResult.rows[0].id;

                const activeCauses = await pool.query(`
                    SELECT id FROM humanitarian_causes 
                    WHERE user_id = $1 AND status IN ('pending', 'approved')
                `, [userId]);

                if (activeCauses.rowCount > 0) {
                    return res.json({ hasActive: true, message: 'El usuario ya tiene una causa activa o pendiente.' });
                }

                return res.json({ hasActive: false, message: 'El usuario puede postular una causa.' });
            } catch (err) {
                console.error('Error checking active causes:', err.message);
                return res.status(500).json({ error: 'Database error' });
            }
        });

        // =================================================================================
        // ==  ENDPOINT DE POSTULACIÓN SOLIDARIA (CASOS HUMANITARIOS)                    ==
        // ==  Usa la tabla humanitarian_causes creada por migración 038                 ==
        // ==  Seguridad: Validación de URL, límites de longitud, sanitización           ==
        // =================================================================================
        app.post('/api/solidario/postulacion', async (req, res) => {
            const { username, titulo, historia, meta, evidencia_link, redes_sociales } = req.body;

            // --- VALIDACIÓN 1: Campos obligatorios ---
            if (!username || !titulo || !historia || !meta || !evidencia_link || !redes_sociales) {
                return res.status(400).json({ message: "Todos los campos son obligatorios, incluyendo tus redes sociales." });
            }

            // --- VALIDACIÓN 2: Límites de longitud (Prevención de payload excesivo) ---
            if (username.length > 50) {
                return res.status(400).json({ message: "El nombre de usuario es demasiado largo." });
            }
            if (titulo.length > 255) {
                return res.status(400).json({ message: "El título no puede exceder 255 caracteres." });
            }
            if (historia.length > 5000) {
                return res.status(400).json({ message: "La historia no puede exceder 5000 caracteres." });
            }
            if (evidencia_link.length > 2048) {
                return res.status(400).json({ message: "El enlace de evidencia es demasiado largo." });
            }

            // --- VALIDACIÓN 3: Monto numérico positivo ---
            const goalAmount = parseFloat(meta);
            if (isNaN(goalAmount) || goalAmount <= 0) {
                return res.status(400).json({ message: "La meta debe ser un número positivo." });
            }

            // --- VALIDACIÓN 4: URL segura (solo HTTPS para proteger la integridad) ---
            let redesArray = [];
            try {
                const url = new URL(evidencia_link.trim());
                if (url.protocol !== 'https:') {
                    return res.status(400).json({ message: "El enlace de evidencia debe usar HTTPS por seguridad." });
                }

                // Procesar redes sociales (separadas por espacio)
                const redesCrudas = redes_sociales.trim().split(/\s+/);
                for (const link of redesCrudas) {
                    if (!link) continue;
                    const urlRedes = new URL(link);
                    if (urlRedes.protocol !== 'https:') {
                        return res.status(400).json({ message: "Todos los enlaces de redes sociales deben usar HTTPS." });
                    }
                    redesArray.push(link);
                }
            } catch (e) {
                return res.status(400).json({ message: "Uno de los enlaces proporcionados no es válido. Asegúrate de incluir https://" });
            }

            try {
                // 1. Verificar que el usuario existe en la base de datos (Seguridad: doble verificación)
                const userResult = await pool.query(
                    'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
                    [username.trim()]
                );
                if (userResult.rowCount === 0) {
                    return res.status(404).json({ message: "El usuario no existe en el sistema." });
                }
                const userId = userResult.rows[0].id;

                // --- NUEVO: Validar que el usuario no tenga otra causa activa ('pending' o 'approved') ---
                const activeCausesCheck = await pool.query(`
                    SELECT id FROM humanitarian_causes 
                    WHERE user_id = $1 AND status IN ('pending', 'approved')
                `, [userId]);

                if (activeCausesCheck.rowCount > 0) {
                    return res.status(400).json({ message: "Actualmente posees una causa en curso o en revisión. Debes culminarla antes de postular una nueva." });
                }

                // 2. Insertar en la tabla humanitarian_causes (Migración 038)
                // evidence_urls es JSONB, guardamos todos los links como un array de URLs
                const allUrls = [evidencia_link.trim(), ...redesArray];
                const evidenceUrls = JSON.stringify(allUrls);
                const insertSql = `
                    INSERT INTO humanitarian_causes 
                    (user_id, title, story, goal_amount, evidence_urls, status)
                    VALUES ($1, $2, $3, $4, $5::jsonb, 'pending')
                    RETURNING id, created_at
                `;
                const result = await pool.query(insertSql, [
                    userId,
                    titulo.trim(),
                    historia.trim(),
                    goalAmount,
                    evidenceUrls
                ]);

                // 3. Registrar en Auditoría (Estándar Bancario: Trazabilidad total)
                await logAuditEvent(pool, req, {
                    eventType: 'SOLIDARIO_POSTULACION',
                    actorUsername: username.trim(),
                    category: 'HUMANITARIAN',
                    metadata: {
                        cause_id: result.rows[0].id,
                        title: titulo.trim(),
                        goal_amount: goalAmount
                    }
                });

                // 4. Notificación in-app (mismo patrón que el resto del sistema)
                // Queda registrada en la bandeja de notificaciones del usuario
                await pool.query(
                    `INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`,
                    [
                        username.trim(),
                        `📋 Tu postulación solidaria "${titulo.trim()}" ha sido recibida (ID: #${result.rows[0].id}). Nuestro equipo la revisará y recibirás una notificación con la decisión.`
                    ]
                );

                res.status(201).json({
                    success: true,
                    message: "Tu postulación ha sido registrada exitosamente. Recibirás una notificación cuando nuestro equipo revise tu caso.",
                    id: result.rows[0].id
                });

            } catch (error) {
                console.error('Error al procesar la postulación solidaria:', error);
                res.status(500).json({ message: "Error interno del servidor al procesar la postulación." });
            }
        });
        */

        // Rutas de Autenticación movidas a src/routes/authRoutes.js
        app.use('/', authRoutes);

        // NUEVO: Endpoint para agregar tutor a cuenta de menor
        app.post('/api/minor/add-tutor', requireAcceptedLegalByUsernameField(['minorUsername']), async (req, res) => {
            const { minorUsername, tutorUsernameOrEmail } = req.body;

            if (!minorUsername || !tutorUsernameOrEmail) {
                return res.status(400).json({ message: "Se requiere el nombre de usuario del menor y el usuario o email del tutor." });
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. Verificar que el menor existe y es realmente menor
                const minorResult = await client.query(
                    `SELECT id, username, is_minor, tutor_user_id, account_status FROM users WHERE username = $1`,
                    [minorUsername]
                );

                if (minorResult.rowCount === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ message: "Usuario menor no encontrado." });
                }

                const minor = minorResult.rows[0];

                if (!minor.is_minor) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "Este usuario no es menor de edad." });
                }

                if (minor.tutor_user_id) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "Este usuario ya tiene un tutor asignado." });
                }

                // 2. Buscar el tutor por username o email
                const tutorResult = await client.query(
                    `SELECT id, username, email FROM users WHERE username = $1 OR email = $2`,
                    [tutorUsernameOrEmail, tutorUsernameOrEmail]
                );

                if (tutorResult.rowCount === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ message: "Tutor no encontrado. El tutor debe tener una cuenta activa en WintonCoin." });
                }

                const tutor = tutorResult.rows[0];

                // 3. Verificar que el tutor no es el mismo que el menor
                if (tutor.id === minor.id) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "No puedes ser tu propio tutor." });
                }

                // 4. Verificar que el tutor no es menor
                const tutorIsMinorResult = await client.query(
                    `SELECT is_minor FROM users WHERE id = $1`,
                    [tutor.id]
                );

                if (tutorIsMinorResult.rows[0].is_minor) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "El tutor no puede ser menor de edad." });
                }

                // 5. Asignar tutor al menor
                await client.query(
                    `UPDATE users SET tutor_user_id = $1, account_status = 'active' WHERE id = $2`,
                    [tutor.id, minor.id]
                );

                // 6. Crear notificación para el tutor
                await client.query(
                    `INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`,
                    [tutor.username, `Has sido asignado como tutor responsable de la cuenta de ${minor.username}. Serás responsable de todas las obligaciones financieras generadas por esta cuenta.`]
                );

                // 7. Crear notificación para el menor
                await client.query(
                    `INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`,
                    [minor.username, `Tu cuenta ha sido activada con ${tutor.username} como tutor responsable. Ahora puedes realizar transacciones en la plataforma.`]
                );

                await client.query('COMMIT');
                res.status(200).json({
                    message: `Tutor agregado exitosamente. ${tutor.username} es ahora responsable de tu cuenta.`,
                    tutor_username: tutor.username
                });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error al agregar tutor:', error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            } finally {
                client.release();
            }
        });





        // --- NOTIFICACIONES IN-APP EXTRAÍDAS A inAppNotificationRoutes.js ---

        // Ruta para QUEMAR tokens (Ahora refactorizada para usar la función central)
        app.post('/users/burn', requireAcceptedLegalByUsernameField(['username']), async (req, res) => {
            const { username, amount } = req.body;

            const amountToBurnString = (amount || "0").toString().replace(',', '.');
            const amountToBurn = parseFloat(amountToBurnString);

            if (!username || !amountToBurn || amountToBurn <= 0) {
                return res.status(400).json({ message: "La cantidad a quemar debe ser un número positivo." });
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const burnResult = await executeBurn(client, username, amountToBurn);

                if (burnResult.success) {
                    await client.query('COMMIT');
                    res.json({ message: burnResult.message });
                } else {
                    await client.query('ROLLBACK');
                    // Usamos un código de estado 400 (Bad Request) para errores de lógica de negocio como saldo insuficiente.
                    res.status(400).json({ message: burnResult.message });
                }
            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error en la ruta /users/burn:", error);
                res.status(500).json({ message: error.message || "Error del servidor." });
            } finally {
                client.release();
            }
        });

        // Ruta: Obtener el historial de un usuario
        app.get('/users/:username/history', verifyUserToken, async (req, res) => {
            const { username } = req.params;
            if (!req.user?.username || req.user.username !== username) {
                return res.status(403).json({ message: 'No autorizado para consultar historial de otro usuario.' });
            }
            try {
                // Historial "completo" (fintech/banca): no ocultamos publicaciones eliminadas.
                // Las marcamos con flags para que el frontend muestre badges (ELIMINADA/EXPIRADA/COMPLETADA).
                const authoredSql = `
                    SELECT
                        p.*,
                        u.username as author_username,
                        (p.deleted_at IS NOT NULL) AS is_deleted,
                        (p.expires_at IS NOT NULL AND p.expires_at < NOW()) AS is_expired,
                        (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id) AS participants_count,
                        (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id AND pa.status = 'confirmed_paid') AS completed_count,
                        (
                            CASE
                                WHEN COALESCE(p.is_quick_sale, FALSE) = TRUE THEN (p.status <> 'open')
                                ELSE (
                                    p.available_slots <= 0
                                )
                            END
                        ) AS is_completed_publication
                    FROM publications p
                    JOIN users u ON p.author_id = u.id
                    WHERE u.username = $1
                    ORDER BY p.created_at DESC
                `;

                const completedSql = `
                    SELECT
                        p.*,
                        u.username as author_username,
                        pa.status as user_acceptance_status,
                        pa.form_responses,
                        (p.deleted_at IS NOT NULL) AS is_deleted,
                        (p.expires_at IS NOT NULL AND p.expires_at < NOW()) AS is_expired
                    FROM publications p
                    JOIN users u ON p.author_id = u.id
                    JOIN publication_acceptances pa ON p.id = pa.publication_id
                    WHERE pa.acceptor_username = $1 AND pa.status = 'confirmed_paid'
                    ORDER BY p.created_at DESC
                `;

                const [authoredResult, completedResult] = await Promise.all([
                    pool.query(authoredSql, [username]),
                    pool.query(completedSql, [username])
                ]);

                res.status(200).json({ authored: authoredResult.rows, completed: completedResult.rows });
            } catch (err) {
                console.error("Error al obtener el historial:", err.message);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // --- ENDPOINT PROFESIONAL: historial del usuario autenticado ---
        // Fuente de verdad: JWT (userId + username), sin depender de username en URL.
        app.get('/api/me/history', verifyUserToken, async (req, res) => {
            const userId = req.user?.userId;
            const username = req.user?.username;
            if (!userId || !username) {
                return res.status(401).json({ message: 'No autenticado.' });
            }

            try {
                const authoredSql = `
                    SELECT
                        p.*,
                        u.username as author_username,
                        (p.deleted_at IS NOT NULL) AS is_deleted,
                        (p.expires_at IS NOT NULL AND p.expires_at < NOW()) AS is_expired,
                        (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id) AS participants_count,
                        (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id AND pa.status = 'confirmed_paid') AS completed_count,
                        (
                            CASE
                                WHEN COALESCE(p.is_quick_sale, FALSE) = TRUE THEN (p.status <> 'open')
                                ELSE (
                                    p.available_slots <= 0
                                )
                            END
                        ) AS is_completed_publication
                    FROM publications p
                    JOIN users u ON p.author_id = u.id
                    WHERE p.author_id = $1
                    ORDER BY p.created_at DESC
                `;

                // Nota: publication_acceptances actualmente sigue modelado por username.
                const completedSql = `
                    SELECT
                        p.*,
                        u.username as author_username,
                        pa.status as user_acceptance_status,
                        pa.form_responses,
                        (p.deleted_at IS NOT NULL) AS is_deleted,
                        (p.expires_at IS NOT NULL AND p.expires_at < NOW()) AS is_expired
                    FROM publications p
                    JOIN users u ON p.author_id = u.id
                    JOIN publication_acceptances pa ON p.id = pa.publication_id
                    WHERE pa.acceptor_username = $1 AND pa.status = 'confirmed_paid'
                    ORDER BY p.created_at DESC
                `;

                const [authoredResult, completedResult] = await Promise.all([
                    pool.query(authoredSql, [userId]),
                    pool.query(completedSql, [username])
                ]);

                res.status(200).json({ authored: authoredResult.rows, completed: completedResult.rows });
            } catch (err) {
                console.error("Error al obtener historial (/api/me/history):", err.message);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Ruta para obtener todos los participantes de una publicación
        app.get('/publications/:id/participants', async (req, res) => {
            const { id } = req.params;
            const sql = `
                SELECT pa.acceptor_username, pa.status, pa.created_at as accepted_at, u.average_rating, u.ratings_count
                FROM publication_acceptances pa JOIN users u ON pa.acceptor_username = u.username
                WHERE pa.publication_id = $1 ORDER BY pa.created_at
            `;
            try {
                const result = await pool.query(sql, [id]);
                res.status(200).json(result.rows);
            } catch (error) {
                console.error('Error al obtener participantes:', error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // NOTA: Las rutas /users/:username/transactions y /api/me/transactions
        // se han movido a src/routes/transactionRoutes.js y src/controllers/transactionController.js
        // bajo la modularización del endpoint de transacciones para el cumplimiento de auditoría y Web3.

        // RUTA: Obtener los saldos de un usuario
        app.get('/users/:username/balance', verifyUserToken, async (req, res) => {
            const { username } = req.params;
            if (!req.user?.username || req.user.username !== username) {
                return res.status(403).json({ message: 'No autorizado para consultar balance de otro usuario.' });
            }

            const client = await pool.connect();
            try {
                const userSql = `SELECT liquid_blue_balance, escrow_blue_balance, red_balance FROM users WHERE username = $1`;

                const debtSql = `
                    SELECT due_at, amount FROM red_token_debts 
                    WHERE username = $1 AND is_settled = FALSE ORDER BY due_at ASC LIMIT 1
                `;

                const escrowSql = `
                    SELECT unlock_at, amount FROM blue_token_escrows
                    WHERE username = $1 AND is_released = FALSE ORDER BY unlock_at ASC LIMIT 1
                `;

                const penalizedDebtSql = `
                    SELECT SUM(amount) as total_penalized_debt FROM red_token_debts
                    WHERE username = $1 AND is_penalized = TRUE AND is_settled = FALSE
                `;

                const [userResult, debtResult, escrowResult, penalizedDebtResult] = await Promise.all([
                    client.query(userSql, [username]),
                    client.query(debtSql, [username]),
                    client.query(escrowSql, [username]),
                    client.query(penalizedDebtSql, [username])
                ]);

                if (userResult.rows.length === 0) {
                    return res.status(404).json({ message: "Usuario no encontrado." });
                }

                const responseData = {
                    blue_balance: userResult.rows[0].liquid_blue_balance,
                    escrow_blue_balance: userResult.rows[0].escrow_blue_balance,
                    red_balance: userResult.rows[0].red_balance,
                    next_due_at: debtResult.rows[0]?.due_at || null,
                    next_due_amount: debtResult.rows[0]?.amount || null,
                    next_unlock_at: escrowResult.rows[0]?.unlock_at || null,
                    next_unlock_amount: escrowResult.rows[0]?.amount || null,
                    penalized_debt: penalizedDebtResult.rows[0]?.total_penalized_debt || '0'
                };

                res.status(200).json(responseData);
            } catch (err) {
                console.error("Error al obtener balance y deuda:", err);
                return res.status(500).json({ message: "Error interno del servidor." });
            } finally {
                client.release();
            }
        });

        // --- ENDPOINT PROFESIONAL: Obtener los saldos del usuario autenticado ---
        // Fuente de verdad: JWT (userId). Evita que el cliente "spoofee" otro username.
        app.get('/api/me/balance', verifyUserToken, async (req, res) => {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ message: "No autenticado." });
            }

            const client = await pool.connect();
            try {
                // 1) Obtener balances desde users por ID (estándar profesional)
                const userResult = await client.query(
                    `SELECT username, liquid_blue_balance, escrow_blue_balance, red_balance, web3_wallet_address, kyc_verified
                     FROM users
                     WHERE id = $1`,
                    [userId]
                );

                if (userResult.rows.length === 0) {
                    return res.status(404).json({ message: "Usuario no encontrado." });
                }

                const username = userResult.rows[0].username;

                // 2) Tablas legacy por username (migración gradual)
                const debtSql = `
                    SELECT due_at, amount FROM red_token_debts 
                    WHERE username = $1 AND is_settled = FALSE ORDER BY due_at ASC LIMIT 1
                `;
                const escrowSql = `
                    SELECT unlock_at, amount FROM blue_token_escrows
                    WHERE username = $1 AND is_released = FALSE ORDER BY unlock_at ASC LIMIT 1
                `;
                const penalizedDebtSql = `
                    SELECT SUM(amount) as total_penalized_debt FROM red_token_debts
                    WHERE username = $1 AND is_penalized = TRUE AND is_settled = FALSE
                `;
                const debt30DaysSql = `
                    SELECT COALESCE(SUM(amount), 0) as total FROM red_token_debts 
                    WHERE username = $1 AND is_settled = FALSE AND due_at <= NOW() + INTERVAL '30 days'
                `;
                const debtEndMonthSql = `
                    SELECT COALESCE(SUM(amount), 0) as total FROM red_token_debts 
                    WHERE username = $1 AND is_settled = FALSE AND due_at <= (date_trunc('month', NOW()) + INTERVAL '1 month - 1 day')
                `;

                const [debtResult, escrowResult, penalizedDebtResult, debt30Result, debtEndMonthResult] = await Promise.all([
                    client.query(debtSql, [username]),
                    client.query(escrowSql, [username]),
                    client.query(penalizedDebtSql, [username]),
                    client.query(debt30DaysSql, [username]),
                    client.query(debtEndMonthSql, [username])
                ]);

                const creditScoringService = require('./src/services/creditScoringService');
                const creditLimit = await creditScoringService.calculateUserScore(userId);

                const Web3BridgeService = require('./src/services/web3BridgeService');
                // ── VERIFICACIÓN KYC CON SINCRONIZACIÓN AUTOMÁTICA ──────────
                // Se usa checkUserKYCDetailed() en vez de checkUserKYC() para
                // distinguir entre "blockchain dijo false" y "blockchain no respondió".
                // Esto permite sincronizar la columna users.kyc_verified (caché DB)
                // solo cuando tenemos un dato real de la blockchain, evitando
                // sobreescribir con un false causado por un error de red.
                let isKycVerified = false;
                // Flag que indica si la consulta a la blockchain fue exitosa.
                // Si es false, no podemos confiar en el resultado y usamos fallback.
                let blockchainQuerySucceeded = false;

                if (userResult.rows[0].web3_wallet_address) {
                    // Consultar la blockchain usando el método detallado.
                    const kycResult = await Web3BridgeService.checkUserKYCDetailed(
                        userResult.rows[0].web3_wallet_address
                    );
                    // Extraer los resultados del objeto detallado.
                    blockchainQuerySucceeded = kycResult.success;
                    isKycVerified = kycResult.verified;
                }

                // ── SINCRONIZACIÓN AUTOMÁTICA DB ← BLOCKCHAIN ───────────────
                // Si la blockchain respondió exitosamente Y hay discrepancia con
                // la columna kyc_verified en la DB, actualizamos la DB para que
                // refleje la realidad on-chain (Single Source of Truth: Blockchain).
                // Esto resuelve el caso donde la blockchain dice true pero la DB
                // quedó desincronizada (ej: servidor se reinició entre la escritura
                // on-chain y la actualización de la DB).
                const dbKycStatus = userResult.rows[0].kyc_verified === true;
                if (blockchainQuerySucceeded && userResult.rows[0].web3_wallet_address) {
                    if (isKycVerified !== dbKycStatus) {
                        try {
                            await client.query(
                                'UPDATE users SET kyc_verified = $1 WHERE id = $2',
                                [isKycVerified, userId]
                            );
                            console.log(`[API BALANCE] ✅ Sincronización KYC: DB actualizada de ${dbKycStatus} a ${isKycVerified} para usuario #${userId}`);
                        } catch (syncErr) {
                            // Error no crítico: la próxima consulta lo reintentará.
                            console.error(`[API BALANCE] ⚠️ Error al sincronizar KYC en DB para usuario #${userId}:`, syncErr.message);
                        }
                    }
                }

                // ── FALLBACK ROBUSTO (Resiliencia ante desconexión RPC) ──────
                // SOLO se activa si la blockchain NO respondió (timeout, nodo caído).
                // En ese caso, confiamos en la caché de la DB como último recurso.
                // Si la blockchain SÍ respondió, su respuesta es la verdad absoluta
                // y el fallback NO se activa (incluso si la DB dice lo contrario).
                if (!blockchainQuerySucceeded && dbKycStatus) {
                    console.log(`[API BALANCE] Fallback activado: blockchain no disponible, usando caché DB (kyc_verified=${dbKycStatus}) para usuario #${userId}.`);
                    isKycVerified = true;
                }

                const responseData = {
                    blue_balance: userResult.rows[0].liquid_blue_balance,
                    escrow_blue_balance: userResult.rows[0].escrow_blue_balance,
                    red_balance: userResult.rows[0].red_balance,
                    web3_wallet_address: userResult.rows[0].web3_wallet_address,
                    kyc_verified: isKycVerified,
                    credit_limit: creditLimit,
                    debt_30_days: debt30Result.rows[0].total,
                    debt_end_month: debtEndMonthResult.rows[0].total,
                    next_due_at: debtResult.rows[0]?.due_at || null,
                    next_due_amount: debtResult.rows[0]?.amount || null,
                    next_unlock_at: escrowResult.rows[0]?.unlock_at || null,
                    next_unlock_amount: escrowResult.rows[0]?.amount || null,
                    penalized_debt: penalizedDebtResult.rows[0]?.total_penalized_debt || '0'
                };

                res.status(200).json(responseData);
            } catch (err) {
                console.error("Error al obtener balance y deuda (me):", err);
                return res.status(500).json({ message: "Error interno del servidor." });
            } finally {
                client.release();
            }
        });

        // ==========================================
        // RUTA: OBTENER INFO DE SMART CONTRACTS (SEGURO Y CACHEADO)
        // ==========================================
        let contractsInfoCache = null;
        let lastContractsFetch = 0;
        const CACHE_TTL_MS = 60000; // 60 segundos de caché (Estándar Fintech para prevenir DDoS sobre nodos RPC)

        app.get('/api/contracts/info', web3RpcLimiter, verifyUserToken, async (req, res) => {
            try {
                // Prevenir ataques de agotamiento de RPC devolviendo desde la memoria caché si es válido
                if (contractsInfoCache && (Date.now() - lastContractsFetch < CACHE_TTL_MS)) {
                    return res.status(200).json(contractsInfoCache);
                }

                const { ethers } = require('ethers');
                const RPC_URL = process.env.OPTIMISM_RPC_URL || 'https://sepolia.optimism.io';
                const provider = new ethers.JsonRpcProvider(RPC_URL);
                
                const blueAddress = process.env.BLUE_TOKEN_ADDRESS || '0x000000000000000000000000000000000000BLUE';
                const redAddress = process.env.RED_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000RED';
                
                let blueMinted = '10000000.0000';
                let redMinted = '5000000.0000';

                // Intentar leer de la blockchain real si las direcciones son válidas
                if (blueAddress.startsWith('0x') && blueAddress.length === 42 && !blueAddress.includes('BLUE')) {
                    const abi = ["function totalSupply() view returns (uint256)"];
                    const blueContract = new ethers.Contract(blueAddress, abi, provider);
                    try {
                        const supply = await blueContract.totalSupply();
                        blueMinted = ethers.formatEther(supply);
                    } catch (e) {
                        console.error("[WEB3 SEC] Error reading BLUE totalSupply", e.message);
                    }
                }
                
                if (redAddress.startsWith('0x') && redAddress.length === 42 && !redAddress.includes('RED')) {
                    const abi = ["function totalSupply() view returns (uint256)"];
                    const redContract = new ethers.Contract(redAddress, abi, provider);
                    try {
                        const supply = await redContract.totalSupply();
                        redMinted = ethers.formatEther(supply);
                    } catch (e) {
                        console.error("[WEB3 SEC] Error reading RED totalSupply", e.message);
                    }
                }

                contractsInfoCache = {
                    blue: {
                        address: blueAddress,
                        minted: parseFloat(blueMinted).toLocaleString('es-ES', {minimumFractionDigits: 4, maximumFractionDigits: 4}) + ' BLUE'
                    },
                    red: {
                        address: redAddress,
                        minted: parseFloat(redMinted).toLocaleString('es-ES', {minimumFractionDigits: 4, maximumFractionDigits: 4}) + ' RED'
                    }
                };
                lastContractsFetch = Date.now();

                res.status(200).json(contractsInfoCache);
            } catch (error) {
                console.error("[WEB3 SEC] Error fetching contract info:", error);
                // Fallback de seguridad para que la UI no se rompa
                if (contractsInfoCache) {
                    return res.status(200).json(contractsInfoCache);
                }
                res.status(500).json({ error: "Error de infraestructura Web3" });
            }
        });

        // Ruta para obtener datos públicos de un usuario (calificación)
        app.get('/user/:username', async (req, res) => {
            const { username } = req.params;
            const sql = `SELECT username, average_rating, ratings_count FROM users WHERE username = $1`;
            try {
                const result = await pool.query(sql, [username]);
                if (result.rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado." });
                res.status(200).json(result.rows[0]);
            } catch (err) {
                return res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Endpoint para obtener el código de referido de un usuario
        app.get('/api/user/:username/referral-code', async (req, res) => {
            const { username } = req.params;
            try {
                const result = await pool.query('SELECT referral_code FROM users WHERE username = $1', [username]);
                if (result.rows.length === 0) {
                    return res.status(404).json({ message: 'Usuario no encontrado.' });
                }
                res.json({ referral_code: result.rows[0].referral_code });
            } catch (error) {
                console.error('Error al obtener el código de referido:', error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            }
        });

        // Ruta para crear una calificación
        app.post('/rate', requireAcceptedLegalByUsernameField(['rater_username']), async (req, res) => {
            const { publication_id, rater_username, ratee_username, rating, comment } = req.body;
            if (!publication_id || !rater_username || !ratee_username || !rating) {
                return res.status(400).json({ message: 'Faltan datos requeridos para la calificación.' });
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const insertRatingQuery = `
                    INSERT INTO ratings (publication_id, rater_username, ratee_username, rating, comment)
                    VALUES ($1, $2, $3, $4, $5)
                `;
                await client.query(insertRatingQuery, [publication_id, rater_username, ratee_username, rating, comment || null]);

                const updateUserRatingQuery = `
                    UPDATE users u
                    SET 
                        ratings_count = r.total_ratings,
                        average_rating = r.avg_rating
                    FROM (
                        SELECT 
                            ratee_username, COUNT(*) AS total_ratings, AVG(rating) AS avg_rating
                        FROM ratings WHERE ratee_username = $1 GROUP BY ratee_username
                    ) r
                    WHERE u.username = $1;
                `;
                await client.query(updateUserRatingQuery, [ratee_username]);

                await client.query('COMMIT');
                res.status(201).json({ message: `¡Gracias! Tu calificación para ${ratee_username} ha sido guardada.` });
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error al guardar la calificación:', error.message);
                res.status(500).json({ message: 'Error interno al guardar la calificación.' });
            } finally {
                client.release();
            }
        });

        // Ruta para ELIMINAR una publicación
        app.delete('/publications/:id', requireAcceptedLegalByUsernameField(['deleterUsername']), async (req, res) => {
            const { id } = req.params;
            const { deleterUsername } = req.body;
            if (!deleterUsername) return res.status(400).json({ message: "Se requiere nombre de usuario." });

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const pubResult = await client.query(
                    `SELECT p.*, u.username as author_username
                     FROM publications p
                     JOIN users u ON p.author_id = u.id
                     WHERE p.id = $1
                     FOR UPDATE`,
                    [id]
                );
                const pub = pubResult.rows[0];

                if (!pub) throw { status: 404, message: "La publicación no existe." };
                if (pub.deleted_at) throw { status: 400, message: "La publicación ya fue eliminada." };
                if (pub.author_username !== deleterUsername) throw { status: 403, message: "No tienes permiso para eliminar esto." };

                const participantsCheck = await client.query(
                    `SELECT 1 FROM publication_acceptances WHERE publication_id = $1 AND status IN ('approved', 'completed') LIMIT 1`,
                    [id]
                );
                if (participantsCheck.rowCount > 0) {
                    throw { status: 403, message: "No se puede eliminar una tarea con participantes activos." };
                }

                // ✅ Soft delete (no rompe FKs y mantiene historial/auditoría)
                await client.query(
                    `UPDATE publications
                     SET deleted_at = NOW(), deleted_by_username = $2
                     WHERE id = $1`,
                    [id, deleterUsername]
                );

                await logAuditEvent(client, req, {
                    eventType: 'publication.deleted',
                    actorUsername: deleterUsername,
                    publicationId: parseInt(id, 10),
                    category: pub.category,
                    metadata: { soft_delete: true }
                });

                await client.query('COMMIT');
                res.status(200).json({ message: "Publicación eliminada (soft delete) correctamente." });
            } catch (err) {
                await client.query('ROLLBACK');
                console.error("Error al eliminar publicación:", err.message);
                res.status(err.status || 500).json({ message: err.message || "Error interno." });
            } finally {
                client.release();
            }
        });

        // Ruta para PAUSAR/REANUDAR una publicación (REFACTORIZADA PARA MÁXIMA SEGURIDAD)
        app.post('/publications/:id/toggle-pause', requireAcceptedLegalByUsernameField(['username']), async (req, res) => {
            const { id } = req.params;
            const { username } = req.body;

            if (!username) {
                return res.status(400).json({ message: "Se requiere nombre de usuario." });
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. OBTENER la publicación y VERIFICAR permisos explícitamente.
                const pubResult = await client.query(
                    `SELECT p.is_paused, u.username as author_username FROM publications p JOIN users u ON p.author_id = u.id WHERE p.id = $1 FOR UPDATE`,
                    [id]
                );

                if (pubResult.rowCount === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ message: "La publicación no existe." });
                }

                const publication = pubResult.rows[0];

                // 2. Fallar rápido si el usuario no es el autor.
                if (publication.author_username !== username) {
                    await client.query('ROLLBACK');
                    return res.status(403).json({ message: "No tienes permiso para modificar esta publicación." });
                }

                // 3. Si los permisos son correctos, proceder con la actualización.
                const newPausedState = !publication.is_paused;
                await client.query(
                    `UPDATE publications SET is_paused = $1 WHERE id = $2`,
                    [newPausedState, id]
                );

                await client.query('COMMIT');

                const message = newPausedState ? "Publicación pausada." : "Publicación reanudada.";
                res.status(200).json({ message, isPaused: newPausedState });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error en toggle-pause:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            } finally {
                if (client) client.release();
            }
        });

        // Ruta para OCULTAR una publicación
        app.post('/publications/:id/hide', requireAcceptedLegalByUsernameField(['username']), async (req, res) => {
            const { id } = req.params;
            const { username } = req.body;

            try {
                const sql = `INSERT INTO hidden_publications (publication_id, hider_username) VALUES ($1, $2) ON CONFLICT DO NOTHING`;
                await pool.query(sql, [id, username]);
                res.status(200).json({ message: "Publicación ocultada de tu vista." });
            } catch (error) {
                console.error("Error en /hide:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Ruta para DESHACER OCULTAR (Unhide)
        app.post('/publications/:id/unhide', requireAcceptedLegalByUsernameField(['username']), async (req, res) => {
            const { id } = req.params;
            const { username } = req.body;

            try {
                const sql = `DELETE FROM hidden_publications WHERE publication_id = $1 AND hider_username = $2`;
                await pool.query(sql, [id, username]);
                res.status(200).json({ message: "Publicación restaurada." });
            } catch (error) {
                console.error("Error en /unhide:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Ruta para obtener el perfil público de un usuario
        app.get('/users/:username/profile', async (req, res) => {
            const { username } = req.params;

            const client = await pool.connect();
            try {
                const settingsResult = await client.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'public_profiles_enabled'`);
                const isEnabled = settingsResult.rows[0]?.setting_value === 'true';

                if (!isEnabled) {
                    return res.status(404).json({ message: "Perfiles de usuario no encontrados." });
                }

                await client.query('BEGIN');

                const userSql = `SELECT username, average_rating, ratings_count, web3_wallet_address FROM users WHERE username = $1`;
                const userResult = await client.query(userSql, [username]);
                if (userResult.rowCount === 0) {
                    throw { status: 404, message: "Usuario no encontrado." };
                }
                const userProfile = userResult.rows[0];

                const ratingsSql = `SELECT rater_username, rating, comment, created_at FROM ratings WHERE ratee_username = $1 ORDER BY created_at DESC`;
                const ratingsResult = await client.query(ratingsSql, [username]);
                const ratings = ratingsResult.rows;

                await client.query('COMMIT');

                res.status(200).json({
                    user: userProfile,
                    ratings: ratings
                });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`Error al obtener el perfil de ${username}:`, error);
                res.status(error.status || 500).json({ message: error.message || "Error interno del servidor." });
            } finally {
                client.release();
            }
        });

        // --- Rutas de Administración ---

        // --- AUTENTICACIÓN ADMINISTRATIVA EXTRAÍDA A adminRoutes.js ---
        app.get('/api/admin/settings', verifyAdminToken, async (req, res) => {
            try {
                const result = await pool.query(`SELECT * FROM app_settings ORDER BY setting_key`);
                res.status(200).json(result.rows);
            } catch (error) {
                console.error("Error al obtener todas las configuraciones:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Ruta pública para obtener configuración de referidos
        app.get('/api/referral-settings', async (req, res) => {
            try {
                // Obtenemos todas las configuraciones relevantes de una vez
                const keys = [
                    'referral_reward_amount',
                    'referral_bonus_amount',
                    'referral_reward_after_expiry',
                    'referral_codes_expiry_date'
                ];
                
                const result = await pool.query(
                    'SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1)',
                    [keys]
                );

                const settings = {};
                result.rows.forEach(row => {
                    settings[row.setting_key] = row.setting_value;
                });

                // Lógica de compatibilidad/fallback
                const rewardAmount = settings['referral_reward_amount'] || settings['referral_bonus_amount'] || '0.00';
                
                res.status(200).json({
                    referral_reward_amount: rewardAmount,
                    referral_reward_after_expiry: settings['referral_reward_after_expiry'] || '0.00',
                    referral_codes_expiry_date: settings['referral_codes_expiry_date'] || null
                });
            } catch (error) {
                console.error("Error al obtener configuración de referidos:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Ruta pública para obtener la fecha de vigencia de códigos de referido
        app.get('/api/referral-expiry-date', async (req, res) => {
            try {
                const result = await pool.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'referral_codes_expiry_date'`);

                if (result.rows.length > 0 && result.rows[0].setting_value) {
                    res.status(200).json({ expiry_date: result.rows[0].setting_value });
                } else {
                    res.status(404).json({ message: "Fecha de vigencia no configurada." });
                }
            } catch (error) {
                console.error("Error al obtener fecha de vigencia:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        app.post('/api/admin/settings', verifyAdminToken, async (req, res) => {
            const { key, value } = req.body;
            if (!key || typeof value !== 'string') {
                return res.status(400).json({ message: "Se requiere 'key' y 'value'." });
            }
            try {
                // ──────────────────────────────────────────────────────────
                // GOVERNANCE GUARD: Si el sistema de gobernanza está activo,
                // los cambios de configuración DEBEN pasar por gobernanza.
                // El admin no puede saltarse el flujo de multifirma.
                // ──────────────────────────────────────────────────────────
                try {
                    const govCheck = await pool.query(
                        `SELECT COUNT(*) as count FROM governance_guardians WHERE status = 'active'`
                    );
                    if (parseInt(govCheck.rows[0].count, 10) > 0) {
                        return res.status(403).json({
                            message: `El sistema de gobernanza está activo. Los cambios de configuración deben realizarse a través del panel de gobernanza (Winton-Consensus). ` +
                                     `Crea una solicitud de tipo "config_change" con la clave "${key}" para que los guardianes la aprueben.`,
                            governance_required: true,
                            setting_key: key,
                        });
                    }
                } catch (govErr) {
                    // La tabla governance_guardians no existe aún (pre-migración 041): continuar sin bloqueo
                    if (govErr.code !== '42P01') throw govErr;
                }

                // FINTECH GUARD (fail-closed):
                // Si se intenta desactivar pre-launch, validamos que el esquema
                // soporte el flujo normal (usa user_id en red_token_debts y blue_token_escrows).
                if (key === 'pre_launch_mode_enabled' && value === 'false') {
                    const missing = [];

                    const rtdUserIdCol = await pool.query(
                        `SELECT 1
                         FROM information_schema.columns
                         WHERE table_name = 'red_token_debts' AND column_name = 'user_id'
                         LIMIT 1`
                    );
                    if (rtdUserIdCol.rowCount === 0) missing.push('red_token_debts.user_id');

                    const bteUserIdCol = await pool.query(
                        `SELECT 1
                         FROM information_schema.columns
                         WHERE table_name = 'blue_token_escrows' AND column_name = 'user_id'
                         LIMIT 1`
                    );
                    if (bteUserIdCol.rowCount === 0) missing.push('blue_token_escrows.user_id');

                    if (missing.length > 0) {
                        return res.status(409).json({
                            message:
                                `No se puede desactivar pre-launch todavía: faltan columnas requeridas (${missing.join(', ')}). ` +
                                `Aplica primero las migraciones de esquema (MIGRACIÓN 008 y 009) para evitar fallos al confirmar pagos.`,
                            missing_columns: missing,
                            required_migrations: ['008 (red_token_debts.user_id)', '009 (blue_token_escrows.user_id)']
                        });
                    }
                }

                const result = await pool.query(`UPDATE app_settings SET setting_value = $1 WHERE setting_key = $2 RETURNING *`, [value, key]);
                if (result.rowCount === 0) {
                    return res.status(404).json({ message: `Clave de configuración '${key}' no encontrada.` });
                }

                await logAuditEvent(pool, req, {
                    eventType: 'admin.settings.updated',
                    actorUsername: 'admin',
                    publicationId: null,
                    category: 'admin',
                    metadata: {
                        setting_key: key,
                        new_value: value
                    }
                });

                res.status(200).json({ message: `Configuración '${key}' actualizada.`, setting: result.rows[0] });
            } catch (error) {
                console.error("Error al actualizar la configuración:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Audit log (bank-grade traceability)
        app.get('/api/admin/audit-log', verifyAdminToken, async (req, res) => {
            try {
                // Filters (all optional). Limit capped for safety.
                const {
                    eventType = '',
                    actor = '',
                    target = '',
                    category = '',
                    from = '',
                    to = '',
                    limit = '50',
                    offset = '0'
                } = req.query;

                const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
                const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

                const conditions = [];
                const values = [];

                if (eventType) {
                    values.push(eventType);
                    conditions.push(`event_type = $${values.length}`);
                }
                if (actor) {
                    values.push(actor);
                    conditions.push(`actor_username = $${values.length}`);
                }
                if (target) {
                    values.push(target);
                    conditions.push(`target_username = $${values.length}`);
                }
                if (category) {
                    values.push(category);
                    conditions.push(`category = $${values.length}`);
                }
                if (from) {
                    values.push(from);
                    conditions.push(`created_at >= $${values.length}::timestamptz`);
                }
                if (to) {
                    values.push(to);
                    conditions.push(`created_at <= $${values.length}::timestamptz`);
                }

                const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

                // Use two queries to return total count + page data.
                const countResult = await pool.query(
                    `SELECT COUNT(*)::int AS total FROM audit_log ${whereClause}`,
                    values
                );

                values.push(safeLimit);
                values.push(safeOffset);

                const dataResult = await pool.query(
                    `SELECT id, event_type, actor_username, target_username, publication_id,
                        category, ip_address, user_agent, metadata, created_at
                 FROM audit_log
                 ${whereClause}
                 ORDER BY created_at DESC
                 LIMIT $${values.length - 1} OFFSET $${values.length}`,
                    values
                );

                res.status(200).json({
                    total: countResult.rows[0]?.total || 0,
                    limit: safeLimit,
                    offset: safeOffset,
                    rows: dataResult.rows
                });
            } catch (error) {
                console.error('Error al cargar audit log:', error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            }
        });

        // Endpoint para obtener todos los usuarios con filtros de búsqueda y estado
        // VERSIÓN DE DEPURACIÓN PROFESIONAL
        app.get('/api/admin/users', verifyAdminToken, async (req, res) => {
            // Micrófono 1: Nos dice si esta función se está ejecutando y con qué filtros.
            console.log(`[DEBUG] Petición recibida para /api/admin/users. Filtro de estado: '${req.query.status || 'ninguno'}'`);

            const { search = '', status = '' } = req.query;
            try {
                let sql = `
                SELECT 
                    u.id, 
                    u.username, 
                    u.liquid_blue_balance, 
                    u.escrow_blue_balance, 
                    u.red_balance, 
                    u.account_status as status,
                    u.average_rating, 
                    u.ratings_count, 
                    u.created_at,
                    u.referral_code,
                    u.web3_wallet_address,
                    COALESCE(SUM(bbl.amount), 0) as booster_blue_balance
                FROM 
                    users u
                LEFT JOIN 
                    booster_blue_ledger bbl ON u.id = bbl.user_id
                WHERE 
                    u.username ILIKE $1`;

                const params = [`%${search}%`];
                let paramIndex = 2;

                if (status) {
                    // Se añade la condición al WHERE antes del GROUP BY
                    sql += ` AND u.account_status = $${paramIndex++}`;
                    params.push(status);
                }

                // Se agrupa por todas las columnas seleccionadas de users (PostgreSQL es estricto)
                sql += ` GROUP BY u.id, u.username, u.liquid_blue_balance, u.escrow_blue_balance, u.red_balance, u.account_status, u.average_rating, u.ratings_count, u.created_at, u.referral_code, u.web3_wallet_address ORDER BY u.created_at DESC`;

                const result = await pool.query(sql, params);

                // Micrófono 2: Nos muestra los datos EXACTOS que la base de datos devuelve, antes de enviarlos.
                console.log('[DEBUG] Datos recibidos de la base de datos:', JSON.stringify(result.rows, null, 2));

                res.status(200).json(result.rows);
            } catch (error) {
                console.error("Error al obtener la lista de usuarios:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // NUEVO ENDPOINT PARA MODERACIÓN DE USUARIOS
        app.post('/api/admin/users/:userId/status', verifyAdminToken, async (req, res) => {
            const { userId } = req.params;
            const { status } = req.body;
            const validStatuses = ['active', 'suspended', 'banned'];

            if (!validStatuses.includes(status)) {
                return res.status(400).json({ message: 'Estado no válido.' });
            }

            try {
                // Evitar modificación de cuentas protegidas por política de seguridad.
                const targetUser = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);

                if (!targetUser.rows.length) {
                    return res.status(404).json({ message: 'Usuario no encontrado.' });
                }

                const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
                const adminUsername = process.env.ADMIN_USERNAME || 'admin';
                const protectedUsernames = new Set([
                    platformUsername.toLowerCase(),
                    adminUsername.toLowerCase()
                ]);

                if (protectedUsernames.has(String(targetUser.rows[0].username || '').toLowerCase())) {
                    return res.status(403).json({ message: 'No se puede cambiar el estado de una cuenta protegida del sistema.' });
                }

                const result = await pool.query(
                    'UPDATE users SET account_status = $1 WHERE id = $2 RETURNING id, username, account_status as status',
                    [status, userId]
                );

                if (result.rowCount === 0) {
                    return res.status(404).json({ message: 'Usuario no encontrado.' });
                }

                res.status(200).json({ message: `El estado del usuario ha sido actualizado a "${status}".`, user: result.rows[0] });

            } catch (error) {
                console.error("Error al actualizar el estado del usuario:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        app.get('/api/admin/debtors', verifyAdminToken, async (req, res) => {
            try {
                const sql = `
                    SELECT username, SUM(amount) AS total_penalized_debt, COUNT(*) AS penalized_debts_count
                    FROM red_token_debts WHERE is_penalized = TRUE AND is_settled = FALSE
                    GROUP BY username ORDER BY total_penalized_debt DESC
                `;
                const result = await pool.query(sql);
                res.status(200).json(result.rows);
            } catch (error) {
                console.error("Error al obtener la lista de deudores:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // REFACTOR PROFESIONAL: Delegamos la lógica al controlador especializado `adminController`.
        const adminController = require('./src/controllers/adminController');
        app.get('/api/admin/dashboard-stats', verifyAdminToken, adminController.getDashboardStats);

        // ENDPOINT PÚBLICO: Lista de Obligaciones Vencidas (LOVE)
        app.get('/api/love-list', async (req, res) => {
            try {
                const sql = `
                    SELECT
                        username,
                        SUM(amount) AS total_overdue_amount,
                        MIN(due_at) AS overdue_since,
                        COUNT(*) AS recurrence_count
                    FROM
                        red_token_debts
                    WHERE
                        is_penalized = TRUE AND is_settled = FALSE
                    GROUP BY
                        username
                    ORDER BY
                        overdue_since ASC;
                `;
                const result = await pool.query(sql);
                res.status(200).json(result.rows);
            } catch (error) {
                console.error("Error al obtener la Lista de Obligaciones Vencidas (LOVE):", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // --- NUEVO ENDPOINT PÚBLICO PARA CONFIGURACIONES ---
        app.get('/api/app-settings', async (req, res) => {
            try {
                const settingKeys = [
                    'public_profiles_enabled',
                    'referral_reward_amount',
                    'welcome_bonus_amount'
                    // Añadir aquí otras claves que el frontend necesite de forma segura
                ];
                const result = await pool.query(
                    'SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1::text[])',
                    [settingKeys]
                );

                const settingsObject = result.rows.reduce((acc, setting) => {
                    acc[setting.setting_key] = setting.setting_value;
                    return acc;
                }, {});

                res.status(200).json(settingsObject);

            } catch (error) {
                console.error("Error al obtener la configuración pública de la app:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // --- ENDPOINTS PARA BILLETERA DE PLATAFORMA (CORRECCIÓN) ---
        app.get('/api/admin/platform-wallet/balance', verifyAdminToken, async (req, res) => {
            const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
            const client = await pool.connect();
            try {
                // We run both queries in parallel for efficiency
                const [commissionResult, userResult] = await Promise.all([
                    client.query('SELECT total_blue_commission_balance FROM platform_wallet WHERE id = 1'),
                    client.query('SELECT liquid_blue_balance, escrow_blue_balance, red_balance FROM users WHERE username = $1', [platformUsername])
                ]);

                const commissionBalance = parseFloat(commissionResult.rows[0]?.total_blue_commission_balance || '0');

                if (userResult.rowCount === 0) {
                    // This is a critical error, the platform user should always exist.
                    throw new Error(`El usuario de la plataforma '${platformUsername}' no fue encontrado en la base de datos.`);
                }

                const userBalances = userResult.rows[0];

                res.json({
                    commissionBalance: commissionBalance,
                    liquidBlue: parseFloat(userBalances.liquid_blue_balance || '0'),
                    escrowBlue: parseFloat(userBalances.escrow_blue_balance || '0'),
                    redBalance: parseFloat(userBalances.red_balance || '0')
                });

            } catch (error) {
                console.error("Error al obtener el estado financiero de la plataforma:", error);
                res.status(500).json({ message: error.message || "Error interno del servidor." });
            } finally {
                client.release();
            }
        });

        app.get('/api/admin/platform-wallet/log', verifyAdminToken, async (req, res) => {
            try {
                const query = `
                    SELECT 
                        pcl.id,
                        pcl.commission_amount_blue,
                        pcl.created_at,
                        p.id as publication_id,
                        p.title as publication_title,
                        u.username as user_who_paid
                    FROM platform_commission_log pcl
                    LEFT JOIN publications p ON pcl.related_publication_id = p.id
                    LEFT JOIN transactions t ON pcl.related_user_transaction_id = t.id
                    LEFT JOIN users u ON t.user_id = u.id
                    ORDER BY pcl.created_at DESC
                `;
                const result = await pool.query(query);

                const logWithNullChecks = result.rows.map(entry => ({
                    ...entry,
                    publication_title: entry.publication_title || '(Publicación eliminada)',
                    user_who_paid: entry.user_who_paid || '(Usuario desconocido)'
                }));
                res.json(logWithNullChecks);

            } catch (error) {
                console.error("Error al obtener el log de comisiones:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Endpoint para obtener todas las publicaciones para el panel de administración
        app.get('/api/admin/publications', verifyAdminToken, async (req, res) => {
            const searchTerm = req.query.search || '';
            const filter = String(req.query.filter || 'active').toLowerCase();
            try {
                // Allowlist de filtros (evita inyecciones y comportamientos inesperados)
                const allowedFilters = new Set(['active', 'deleted', 'expired', 'completed', 'all']);
                const safeFilter = allowedFilters.has(filter) ? filter : 'active';

                let filterCondition = '';
                if (safeFilter === 'active') {
                    filterCondition = `AND p.deleted_at IS NULL AND (p.expires_at IS NULL OR p.expires_at >= NOW()) AND p.available_slots > 0 AND COALESCE(p.is_paused, FALSE) = FALSE`;
                } else if (safeFilter === 'deleted') {
                    filterCondition = `AND p.deleted_at IS NOT NULL`;
                } else if (safeFilter === 'expired') {
                    filterCondition = `AND p.deleted_at IS NULL AND p.expires_at IS NOT NULL AND p.expires_at < NOW()`;
                } else if (safeFilter === 'completed') {
                    // Definición práctica:
                    // - Quick sale: status != 'open'
                    // - Otros: todos los participantes (si existen) están confirmed_paid
                    filterCondition = `
                        AND p.deleted_at IS NULL
                        AND (
                            (COALESCE(p.is_quick_sale, FALSE) = TRUE AND p.status <> 'open')
                            OR
                            (p.available_slots <= 0)
                        )
                    `;
                } else if (safeFilter === 'all') {
                    filterCondition = ''; // Sin filtro extra
                }

                const query = `
                    SELECT
                        p.id, p.title, p.description, p.blue_cost, p.status, p.created_at, p.is_paused, p.is_sell_post, p.available_slots, p.category,
                        p.expires_at, p.deleted_at, p.deleted_by_username, p.is_quick_sale,
                        u.username AS author_username,
                        (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id) AS participants_count,
                        (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id AND pa.status = 'confirmed_paid') AS completed_count,
                        (p.deleted_at IS NOT NULL) AS is_deleted,
                        (p.expires_at IS NOT NULL AND p.expires_at < NOW()) AS is_expired,
                        (
                            CASE
                                WHEN COALESCE(p.is_quick_sale, FALSE) = TRUE THEN (p.status <> 'open')
                                ELSE (
                                    p.available_slots <= 0
                                )
                            END
                        ) AS is_completed_publication
                    FROM publications p
                    JOIN users u ON p.author_id = u.id
                    WHERE (p.title ILIKE $1 OR u.username ILIKE $1)
                    ${filterCondition}
                    ORDER BY p.created_at DESC
                `;
                const result = await pool.query(query, [`%${searchTerm}%`]);
                res.json(result.rows);
            } catch (error) {
                console.error('Error fetching all publications for admin:', error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            }
        });

        // Restaurar (undelete) una publicación eliminada (soft delete) - Solo Admin
        app.post('/api/admin/publications/:id/restore', verifyAdminToken, async (req, res) => {
            const { id } = req.params;
            try {
                const pubResult = await pool.query(
                    `SELECT id, category, deleted_at FROM publications WHERE id = $1`,
                    [id]
                );

                if (pubResult.rowCount === 0) {
                    return res.status(404).json({ message: 'Publicación no encontrada.' });
                }

                if (!pubResult.rows[0].deleted_at) {
                    return res.status(200).json({ success: true, message: 'La publicación no está eliminada.' });
                }

                await pool.query(
                    `UPDATE publications
                     SET deleted_at = NULL, deleted_by_username = NULL
                     WHERE id = $1`,
                    [id]
                );

                await logAuditEvent(pool, req, {
                    eventType: 'admin.publication.restored',
                    actorUsername: 'admin',
                    publicationId: parseInt(id, 10),
                    category: pubResult.rows[0].category,
                    metadata: { soft_delete: false, restored: true }
                });

                return res.json({ success: true, message: 'Publicación restaurada correctamente.' });
            } catch (error) {
                console.error(`Error restoring publication ${id} for admin:`, error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            }
        });

        // Endpoint para que un administrador elimine una publicación
        app.delete('/api/admin/publications/:id', verifyAdminToken, async (req, res) => {
            const { id } = req.params;
            try {
                const pubResult = await pool.query(
                    `SELECT id, category, deleted_at FROM publications WHERE id = $1`,
                    [id]
                );

                if (pubResult.rowCount === 0) {
                    return res.status(404).json({ message: 'Publicación no encontrada.' });
                }

                if (pubResult.rows[0].deleted_at) {
                    return res.status(200).json({ success: true, message: 'La publicación ya estaba eliminada.' });
                }

                // Soft delete en modo admin (sin romper integridad referencial)
                const updateResult = await pool.query(
                    `UPDATE publications
                     SET deleted_at = NOW(), deleted_by_username = 'admin'
                     WHERE id = $1`,
                    [id]
                );

                if (updateResult.rowCount === 0) {
                    return res.status(404).json({ message: 'Publicación no encontrada.' });
                }

                await logAuditEvent(pool, req, {
                    eventType: 'admin.publication.deleted',
                    actorUsername: 'admin',
                    publicationId: parseInt(id, 10),
                    category: pubResult.rows[0].category,
                    metadata: { soft_delete: true }
                });

                res.json({ success: true, message: 'Publicación eliminada (soft delete) correctamente.' });
            } catch (error) {
                console.error(`Error deleting publication ${id} for admin:`, error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            }
        });

        // --- ENDPOINTS PARA GESTIÓN SEGURA DE DATOS EXTRAÍDOS A adminRoutes.js ---

        // --- NUEVO: Endpoints para la gestión de Impulsores ---
        app.get('/api/admin/boosters/settings', verifyAdminToken, async (req, res) => {
            try {
                const result = await pool.query('SELECT * FROM booster_level_settings ORDER BY level ASC');
                res.json(result.rows);
            } catch (error) {
                console.error('Error fetching booster level settings:', error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            }
        });

        app.post('/api/admin/boosters/settings', verifyAdminToken, async (req, res) => {
            const { level, name, min_blue_required, description } = req.body;

            if (!level || !name || min_blue_required === undefined) {
                return res.status(400).json({ message: 'Faltan datos requeridos: nivel, nombre y BLUE mínimo.' });
            }
            try {
                // GOVERNANCE GUARD
                try {
                    const govCheck = await pool.query(
                        `SELECT COUNT(*) as count FROM governance_guardians WHERE status = 'active'`
                    );
                    if (parseInt(govCheck.rows[0].count, 10) > 0) {
                        return res.status(403).json({
                            message: 'El sistema de gobernanza está activo. Los cambios en niveles de impulsor deben realizarse a través del panel de gobernanza (Winton-Consensus).',
                            governance_required: true,
                        });
                    }
                } catch (govErr) {
                    if (govErr.code !== '42P01') throw govErr;
                }

                const result = await pool.query(
                    `UPDATE booster_level_settings 
                     SET name = $1, min_blue_required = $2, description = $3 
                     WHERE level = $4 RETURNING *`,
                    [name, min_blue_required, description, level]
                );
                if (result.rowCount === 0) {
                    return res.status(404).json({ message: `El nivel de impulsor ${level} no fue encontrado.` });
                }
                res.json({ message: 'Nivel de impulsor actualizado.', setting: result.rows[0] });
            } catch (error) {
                console.error('Error updating booster level setting:', error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            }
        });

        app.get('/api/admin/boosters/stats', verifyAdminToken, async (req, res) => {
            try {
                const statsQuery = `
                    SELECT
                        (SELECT COUNT(*) FROM users WHERE is_booster = TRUE) as total_boosters,
                        (SELECT SUM(amount) FROM booster_blue_ledger) as total_booster_blue_debt,
                        (SELECT COUNT(*) FROM booster_payment_log) as total_payments_made,
                        (SELECT SUM(amount_paid) FROM booster_payment_log) as total_blue_paid_out
                `;
                const result = await pool.query(statsQuery);
                res.json(result.rows[0]);
            } catch (error) {
                console.error('Error fetching booster stats:', error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            }
        });

        // ─── ADMIN: Recompensas de Gobernanza (Batch Processing) ─────────
        const governanceRewardService = require('./src/services/governanceRewardService');

        app.get('/api/admin/governance/reward-stats', verifyAdminToken, async (req, res) => {
            try {
                const stats = await governanceRewardService.getPendingRewardStats(pool);
                return res.json(stats);
            } catch (error) {
                console.error('[ADMIN] Error obteniendo stats de recompensas:', error);
                return res.status(500).json({ message: 'Error al obtener estadísticas de recompensas.' });
            }
        });

        app.post('/api/admin/governance/process-rewards', verifyAdminToken, async (req, res) => {
            try {
                const stats = await governanceRewardService.getPendingRewardStats(pool);
                if (stats.pendingCount === 0) {
                    return res.json({ message: 'No hay votos pendientes de recompensa.', totalProcessed: 0 });
                }
                if (stats.currentRate === 0) {
                    return res.status(400).json({
                        message: 'La tasa de recompensa está en 0. Configure gov_vote_reward_blue antes de procesar.',
                    });
                }

                const result = await governanceRewardService.processPendingRewards(pool, req.user.userId);

                // Enviar notificaciones consolidadas a cada guardián
                const notificationService = require('./src/services/notificationService');
                const { sendGovernanceEmail } = require('./src/services/emailService');

                for (const [userId, summary] of Object.entries(result.byGuardian)) {
                    const safeUserId = parseInt(userId, 10);

                    // Push TRANSACCIONAL (involucra acreditación de fondos)
                    notificationService.sendNotificationToUser(safeUserId, {
                        title: `+${summary.totalAmount.toFixed(2)} BLUE IOU acreditados`,
                        body: `Recompensa retroactiva por ${summary.votesPaid} voto(s) de gobernanza.`,
                        icon: '/assets/icons/icon-192x192.png',
                        data: { url: '/history.html' },
                    }, 'TRANSACTIONAL').catch(err =>
                        console.error(`[ADMIN] Error push batch reward user ${safeUserId}:`, err)
                    );

                    // Email consolidado
                    if (summary.email) {
                        const votesList = summary.requestIds
                            .map(id => `• Solicitud #${id}`)
                            .join('\n');

                        sendGovernanceEmail({
                            toEmail:  summary.email,
                            subject:  `+${summary.totalAmount.toFixed(2)} BLUE IOU — Recompensa retroactiva por votos de gobernanza`,
                            title:    `Recompensa acreditada: +${summary.totalAmount.toFixed(2)} BLUE IOU`,
                            body:
                                `Hola ${summary.username},\n\n` +
                                `Se han acreditado recompensas por tu participación en el sistema de ` +
                                `gobernanza Winton-Consensus. Este pago corresponde a votos emitidos ` +
                                `anteriormente que aún no habían sido compensados.\n\n` +
                                `Detalle de votos compensados:\n${votesList}`,
                            severity: 'success',
                            details: [
                                { label: 'Votos compensados',       value: String(summary.votesPaid) },
                                { label: 'Tasa por voto',           value: `${result.rateUsed.toFixed(2)} BLUE IOU` },
                                { label: 'Total acreditado',        value: `+${summary.totalAmount.toFixed(2)} BLUE IOU` },
                                { label: 'Nuevo saldo BLUE IOU',    value: `${summary.newBalance.toFixed(2)} BLUE IOU` },
                                { label: 'Procesado por',           value: 'Administrador' },
                            ],
                        }).catch(err =>
                            console.error(`[ADMIN] Error email batch reward user ${safeUserId}:`, err)
                        );
                    }
                }

                return res.json({
                    message: `${result.totalProcessed} voto(s) procesados exitosamente.`,
                    totalProcessed:    result.totalProcessed,
                    totalSkipped:      result.totalSkipped,
                    rateUsed:          result.rateUsed,
                    guardiansAffected: Object.keys(result.byGuardian).length,
                });
            } catch (error) {
                console.error('[ADMIN] Error procesando recompensas batch:', error);
                return res.status(500).json({ message: 'Error al procesar recompensas pendientes.' });
            }
        });

        // --- ENDPOINTS DE GESTIÓN GOBERNANZA DEMO EXTRAÍDOS A adminRoutes.js ---

        app.get('/api/admin/boosters/list', verifyAdminToken, async (req, res) => {
            try {
                const query = `
                    SELECT 
                        u.id,
                        u.username,
                        u.is_booster,
                        u.booster_level,
                        (SELECT SUM(amount) FROM booster_blue_ledger WHERE user_id = u.id) as total_booster_blue
                    FROM users u
                    WHERE u.is_booster = TRUE
                    ORDER BY total_booster_blue DESC
                `;
                const result = await pool.query(query);
                res.json(result.rows);
            } catch (error) {
                console.error('Error fetching boosters list:', error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            }
        });

        // --- NUEVO (PROFESIONAL): Rebuild de ledger/historial de impulsor para un usuario ---
        // Caso de uso: corregir historiales legacy que quedaron como "1 sola línea backfill".
        // Principio: NO inventar datos. Reconstruimos desde evidencia (booster_transactions) y, si falta,
        // añadimos solo una línea residual "saldo histórico no detallado".
        app.post('/api/admin/boosters/rebuild-ledger/:username', verifyAdminToken, async (req, res) => {
            const { username } = req.params;
            if (!username) {
                return res.status(400).json({ message: 'Se requiere username.' });
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const userResult = await client.query('SELECT id, username FROM users WHERE username = $1', [username]);
                if (userResult.rowCount === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ message: 'Usuario no encontrado.' });
                }
                const userId = userResult.rows[0].id;

                // 1) Leer total legacy (si existe) sin asumir (y sin actualizar balances).
                const legacyColResult = await client.query(`
                    SELECT EXISTS(
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='users' AND column_name='booster_blue_balance'
                    ) AS exists
                `);
                const legacyColExists = !!legacyColResult.rows[0]?.exists;
                let legacyTotal = null;
                if (legacyColExists) {
                    const legacyTotalResult = await client.query(
                        'SELECT booster_blue_balance FROM users WHERE id = $1',
                        [userId]
                    );
                    legacyTotal = parseFloat(legacyTotalResult.rows[0]?.booster_blue_balance || '0') || 0;
                }

                // 2) Limpiar solo “backfills” artificiales en booster_transactions (no borramos evidencia real).
                // Nota: si tienes tipos legacy diferentes, los agregamos aquí.
                const deleteLegacyTx = await client.query(
                    `DELETE FROM booster_transactions
                     WHERE user_id = $1 AND type IN ('legacy_backfill', 'legacy_backfill_residual')`,
                    [userId]
                );

                // 3) Rebuild total del ledger desde booster_transactions (evidencia real)
                const deletedLedger = await client.query('DELETE FROM booster_blue_ledger WHERE user_id = $1', [userId]);

                const insertedFromTx = await client.query(
                    `
                    INSERT INTO booster_blue_ledger (user_id, amount, source_publication_id, created_at)
                    SELECT
                        bt.user_id,
                        bt.amount,
                        bt.related_publication_id,
                        bt.created_at
                    FROM booster_transactions bt
                    WHERE bt.user_id = $1
                    ORDER BY bt.created_at ASC
                    RETURNING id
                    `,
                    [userId]
                );

                const sumTxResult = await client.query(
                    'SELECT COALESCE(SUM(amount), 0) AS total FROM booster_transactions WHERE user_id = $1',
                    [userId]
                );
                const sumTx = parseFloat(sumTxResult.rows[0]?.total || '0') || 0;

                // 4) Si el total legacy existe y es mayor que lo evidenciado, añadimos residual (1 línea) y lo registramos
                // para que el usuario vea claramente que es histórico no detallado.
                let residualAdded = 0;
                if (legacyColExists && legacyTotal !== null) {
                    const diff = legacyTotal - sumTx;
                    if (diff > 0.00009) {
                        const residualTx = await client.query(
                            `INSERT INTO booster_transactions (user_id, type, amount, description, related_publication_id)
                             VALUES ($1, 'legacy_backfill_residual', $2, $3, NULL)
                             RETURNING id, created_at`,
                            [userId, diff, 'Saldo histórico no detallado (diferencia vs evidencia histórica)']
                        );

                        await client.query(
                            `INSERT INTO booster_blue_ledger (user_id, amount, source_publication_id, created_at)
                             VALUES ($1, $2, NULL, $3)`,
                            [userId, diff, residualTx.rows[0].created_at]
                        );
                        residualAdded = diff;
                    }
                }

                const newLedgerTotalResult = await client.query(
                    'SELECT COALESCE(SUM(amount), 0) AS total FROM booster_blue_ledger WHERE user_id = $1',
                    [userId]
                );
                const newLedgerTotal = parseFloat(newLedgerTotalResult.rows[0]?.total || '0') || 0;

                await logAuditEvent(client, req, {
                    eventType: 'booster.ledger_rebuilt',
                    actorUsername: 'admin',
                    targetUsername: username,
                    category: 'admin',
                    metadata: {
                        user_id: userId,
                        legacy_total: legacyTotal,
                        sum_transactions: sumTx,
                        new_ledger_total: newLedgerTotal,
                        deleted_ledger_rows: deletedLedger.rowCount,
                        inserted_ledger_rows: insertedFromTx.rowCount + (residualAdded > 0 ? 1 : 0),
                        deleted_legacy_transactions: deleteLegacyTx.rowCount,
                        residual_added: residualAdded
                    }
                });

                await client.query('COMMIT');
                res.status(200).json({
                    success: true,
                    message: `Ledger reconstruido para ${username}.`,
                    results: {
                        user_id: userId,
                        legacy_total: legacyTotal,
                        sum_transactions: sumTx,
                        new_ledger_total: newLedgerTotal,
                        deleted_ledger_rows: deletedLedger.rowCount,
                        inserted_ledger_rows: insertedFromTx.rowCount + (residualAdded > 0 ? 1 : 0),
                        deleted_legacy_transactions: deleteLegacyTx.rowCount,
                        residual_added: residualAdded
                    }
                });
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error rebuild-ledger:', error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            } finally {
                client.release();
            }
        });

        // Endpoint para que un administrador cree una publicación como la plataforma
        app.post('/api/admin/platform/create-publication', verifyAdminToken, async (req, res) => {
            const { title, description, cost: costString, availableSlots: slotsString, isSellPost, autoApprove, isBoosterTask, allowRepeatParticipation, maxRepeatPerUser, repeatCooldownHours, repeatCooldownDays, repeatCooldownMinutes, targetUsername, formFields } = req.body;

            if (!title || !description || !costString) {
                return res.status(400).json({ message: "Faltan datos: título, descripción y costo son requeridos." });
            }

            const cost = parseFloat(costString.toString().replace(',', '.'));
            if (isNaN(cost) || cost <= 0) {
                return res.status(400).json({ message: "El costo debe ser un número positivo." });
            }

            const slots = slotsString ? parseInt(slotsString, 10) : 1;
            if (isNaN(slots) || slots < 1) {
                return res.status(400).json({ message: "La cantidad de cupos debe ser mayor a 0." });
            }

            const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
            const allowRepeat = !!allowRepeatParticipation;
            let maxRepeat = null;
            let repeatCooldown = 24;
            if (allowRepeat) {
                maxRepeat = parseInt(maxRepeatPerUser, 10);
                if (!Number.isFinite(maxRepeat) || maxRepeat < 2) {
                    return res.status(400).json({ message: "Indica el máximo de repeticiones por usuario (mínimo 2)." });
                }
                repeatCooldown = resolveRepeatCooldownHours({
                    repeatCooldownDays,
                    repeatCooldownHours,
                    repeatCooldownMinutes
                });
            } else {
                maxRepeat = 1;
                repeatCooldown = 24;
            }

            // Validar target_username si se especifica (publicación dirigida)
            let sanitizedTargetUsername = null;
            if (targetUsername && targetUsername.trim() !== '') {
                sanitizedTargetUsername = targetUsername.trim();
                const targetUserResult = await pool.query(`SELECT id FROM users WHERE username = $1`, [sanitizedTargetUsername]);
                if (targetUserResult.rowCount === 0) {
                    return res.status(400).json({ message: `El usuario "${sanitizedTargetUsername}" no existe.` });
                }
            }

            try {
                const userResult = await pool.query(`SELECT id FROM users WHERE username = $1`, [platformUsername]);
                if (userResult.rowCount === 0) {
                    return res.status(500).json({ message: "Error crítico: El usuario de la plataforma no se encuentra." });
                }
                const authorId = userResult.rows[0].id;

                // ──────────────────────────────────────────────────────────
                // VALIDACIÓN Y SANITIZACIÓN DE form_fields (NIVEL FINTECH)
                // ──────────────────────────────────────────────────────────
                // Cada paso puede tener un array de campos. Cada campo puede ser:
                //   - string  (formato legacy retrocompatible → se convierte a {label, type:'text'})
                //   - object  {label: string, type: 'text'|'textarea'}
                // Reglas de seguridad:
                //   1. Solo se aceptan tipos explícitamente permitidos (whitelist)
                //   2. Máximo 20 pasos, 10 campos por paso (DoS prevention)
                //   3. Labels truncados a 200 caracteres (previene payload oversize)
                //   4. Se elimina cualquier propiedad no reconocida (defense in depth)
                // ──────────────────────────────────────────────────────────
                const ALLOWED_FIELD_TYPES = ['text', 'textarea']; // Whitelist estricta de tipos
                const MAX_STEPS = 20;          // Máximo de pasos permitidos
                const MAX_FIELDS_PER_STEP = 10; // Máximo de campos por paso
                const MAX_LABEL_LENGTH = 200;  // Longitud máxima del label de un campo

                let sanitizedFormFields = null;
                if (formFields && typeof formFields === 'object' && Object.keys(formFields).length > 0) {
                    const sanitized = {};
                    const stepKeys = Object.keys(formFields).slice(0, MAX_STEPS);

                    for (const stepKey of stepKeys) {
                        // Validar que la clave del paso sea numérica (previene inyección de claves)
                        const stepNum = parseInt(stepKey, 10);
                        if (!Number.isFinite(stepNum) || stepNum < 1 || stepNum > MAX_STEPS) continue;

                        const fields = formFields[stepKey];
                        if (!Array.isArray(fields)) continue;

                        const sanitizedFields = [];
                        for (const field of fields.slice(0, MAX_FIELDS_PER_STEP)) {
                            // Formato legacy: string simple → convertir a objeto tipado
                            if (typeof field === 'string') {
                                const trimmed = field.trim().substring(0, MAX_LABEL_LENGTH);
                                if (trimmed) {
                                    sanitizedFields.push({ label: trimmed, type: 'text' });
                                }
                            // Formato nuevo: objeto con label y type
                            } else if (field && typeof field === 'object' && typeof field.label === 'string') {
                                const label = field.label.trim().substring(0, MAX_LABEL_LENGTH);
                                // Solo aceptar tipos de la whitelist (defense in depth)
                                const type = ALLOWED_FIELD_TYPES.includes(field.type) ? field.type : 'text';
                                if (label) {
                                    // Solo almacenar propiedades conocidas (strip unknown props)
                                    sanitizedFields.push({ label, type });
                                }
                            }
                            // Cualquier otro tipo de dato se ignora silenciosamente (seguridad)
                        }

                        if (sanitizedFields.length > 0) {
                            sanitized[String(stepNum)] = sanitizedFields;
                        }
                    }

                    sanitizedFormFields = Object.keys(sanitized).length > 0 ? sanitized : null;
                }

                const sql = `
                    INSERT INTO publications (title, description, blue_cost, is_sell_post, author_id, available_slots, auto_approve, is_booster_task, allow_repeat_participation, max_repeat_per_user, repeat_cooldown_hours, target_username, form_fields, show_preflight_modal) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
                    RETURNING id
                `;
                const result = await pool.query(sql, [title, description, cost, !!isSellPost, authorId, slots, !!autoApprove, !!isBoosterTask, allowRepeat, maxRepeat, repeatCooldown, sanitizedTargetUsername, sanitizedFormFields, !!req.body.showPreflightModal]);

                const newPubId = result.rows[0].id;

                // Auditoría: registrar creación con target_username si aplica
                await logAuditEvent(pool, req, {
                    eventType: 'admin.platform_publication.created',
                    actorUsername: 'admin',
                    targetUsername: sanitizedTargetUsername,
                    publicationId: newPubId,
                    category: 'platform',
                    metadata: {
                        title: title,
                        cost: cost,
                        is_targeted: !!sanitizedTargetUsername
                    }
                });

                const message = sanitizedTargetUsername
                    ? `Publicación creada exitosamente. Visible solo para: ${sanitizedTargetUsername}`
                    : "Publicación de la plataforma creada exitosamente.";

                res.status(201).json({ message, publicationId: newPubId });

                // PUSH NOTIFICATION BROADCAST (Notificar a todos)
                try {
                    console.log(`[ROUTE DIAGNOSTIC] 🔔 Disparando notificación push oficial para: ${title}`);
                    await notificationService.sendNotificationToAll({
                        title: '🚀 Nueva Tarea Oficial',
                        body: `¡Nueva oportunidad! 📝 ${title}. Participa ahora para ganar BLUE IOU.`,
                        icon: '/assets/icons/icon-192x192.png',
                        badge: '/assets/icons/icon-72x72.png',
                        data: { url: '/dashboard.html' }
                    }, 'SOCIAL');
                } catch (pushErr) {
                    console.error("[PUSH DIAGNOSTIC] Error al disparar broadcast oficial:", pushErr.message);
                }

            } catch (error) {
                console.error("Error al crear publicación de la plataforma:", error);
                return res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Endpoint para que un administrador edite una publicación de la plataforma
        app.put('/api/admin/platform/publications/:id', verifyAdminToken, async (req, res) => {
            const { id } = req.params;
            const { title, description, cost: costString, availableSlots: slotsString, isSellPost, autoApprove, isBoosterTask, allowRepeatParticipation, maxRepeatPerUser, repeatCooldownHours, repeatCooldownDays, repeatCooldownMinutes, targetUsername, formFields } = req.body;

            if (!title || !description || !costString) {
                return res.status(400).json({ message: "Faltan datos: título, descripción y costo son requeridos." });
            }

            const cost = parseFloat(costString.toString().replace(',', '.'));
            if (isNaN(cost) || cost <= 0) {
                return res.status(400).json({ message: "El costo debe ser un número positivo." });
            }

            const slots = slotsString ? parseInt(slotsString, 10) : 1;
            if (isNaN(slots) || slots < 1) {
                return res.status(400).json({ message: "La cantidad de cupos debe ser mayor a 0." });
            }

            const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
            const allowRepeat = !!allowRepeatParticipation;
            let maxRepeat = null;
            let repeatCooldown = 24;
            if (allowRepeat) {
                maxRepeat = parseInt(maxRepeatPerUser, 10);
                if (!Number.isFinite(maxRepeat) || maxRepeat < 2) {
                    return res.status(400).json({ message: "Indica el máximo de repeticiones por usuario (mínimo 2)." });
                }
                repeatCooldown = resolveRepeatCooldownHours({
                    repeatCooldownDays,
                    repeatCooldownHours,
                    repeatCooldownMinutes
                });
            } else {
                maxRepeat = 1;
                repeatCooldown = 24;
            }

            try {
                const ownership = await pool.query(
                    `SELECT p.id
                     FROM publications p
                     JOIN users u ON p.author_id = u.id
                     WHERE p.id = $1 AND u.username = $2`,
                    [id, platformUsername]
                );

                if (ownership.rowCount === 0) {
                    return res.status(404).json({ message: "La publicación no pertenece a la plataforma." });
                }

                // Validar target_username si se especifica (publicación dirigida)
                let sanitizedTargetUsername = null;
                if (targetUsername && targetUsername.trim() !== '') {
                    sanitizedTargetUsername = targetUsername.trim();
                    const targetUserResult = await pool.query(`SELECT id FROM users WHERE username = $1`, [sanitizedTargetUsername]);
                    if (targetUserResult.rowCount === 0) {
                        return res.status(400).json({ message: `El usuario "${sanitizedTargetUsername}" no existe.` });
                    }
                }

                // ──────────────────────────────────────────────────────────
                // VALIDACIÓN Y SANITIZACIÓN DE form_fields (NIVEL FINTECH)
                // ──────────────────────────────────────────────────────────
                // Reutiliza la misma lógica de validación que el endpoint de creación.
                // Reglas: whitelist de tipos, límite de pasos/campos, truncado de labels.
                // ──────────────────────────────────────────────────────────
                const ALLOWED_FIELD_TYPES_EDIT = ['text', 'textarea'];
                const MAX_STEPS_EDIT = 20;
                const MAX_FIELDS_PER_STEP_EDIT = 10;
                const MAX_LABEL_LENGTH_EDIT = 200;

                let sanitizedFormFields = null;
                if (formFields && typeof formFields === 'object' && Object.keys(formFields).length > 0) {
                    const sanitized = {};
                    const stepKeys = Object.keys(formFields).slice(0, MAX_STEPS_EDIT);

                    for (const stepKey of stepKeys) {
                        const stepNum = parseInt(stepKey, 10);
                        if (!Number.isFinite(stepNum) || stepNum < 1 || stepNum > MAX_STEPS_EDIT) continue;

                        const fields = formFields[stepKey];
                        if (!Array.isArray(fields)) continue;

                        const sanitizedFields = [];
                        for (const field of fields.slice(0, MAX_FIELDS_PER_STEP_EDIT)) {
                            if (typeof field === 'string') {
                                const trimmed = field.trim().substring(0, MAX_LABEL_LENGTH_EDIT);
                                if (trimmed) sanitizedFields.push({ label: trimmed, type: 'text' });
                            } else if (field && typeof field === 'object' && typeof field.label === 'string') {
                                const label = field.label.trim().substring(0, MAX_LABEL_LENGTH_EDIT);
                                const type = ALLOWED_FIELD_TYPES_EDIT.includes(field.type) ? field.type : 'text';
                                if (label) sanitizedFields.push({ label, type });
                            }
                        }

                        if (sanitizedFields.length > 0) {
                            sanitized[String(stepNum)] = sanitizedFields;
                        }
                    }

                    sanitizedFormFields = Object.keys(sanitized).length > 0 ? sanitized : null;
                }

                const updateSql = `
                    UPDATE publications
                    SET title = $1,
                        description = $2,
                        blue_cost = $3,
                        is_sell_post = $4,
                        available_slots = $5,
                        auto_approve = $6,
                        is_booster_task = $7,
                        allow_repeat_participation = $8,
                        max_repeat_per_user = $9,
                        repeat_cooldown_hours = $10,
                        target_username = $11,
                        form_fields = $12,
                        show_preflight_modal = $13,
                        updated_at = NOW()
                    WHERE id = $14
                `;

                await pool.query(updateSql, [
                    title,
                    description,
                    cost,
                    !!isSellPost,
                    slots,
                    !!autoApprove,
                    !!isBoosterTask,
                    allowRepeat,
                    maxRepeat,
                    repeatCooldown,
                    sanitizedTargetUsername,
                    sanitizedFormFields,
                    !!req.body.showPreflightModal,
                    id
                ]);

                res.json({ message: "Publicación de la plataforma actualizada exitosamente." });
            } catch (error) {
                console.error("Error al editar publicación de la plataforma:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // NUEVO: Endpoint para obtener las publicaciones de la plataforma con sus participantes para gestionarlas
        app.get('/api/admin/platform/publications-with-participants', verifyAdminToken, async (req, res) => {
            const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
            try {
                const query = `
                    SELECT
                        p.id, p.title, p.description, p.created_at, p.status, p.is_paused,
                        p.blue_cost, p.available_slots, p.is_sell_post, p.allow_repeat_participation, p.max_repeat_per_user, p.repeat_cooldown_hours,
                        p.expires_at, p.deleted_at, p.deleted_by_username, p.is_quick_sale, p.auto_approve, p.is_booster_task, p.target_username, p.form_fields,
                        u.username as author_username,
                        (
                            SELECT json_agg(json_build_object(
                                'acceptor_username', pa.acceptor_username,
                                'status', pa.status,
                                'accepted_at', pa.created_at,
                                'average_rating', u_participant.average_rating,
                                'ratings_count', u_participant.ratings_count,
                                'form_responses', pa.form_responses
                            ) ORDER BY 
                                CASE WHEN pa.status = 'pending' THEN 1 ELSE 2 END ASC,
                                CASE WHEN pa.status = 'pending' THEN pa.created_at END ASC,
                                pa.created_at DESC
                            )
                            FROM publication_acceptances pa
                            JOIN users u_participant ON pa.acceptor_username = u_participant.username
                            WHERE pa.publication_id = p.id
                        ) as participants
                        ,
                        (p.deleted_at IS NOT NULL) AS is_deleted,
                        (p.expires_at IS NOT NULL AND p.expires_at < NOW()) AS is_expired,
                        (
                            CASE
                                WHEN COALESCE(p.is_quick_sale, FALSE) = TRUE THEN (p.status <> 'open')
                                ELSE (
                                    p.available_slots <= 0
                                )
                            END
                        ) AS is_completed_publication
                    FROM
                        publications p
                    JOIN
                        users u ON p.author_id = u.id
                    WHERE
                        u.username = $1
                    ORDER BY
                        p.created_at DESC;
                `;
                const result = await pool.query(query, [platformUsername]);

                // Asegurarse de que el campo de participantes nunca sea nulo, sino un array vacío.
                const publications = result.rows.map(p => ({
                    ...p,
                    participants: p.participants || [],
                }));

                res.json(publications);
            } catch (error) {
                console.error('Error fetching platform publications for admin:', error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            }
        });

        app.get('/api/settings', async (req, res) => {
            try {
                const sql = `
                    SELECT setting_key, setting_value FROM app_settings 
                    WHERE setting_key IN (
                        'public_profiles_enabled', 
                        'allow_new_registrations', 
                        'allow_new_publications',
                        'platform_commission_percentage'
                    )
                `;
                const result = await pool.query(sql);
                const settings = result.rows.reduce((acc, row) => {
                    // El porcentaje lo devolvemos como número, el resto como booleano.
                    if (row.setting_key === 'platform_commission_percentage') {
                        acc[row.setting_key] = parseFloat(row.setting_value) || 0;
                    } else {
                        acc[row.setting_key] = row.setting_value === 'true';
                    }
                    return acc;
                }, {});
                res.status(200).json(settings);
            } catch (error) {
                console.error("Error al obtener la configuración pública:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // --- Procesos en segundo plano ---

        // Función reutilizable y centralizada para la quema de tokens
        async function executeBurn(client, username, amountToBurn) {
            if (amountToBurn <= 0) {
                return { success: false, message: 'La cantidad a quemar debe ser positiva.', actualAmountBurned: 0 };
            }

            // 1. Obtener saldos y deudas del usuario dentro de una transacción
            const userResult = await client.query(
                `SELECT id, liquid_blue_balance, escrow_blue_balance, red_balance FROM users WHERE username = $1 FOR UPDATE`,
                [username]
            );

            if (userResult.rowCount === 0) {
                return { success: false, message: 'Usuario no encontrado.', actualAmountBurned: 0 };
            }

            const user = userResult.rows[0];
            const userId = user.id;
            const liquidBlue = parseFloat(user.liquid_blue_balance);
            const escrowBlue = parseFloat(user.escrow_blue_balance);
            const totalBlueAvailable = liquidBlue + escrowBlue;
            const totalRed = parseFloat(user.red_balance);

            // Determinar la cantidad real que se puede quemar (la más pequeña entre BLUE disponible, RED disponible y la cantidad solicitada)
            const actualAmountToBurn = Math.min(amountToBurn, totalBlueAvailable, totalRed);

            if (actualAmountToBurn < 0.0001) { // Usamos un umbral pequeño para evitar problemas de punto flotante
                return { success: true, message: 'No hay saldo suficiente para quemar.', actualAmountBurned: 0 };
            }

            // 2. Determinar cuánto se quema de cada tipo de saldo BLUE
            const burnedFromLiquid = Math.min(actualAmountToBurn, liquidBlue);
            const burnedFromEscrow = actualAmountToBurn - burnedFromLiquid;

            // 3. Saldar deudas RED (las más antiguas primero)
            const debtsResult = await client.query(
                `SELECT id, amount FROM red_token_debts WHERE username = $1 AND is_settled = FALSE ORDER BY due_at ASC FOR UPDATE`,
                [username]
            );

            let remainingToSettle = actualAmountToBurn;
            for (const debt of debtsResult.rows) {
                if (remainingToSettle <= 0) break;

                const amountFromThisDebt = Math.min(remainingToSettle, parseFloat(debt.amount));
                const newDebtAmount = parseFloat(debt.amount) - amountFromThisDebt;

                if (newDebtAmount < 0.0001) {
                    // CORRECCIÓN: Si la deuda se paga por completo, la marcamos como saldada antes de eliminarla.
                    // Esto cumple con las reglas económicas y permite auditoría adecuada.
                    await client.query(`UPDATE red_token_debts SET is_settled = TRUE WHERE id = $1`, [debt.id]);
                    await client.query(`DELETE FROM red_token_debts WHERE id = $1`, [debt.id]);
                } else {
                    // Si el pago es parcial, solo actualizamos el monto restante.
                    await client.query(`UPDATE red_token_debts SET amount = $1 WHERE id = $2`, [newDebtAmount, debt.id]);
                }
                remainingToSettle -= amountFromThisDebt;
            }

            // 4. Consumir de los depósitos BLUE en escrow si es necesario
            if (burnedFromEscrow > 0.0001) {
                const escrowLotsResult = await client.query(
                    `SELECT id, amount FROM blue_token_escrows WHERE username = $1 AND is_released = FALSE ORDER BY unlock_at ASC FOR UPDATE`,
                    [username]
                );

                let remainingToConsumeFromEscrow = burnedFromEscrow;
                for (const escrowLot of escrowLotsResult.rows) {
                    if (remainingToConsumeFromEscrow <= 0) break;

                    const amountFromThisLot = Math.min(remainingToConsumeFromEscrow, parseFloat(escrowLot.amount));
                    const newEscrowLotAmount = parseFloat(escrowLot.amount) - amountFromThisLot;

                    if (newEscrowLotAmount < 0.0001) {
                        await client.query(`DELETE FROM blue_token_escrows WHERE id = $1`, [escrowLot.id]);
                    } else {
                        await client.query(`UPDATE blue_token_escrows SET amount = $1 WHERE id = $2`, [newEscrowLotAmount, escrowLot.id]);
                    }
                    remainingToConsumeFromEscrow -= amountFromThisLot;
                }
            }

            // 5. Actualizar los saldos principales del usuario (Event Sourcing)
            if (burnedFromLiquid > 0) {
                await client.query(`SELECT record_balance_event($1, 'burn', 'liquid_blue', $2, NULL)`, [userId, burnedFromLiquid]);
            }
            if (burnedFromEscrow > 0) {
                await client.query(`SELECT record_balance_event($1, 'burn', 'escrow_blue', $2, NULL)`, [userId, burnedFromEscrow]);
            }
            if (actualAmountToBurn > 0) {
                await client.query(`SELECT record_balance_event($1, 'burn', 'red', $2, NULL)`, [userId, actualAmountToBurn]);
            }

            // 6. Registrar la transacción
            const burnDesc = `Quemaste ${actualAmountToBurn.toFixed(4)} tokens. Se usaron ${burnedFromLiquid.toFixed(4)} BLUE (disponible) y ${burnedFromEscrow.toFixed(4)} BLUE (pendiente).`;
            await client.query(
                `INSERT INTO transactions (user_id, type, description, blue_change, red_change) VALUES ($1, 'burn', $2, $3, $4)`,
                [userId, burnDesc, -actualAmountToBurn, -actualAmountToBurn]
            );

            return { success: true, message: `Se han quemado ${actualAmountToBurn.toFixed(4)} tokens exitosamente.`, actualAmountBurned: actualAmountToBurn };
        }

        const DEBT_COLLECTOR_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos
        setInterval(async () => {
            console.log('DEBT COLLECTOR: Iniciando ciclo de recolección de deudas vencidas...');
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const settingsResult = await client.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'debt_system_enabled'`);
                const isDebtSystemEnabled = settingsResult.rows[0]?.setting_value === 'true';

                if (!isDebtSystemEnabled) {
                    console.log('DEBT COLLECTOR: El sistema de deudas está desactivado. Saltando ciclo.');
                    await client.query('ROLLBACK');
                    return;
                }

                // 1. Obtener todas las deudas vencidas, no saldadas y no penalizadas, agrupadas por usuario
                const overdueDebtsResult = await client.query(`
                    SELECT username, SUM(amount) as total_due
                    FROM red_token_debts
                    WHERE due_at <= NOW() AND is_settled = FALSE AND is_penalized = FALSE
                    GROUP BY username
                `);

                if (overdueDebtsResult.rowCount === 0) {
                    console.log('DEBT COLLECTOR: No se encontraron deudas vencidas para procesar.');
                    await client.query('ROLLBACK');
                    return;
                }

                console.log(`DEBT COLLECTOR: Se encontraron deudas vencidas para ${overdueDebtsResult.rowCount} usuario(s).`);

                // 2. Procesar cada usuario con deudas vencidas
                for (const userDebt of overdueDebtsResult.rows) {
                    const { username, total_due } = userDebt;
                    const amountToSettle = parseFloat(total_due);

                    // La función executeBurn ya determina el máximo posible a quemar.
                    // Le pasamos el total de la deuda y ella hará el resto.
                    console.log(`DEBT COLLECTOR: Intentando saldar ${amountToSettle.toFixed(4)} RED para el usuario ${username}.`);
                    const burnResult = await executeBurn(client, username, amountToSettle);

                    if (burnResult.success && burnResult.actualAmountBurned > 0) {
                        const notificationMessage = `Se realizó una quema automática de ${burnResult.actualAmountBurned.toFixed(4)} tokens para cubrir tu deuda vencida.`;
                        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [username, notificationMessage]);
                        console.log(`DEBT COLLECTOR: Quema automática exitosa para ${username}. Cantidad: ${burnResult.actualAmountBurned.toFixed(4)}`);
                    } else {
                        console.log(`DEBT COLLECTOR: No se pudo realizar la quema automática para ${username}. Mensaje: ${burnResult.message}`);
                    }

                    // 3. Marcar las deudas restantes (si las hay) como penalizadas
                    await client.query(
                        `UPDATE red_token_debts SET is_penalized = TRUE WHERE username = $1 AND due_at <= NOW() AND is_settled = FALSE`,
                        [username]
                    );
                }

                await client.query('COMMIT');
                console.log('DEBT COLLECTOR: Ciclo de recolección finalizado exitosamente.');

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('DEBT COLLECTOR: Error crítico durante el ciclo de recolección de deudas.', error);
            } finally {
                client.release();
            }
        }, DEBT_COLLECTOR_INTERVAL_MS);

        const TOKEN_RELEASER_INTERVAL_MS = 1 * 60 * 1000; // 1 minuto
        setInterval(async () => {
            console.log('TOKEN RELEASER: Iniciando ciclo de liberación de tokens BLUE...');
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. Obtener todos los depósitos vencidos y no liberados, agrupados por usuario
                const overdueEscrowsResult = await client.query(`
                    SELECT 
                        user_id,
                        username, 
                        SUM(amount) as total_to_release,
                        array_agg(id) as escrow_ids
                    FROM blue_token_escrows
                    WHERE unlock_at <= NOW() AND is_released = FALSE
                    GROUP BY user_id, username
                `);

                if (overdueEscrowsResult.rowCount === 0) {
                    console.log('TOKEN RELEASER: No se encontraron tokens para liberar.');
                    await client.query('ROLLBACK'); // No need to keep transaction open
                    return;
                }

                console.log(`TOKEN RELEASER: Se encontraron depósitos para liberar para ${overdueEscrowsResult.rowCount} usuario(s).`);

                // 2. Procesar cada usuario con depósitos a liberar
                for (const userEscrow of overdueEscrowsResult.rows) {
                    const { user_id, username, total_to_release, escrow_ids } = userEscrow;
                    const amountToRelease = parseFloat(total_to_release);

                    if (amountToRelease <= 0) continue;

                    console.log(`TOKEN RELEASER: Liberando ${amountToRelease.toFixed(4)} BLUE para el usuario ${username}.`);

                    // 3. Actualizar saldos del usuario (Event Sourcing)
                    // Restar de Escrow (usamos 'withdrawal' que resta)
                    await client.query(`SELECT record_balance_event($1, 'withdrawal', 'escrow_blue', $2, NULL)`, [user_id, amountToRelease]);
                    // Sumar a Líquido (usamos 'deposit' que suma)
                    await client.query(`SELECT record_balance_event($1, 'deposit', 'liquid_blue', $2, NULL)`, [user_id, amountToRelease]);

                    // 4. Marcar los depósitos como liberados
                    await client.query(
                        `UPDATE blue_token_escrows SET is_released = TRUE WHERE id = ANY($1::int[])`,
                        [escrow_ids]
                    );

                    // 5. Crear una transacción para el historial
                    const releaseDesc = `Se han liberado ${amountToRelease.toFixed(4)} BLUE que estaban en depósito.`;
                    await client.query(
                        `INSERT INTO transactions (user_id, type, description, blue_change, red_change) VALUES ($1, 'escrow_release', $2, $3, 0)`,
                        [user_id, releaseDesc, amountToRelease]
                    );

                    // 6. Enviar notificación al usuario
                    const notificationMessage = `¡Buenas noticias! ${amountToRelease.toFixed(4)} BLUE de tu saldo pendiente ya están disponibles.`;
                    await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [username, notificationMessage]);
                }

                await client.query('COMMIT');
                console.log('TOKEN RELEASER: Ciclo de liberación finalizado exitosamente.');

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('TOKEN RELEASER: Error crítico durante el ciclo de liberación de tokens.', error);
            } finally {
                client.release();
            }
        }, TOKEN_RELEASER_INTERVAL_MS);

        // --- PROCESO MENSUAL DE PAGO A IMPULSORES ---
        const BOOSTER_PAYMENT_INTERVAL_MS = 24 * 60 * 60 * 1000; // Revisar cada 24 horas
        setInterval(async () => {
            await executeBoosterPayments();
        }, BOOSTER_PAYMENT_INTERVAL_MS);

        // --- MAIL WORKER: PROCESAMIENTO DE DIFUSIONES (BATCHING) ---
        const MAIL_WORKER_INTERVAL_MS = 30 * 1000; // Procesar cada 30 segundos
        async function runMailWorker() {
            try {
                await processPendingBroadcasts(pool);
            } catch (err) {
                console.error("Error en Mail Worker:", err);
            } finally {
                setTimeout(runMailWorker, MAIL_WORKER_INTERVAL_MS);
            }
        }
        runMailWorker(); // Iniciar inmediatamente

        if (process.env.NODE_ENV !== 'test') {
            app.listen(PORT, '0.0.0.0', () => {
                console.log(`Servidor corriendo en:`);
                console.log(`- Local: http://localhost:${PORT}`);
                console.log(`- Red:   http://192.168.100.7:${PORT} (Usa esta en tu teléfono)`);
            });
        }

        // --- ENDPOINTS DE COMPATIBILIDAD (LEGACY) ---
        app.get('/api/legal-status', async (req, res) => {
            // Respondemos siempre que todo está aceptado para no interrumpir el flujo del Admin o usuarios existentes
            res.json({
                requires_terms_acceptance: false,
                accepted_at: new Date().toISOString(),
                documents: []
            });
        });

    } catch (err) {
        console.error("Error fatal al iniciar el servidor:", err);
        process.exit(1);
    }
}

// Middleware de verificación de token de administrador (MODIFICADO PARA COOKIES)
function verifyAdminToken(req, res, next) {
    // Buscamos el token en la cookie firmada 'admin_token'
    const token = req.cookies?.admin_token;

    if (!token) return res.status(401).json({ message: "No autorizado. Token no encontrado." });

    jwt.verify(token, process.env.ADMIN_SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: "Token inválido o expirado." });

        // Normalización de identidad admin para consistencia transversal:
        // algunos controladores validan req.user.role === 'admin'.
        req.user = {
            ...user,
            role: 'admin'
        };

        // Compatibilidad adicional para módulos legacy que usen res.locals.admin.
        res.locals.admin = req.user;
        next();
    });
}

/**
 * Middleware combinado para flujos de publicación:
 * - Si hay cookie admin válida, autentica como admin.
 * - En caso contrario, exige JWT de usuario (Bearer) con validaciones completas.
 *
 * Nota: no usar este middleware para rutas estrictamente administrativas del sistema.
 */
function verifyAdminOrUserToken(req, res, next) {
    const adminToken = req.cookies?.admin_token;

    if (adminToken) {
        jwt.verify(adminToken, process.env.ADMIN_SECRET_KEY, (adminErr, adminUser) => {
            if (!adminErr && adminUser) {
                req.user = {
                    ...adminUser,
                    role: 'admin'
                };
                res.locals.admin = req.user;
                return next();
            }

            // Si la cookie admin está vencida/inválida, intentamos flujo usuario.
            return verifyUserToken(req, res, next);
        });
        return;
    }

    return verifyUserToken(req, res, next);
}

/**
 * Middleware profesional para autenticar usuarios finales (no-admin) vía JWT.
 * - Fuente de verdad: Authorization: Bearer <token>
 * - El token contiene { userId, username } (firmado con JWT_SECRET)
 *
 * Importante (fintech): NO confiar en req.body.username / req.query.user para autorizar.
 */
function verifyUserToken(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!token) {
        return res.status(401).json({ message: 'No autenticado. Token no proporcionado.' });
    }

    jwt.verify(token, jwtSecret, async (err, decoded) => {
        if (err || !decoded) {
            return res.status(401).json({ message: 'No autenticado. Token inválido o expirado.' });
        }

        try {
            const userId = decoded.userId;
            if (!userId) {
                return res.status(401).json({ message: 'No autenticado. Token inválido.' });
            }

            // Endurecimiento de sesión: invalidar JWT emitidos antes de password reset.
            // Estándar fintech: toda ruta autenticada debe respetar revocación por cambio de credenciales.
            const userResult = await pool.query(
                'SELECT password_invalidate_before FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rowCount === 0) {
                return res.status(401).json({ message: 'No autenticado. Usuario no encontrado.' });
            }

            const invalidateBefore = userResult.rows[0].password_invalidate_before;
            if (invalidateBefore) {
                const tokenIssuedAt = new Date((decoded.iat || 0) * 1000);
                if (tokenIssuedAt < new Date(invalidateBefore)) {
                    return res.status(401).json({
                        message: 'No autenticado. Tu sesión fue invalidada por un cambio de contraseña.',
                        code: 'SESSION_INVALIDATED'
                    });
                }
            }

            req.user = decoded; // { userId, username, iat, exp }
            next();
        } catch (dbErr) {
            console.error('[AUTH] Error al validar estado de sesión:', dbErr);
            return res.status(503).json({
                message: 'Servicio temporalmente no disponible para validar autenticación.'
            });
        }
    });
}

// --- P2P: Helpers y Endpoints (BLUE) ---
async function getP2pSettings(client) {
    const keys = [
        'p2p_enabled',
        'p2p_price_min',
        'p2p_price_max',
        'p2p_fee_percentage',
        'p2p_payment_window_minutes',
        'p2p_extension_minutes',
        'p2p_extension_limit',
        'p2p_cash_min_rating'
    ];
    const result = await client.query(
        `SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1::text[])`,
        [keys]
    );
    const map = result.rows.reduce((acc, row) => {
        acc[row.setting_key] = row.setting_value;
        return acc;
    }, {});
    return {
        enabled: map.p2p_enabled === 'true',
        priceMin: parseFloat(map.p2p_price_min || '0.95'),
        priceMax: parseFloat(map.p2p_price_max || '1.05'),
        feePct: parseFloat(map.p2p_fee_percentage || '0'),
        paymentWindowMinutes: parseInt(map.p2p_payment_window_minutes || '15', 10),
        extensionMinutes: parseInt(map.p2p_extension_minutes || '15', 10),
        extensionLimit: parseInt(map.p2p_extension_limit || '1', 10),
        cashMinRating: parseFloat(map.p2p_cash_min_rating || '4.5')
    };
}

function calculateUsdPrice({ currency, pricePerBlue, usdReferenceRate }) {
    if (String(currency).toUpperCase() === 'USD') {
        return pricePerBlue;
    }
    if (!usdReferenceRate || usdReferenceRate <= 0) {
        return null;
    }
    return pricePerBlue / usdReferenceRate;
}

function requireP2pEnabled(settings, res) {
    if (!settings.enabled) {
        res.status(403).json({ message: 'El módulo P2P está desactivado temporalmente.' });
        return false;
    }
    return true;
}

// Lista de métodos de pago P2P
app.get('/api/p2p/payment-methods', verifyUserToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, code, label, is_cash
                     FROM p2p_payment_methods
                     WHERE is_active = TRUE
                     ORDER BY label ASC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error al listar métodos P2P:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// Crear oferta P2P
app.post('/api/p2p/offers', verifyUserToken, requireAcceptedLegalForAuthenticatedUser(), async (req, res) => {
    const {
        offerType,
        currency,
        pricePerBlue,
        usdReferenceRate,
        minFiatAmount,
        maxFiatAmount,
        availableBlueAmount,
        allowPartial = true,
        terms,
        paymentMethodIds
    } = req.body;
    const creatorUsername = req.user.username;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const settings = await getP2pSettings(client);
        if (!requireP2pEnabled(settings, res)) {
            await client.query('ROLLBACK');
            return;
        }

        if (!['buy', 'sell'].includes(String(offerType))) {
            throw { status: 400, message: 'Tipo de oferta inválido.' };
        }
        if (!currency) {
            throw { status: 400, message: 'La moneda es obligatoria.' };
        }
        const price = parseFloat(pricePerBlue);
        const minAmount = parseFloat(minFiatAmount);
        const maxAmount = parseFloat(maxFiatAmount);
        const blueAmount = parseFloat(availableBlueAmount);
        const usdRate = usdReferenceRate ? parseFloat(usdReferenceRate) : null;

        if (!Number.isFinite(price) || price <= 0) throw { status: 400, message: 'Precio inválido.' };
        if (!Number.isFinite(minAmount) || minAmount <= 0) throw { status: 400, message: 'Monto mínimo inválido.' };
        if (!Number.isFinite(maxAmount) || maxAmount < minAmount) throw { status: 400, message: 'Monto máximo inválido.' };
        if (!Number.isFinite(blueAmount) || blueAmount <= 0) throw { status: 400, message: 'Cantidad BLUE inválida.' };

        const usdPrice = calculateUsdPrice({ currency, pricePerBlue: price, usdReferenceRate: usdRate });
        if (!usdPrice) {
            throw { status: 400, message: 'Debes indicar el tipo de cambio USD para validar el rango de precio.' };
        }
        if (usdPrice < settings.priceMin || usdPrice > settings.priceMax) {
            throw {
                status: 400,
                message: `El precio debe estar dentro del rango ${settings.priceMin} - ${settings.priceMax} USD por BLUE.`
            };
        }

        if (!Array.isArray(paymentMethodIds) || paymentMethodIds.length === 0) {
            throw { status: 400, message: 'Debes seleccionar al menos un método de pago.' };
        }

        const methodsResult = await client.query(
            `SELECT id, is_cash FROM p2p_payment_methods WHERE id = ANY($1::int[]) AND is_active = TRUE`,
            [paymentMethodIds]
        );
        if (methodsResult.rowCount !== paymentMethodIds.length) {
            throw { status: 400, message: 'Métodos de pago inválidos.' };
        }
        const usesCash = methodsResult.rows.some(m => m.is_cash);
        if (usesCash) {
            const ratingResult = await client.query(
                `SELECT average_rating FROM users WHERE username = $1`,
                [creatorUsername]
            );
            const avgRating = parseFloat(ratingResult.rows[0]?.average_rating || '0');
            if (avgRating < settings.cashMinRating) {
                throw { status: 403, message: `Para usar efectivo necesitas reputación mínima de ${settings.cashMinRating}.` };
            }
        }

        if (offerType === 'sell') {
            const balanceResult = await client.query(
                `SELECT liquid_blue_balance FROM users WHERE username = $1`,
                [creatorUsername]
            );
            const liquidBlue = parseFloat(balanceResult.rows[0]?.liquid_blue_balance || '0');
            if (liquidBlue < blueAmount) {
                throw { status: 400, message: 'Saldo BLUE insuficiente para crear esta oferta.' };
            }
        }

        const insertOffer = await client.query(
            `INSERT INTO p2p_offers
                        (creator_username, offer_type, currency, price_per_blue, usd_reference_rate, min_fiat_amount, max_fiat_amount, available_blue_amount, allow_partial, terms)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                     RETURNING id`,
            [
                creatorUsername,
                offerType,
                String(currency).toUpperCase(),
                price,
                usdRate,
                minAmount,
                maxAmount,
                blueAmount,
                !!allowPartial,
                terms || null
            ]
        );

        const offerId = insertOffer.rows[0].id;
        for (const methodId of paymentMethodIds) {
            await client.query(
                `INSERT INTO p2p_offer_methods (offer_id, method_id) VALUES ($1, $2)`,
                [offerId, methodId]
            );
        }

        await logAuditEvent(client, req, {
            eventType: 'p2p.offer.created',
            actorUsername: creatorUsername,
            metadata: {
                offer_id: offerId,
                offer_type: offerType,
                currency: String(currency).toUpperCase(),
                price_per_blue: price,
                usd_price: usdPrice
            }
        });

        await client.query('COMMIT');
        res.status(201).json({ success: true, offerId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al crear oferta P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// Listar ofertas P2P
app.get('/api/p2p/offers', verifyUserToken, async (req, res) => {
    const { type, currency, paymentMethod, paymentMethods, min, max } = req.query;
    const requestingUser = req.user.username;
    try {
        const conditions = ['o.status = \'active\'', 'o.available_blue_amount > 0', 'o.creator_username <> $1'];
        const values = [requestingUser];
        if (type) {
            values.push(type);
            conditions.push(`o.offer_type = $${values.length}`);
        }
        if (currency) {
            values.push(String(currency).toUpperCase());
            conditions.push(`o.currency = $${values.length}`);
        }
        if (min) {
            values.push(parseFloat(min));
            conditions.push(`o.min_fiat_amount <= $${values.length}`);
        }
        if (max) {
            values.push(parseFloat(max));
            conditions.push(`o.max_fiat_amount >= $${values.length}`);
        }
        let methodJoin = '';
        if (paymentMethods) {
            const methodIds = String(paymentMethods)
                .split(',')
                .map(id => parseInt(id, 10))
                .filter(id => Number.isFinite(id));
            if (methodIds.length > 0) {
                values.push(methodIds);
                methodJoin = `AND pom.method_id = ANY($${values.length}::int[])`;
            }
        } else if (paymentMethod) {
            values.push(parseInt(paymentMethod, 10));
            methodJoin = `AND pom.method_id = $${values.length}`;
        }

        const sql = `
                    SELECT
                        o.*,
                        u.average_rating,
                        u.ratings_count,
                        COALESCE(
                            json_agg(json_build_object('id', m.id, 'code', m.code, 'label', m.label, 'is_cash', m.is_cash))
                            FILTER (WHERE m.id IS NOT NULL),
                            '[]'
                        ) AS payment_methods
                    FROM p2p_offers o
                    JOIN users u ON o.creator_username = u.username
                    LEFT JOIN p2p_offer_methods pom ON o.id = pom.offer_id
                    LEFT JOIN p2p_payment_methods m ON pom.method_id = m.id
                    WHERE ${conditions.join(' AND ')} ${methodJoin}
                    GROUP BY o.id, u.average_rating, u.ratings_count
                    ORDER BY o.created_at DESC
                `;
        const result = await pool.query(sql, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al listar ofertas P2P:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// Mis ofertas P2P
app.get('/api/p2p/offers/mine', verifyUserToken, async (req, res) => {
    const username = req.user.username;
    try {
        const result = await pool.query(
            `SELECT * FROM p2p_offers WHERE creator_username = $1 ORDER BY created_at DESC`,
            [username]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error al listar mis ofertas P2P:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// Crear orden P2P
app.post('/api/p2p/orders', verifyUserToken, requireAcceptedLegalForAuthenticatedUser(), async (req, res) => {
    const { offerId, fiatAmount } = req.body;
    const requestingUser = req.user.username;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const settings = await getP2pSettings(client);
        if (!requireP2pEnabled(settings, res)) {
            await client.query('ROLLBACK');
            return;
        }
        const offerResult = await client.query(
            `SELECT * FROM p2p_offers WHERE id = $1 FOR UPDATE`,
            [offerId]
        );
        const offer = offerResult.rows[0];
        if (!offer || offer.status !== 'active') {
            throw { status: 404, message: 'Oferta no disponible.' };
        }
        if (offer.creator_username === requestingUser) {
            throw { status: 400, message: 'No puedes tomar tu propia oferta.' };
        }

        const amountFiat = parseFloat(fiatAmount);
        if (!Number.isFinite(amountFiat) || amountFiat <= 0) {
            throw { status: 400, message: 'Monto inválido.' };
        }
        if (amountFiat < offer.min_fiat_amount || amountFiat > offer.max_fiat_amount) {
            throw { status: 400, message: 'Monto fuera del rango permitido.' };
        }

        const blueAmount = amountFiat / parseFloat(offer.price_per_blue);
        if (blueAmount > parseFloat(offer.available_blue_amount)) {
            throw { status: 400, message: 'La oferta no tiene suficiente BLUE disponible.' };
        }

        const seller = offer.offer_type === 'sell' ? offer.creator_username : requestingUser;
        const buyer = offer.offer_type === 'sell' ? requestingUser : offer.creator_username;

        const sellerBalanceResult = await client.query(
            `SELECT id, liquid_blue_balance, escrow_blue_balance FROM users WHERE username = $1 FOR UPDATE`,
            [seller]
        );
        const sellerBalance = sellerBalanceResult.rows[0];
        const liquidBlue = parseFloat(sellerBalance?.liquid_blue_balance || '0');
        if (liquidBlue < blueAmount) {
            throw { status: 400, message: 'El vendedor no tiene saldo BLUE suficiente.' };
        }

        await client.query(
            `SELECT record_balance_event($1, 'withdrawal', 'liquid_blue', $2, NULL)`,
            [sellerBalance.id, blueAmount]
        );
        await client.query(
            `SELECT record_balance_event($1, 'deposit', 'escrow_blue', $2, NULL)`,
            [sellerBalance.id, blueAmount]
        );
        await logAuditEvent(client, req, {
            eventType: 'p2p.escrow.locked',
            actorUsername: requestingUser,
            targetUsername: seller,
            metadata: {
                offer_id: offer.id,
                order_fiat_amount: amountFiat,
                blue_amount: blueAmount,
                balance_move: 'liquid_blue -> escrow_blue'
            }
        });

        const expiresAt = new Date(Date.now() + settings.paymentWindowMinutes * 60 * 1000);
        const orderResult = await client.query(
            `INSERT INTO p2p_orders
                        (offer_id, buyer_username, seller_username, fiat_amount, blue_amount, price_per_blue, currency, expires_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     RETURNING id`,
            [offer.id, buyer, seller, amountFiat, blueAmount, offer.price_per_blue, offer.currency, expiresAt]
        );

        await client.query(
            `UPDATE p2p_offers
                     SET available_blue_amount = available_blue_amount - $1,
                         status = CASE WHEN (available_blue_amount - $1) <= 0 THEN 'paused' ELSE status END,
                         updated_at = NOW()
                     WHERE id = $2`,
            [blueAmount, offer.id]
        );

        await logAuditEvent(client, req, {
            eventType: 'p2p.order.created',
            actorUsername: requestingUser,
            metadata: {
                order_id: orderResult.rows[0].id,
                offer_id: offer.id,
                buyer,
                seller,
                blue_amount: blueAmount,
                fiat_amount: amountFiat
            }
        });

        await client.query('COMMIT');
        res.status(201).json({ success: true, orderId: orderResult.rows[0].id });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al crear orden P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// Listar órdenes del usuario
app.get('/api/p2p/orders', verifyUserToken, async (req, res) => {
    const username = req.user.username;
    const { role = 'all', status } = req.query;
    try {
        const conditions = [];
        const values = [];
        if (role === 'buyer') {
            values.push(username);
            conditions.push(`o.buyer_username = $${values.length}`);
        } else if (role === 'seller') {
            values.push(username);
            conditions.push(`o.seller_username = $${values.length}`);
        } else {
            values.push(username);
            values.push(username);
            conditions.push(`(o.buyer_username = $${values.length - 1} OR o.seller_username = $${values.length})`);
        }
        if (status) {
            values.push(status);
            conditions.push(`o.status = $${values.length}`);
        }

        const sql = `
                    SELECT o.*, off.offer_type, off.creator_username
                    FROM p2p_orders o
                    JOIN p2p_offers off ON o.offer_id = off.id
                    WHERE ${conditions.join(' AND ')}
                    ORDER BY o.created_at DESC
                `;
        const result = await pool.query(sql, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al listar órdenes P2P:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// Marcar como pagado
app.post('/api/p2p/orders/:id/mark-paid', verifyUserToken, requireAcceptedLegalForAuthenticatedUser(), async (req, res) => {
    const orderId = req.params.id;
    const username = req.user.username;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const orderResult = await client.query(
            `SELECT * FROM p2p_orders WHERE id = $1 FOR UPDATE`,
            [orderId]
        );
        const order = orderResult.rows[0];
        if (!order) throw { status: 404, message: 'Orden no encontrada.' };
        if (order.buyer_username !== username) throw { status: 403, message: 'Solo el comprador puede marcar como pagado.' };
        if (order.status !== 'payment_pending') throw { status: 400, message: 'La orden no está pendiente de pago.' };

        await client.query(
            `UPDATE p2p_orders SET status = 'paid', paid_at = NOW() WHERE id = $1`,
            [orderId]
        );

        await logAuditEvent(client, req, {
            eventType: 'p2p.order.paid',
            actorUsername: username,
            metadata: { order_id: orderId }
        });

        await client.query('COMMIT');
        res.json({ success: true, message: 'Pago marcado correctamente.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al marcar pago P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// Liberar BLUE (vendedor)
app.post('/api/p2p/orders/:id/release', verifyUserToken, requireAcceptedLegalForAuthenticatedUser(), async (req, res) => {
    const orderId = req.params.id;
    const username = req.user.username;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const orderResult = await client.query(
            `SELECT * FROM p2p_orders WHERE id = $1 FOR UPDATE`,
            [orderId]
        );
        const order = orderResult.rows[0];
        if (!order) throw { status: 404, message: 'Orden no encontrada.' };
        if (order.seller_username !== username) throw { status: 403, message: 'Solo el vendedor puede liberar.' };
        if (order.status !== 'paid') throw { status: 400, message: 'La orden no está en estado pagado.' };

        const sellerResult = await client.query(
            `SELECT id FROM users WHERE username = $1 FOR UPDATE`,
            [order.seller_username]
        );
        const buyerResult = await client.query(
            `SELECT id FROM users WHERE username = $1 FOR UPDATE`,
            [order.buyer_username]
        );
        const sellerId = sellerResult.rows[0]?.id;
        const buyerId = buyerResult.rows[0]?.id;
        if (!sellerId || !buyerId) {
            throw { status: 404, message: 'Usuarios de la orden no encontrados.' };
        }

        await client.query(
            `SELECT record_balance_event($1, 'withdrawal', 'escrow_blue', $2, NULL)`,
            [sellerId, order.blue_amount]
        );
        await client.query(
            `SELECT record_balance_event($1, 'deposit', 'liquid_blue', $2, NULL)`,
            [buyerId, order.blue_amount]
        );
        await logAuditEvent(client, req, {
            eventType: 'p2p.escrow.released',
            actorUsername: username,
            targetUsername: order.buyer_username,
            metadata: {
                order_id: orderId,
                blue_amount: order.blue_amount,
                balance_move: 'escrow_blue(seller) -> liquid_blue(buyer)'
            }
        });

        await client.query(
            `UPDATE p2p_orders SET status = 'released', released_at = NOW() WHERE id = $1`,
            [orderId]
        );

        await client.query(
            `INSERT INTO transactions (user_id, type, description, blue_change, red_change)
                     SELECT id, 'p2p_buy', 'Compra P2P BLUE', $1, 0 FROM users WHERE username = $2`,
            [order.blue_amount, order.buyer_username]
        );

        await logAuditEvent(client, req, {
            eventType: 'p2p.order.released',
            actorUsername: username,
            metadata: { order_id: orderId }
        });

        // --- NOTIFICACIÓN PUSH AL COMPRADOR ---
        // Esto se ejecuta de forma asíncrona (no bloquea la respuesta HTTP)
        // pero DEBERÍA estar fuera de la transacción DB crítica si es posible,
        // o manejado con cuidado para no fallar el commit si la notificación falla.
        // Aquí usamos .catch() evitar que un error de push revierta la transacción financiera.
        // --- NOTIFICACIÓN PUSH AUTOMÁTICA (Event-Driven) ---
        // Emitimos el evento y el bus se encarga de la lógica y seguridad.
        // Esto mantiene el controlador limpio.
        eventBus.emit('TASK_PAID', {
            publicationId: orderId, // En P2P orderId es equivalente a publicationId en contexto simple
            publicationTitle: `Orden P2P #${orderId}`,
            participantId: buyerId,
            amount: order.blue_amount
        });




        await client.query('COMMIT');
        res.json({ success: true, message: 'BLUE liberado correctamente.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al liberar P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// Cancelar orden (solo antes de pagar)
app.post('/api/p2p/orders/:id/cancel', verifyUserToken, requireAcceptedLegalForAuthenticatedUser(), async (req, res) => {
    const orderId = req.params.id;
    const username = req.user.username;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const orderResult = await client.query(
            `SELECT * FROM p2p_orders WHERE id = $1 FOR UPDATE`,
            [orderId]
        );
        const order = orderResult.rows[0];
        if (!order) throw { status: 404, message: 'Orden no encontrada.' };
        if (order.status !== 'payment_pending') throw { status: 400, message: 'Solo se puede cancelar antes del pago.' };
        if (![order.buyer_username, order.seller_username].includes(username)) {
            throw { status: 403, message: 'No tienes permiso para cancelar esta orden.' };
        }

        const sellerResult = await client.query(
            `SELECT id FROM users WHERE username = $1 FOR UPDATE`,
            [order.seller_username]
        );
        const sellerId = sellerResult.rows[0]?.id;
        if (!sellerId) {
            throw { status: 404, message: 'Vendedor no encontrado.' };
        }

        await client.query(
            `SELECT record_balance_event($1, 'withdrawal', 'escrow_blue', $2, NULL)`,
            [sellerId, order.blue_amount]
        );
        await client.query(
            `SELECT record_balance_event($1, 'deposit', 'liquid_blue', $2, NULL)`,
            [sellerId, order.blue_amount]
        );
        await logAuditEvent(client, req, {
            eventType: 'p2p.escrow.refunded',
            actorUsername: username,
            targetUsername: order.seller_username,
            metadata: {
                order_id: orderId,
                blue_amount: order.blue_amount,
                balance_move: 'escrow_blue -> liquid_blue'
            }
        });
        await client.query(
            `UPDATE p2p_offers
                     SET available_blue_amount = available_blue_amount + $1,
                         status = 'active',
                         updated_at = NOW()
                     WHERE id = $2`,
            [order.blue_amount, order.offer_id]
        );
        await client.query(
            `UPDATE p2p_orders SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
            [orderId]
        );

        await logAuditEvent(client, req, {
            eventType: 'p2p.order.cancelled',
            actorUsername: username,
            metadata: { order_id: orderId }
        });

        await client.query('COMMIT');
        res.json({ success: true, message: 'Orden cancelada.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al cancelar P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// Solicitar o aprobar extensión
app.post('/api/p2p/orders/:id/request-extension', verifyUserToken, requireAcceptedLegalForAuthenticatedUser(), async (req, res) => {
    const orderId = req.params.id;
    const username = req.user.username;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const settings = await getP2pSettings(client);
        const orderResult = await client.query(
            `SELECT * FROM p2p_orders WHERE id = $1 FOR UPDATE`,
            [orderId]
        );
        const order = orderResult.rows[0];
        if (!order) throw { status: 404, message: 'Orden no encontrada.' };
        if (order.status !== 'payment_pending') throw { status: 400, message: 'La orden no es elegible para extensión.' };
        if (![order.buyer_username, order.seller_username].includes(username)) {
            throw { status: 403, message: 'No tienes permiso para solicitar extensión.' };
        }
        if (order.extension_count >= settings.extensionLimit) {
            throw { status: 400, message: 'Se alcanzó el límite de extensiones.' };
        }

        if (!order.extension_requested_by) {
            await client.query(
                `UPDATE p2p_orders
                         SET extension_requested_by = $1, extension_requested_at = NOW()
                         WHERE id = $2`,
                [username, orderId]
            );
            await client.query('COMMIT');
            return res.json({ success: true, message: 'Solicitud de extensión enviada.' });
        }

        if (order.extension_requested_by === username) {
            await client.query('COMMIT');
            return res.json({ success: true, message: 'La extensión ya fue solicitada por ti.' });
        }

        await client.query(
            `UPDATE p2p_orders
                     SET expires_at = expires_at + ($1 || ' minutes')::interval,
                         extension_count = extension_count + 1,
                         extension_requested_by = NULL,
                         extension_requested_at = NULL
                     WHERE id = $2`,
            [settings.extensionMinutes, orderId]
        );

        await logAuditEvent(client, req, {
            eventType: 'p2p.order.extended',
            actorUsername: username,
            metadata: { order_id: orderId }
        });

        await client.query('COMMIT');
        res.json({ success: true, message: 'Extensión aprobada y aplicada.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al extender P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// Disputa
app.post('/api/p2p/orders/:id/dispute', verifyUserToken, requireAcceptedLegalForAuthenticatedUser(), async (req, res) => {
    const orderId = req.params.id;
    const { reason } = req.body;
    const username = req.user.username;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const orderResult = await client.query(
            `SELECT * FROM p2p_orders WHERE id = $1 FOR UPDATE`,
            [orderId]
        );
        const order = orderResult.rows[0];
        if (!order) throw { status: 404, message: 'Orden no encontrada.' };
        if (order.status !== 'paid') throw { status: 400, message: 'Solo se puede disputar después de marcar pago.' };
        if (![order.buyer_username, order.seller_username].includes(username)) {
            throw { status: 403, message: 'No tienes permiso para disputar.' };
        }
        if (!reason) throw { status: 400, message: 'Motivo requerido.' };

        const disputeResult = await client.query(
            `INSERT INTO p2p_disputes (order_id, opened_by, reason)
                     VALUES ($1, $2, $3)
                     RETURNING id`,
            [orderId, username, reason]
        );
        await client.query(
            `UPDATE p2p_orders SET status = 'disputed', disputed_at = NOW() WHERE id = $1`,
            [orderId]
        );

        await logAuditEvent(client, req, {
            eventType: 'p2p.order.disputed',
            actorUsername: username,
            metadata: { order_id: orderId, dispute_id: disputeResult.rows[0].id }
        });

        await client.query('COMMIT');
        res.json({ success: true, disputeId: disputeResult.rows[0].id });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al abrir disputa P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// Calificar reputación P2P (obligatoria después de liberación)
app.post('/api/p2p/orders/:id/rate', verifyUserToken, requireAcceptedLegalForAuthenticatedUser(), async (req, res) => {
    const orderId = req.params.id;
    const { rating, comment } = req.body;
    const rater = req.user.username;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const orderResult = await client.query(
            `SELECT * FROM p2p_orders WHERE id = $1 FOR UPDATE`,
            [orderId]
        );
        const order = orderResult.rows[0];
        if (!order) throw { status: 404, message: 'Orden no encontrada.' };
        if (order.status !== 'released') throw { status: 400, message: 'Solo se puede calificar una orden liberada.' };
        if (![order.buyer_username, order.seller_username].includes(rater)) {
            throw { status: 403, message: 'No tienes permiso para calificar.' };
        }
        const ratee = rater === order.buyer_username ? order.seller_username : order.buyer_username;
        const score = parseInt(rating, 10);
        if (!Number.isInteger(score) || score < 1 || score > 5) {
            throw { status: 400, message: 'Calificación inválida.' };
        }

        await client.query(
            `INSERT INTO p2p_ratings (order_id, rater_username, ratee_username, rating, comment)
                     VALUES ($1, $2, $3, $4, $5)`,
            [orderId, rater, ratee, score, comment || null]
        );

        const userResult = await client.query(
            `SELECT average_rating, ratings_count FROM users WHERE username = $1 FOR UPDATE`,
            [ratee]
        );
        const currentAvg = parseFloat(userResult.rows[0]?.average_rating || '0');
        const currentCount = parseInt(userResult.rows[0]?.ratings_count || '0', 10);
        const newCount = currentCount + 1;
        const newAvg = ((currentAvg * currentCount) + score) / newCount;
        await client.query(
            `UPDATE users SET average_rating = $1, ratings_count = $2 WHERE username = $3`,
            [newAvg, newCount, ratee]
        );

        await logAuditEvent(client, req, {
            eventType: 'p2p.order.rated',
            actorUsername: rater,
            targetUsername: ratee,
            metadata: { order_id: orderId, rating: score }
        });

        await client.query('COMMIT');
        res.json({ success: true, message: 'Calificación registrada.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al calificar P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// Resolver disputa (admin)
app.post('/api/admin/p2p/disputes/:id/resolve', verifyAdminToken, async (req, res) => {
    const disputeId = req.params.id;
    const { action, resolution } = req.body; // action: release_to_buyer | refund_seller
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const disputeResult = await client.query(
            `SELECT d.*, o.* FROM p2p_disputes d
                     JOIN p2p_orders o ON d.order_id = o.id
                     WHERE d.id = $1 FOR UPDATE`,
            [disputeId]
        );
        const dispute = disputeResult.rows[0];
        if (!dispute) throw { status: 404, message: 'Disputa no encontrada.' };
        if (dispute.status !== 'open') throw { status: 400, message: 'La disputa ya está resuelta.' };

        if (action === 'release_to_buyer') {
            const sellerResult = await client.query(
                `SELECT id FROM users WHERE username = $1 FOR UPDATE`,
                [dispute.seller_username]
            );
            const buyerResult = await client.query(
                `SELECT id FROM users WHERE username = $1 FOR UPDATE`,
                [dispute.buyer_username]
            );
            const sellerId = sellerResult.rows[0]?.id;
            const buyerId = buyerResult.rows[0]?.id;
            if (!sellerId || !buyerId) {
                throw { status: 404, message: 'Usuarios de la orden no encontrados.' };
            }
            await client.query(
                `SELECT record_balance_event($1, 'withdrawal', 'escrow_blue', $2, NULL)`,
                [sellerId, dispute.blue_amount]
            );
            await client.query(
                `SELECT record_balance_event($1, 'deposit', 'liquid_blue', $2, NULL)`,
                [buyerId, dispute.blue_amount]
            );
            await client.query(
                `UPDATE p2p_orders SET status = 'released', released_at = NOW() WHERE id = $1`,
                [dispute.order_id]
            );
        } else if (action === 'refund_seller') {
            const sellerResult = await client.query(
                `SELECT id FROM users WHERE username = $1 FOR UPDATE`,
                [dispute.seller_username]
            );
            const sellerId = sellerResult.rows[0]?.id;
            if (!sellerId) {
                throw { status: 404, message: 'Vendedor no encontrado.' };
            }
            await client.query(
                `SELECT record_balance_event($1, 'withdrawal', 'escrow_blue', $2, NULL)`,
                [sellerId, dispute.blue_amount]
            );
            await client.query(
                `SELECT record_balance_event($1, 'deposit', 'liquid_blue', $2, NULL)`,
                [sellerId, dispute.blue_amount]
            );
            await client.query(
                `UPDATE p2p_orders SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
                [dispute.order_id]
            );
        } else {
            throw { status: 400, message: 'Acción inválida.' };
        }

        await client.query(
            `UPDATE p2p_disputes
                     SET status = 'resolved', resolution = $1, resolved_by = 'admin', resolved_at = NOW()
                     WHERE id = $2`,
            [resolution || null, disputeId]
        );

        await logAuditEvent(client, req, {
            eventType: 'p2p.dispute.resolved',
            actorUsername: 'admin',
            metadata: { dispute_id: disputeId, action }
        });

        await client.query('COMMIT');
        res.json({ success: true, message: 'Disputa resuelta.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al resolver disputa P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// --- GOBERNANZA: Cron Jobs del sistema Winton-Consensus ---
// Ejecuta time-locks vencidos, expira solicitudes viejas, y envía recordatorios
const governanceCron = require('./src/services/governanceService');
const { purgeExpiredChallenges: purgeWebAuthnChallenges } = require('./src/services/webauthnService');

cron.schedule('*/1 * * * *', async () => {
    try {
        const timeLockResults = await governanceCron.processTimeLocked(pool);

        for (const r of timeLockResults) {
            if (r.status === 'executed') {
                const guardianRes = await pool.query(
                    `SELECT user_id FROM governance_guardians WHERE status = 'active'`
                );
                eventBus.emit('GOV_REQUEST_EXECUTED', {
                    requestId: r.requestId,
                    actionType: r.actionType || 'unknown',
                    targetKey: r.targetKey || null,
                    guardianUserIds: guardianRes.rows.map(g => g.user_id),
                });

                if (r.actionType === 'membership_change') {
                    try {
                        const reqData = await pool.query(
                            'SELECT new_value, requester_id FROM governance_requests WHERE id = $1',
                            [r.requestId]
                        );
                        const raw = reqData.rows[0]?.new_value;
                        if (reqData.rowCount > 0 && raw) {
                            const newVal = typeof raw === 'string' ? JSON.parse(raw) : raw;
                            const reqUser = await pool.query(
                                'SELECT username FROM users WHERE id = $1',
                                [reqData.rows[0].requester_id]
                            );
                            const reqUsername = reqUser.rows[0]?.username || 'Sistema';

                            if (newVal.action === 'add' || newVal.action === 'update') {
                                eventBus.emit('GOV_GUARDIAN_ONBOARDED', {
                                    userId: newVal.userId,
                                    role: newVal.role,
                                    appointedByUsername: reqUsername,
                                    requestId: r.requestId,
                                });
                            } else if (newVal.action === 'remove') {
                                const prevRole = await pool.query(
                                    'SELECT role FROM governance_guardians WHERE user_id = $1',
                                    [newVal.userId]
                                );
                                eventBus.emit('GOV_GUARDIAN_REMOVED', {
                                    userId: newVal.userId,
                                    previousRole: prevRole.rows[0]?.role || 'supervisor',
                                    removedByUsername: reqUsername,
                                    requestId: r.requestId,
                                });
                            }
                        }
                    } catch (memberErr) {
                        console.error('[GOV-CRON] Error emitting membership events:', memberErr);
                    }
                }
            }
        }

        await governanceCron.expireStaleRequests(pool);
    } catch (err) {
        console.error('[GOV-CRON] Error en procesamiento periódico:', err);
    }
});

cron.schedule('0 */6 * * *', async () => {
    try {
        const reminders = await governanceCron.getPendingReminders(pool);
        for (const r of reminders) {
            for (const g of r.pendingGuardians) {
                eventBus.emit('GOV_VOTE_REMINDER', {
                    requestId: r.request.id,
                    description: r.request.description,
                    expiresAt: r.request.expires_at,
                    guardianUserId: g.user_id,
                });
            }
        }
    } catch (err) {
        console.error('[GOV-CRON] Error enviando recordatorios:', err);
    }
});

cron.schedule('0 3 * * *', async () => {
    try {
        const purged = await purgeWebAuthnChallenges(pool);
        if (purged > 0) console.log(`[GOV-CRON] Limpiados ${purged} challenges WebAuthn expirados.`);
    } catch (err) {
        console.error('[GOV-CRON] Error limpiando challenges:', err);
    }
});

// --- P2P: Expirar órdenes vencidas (liberar escrow) ---
cron.schedule('*/1 * * * *', async () => {
    try {
        const expiredOrders = await pool.query(
            `SELECT id, seller_username, offer_id, blue_amount
                     FROM p2p_orders
                     WHERE status = 'payment_pending' AND expires_at <= NOW()`
        );
        for (const order of expiredOrders.rows) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const sellerResult = await client.query(
                    `SELECT id FROM users WHERE username = $1 FOR UPDATE`,
                    [order.seller_username]
                );
                const sellerId = sellerResult.rows[0]?.id;
                if (!sellerId) {
                    throw new Error('Vendedor no encontrado en expiracion P2P.');
                }
                await client.query(
                    `SELECT record_balance_event($1, 'withdrawal', 'escrow_blue', $2, NULL)`,
                    [sellerId, order.blue_amount]
                );
                await client.query(
                    `SELECT record_balance_event($1, 'deposit', 'liquid_blue', $2, NULL)`,
                    [sellerId, order.blue_amount]
                );
                await client.query(
                    `UPDATE p2p_offers
                             SET available_blue_amount = available_blue_amount + $1,
                                 status = 'active',
                                 updated_at = NOW()
                             WHERE id = $2`,
                    [order.blue_amount, order.offer_id]
                );
                await client.query(
                    `UPDATE p2p_orders
                             SET status = 'expired', cancelled_at = NOW()
                             WHERE id = $1`,
                    [order.id]
                );
                await logAuditEvent(client, null, {
                    eventType: 'p2p.order.expired',
                    actorUsername: 'system',
                    targetUsername: order.seller_username,
                    metadata: {
                        order_id: order.id,
                        offer_id: order.offer_id,
                        blue_amount: order.blue_amount,
                        balance_move: 'escrow_blue -> liquid_blue'
                    }
                });
                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                console.error('Error al expirar orden P2P:', err);
            } finally {
                client.release();
            }
        }
    } catch (error) {
        console.error('Error en cron P2P expirations:', error);
    }
});

// --- WEB3 ESCROW: Liberar escrows huérfanos de publicaciones expiradas/eliminadas/completadas ---
// Se ejecuta cada 15 minutos (estándar de reconciliación bancaria).
// Si una publicación expira o es eliminada pero tiene un escrow 'locked',
// este cron lo libera automáticamente para restaurar el poder adquisitivo del usuario.
const { releaseOrphanedEscrows } = require('./src/services/escrowCleanupService');
cron.schedule('*/15 * * * *', async () => {
    try {
        const result = await releaseOrphanedEscrows(pool);
        if (result.released > 0) {
            console.log(`[ESCROW-CRON] Ciclo completado: ${result.released} escrows liberados.`);
        }
    } catch (err) {
        console.error('[ESCROW-CRON] Error en limpieza de escrows:', err);
    }
});

// --- WEB3 RECONCILIATION: Outbox Pattern Safety Net ---
// Se ejecuta cada 5 minutos (Estándar Fintech para transacciones atascadas).
// Detecta pagos que pasaron en blockchain pero fallaron en la DB (ROLLBACK)
// y los marca para intervención manual o reintento.
const { runReconciliationCycle } = require('./src/services/reconciliationService');
cron.schedule('*/5 * * * *', async () => {
    try {
        const result = await runReconciliationCycle(pool);
        if (result.flagged > 0) {
            console.warn(`[RECONCILIATION-CRON] 🚨 ${result.flagged} transacciones marcadas para intervención manual.`);
        }
    } catch (err) {
        console.error('[RECONCILIATION-CRON] Error crítico:', err);
    }
});

if (process.env.NODE_ENV !== 'test') { startServer(); }
module.exports = { app, pool };



// NUEVO ENDPOINT: Obtener el log de referidos para el panel de admin
app.get('/api/admin/referrals/log', verifyAdminToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                rl.id,
                rl.created_at,
                referrer.username as referrer_username,
                referred.username as referred_username
            FROM 
                referral_log rl
            JOIN 
                users referrer ON rl.referrer_user_id = referrer.id
            JOIN 
                users referred ON rl.referred_user_id = referred.id
            ORDER BY 
                rl.created_at DESC;
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error al obtener el log de referidos:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
});

// NUEVO ENDPOINT: Obtener la información de referidos para un usuario específico (su código y a quién ha referido)
app.get('/api/users/:username/referral-info', async (req, res) => {
    const { username } = req.params;

    if (!username) {
        return res.status(400).json({ message: "Se requiere un nombre de usuario." });
    }

    const client = await pool.connect();
    try {
        // Usamos Promise.all para ejecutar ambas consultas en paralelo para mayor eficiencia.
        const [userResult, referredUsersResult] = await Promise.all([
            client.query('SELECT id, referral_code FROM users WHERE username = $1', [username]),
            client.query(`
                SELECT
                    u.username as referred_username,
                    rl.created_at,
                    (
                        SELECT COALESCE(SUM(amount), 0)
                        FROM booster_blue_ledger
                        WHERE user_id = u.id
                    ) as total_booster_blue
                FROM referral_log rl
                JOIN users u ON rl.referred_user_id = u.id
                WHERE rl.referrer_user_id = (SELECT id FROM users WHERE username = $1)
                ORDER BY total_booster_blue DESC, rl.created_at DESC;
            `, [username])
        ]);

        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const referralCode = userResult.rows[0].referral_code;
        const referredUsers = referredUsersResult.rows;

        res.status(200).json({
            referral_code: referralCode,
            referred_users: referredUsers
        });

    } catch (error) {
        console.error(`Error al obtener la información de referidos para ${username}:`, error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});
/*
app.get('/api/admin/users', verifyAdminToken, async (req, res) => {
    const { search = '' } = req.query;
    try {
        const sql = `
            SELECT id, username, liquid_blue_balance, escrow_blue_balance, red_balance, 
                   booster_blue_balance, status,
                   average_rating, ratings_count, created_at
            FROM users WHERE username ILIKE $1 ORDER BY created_at DESC
        `;
        const result = await pool.query(sql, [`%${search}%`]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error al obtener la lista de usuarios:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
}); */



// --- Helper: ranking de impulsores por BLUE iou acumulado ---
async function getBoosterRankData(client, userId) {
    const result = await client.query(
        `
        WITH totals AS (
            SELECT user_id, SUM(amount) AS total
            FROM booster_blue_ledger
            GROUP BY user_id
            HAVING SUM(amount) > 0
        ),
        ranked AS (
            SELECT
                user_id,
                total,
                RANK() OVER (ORDER BY total DESC) AS rank_position,
                COUNT(*) OVER () AS total_users
            FROM totals
        )
        SELECT rank_position, total_users
        FROM ranked
        WHERE user_id = $1
        `,
        [userId]
    );

    if (result.rowCount === 0) {
        return null;
    }

    const rankPosition = parseInt(result.rows[0].rank_position || '0', 10);
    const rankTotal = parseInt(result.rows[0].total_users || '0', 10);
    const rankPercentile = rankTotal > 0 ? Math.ceil((rankPosition / rankTotal) * 100) : null;

    return {
        rank_position: rankPosition,
        rank_total: rankTotal,
        rank_percentile: rankPercentile
    };
}

// --- Helper: ranking entre referidos del usuario ---
async function getReferralRankData(client, userId) {
    const result = await client.query(
        `
        WITH friends AS (
            SELECT $1::int AS user_id
            UNION
            SELECT referred_user_id
            FROM referral_log
            WHERE referrer_user_id = $1
        ),
        totals AS (
            SELECT
                f.user_id,
                COALESCE(SUM(bbl.amount), 0) AS total
            FROM friends f
            LEFT JOIN booster_blue_ledger bbl ON bbl.user_id = f.user_id
            GROUP BY f.user_id
        ),
        ranked AS (
            SELECT
                user_id,
                total,
                RANK() OVER (ORDER BY total DESC) AS rank_position,
                COUNT(*) OVER () AS total_users
            FROM totals
        )
        SELECT rank_position, total_users
        FROM ranked
        WHERE user_id = $1
        `,
        [userId]
    );

    if (result.rowCount === 0) {
        return null;
    }

    const rankPosition = parseInt(result.rows[0].rank_position || '0', 10);
    const rankTotal = parseInt(result.rows[0].total_users || '0', 10);
    const rankPercentile = rankTotal > 0 ? Math.ceil((rankPosition / rankTotal) * 100) : null;

    return {
        rank_position: rankPosition,
        rank_total: rankTotal,
        rank_percentile: rankPercentile
    };
}

// --- Helper: comparación diaria de BLUE iou vs ayer ---
async function getBoosterDailyData(client, userId) {
    const [todayResult, yesterdayResult] = await Promise.all([
        client.query(
            `
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM booster_blue_ledger
            WHERE user_id = $1
              AND amount > 0
              AND created_at >= date_trunc('day', NOW())
              AND created_at < date_trunc('day', NOW()) + INTERVAL '1 day'
            `,
            [userId]
        ),
        client.query(
            `
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM booster_blue_ledger
            WHERE user_id = $1
              AND amount > 0
              AND created_at >= date_trunc('day', NOW()) - INTERVAL '1 day'
              AND created_at < date_trunc('day', NOW())
            `,
            [userId]
        )
    ]);

    const todayEarned = parseFloat(todayResult.rows[0]?.total) || 0;
    const yesterdayEarned = parseFloat(yesterdayResult.rows[0]?.total) || 0;

    return {
        daily_today: todayEarned,
        daily_yesterday: yesterdayEarned,
        daily_improved: todayEarned > yesterdayEarned
    };
}

// --- ENDPOINT CORREGIDO Y PROFESIONAL PARA PERFIL DE IMPULSOR ---
// Devuelve tanto el perfil del usuario como su historial completo de transacciones de impulsor.
app.get('/api/users/:username/booster-profile', async (req, res) => {
    const { username } = req.params;
    if (!username) {
        return res.status(400).json({ message: 'Se requiere un nombre de usuario.' });
    }

    const client = await pool.connect();
    try {
        // 1. Obtener el usuario.
        const userResult = await client.query(
            `SELECT id, username FROM users WHERE username = $1`,
            [username]
        );

        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const user = userResult.rows[0];

        // 2. Fuente de verdad: el total del perfil de impulsor es la suma del ledger.
        const totalResult = await client.query(
            'SELECT COALESCE(SUM(amount), 0) AS total FROM booster_blue_ledger WHERE user_id = $1',
            [user.id]
        );
        const totalBoosterBlue = parseFloat(totalResult.rows[0].total) || 0;

        if (totalBoosterBlue <= 0) {
            return res.json({
                is_booster: false,
                message: 'Este usuario aún no forma parte del programa de impulsores.'
            });
        }

        // 3. Obtener niveles, historial (fuente de verdad) y métricas en paralelo.
        // En fintech, el "extracto" debe venir del ledger para que SIEMPRE cuadre con el total.
        const [ledgerHistoryResult, levelSettingsResult, currentLevelResult, tasksCountResult, rankData, friendsRankData, dailyData] = await Promise.all([
            // Historial: booster_blue_ledger (source of truth) + descripción (si existe) desde booster_transactions
            client.query(
                `
                SELECT
                    bbl.id,
                    bbl.amount,
                    bbl.created_at,
                    bbl.source_publication_id AS related_publication_id,
                    COALESCE(bt_pick.type,
                        CASE
                            WHEN bbl.source_publication_id IS NOT NULL AND bbl.amount > 0 THEN 'task_reward'
                            WHEN bbl.amount < 0 THEN 'debit'
                            ELSE 'credit'
                        END
                    ) AS type,
                    COALESCE(
                        bt_pick.description,
                        CASE
                            WHEN p.title IS NOT NULL THEN 'Actividad de Impulsor: \"' || p.title || '\"'
                            ELSE 'Actividad de Impulsor (legacy)'
                        END
                    ) AS description
                FROM booster_blue_ledger bbl
                LEFT JOIN publications p ON p.id = bbl.source_publication_id
                LEFT JOIN LATERAL (
                    SELECT bt.type, bt.description
                    FROM booster_transactions bt
                    WHERE bt.user_id = bbl.user_id
                      AND bt.amount = bbl.amount
                      AND bt.related_publication_id IS NOT DISTINCT FROM bbl.source_publication_id
                      AND bt.created_at BETWEEN (bbl.created_at - INTERVAL '2 minutes') AND (bbl.created_at + INTERVAL '2 minutes')
                    ORDER BY ABS(EXTRACT(EPOCH FROM (bt.created_at - bbl.created_at))) ASC
                    LIMIT 1
                ) bt_pick ON TRUE
                WHERE bbl.user_id = $1
                ORDER BY bbl.created_at DESC
                `,
                [user.id]
            ),
            client.query('SELECT * FROM booster_level_settings ORDER BY level ASC'),
            // Nivel calculado directamente desde el total (no depende de "cache" en users)
            client.query(
                'SELECT MAX(level) AS current_level FROM booster_level_settings WHERE min_blue_required <= $1',
                [totalBoosterBlue]
            ),
            // Conteo de tareas en el historial (una fila = una tarea)
            client.query(
                `SELECT COUNT(*) AS tasks_completed
                 FROM booster_blue_ledger bbl
                 WHERE bbl.user_id = $1 AND bbl.amount > 0 AND bbl.source_publication_id IS NOT NULL`,
                [user.id]
            ),
            getBoosterRankData(client, user.id),
            getReferralRankData(client, user.id),
            getBoosterDailyData(client, user.id)
        ]);

        const allLevels = levelSettingsResult.rows;
        const currentLevel = currentLevelResult.rows[0].current_level || 0;
        const currentLevelInfo = allLevels.find(l => l.level === currentLevel) || null;
        const nextLevelInfo = allLevels.find(l => l.level === (currentLevel || 0) + 1) || null;

        const tasksCompleted = parseInt(tasksCountResult.rows[0]?.tasks_completed || '0', 10);

        // 4. Enviar la respuesta completa con el perfil y el historial.
        res.json({
            is_booster: true,
            username: user.username,
            booster_level: currentLevel,
            total_booster_blue: totalBoosterBlue,
            current_level_info: currentLevelInfo,
            next_level_info: nextLevelInfo,
            booster_tasks_completed_count: tasksCompleted,
            transactions: ledgerHistoryResult.rows,
            all_levels: allLevels,
            rank_position: rankData?.rank_position || null,
            rank_total: rankData?.rank_total || null,
            rank_percentile: rankData?.rank_percentile || null,
            friends_rank_position: friendsRankData?.rank_position || null,
            friends_rank_total: friendsRankData?.rank_total || null,
            friends_rank_percentile: friendsRankData?.rank_percentile || null,
            daily_today: dailyData?.daily_today || 0,
            daily_yesterday: dailyData?.daily_yesterday || 0,
            daily_improved: dailyData?.daily_improved || false
        });

    } catch (error) {
        console.error(`Error al obtener el perfil de impulsor para ${username}:`, error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// --- ENDPOINT PROFESIONAL: Perfil de impulsor del usuario autenticado ---
// Fuente de verdad de identidad: JWT (req.user.userId / req.user.username)
// Esto evita que alguien consulte/forje el username de otra persona para ver su historial.
app.get('/api/me/booster-profile', verifyUserToken, async (req, res) => {
    const userId = req.user?.userId;
    const username = req.user?.username;

    if (!userId) {
        return res.status(401).json({ message: 'No autenticado.' });
    }

    const client = await pool.connect();
    try {
        // 1) Total (source of truth)
        const totalResult = await client.query(
            'SELECT COALESCE(SUM(amount), 0) AS total FROM booster_blue_ledger WHERE user_id = $1',
            [userId]
        );
        const totalBoosterBlue = parseFloat(totalResult.rows[0].total) || 0;

        if (totalBoosterBlue <= 0) {
            return res.json({
                is_booster: false,
                message: 'Este usuario aún no forma parte del programa de impulsores.'
            });
        }

        // 2) Niveles + historial + conteos (igual que el endpoint por username)
        const [ledgerHistoryResult, levelSettingsResult, currentLevelResult, tasksCountResult, rankData, friendsRankData, dailyData] = await Promise.all([
            client.query(
                `
                SELECT
                    bbl.id,
                    bbl.amount,
                    bbl.created_at,
                    bbl.source_publication_id AS related_publication_id,
                    COALESCE(bt_pick.type,
                        CASE
                            WHEN bbl.source_publication_id IS NOT NULL AND bbl.amount > 0 THEN 'task_reward'
                            WHEN bbl.amount < 0 THEN 'debit'
                            ELSE 'credit'
                        END
                    ) AS type,
                    COALESCE(
                        bt_pick.description,
                        CASE
                            WHEN p.title IS NOT NULL THEN 'Actividad de Impulsor: \"' || p.title || '\"'
                            ELSE 'Actividad de Impulsor (legacy)'
                        END
                    ) AS description
                FROM booster_blue_ledger bbl
                LEFT JOIN publications p ON p.id = bbl.source_publication_id
                LEFT JOIN LATERAL (
                    SELECT bt.type, bt.description
                    FROM booster_transactions bt
                    WHERE bt.user_id = bbl.user_id
                      AND bt.amount = bbl.amount
                      AND bt.related_publication_id IS NOT DISTINCT FROM bbl.source_publication_id
                      AND bt.created_at BETWEEN (bbl.created_at - INTERVAL '2 minutes') AND (bbl.created_at + INTERVAL '2 minutes')
                    ORDER BY ABS(EXTRACT(EPOCH FROM (bt.created_at - bbl.created_at))) ASC
                    LIMIT 1
                ) bt_pick ON TRUE
                WHERE bbl.user_id = $1
                ORDER BY bbl.created_at DESC
                `,
                [userId]
            ),
            client.query('SELECT * FROM booster_level_settings ORDER BY level ASC'),
            client.query(
                'SELECT MAX(level) AS current_level FROM booster_level_settings WHERE min_blue_required <= $1',
                [totalBoosterBlue]
            ),
            client.query(
                `SELECT COUNT(*) AS tasks_completed
                 FROM booster_blue_ledger bbl
                 WHERE bbl.user_id = $1 AND bbl.amount > 0 AND bbl.source_publication_id IS NOT NULL`,
                [userId]
            ),
            getBoosterRankData(client, userId),
            getReferralRankData(client, userId),
            getBoosterDailyData(client, userId)
        ]);

        const allLevels = levelSettingsResult.rows;
        const currentLevel = currentLevelResult.rows[0].current_level || 0;
        const currentLevelInfo = allLevels.find(l => l.level === currentLevel) || null;
        const nextLevelInfo = allLevels.find(l => l.level === (currentLevel || 0) + 1) || null;
        const tasksCompleted = parseInt(tasksCountResult.rows[0]?.tasks_completed || '0', 10);

        res.json({
            is_booster: true,
            username: username || null,
            booster_level: currentLevel,
            total_booster_blue: totalBoosterBlue,
            current_level_info: currentLevelInfo,
            next_level_info: nextLevelInfo,
            booster_tasks_completed_count: tasksCompleted,
            transactions: ledgerHistoryResult.rows,
            all_levels: allLevels,
            rank_position: rankData?.rank_position || null,
            rank_total: rankData?.rank_total || null,
            rank_percentile: rankData?.rank_percentile || null,
            friends_rank_position: friendsRankData?.rank_position || null,
            friends_rank_total: friendsRankData?.rank_total || null,
            friends_rank_percentile: friendsRankData?.rank_percentile || null,
            daily_today: dailyData?.daily_today || 0,
            daily_yesterday: dailyData?.daily_yesterday || 0,
            daily_improved: dailyData?.daily_improved || false
        });
    } catch (error) {
        console.error(`Error al obtener el perfil de impulsor (me) para ${username}:`, error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// --- NUEVA LÓGICA DE PAGOS A IMPULSORES ---
// Esta función maneja los pagos mensuales a impulsores, priorizando niveles bajos primero como beneficio
// (usuarios con menos acumulado reciben pagos antes para incentivar participación temprana).
async function executeBoosterPayments() {
    const today = new Date();
    // El proceso se ejecuta el primer día de cada mes.
    if (today.getDate() !== 1) {
        // console.log('BOOSTER PAYMENTS: No es el primer día del mes, saltando ciclo.');
        return;
    }

    console.log('BOOSTER PAYMENTS: Iniciando ciclo de pagos a impulsores...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const settingsResult = await client.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'booster_system_enabled'`);
        if (settingsResult.rows[0]?.setting_value !== 'true') {
            console.log('BOOSTER PAYMENTS: El sistema de impulsores está desactivado. Saltando ciclo.');
            await client.query('ROLLBACK');
            client.release();
            return;
        }

        // Determinar el mes de pago (el mes anterior)
        const paymentMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const paymentMonthString = `${paymentMonth.getFullYear()}-${(paymentMonth.getMonth() + 1).toString().padStart(2, '0')}`;

        // Verificar si ya se realizó el pago para este mes
        const lastPaymentResult = await client.query(`SELECT 1 FROM booster_payment_log WHERE to_char(payment_month, 'YYYY-MM') = $1 LIMIT 1`, [paymentMonthString]);
        if (lastPaymentResult.rowCount > 0) {
            console.log(`BOOSTER PAYMENTS: El pago para ${paymentMonthString} ya fue realizado. Saltando ciclo.`);
            await client.query('ROLLBACK');
            client.release();
            return;
        }

        // 1. Calcular las comisiones totales del mes anterior
        const commissionResult = await client.query(
            `SELECT SUM(commission_amount_blue) as total FROM platform_commission_log WHERE to_char(created_at, 'YYYY-MM') = $1`,
            [paymentMonthString]
        );
        let fundsAvailable = parseFloat(commissionResult.rows[0].total) || 0;

        if (fundsAvailable <= 0) {
            console.log(`BOOSTER PAYMENTS: No hay fondos de comisiones disponibles para el mes ${paymentMonthString}.`);
            await client.query('ROLLBACK');
            client.release();
            return;
        }

        console.log(`BOOSTER PAYMENTS: Fondos disponibles para ${paymentMonthString}: ${fundsAvailable.toFixed(4)} BLUE.`);

        // 2. Obtener todos los niveles y todos los impulsores
        const levelsResult = await client.query('SELECT * FROM booster_level_settings ORDER BY level ASC');
        const boostersResult = await client.query(`
            SELECT u.id, u.username, u.booster_level, 
                   (SELECT SUM(amount) FROM booster_blue_ledger WHERE user_id = u.id) as total_booster_blue
            FROM users u WHERE u.is_booster = TRUE
        `);

        // 3. Iterar por cada nivel en orden de prioridad (bajos primero)
        // Esto beneficia a niveles inferiores: se pagan completos si hay fondos, antes de pasar a superiores.
        for (const level of levelsResult.rows) {
            if (fundsAvailable <= 0) break;

            const boostersInLevel = boostersResult.rows.filter(b => b.booster_level === level.level);
            if (boostersInLevel.length === 0) continue;

            const totalDebtForLevel = boostersInLevel.reduce((sum, b) => sum + parseFloat(b.total_booster_blue), 0);
            if (totalDebtForLevel <= 0) continue;

            console.log(`BOOSTER PAYMENTS: Procesando Nivel ${level.level}. Deuda total: ${totalDebtForLevel.toFixed(4)}. Fondos restantes: ${fundsAvailable.toFixed(4)}.`);

            const paymentPercentage = Math.min(1.0, fundsAvailable / totalDebtForLevel);

            // 4. Pagar a cada impulsor en el nivel
            for (const booster of boostersInLevel) {
                const amountToPay = parseFloat(booster.total_booster_blue) * paymentPercentage;
                if (amountToPay > 0) {
                    // Pagar al saldo de escrow del usuario usando Event Sourcing (FIX: Evitar bloqueo de trigger)
                    await client.query("SELECT record_balance_event($1, 'deposit', 'escrow_blue', $2, NULL)", [booster.id, amountToPay]);

                    // Registrar la transacción de pago
                    const paymentDescription = `Recompensa de Impulsor (Nivel ${level.level}) para el mes de ${paymentMonth.toLocaleString('es', { month: 'long', year: 'numeric' })}`;
                    await client.query(`INSERT INTO transactions (user_id, type, description, blue_change) VALUES ($1, 'booster_reward', $2, $3)`, [booster.id, paymentDescription, amountToPay]);

                    // Registrar en el log de pagos de impulsores
                    await client.query(
                        `INSERT INTO booster_payment_log (user_id, amount_paid, payment_month, booster_level_at_payment) VALUES ($1, $2, $3, $4)`,
                        [booster.id, amountToPay, paymentMonth, level.level]
                    );

                    // Notificar al usuario
                    const notificationMsg = `¡Felicidades! Has recibido ${amountToPay.toFixed(4)} BLUE (en depósito) como recompensa de Impulsor.`;
                    await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [booster.username, notificationMsg]);
                }
            }

            fundsAvailable -= totalDebtForLevel * paymentPercentage;
        }

        await client.query('COMMIT');
        console.log('BOOSTER PAYMENTS: Ciclo de pagos finalizado exitosamente.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('BOOSTER PAYMENTS: Error crítico durante el ciclo de pagos a impulsores.', error);
    } finally {
        if (client) client.release();
    }
}

// Endpoint para obtener la configuración actual de la aplicación
app.get('/settings', verifyAdminToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM app_settings WHERE id = 1');
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            // Si no hay configuraciones, devuelve valores predeterminados.
            // El backend debería asegurarse de que siempre exista una fila.
            res.status(404).json({ message: 'No se encontró la configuración de la aplicación.' });
        }
    } catch (error) {
        console.error('Error al obtener la configuración:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Endpoint para actualizar la configuración de la aplicación
app.post('/settings', verifyAdminToken, async (req, res) => {
    const {
        allow_new_registrations,
        allow_new_publications,
        booster_system_enabled,
        debt_system_enabled,
        platform_commission_percentage,
        public_profiles_enabled,
        referral_bonus_enabled,
        referral_bonus_amount,
        welcome_bonus_enabled,
        welcome_bonus_amount
    } = req.body;

    if (typeof platform_commission_percentage === 'undefined' || typeof public_profiles_enabled === 'undefined') {
        return res.status(400).json({ message: 'Faltan parámetros de configuración requeridos.' });
    }

    try {
        // GOVERNANCE GUARD: bloquear cambios directos si hay guardianes activos
        try {
            const govCheck = await pool.query(
                `SELECT COUNT(*) as count FROM governance_guardians WHERE status = 'active'`
            );
            if (parseInt(govCheck.rows[0].count, 10) > 0) {
                return res.status(403).json({
                    message: 'El sistema de gobernanza está activo. Los cambios de configuración deben realizarse a través del panel de gobernanza (Winton-Consensus).',
                    governance_required: true,
                });
            }
        } catch (govErr) {
            if (govErr.code !== '42P01') throw govErr;
        }

        await pool.query(
            `UPDATE app_settings SET
                allow_new_registrations = $1,
                allow_new_publications = $2,
                booster_system_enabled = $3,
                debt_system_enabled = $4,
                platform_commission_percentage = $5,
                public_profiles_enabled = $6,
                referral_bonus_enabled = $7,
                referral_bonus_amount = $8,
                welcome_bonus_enabled = $9,
                welcome_bonus_amount = $10
            WHERE id = 1`,
            [
                allow_new_registrations,
                allow_new_publications,
                booster_system_enabled,
                debt_system_enabled,
                platform_commission_percentage,
                public_profiles_enabled,
                referral_bonus_enabled,
                referral_bonus_amount,
                welcome_bonus_enabled,
                welcome_bonus_amount
            ]
        );
        res.json({ success: true, message: 'Configuración actualizada correctamente.' });
    } catch (error) {
        console.error('Error al actualizar la configuración:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.get('/api/platform-settings', async (req, res) => {
    try {
        const settingsKeys = [
            'pre_launch_mode_enabled',
            'allow_request_publications',
            'allow_sell_publications',
            'allow_donation_publications',
            'allow_quick_sale_publications'
        ];
        const result = await pool.query(`
            SELECT setting_key, setting_value 
            FROM app_settings 
            WHERE setting_key = ANY($1::text[])
        `, [settingsKeys]);

        const settings = result.rows.reduce((acc, row) => {
            acc[row.setting_key] = row.setting_value === 'true';
            return acc;
        }, {});

        settings.platform_username = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';

        res.status(200).json(settings);
    } catch (error) {
        console.error("Error al obtener la configuración de la plataforma:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
});

// ===================================================================================
// == FUNCIONES AUXILIARES DE LÓGICA DE NEGOCIO (HELPERS)
// ===================================================================================



// Endpoint para obtener la configuración pública de la aplicación
app.get('/api/public-settings', async (req, res) => {
    try {
        const settingKeys = [
            'public_profiles_enabled',
            'referral_reward_amount',
            'welcome_bonus_amount'
            // Añadir aquí otras claves que el frontend necesite de forma segura
        ];
        const result = await pool.query(
            'SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1::text[])',
            [settingKeys]
        );

        const settingsObject = result.rows.reduce((acc, setting) => {
            acc[setting.setting_key] = setting.setting_value;
            return acc;
        }, {});

        res.status(200).json(settingsObject);

    } catch (error) {
        console.error("Error al obtener la configuración pública:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
});



// Actualizar código de referido de un usuario (Admin)
app.put('/api/admin/users/:userId/referral-code', verifyAdminToken, async (req, res) => {
    const { userId } = req.params;
    const { newReferralCode } = req.body;

    if (!newReferralCode) {
        return res.status(400).json({ message: "Se requiere un nuevo código de referido." });
    }

    // Validación básica de formato (letras, números, guiones, sin espacios)
    if (!/^[a-zA-Z0-9_-]+$/.test(newReferralCode)) {
        return res.status(400).json({ message: "El código solo puede contener letras, números y guiones. Sin espacios." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verificar si el código ya existe (debe ser único globalmente)
        const checkResult = await client.query('SELECT id FROM users WHERE referral_code = $1', [newReferralCode]);
        if (checkResult.rowCount > 0 && checkResult.rows[0].id != userId) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: "Este código de referido ya está en uso por otro usuario." });
        }

        // Obtener usuario actual para log
        const oldUserResult = await client.query('SELECT username, referral_code FROM users WHERE id = $1', [userId]);
        if (oldUserResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Usuario no encontrado." });
        }
        const oldCode = oldUserResult.rows[0].referral_code;
        const targetUsername = oldUserResult.rows[0].username;

        // Actualizar
        await client.query('UPDATE users SET referral_code = $1 WHERE id = $2', [newReferralCode, userId]);

        // Audit Log
        await logAuditEvent(client, req, {
            eventType: 'admin.user.update_referral_code',
            actorUsername: 'admin', // O tomarlo del token si está disponible en req.user
            targetUsername: targetUsername,
            metadata: {
                old_code: oldCode,
                new_code: newReferralCode
            }
        });

        await client.query('COMMIT');
        res.json({ success: true, message: `Código de referido actualizado a: ${newReferralCode}` });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar código de referido:', error);
        // Manejar error de unicidad si se escapó
        if (error.code === '23505') {
            return res.status(409).json({ message: "Este código de referido ya está en uso." });
        }
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// El sistema de Broadcast Email ha sido modularizado en src/controllers/adminController.js
// Las rutas son manejadas ahora por src/routes/adminRoutes.js

// =================================================================================

// ==  PERFIL PÚBLICO DE IMPULSOR (BOOSTER)                                       ==
// =================================================================================
// NOTA: Este endpoint se implementa arriba con historial completo y nivel calculado.
// La versión anterior duplicada fue removida para evitar inconsistencias.

// =================================================================================
// ==  OBTENER PUBLICACIONES DE UN USUARIO (PARA SU PERFIL PÚBLICO)               ==

// === EXPORTAR PARA TESTING AUTORIZADO ===
module.exports = { app, pool, startServer };