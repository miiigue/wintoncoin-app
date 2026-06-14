// 0. Cargar variables de entorno
require('dotenv').config();

// 1. Importar las librerías necesarias
const express = require('express');
const pool = require('./src/config/db'); // Importamos la conexión a BD centralizada
const cors = require('cors');
const cookieParser = require('cookie-parser'); // NECESARIO PARA COOKIES
const path = require('path');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
require('./config'); // Carga la configuración del entorno (development o production)
const { initializeDatabase } = require('./src/config/databaseInit');
const { processPendingBroadcasts } = require('./src/services/emailService');
const { logAuditEvent, startAuditCleanupJob } = require('./src/services/auditService');
const authRoutes = require('./src/routes/authRoutes');
const eventBus = require('./src/services/notificationEventBus'); // BUS DE EVENTOS GLOBAL
const {
    requireAcceptedLegalByUsernameField
} = require('./src/middleware/legalAcceptanceMiddleware');
const { verifyAdminToken } = require('./src/middleware/adminAuthMiddleware');

// === SERVICIOS Y RUTAS MODULARIZADOS NUEVAS ===
const publicationRoutes = require('./src/routes/publicationRoutes');
const validationRoutes = require('./src/routes/validationRoutes');
const solidarioRoutes = require('./src/routes/solidarioRoutes');
const recruitmentRoutes = require('./src/routes/recruitmentRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
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

        const DEBT_COLLECTOR_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos
        setInterval(async () => {
            console.log('DEBT COLLECTOR: Iniciando ciclo de recolección de deudas vencidas...');
            // Declaramos la variable del cliente de base de datos en el ámbito exterior para que sea accesible en try/catch/finally
            let client;
            try {
                // Obtenemos la conexión del pool. Si falla la red (EHOSTUNREACH), se captura de forma segura en el catch
                client = await pool.connect();

                // Iniciamos la transacción SQL de manera segura
                await client.query('BEGIN');

                // Consultamos si el sistema de deudas está activado en las configuraciones de la aplicación
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
                    const burnResult = await require('./src/services/financialCoreService').executeBurn(client, username, amountToSettle);

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

                // Confirmamos la transacción tras procesar correctamente
                await client.query('COMMIT');
                console.log('DEBT COLLECTOR: Ciclo de recolección finalizado exitosamente.');

            } catch (error) {
                // Solo ejecutamos ROLLBACK si el cliente logró conectarse e iniciar la transacción
                if (client) {
                    try {
                        await client.query('ROLLBACK');
                    } catch (rollbackError) {
                        console.error('DEBT COLLECTOR: Error al ejecutar ROLLBACK:', rollbackError.message);
                    }
                }
                // Registramos el error de forma auditable sin tumbar la aplicación
                console.error('DEBT COLLECTOR: Error crítico durante el ciclo de recolección de deudas.', error.message || error);
            } finally {
                // Liberamos el cliente de vuelta al pool si fue instanciado para prevenir fugas de conexiones
                if (client) {
                    client.release();
                }
            }
        }, DEBT_COLLECTOR_INTERVAL_MS);

        const TOKEN_RELEASER_INTERVAL_MS = 1 * 60 * 1000; // 1 minuto
        setInterval(async () => {
            console.log('TOKEN RELEASER: Iniciando ciclo de liberación de tokens BLUE...');
            // Declaramos la variable del cliente de base de datos en el ámbito exterior para que sea accesible en try/catch/finally
            let client;
            try {
                // Obtenemos la conexión del pool. Si falla la red (EHOSTUNREACH), se captura de forma segura en el catch
                client = await pool.connect();

                // Iniciamos la transacción SQL de manera segura
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

                // Confirmamos la transacción tras procesar correctamente
                await client.query('COMMIT');
                console.log('TOKEN RELEASER: Ciclo de liberación finalizado exitosamente.');

            } catch (error) {
                // Solo ejecutamos ROLLBACK si el cliente logró conectarse e iniciar la transacción
                if (client) {
                    try {
                        await client.query('ROLLBACK');
                    } catch (rollbackError) {
                        console.error('TOKEN RELEASER: Error al ejecutar ROLLBACK:', rollbackError.message);
                    }
                }
                // Registramos el error de forma auditable sin tumbar la aplicación
                console.error('TOKEN RELEASER: Error crítico durante el ciclo de liberación de tokens.', error.message || error);
            } finally {
                // Liberamos el cliente de vuelta al pool si fue instanciado para prevenir fugas de conexiones
                if (client) {
                    client.release();
                }
            }
        }, TOKEN_RELEASER_INTERVAL_MS);

        // --- PROCESO PERIÓDICO DE PAGO A IMPULSORES ---
        const BOOSTER_PAYMENT_INTERVAL_MS = 60 * 1000; // Revisar cada 1 minuto (soporta intervalos personalizados)
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