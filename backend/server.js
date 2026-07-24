// 0. Cargar variables de entorno dinámicamente según el entorno
require('./config.js');

// 1. Importar las librerías necesarias
const express = require('express');
const pool = require('./src/config/db'); // Importamos la conexión a BD centralizada
const cors = require('cors');
const helmet = require('helmet'); // [SEGURIDAD P0] HTTP Security Headers (X-Frame-Options, HSTS, CSP, etc.)
const cookieParser = require('cookie-parser'); // NECESARIO PARA COOKIES
const path = require('path');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const { initializeDatabase } = require('./src/config/databaseInit');
const { processPendingBroadcasts } = require('./src/services/emailService');
const { logAuditEvent, startAuditCleanupJob } = require('./src/services/auditService');
const authRoutes = require('./src/routes/authRoutes');
const eventBus = require('./src/services/notificationEventBus'); // BUS DE EVENTOS GLOBAL
const {
    requireAcceptedLegalByUsernameField
} = require('./src/middleware/legalAcceptanceMiddleware');
const { verifyAdminToken } = require('./src/middleware/adminAuthMiddleware');
const { seoMiddlewareCauses, seoMiddlewareReferrals } = require('./src/middleware/seoMiddleware');

// === SERVICIOS Y RUTAS MODULARIZADOS NUEVAS ===
const publicationRoutes = require('./src/routes/publicationRoutes');
const validationRoutes = require('./src/routes/validationRoutes');
const solidarioRoutes = require('./src/routes/solidarioRoutes');
const recruitmentRoutes = require('./src/routes/recruitmentRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const masterApiRouter = require('./src/routes/index'); // ENRUTADOR MAESTRO MODULAR
const createTransactionRouter = require('./src/routes/transactionRoutes');
const { executeBoosterPayments } = require('./src/services/boosterService');

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

// SEGURIDAD FINTECH / AUDITORÍA BANCARIA: Cero Hardcoded Secrets y resolución dinámica.
// Inyectamos dinámicamente FRONTEND_URL en el listado de orígenes permitidos por CORS.
// Esto evita el cruce de entornos y asegura que si el dominio se reconfigura en Render/AWS,
// el sistema acepte las conexiones de origen cruzado de manera estrictamente controlada.
if (process.env.FRONTEND_URL) {
    const rawFrontendUrl = process.env.FRONTEND_URL.trim();
    if (rawFrontendUrl) {
        try {
            // Normalizamos el origen parseándolo como una URL válida para extraer el protocolo y host
            const parsedOrigin = new URL(rawFrontendUrl).origin;
            ALLOWED_ORIGINS.push(parsedOrigin);
            
            // Si el frontend está configurado sin 'www', agregamos la variante con 'www' para evitar bloqueos
            if (parsedOrigin.startsWith('https://') && !parsedOrigin.includes('://www.')) {
                const domainWithoutProtocol = parsedOrigin.replace('https://', '');
                ALLOWED_ORIGINS.push(`https://www.${domainWithoutProtocol}`);
            }
        } catch (error) {
            // Registro auditable en caso de configuración errónea en las variables del servidor
            console.error('[CORS SECURITY WARNING]: FRONTEND_URL configurado con formato inválido:', error.message);
        }
    }
}

if (process.env.NODE_ENV !== 'production') {
    ALLOWED_ORIGINS.push(
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500'
    );
}

// [SEGURIDAD P0] Helmet: Inyecta HTTP Security Headers en cada respuesta del servidor.
// Protege contra: Clickjacking (X-Frame-Options), MIME Sniffing (X-Content-Type-Options),
// downgrade a HTTP (HSTS), inyección de scripts externos (CSP), fuga de Referer (Referrer-Policy).
// Referencia OWASP: https://owasp.org/www-project-secure-headers/
app.use(helmet({
    // Content-Security-Policy: Controla qué recursos puede cargar el navegador.
    // Previene inyección de scripts, estilos e imágenes de dominios no autorizados.
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],                                         // Solo recursos del mismo origen por defecto
            scriptSrc: ["'self'"],                                          // Scripts solo del mismo origen (bloquea inline por defecto)
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], // Estilos propios + inline (necesario para componentes) + Google Fonts
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],               // Fuentes propias + Google Fonts CDN
            imgSrc: ["'self'", 'data:', 'https:'],                          // Imágenes propias + data URIs (SVG inline) + cualquier HTTPS
            connectSrc: ["'self'", ...ALLOWED_ORIGINS],                     // Conexiones API solo a orígenes permitidos por CORS
            frameSrc: ["'none'"],                                           // Prohibir iframes de terceros (anti-clickjacking reforzado)
            objectSrc: ["'none'"],                                          // Bloquear plugins Flash/Java/Silverlight
            upgradeInsecureRequests: [],                                     // Forzar upgrade de HTTP a HTTPS automáticamente
        }
    },
    // crossOriginEmbedderPolicy: false para permitir carga de fuentes externas (Google Fonts)
    crossOriginEmbedderPolicy: false,
    // crossOriginResourcePolicy: false para permitir compartir imágenes subidas entre frontend y backend
    crossOriginResourcePolicy: false,
}));

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
// [SEGURIDAD P0] Limitar el tamaño máximo del body JSON a 1MB.
// Sin este límite, un atacante podría enviar payloads de cientos de MB
// causando un Denial of Service (DoS) por agotamiento de memoria RAM.
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser()); // CRÍTICO: Parsea las cookies de las peticiones

// Inyección dinámica de metatags de SEO (Open Graph) para previsualizaciones en WhatsApp/Telegram/Redes
app.get('/causa-solidaria.html', seoMiddlewareCauses);
app.get('/register.html', seoMiddlewareReferrals);

app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'))); // Habilitar acceso a imágenes subidas

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

        // --- SEGURIDAD Y AUDITABILIDAD DE BASE DE DATOS ---
        // 1. Inicializar base de datos: Crea las tablas base del sistema (users, publications, etc.) en su estado inicial.
        // Esto es un pre-requisito obligatorio para que las migraciones posteriores puedan realizar alteraciones (ALTER TABLE) de forma segura.
        await initializeDatabase();

        // 2. Ejecutar migraciones pendientes: Una vez aseguradas las tablas base, el Migration Runner aplica de forma secuencial
        // e incremental las modificaciones de esquema (triggers de inmutabilidad, columnas adicionales, etc.)
        const { runPendingMigrations } = require('./scripts/migrationRunner');
        await runPendingMigrations();

        startAuditCleanupJob();
        console.log("Base de datos inicializada correctamente.");

        // --- AHORA DEFINIMOS LAS RUTAS ---
        app.use('/api', authRoutes); // Registrar rutas de autenticación
        app.use('/api', validationRoutes); // Registrar rutas de validación de disponibilidad
        app.use('/api/recruitment', recruitmentRoutes); // <<< ALTA PRIORIDAD
        app.use('/api/solidario', solidarioRoutes); // Registrar rutas de Winton Solidario
        app.use('/api/admin', adminRoutes); // <<< NUEVAS RUTAS MODULARES ADMIN
        app.use('/api', masterApiRouter); // <<< RUTA CENTRALIZADA MODULAR

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

        // --- NUEVO: Rutas Legales (Gestión de Menores y Tutores) ---
        app.use('/api/minor', require('./src/routes/minorRoutes'));

        // --- NUEVO: Rutas de Perfiles de Usuario e Historial ---
        app.use('/', require('./src/routes/userRoutes'));
        
        // --- P2P Modulares ---
        app.use('/', require('./src/routes/p2pRoutes'));

        // --- Módulo del Sistema y Configuración Pública ---
        app.use('/api', require('./src/routes/systemRoutes'));


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
        // (El código antiguo de Solidario fue removido por Garbage Collection, ya estaba modularizado en humanitarianUserRoutes.js)

        // Rutas de Autenticación movidas a src/routes/authRoutes.js
        app.use('/', authRoutes);

        // --- RUTA ADD-TUTOR EXTRAÍDA A minorRoutes.js ---





        // --- NOTIFICACIONES IN-APP EXTRAÍDAS A inAppNotificationRoutes.js ---






        // NOTA: Las rutas /users/:username/transactions y /api/me/transactions
        // se han movido a src/routes/transactionRoutes.js y src/controllers/transactionController.js
        // bajo la modularización del endpoint de transacciones para el cumplimiento de auditoría y Web3.









        // --- Rutas de Administración Inline removidas y delegadas a src/routes/adminRoutes.js ---

        // --- Procesos en segundo plano ---

        const startBackgroundJobs = require('./src/workers/cronManager');
        startBackgroundJobs(pool);
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
                    `SELECT record_balance_event($1::INTEGER, 'withdrawal'::TEXT, 'escrow_blue'::TEXT, $2::NUMERIC, NULL::JSONB)`,
                    [sellerId, order.blue_amount]
                );
                await client.query(
                    `SELECT record_balance_event($1::INTEGER, 'deposit'::TEXT, 'liquid_blue'::TEXT, $2::NUMERIC, NULL::JSONB)`,
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



// --- LÓGICA DE PAGOS A IMPULSORES ---
// La lógica y el scheduler de pagos a impulsores han sido modularizados en src/services/boosterService.js
// para soportar configuraciones dinámicas de intervalos de tiempo y mantener server.js limpio.



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