// 0. Cargar variables de entorno
require('dotenv').config();

// 1. Importar las librerías necesarias
const express = require('express');
const { Pool } = require('pg'); // Importamos el Pool de pg
const bcrypt = require('bcrypt');
const cors = require('cors');
const cookieParser = require('cookie-parser'); // NECESARIO PARA COOKIES
const path = require('path');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit'); // <-- SEGURIDAD: Importar rate-limit
const cron = require('node-cron');
require('./config'); // Carga la configuración del entorno (development o production)

// Configuración de Twilio para el envío de SMS de verificación
const twilio = require('twilio');

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

// Configuración de Twilio
// Es importante verificar también estas credenciales
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
    console.error(`
        *******************************************************************************
        * ERROR FATAL: Las credenciales de Twilio no están completamente configuradas. *
        *                                                                             *
        * Asegúrate de que las variables TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, y      *
        * TWILIO_PHONE_NUMBER estén definidas en tu archivo .env.                     *
        *                                                                             *
        * El servidor no se iniciará hasta que estas variables estén configuradas.    *
        *******************************************************************************
    `);
    process.exit(1);
}

const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

// 2. Configuración inicial
const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10;

// Render (y la mayoría de PaaS) usa un proxy inverso que añade X-Forwarded-For.
// Para que express-rate-limit y req.ip funcionen correctamente en producción:
app.set('trust proxy', 1);

// Middleware de seguridad para limitar intentos de login
const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutos
	max: 20, // Bloquear después de 20 intentos
	standardHeaders: true, // Devuelve información del límite en los headers `RateLimit-*`
	legacyHeaders: false, // Deshabilita los headers `X-RateLimit-*`
    message: 'Demasiados intentos de inicio de sesión desde esta IP. Por favor, inténtelo de nuevo en 15 minutos.'
});


// 3. Middlewares
// Configuración de CORS segura para permitir cookies
// CORS allowlist:
// - En producción: solo dominios reales (Hostinger/Render)
// - En desarrollo: además localhost para permitir trabajar sin abrir CORS globalmente
const ALLOWED_ORIGINS = [
    'https://wintoncoin-frontend.onrender.com',
    'https://sc.wintoncoin.com', // Hostinger (producción)
    'https://www.sc.wintoncoin.com'
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
        // Esto evita bloqueos cuando el frontend local corre en 3000/5173/5500, etc.
        if (process.env.NODE_ENV !== 'production') {
            const isLocalhostOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
            if (isLocalhostOrigin) return callback(null, true);
        }
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS bloqueado para el origen: ${origin}`));
    },
    credentials: true // CRÍTICO: Permite cookies entre dominios
}));
app.use(express.json());
app.use(cookieParser()); // CRÍTICO: Parsea las cookies de las peticiones
app.use(express.static(path.join(__dirname, '../frontend')));

// 4. Conectar a la Base de Datos PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// =================================================================================
// == AUDIT LOG (Bank-grade traceability) =========================================
// =================================================================================
// Append-only audit events. Do NOT store secrets (passwords/tokens/private keys).
// Retention: 48 months (cleanup job below).
async function logAuditEvent(clientOrPool, req, {
    eventType,
    actorUsername = null,
    targetUsername = null,
    publicationId = null,
    category = null,
    metadata = {}
}) {
    try {
        const ipAddress = req?.clientIp || req?.ip || null; // request-ip middleware sets req.clientIp
        const userAgent = req?.headers?.['user-agent'] || null;
        const sql = `
            INSERT INTO audit_log
                (event_type, actor_username, target_username, publication_id, category, ip_address, user_agent, metadata)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        `;
        const params = [
            eventType,
            actorUsername,
            targetUsername,
            publicationId,
            category,
            ipAddress,
            userAgent,
            JSON.stringify(metadata || {})
        ];
        await clientOrPool.query(sql, params);
    } catch (err) {
        // Never break business logic due to logging failures, but record server-side.
        console.error('[AUDIT_LOG] Failed to write audit event:', err);
    }
}

// Retention cleanup (48 months): run daily at 03:15 server time
cron.schedule('15 3 * * *', async () => {
    try {
        const retentionMonths = 48;
        await pool.query(`DELETE FROM audit_log WHERE created_at < NOW() - ($1 || ' months')::interval`, [retentionMonths]);
    } catch (err) {
        console.error('[AUDIT_LOG] Retention cleanup failed:', err);
    }
});

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

// Nueva función para manejar todas las migraciones y alteraciones de tablas existentes.
async function applyMigrations(client) {
    console.log('Aplicando migraciones...');
    try {
        const migrations = [
            // MIGRACIÓN 1: Tabla de usuarios
            `CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                liquid_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
                escrow_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
                red_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
                average_rating REAL NOT NULL DEFAULT 0,
                ratings_count INTEGER NOT NULL DEFAULT 0,
                is_booster BOOLEAN DEFAULT FALSE,
                booster_level INTEGER DEFAULT 1,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP WITH TIME ZONE
            );`,
            // MIGRACIÓN 2: Tabla de balances
            `CREATE TABLE IF NOT EXISTS user_balances (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                blue_balance NUMERIC(15, 4) DEFAULT 0,
                red_balance NUMERIC(15, 4) DEFAULT 0,
                escrow_blue_balance NUMERIC(15, 4) DEFAULT 0,
                penalized_debt NUMERIC(15, 4) DEFAULT 0,
                next_due_at TIMESTAMP WITH TIME ZONE,
                next_due_amount NUMERIC(15, 4),
                next_unlock_at TIMESTAMP WITH TIME ZONE,
                next_unlock_amount NUMERIC(15, 4)
            );`,
            // MIGRACIÓN 3: Tabla de perfiles
            `CREATE TABLE IF NOT EXISTS user_profiles (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                bio TEXT,
                avatar_url TEXT
            );`,
            // MIGRACIÓN 4: Tabla de publicaciones
            `CREATE TABLE IF NOT EXISTS publications (
                id SERIAL PRIMARY KEY,
                author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                blue_cost NUMERIC(15, 4) NOT NULL,
                status VARCHAR(50) DEFAULT 'open',
                available_slots INTEGER DEFAULT 1,
                is_sell_post BOOLEAN DEFAULT FALSE,
                is_paused BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                hidden_for_users INTEGER[] DEFAULT ARRAY[]::INTEGER[]
            );`,
            // MIGRACIÓN 5: Tabla de aceptaciones de publicaciones
            `CREATE TABLE IF NOT EXISTS publication_acceptances (
                id SERIAL PRIMARY KEY,
                publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
                acceptor_username VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending_approval',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (publication_id, acceptor_username)
            );`,
            // MIGRACIÓN 6: Tabla de configuraciones de la aplicación
            `CREATE TABLE IF NOT EXISTS app_settings (
                id SERIAL PRIMARY KEY,
                setting_key VARCHAR(255) UNIQUE NOT NULL,
                setting_value TEXT NOT NULL,
                description TEXT
            );`,
            // MIGRACIÓN 7: Añadir campos de email y teléfono a la tabla de usuarios.
            `DO $$
             BEGIN
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email') THEN
                     ALTER TABLE users ADD COLUMN email VARCHAR(255);
                 END IF;
                 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key' AND conrelid = 'users'::regclass) THEN
                     ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
                 END IF;
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone') THEN
                     ALTER TABLE users ADD COLUMN phone VARCHAR(50);
                 END IF;
                 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_phone_key' AND conrelid = 'users'::regclass) THEN
                     ALTER TABLE users ADD CONSTRAINT users_phone_key UNIQUE (phone);
                 END IF;
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone_number') THEN
                     ALTER TABLE users ADD COLUMN phone_number VARCHAR(50);
                 END IF;
                 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_phone_number_key' AND conrelid = 'users'::regclass) THEN
                     ALTER TABLE users ADD CONSTRAINT users_phone_number_key UNIQUE (phone_number);
                 END IF;
             END $$;`,
            // MIGRACIÓN 8: Añadir la columna 'auto_approve' a la tabla de publicaciones.
            `ALTER TABLE publications ADD COLUMN IF NOT EXISTS auto_approve BOOLEAN DEFAULT FALSE;`,
            // MIGRACIÓN 9: Tabla de calificaciones
            `CREATE TABLE IF NOT EXISTS ratings (
                id SERIAL PRIMARY KEY,
                publication_id INTEGER REFERENCES publications(id) ON DELETE SET NULL,
                rater_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                ratee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (publication_id, rater_id, ratee_id)
            );`,
            // MIGRACIÓN 10: Tabla de log de comisiones
            `CREATE TABLE IF NOT EXISTS platform_commission_log (
                id SERIAL PRIMARY KEY,
                commission_amount NUMERIC(15, 4) NOT NULL,
                related_publication_id INTEGER REFERENCES publications(id) ON DELETE SET NULL,
                related_user_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
                transaction_type VARCHAR(100),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );`,
            // MIGRACIÓN 11: Añadir categoría a las publicaciones
            `ALTER TABLE publications ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'request';`,
            // MIGRACIÓN 12: Tabla de referidos
            `CREATE TABLE IF NOT EXISTS referral_codes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                code VARCHAR(20) UNIQUE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );`,
            // MIGRACIÓN 13: Tabla de sistema de impulsores
            `CREATE TABLE IF NOT EXISTS booster_levels (
                level INTEGER PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                min_blue_required NUMERIC(15, 4) NOT NULL
            );`,
            // MIGRACIÓN 14: Tabla de perfiles de impulsores
            `CREATE TABLE IF NOT EXISTS booster_profiles (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                blue_accumulated NUMERIC(15, 4) DEFAULT 0,
                level INTEGER DEFAULT 1,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );`,
            // MIGRACIÓN 15: Tabla de transacciones de impulsores
            `CREATE TABLE IF NOT EXISTS booster_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                amount NUMERIC(15, 4) NOT NULL,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );`,
            // MIGRACIÓN 16: REMOVIDO - Ahora usamos formato key-value en app_settings
            // MIGRACIÓN 17: REMOVIDO - Ahora usamos formato key-value en app_settings
             // MIGRACIÓN 18: Columna is_booster_task en publications
            `ALTER TABLE publications ADD COLUMN IF NOT EXISTS is_booster_task BOOLEAN NOT NULL DEFAULT FALSE;`,
            // MIGRACIÓN 19: Agregar columnas faltantes a users si no existen
            `DO $$
             BEGIN
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='liquid_blue_balance') THEN
                     ALTER TABLE users ADD COLUMN liquid_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000;
                 END IF;
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='escrow_blue_balance') THEN
                     ALTER TABLE users ADD COLUMN escrow_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000;
                 END IF;
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='red_balance') THEN
                     ALTER TABLE users ADD COLUMN red_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000;
                 END IF;
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='average_rating') THEN
                     ALTER TABLE users ADD COLUMN average_rating REAL NOT NULL DEFAULT 0;
                 END IF;
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='ratings_count') THEN
                     ALTER TABLE users ADD COLUMN ratings_count INTEGER NOT NULL DEFAULT 0;
                 END IF;
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_booster') THEN
                     ALTER TABLE users ADD COLUMN is_booster BOOLEAN DEFAULT FALSE;
                 END IF;
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='booster_level') THEN
                     ALTER TABLE users ADD COLUMN booster_level INTEGER DEFAULT 1;
                 END IF;
             END $$;`,
            // MIGRACIÓN 20: Corregir publication_acceptances si usa user_id en lugar de acceptor_username
            `DO $$
             BEGIN
                 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publication_acceptances' AND column_name='user_id') 
                 AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publication_acceptances' AND column_name='acceptor_username') THEN
                     ALTER TABLE publication_acceptances ADD COLUMN acceptor_username VARCHAR(255);
                     ALTER TABLE publication_acceptances DROP COLUMN user_id;
                 END IF;
             END $$;`,
            // MIGRACIÓN 21: Agregar related_user_transaction_id a platform_commission_log si no existe
            `DO $$
             BEGIN
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='platform_commission_log' AND column_name='related_user_transaction_id') THEN
                     ALTER TABLE platform_commission_log ADD COLUMN related_user_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL;
                 END IF;
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='platform_commission_log' AND column_name='commission_amount_blue') THEN
                     ALTER TABLE platform_commission_log ADD COLUMN commission_amount_blue NUMERIC(15, 4);
                 END IF;
             END $$;`,
            // MIGRACIÓN 22: Agregar referral_code a users si no existe
            `DO $$
             BEGIN
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='referral_code') THEN
                     ALTER TABLE users ADD COLUMN referral_code VARCHAR(20) UNIQUE;
                 END IF;
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='referrer_id') THEN
                     ALTER TABLE users ADD COLUMN referrer_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
                 END IF;
             END $$;`,
            // MIGRACIÓN 23: Crear índices optimizados para sistema de referidos
            `DO $$
             BEGIN
                 IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_referral_code') THEN
                     CREATE INDEX idx_users_referral_code ON users(referral_code);
                 END IF;
                 IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_referrer_id') THEN
                     CREATE INDEX idx_users_referrer_id ON users(referrer_id);
                 END IF;
             END $$;`,
            // MIGRACIÓN 24: Agregar columnas faltantes en ratings y transactions
            `DO $$
             BEGIN
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ratings' AND column_name='rater_username') THEN
                     ALTER TABLE ratings ADD COLUMN rater_username VARCHAR(255);
                 END IF;
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='platform_fee_blue') THEN
                     ALTER TABLE transactions ADD COLUMN platform_fee_blue NUMERIC(19, 4) DEFAULT 0;
                 END IF;
             END $$;`,
            // MIGRACIÓN 25: Corregir restricciones de platform_commission_log
            `DO $$
             BEGIN
                 -- Hacer que commission_amount_blue sea NOT NULL para el modo normal
                 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='platform_commission_log' AND column_name='commission_amount_blue') THEN
                     ALTER TABLE platform_commission_log ALTER COLUMN commission_amount_blue SET NOT NULL;
                 END IF;
                 -- Hacer que commission_amount sea nullable para el modo pre-lanzamiento
                 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='platform_commission_log' AND column_name='commission_amount') THEN
                     ALTER TABLE platform_commission_log ALTER COLUMN commission_amount DROP NOT NULL;
                 END IF;
             END $$;`,
            // MIGRACIÓN 26: Fortalecer la columna 'category' en publications
            `DO $$
             BEGIN
                 -- Asegurar que la columna no sea nula
                 ALTER TABLE publications ALTER COLUMN category SET NOT NULL;
                 -- Añadir una restricción para asegurar que solo valores válidos sean insertados
                 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publications_category_check') THEN
                     ALTER TABLE publications ADD CONSTRAINT publications_category_check CHECK (category IN ('request', 'sell', 'donation'));
                 END IF;
             END $$;`,
            // MIGRACIÓN 27: Añadir fecha de expiración a las publicaciones
            `DO $$
             BEGIN
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publications' AND column_name='expires_at') THEN
                     ALTER TABLE publications ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;
                 END IF;
             END $$;`,

            // MIGRACIÓN 28: Añadir campos para Venta Rápida
            `DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publications' AND column_name='is_quick_sale') THEN
                    ALTER TABLE publications ADD COLUMN is_quick_sale BOOLEAN DEFAULT FALSE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publications' AND column_name='target_username') THEN
                    ALTER TABLE publications ADD COLUMN target_username VARCHAR(255);
                 END IF;
             END $$;`,
            // MIGRACIÓN 29: Añadir columna status a la tabla users para moderación
            `DO $$
             BEGIN
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='status') THEN
                     ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
                 END IF;
             END $$;`,
            // MIGRACIÓN 34: Añadir campos para sistema de menores y tutores
            `DO $$
             BEGIN
                 -- Agregar date_of_birth a users si no existe
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='date_of_birth') THEN
                     ALTER TABLE users ADD COLUMN date_of_birth DATE;
                 END IF;
                 -- Agregar is_minor a users si no existe
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_minor') THEN
                     ALTER TABLE users ADD COLUMN is_minor BOOLEAN DEFAULT FALSE;
                 END IF;
                 -- Agregar tutor_user_id a users si no existe
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tutor_user_id') THEN
                     ALTER TABLE users ADD COLUMN tutor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
                 END IF;
                 -- Agregar account_status a users si no existe (diferente de status que es para moderación)
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='account_status') THEN
                     ALTER TABLE users ADD COLUMN account_status VARCHAR(50) DEFAULT 'active';
                 END IF;
                 -- Agregar date_of_birth a pending_verifications si no existe
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_verifications' AND column_name='date_of_birth') THEN
                     ALTER TABLE pending_verifications ADD COLUMN date_of_birth DATE;
                 END IF;
                 -- Agregar is_minor a pending_verifications si no existe
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_verifications' AND column_name='is_minor') THEN
                     ALTER TABLE pending_verifications ADD COLUMN is_minor BOOLEAN DEFAULT FALSE;
                 END IF;
             END $$;`,
            // MIGRACIÓN 30: Añadir columna user_id a red_token_debts y actualizar registros existentes
            `DO $$
             BEGIN
                 -- Si la columna no existe, crearla
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='red_token_debts' AND column_name='user_id') THEN
                     ALTER TABLE red_token_debts ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
                 END IF;
                 -- Actualizar los registros existentes con el user_id correspondiente (por si acaso hay NULLs)
                 UPDATE red_token_debts rtd
                 SET user_id = u.id
                 FROM users u
                 WHERE rtd.username = u.username AND (rtd.user_id IS NULL OR rtd.user_id IS DISTINCT FROM u.id);
                 -- Hacer la columna NOT NULL después de actualizar los datos (si no lo es ya)
                 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='red_token_debts' AND column_name='user_id' AND is_nullable='YES') THEN
                     ALTER TABLE red_token_debts ALTER COLUMN user_id SET NOT NULL;
                 END IF;
             END $$;`,
            // MIGRACIÓN 31: Añadir columna user_id a blue_token_escrows y actualizar registros existentes
            `DO $$
             BEGIN
                 -- Si la columna no existe, crearla
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='blue_token_escrows' AND column_name='user_id') THEN
                     ALTER TABLE blue_token_escrows ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
                 END IF;
                 -- Actualizar los registros existentes con el user_id correspondiente (por si acaso hay NULLs)
                 UPDATE blue_token_escrows bte
                 SET user_id = u.id
                 FROM users u
                 WHERE bte.username = u.username AND (bte.user_id IS NULL OR bte.user_id IS DISTINCT FROM u.id);
                 -- Hacer la columna NOT NULL después de actualizar los datos (si no lo es ya)
                 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='blue_token_escrows' AND column_name='user_id' AND is_nullable='YES') THEN
                     ALTER TABLE blue_token_escrows ALTER COLUMN user_id SET NOT NULL;
                 END IF;
             END $$;`,
            `
            CREATE TABLE IF NOT EXISTS platform_wallet (
                id SERIAL PRIMARY KEY,
                balance NUMERIC(20, 8) NOT NULL DEFAULT 0.00,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `,
        `
            CREATE TABLE IF NOT EXISTS pending_verifications (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                phone_number VARCHAR(50) UNIQUE NOT NULL,
                verification_code VARCHAR(10) NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                referral_code VARCHAR(255),
                date_of_birth DATE,
                is_minor BOOLEAN DEFAULT FALSE
            );
        `,
        `
            ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
            
        `,
        // MIGRACIÓN 11: Asegurar que la tabla pending_verifications tiene la columna referral_code
        `ALTER TABLE pending_verifications ADD COLUMN IF NOT EXISTS referral_code VARCHAR(255);`,
        
        // MIGRACIÓN 12: Tabla de notificaciones
        `CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                recipient_username VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );`,
        `CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
            blue_change NUMERIC(19, 4) NOT NULL DEFAULT 0,
            red_change NUMERIC(19, 4) NOT NULL DEFAULT 0,
                related_publication_id INTEGER,
            platform_fee_blue NUMERIC(19, 4) DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS ratings (
            id SERIAL PRIMARY KEY,
            publication_id INTEGER NOT NULL REFERENCES publications(id),
            rater_username VARCHAR(255) NOT NULL,
            ratee_username VARCHAR(255) NOT NULL,
            rating INTEGER NOT NULL,
            comment TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS red_token_debts (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            amount NUMERIC(19, 4) NOT NULL,
            due_at TIMESTAMPTZ NOT NULL,
            is_settled BOOLEAN NOT NULL DEFAULT FALSE,
            is_penalized BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS app_settings (
            setting_key VARCHAR(255) PRIMARY KEY,
            setting_value TEXT NOT NULL,
            description TEXT
        );`,
        `CREATE TABLE IF NOT EXISTS blue_token_escrows (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            amount NUMERIC(19, 4) NOT NULL,
            unlock_at TIMESTAMPTZ NOT NULL,
            is_released BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        // --- NUEVAS TABLAS PARA LA BILLETERA DE LA PLATAFORMA ---
        `CREATE TABLE IF NOT EXISTS platform_wallet (
            id INT PRIMARY KEY DEFAULT 1, -- Solo habrá una fila
            total_blue_commission_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000
        );`,
        `CREATE TABLE IF NOT EXISTS platform_commission_log (
            id SERIAL PRIMARY KEY,
            related_publication_id INT NOT NULL,
            related_user_transaction_id INT, -- El ID de la transacción de usuario que generó esta comisión
            commission_amount_blue NUMERIC(19, 4) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        // --- NUEVA TABLA PARA EL SISTEMA DE REFERIDOS ---
        `CREATE TABLE IF NOT EXISTS referral_log (
            id SERIAL PRIMARY KEY,
            referrer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
            referred_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        // --- NUEVAS TABLAS PARA EL SISTEMA DE IMPULSORES (BOOSTERS) ---
        `CREATE TABLE IF NOT EXISTS booster_level_settings (
            level INTEGER PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            min_blue_required NUMERIC(19, 4) NOT NULL,
            description TEXT
        );`,
        `CREATE TABLE IF NOT EXISTS booster_blue_ledger (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount NUMERIC(19, 4) NOT NULL,
            source_publication_id INTEGER REFERENCES publications(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS booster_payment_log (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount_paid NUMERIC(19, 4) NOT NULL,
            payment_month DATE NOT NULL,
            booster_level_at_payment INTEGER NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        // --- NUEVO: Tabla para el historial de transacciones del perfil de impulsor ---
        `CREATE TABLE IF NOT EXISTS booster_transactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL, -- ej: 'welcome_bonus', 'referral_bonus', 'publication_reward'
            amount NUMERIC(19, 4) NOT NULL,
            description TEXT,
            related_publication_id INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        // --- MIGRACIÓN: Asegurar que booster_blue_balance sea robusto ---
        // Esta migración corrige un problema crítico donde el balance podía ser NULL.
        `DO $$
        BEGIN
            -- Solo se ejecuta si la columna existe para evitar errores.
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='booster_blue_balance') THEN
                -- 1. Corrige los datos existentes: Convierte cualquier NULL a 0.
                UPDATE users SET booster_blue_balance = 0.0000 WHERE booster_blue_balance IS NULL;

                -- 2. Establece un valor por defecto para todos los nuevos registros.
                ALTER TABLE users ALTER COLUMN booster_blue_balance SET DEFAULT 0.0000;

                -- 3. Impide que la columna vuelva a ser NULL en el futuro.
                ALTER TABLE users ALTER COLUMN booster_blue_balance SET NOT NULL;
            END IF;
        END $$;`,
        // MIGRACIÓN 32: Añadir columna user_id a transactions y actualizar registros existentes
        // Esta migración sigue buenas prácticas de bases de datos usando IDs en lugar de username
        `DO $$
        BEGIN
            -- Si la columna no existe, crearla
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='user_id') THEN
                ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
            END IF;
            -- Actualizar los registros existentes con el user_id correspondiente
            -- SOLO si la columna username existe (para bases de datos antiguas que aún la tienen)
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='username') THEN
                UPDATE transactions t
                SET user_id = u.id
                FROM users u
                WHERE t.username = u.username AND (t.user_id IS NULL OR t.user_id IS DISTINCT FROM u.id);
            END IF;
            -- Hacer la columna NOT NULL después de actualizar los datos
            -- Solo si no hay registros con user_id NULL
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='user_id' AND is_nullable='YES') THEN
                -- Verificar que no haya registros con user_id NULL antes de hacer NOT NULL
                IF NOT EXISTS (SELECT 1 FROM transactions WHERE user_id IS NULL) THEN
                    ALTER TABLE transactions ALTER COLUMN user_id SET NOT NULL;
                END IF;
            END IF;
            -- Crear índice para optimizar consultas por user_id
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_transactions_user_id') THEN
                CREATE INDEX idx_transactions_user_id ON transactions(user_id);
            END IF;
        END $$;`,
        // MIGRACIÓN 33: Eliminar columna username de transactions después de migrar a user_id
        // Esto completa la migración siguiendo buenas prácticas de bases de datos
        `DO $$
        BEGIN
            -- Solo eliminar la columna si existe y user_id ya está establecido
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='username')
               AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='user_id')
               AND NOT EXISTS (SELECT 1 FROM transactions WHERE user_id IS NULL) THEN
                ALTER TABLE transactions DROP COLUMN username;
            END IF;
        END $$;`,
        // MIGRACIÓN 35 (FIX): Asegurar columnas de tutores y menores (Ejecución forzada)
        `DO $$
             BEGIN
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tutor_user_id') THEN
                     ALTER TABLE users ADD COLUMN tutor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
                 END IF;
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_minor') THEN
                     ALTER TABLE users ADD COLUMN is_minor BOOLEAN DEFAULT FALSE;
                 END IF;
                 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='account_status') THEN
                     ALTER TABLE users ADD COLUMN account_status VARCHAR(50) DEFAULT 'active';
                 END IF;
             END $$;`
        ];

        for (const migration of migrations) {
            await client.query(migration);
        }

        console.log('Todas las migraciones se han aplicado correctamente.');
    } catch (error) {
        console.error('Error durante la migración de la base de datos:', error);
        throw error; // Propagar el error para detener el inicio del servidor si falla una migración
    }
}

async function runOneTimeDataMigrations(client) {
    const oldPlatformUsername = 'plataforma';
    const newPlatformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';

    // 1. Verificar si el usuario antiguo existe. Si no, no hay nada que hacer.
    const oldUserResult = await client.query('SELECT * FROM users WHERE username = $1', [oldPlatformUsername]);
    if (oldUserResult.rowCount === 0) {
        // console.log("MIGRATION: El usuario antiguo 'plataforma' no fue encontrado. No se necesita migración.");
        return;
    }
    const oldUser = oldUserResult.rows[0];
    console.log(`MIGRATION: Se encontró el usuario obsoleto '${oldPlatformUsername}'. Iniciando migración de datos a '${newPlatformUsername}'.`);

    // 2. Asegurarse de que el nuevo usuario exista.
    const newUserResult = await client.query('SELECT * FROM users WHERE username = $1', [newPlatformUsername]);
    if (newUserResult.rowCount === 0) {
        throw new Error(`MIGRATION FAILED: El nuevo usuario de plataforma '${newPlatformUsername}' no existe. La migración no puede continuar.`);
    }
    const newUser = newUserResult.rows[0];

        // 3. Iniciar la transacción para garantizar la atomicidad de la migración.
    try {
        await client.query('BEGIN');
        
        // FIX: Permitir actualización de saldos durante la migración (Llave Maestra)
        await client.query("SELECT set_config('app.allow_balance_update', 'true', true)");

        // 4. Sumar los saldos del usuario antiguo al nuevo.
        const newLiquidBlue = parseFloat(newUser.liquid_blue_balance) + parseFloat(oldUser.liquid_blue_balance);
        const newEscrowBlue = parseFloat(newUser.escrow_blue_balance) + parseFloat(oldUser.escrow_blue_balance);
        const newRed = parseFloat(newUser.red_balance) + parseFloat(oldUser.red_balance);

        await client.query(
            'UPDATE users SET liquid_blue_balance = $1, escrow_blue_balance = $2, red_balance = $3 WHERE id = $4',
            [newLiquidBlue, newEscrowBlue, newRed, newUser.id]
        );
        console.log(`MIGRATION: Saldos transferidos de '${oldPlatformUsername}' a '${newPlatformUsername}'.`);

        // 5. Reasignar todas las entidades relacionadas del usuario antiguo al nuevo.
        await client.query('UPDATE publications SET author_id = $1 WHERE author_id = $2', [newUser.id, oldUser.id]);
        console.log(`MIGRATION: Publicaciones reasignadas.`);
        
        await client.query('UPDATE publication_acceptances SET acceptor_username = $1 WHERE acceptor_username = $2', [newPlatformUsername, oldPlatformUsername]);
        console.log(`MIGRATION: Aceptaciones de publicaciones reasignadas.`);
        
        await client.query('UPDATE notifications SET recipient_username = $1 WHERE recipient_username = $2', [newPlatformUsername, oldPlatformUsername]);
        console.log(`MIGRATION: Notificaciones reasignadas.`);
        
        // Las transacciones ahora usan user_id, así que actualizamos por user_id
        await client.query('UPDATE transactions SET user_id = $1 WHERE user_id = $2', [newUser.id, oldUser.id]);
        console.log(`MIGRATION: Transacciones reasignadas.`);

        await client.query('UPDATE ratings SET rater_username = $1 WHERE rater_username = $2', [newPlatformUsername, oldPlatformUsername]);
        await client.query('UPDATE ratings SET ratee_username = $1 WHERE ratee_username = $2', [newPlatformUsername, oldPlatformUsername]);
        console.log(`MIGRATION: Calificaciones reasignadas.`);
        
        await client.query('UPDATE red_token_debts SET username = $1 WHERE username = $2', [newPlatformUsername, oldPlatformUsername]);
        console.log(`MIGRATION: Deudas RED reasignadas.`);

        await client.query('UPDATE blue_token_escrows SET username = $1 WHERE username = $2', [newPlatformUsername, oldPlatformUsername]);
        console.log(`MIGRATION: Depósitos BLUE reasignados.`);

        // 6. Eliminar el usuario antiguo.
        await client.query('DELETE FROM users WHERE id = $1', [oldUser.id]);
        console.log(`MIGRATION: El usuario obsoleto '${oldPlatformUsername}' ha sido eliminado.`);

        // 7. Finalizar la transacción.
        await client.query('COMMIT');
        console.log("MIGRATION: ¡Migración de datos completada exitosamente!");

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("MIGRATION FAILED: Ocurrió un error durante la migración de datos. Se revirtieron todos los cambios.", error);
        // Relanzamos el error para detener el arranque del servidor, ya que es un estado inconsistente.
        throw error;
    }
}

// NUEVO: Función de migración de datos para rellenar códigos de referido faltantes.
async function backfillReferralCodes(client) {
    try {
        // Verificar si la columna referral_code existe antes de intentar usarla
        const columnCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'referral_code'
        `);
        
        if (columnCheck.rowCount === 0) {
            console.log('DATA MIGRATION: La columna referral_code aún no existe, saltando relleno de códigos.');
            return;
        }

        const usersWithoutCode = await client.query(`
            SELECT id, username FROM users 
            WHERE referral_code IS NULL OR referral_code = ''
        `);

        for (const user of usersWithoutCode.rows) {
            const referralCode = await generateUniqueReferralCode(client, user.username);
            await client.query(
                'UPDATE users SET referral_code = $1 WHERE id = $2',
                [referralCode, user.id]
            );
        }
        console.log(`DATA MIGRATION: Se generaron códigos de referido para ${usersWithoutCode.rowCount} usuarios.`);
    } catch (error) {
        console.log('DATA MIGRATION: Falló el proceso de rellenar los códigos de referido.', error.message);
        // No lanzar el error para evitar que falle toda la inicialización
    }
}

// NUEVO: Script de limpieza para usuarios mal configurados
async function runOneTimeCleanup(client) {
    const badUsername = `'"Plataforma WintonCoin"'`; // Nombre exacto con comillas dobles
    const userResult = await client.query('SELECT id FROM users WHERE username = $1', [badUsername]);
    
    if (userResult.rowCount > 0) {
        console.log(`CLEANUP: Se encontró un usuario de plataforma mal configurado ('${badUsername}'). Eliminándolo...`);
        // ON DELETE CASCADE se encargará de las dependencias.
        await client.query('DELETE FROM users WHERE username = $1', [badUsername]);
        console.log(`CLEANUP: Usuario mal configurado eliminado.`);
    }
}


/**
 * Función principal para configurar y asegurar que todas las tablas de la DB existen.
 */
async function initializeDatabase() {
    const tableCreationQueries = [
        `CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            phone_number VARCHAR(50) UNIQUE,
            liquid_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
            escrow_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
            red_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
            average_rating REAL NOT NULL DEFAULT 0,
            ratings_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            verification_code VARCHAR(10),
            verification_code_expires_at TIMESTAMPTZ,
            referral_code VARCHAR(255) UNIQUE
        );`,
        `CREATE TABLE IF NOT EXISTS pending_verifications (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            phone_number VARCHAR(50) UNIQUE NOT NULL,
            verification_code VARCHAR(10) NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            referral_code VARCHAR(255)
        );`,
        `CREATE TABLE IF NOT EXISTS publications (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            blue_cost NUMERIC(19, 4) DEFAULT 0,
            status VARCHAR(50) DEFAULT 'open',
            author_id INT REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            is_sell_post BOOLEAN DEFAULT FALSE,
            available_slots INT DEFAULT 1,
            is_paused BOOLEAN DEFAULT FALSE,
            auto_approve BOOLEAN DEFAULT FALSE,
            category VARCHAR(50) NOT NULL DEFAULT 'request'
        );`,
        `CREATE TABLE IF NOT EXISTS hidden_publications (
            id SERIAL PRIMARY KEY,
            publication_id INT REFERENCES publications(id) ON DELETE CASCADE,
            hider_username VARCHAR(255) REFERENCES users(username) ON DELETE CASCADE,
            UNIQUE (publication_id, hider_username)
        );`,
        `CREATE TABLE IF NOT EXISTS publication_acceptances (
            id SERIAL PRIMARY KEY,
            publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
            acceptor_username VARCHAR(255) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending_approval',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            recipient_username VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
            blue_change NUMERIC(19, 4) NOT NULL DEFAULT 0,
            red_change NUMERIC(19, 4) NOT NULL DEFAULT 0,
                related_publication_id INTEGER,
            platform_fee_blue NUMERIC(19, 4) DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS ratings (
            id SERIAL PRIMARY KEY,
            publication_id INTEGER NOT NULL REFERENCES publications(id),
            rater_username VARCHAR(255) NOT NULL,
            ratee_username VARCHAR(255) NOT NULL,
            rating INTEGER NOT NULL,
            comment TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS red_token_debts (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            amount NUMERIC(19, 4) NOT NULL,
            due_at TIMESTAMPTZ NOT NULL,
            is_settled BOOLEAN NOT NULL DEFAULT FALSE,
            is_penalized BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS app_settings (
            setting_key VARCHAR(255) PRIMARY KEY,
            setting_value TEXT NOT NULL,
            description TEXT
        );`,
        `CREATE TABLE IF NOT EXISTS blue_token_escrows (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            amount NUMERIC(19, 4) NOT NULL,
            unlock_at TIMESTAMPTZ NOT NULL,
            is_released BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        // --- NUEVAS TABLAS PARA LA BILLETERA DE LA PLATAFORMA ---
        `CREATE TABLE IF NOT EXISTS platform_wallet (
            id INT PRIMARY KEY DEFAULT 1, -- Solo habrá una fila
            total_blue_commission_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000
        );`,
        `CREATE TABLE IF NOT EXISTS platform_commission_log (
            id SERIAL PRIMARY KEY,
            related_publication_id INT NOT NULL,
            related_user_transaction_id INT, -- El ID de la transacción de usuario que generó esta comisión
            commission_amount_blue NUMERIC(19, 4) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        // --- NUEVA TABLA PARA EL SISTEMA DE REFERIDOS ---
        `CREATE TABLE IF NOT EXISTS referral_log (
            id SERIAL PRIMARY KEY,
            referrer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
            referred_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        // --- NUEVAS TABLAS PARA EL SISTEMA DE IMPULSORES (BOOSTERS) ---
        `CREATE TABLE IF NOT EXISTS booster_level_settings (
            level INTEGER PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            min_blue_required NUMERIC(19, 4) NOT NULL,
            description TEXT
        );`,
        `CREATE TABLE IF NOT EXISTS booster_blue_ledger (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount NUMERIC(19, 4) NOT NULL,
            source_publication_id INTEGER REFERENCES publications(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS booster_payment_log (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount_paid NUMERIC(19, 4) NOT NULL,
            payment_month DATE NOT NULL,
            booster_level_at_payment INTEGER NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        // --- NUEVO: Tabla para el historial de transacciones del perfil de impulsor ---
        `CREATE TABLE IF NOT EXISTS booster_transactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL, -- ej: 'welcome_bonus', 'referral_bonus', 'publication_reward'
            amount NUMERIC(19, 4) NOT NULL,
            description TEXT,
            related_publication_id INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`
    ];
    
    const defaultSettings = [
        ['public_profiles_enabled', 'true', 'Permite que cualquiera vea perfiles de usuario.'],
        ['allow_new_registrations', 'true', 'Permite que nuevos usuarios se registren.'],
        ['allow_new_publications', 'true', 'Permite a los usuarios crear nuevas publicaciones.'],
        ['debt_system_enabled', 'true', 'Activa o desactiva el sistema de deuda de tokens RED.'],
        // --- Configuraciones de tiempo granulares ---
        ['debt_cycle_days', '30', 'Días para el ciclo de deuda RED.'],
        ['debt_cycle_hours', '0', 'Horas para el ciclo de deuda RED.'],
        ['debt_cycle_minutes', '0', 'Minutos para el ciclo de deuda RED.'],
        ['blue_escrow_days', '30', 'Días para el depósito de BLUE en escrow.'],
        ['blue_escrow_hours', '0', 'Horas para el depósito de BLUE en escrow.'],
        ['blue_escrow_minutes', '0', 'Minutos para el depósito de BLUE en escrow.'],
        // --- NUEVA CONFIGURACIÓN DE COMISIÓN ---
        ['platform_commission_percentage', '5', 'Porcentaje de comisión para la plataforma (ej: 5 para 5%).'],
        // --- NUEVAS CONFIGURACIONES DE REFERIDOS ---
        ['referral_system_enabled', 'true', 'Activa el sistema de referidos para nuevos registros.'],
        ['referral_reward_amount', '10', 'Cantidad de BLUE que ganan el referente y el referido al registrarse.'],
        ['referral_codes_expiry_date', '2026-04-30', 'Fecha de vigencia de los códigos de referido (formato: YYYY-MM-DD). Después de esta fecha, los códigos no otorgarán recompensas.'],
        // --- NUEVAS CONFIGURACIONES DE IMPULSORES ---
        ['booster_system_enabled', 'true', 'Activa el sistema de Impulsores y su lógica de pagos mensuales.'],
        ['welcome_bonus_enabled', 'true', 'Activa o desactiva el bono de bienvenida.'],
        ['welcome_bonus_amount', '25', 'Cantidad de BLUE que se otorga al registrarse sin código de referido.'],
        // --- NUEVAS CONFIGURACIONES DE FASES Y PUBLICACIONES ---
        ['pre_launch_mode_enabled', 'false', 'Activa el modo pre-lanzamiento (todas las ganancias a perfil impulsor).'],
        ['allow_request_publications', 'true', 'Permitir crear publicaciones de tipo "Solicitud".'],
        ['allow_sell_publications', 'true', 'Permitir crear publicaciones de tipo "Venta".'],
        ['allow_donation_publications', 'true', 'Permitir crear publicaciones de tipo "Donación".'],
        ['allow_quick_sale_publications', 'true', 'Permitir crear publicaciones de tipo "Venta Rápida".']
    ];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Paso 1: Aplicar todas las migraciones de esquema.
        // COMENTADO TEMPORALMENTE PARA EL LANZAMIENTO LIMPIO CON BASE DE DATOS RESETEADA
        // await applyMigrations(client);

        // --- NUEVO: Ejecutar limpieza antes que nada ---
        // await runOneTimeCleanup(client);

        // --- NUEVO: Ejecutar migraciones de datos de un solo uso ---
        // Esto se ejecuta después de las migraciones de esquema para asegurar que todas las tablas y columnas existen.
        // await runOneTimeDataMigrations(client);

        // --- NUEVO: Rellenar códigos de referido para usuarios existentes ---
        // await backfillReferralCodes(client);

        // Paso 2: Asegurar que todas las tablas base existen.
        for (const query of tableCreationQueries) {
            await client.query(query);
        }
        console.log("Todas las tablas han sido aseguradas en PostgreSQL.");

        // Paso 3: Asegurar que todas las configuraciones por defecto existen.
        for (const setting of defaultSettings) {
            await client.query(
                'INSERT INTO app_settings (setting_key, setting_value, description) VALUES ($1, $2, $3) ON CONFLICT (setting_key) DO NOTHING',
                setting
            );
        }
        console.log("Configuraciones por defecto aseguradas en 'app_settings'.");
        
        // --- NUEVO PASO 3.5: Asegurar niveles de impulsor por defecto ---
        
        // AUTO-MIGRACIÓN: Asegurar que la tabla 'booster_level_settings' tenga las columnas correctas
        try {
            await client.query(`
                DO $$ 
                BEGIN 
                    -- Si existe la columna vieja 'min_balance', renombrarla a 'min_blue_required'
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='booster_level_settings' AND column_name='min_balance') THEN
                        ALTER TABLE booster_level_settings RENAME COLUMN min_balance TO min_blue_required;
                    END IF;

                    -- Si existe la columna vieja 'benefits', renombrarla a 'description'
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='booster_level_settings' AND column_name='benefits') THEN
                        ALTER TABLE booster_level_settings RENAME COLUMN benefits TO description;
                    END IF;

                    -- Asegurar que existan las columnas finales (si la tabla estaba vacía o es nueva)
                    ALTER TABLE booster_level_settings ADD COLUMN IF NOT EXISTS min_blue_required NUMERIC(19, 4);
                    ALTER TABLE booster_level_settings ADD COLUMN IF NOT EXISTS description TEXT;
                    ALTER TABLE booster_level_settings ADD COLUMN IF NOT EXISTS name VARCHAR(50);
                END $$;
            `);
            console.log("Auto-migración de estructura 'booster_level_settings' completada.");
        } catch (err) {
            console.warn("Advertencia al migrar booster_level_settings:", err.message);
            // No lanzamos error fatal, intentamos seguir
        }

        const boosterLevels = [
            // Nivel, Nombre, BLUE Mínimo, Descripción
            [1, 'Impulsor Inicial', 0, 'El primer paso en tu viaje como impulsor.'],
            [2, 'Impulsor Bronce', 1001, 'Has demostrado un compromiso constante.'],
            [3, 'Impulsor Plata', 10001, 'Un pilar importante en la comunidad.'],
            [4, 'Impulsor Oro', 50001, 'Una fuerza motriz para el crecimiento de la plataforma.'],
            [5, 'Impulsor Platino', 100001, 'Reconocido como un Socio Estratégico clave.']
        ];

        for (const level of boosterLevels) {
            await client.query(
                'INSERT INTO booster_level_settings (level, name, min_blue_required, description) VALUES ($1, $2, $3, $4) ON CONFLICT (level) DO NOTHING',
                level
            );
        }
        console.log("Niveles de Impulsor por defecto asegurados.");

        // --- NUEVO PASO 4: Asegurar la existencia del usuario y la billetera de la plataforma ---
        const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
        const platformPassword = process.env.PLATFORM_USER_PASSWORD;

        if (!platformPassword) {
            console.warn(`
                *****************************************************************
                * ADVERTENCIA DE SEGURIDAD:                                     *
                * La contraseña para el usuario de la plataforma no está        *
                * configurada. Por favor, añade PLATFORM_USER_PASSWORD a tu     *
                * archivo .env con una contraseña segura y reinicia el servidor.*
                * Se usará una contraseña temporal insegura.                    *
                *****************************************************************
            `);
        }
        const securePassword = platformPassword || 'temporal_insegura_cambiar_urgente';

        const userExists = await client.query('SELECT id FROM users WHERE username = $1', [platformUsername]);
        if (userExists.rowCount === 0) {
            console.log(`Creando el usuario del sistema '${platformUsername}'...`);
            const passwordHash = await bcrypt.hash(securePassword, saltRounds);
            
            // Create a safe, unique identifier from the username to avoid conflicts.
            const uniqueIdentifier = platformUsername.toLowerCase().replace(/\s+/g, '-');
            const email = `platform-${uniqueIdentifier}@wintoncoin.io`; // Guarantees a unique email
            const phone = `000000-${uniqueIdentifier}`; // Guarantees a unique phone placeholder

            await client.query(
                'INSERT INTO users (username, password_hash, email, phone_number) VALUES ($1, $2, $3, $4)',
                [platformUsername, passwordHash, email, phone]
            );
            console.log(`Usuario del sistema '${platformUsername}' creado con email: ${email} y phone: ${phone}`);
        }

        const walletExists = await client.query('SELECT id FROM platform_wallet WHERE id = 1');
        if (walletExists.rowCount === 0) {
            await client.query('INSERT INTO platform_wallet(id, total_blue_commission_balance) VALUES (1, 0)');
            console.log("Billetera de la plataforma inicializada.");
        }

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error al inicializar las tablas:', e);
        throw e;
    } finally {
        client.release();
    }
}

// NUEVO: Helper profesional para generar códigos de referido únicos.
// Se asegura de no crear colisiones en la base de datos.
async function generateUniqueReferralCode(client, username) {
    let referralCode;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) { // Limitamos los intentos para evitar bucles infinitos
        // Genera un código de 8 caracteres alfanuméricos en mayúsculas.
        const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
        referralCode = `${username.substring(0, 4).toUpperCase()}-${randomPart}`;
        const result = await client.query('SELECT id FROM users WHERE referral_code = $1', [referralCode]);
        if (result.rowCount === 0) {
            isUnique = true;
        }
        attempts++;
    }

    if (!isUnique) {
        // Si después de 10 intentos no encontramos uno único (extremadamente improbable),
        // usamos un método de respaldo con el timestamp.
        referralCode = `${username.substring(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    }

    return referralCode;
}

// 5. Función principal asíncrona para iniciar el servidor
async function startServer() {
    try {
        await checkDbConnection();
        await initializeDatabase();
        console.log("Base de datos inicializada correctamente.");

        // --- AHORA DEFINIMOS LAS RUTAS ---

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

        try {
            // Check case-insensitive to avoid "User" vs "user" duplicates
            // Using PostgreSQL syntax with pool
            const result = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
            
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

    // Endpoint to check if a user has a pending verification (Recovery Logic)
    app.post('/api/auth/pending-status', async (req, res) => {
        const { phone, email } = req.body;

        if (!phone || !email) {
            return res.status(400).json({ isValid: false, message: 'Datos incompletos.' });
        }

        try {
            // Check if there is a pending verification matching BOTH phone and email
            const result = await pool.query(
                'SELECT * FROM pending_verifications WHERE phone_number = $1 AND email = $2',
                [phone, email]
            );

            if (result.rows.length > 0) {
                const pendingUser = result.rows[0];
                
                // Check expiration
                if (new Date() > new Date(pendingUser.expires_at)) {
                     // Expired - delete it to allow re-registration
                     await pool.query('DELETE FROM pending_verifications WHERE id = $1', [pendingUser.id]);
                     return res.json({ isValid: false, message: 'La solicitud ha expirado.' });
                }

                return res.json({ isValid: true, message: 'Verificación pendiente encontrada.' });
            } else {
                return res.json({ isValid: false, message: 'No se encontró ninguna verificación pendiente.' });
            }
        } catch (error) {
            console.error('Error checking pending status:', error);
            return res.status(500).json({ error: 'Database error' });
        }
    });

    // --- Registration Routes ---
    app.post('/api/register-request', async (req, res) => {
            const { username, email, password, phone, date_of_birth } = req.body;

    // --- Validación Estricta de Usuario para Prevenir XSS ---
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ message: "El nombre de usuario solo puede contener letras, números y guiones bajos (sin espacios ni caracteres especiales)." });
    }

    // --- 1. Validación de Entrada ---
    if (!username || !email || !password || !phone || !date_of_birth) {
                return res.status(400).json({ message: "Todos los campos son requeridos: usuario, contraseña, correo, teléfono y fecha de nacimiento." });
            }
            if (!/^\S+@\S+\.\S+$/.test(email)) {
                return res.status(400).json({ message: "El formato del correo electrónico no es válido." });
            }
            
            // Validar fecha de nacimiento y calcular edad
            const birthDate = new Date(date_of_birth);
            if (isNaN(birthDate.getTime())) {
                return res.status(400).json({ message: "La fecha de nacimiento no es válida." });
            }
            
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            
            // Validar edad mínima
            if (age < 13) {
                return res.status(400).json({ message: "Debes tener al menos 13 años para registrarte. Los menores de 13 años no pueden utilizar la plataforma." });
            }
            
            const isMinor = age >= 13 && age < 18;
            // Puedes añadir una validación más robusta para el número de teléfono aquí si lo deseas
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // --- 2. Verificar que el usuario, email o teléfono no estén ya en uso (en users o pending) ---
                const existingUserQuery = `
                    SELECT 1 FROM users WHERE username = $1 OR email = $2 OR phone_number = $3
                    UNION
                    SELECT 1 FROM pending_verifications WHERE username = $1 OR email = $2 OR phone_number = $3
                `;
                const existingUser = await client.query(existingUserQuery, [username, email, phone]);

                if (existingUser.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(409).json({ message: 'El nombre de usuario, email o teléfono ya está en uso o pendiente de verificación.' });
                }

                // --- 3. Generar Código de Verificación y Fecha de Expiración ---
                const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // Código de 6 dígitos
                const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos de validez

                // --- 4. Encriptar Contraseña y Guardar en Pendientes ---
                const passwordHash = await bcrypt.hash(password, saltRounds);
                await client.query(
                    `INSERT INTO pending_verifications (username, email, password_hash, phone_number, referral_code, verification_code, expires_at, date_of_birth, is_minor)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [username, email, passwordHash, phone, null, verificationCode, expiresAt, date_of_birth, isMinor]
                );

                // --- 5. Enviar el SMS usando Twilio ---
                try {
                    await twilioClient.messages.create({
                        body: `Tu código de verificación para WintonCoin es: ${verificationCode}`,
                        from: process.env.TWILIO_PHONE_NUMBER,
                        to: phone 
                    });
                } catch (twilioError) {
                    console.error("Error al enviar SMS con Twilio:", twilioError);
                    await client.query('ROLLBACK');
                    // No reveles detalles del error interno al usuario por seguridad
                    return res.status(500).json({ message: 'No se pudo enviar el código de verificación. Por favor, revisa el número de teléfono.' });
                }

                await client.query('COMMIT');
                res.status(200).json({ message: 'Se ha enviado un código de verificación a tu teléfono.' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error en la solicitud de registro:', error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            } finally {
                client.release();
            }
        });

        // =================================================================================
        // ==  NUEVO FLUJO DE REGISTRO CON VERIFICACIÓN POR SMS (FASE 2: VERIFICACIÓN)  ==
        // =================================================================================
        app.post('/api/register-verify', async (req, res) => {
            const { phone, verificationCode, referral_code } = req.body;

            if (!phone || !verificationCode) {
                return res.status(400).json({ message: "El teléfono y el código de verificación son requeridos." });
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // --- 1. Buscar la solicitud de registro pendiente y validarla ---
                // ESTANDARIZADO: Se usa la columna 'phone' para coincidir con la DB.
                const pendingResult = await client.query(
                    'SELECT * FROM pending_verifications WHERE phone_number = $1 AND verification_code = $2',
                    [phone, verificationCode]
                );

                if (pendingResult.rowCount === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Código de verificación incorrecto.' });
                }

                const pendingUser = pendingResult.rows[0];

                // Verificar si el código ha expirado
                if (new Date() > new Date(pendingUser.expires_at)) {
                    // Opcional: Limpiar códigos expirados
                    await client.query('DELETE FROM pending_verifications WHERE id = $1', [pendingUser.id]);
                    await client.query('COMMIT'); // Guardar la eliminación
                    return res.status(400).json({ message: 'El código de verificación ha expirado. Por favor, solicita uno nuevo.' });
                }

                // --- 2. Mover el usuario de "pendientes" a la tabla "users" ---
                const newReferralCode = await generateUniqueReferralCode(client, pendingUser.username);
                
                // Calcular edad y determinar si es menor
                const birthDate = pendingUser.date_of_birth ? new Date(pendingUser.date_of_birth) : null;
                let isMinor = false;
                if (birthDate) {
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                    }
                    isMinor = age >= 13 && age < 18;
                }
                
                // La lógica de referidos se aplicará a continuación
                const newUserSql = `INSERT INTO users (username, password_hash, email, phone_number, referral_code, date_of_birth, is_minor, account_status) 
                                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;
                const accountStatus = isMinor ? 'pending_tutor' : 'active';
                const newUserResult = await client.query(newUserSql, [
                    pendingUser.username,
                    pendingUser.password_hash,
                    pendingUser.email,
                    pendingUser.phone_number,
                    newReferralCode,
                    pendingUser.date_of_birth || null,
                    isMinor,
                    accountStatus
                ]);
                const newUser = newUserResult.rows[0];

                // --- 2.1 REGISTRO DE EVIDENCIA FORENSE (LEGAL AUDIT) ---
                // Capturar IP y User Agent para el registro legal
                const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
                const userAgent = req.headers['user-agent'] || 'Unknown';

                // Obtenemos la última versión activa de los documentos legales
                const docsQuery = `SELECT type, version, content_hash FROM legal_documents WHERE is_active = TRUE`;
                const docsResult = await client.query(docsQuery);
                
                if (docsResult.rows.length > 0) {
                    for (const doc of docsResult.rows) {
                        await client.query(
                            `INSERT INTO user_agreements_log 
                            (user_id, document_type, document_version, document_hash, ip_address, user_agent)
                            VALUES ($1, $2, $3, $4, $5, $6)`,
                            [newUser.id, doc.type, doc.version, doc.content_hash, ipAddress, userAgent]
                        );
                    }
                    console.log(`[AUDIT] Evidencia legal registrada para usuario ${newUser.username} (IP: ${ipAddress})`);
                } else {
                    console.warn(`[AUDIT WARNING] El usuario ${newUser.username} se registró pero NO se encontraron documentos legales activos para firmar.`);
                }

                // --- 3. [LÓGICA REINTEGRADA] Aplicar bonos de bienvenida y referidos ---
                const settingKeys = [
                    'referral_system_enabled', 'referral_reward_amount',
                    'welcome_bonus_enabled', 'welcome_bonus_amount',
                    'pre_launch_mode_enabled', 'referral_codes_expiry_date'
                ];
                const settingsResult = await client.query(`SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1::text[])`, [settingKeys]);
                const settings = settingsResult.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

                const preLaunchMode = settings.pre_launch_mode_enabled === 'true';
                const referralsEnabled = settings.referral_system_enabled === 'true';
                const welcomeBonusEnabled = settings.welcome_bonus_enabled === 'true';
                
                let referrer = null;
                let referralCodeExpired = false;
                if (referralsEnabled && referral_code) {
                    const referrerResult = await client.query('SELECT * FROM users WHERE referral_code = $1', [referral_code.trim().toUpperCase()]);
                    if (referrerResult.rowCount > 0) {
                        // Validar fecha de vigencia del programa de referidos
                        const expiryDateStr = settings.referral_codes_expiry_date;
                        if (expiryDateStr) {
                            const expiryDate = new Date(expiryDateStr);
                            // Validar que la fecha sea válida
                            if (!isNaN(expiryDate.getTime())) {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0); // Normalizar a medianoche para comparación de fechas
                                expiryDate.setHours(0, 0, 0, 0);
                                
                                if (today > expiryDate) {
                                    // Código expirado: no aplicar recompensa pero permitir registro
                                    referralCodeExpired = true;
                                } else {
                                    // Código válido y vigente
                                    referrer = referrerResult.rows[0];
                                }
                            } else {
                                // Fecha inválida: tratar como si no hubiera fecha (código válido)
                                console.warn(`Fecha de vigencia inválida: ${expiryDateStr}. Tratando como código válido.`);
                                referrer = referrerResult.rows[0];
                            }
                        } else {
                            // Si no hay fecha de expiración configurada, el código es válido
                            referrer = referrerResult.rows[0];
                        }
                    }
                }

                // Notificar si el código de referido estaba expirado
                if (referralCodeExpired && referral_code) {
                    const expiryDateStr = settings.referral_codes_expiry_date;
                    if (expiryDateStr) {
                        const expiryDate = new Date(expiryDateStr);
                        // Validar que la fecha sea válida antes de formatear
                        if (!isNaN(expiryDate.getTime())) {
                            const formattedDate = expiryDate.toLocaleDateString('es-ES', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            });
                            await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [
                                newUser.username, 
                                `El código de referido que usaste expiró el ${formattedDate}. Te has registrado exitosamente y recibirás el bono de bienvenida.`
                            ]);
                        } else {
                            // Si la fecha es inválida, enviar mensaje genérico
                            await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [
                                newUser.username, 
                                `El código de referido que usaste ha expirado. Te has registrado exitosamente y recibirás el bono de bienvenida.`
                            ]);
                        }
                    }
                }

                // Lógica de Recompensa por Referido (solo en modo pre-lanzamiento)
                if (preLaunchMode && referrer) {
                    const rewardAmount = parseFloat(settings.referral_reward_amount) || 0;
                    if (rewardAmount > 0) {
                        // Recompensa para el referente: Registra en booster_blue_ledger (cumple reglas económicas)
                        await client.query("SELECT record_booster_event($1, 'referral_reward', $2, NULL)", [referrer.id, rewardAmount]);
                        await client.query('UPDATE users SET is_booster = true WHERE id = $1', [referrer.id]);
                        
                        // VINCULACIÓN DE DATOS (FIX): Guardar la relación de referido en la tabla users y logs
                        await client.query('UPDATE users SET referred_by_id = $1 WHERE id = $2', [referrer.id, newUser.id]);
                        await client.query('INSERT INTO referral_log (referrer_user_id, referred_user_id) VALUES ($1, $2)', [referrer.id, newUser.id]);

                        await client.query(`INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, 'referral_bonus_sent', $2, $3)`, [referrer.id, rewardAmount, `Bono por referir a ${newUser.username}`]);
                        await client.query(`INSERT INTO transactions (user_id, type, description, blue_change) VALUES ($1, 'referral_bonus', $2, $3)`, [referrer.id, `Recompensa (perfil impulsor) por referir a ${newUser.username}`, rewardAmount]);
                        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [referrer.username, `¡Felicidades! Has ganado ${rewardAmount.toFixed(4)} BLUE en tu perfil de impulsor porque ${newUser.username} se registró con tu código.`]);
                        
                        // Recompensa para el nuevo usuario: Registra en booster_blue_ledger (cumple reglas económicas)
                        await client.query('SELECT record_booster_event($1, \'referral_reward\', $2, NULL)', [newUser.id, rewardAmount]);
                        await client.query('UPDATE users SET is_booster = true WHERE id = $1', [newUser.id]);
                        await client.query(`INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, 'referral_bonus_received', $2, $3)`, [newUser.id, rewardAmount, `Bono por usar el código de ${referrer.username}`]);
                        await client.query(`INSERT INTO transactions (user_id, type, description, blue_change) VALUES ($1, 'referral_bonus', $2, $3)`, [newUser.id, `Recompensa (perfil impulsor) por usar el código de ${referrer.username}`, rewardAmount]);
                        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [newUser.username, `¡Bienvenido! Por usar un código de referido, has ganado ${rewardAmount.toFixed(4)} BLUE en tu perfil de impulsor.`]);
                    }
                }
                // Lógica de Bono de Bienvenida (si no hay referente, solo en modo pre-lanzamiento)
                else if (preLaunchMode && welcomeBonusEnabled) {
                    const welcomeBonusAmount = parseFloat(settings.welcome_bonus_amount) || 0;
                    if (welcomeBonusAmount > 0) {
                        // Bono para el nuevo usuario: Registra en booster_blue_ledger (cumple reglas económicas)
                        await client.query('SELECT record_booster_event($1, \'welcome_bonus\', $2, NULL)', [newUser.id, welcomeBonusAmount]);
                        await client.query('UPDATE users SET is_booster = true WHERE id = $1', [newUser.id]);
                        await client.query(`INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, 'welcome_bonus', $2, $3)`, [newUser.id, welcomeBonusAmount, 'Bono de Bienvenida por registro']);
                        await client.query(`INSERT INTO transactions (user_id, type, description, blue_change) VALUES ($1, 'welcome_bonus', $2, $3)`, [newUser.id, 'Bono de bienvenida (perfil impulsor)', welcomeBonusAmount]);
                        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [newUser.username, `¡Bienvenido! Has recibido ${welcomeBonusAmount.toFixed(4)} BLUE en tu perfil de impulsor como bono de bienvenida.`]);
                    }
                }

                // --- 4. Limpiar la tabla de pendientes ---
                await client.query('DELETE FROM pending_verifications WHERE id = $1', [pendingUser.id]);

                // --- 5. [LÓGICA CORREGIDA] Generar token de sesión y devolver datos del usuario ---
                const token = jwt.sign(
                    { userId: newUser.id, username: newUser.username },
                    jwtSecret,
                    { expiresIn: '7d' } 
                );

                await client.query('COMMIT');

                res.status(200).json({
                    message: '¡Verificación completada con éxito!',
                    token: token,
                    username: newUser.username
                });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error durante la verificación del registro:', error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            } finally {
                client.release();
            }
        });

        // La antigua ruta de registro se eliminará y su lógica se moverá a la nueva ruta de verificación.
        // app.post('/register', async (req, res) => { ... });

        // Ruta de Inicio de Sesión
        app.post('/login', loginLimiter, async (req, res) => {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ message: "Usuario y contraseña son requeridos." });
            }

            try {
                const sql = `SELECT * FROM users WHERE username = $1`;
                const result = await pool.query(sql, [username]);
                const user = result.rows[0];
        
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado. Por favor, regístrese primero." });
        }

        // VERIFICACIÓN DE ESTADO DEL USUARIO
        if (user.status === 'suspended') {
            return res.status(403).json({ message: "Tu cuenta ha sido suspendida. Por favor, contacta a soporte." });
        }
        if (user.status === 'banned') {
            return res.status(403).json({ message: "Tu cuenta ha sido baneada permanentemente." });
        }

                if (!user.password_hash) {
                    console.error(`Intento de login para el usuario '${username}' falló: la cuenta está corrupta (no tiene password_hash).`);
                    return res.status(401).json({ message: 'Credenciales inválidas. La cuenta de usuario podría estar corrupta.' });
                }

                const match = await bcrypt.compare(password, user.password_hash);

            if (match) {
                // PASO 1: Generar un token de sesión seguro (JWT) al iniciar sesión.
                const token = jwt.sign(
                    { userId: user.id, username: user.username },
                    jwtSecret,
                    { expiresIn: '7d' } 
                );

                res.status(200).json({
                    message: "Inicio de sesión exitoso.",
                    token: token, // Se devuelve el token al cliente.
                    username: user.username
                });
            } else {
                res.status(401).json({ message: "Contraseña incorrecta." });
            }
        } catch (error) {
                console.error("Error en el inicio de sesión:", error);
            res.status(500).json({ message: "Error interno del servidor." });
        }
});

// NUEVO: Endpoint para verificar el estado de autenticación y verificación del usuario
app.get('/api/auth/status', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(200).json({ isAuthenticated: false });
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, user) => {
        if (err) {
            return res.status(200).json({ isAuthenticated: false });
        }

        try {
            const client = await pool.connect();
            try {
                const dbUser = await client.query('SELECT is_verified FROM users WHERE id = $1', [user.userId]);
                if (dbUser.rows.length === 0) {
                    return res.status(200).json({ isAuthenticated: false });
                }

                res.status(200).json({
                    isAuthenticated: true,
                    is_verified: dbUser.rows[0].is_verified,
                    username: user.username 
                });
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error al consultar el estado del usuario:', error);
            res.status(500).json({ message: 'Error interno del servidor' });
        }
    });
});

// NUEVO: Endpoint para reenviar el código de verificación
app.post('/api/auth/resend-code', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'El email es requerido.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Buscar al usuario en la tabla de verificaciones pendientes.
        const pendingUserResult = await client.query(
            'SELECT * FROM pending_verifications WHERE email = $1',
            [email]
        );

        // Si no se encuentra, enviamos una respuesta genérica para no revelar si el email existe.
        // Esto previene que alguien pueda usar esta función para descubrir qué emails están registrados.
        if (pendingUserResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(200).json({ message: 'Si tu email está pendiente de verificación, hemos enviado un nuevo código.' });
        }
        
        const pendingUser = pendingUserResult.rows[0];

        // 2. Generar un nuevo código de verificación y una nueva fecha de expiración.
        const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos de validez

        // 3. Actualizar el registro en la base de datos con los nuevos datos.
        await client.query(
            'UPDATE pending_verifications SET verification_code = $1, expires_at = $2 WHERE email = $3',
            [newVerificationCode, newExpiresAt, email]
        );

        // 4. Enviar el nuevo código por SMS a través de Twilio.
        try {
            await twilioClient.messages.create({
                body: `Tu nuevo código de verificación para WintonCoin es: ${newVerificationCode}`,
                from: twilioPhoneNumber,
                to: pendingUser.phone_number
            });
        } catch (twilioError) {
            console.error("Error al reenviar SMS con Twilio:", twilioError);
            await client.query('ROLLBACK');
            return res.status(500).json({ message: 'No se pudo enviar el nuevo código de verificación. Por favor, inténtalo de nuevo más tarde.' });
        }

        // 5. Si todo ha ido bien, confirmamos la transacción.
        await client.query('COMMIT');
        res.status(200).json({ message: 'Se ha enviado un nuevo código de verificación a tu teléfono.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en /api/auth/resend-code:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// NUEVO: Endpoint para agregar tutor a cuenta de menor
app.post('/api/minor/add-tutor', async (req, res) => {
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

// Ruta para crear una nueva Publicación
        app.post('/publish', async (req, res) => {
            const { 
                title, description, blueCost, blueSell, authorUsername, 
                availableSlots, autoApprove, publicationType,
                duration_days, duration_hours, duration_minutes,
                allowRepeatParticipation
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
                const settings = settingsResult.rows.reduce((acc, row) => ({...acc, [row.setting_key]: row.setting_value === 'true' }), {});

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
                        (title, description, blue_cost, is_sell_post, author_id, available_slots, auto_approve, category, expires_at, allow_repeat_participation)
                    VALUES
                        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
                    !!allowRepeatParticipation
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
                        allow_repeat_participation: !!allowRepeatParticipation,
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
            p.is_booster_task, p.is_sell_post, p.available_slots, p.expires_at, p.allow_repeat_participation,
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
                                'average_rating', participant_user.average_rating,
                                'ratings_count', participant_user.ratings_count
                            ))
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
                    -- NUEVO (UX + seguridad de negocio): Si la publicación NO es repetible y el usuario ya la completó/pagó,
                    -- entonces NO debe aparecer como "disponible" para ese usuario.
                    AND NOT (
                        COALESCE(p.allow_repeat_participation, FALSE) = FALSE
                        AND EXISTS (
                            SELECT 1
                            FROM publication_acceptances pa_done
                            WHERE pa_done.publication_id = p.id
                              AND pa_done.acceptor_username = $1
                              AND pa_done.status = 'confirmed_paid'
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
            (
                p.is_quick_sale = false AND (
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
app.post('/api/quick-sale', async (req, res) => {
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
app.post('/api/quick-sale/:id/pay', async (req, res) => {
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
        app.post('/publications/:id/accept', async (req, res) => {
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

                // --- NUEVO: Política profesional anti-repetición + Hard Reject (regla de negocio en backend) ---
                // Cargamos TODAS las participaciones históricas del usuario en esta publicación.
                const prev = await client.query(
                    `SELECT status FROM publication_acceptances WHERE publication_id = $1 AND acceptor_username = $2`,
                    [id, acceptorUsername]
                );

                if (prev.rows.length > 0) {
                    const statuses = prev.rows.map(r => r.status);

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

                    // Si NO se permite repetir y ya tuvo una finalización exitosa, bloquear.
                    const successfulStatuses = ['completed', 'confirmed_paid'];
                    const hasSuccessful = statuses.some(s => successfulStatuses.includes(s));
                    const allowRepeat = !!pub.allow_repeat_participation;
                    if (!allowRepeat && hasSuccessful) {
                        throw { status: 409, message: "Ya completaste esta tarea y no se permite repetirla." };
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
        app.post('/publications/:id/discard', async (req, res) => {
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
        app.post('/publications/:id/approve', async (req, res) => {
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
        app.post('/publications/:id/complete', async (req, res) => {
    const pubId = req.params.id;
            const { completerUsername } = req.body;

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. OBTENER CONFIGURACIONES DE LA PLATAFORMA (incluyendo comisiones)
                const settingsResult = await client.query(`
                    SELECT setting_key, setting_value 
                    FROM app_settings 
                    WHERE setting_key IN ('pre_launch_mode_enabled', 'debt_cycle_days', 'debt_cycle_hours', 'debt_cycle_minutes', 'blue_escrow_days', 'blue_escrow_hours', 'blue_escrow_minutes', 'platform_commission_percentage')
                `);
                const settings = settingsResult.rows.reduce((acc, row) => ({...acc, [row.setting_key]: row.setting_value }), {});
                const preLaunchMode = settings.pre_launch_mode_enabled === 'true';

                // 2. FETCH ACCEPTANCE DATA
                const acceptanceResult = await client.query(
                    `SELECT p.blue_cost, p.is_sell_post, p.title, p.category, u.username as author_username, pa.id as acceptance_id
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
        app.post('/publications/:id/confirm-payment', async (req, res) => {
    const pubId = req.params.id;
            const { confirmerUsername, workerUsername } = req.body; 
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

        // 1. OBTENER DATOS Y VERIFICAR PERMISOS
        // Se obtiene la publicación y se asegura que el `confirmerUsername` es el autor.
                const acceptanceResult = await client.query(
            `SELECT p.blue_cost, p.title, p.category, p.is_booster_task, u.username as author_username, pa.id as acceptance_id
                     FROM publications p
                     JOIN users u ON p.author_id = u.id
                     JOIN publication_acceptances pa ON p.id = pa.publication_id
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

                // VALIDACIÓN: Esta ruta es solo para 'requests'
                if (acceptance.category !== 'request') {
                    throw { status: 400, message: "Esta acción solo es válida para publicaciones de tipo 'solicitud'." };
                }
                
        // 3. OBTENER CONFIGURACIONES DE LA PLATAFORMA
        const settingsResult = await client.query(`
            SELECT setting_key, setting_value FROM app_settings 
            WHERE setting_key IN ('pre_launch_mode_enabled', 'debt_cycle_days', 'debt_cycle_hours', 'debt_cycle_minutes', 'blue_escrow_days', 'blue_escrow_hours', 'blue_escrow_minutes', 'platform_commission_percentage')
        `);
        const settings = settingsResult.rows.reduce((acc, row) => ({...acc, [row.setting_key]: row.setting_value }), {});
        const preLaunchMode = settings.pre_launch_mode_enabled === 'true';

        // 4. PROCESAR EL PAGO
        acceptance.workerUsername = workerUsername; // Añadir para la función helper
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
        if(client) client.release();
            }
});

// Ruta para obtener las notificaciones de un usuario
        app.get('/notifications/:username', async (req, res) => {
    const { username } = req.params;
            const sql = `SELECT * FROM notifications WHERE recipient_username = $1 AND is_read = FALSE ORDER BY created_at DESC`;
            try {
                const result = await pool.query(sql, [username]);
                res.status(200).json(result.rows);
            } catch(error) {
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
            } catch(error) {
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

        // Ruta para QUEMAR tokens (Ahora refactorizada para usar la función central)
        app.post('/users/burn', async (req, res) => {
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
                                    (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id) > 0
                                    AND
                                    (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id AND pa.status = 'confirmed_paid')
                                    =
                                    (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id)
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
                SELECT pa.acceptor_username, pa.status, u.average_rating, u.ratings_count
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
        app.post('/rate', async (req, res) => {
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
        app.delete('/publications/:id', async (req, res) => {
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
            } catch(err) {
                await client.query('ROLLBACK');
                console.error("Error al eliminar publicación:", err.message);
                res.status(err.status || 500).json({ message: err.message || "Error interno." });
            } finally {
                client.release();
            }
        });

        // Ruta para PAUSAR/REANUDAR una publicación (REFACTORIZADA PARA MÁXIMA SEGURIDAD)
        app.post('/publications/:id/toggle-pause', async (req, res) => {
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
        if(client) client.release();
            }
        });

        // Ruta para OCULTAR una publicación
        app.post('/publications/:id/hide', async (req, res) => {
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

        // Se agrupa por el ID del usuario, que es la clave primaria
        sql += ` GROUP BY u.id ORDER BY u.created_at DESC`;

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
                            SUM(liquid_blue_balance + escrow_blue_balance) AS users_total_blue, 
                            SUM(red_balance) AS total_red 
                        FROM users 
                        WHERE username != $1
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
                    filterCondition = `AND p.deleted_at IS NULL AND (p.expires_at IS NULL OR p.expires_at >= NOW())`;
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
                            (
                                (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id) > 0
                                AND
                                (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id AND pa.status = 'confirmed_paid')
                                =
                                (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id)
                            )
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
                                    (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id) > 0
                                    AND
                                    (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id AND pa.status = 'confirmed_paid')
                                    =
                                    (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id)
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

        // Endpoint para que un administrador cree una publicación como la plataforma
        app.post('/api/admin/platform/create-publication', verifyAdminToken, async (req, res) => {
            const { title, description, cost: costString, availableSlots: slotsString, isSellPost, autoApprove, isBoosterTask, allowRepeatParticipation } = req.body;
        
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
        
            try {
                const userResult = await pool.query(`SELECT id FROM users WHERE username = $1`, [platformUsername]);
                if (userResult.rowCount === 0) {
                    return res.status(500).json({ message: "Error crítico: El usuario de la plataforma no se encuentra." });
                }
                const authorId = userResult.rows[0].id;
        
                const sql = `
                    INSERT INTO publications (title, description, blue_cost, is_sell_post, author_id, available_slots, auto_approve, is_booster_task, allow_repeat_participation) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
                    RETURNING id
                `;
                const result = await pool.query(sql, [title, description, cost, !!isSellPost, authorId, slots, !!autoApprove, !!isBoosterTask, !!allowRepeatParticipation]);
                
                res.status(201).json({ message: "Publicación de la plataforma creada exitosamente.", publicationId: result.rows[0].id });
        
            } catch (error) {
                console.error("Error al crear publicación de la plataforma:", error);
            return res.status(500).json({ message: "Error interno del servidor." });
        }
        });

        // NUEVO: Endpoint para obtener las publicaciones de la plataforma con sus participantes para gestionarlas
        app.get('/api/admin/platform/publications-with-participants', verifyAdminToken, async (req, res) => {
            const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
            try {
                const query = `
                    SELECT
                        p.id, p.title, p.description, p.created_at, p.status, p.is_paused,
                        u.username as author_username,
                        (
                            SELECT json_agg(json_build_object(
                                'acceptor_username', pa.acceptor_username,
                                'status', pa.status,
                                'average_rating', u_participant.average_rating,
                                'ratings_count', u_participant.ratings_count,
                                'phone_number', p_user.phone_number -- AÑADIDO: Incluimos el teléfono
                            ))
                            FROM publication_acceptances pa
                            JOIN users u_participant ON pa.acceptor_username = u_participant.username
                            JOIN users p_user ON p_user.username = u_participant.username
                            WHERE pa.publication_id = p.id
                        ) as participants
                    FROM
                        publications p
                    JOIN
                        users u ON p.author_id = u.id
                    WHERE
                        u.username = $1
                    AND (
                        -- La publicación todavía tiene cupos disponibles
                        p.available_slots > 0
                        OR
                        -- O tiene participantes cuyo proceso no ha terminado (no han sido pagados)
                        EXISTS (
                            SELECT 1
                            FROM publication_acceptances pa_check
                            WHERE pa_check.publication_id = p.id AND pa_check.status != 'confirmed_paid'
                        )
                    )
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
                p.is_quick_sale, p.target_username, -- CAMPOS AÑADIDOS
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
                        'average_rating', p_user.average_rating,
                        'ratings_count', p_user.ratings_count,
                        'phone_number', p_user.phone_number -- AÑADIDO: Incluimos el teléfono
                    ))
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
                    rl.created_at
                FROM referral_log rl
                JOIN users u ON rl.referred_user_id = u.id
                WHERE rl.referrer_user_id = (SELECT id FROM users WHERE username = $1)
                ORDER BY rl.created_at DESC;
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

// --- ENDPOINT CORREGIDO Y PROFESIONAL PARA PERFIL DE IMPULSOR ---
// Devuelve tanto el perfil del usuario como su historial completo de transacciones de impulsor.
app.get('/api/users/:username/booster-profile', async (req, res) => {
    const { username } = req.params;
    if (!username) {
        return res.status(400).json({ message: 'Se requiere un nombre de usuario.' });
    }

    const client = await pool.connect();
    try {
        // 1. Obtener los datos principales del usuario.
        const userQuery = `
            SELECT id, username, is_booster, booster_level, booster_blue_balance 
            FROM users WHERE username = $1
        `;
        const userResult = await client.query(userQuery, [username]);

        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        
        const user = userResult.rows[0];

        // 2. Si no es un impulsor o su saldo es cero, no necesitamos buscar más.
        if (!user.is_booster || parseFloat(user.booster_blue_balance) <= 0) {
            return res.json({
                is_booster: false,
                message: 'Este usuario aún no forma parte del programa de impulsores.'
            });
        }

        // 3. Obtener el historial de transacciones del impulsor y los niveles en paralelo.
        const [transactionsResult, levelSettingsResult] = await Promise.all([
            client.query(
                'SELECT * FROM booster_transactions WHERE user_id = $1 ORDER BY created_at DESC', 
                [user.id]
            ),
            client.query('SELECT * FROM booster_level_settings ORDER BY level ASC')
        ]);

        const allLevels = levelSettingsResult.rows;
        const currentLevelInfo = allLevels.find(l => l.level === user.booster_level);
        const nextLevelInfo = allLevels.find(l => l.level === (user.booster_level || 0) + 1) || null;

        // 4. Enviar la respuesta completa con el perfil y el historial.
        res.json({
            is_booster: true,
            username: user.username,
            booster_level: user.booster_level,
            total_booster_blue: parseFloat(user.booster_blue_balance),
            current_level_info: currentLevelInfo,
            next_level_info: nextLevelInfo,
            transactions: transactionsResult.rows
        });

    } catch (error) {
        console.error(`Error al obtener el perfil de impulsor para ${username}:`, error);
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
    const { blue_cost, title, author_username: author, workerUsername } = acceptance;
    const cost = parseFloat(blue_cost);

    if (preLaunchMode) {
        // --- MODO PRE-LANZAMIENTO ---
        console.log(`MODO PRE-LANZAMIENTO: Acumulando ${cost} BLUE para ${workerUsername} en perfil de impulsor.`);
        const workerResult = await client.query('SELECT id FROM users WHERE username = $1', [workerUsername]);
        const workerId = workerResult.rows[0].id;
        await client.query('SELECT record_booster_event($1, \'task_reward\', $2, $3)', [workerId, cost, pubId]);
        await client.query('UPDATE users SET is_booster = TRUE WHERE id = $1', [workerId]);
        await updateUserBoosterLevel(client, workerId);
    } else {
        // --- MODO NORMAL ---
        const debtInterval = `${settings.debt_cycle_days || 30} days ${settings.debt_cycle_hours || 0} hours ${settings.debt_cycle_minutes || 0} minutes`;
        const escrowInterval = `${settings.blue_escrow_days || 1} days ${settings.blue_escrow_hours || 0} hours ${settings.blue_escrow_minutes || 0} minutes`;
        const commissionPercentage = parseFloat(settings.platform_commission_percentage || '0');
        const commissionAmount = cost * (commissionPercentage / 100);
        const redForAuthor = cost + commissionAmount;

        // Determinar quién es responsable de la deuda (tutor si es menor)
        const debtResponsible = await getDebtResponsibleUser(client, author);
        
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
        const workerResult = await client.query('SELECT id FROM users WHERE username = $1', [workerUsername]);
        if (!workerResult.rows.length) {
            throw new Error(`Usuario no encontrado: ${workerUsername}`);
        }
        const workerId = workerResult.rows[0].id;
        
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

//VERSIÓN DE DEPURACIÓN PROFESIONAL
/*app.get('/api/admin/users', verifyAdminToken, async (req, res) => {
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
                u.status,
                u.average_rating, 
                u.ratings_count, 
                u.created_at,
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
            sql += ` AND u.status = $${paramIndex++}`;
            params.push(status);
        }

        // Se agrupa por el ID del usuario, que es la clave primaria
        sql += ` GROUP BY u.id ORDER BY u.created_at DESC`;

        const result = await pool.query(sql, params);
        
        // Micrófono 2: Nos muestra los datos EXACTOS que la base de datos devuelve, antes de enviarlos.
        console.log('[DEBUG] Datos recibidos de la base de datos:', JSON.stringify(result.rows, null, 2));

        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error al obtener la lista de usuarios:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
}); */

// =================================================================================
// ==  PERFIL PÚBLICO DE IMPULSOR (BOOSTER)                                       ==
// =================================================================================
app.get('/api/users/:username/booster-profile', async (req, res) => {
    const { username } = req.params;
    const client = await pool.connect();
    try {
        const userResult = await client.query('SELECT id FROM users WHERE username = $1', [username]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        const userId = userResult.rows[0].id;

        console.log(`[DEBUG] Buscando saldo de impulsor para userId: ${userId}`); // LOG 1

        const boosterBalanceResult = await client.query(
            'SELECT SUM(amount) as total FROM booster_blue_ledger WHERE user_id = $1',
            [userId]
        );
    
        const totalBoosterBlue = parseFloat(boosterBalanceResult.rows[0].total) || 0;

        console.log(`[DEBUG] Saldo total de impulsor encontrado: ${totalBoosterBlue}`); // LOG 2

        // Lógica corregida: Un usuario es impulsor si su balance de impulsor es > 0
        if (totalBoosterBlue > 0) {
            const publicationsResult = await client.query(
                `SELECT p.id, p.title, p.description, p.blue_cost, p.status, p.created_at, u.username as author_username
                 FROM publications p
                 JOIN users u ON p.author_id = u.id
                 WHERE p.author_id = $1 AND p.status = 'open'
                 ORDER BY p.created_at DESC`,
                [userId]
            );

            res.json({
                is_booster: true,
                username: username,
                booster_blue_balance: totalBoosterBlue,
                publications: publicationsResult.rows
            });
        } else {
            res.json({
                is_booster: false,
                message: 'Este usuario aún no forma parte del programa de impulsores.'
            });
        }
    } catch (error) {
        console.error('Error al obtener el perfil de impulsor:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// =================================================================================
// ==  OBTENER PUBLICACIONES DE UN USUARIO (PARA SU PERFIL PÚBLICO)               ==