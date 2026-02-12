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
const { generateOtp6, hashOtpForEmail, sendOtpEmail, sendTransactionEmail, normalizeEmail, safeEqualHex } = require('./src/services/emailService');
const { logAuditEvent, startAuditCleanupJob } = require('./src/services/auditService');
const authRoutes = require('./src/routes/authRoutes');
const notificationService = require('./src/services/notificationService'); // Importamos el servicio de notificaciones
const eventBus = require('./src/services/notificationEventBus'); // BUS DE EVENTOS GLOBAL
const {
    requireAcceptedLegalForAuthenticatedUser,
    requireAcceptedLegalByUsernameField
} = require('./src/middleware/legalAcceptanceMiddleware');

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
    resendOtpLimiter
} = require('./src/middleware/rateLimiters');


// 3. Middlewares
// Configuración de CORS segura para permitir cookies
// CORS allowlist:
// - En producción: solo dominios reales (Hostinger/Render)
// - En desarrollo: además localhost para permitir trabajar sin abrir CORS globalmente
const ALLOWED_ORIGINS = [
    'https://wintoncoin-frontend.onrender.com',
    'https://sc.wintoncoin.com', // Hostinger (producción)
    'https://www.sc.wintoncoin.com',
    'https://demo.wintoncoin.com' // Entorno DEMO
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
        // Permitimos cualquier localhost/127.0.0.1 con cualquier puerto SOLO fuera de producción.
        if (process.env.NODE_ENV !== 'production') {
            const isLocalhostOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
            if (isLocalhostOrigin || isLanOrigin) return callback(null, true);
        }

        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(null, true); // TEMPORAL: Permitir todo en desarrollo local para evitar bloqueos
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

        // --- NUEVO: Rutas de Notificaciones Push (VAPID) ---
        const notificationRoutes = require('./src/routes/notificationRoutes');
        app.use('/api/notifications', notificationRoutes);


        // =================================================================================
        // ==  NUEVO FLUJO DE REGISTRO CON VERIFICACIÓN POR SMS (FASE 1: SOLICITUD)  ==
        // =================================================================================
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

        function resolveRepeatCooldownHours(body) {
            const days = parseInt(body.repeatCooldownDays, 10) || 0;
            const hours = parseInt(body.repeatCooldownHours, 10) || 0;
            const minutes = parseInt(body.repeatCooldownMinutes, 10) || 0;
            let totalMinutes = (days * 24 * 60) + (hours * 60) + minutes;
            if (!Number.isFinite(totalMinutes) || totalMinutes < 1) {
                totalMinutes = 12;
            }
            return totalMinutes / 60;
        }

        // Ruta para crear una nueva Publicación
        app.post('/publish', requireAcceptedLegalByUsernameField(['authorUsername']), async (req, res) => {
            const {
                title, description, blueCost, blueSell, authorUsername,
                availableSlots, autoApprove, publicationType,
                duration_days, duration_hours, duration_minutes,
                allowRepeatParticipation, maxRepeatPerUser, repeatCooldownHours,
                repeatCooldownDays, repeatCooldownMinutes
            } = req.body;

            if (!title || !description || !authorUsername || (!blueCost && !blueSell) || !publicationType) {
                return res.status(400).json({ message: "Faltan datos requeridos para la publicación." });
            }

            const client = await pool.connect();
            try {
                // --- INICIO DE LA TRANSACCIÓN ---
                await client.query('BEGIN');

                // 1. VERIFICAR PERMISOS DE PUBLICACIÓN
                const settingsKeys = [
                    'allow_request_publications',
                    'allow_sell_publications',
                    'allow_donation_publications'
                ];
                const settingsResult = await client.query(`SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1::text[])`, [settingsKeys]);
                const settings = settingsResult.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value === 'true' }), {});

                const typePermissionMap = {
                    'request': settings.allow_request_publications,
                    'sell': settings.allow_sell_publications,
                    'donation': settings.allow_donation_publications
                };

                if (!typePermissionMap[publicationType]) {
                    throw { status: 403, message: `La creación de publicaciones de tipo "${publicationType}" está desactivada temporalmente.` };
                }

                const isSellPost = publicationType === 'sell' || publicationType === 'donation';
                const costString = (blueSell || blueCost).toString().replace(',', '.');
                const cost = parseFloat(costString);

                if (isNaN(cost) || cost <= 0) {
                    throw { status: 400, message: "El costo o recompensa debe ser un número positivo." };
                }

                const slots = availableSlots ? parseInt(availableSlots, 10) : 1;
                if (isNaN(slots) || slots < 1) {
                    throw { status: 400, message: "La cantidad de cupos disponibles debe ser mayor a 0." };
                }

                const allowRepeat = !!allowRepeatParticipation;
                let maxRepeat = null;
                let repeatCooldown = 24;
                if (allowRepeat) {
                    maxRepeat = parseInt(maxRepeatPerUser, 10);
                    if (!Number.isFinite(maxRepeat) || maxRepeat < 2) {
                        throw { status: 400, message: "Indica el máximo de repeticiones por usuario (mínimo 2)." };
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

                const userResult = await client.query(`SELECT id, is_minor, tutor_user_id, account_status FROM users WHERE username = $1`, [authorUsername]);
                if (userResult.rowCount === 0) {
                    throw { status: 404, message: "El autor de la publicación no existe." };
                }
                const author = userResult.rows[0];
                const authorId = author.id;

                // Verificar si es menor sin tutor
                if (author.is_minor && (!author.tutor_user_id || author.account_status === 'pending_tutor')) {
                    await client.query('ROLLBACK');
                    return res.status(403).json({
                        message: "Por ser menor de edad, necesitas la autorización de un tutor para crear publicaciones. Por favor, agrega un tutor a tu cuenta primero.",
                        requires_tutor: true,
                        is_minor: true
                    });
                }

                // --- NUEVO: Lógica para calcular la fecha de expiración ---
                let expiresAt = null;
                const days = parseInt(duration_days, 10) || 0;
                const hours = parseInt(duration_hours, 10) || 0;
                const minutes = parseInt(duration_minutes, 10) || 0;

                if (days > 0 || hours > 0 || minutes > 0) {
                    expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + days);
                    expiresAt.setHours(expiresAt.getHours() + hours);
                    expiresAt.setMinutes(expiresAt.getMinutes() + minutes);
                }

                const sql = `
                    INSERT INTO publications
                        (title, description, blue_cost, is_sell_post, author_id, available_slots, auto_approve, category, expires_at, allow_repeat_participation, max_repeat_per_user, repeat_cooldown_hours)
                    VALUES
                        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    RETURNING id
                `;
                const result = await client.query(sql, [
                    title,
                    description,
                    cost,
                    isSellPost,
                    authorId,
                    slots,
                    !!autoApprove,
                    publicationType,
                    expiresAt,
                    allowRepeat,
                    maxRepeat,
                    repeatCooldown
                ]);

                await logAuditEvent(client, req, {
                    eventType: 'publication.created',
                    actorUsername: authorUsername,
                    publicationId: result.rows[0].id,
                    category: publicationType,
                    metadata: {
                        blue_cost: cost,
                        available_slots: slots,
                        auto_approve: !!autoApprove,
                        allow_repeat_participation: allowRepeat,
                        max_repeat_per_user: maxRepeat,
                        repeat_cooldown_hours: repeatCooldown,
                        expires_at: expiresAt ? expiresAt.toISOString() : null
                    }
                });

                await client.query('COMMIT');
                res.status(201).json({ message: "Publicación creada exitosamente.", publicationId: result.rows[0].id });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error al guardar la publicación:", error);
                res.status(error.status || 500).json({ message: error.message || "Error interno del servidor." });
            } finally {
                client.release();
            }
        });

        // Ruta para obtener publicaciones activas
        app.get('/publications/active', async (req, res) => {
            const { user: requestingUser, search } = req.query; // search puede ser undefined
            if (!requestingUser) return res.status(400).json({ message: "Es necesario especificar un usuario." });

            // FIX DE SEGURIDAD: Usar parámetros de consulta para prevenir inyección de SQL
            const queryParams = [requestingUser];
            let searchCondition = "";
            if (search) {
                // El placeholder para el parámetro de búsqueda será el siguiente número disponible.
                searchCondition = ` AND (p.title ILIKE $${queryParams.length + 1} OR p.description ILIKE $${queryParams.length + 1})`;
                queryParams.push(`%${search}%`);
            }

            // FIX FUNCIONAL: Añadido p.expires_at y p.allow_repeat_participation a la lista de campos
            const sql = `
                SELECT
            p.id, p.title, p.description, p.blue_cost, p.created_at, p.status, p.category,
            p.is_booster_task, p.is_sell_post, p.available_slots, p.expires_at, p.allow_repeat_participation, p.max_repeat_per_user, p.repeat_cooldown_hours,
                    u.username as author_username,
            u.average_rating as author_average_rating,
            u.ratings_count as author_ratings_count,
                    (
                        SELECT pa.status 
                        FROM publication_acceptances pa 
                        WHERE pa.publication_id = p.id AND pa.acceptor_username = $1
                        ORDER BY created_at DESC LIMIT 1
                    ) as user_acceptance_status,
                    (
                        SELECT COUNT(*)
                        FROM publication_acceptances pa
                        WHERE pa.publication_id = p.id 
                        AND pa.acceptor_username = $1 
                        AND pa.status = 'confirmed_paid'
                    ) as successful_participations,
                    (CASE
                        WHEN u.username = $1 THEN (
                            SELECT json_agg(json_build_object(
                                'username', participant_user.username,
                                'status', pa.status,
                                'accepted_at', pa.created_at,
                                'average_rating', participant_user.average_rating,
                                'ratings_count', participant_user.ratings_count
                            ) ORDER BY pa.created_at)
                            FROM publication_acceptances pa
                            JOIN users participant_user ON pa.acceptor_username = participant_user.username
                            WHERE pa.publication_id = p.id
                        )
                        ELSE NULL
                    END) as participants
                FROM
                    publications p
                JOIN
                    users u on p.author_id = u.id
                WHERE
                    p.id NOT IN (SELECT hp.publication_id FROM hidden_publications hp WHERE hp.hider_username = $1)
                    AND p.deleted_at IS NULL
                    AND COALESCE(p.is_paused, FALSE) = FALSE
                    -- NUEVO (UX + seguridad de negocio): Si la publicación NO es repetible y el usuario ya la completó/pagó,
                    -- entonces NO debe aparecer como "disponible" para ese usuario.
                    AND NOT (
                        (
                            COALESCE(p.allow_repeat_participation, FALSE) = FALSE
                            AND EXISTS (
                                SELECT 1
                                FROM publication_acceptances pa_done
                                WHERE pa_done.publication_id = p.id
                                  AND pa_done.acceptor_username = $1
                                  AND pa_done.status = 'confirmed_paid'
                            )
                        )
                        OR
                        (
                            COALESCE(p.allow_repeat_participation, FALSE) = TRUE
                            AND p.max_repeat_per_user IS NOT NULL
                            AND (
                                SELECT COUNT(*)
                                FROM publication_acceptances pa_done
                                WHERE pa_done.publication_id = p.id
                                  AND pa_done.acceptor_username = $1
                                  AND pa_done.status = 'confirmed_paid'
                            ) >= p.max_repeat_per_user
                        )
                    )
                    -- NUEVO (Hard Reject): Si el usuario fue rechazado alguna vez en esta publicación, ocultarla del feed.
                    AND NOT EXISTS (
                        SELECT 1
                        FROM publication_acceptances pa_rej
                        WHERE pa_rej.publication_id = p.id
                          AND pa_rej.acceptor_username = $1
                          AND pa_rej.status = 'rejected'
                    )
                    AND (
            -- Caso 1: Publicaciones normales que están activas o en las que el usuario participa
            -- NUEVO: Si target_username está definido, solo ese usuario puede verla
            (
                p.is_quick_sale = false 
                AND (p.target_username IS NULL OR p.target_username = $1)
                AND (
                    (p.available_slots > 0 AND (p.expires_at IS NULL OR p.expires_at > NOW()))
                    OR 
                    (u.username = $1 AND EXISTS (SELECT 1 FROM publication_acceptances pa WHERE pa.publication_id = p.id AND pa.status != 'confirmed_paid'))
                    OR 
                    (p.id IN (SELECT pa.publication_id FROM publication_acceptances pa WHERE pa.acceptor_username = $1 AND pa.status != 'confirmed_paid'))
                )
            )
            OR
            -- Caso 2: Ventas Rápidas que están activas Y son para el usuario o del usuario
            (
                p.is_quick_sale = true 
                AND (p.target_username = $1 OR u.username = $1)
                AND p.available_slots > 0 
                AND p.expires_at IS NOT NULL AND p.expires_at > NOW()
            )
        )
            ${searchCondition}
                ORDER BY
                    p.created_at DESC
            `;

            try {
                const result = await pool.query(sql, queryParams);
                const publications = result.rows.map(p => ({
                    ...p,
                    participants: p.participants || [],
                }));
                res.status(200).json(publications);
            } catch (error) {
                console.error("Error al obtener las publicaciones activas:", error);
                return res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // NUEVO: Endpoint para crear una Venta Rápida
        app.post('/api/quick-sale', requireAcceptedLegalByUsernameField(['authorUsername']), async (req, res) => {
            let { title, amount, authorUsername, targetUsername } = req.body;

            const client = await pool.connect();
            try {
                // 0. VERIFICAR PERMISO GLOBAL
                const settingsResult = await client.query("SELECT setting_value FROM app_settings WHERE setting_key = 'allow_quick_sale_publications'");
                const allowQuickSale = settingsResult.rows.length > 0 && settingsResult.rows[0].setting_value === 'true';

                if (!allowQuickSale) {
                    return res.status(403).json({ message: "La creación de Ventas Rápidas está desactivada temporalmente." });
                }

                // 1. Validaciones de entrada básicas
                if (!amount || !authorUsername) {
                    return res.status(400).json({ message: "Faltan datos requeridos: el monto y el autor son obligatorios." });
                }

                // Si el título viene vacío, se le asigna un valor por defecto.
                if (!title || title.trim() === '') {
                    title = 'Venta Rápida';
                }

                const cost = parseFloat(String(amount).replace(',', '.'));
                if (isNaN(cost) || cost <= 0) {
                    return res.status(400).json({ message: "El monto debe ser un número positivo." });
                }

                // Sanitización simple del título para prevenir XSS básico.
                const sanitizedTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");

                // const client = await pool.connect(); // ELIMINADO
                // try { // ELIMINADO
                await client.query('BEGIN');

                // 2. Verificar que el autor existe y obtener su ID
                const authorResult = await client.query('SELECT id FROM users WHERE username = $1', [authorUsername]);
                if (authorResult.rowCount === 0) {
                    throw { status: 404, message: 'El usuario autor no existe.' };
                }
                const authorId = authorResult.rows[0].id;

                // 3. (OPCIONAL) Verificar que el comprador objetivo existe, si se especificó
                if (targetUsername && targetUsername.trim() !== '') {
                    if (targetUsername === authorUsername) {
                        throw { status: 400, message: 'No puedes crearte una venta rápida a ti mismo.' };
                    }
                    const targetUserResult = await client.query('SELECT id FROM users WHERE username = $1', [targetUsername]);
                    if (targetUserResult.rowCount === 0) {
                        throw { status: 404, message: 'El usuario comprador especificado no existe.' };
                    }
                }

                // 4. Crear la publicación de Venta Rápida
                const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos desde ahora

                const insertQuery = `
            INSERT INTO publications 
            (author_id, title, description, blue_cost, status, is_sell_post, is_quick_sale, target_username, expires_at, category) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
            RETURNING id;
        `;
                const values = [
                    authorId,
                    sanitizedTitle,
                    'Venta Rápida', // Descripción genérica
                    cost,
                    'open',       // Estado inicial
                    true,         // Es un post de venta
                    true,         // Es una Venta Rápida
                    targetUsername && targetUsername.trim() !== '' ? targetUsername.trim() : null,
                    expiresAt,
                    'sell'        // Categoría
                ];

                const publicationResult = await client.query(insertQuery, values);
                const newPublicationId = publicationResult.rows[0].id;

                await logAuditEvent(client, req, {
                    eventType: 'quick_sale.created',
                    actorUsername: authorUsername,
                    targetUsername: targetUsername && targetUsername.trim() !== '' ? targetUsername.trim() : null,
                    publicationId: newPublicationId,
                    category: 'quick_sale',
                    metadata: {
                        amount: cost,
                        expires_at: expiresAt.toISOString()
                    }
                });

                await client.query('COMMIT');

                // 5. Devolver el ID de la nueva publicación para generar el QR
                res.status(201).json({
                    message: 'Venta Rápida creada con éxito.',
                    publicationId: newPublicationId
                });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error al crear la Venta Rápida:', error);
                res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
            } finally {
                client.release();
            }
        });

        // NUEVO: Endpoint para PAGAR una Venta Rápida
        app.post('/api/quick-sale/:id/pay', requireAcceptedLegalByUsernameField(['buyerUsername']), async (req, res) => {
            const { id } = req.params;
            const { buyerUsername } = req.body;

            if (!buyerUsername) {
                return res.status(400).json({ message: "Se requiere el nombre de usuario del comprador." });
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. Obtener los datos de la publicación y bloquear la fila
                const pubResult = await client.query(
                    `SELECT p.*, u.username as author_username 
             FROM publications p
             JOIN users u ON p.author_id = u.id
             WHERE p.id = $1 FOR UPDATE`,
                    [id]
                );

                if (pubResult.rowCount === 0) {
                    throw { status: 404, message: "Venta Rápida no encontrada." };
                }
                const publication = pubResult.rows[0];

                // Verificar si el comprador es menor sin tutor
                const buyerResult = await client.query(
                    `SELECT id, is_minor, tutor_user_id, account_status FROM users WHERE username = $1`,
                    [buyerUsername]
                );

                if (buyerResult.rowCount === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ message: "Usuario comprador no encontrado." });
                }

                const buyer = buyerResult.rows[0];

                // Verificar si es menor sin tutor (las ventas rápidas generan deuda RED)
                if (buyer.is_minor && (!buyer.tutor_user_id || buyer.account_status === 'pending_tutor')) {
                    await client.query('ROLLBACK');
                    return res.status(403).json({
                        message: "Por ser menor de edad, necesitas la autorización de un tutor para realizar pagos que generen deuda RED. Por favor, agrega un tutor a tu cuenta primero.",
                        requires_tutor: true,
                        is_minor: true
                    });
                }

                // --- INICIO DE LAS VALIDACIONES DE PAGO CRÍTICAS ---

                // a. ¿Es realmente una Venta Rápida?
                if (!publication.is_quick_sale) {
                    throw { status: 400, message: "Esta acción solo es válida para Ventas Rápidas." };
                }

                // b. ¿Ya ha sido pagada o está cerrada?
                if (publication.status !== 'open') {
                    throw { status: 400, message: "Esta venta ya no está disponible para pago." };
                }

                // c. ¿Ha expirado?
                const hasExpired = publication.expires_at && new Date(publication.expires_at) < new Date();
                if (hasExpired) {
                    throw { status: 400, message: "Esta Venta Rápida ha expirado." };
                }

                // d. ¿El comprador es el vendedor?
                if (publication.author_username === buyerUsername) {
                    throw { status: 400, message: "No puedes comprar tu propia venta." };
                }

                // e. Si es una venta dirigida, ¿es el comprador correcto?
                if (publication.target_username && publication.target_username !== buyerUsername) {
                    throw { status: 403, message: "No tienes permiso para comprar esta venta." };
                }

                // --- FIN DE VALIDACIONES ---

                // 2. Obtener configuración del sistema (pre-lanzamiento, comisiones, etc.)
                const settingsResult = await client.query(`
            SELECT setting_key, setting_value 
            FROM app_settings 
            WHERE setting_key IN ('pre_launch_mode_enabled', 'debt_cycle_days', 'debt_cycle_hours', 'debt_cycle_minutes', 'blue_escrow_days', 'blue_escrow_hours', 'blue_escrow_minutes', 'platform_commission_percentage')
        `);
                const settings = {};
                settingsResult.rows.forEach(row => {
                    settings[row.setting_key] = row.setting_value;
                });
                const preLaunchMode = settings.pre_launch_mode_enabled === 'true';

                // 3. Procesar el pago usando la misma lógica que las otras publicaciones (cumple reglas económicas)
                // Esto crea tokens RED/BLUE según las reglas, no transfiere tokens existentes
                const cost = parseFloat(publication.blue_cost);
                const sellerUsername = publication.author_username;

                // Crear un objeto acceptance similar al que usa processDirectPaymentCompletion
                const acceptance = {
                    blue_cost: cost,
                    title: publication.title,
                    author_username: sellerUsername,
                    acceptance_id: null, // No hay acceptance para venta rápida
                    category: 'sell',
                    completerUsername: buyerUsername
                };

                // Procesar el pago según las reglas económicas
                const result = await processDirectPaymentCompletion(client, acceptance, id, preLaunchMode, settings);

                // 4. Actualizar el estado de la publicación a 'completed'
                await client.query(`UPDATE publications SET status = 'completed', available_slots = 0 WHERE id = $1`, [id]);

                // 5. Crear notificación para el vendedor
                const notificationMessage = `¡Venta Rápida completada! ${buyerUsername} ha pagado por tu publicación: "${publication.title}".`;
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [sellerUsername, notificationMessage]);

                await logAuditEvent(client, req, {
                    eventType: 'quick_sale.paid',
                    actorUsername: buyerUsername,
                    targetUsername: sellerUsername,
                    publicationId: parseInt(id, 10),
                    category: 'quick_sale',
                    metadata: {
                        amount: cost,
                        publication_title: publication.title
                    }
                });

                await client.query('COMMIT');

                res.status(200).json({ message: result.message || "Pago realizado con éxito." });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`Error al procesar el pago de la Venta Rápida ${id}:`, error);
                res.status(error.status || 500).json({ message: error.message || "Error crítico en la transacción." });
            } finally {
                client.release();
            }
        });

        // Ruta para Aceptar una publicación
        app.post('/publications/:id/accept', requireAcceptedLegalByUsernameField(['acceptorUsername']), async (req, res) => {
            const { id } = req.params;
            const { acceptorUsername } = req.body;

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Verificar si el aceptante es menor sin tutor (solo para publicaciones que generan deuda)
                const acceptorResult = await client.query(
                    `SELECT id, is_minor, tutor_user_id, account_status FROM users WHERE username = $1`,
                    [acceptorUsername]
                );

                if (acceptorResult.rowCount === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ message: "Usuario no encontrado." });
                }

                const acceptor = acceptorResult.rows[0];

                // Verificar publicación para determinar si genera deuda
                const pubResult = await client.query(
                    `SELECT p.*, u.username as author_username
                     FROM publications p
                     JOIN users u ON p.author_id = u.id
                     WHERE p.id = $1 AND p.deleted_at IS NULL
                     FOR UPDATE`,
                    [id]
                );
                const pub = pubResult.rows[0];

                if (!pub) {
                    throw { status: 404, message: "La publicación ya no existe." };
                }
                if (pub.author_username === acceptorUsername) {
                    throw { status: 400, message: "No puedes aceptar tu propia publicación." };
                }
                if (pub.available_slots <= 0) {
                    throw { status: 400, message: "Lo sentimos, ya no quedan cupos disponibles." };
                }
                if (pub.is_paused) {
                    throw { status: 400, message: "Esta publicación está pausada y no acepta nuevas solicitudes." };
                }

                // Prevenir que un tutor acepte tareas (solicitudes) de su menor representado.
                // Razón: En solicitudes, la deuda RED del menor va al tutor. Si el tutor también
                // es el trabajador, sería simultáneamente deudor y acreedor, lo cual no está permitido.
                if (pub.category === 'request') {
                    const authorResult = await client.query(
                        `SELECT id, is_minor, tutor_user_id FROM users WHERE id = $1`,
                        [pub.author_id]
                    );
                    const author = authorResult.rows[0];
                    if (author && author.is_minor && author.tutor_user_id === acceptor.id) {
                        throw {
                            status: 403,
                            message: "No puedes aceptar tareas publicadas por tu menor representado. La deuda de esta tarea sería tuya, y al mismo tiempo recibirías el pago. Esto no está permitido."
                        };
                    }
                }

                // --- NUEVO: Política profesional anti-repetición + Hard Reject (regla de negocio en backend) ---
                // Cargamos TODAS las participaciones históricas del usuario en esta publicación.
                const prev = await client.query(
                    `SELECT status FROM publication_acceptances WHERE publication_id = $1 AND acceptor_username = $2`,
                    [id, acceptorUsername]
                );

                if (prev.rows.length > 0) {
                    const statuses = prev.rows.map(r => r.status);
                    const confirmedPaidCount = statuses.filter(s => s === 'confirmed_paid').length;

                    // Hard Reject: si fue rechazado alguna vez, no puede volver a intentar nunca más.
                    if (statuses.includes('rejected')) {
                        throw { status: 403, message: "Tu solicitud para esta tarea fue rechazada anteriormente. No puedes volver a postularte." };
                    }

                    // Bloqueo de concurrencia: no permitir una segunda solicitud si ya hay una activa.
                    // Nota: 'completed' aquí significa "culminada esperando confirmación/pago", sigue siendo activa.
                    const activeStatuses = ['pending_approval', 'approved', 'completed'];
                    if (statuses.some(s => activeStatuses.includes(s))) {
                        throw { status: 409, message: "Ya tienes una solicitud activa para esta tarea. Complétala antes de iniciar otra." };
                    }

                    const allowRepeat = !!pub.allow_repeat_participation;
                    const maxRepeat = Number(pub.max_repeat_per_user);
                    const repeatCooldown = Number(pub.repeat_cooldown_hours);
                    if (!allowRepeat && confirmedPaidCount >= 1) {
                        throw { status: 409, message: "Ya completaste esta tarea y no se permite repetirla." };
                    }
                    if (allowRepeat && Number.isFinite(maxRepeat) && maxRepeat >= 2 && confirmedPaidCount >= maxRepeat) {
                        throw { status: 409, message: `Ya alcanzaste el máximo de ${maxRepeat} repeticiones permitidas para esta tarea.` };
                    }
                    if (allowRepeat && Number.isFinite(repeatCooldown) && repeatCooldown > 0 && confirmedPaidCount >= 1) {
                        const lastCompletion = await client.query(
                            `SELECT created_at
                             FROM publication_acceptances
                             WHERE publication_id = $1
                               AND acceptor_username = $2
                               AND status = 'confirmed_paid'
                             ORDER BY created_at DESC
                             LIMIT 1`,
                            [id, acceptorUsername]
                        );
                        if (lastCompletion.rowCount > 0) {
                            const lastAt = new Date(lastCompletion.rows[0].created_at);
                            const cooldownMs = repeatCooldown * 60 * 60 * 1000;
                            const elapsedMs = Date.now() - lastAt.getTime();
                            if (elapsedMs < cooldownMs) {
                                const remainingMinutes = Math.ceil((cooldownMs - elapsedMs) / (60 * 1000));
                                if (remainingMinutes >= 60) {
                                    const remainingHours = Math.ceil(remainingMinutes / 60);
                                    throw { status: 409, message: `Debes esperar ${remainingHours} hora${remainingHours === 1 ? '' : 's'} para volver a realizar esta tarea.` };
                                }
                                throw { status: 409, message: `Debes esperar ${remainingMinutes} minuto${remainingMinutes === 1 ? '' : 's'} para volver a realizar esta tarea.` };
                            }
                        }
                    }
                }

                // Si es una publicación de tipo 'sell' o 'donation', el aceptante pagará (genera deuda)
                // Si es 'request', el autor pagará (no genera deuda para el aceptante)
                if ((pub.category === 'sell' || pub.category === 'donation') && acceptor.is_minor && (!acceptor.tutor_user_id || acceptor.account_status === 'pending_tutor')) {
                    await client.query('ROLLBACK');
                    return res.status(403).json({
                        message: "Por ser menor de edad, necesitas la autorización de un tutor para aceptar publicaciones que generen deuda RED. Por favor, agrega un tutor a tu cuenta primero.",
                        requires_tutor: true,
                        is_minor: true
                    });
                }

                // Descontar cupo SOLO después de pasar validaciones de repetición/concurrencia
                await client.query(`UPDATE publications SET available_slots = available_slots - 1 WHERE id = $1`, [id]);

                // --- LÓGICA DE AUTO-APROBACIÓN ---
                if (pub.auto_approve) {
                    // Si la auto-aprobación está activa, se aprueba directamente.
                    await client.query(`INSERT INTO publication_acceptances (publication_id, acceptor_username, status) VALUES ($1, $2, 'approved')`, [id, acceptorUsername]);
                    const message = `¡Has sido aprobado automáticamente para la tarea "${pub.title}"!`;
                    await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [acceptorUsername, message]);

                    await logAuditEvent(client, req, {
                        eventType: 'publication.accepted',
                        actorUsername: acceptorUsername,
                        publicationId: parseInt(id, 10),
                        category: pub.category,
                        metadata: {
                            initial_status: 'approved',
                            auto_approve: true,
                            allow_repeat_participation: !!pub.allow_repeat_participation
                        }
                    });

                    await client.query('COMMIT');
                    res.status(200).json({ message: "¡Aceptaste y fuiste aprobado automáticamente!" });
                } else {
                    // Comportamiento normal: pendiente de aprobación
                    await client.query(`INSERT INTO publication_acceptances (publication_id, acceptor_username, status) VALUES ($1, $2, 'pending_approval')`, [id, acceptorUsername]);
                    const message = `El usuario ${acceptorUsername} quiere realizar la tarea "${pub.title}".`;
                    await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [pub.author_username, message]);

                    await logAuditEvent(client, req, {
                        eventType: 'publication.accepted',
                        actorUsername: acceptorUsername,
                        publicationId: parseInt(id, 10),
                        category: pub.category,
                        metadata: {
                            initial_status: 'pending_approval',
                            auto_approve: false,
                            allow_repeat_participation: !!pub.allow_repeat_participation
                        }
                    });

                    await client.query('COMMIT');
                    res.status(200).json({ message: "Solicitud enviada. Esperando aprobación." });
                }

            } catch (error) {
                await client.query('ROLLBACK');
                if (error.constraint === 'one_active_acceptance_per_user_per_pub_idx') {
                    return res.status(409).json({ message: "Ya has enviado una solicitud para esta tarea." });
                }
                console.error("Error al aceptar publicación:", error);
                res.status(error.status || 500).json({ message: error.message || "Error interno." });
            } finally {
                client.release();
            }
        });

        // Ruta para Descartar a un usuario
        app.post('/publications/:id/discard', verifyAdminToken, requireAcceptedLegalByUsernameField(['discarderUsername']), async (req, res) => {
            const { id } = req.params;
            const { discarderUsername, userToDiscard } = req.body;

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const pubResult = await client.query(
                    `SELECT p.*, u.username as author_username
                     FROM publications p
                     JOIN users u ON p.author_id = u.id
                     WHERE p.id = $1 AND u.username = $2 AND p.deleted_at IS NULL
                     FOR UPDATE`,
                    [id, discarderUsername]
                );
                const pub = pubResult.rows[0];
                if (!pub) {
                    throw { status: 403, message: "No tienes permiso para gestionar esta tarea." };
                }

                // ✅ Enfoque profesional: NO borramos el historial.
                // En su lugar marcamos la solicitud como 'rejected' (Hard Reject).
                const updateResult = await client.query(
                    `UPDATE publication_acceptances
                     SET status = 'rejected'
                     WHERE publication_id = $1
                       AND acceptor_username = $2
                       AND status = 'pending_approval'
                     RETURNING *`,
                    [id, userToDiscard]
                );

                if (updateResult.rowCount === 0) {
                    throw { status: 404, message: "No se encontró una solicitud pendiente para este usuario." };
                }

                // Devolver el cupo (la solicitud ya no ocupa un slot)
                await client.query(`UPDATE publications SET available_slots = available_slots + 1 WHERE id = $1`, [id]);

                const message = `Tu solicitud para la tarea "${pub.title}" fue rechazada.`;
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [userToDiscard, message]);

                await logAuditEvent(client, req, {
                    eventType: 'publication.rejected',
                    actorUsername: discarderUsername,
                    targetUsername: userToDiscard,
                    publicationId: parseInt(id, 10),
                    category: pub.category,
                    metadata: {
                        from_status: 'pending_approval',
                        to_status: 'rejected'
                    }
                });

                await client.query('COMMIT');
                res.status(200).json({ message: `Has rechazado la solicitud de ${userToDiscard}.` });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error al descartar solicitud:", error);
                res.status(error.status || 500).json({ message: error.message || "Error interno." });
            } finally {
                client.release();
            }
        });

        // Ruta para Aprobar a un usuario
        app.post('/publications/:id/approve', verifyAdminToken, requireAcceptedLegalByUsernameField(['approverUsername']), async (req, res) => {
            const { id } = req.params;
            const { approverUsername, userToApprove } = req.body;

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const pubResult = await client.query(
                    `SELECT p.*, u.username as author_username
                     FROM publications p
                     JOIN users u ON p.author_id = u.id
                     WHERE p.id = $1 AND u.username = $2 AND p.deleted_at IS NULL`,
                    [id, approverUsername]
                );
                const pub = pubResult.rows[0];
                if (!pub) throw { status: 403, message: "No tienes permiso para aprobar solicitudes." };

                const updateResult = await client.query(
                    `UPDATE publication_acceptances SET status = 'approved' WHERE publication_id = $1 AND acceptor_username = $2 AND status = 'pending_approval' RETURNING *`,
                    [id, userToApprove]
                );

                if (updateResult.rowCount === 0) {
                    throw { status: 404, message: "No se encontró una solicitud pendiente válida para este usuario." };
                }

                const message = `¡Has sido aprobado para la tarea "${pub.title}"!`;
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [userToApprove, message]);

                await logAuditEvent(client, req, {
                    eventType: 'publication.approved',
                    actorUsername: approverUsername,
                    targetUsername: userToApprove,
                    publicationId: parseInt(id, 10),
                    category: pub.category,
                    metadata: {
                        from_status: 'pending_approval',
                        to_status: 'approved'
                    }
                });

                await client.query('COMMIT');
                res.status(200).json({ message: `Has aprobado a ${userToApprove}.` });
            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error al aprobar:", error);
                res.status(error.status || 500).json({ message: error.message || "Error interno." });
            } finally {
                client.release();
            }
        });

        // Ruta para Marcar como Culminada
        app.post('/publications/:id/complete', requireAcceptedLegalByUsernameField(['completerUsername']), async (req, res) => {
            const pubId = req.params.id;
            const { completerUsername, formResponses } = req.body;

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. OBTENER CONFIGURACIONES DE LA PLATAFORMA (incluyendo comisiones)
                const settingsResult = await client.query(`
                    SELECT setting_key, setting_value 
                    FROM app_settings 
                    WHERE setting_key IN ('pre_launch_mode_enabled', 'debt_cycle_days', 'debt_cycle_hours', 'debt_cycle_minutes', 'blue_escrow_days', 'blue_escrow_hours', 'blue_escrow_minutes', 'platform_commission_percentage')
                `);
                const settings = settingsResult.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
                const preLaunchMode = settings.pre_launch_mode_enabled === 'true';

                // 2. FETCH ACCEPTANCE DATA
                const acceptanceResult = await client.query(
                    `SELECT p.blue_cost, p.is_sell_post, p.title, p.category, p.form_fields,
                            u.username as author_username,
                            pa.id as acceptance_id,
                            pa.form_responses_submitted_at
                     FROM publications p
                     JOIN users u ON p.author_id = u.id
                     JOIN publication_acceptances pa ON p.id = pa.publication_id
                     WHERE p.id = $1 AND pa.acceptor_username = $2 AND pa.status = 'approved'
                     FOR UPDATE`,
                    [pubId, completerUsername]
                );

                const acceptance = acceptanceResult.rows[0];
                if (!acceptance) {
                    throw { status: 404, message: "No se encontró una tarea o compra aprobada para procesar." };
                }

                // Guardar respuestas del formulario si se proporcionan y la publicación tiene form_fields
                const shouldSaveResponses = !!formResponses
                    && acceptance.form_fields
                    && typeof formResponses === 'object'
                    && Object.keys(formResponses).length > 0;

                if (shouldSaveResponses) {
                    const updateResponsesResult = await client.query(
                        `UPDATE publication_acceptances
                         SET form_responses = $1,
                             form_responses_submitted_at = COALESCE(form_responses_submitted_at, NOW())
                         WHERE id = $2
                         RETURNING form_responses_submitted_at`,
                        [formResponses, acceptance.acceptance_id]
                    );

                    if (!acceptance.form_responses_submitted_at) {
                        await logAuditEvent(client, req, {
                            eventType: 'publication.form_responses_submitted',
                            actorUsername: completerUsername,
                            targetUsername: acceptance.author_username,
                            publicationId: parseInt(pubId, 10),
                            category: acceptance.category,
                            metadata: {
                                acceptance_id: acceptance.acceptance_id,
                                submitted_at: updateResponsesResult.rows[0]?.form_responses_submitted_at
                            }
                        });
                    }
                }

                // Añadir completerUsername al objeto acceptance para pasarlo a los helpers
                acceptance.completerUsername = completerUsername;

                let result;
                switch (acceptance.category) {
                    case 'sell':
                    case 'donation':
                        result = await processDirectPaymentCompletion(client, acceptance, pubId, preLaunchMode, settings);
                        break;
                    case 'request':
                        result = await processRequestCompletion(client, acceptance);
                        break;
                    default:
                        throw { status: 400, message: "Categoría de publicación no válida." };
                }

                await logAuditEvent(client, req, {
                    eventType: 'publication.completed',
                    actorUsername: completerUsername,
                    publicationId: parseInt(pubId, 10),
                    category: acceptance.category,
                    metadata: {
                        acceptance_id: acceptance.acceptance_id
                    }
                });

                await client.query('COMMIT');
                res.status(200).json({ message: result.message });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error al completar tarea/venta:", error);
                res.status(error.status || 500).json({ message: error.message || "Error interno." });
            } finally {
                client.release();
            }
        });

        // Ruta para Confirmar y Pagar (REFACTORIZADA PARA MÁXIMA SEGURIDAD)
        app.post('/publications/:id/confirm-payment', verifyAdminToken, requireAcceptedLegalByUsernameField(['confirmerUsername']), async (req, res) => {
            const pubId = req.params.id;
            const { confirmerUsername, workerUsername } = req.body;

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. OBTENER DATOS Y VERIFICAR PERMISOS
                // Se obtiene la publicación y se asegura que el `confirmerUsername` es el autor.
                const acceptanceResult = await client.query(
                    `SELECT p.blue_cost, p.title, p.category, p.is_booster_task,
                    u.id as author_id,
                    u.username as author_username,
                    w.id as worker_id,
                    pa.id as acceptance_id,
                    pa.acceptor_username
                     FROM publications p
                     JOIN users u ON p.author_id = u.id
                     JOIN publication_acceptances pa ON p.id = pa.publication_id
                     JOIN users w ON pa.acceptor_username = w.username
             WHERE p.id = $1 AND pa.acceptor_username = $2 AND pa.status = 'completed'
             FOR UPDATE`, // FOR UPDATE bloquea la fila para evitar concurrencia
                    [pubId, workerUsername]
                );

                const acceptance = acceptanceResult.rows[0];
                if (!acceptance) {
                    throw { status: 404, message: "No se encontró una tarea completada válida para este trabajador." };
                }

                // 2. Fallar rápido si el usuario no es el autor.
                if (acceptance.author_username !== confirmerUsername) {
                    throw { status: 403, message: "No tienes permiso para confirmar el pago de esta tarea." };
                }

                // 2.1 Seguridad: no confiar en el username enviado por cliente.
                // Usamos el acceptor_username real de la DB como "worker".
                if (workerUsername && acceptance.acceptor_username !== workerUsername) {
                    await logAuditEvent(client, req, {
                        eventType: 'publication.confirm_payment.mismatch',
                        actorUsername: confirmerUsername,
                        targetUsername: workerUsername,
                        publicationId: parseInt(pubId, 10),
                        category: 'request',
                        metadata: {
                            acceptance_id: acceptance.acceptance_id,
                            db_acceptor: acceptance.acceptor_username
                        }
                    });
                    throw { status: 400, message: "El trabajador indicado no coincide con el registrado en la solicitud." };
                }

                // VALIDACIÓN: Esta ruta es solo para 'requests'
                if (acceptance.category !== 'request') {
                    throw { status: 400, message: "Esta acción solo es válida para publicaciones de tipo 'solicitud'." };
                }

                // 3. OBTENER CONFIGURACIONES DE LA PLATAFORMA
                const settingsResult = await client.query(`
            SELECT setting_key, setting_value FROM app_settings 
            WHERE setting_key IN ('pre_launch_mode_enabled', 'debt_cycle_days', 'debt_cycle_hours', 'debt_cycle_minutes', 'blue_escrow_days', 'blue_escrow_hours', 'blue_escrow_minutes', 'platform_commission_percentage')
        `);
                const settings = settingsResult.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
                const preLaunchMode = settings.pre_launch_mode_enabled === 'true';

                // 4. PROCESAR EL PAGO
                acceptance.workerUsername = acceptance.acceptor_username; // Usar el valor de DB (no el del cliente)
                acceptance.workerId = acceptance.worker_id;
                const result = await processRequestPayment(client, acceptance, pubId, preLaunchMode, settings);

                // 5. ACTUALIZAR ESTADO FINAL
                await client.query(`UPDATE publication_acceptances SET status = 'confirmed_paid' WHERE id = $1`, [acceptance.acceptance_id]);

                await logAuditEvent(client, req, {
                    eventType: 'publication.confirmed_paid',
                    actorUsername: confirmerUsername,
                    targetUsername: workerUsername,
                    publicationId: parseInt(pubId, 10),
                    category: 'request',
                    metadata: {
                        acceptance_id: acceptance.acceptance_id,
                        blue_cost: acceptance.blue_cost,
                        is_booster_task: !!acceptance.is_booster_task
                    }
                });

                await client.query('COMMIT');
                res.status(200).json({ message: result.message });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error en confirm-payment:", error);
                res.status(error.status || 500).json({ message: error.message || "Error crítico en la transacción." });
            } finally {
                if (client) client.release();
            }
        });

        // Ruta para obtener las notificaciones de un usuario
        app.get('/notifications/:username', async (req, res) => {
            const { username } = req.params;
            const sql = `SELECT * FROM notifications WHERE recipient_username = $1 AND is_read = FALSE ORDER BY created_at DESC`;
            try {
                const result = await pool.query(sql, [username]);
                res.status(200).json(result.rows);
            } catch (error) {
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // --- ENDPOINT PROFESIONAL: Notificaciones del usuario autenticado ---
        app.get('/api/me/notifications', verifyUserToken, async (req, res) => {
            const username = req.user?.username;
            if (!username) {
                return res.status(401).json({ message: "No autenticado." });
            }
            const sql = `SELECT * FROM notifications WHERE recipient_username = $1 AND is_read = FALSE ORDER BY created_at DESC`;
            try {
                const result = await pool.query(sql, [username]);
                res.status(200).json(result.rows);
            } catch (error) {
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // Ruta para marcar notificaciones como leídas
        app.post('/notifications/mark-read', async (req, res) => {
            const { username } = req.body;
            const sql = `UPDATE notifications SET is_read = TRUE WHERE recipient_username = $1 AND is_read = FALSE`;
            try {
                const result = await pool.query(sql, [username]);
                res.status(200).json({ success: true, count: result.rowCount });
            } catch (error) {
                res.status(500).json({ message: "Error al marcar notificaciones como leídas." });
            }
        });

        // --- ENDPOINT PROFESIONAL: marcar notificaciones como leídas (usuario autenticado) ---
        app.post('/api/me/notifications/mark-read', verifyUserToken, async (req, res) => {
            const username = req.user?.username;
            if (!username) {
                return res.status(401).json({ message: "No autenticado." });
            }
            const sql = `UPDATE notifications SET is_read = TRUE WHERE recipient_username = $1 AND is_read = FALSE`;
            try {
                const result = await pool.query(sql, [username]);
                res.status(200).json({ success: true, count: result.rowCount });
            } catch (error) {
                res.status(500).json({ message: "Error al marcar notificaciones como leídas." });
            }
        });

        // Ruta para descartar una notificación INDIVIDUAL
        app.post('/notifications/:id/dismiss', async (req, res) => {
            const { id } = req.params;
            const { username } = req.body;

            if (!username) {
                return res.status(400).json({ message: "Se requiere nombre de usuario." });
            }

            try {
                const sql = `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND recipient_username = $2 AND is_read = FALSE RETURNING id`;
                const result = await pool.query(sql, [id, username]);

                if (result.rowCount > 0) {
                    res.status(200).json({ message: "Notificación descartada." });
                } else {
                    res.status(200).json({ message: "La notificación no necesitaba ser descartada." });
                }
            } catch (error) {
                console.error('Error al descartar notificación:', error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // --- ENDPOINT PROFESIONAL: descartar notificación individual (usuario autenticado) ---
        app.post('/api/me/notifications/:id/dismiss', verifyUserToken, async (req, res) => {
            const { id } = req.params;
            const username = req.user?.username;
            if (!username) {
                return res.status(401).json({ message: "No autenticado." });
            }
            try {
                const sql = `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND recipient_username = $2 AND is_read = FALSE RETURNING id`;
                const result = await pool.query(sql, [id, username]);
                if (result.rowCount > 0) {
                    res.status(200).json({ message: "Notificación descartada." });
                } else {
                    res.status(200).json({ message: "La notificación no necesitaba ser descartada." });
                }
            } catch (error) {
                console.error('Error al descartar notificación (me):', error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });

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
        app.get('/users/:username/history', async (req, res) => {
            const { username } = req.params;
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

        // Ruta: Obtener las transacciones de un usuario
        app.get('/users/:username/transactions', async (req, res) => {
            const { username } = req.params;
            const sql = `
                SELECT t.*, u.username 
                FROM transactions t 
                JOIN users u ON t.user_id = u.id 
                WHERE u.username = $1 
                ORDER BY t.created_at DESC
            `;
            try {
                const result = await pool.query(sql, [username]);
                res.status(200).json(result.rows);
            } catch (err) {
                console.error("Error al obtener las transacciones:", err.message);
                return res.status(500).json({ message: "Error interno del servidor." });
            }
        });

        // RUTA: Obtener los saldos de un usuario
        app.get('/users/:username/balance', async (req, res) => {
            const { username } = req.params;

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
                    `SELECT username, liquid_blue_balance, escrow_blue_balance, red_balance
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

                const [debtResult, escrowResult, penalizedDebtResult] = await Promise.all([
                    client.query(debtSql, [username]),
                    client.query(escrowSql, [username]),
                    client.query(penalizedDebtSql, [username])
                ]);

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
                console.error("Error al obtener balance y deuda (me):", err);
                return res.status(500).json({ message: "Error interno del servidor." });
            } finally {
                client.release();
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

                const userSql = `SELECT username, average_rating, ratings_count FROM users WHERE username = $1`;
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

        app.post('/api/admin/login', loginLimiter, (req, res) => {
            const { password } = req.body;
            if (!password) {
                return res.status(400).json({ message: "Se requiere la contraseña." });
            }
            if (password === process.env.ADMIN_PASSWORD) {
                const accessToken = jwt.sign({ name: 'admin' }, process.env.ADMIN_SECRET_KEY, { expiresIn: '8h' });

                // SEGURIDAD: Enviar el token como una cookie HttpOnly
                res.cookie('admin_token', accessToken, {
                    httpOnly: true, // No accesible vía JavaScript del navegador (previene XSS robo de token)
                    secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
                    // Para frontend en Hostinger (dominio distinto al backend), necesitamos cookies cross-site:
                    // SameSite=None + Secure=true (estándar moderno).
                    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
                    maxAge: 8 * 60 * 60 * 1000 // 8 horas en milisegundos
                });

                res.json({ message: "Login exitoso" });
            } else {
                res.status(401).json({ message: "Contraseña incorrecta." });
            }
        });

        // NUEVO: Endpoint para Logout (Borrar cookie)
        app.post('/api/admin/logout', (req, res) => {
            res.clearCookie('admin_token');
            res.json({ message: "Logout exitoso" });
        });

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
                // Intentar obtener referral_reward_amount primero, luego referral_bonus_amount como fallback
                let result = await pool.query(`SELECT setting_key, setting_value FROM app_settings WHERE setting_key = 'referral_reward_amount'`);

                if (result.rows.length === 0) {
                    // Si no existe referral_reward_amount, intentar con referral_bonus_amount
                    result = await pool.query(`SELECT setting_key, setting_value FROM app_settings WHERE setting_key = 'referral_bonus_amount'`);
                }

                if (result.rows.length > 0) {
                    res.status(200).json({ referral_bonus_amount: result.rows[0].setting_value });
                } else {
                    res.status(404).json({ message: "Configuración de referidos no encontrada." });
                }
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
                // ------------------------------------------------------------
                // FINTECH GUARD (fail-closed):
                // Si se intenta desactivar pre-launch, validamos que el esquema
                // soporte el flujo normal (usa user_id en red_token_debts y blue_token_escrows).
                //
                // Motivo: evitar que un toggle de feature rompa pagos en producción
                // por deriva de esquema (schema drift). Este guard NO modifica datos.
                // ------------------------------------------------------------
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
                sql += ` GROUP BY u.id, u.username, u.liquid_blue_balance, u.escrow_blue_balance, u.red_balance, u.account_status, u.average_rating, u.ratings_count, u.created_at, u.referral_code ORDER BY u.created_at DESC`;

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
                // Evitar que el admin se modifique a sí mismo o a la plataforma
                const adminUser = await pool.query('SELECT username FROM users WHERE id = $1', [res.locals.admin.id]);
                const targetUser = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);

                if (!targetUser.rows.length) {
                    return res.status(404).json({ message: 'Usuario no encontrado.' });
                }

                const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';

                if (targetUser.rows[0].username === adminUser.rows[0].username) {
                    return res.status(403).json({ message: 'Un administrador no puede cambiar su propio estado.' });
                }

                if (targetUser.rows[0].username === platformUsername) {
                    return res.status(403).json({ message: 'No se puede cambiar el estado de la cuenta de la plataforma.' });
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

        app.get('/api/admin/dashboard-stats', verifyAdminToken, async (req, res) => {
            const client = await pool.connect();
            try {
                // EXCLUIR USUARIO DE PLATAFORMA Y FONDOS DE IMPULSORES
                const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';

                const [usersData, publicationsData, tokensData, platformWalletData, boosterFundsData] = await Promise.all([
                    client.query('SELECT COUNT(*) AS total_users FROM users WHERE username != $1', [platformUsername]),
                    client.query(`
                        SELECT COUNT(DISTINCT p.id) AS active_publications FROM publications p
                        LEFT JOIN publication_acceptances pa ON p.id = pa.publication_id
                        WHERE pa.status IS NULL OR pa.status != 'confirmed_paid'
                    `),
                    // SOLO tokens reales en circulación (excluyendo plataforma y fondos de impulsores)
                    client.query(`
                        SELECT 
                            SUM(CASE WHEN username != $1 THEN liquid_blue_balance + escrow_blue_balance ELSE 0 END) AS users_total_blue, 
                            SUM(red_balance) AS total_red 
                        FROM users
                    `, [platformUsername]),
                    client.query('SELECT total_blue_commission_balance FROM platform_wallet WHERE id = 1'),
                    // Fondos de impulsores (NO son tokens en circulación)
                    client.query('SELECT SUM(amount) AS total_booster_funds FROM booster_blue_ledger')
                ]);

                const usersTotalBlue = parseFloat(tokensData.rows[0].users_total_blue) || 0;
                const platformCommissionBalance = parseFloat(platformWalletData.rows[0]?.total_blue_commission_balance) || 0;
                const totalBoosterFunds = parseFloat(boosterFundsData.rows[0]?.total_booster_funds) || 0;

                // SOLO tokens reales en circulación (excluyendo fondos de impulsores)
                const totalBlueInSystem = usersTotalBlue + platformCommissionBalance;

                const stats = {
                    totalUsers: parseInt(usersData.rows[0].total_users, 10),
                    activePublications: parseInt(publicationsData.rows[0].active_publications, 10),
                    totalBlue: totalBlueInSystem, // SOLO tokens reales en circulación
                    totalRed: parseFloat(tokensData.rows[0].total_red) || 0,
                    platformCommissionBalance: platformCommissionBalance,
                    totalBoosterFunds: totalBoosterFunds // Información separada (NO son tokens en circulación)
                };

                res.status(200).json(stats);
            } catch (error) {
                console.error("Error al obtener estadísticas del dashboard:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            } finally {
                client.release();
            }
        });

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

        // --- ENDPOINTS PARA GESTIÓN SEGURA DE DATOS ---

        // Endpoint para obtener estadísticas detalladas de la base de datos
        app.get('/api/admin/database/stats', verifyAdminToken, async (req, res) => {
            const client = await pool.connect();
            try {
                const stats = await client.query(`
                    SELECT 
                        (SELECT COUNT(*) FROM users) as total_users,
                        (SELECT COUNT(*) FROM users WHERE username ILIKE '%test%' OR username ILIKE '%demo%') as test_users,
                        (SELECT COUNT(*) FROM users WHERE created_at < NOW() - INTERVAL '90 days' AND liquid_blue_balance = 100.0000 AND escrow_blue_balance = 0.0000 AND red_balance = 0.0000) as inactive_users,
                        (SELECT COUNT(*) FROM publications) as total_publications,
                        (SELECT COUNT(*) FROM publications WHERE created_at < NOW() - INTERVAL '180 days' AND status IN ('completed', 'confirmed_paid')) as old_publications,
                        (SELECT COUNT(*) FROM transactions) as total_transactions,
                        (SELECT COUNT(*) FROM notifications) as total_notifications,
                        (SELECT COUNT(*) FROM notifications WHERE created_at < NOW() - INTERVAL '30 days') as old_notifications,
                        (SELECT COUNT(*) FROM ratings) as total_ratings,
                        (SELECT COUNT(*) FROM red_token_debts WHERE is_settled = FALSE) as active_debts,
                        (SELECT COUNT(*) FROM blue_token_escrows WHERE is_released = FALSE) as active_escrows,
                        (SELECT pg_size_pretty(pg_database_size(current_database()))) as database_size
                `);

                res.json(stats.rows[0]);
            } catch (error) {
                console.error('Error fetching database stats:', error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            } finally {
                client.release();
            }
        });

        // Endpoint para crear backup de la base de datos
        app.post('/api/admin/database/backup', verifyAdminToken, async (req, res) => {
            try {
                const { createBackup } = require('./backup-database.js');
                const backupFile = await createBackup();

                // Obtener solo el nombre del archivo para no exponer rutas del sistema
                const backupFileName = require('path').basename(backupFile);

                res.json({
                    success: true,
                    message: 'Backup creado exitosamente',
                    filename: backupFileName
                });
            } catch (error) {
                console.error('Error creating backup:', error);
                res.status(500).json({ message: 'Error al crear el backup: ' + error.message });
            }
        });

        // Endpoint para limpiar datos de prueba
        app.post('/api/admin/database/cleanup-test-data', verifyAdminToken, async (req, res) => {
            const client = await pool.connect();
            try {
                console.log(`[ADMIN CLEANUP] Administrador inició limpieza de datos de prueba`);

                // Crear backup automático antes de la limpieza
                const { createBackup } = require('./backup-database.js');
                await createBackup();

                await client.query('BEGIN');

                // Eliminar usuarios de prueba
                const testUsersResult = await client.query(`
                    DELETE FROM users 
                    WHERE (username ILIKE '%test%' OR username ILIKE '%demo%' OR username ILIKE '%example%')
                    AND username NOT LIKE '%Plataforma%'
                    RETURNING username
                `);

                // Eliminar publicaciones de prueba
                const testPublicationsResult = await client.query(`
                    DELETE FROM publications 
                    WHERE title ILIKE '%test%' OR title ILIKE '%demo%' OR title ILIKE '%example%'
                    RETURNING id, title
                `);

                // Limpiar notificaciones antiguas (más de 30 días)
                const oldNotificationsResult = await client.query(`
                    DELETE FROM notifications 
                    WHERE created_at < NOW() - INTERVAL '30 days'
                    RETURNING id
                `);

                await client.query('COMMIT');

                console.log(`[ADMIN CLEANUP] Limpieza completada - Usuarios: ${testUsersResult.rowCount}, Publicaciones: ${testPublicationsResult.rowCount}, Notificaciones: ${oldNotificationsResult.rowCount}`);

                res.json({
                    success: true,
                    message: 'Limpieza de datos de prueba completada',
                    results: {
                        testUsersDeleted: testUsersResult.rowCount,
                        testPublicationsDeleted: testPublicationsResult.rowCount,
                        oldNotificationsDeleted: oldNotificationsResult.rowCount
                    }
                });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('[ADMIN CLEANUP] Error durante limpieza de datos de prueba:', error);
                res.status(500).json({ message: 'Error durante la limpieza: ' + error.message });
            } finally {
                client.release();
            }
        });

        // Endpoint para limpiar usuarios inactivos
        app.post('/api/admin/database/cleanup-inactive-users', verifyAdminToken, async (req, res) => {
            const { daysInactive = 90 } = req.body;
            const client = await pool.connect();

            try {
                console.log(`[ADMIN CLEANUP] Administrador inició limpieza de usuarios inactivos (${daysInactive} días)`);

                // Validación de seguridad
                if (daysInactive < 30) {
                    return res.status(400).json({
                        message: 'Por seguridad, no se pueden eliminar usuarios con menos de 30 días de inactividad'
                    });
                }

                // Crear backup automático
                const { createBackup } = require('./backup-database.js');
                await createBackup();

                await client.query('BEGIN');

                // Obtener usuarios inactivos para mostrar en los logs
                const inactiveUsersQuery = await client.query(`
                    SELECT username, created_at, liquid_blue_balance, escrow_blue_balance, red_balance
                    FROM users 
                    WHERE created_at < NOW() - INTERVAL '${daysInactive} days'
                    AND username NOT LIKE '%Plataforma%'
                    AND liquid_blue_balance = 100.0000
                    AND escrow_blue_balance = 0.0000
                    AND red_balance = 0.0000
                `);

                // Eliminar usuarios inactivos
                const deleteResult = await client.query(`
                    DELETE FROM users 
                    WHERE created_at < NOW() - INTERVAL '${daysInactive} days'
                    AND username NOT LIKE '%Plataforma%'
                    AND liquid_blue_balance = 100.0000
                    AND escrow_blue_balance = 0.0000
                    AND red_balance = 0.0000
                `);

                await client.query('COMMIT');

                console.log(`[ADMIN CLEANUP] Usuarios inactivos eliminados: ${deleteResult.rowCount}`);

                res.json({
                    success: true,
                    message: `Limpieza de usuarios inactivos completada`,
                    results: {
                        usersDeleted: deleteResult.rowCount,
                        daysInactive: daysInactive
                    }
                });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('[ADMIN CLEANUP] Error durante limpieza de usuarios inactivos:', error);
                res.status(500).json({ message: 'Error durante la limpieza: ' + error.message });
            } finally {
                client.release();
            }
        });

        // Endpoint para limpiar publicaciones antiguas
        app.post('/api/admin/database/cleanup-old-publications', verifyAdminToken, async (req, res) => {
            const { daysOld = 180 } = req.body;
            const client = await pool.connect();

            try {
                console.log(`[ADMIN CLEANUP] Administrador inició limpieza de publicaciones antiguas (${daysOld} días)`);

                // Validación de seguridad
                if (daysOld < 90) {
                    return res.status(400).json({
                        message: 'Por seguridad, no se pueden eliminar publicaciones con menos de 90 días de antigüedad'
                    });
                }

                // Crear backup automático
                const { createBackup } = require('./backup-database.js');
                await createBackup();

                await client.query('BEGIN');

                // Eliminar publicaciones antiguas
                const deleteResult = await client.query(`
                    DELETE FROM publications 
                    WHERE created_at < NOW() - INTERVAL '${daysOld} days'
                    AND status IN ('completed', 'confirmed_paid')
                `);

                await client.query('COMMIT');

                console.log(`[ADMIN CLEANUP] Publicaciones antiguas eliminadas: ${deleteResult.rowCount}`);

                res.json({
                    success: true,
                    message: `Limpieza de publicaciones antiguas completada`,
                    results: {
                        publicationsDeleted: deleteResult.rowCount,
                        daysOld: daysOld
                    }
                });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('[ADMIN CLEANUP] Error durante limpieza de publicaciones antiguas:', error);
                res.status(500).json({ message: 'Error durante la limpieza: ' + error.message });
            } finally {
                client.release();
            }
        });

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

                // Validar y sanitizar formFields (JSON con campos por paso)
                let sanitizedFormFields = null;
                if (formFields && typeof formFields === 'object' && Object.keys(formFields).length > 0) {
                    sanitizedFormFields = formFields;
                }

                const sql = `
                    INSERT INTO publications (title, description, blue_cost, is_sell_post, author_id, available_slots, auto_approve, is_booster_task, allow_repeat_participation, max_repeat_per_user, repeat_cooldown_hours, target_username, form_fields) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
                    RETURNING id
                `;
                const result = await pool.query(sql, [title, description, cost, !!isSellPost, authorId, slots, !!autoApprove, !!isBoosterTask, allowRepeat, maxRepeat, repeatCooldown, sanitizedTargetUsername, sanitizedFormFields]);

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

                // Validar y sanitizar formFields (JSON con campos por paso)
                let sanitizedFormFields = null;
                if (formFields && typeof formFields === 'object' && Object.keys(formFields).length > 0) {
                    sanitizedFormFields = formFields;
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
                        updated_at = NOW()
                    WHERE id = $13
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
                            ) ORDER BY pa.created_at)
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

        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error("Error fatal al iniciar el servidor:", err);
        process.exit(1);
    }
}

// Middleware de verificación de token de administrador (MODIFICADO PARA COOKIES)
function verifyAdminToken(req, res, next) {
    // Buscamos el token en la cookie firmada 'admin_token'
    const token = req.cookies.admin_token;

    if (!token) return res.status(401).json({ message: "No autorizado. Token no encontrado." });

    jwt.verify(token, process.env.ADMIN_SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: "Token inválido o expirado." });
        req.user = user;
        next();
    });
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

    jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err || !decoded) {
            return res.status(401).json({ message: 'No autenticado. Token inválido o expirado.' });
        }
        req.user = decoded; // { userId, username }
        next();
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

startServer();

// --- NUEVO: Endpoint para obtener los detalles completos de UNA SOLA publicación ---
app.get('/api/publications/:id', async (req, res) => {
    const { id } = req.params;
    const { user: requestingUser } = req.query; // Necesitamos saber quién está pidiendo la info

    if (!requestingUser) {
        return res.status(400).json({ message: "Se requiere el nombre de usuario que realiza la solicitud." });
    }

    const client = await pool.connect();
    try {
        // Una única consulta más compleja que reúne toda la información necesaria.
        // Esto es más eficiente que hacer múltiples consultas a la base de datos.
        const query = `
            SELECT
                p.id, p.title, p.description, p.blue_cost, p.status, p.created_at, p.is_paused,
                p.is_sell_post, p.available_slots, p.category, p.expires_at,
                p.is_quick_sale, p.target_username, p.form_fields, -- CAMPOS AÑADIDOS
                u.username as author_username,
                u.average_rating as author_average_rating,
                u.ratings_count as author_ratings_count,
                -- Obtenemos el estado de aceptación del usuario que está solicitando la página
                (
                    SELECT pa_user.status 
                    FROM publication_acceptances pa_user
                    WHERE pa_user.publication_id = p.id AND pa_user.acceptor_username = $2
                    ORDER BY pa_user.created_at DESC
                    LIMIT 1
                ) as user_acceptance_status,
                -- Obtenemos un array de objetos JSON con todos los participantes y sus detalles
                (
                    SELECT jsonb_agg(jsonb_build_object(
                        'username', pa_all.acceptor_username,
                        'status', pa_all.status,
                        'accepted_at', pa_all.created_at,
                        'average_rating', p_user.average_rating,
                        'ratings_count', p_user.ratings_count,
                        'phone_number', CASE WHEN pa_all.status = 'approved' THEN p_user.phone_number ELSE NULL END,
                        'form_responses', pa_all.form_responses
                    ) ORDER BY pa_all.created_at)
                    FROM publication_acceptances pa_all
                    JOIN users p_user ON pa_all.acceptor_username = p_user.username
                    WHERE pa_all.publication_id = p.id
                ) as participants
            FROM
                publications p
            JOIN
                users u ON p.author_id = u.id
            WHERE
                p.id = $1;
        `;

        const result = await client.query(query, [id, requestingUser]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Publicación no encontrada." });
        }

        const publication = result.rows[0];
        publication.participants = publication.participants || []; // Asegurarse de que sea un array

        // --- INICIO DE LA LÓGICA DE SEGURIDAD PARA VENTA RÁPIDA ---
        if (publication.is_quick_sale) {
            const isAuthor = publication.author_username === requestingUser;
            const isTargetedUser = publication.target_username === requestingUser;
            const isPublicQuickSale = !publication.target_username;
            const hasExpired = publication.expires_at && new Date(publication.expires_at) < new Date();

            // Si ha expirado, nadie puede verla, ni siquiera el autor, para mantener la consistencia.
            if (hasExpired) {
                return res.status(404).json({ message: "Esta venta rápida ha expirado." });
            }

            // Reglas de acceso:
            // 1. El autor siempre puede verla (mientras no haya expirado).
            // 2. Si tiene un comprador específico, solo él puede verla.
            // 3. Si es pública (sin comprador específico), cualquier usuario logueado que no sea el autor puede verla.
            if (!isAuthor && !isTargetedUser && !(isPublicQuickSale && !isAuthor)) {
                // Devolvemos 404 para no revelar la existencia de la venta.
                return res.status(404).json({ message: "Publicación no encontrada." });
            }
        }
        // --- FIN DE LA LÓGICA DE SEGURIDAD ---

        res.status(200).json(publication);

    } catch (error) {
        console.error(`Error fetching publication details for ID ${id}:`, error);
        res.status(500).json({ message: "Error interno del servidor al obtener los detalles de la publicación." });
    } finally {
        client.release();
    }
});

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

// --- NUEVA FUNCIÓN HELPER PARA ACTUALIZAR EL NIVEL DE UN IMPULSOR ---
async function updateUserBoosterLevel(client, userId) {
    // 1. Calcular el total de BLUE de impulsor que tiene el usuario
    const totalBlueResult = await client.query(
        'SELECT SUM(amount) as total FROM booster_blue_ledger WHERE user_id = $1',
        [userId]
    );
    const totalBoosterBlue = parseFloat(totalBlueResult.rows[0].total) || 0;

    // 2. Encontrar el nivel más alto que el usuario ha alcanzado
    const levelResult = await client.query(
        'SELECT MAX(level) as current_level FROM booster_level_settings WHERE min_blue_required <= $1',
        [totalBoosterBlue]
    );
    const newLevel = levelResult.rows[0].current_level || 0;

    // 3. Actualizar el nivel del usuario en la tabla 'users'
    await client.query('UPDATE users SET booster_level = $1 WHERE id = $2', [newLevel, userId]);
    console.log(`Nivel de impulsor para el usuario ID ${userId} actualizado a ${newLevel}.`);
}

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
                    ORDER BY bt.created_at DESC
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
                    ORDER BY bt.created_at DESC
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

    // Validación básica
    if (typeof platform_commission_percentage === 'undefined' || typeof public_profiles_enabled === 'undefined') {
        return res.status(400).json({ message: 'Faltan parámetros de configuración requeridos.' });
    }

    try {
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

/**
 * Helper para determinar el usuario responsable de la deuda RED
 * Si es menor, la deuda se asigna al tutor; si no, al usuario mismo
 */
async function getDebtResponsibleUser(client, username) {
    const userResult = await client.query(
        `SELECT id, username, is_minor, tutor_user_id FROM users WHERE username = $1`,
        [username]
    );

    if (userResult.rowCount === 0) {
        throw new Error(`Usuario no encontrado: ${username}`);
    }

    const user = userResult.rows[0];

    // Si es menor y tiene tutor, la deuda es del tutor
    if (user.is_minor && user.tutor_user_id) {
        const tutorResult = await client.query(
            `SELECT id, username FROM users WHERE id = $1`,
            [user.tutor_user_id]
        );

        if (tutorResult.rowCount === 0) {
            throw new Error(`Tutor no encontrado para el menor: ${username}`);
        }

        return {
            user_id: tutorResult.rows[0].id,
            username: tutorResult.rows[0].username,
            is_tutor: true,
            minor_username: username
        };
    }

    // Si no es menor o no tiene tutor, la deuda es del usuario mismo
    return {
        user_id: user.id,
        username: user.username,
        is_tutor: false,
        minor_username: null
    };
}

/**
 * Helper para determinar el usuario responsable de la deuda RED por user_id.
 * Preferido en flujos críticos (evita errores por username).
 */
async function getDebtResponsibleUserById(client, userId, { useTutor = true } = {}) {
    const userResult = await client.query(
        `SELECT id, username, is_minor, tutor_user_id FROM users WHERE id = $1`,
        [userId]
    );

    if (userResult.rowCount === 0) {
        throw new Error(`Usuario no encontrado (id): ${userId}`);
    }

    const user = userResult.rows[0];

    // Si no usamos tutor (regla económica estricta), la deuda es del autor.
    if (!useTutor) {
        return {
            user_id: user.id,
            username: user.username,
            is_tutor: false,
            minor_username: null
        };
    }

    // Si es menor y tiene tutor, la deuda es del tutor
    if (user.is_minor && user.tutor_user_id) {
        const tutorResult = await client.query(
            `SELECT id, username FROM users WHERE id = $1`,
            [user.tutor_user_id]
        );

        if (tutorResult.rowCount === 0) {
            throw new Error(`Tutor no encontrado para el menor (id): ${userId}`);
        }

        return {
            user_id: tutorResult.rows[0].id,
            username: tutorResult.rows[0].username,
            is_tutor: true,
            minor_username: user.username
        };
    }

    return {
        user_id: user.id,
        username: user.username,
        is_tutor: false,
        minor_username: null
    };
}

/**
 * Procesa la finalización de una publicación de tipo 'solicitud'.
 * Solo actualiza el estado a 'completed' y notifica al autor.
 */
async function processRequestCompletion(client, acceptance) {
    const { title, author_username, acceptance_id, completerUsername } = acceptance;
    await client.query(`UPDATE publication_acceptances SET status = 'completed' WHERE id = $1`, [acceptance_id]);

    const message = `${completerUsername} ha marcado la tarea "${title}" como culminada.`;
    await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [author_username, message]);

    return { success: true, message: "Tarea marcada como culminada. Esperando la confirmación del autor." };
}

/**
 * Procesa el pago final para una publicación de tipo 'solicitud'.
 * Maneja la lógica económica tanto para el modo normal como para el pre-lanzamiento.
 */
async function processRequestPayment(client, acceptance, pubId, preLaunchMode, settings) {
    const { blue_cost, title, author_username: author, author_id: authorId, workerUsername, workerId: workerIdFromQuery } = acceptance;
    const cost = parseFloat(blue_cost);

    if (preLaunchMode) {
        // --- MODO PRE-LANZAMIENTO ---
        console.log(`MODO PRE-LANZAMIENTO: Acumulando ${cost} BLUE para ${workerUsername} en perfil de impulsor.`);
        const workerResult = await client.query('SELECT id FROM users WHERE username = $1', [workerUsername]);
        const workerId = workerResult.rows[0].id;
        await client.query('SELECT record_booster_event($1, \'task_reward\', $2, $3)', [workerId, cost, pubId]);
        // ✅ FIX: Registrar también en booster_transactions para que el "Historial de Ganancias" cuadre con el total.
        // Antes: el total subía (ledger) pero el historial solo mostraba bonos/referrals.
        await client.query(
            `INSERT INTO booster_transactions (user_id, type, amount, description, related_publication_id)
             VALUES ($1, 'task_reward', $2, $3, $4)`,
            [workerId, cost, `Tarea de Impulsor: "${title}"`, pubId]
        );
        await client.query('UPDATE users SET is_booster = TRUE WHERE id = $1', [workerId]);
        await updateUserBoosterLevel(client, workerId);
    } else {
        // --- MODO NORMAL ---
        const debtInterval = `${settings.debt_cycle_days || 30} days ${settings.debt_cycle_hours || 0} hours ${settings.debt_cycle_minutes || 0} minutes`;
        const escrowInterval = `${settings.blue_escrow_days || 1} days ${settings.blue_escrow_hours || 0} hours ${settings.blue_escrow_minutes || 0} minutes`;
        const commissionPercentage = parseFloat(settings.platform_commission_percentage || '0');
        const commissionAmount = cost * (commissionPercentage / 100);
        const redForAuthor = cost + commissionAmount;

        // Determinar quién es responsable de la deuda (tutor si es menor).
        // Los menores de edad no pueden asumir obligaciones financieras legalmente,
        // por lo que su tutor asume la deuda RED (consistente con ventas y venta rápida).
        const debtResponsible = authorId
            ? await getDebtResponsibleUserById(client, authorId, { useTutor: true })
            : await getDebtResponsibleUser(client, author);

        // Guard de seguridad: nunca cargar RED al trabajador de una solicitud.
        if (workerIdFromQuery && debtResponsible.user_id === workerIdFromQuery) {
            await logAuditEvent(client, null, {
                eventType: 'economic_rules_violation.request_debt_on_worker',
                actorUsername: author,
                targetUsername: workerUsername,
                publicationId: pubId,
                category: 'request',
                metadata: {
                    reason: 'Debt responsible matches worker (unexpected).',
                    cost
                }
            });
            throw new Error('Regla económica violada: la deuda RED no puede asignarse al trabajador.');
        }

        // Actualizar saldo RED del responsable (tutor si es menor, autor si no)
        // Usamos 'credit' para AUMENTAR el balance de deuda (RED)
        await client.query(`SELECT record_balance_event($1, 'credit', 'red', $2, NULL)`, [debtResponsible.user_id, redForAuthor]);
        await client.query(`INSERT INTO red_token_debts (user_id, username, amount, due_at) VALUES ($1, $2, $3, NOW() + INTERVAL '${debtInterval}')`, [debtResponsible.user_id, debtResponsible.username, redForAuthor]);

        // Si la deuda es del tutor (menor con tutor), notificar al tutor
        if (debtResponsible.is_tutor) {
            await client.query(
                `INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`,
                [debtResponsible.username, `Se ha generado una deuda RED de ${redForAuthor.toFixed(4)} asociada a la cuenta del menor ${debtResponsible.minor_username} por la tarea "${acceptance.title}". Tú eres responsable de esta deuda como tutor.`]
            );
        }

        // Obtener el user_id del trabajador para insertarlo en blue_token_escrows
        const workerId = workerIdFromQuery
            ? workerIdFromQuery
            : await (async () => {
                const workerResult = await client.query('SELECT id FROM users WHERE username = $1', [workerUsername]);
                if (!workerResult.rows.length) {
                    throw new Error(`Usuario no encontrado: ${workerUsername}`);
                }
                return workerResult.rows[0].id;
            })();

        // Usamos 'payment_received' para AUMENTAR el balance en escrow (BLUE)
        await client.query(`SELECT record_balance_event($1, 'payment_received', 'escrow_blue', $2, NULL)`, [workerId, cost]);
        await client.query(`INSERT INTO blue_token_escrows (user_id, username, amount, unlock_at) VALUES ($1, $2, $3, NOW() + INTERVAL '${escrowInterval}')`, [workerId, workerUsername, cost]);

        // Asignar comisión a la plataforma como tokens BLUE reales (cumple reglas económicas)
        const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
        if (commissionAmount > 0) {
            const platformResult = await client.query('SELECT id FROM users WHERE username = $1', [platformUsername]);
            if (platformResult.rows.length > 0) {
                const platformId = platformResult.rows[0].id;
                // La plataforma recibe la comisión directamente como BLUE líquido (no en escrow)
                // Usamos 'payment_received' para AUMENTAR el balance líquido (BLUE)
                await client.query(`SELECT record_balance_event($1, 'payment_received', 'liquid_blue', $2, NULL)`, [platformId, commissionAmount]);
                await client.query(`INSERT INTO transactions (user_id, type, description, blue_change, red_change, related_publication_id) VALUES ($1, 'commission_received', $2, $3, 0, $4)`, [platformId, `Comisión por: "${title}"`, commissionAmount, pubId]);
            }
        }

        await client.query(`INSERT INTO platform_wallet (id, total_blue_commission_balance) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET total_blue_commission_balance = platform_wallet.total_blue_commission_balance + $1`, [commissionAmount]);

        const authorTxResult = await client.query(`INSERT INTO transactions (user_id, type, description, blue_change, red_change, related_publication_id, platform_fee_blue) VALUES ($1, 'payment_sent', $2, 0, $3, $4, $5) RETURNING id`, [debtResponsible.user_id, `Pagaste por: "${title}"${debtResponsible.is_tutor ? ` (como tutor de ${debtResponsible.minor_username})` : ''}`, redForAuthor, pubId, commissionAmount]);
        const authorTxId = authorTxResult.rows[0].id;
        await client.query(`INSERT INTO transactions (user_id, type, description, blue_change, red_change, related_publication_id) VALUES ($1, 'payment_received', $2, $3, 0, $4)`, [workerId, `Realizaste: "${title}"`, cost, pubId]);

        await client.query(`INSERT INTO platform_commission_log (related_publication_id, related_user_transaction_id, commission_amount_blue) VALUES ($1, $2, $3)`, [pubId, authorTxId, commissionAmount]);
    }

    // --- NOTIFICACIONES POR CORREO (RECIBOS) ---
    try {
        const emailQuery = await client.query('SELECT username, email FROM users WHERE username IN ($1, $2)', [author, workerUsername]);
        const authorEmail = emailQuery.rows.find(u => u.username === author)?.email;
        const workerEmail = emailQuery.rows.find(u => u.username === workerUsername)?.email;

        // Determinar la etiqueta de la moneda (BLUE vs BLUE iou)
        // Regla: Si es modo pre-lanzamiento O es tarea de impulsor => "BLUE iou"
        const isBoosterTx = (preLaunchMode || acceptance.is_booster_task);
        const currencyLabel = isBoosterTx ? 'BLUE iou' : 'BLUE';

        // 1. Recibo para el TRABAJADOR (Recibió recompensa)
        if (workerEmail) {
            const workerTitle = 'Tarea Completada';
            const workerMessage = isBoosterTx
                ? `Tu participación ha sido validada y los BLUE iou están en tu Perfil de Impulsor.`
                : `Tu participación ha sido validada y los BLUE están en tu Depósito de Garantía.`;

            await sendTransactionEmail({
                toEmail: workerEmail,
                subject: `¡Tarea completada: "${title}"!`,
                title: workerTitle,
                message: workerMessage,
                amount: `${cost.toFixed(4)} ${currencyLabel}`,
                details: [
                    { label: 'Concepto', value: `Tarea: ${title}` },
                    { label: 'Validado por', value: author },
                    { label: 'Fecha', value: new Date().toLocaleDateString('es-ES') },
                    { label: 'Destino', value: isBoosterTx ? 'Perfil de Impulsor' : 'Escrow (Garantía)' }
                ]
            });
        }

        // 2. Comprobante para el AUTOR (Realizó pago)
        if (authorEmail) {
            let authMsg = '';
            let authAmount = '';
            let authTitle = '';

            if (preLaunchMode) {
                authTitle = 'Tarea Completada';
                authMsg = `El usuario ${workerUsername} completó tu tarea "${title}". El sistema ha enviado la recompensa.`;
                authAmount = `${cost.toFixed(4)} ${currencyLabel} (Subvencionado)`;
            } else {
                const totalPaid = cost * (1 + (parseFloat(settings.platform_commission_percentage || '0') / 100));
                authTitle = 'Pago Enviado';
                authMsg = `Has pagado por la tarea "${title}".`;
                authAmount = `${totalPaid.toFixed(4)} RED`;
            }

            await sendTransactionEmail({
                toEmail: authorEmail,
                subject: `Actualización de tarea: "${title}"`,
                title: authTitle,
                message: authMsg,
                amount: authAmount,
                details: [
                    { label: 'Concepto', value: `Tarea: ${title}` },
                    { label: 'Trabajador', value: workerUsername },
                    { label: 'Fecha', value: new Date().toLocaleDateString('es-ES') }
                ]
            });
        }
    } catch (emailError) {
        console.error('Error al enviar correos de transacción (processRequestPayment):', emailError);
    }


    const notificationMessage = preLaunchMode
        ? `¡Has acumulado ${cost.toFixed(4)} BLUE en tu Perfil de Impulsor por la tarea "${title}"!`
        : `¡Has recibido ${cost.toFixed(4)} BLUE (en depósito) por la tarea "${title}"!`;
    await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [workerUsername, notificationMessage]);

    return { success: true, message: "Pago confirmado y tarea finalizada." };
}


/**
 * Procesa la finalización de una publicación de tipo 'sell' o 'donation'.
 * Maneja la lógica económica de pago en un solo paso.
 */
async function processDirectPaymentCompletion(client, acceptance, pubId, preLaunchMode, settings) {
    const { blue_cost, title, author_username: recipient, acceptance_id, category, completerUsername: payer } = acceptance;
    const cost = parseFloat(blue_cost);
    let resultMessage; // Usaremos una variable para el mensaje de retorno

    if (preLaunchMode) {
        // --- MODO PRE-LANZAMIENTO: Transferencia desde el perfil de impulsor ---
        const payerResult = await client.query('SELECT id FROM users WHERE username = $1', [payer]);
        const payerId = payerResult.rows[0].id;
        const recipientResult = await client.query('SELECT id FROM users WHERE username = $1', [recipient]);
        const recipientId = recipientResult.rows[0].id;

        const payerBalanceResult = await client.query('SELECT SUM(amount) as total FROM booster_blue_ledger WHERE user_id = $1', [payerId]);
        const payerBalance = parseFloat(payerBalanceResult.rows[0].total) || 0;

        if (payerBalance < cost) {
            throw { status: 400, message: 'Saldo insuficiente en tu perfil de impulsor para esta acción.' };
        }

        await client.query('SELECT record_booster_event($1, \'payment_sent\', $2, $3)', [payerId, -cost, pubId]);
        await client.query('SELECT record_booster_event($1, \'payment_received\', $2, $3)', [recipientId, cost, pubId]);

        await client.query('INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, $2, $3, $4)', [payerId, `${category}_sent`, -cost, `Envío para: "${title}"`]);
        await client.query('INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, $2, $3, $4)', [recipientId, `${category}_received`, cost, `Recibido de ${payer} para: "${title}"`]);

        await client.query('UPDATE users SET is_booster = TRUE WHERE id IN ($1, $2)', [payerId, recipientId]);
        await updateUserBoosterLevel(client, payerId);
        await updateUserBoosterLevel(client, recipientId);

        const payerNotification = `Has transferido ${cost.toFixed(4)} BLUE de tu perfil de impulsor para "${title}".`;
        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [payer, payerNotification]);
        const recipientNotification = `Has recibido ${cost.toFixed(4)} BLUE en tu perfil de impulsor de ${payer} para "${title}".`;
        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [recipient, recipientNotification]);

        resultMessage = "Transferencia completada exitosamente desde tu perfil de impulsor.";
    } else {
        // --- MODO NORMAL: Creación de tokens RED/BLUE ---
        const debtInterval = `${settings.debt_cycle_days || 30} days ${settings.debt_cycle_hours || 0} hours ${settings.debt_cycle_minutes || 0} minutes`;
        const escrowInterval = `${settings.blue_escrow_days || 1} days ${settings.blue_escrow_hours || 0} hours ${settings.blue_escrow_minutes || 0} minutes`;
        const commissionPercentage = parseFloat(settings.platform_commission_percentage || '0');
        const commissionAmount = cost * (commissionPercentage / 100);
        const redForPayer = cost + commissionAmount;

        // Determinar quién es responsable de la deuda (tutor si es menor)
        const debtResponsible = await getDebtResponsibleUser(client, payer);

        // Actualizar saldo RED del responsable (tutor si es menor, pagador si no)
        // Usamos 'credit' para AUMENTAR el balance de deuda (RED)
        await client.query(`SELECT record_balance_event($1, 'credit', 'red', $2, NULL)`, [debtResponsible.user_id, redForPayer]);
        await client.query(`INSERT INTO red_token_debts (user_id, username, amount, due_at) VALUES ($1, $2, $3, NOW() + INTERVAL '${debtInterval}')`, [debtResponsible.user_id, debtResponsible.username, redForPayer]);

        // Si la deuda es del tutor (menor con tutor), notificar al tutor
        if (debtResponsible.is_tutor) {
            await client.query(
                `INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`,
                [debtResponsible.username, `Se ha generado una deuda RED de ${redForPayer.toFixed(4)} asociada a la cuenta del menor ${debtResponsible.minor_username} por "${acceptance.title}". Tú eres responsable de esta deuda como tutor.`]
            );
        }

        // Obtener el user_id del recipiente para insertarlo en blue_token_escrows
        const recipientResult = await client.query('SELECT id FROM users WHERE username = $1', [recipient]);
        if (!recipientResult.rows.length) {
            throw new Error(`Usuario no encontrado: ${recipient}`);
        }
        const recipientId = recipientResult.rows[0].id;

        // Usamos 'payment_received' para AUMENTAR el balance en escrow (BLUE)
        await client.query(`SELECT record_balance_event($1, 'payment_received', 'escrow_blue', $2, NULL)`, [recipientId, cost]);
        await client.query(`INSERT INTO blue_token_escrows (user_id, username, amount, unlock_at) VALUES ($1, $2, $3, NOW() + INTERVAL '${escrowInterval}')`, [recipientId, recipient, cost]);

        // Asignar comisión a la plataforma como tokens BLUE reales (cumple reglas económicas)
        const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
        if (commissionAmount > 0) {
            const platformResult = await client.query('SELECT id FROM users WHERE username = $1', [platformUsername]);
            if (platformResult.rows.length > 0) {
                const platformId = platformResult.rows[0].id;
                // La plataforma recibe la comisión directamente como BLUE líquido (no en escrow)
                // Usamos 'payment_received' para AUMENTAR el balance líquido (BLUE)
                await client.query(`SELECT record_balance_event($1, 'payment_received', 'liquid_blue', $2, NULL)`, [platformId, commissionAmount]);
                await client.query(`INSERT INTO transactions (user_id, type, description, blue_change, red_change, related_publication_id) VALUES ($1, 'commission_received', $2, $3, 0, $4)`, [platformId, `Comisión por: "${title}"`, commissionAmount, pubId]);
            }
        }

        await client.query(`INSERT INTO platform_wallet (id, total_blue_commission_balance) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET total_blue_commission_balance = platform_wallet.total_blue_commission_balance + $1`, [commissionAmount]);

        const payerTxResult = await client.query(`INSERT INTO transactions (user_id, type, description, blue_change, red_change, related_publication_id, platform_fee_blue) VALUES ($1, 'payment_sent', $2, 0, $3, $4, $5) RETURNING id`, [debtResponsible.user_id, `Pagaste por: "${title}"${debtResponsible.is_tutor ? ` (como tutor de ${debtResponsible.minor_username})` : ''}`, redForPayer, pubId, commissionAmount]);
        const payerTxId = payerTxResult.rows[0].id;
        await client.query(`INSERT INTO transactions (user_id, type, description, blue_change, red_change, related_publication_id) VALUES ($1, 'payment_received', $2, $3, 0, $4)`, [recipientId, `Recibiste por: "${title}"`, cost, pubId]);

        await client.query(`INSERT INTO platform_commission_log (related_publication_id, related_user_transaction_id, commission_amount_blue) VALUES ($1, $2, $3)`, [pubId, payerTxId, commissionAmount]);

        const recipientNotification = `¡Has recibido el pago de ${cost.toFixed(4)} BLUE (en depósito) por "${title}" de parte de ${payer}!`;
        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [recipient, recipientNotification]);

        resultMessage = "¡Compra/Donación completada y pagada! Gracias.";
    }

    // --- NOTIFICACIONES POR CORREO (RECIBOS) ---
    try {
        const emailQuery = await client.query('SELECT username, email FROM users WHERE username IN ($1, $2)', [payer, recipient]);
        const payerEmail = emailQuery.rows.find(u => u.username === payer)?.email;
        const recipientEmail = emailQuery.rows.find(u => u.username === recipient)?.email;
        const dateStr = new Date().toLocaleDateString('es-ES');

        // 1. Recibo para el COMPRADOR/DONANTE (Pagó)
        if (payerEmail) {
            let totalPaid = cost;
            let currency = 'BLUE';
            let status = 'Completado';

            if (!preLaunchMode) {
                totalPaid = cost * (1 + (parseFloat(settings.platform_commission_percentage || '0') / 100));
                currency = 'RED'; // En modo normal genera deuda RED
                status = 'Deuda Generada';
            } else {
                status = 'Transferido (Booster)';
            }

            await sendTransactionEmail({
                toEmail: payerEmail,
                subject: `Recibo de pago: "${title}"`,
                title: 'Pago Realizado',
                message: `Has completado el pago para la publicación "${title}".`,
                amount: `${totalPaid.toFixed(4)} ${currency}`,
                details: [
                    { label: 'Concepto', value: title },
                    { label: 'Beneficiario', value: recipient },
                    { label: 'Fecha', value: dateStr },
                    { label: 'Estado', value: status }
                ]
            });
        }

        // 2. Notificación para el VENDEDOR/RECEPTOR (Recibió)
        if (recipientEmail) {
            const receiveStatus = preLaunchMode ? 'Recibido (Booster)' : 'En Depósito (Escrow)';
            await sendTransactionEmail({
                toEmail: recipientEmail,
                subject: `¡Te han pagado por "${title}"!`,
                title: 'Nuevo Pago Recibido',
                message: `${payer} ha pagado por tu publicación "${title}".`,
                amount: `${cost.toFixed(4)} BLUE`,
                details: [
                    { label: 'Concepto', value: title },
                    { label: 'Pagador', value: payer },
                    { label: 'Fecha', value: dateStr },
                    { label: 'Estado', value: receiveStatus }
                ]
            });
        }
    } catch (emailError) {
        console.error('Error al enviar correos de transacción (processDirectPaymentCompletion):', emailError);
    }

    // Actualizar el estado de la aceptación a 'confirmed_paid' (solo si existe acceptance_id)
    if (acceptance_id) {
        await client.query(`UPDATE publication_acceptances SET status = 'confirmed_paid' WHERE id = $1`, [acceptance_id]);
    }

    return { success: true, message: resultMessage };
}

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

// =================================================================================
// ==  PERFIL PÚBLICO DE IMPULSOR (BOOSTER)                                       ==
// =================================================================================
// NOTA: Este endpoint se implementa arriba con historial completo y nivel calculado.
// La versión anterior duplicada fue removida para evitar inconsistencias.

// =================================================================================
// ==  OBTENER PUBLICACIONES DE UN USUARIO (PARA SU PERFIL PÚBLICO)               ==