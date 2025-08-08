// 0. Cargar variables de entorno
require('dotenv').config();

// 1. Importar las librerías necesarias
const express = require('express');
const { Pool } = require('pg'); // Importamos el Pool de pg
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit'); // <-- SEGURIDAD: Importar rate-limit

// 2. Configuración inicial
const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10;

// Middleware de seguridad para limitar intentos de login
const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutos
	max: 20, // Bloquear después de 20 intentos
	standardHeaders: true, // Devuelve información del límite en los headers `RateLimit-*`
	legacyHeaders: false, // Deshabilita los headers `X-RateLimit-*`
    message: 'Demasiados intentos de inicio de sesión desde esta IP. Por favor, inténtelo de nuevo en 15 minutos.'
});


// 3. Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// 4. Conectar a la Base de Datos PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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
        
        await client.query('UPDATE transactions SET username = $1 WHERE username = $2', [newPlatformUsername, oldPlatformUsername]);
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
            liquid_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
            escrow_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
            red_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
            average_rating REAL NOT NULL DEFAULT 0,
            ratings_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
            username VARCHAR(255) NOT NULL,
            type VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
            blue_change NUMERIC(19, 4) NOT NULL DEFAULT 0,
            red_change NUMERIC(19, 4) NOT NULL DEFAULT 0,
                related_publication_id INTEGER,
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
        ['blue_escrow_days', '1', 'Días para el depósito de BLUE en escrow.'],
        ['blue_escrow_hours', '0', 'Horas para el depósito de BLUE en escrow.'],
        ['blue_escrow_minutes', '0', 'Minutos para el depósito de BLUE en escrow.'],
        // --- NUEVA CONFIGURACIÓN DE COMISIÓN ---
        ['platform_commission_percentage', '5', 'Porcentaje de comisión para la plataforma (ej: 5 para 5%).'],
        // --- NUEVAS CONFIGURACIONES DE REFERIDOS ---
        ['referral_system_enabled', 'true', 'Activa el sistema de referidos para nuevos registros.'],
        ['referral_reward_amount', '10', 'Cantidad de BLUE que ganan el referente y el referido al registrarse.'],
        // --- NUEVAS CONFIGURACIONES DE IMPULSORES ---
        ['booster_system_enabled', 'true', 'Activa el sistema de Impulsores y su lógica de pagos mensuales.'],
        ['welcome_bonus_enabled', 'true', 'Activa o desactiva el bono de bienvenida.'],
        ['welcome_bonus_amount', '25', 'Cantidad de BLUE que se otorga al registrarse sin código de referido.'],
        // --- NUEVAS CONFIGURACIONES DE FASES Y PUBLICACIONES ---
        ['pre_launch_mode_enabled', 'false', 'Activa el modo pre-lanzamiento (todas las ganancias a perfil impulsor).'],
        ['allow_request_publications', 'true', 'Permitir crear publicaciones de tipo "Solicitud".'],
        ['allow_sell_publications', 'true', 'Permitir crear publicaciones de tipo "Venta".'],
        ['allow_donation_publications', 'true', 'Permitir crear publicaciones de tipo "Donación".']
    ];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Paso 1: Aplicar todas las migraciones de esquema.
        await applyMigrations(client);

        // --- NUEVO: Ejecutar limpieza antes que nada ---
        await runOneTimeCleanup(client);

        // --- NUEVO: Ejecutar migraciones de datos de un solo uso ---
        // Esto se ejecuta después de las migraciones de esquema para asegurar que todas las tablas y columnas existen.
        await runOneTimeDataMigrations(client);

        // --- NUEVO: Rellenar códigos de referido para usuarios existentes ---
        await backfillReferralCodes(client);

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
                'INSERT INTO users (username, password_hash, email, phone) VALUES ($1, $2, $3, $4)',
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

        // Ruta de Registro de Usuario (AHORA CON LÓGICA DE REFERIDOS)
        app.post('/register', async (req, res) => {
            const { username, password, email, phone, referral_code } = req.body;
        
            // --- Validación de Entrada ---
            if (!username || !password || !email || !phone) {
                return res.status(400).json({ message: "Todos los campos son requeridos: usuario, contraseña, correo electrónico y teléfono." });
            }
            if (!/^\S+@\S+\.\S+$/.test(email)) {
                return res.status(400).json({ message: "El formato del correo electrónico no es válido." });
            }
        
            const client = await pool.connect();
            try {
                // --- INICIO DE LA TRANSACCIÓN ---
                // Esto asegura que todas las operaciones de la base de datos se completen o fallen juntas.
                await client.query('BEGIN');
        
                // 1. Obtener configuraciones relevantes del sistema
                const settingKeys = [
                    'referral_system_enabled', 'referral_reward_amount', 'platform_commission_percentage',
                    'blue_escrow_days', 'blue_escrow_hours', 'blue_escrow_minutes',
                    'welcome_bonus_enabled', 'welcome_bonus_amount',
                    'pre_launch_mode_enabled' // Añadido para verificar el modo
                ];
                const settingsResult = await client.query(`SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1::text[])`, [settingKeys]);
                const settings = settingsResult.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
                const referralsEnabled = settings.referral_system_enabled === 'true';
                const welcomeBonusEnabled = settings.welcome_bonus_enabled === 'true';
                const preLaunchMode = settings.pre_launch_mode_enabled === 'true';
        
                // 2. Validar el código de referido (si aplica)
                let referrer = null;
                if (referralsEnabled && referral_code) {
                    const referrerResult = await client.query('SELECT * FROM users WHERE referral_code = $1', [referral_code.trim().toUpperCase()]);
                    if (referrerResult.rowCount > 0) {
                        referrer = referrerResult.rows[0];
                    } else {
                        console.warn(`Código de referido "${referral_code}" no encontrado para el registro de "${username}".`);
                    }
                }
        
                // 3. Crear el nuevo usuario
                const passwordHash = await bcrypt.hash(password, saltRounds);
                const newReferralCode = await generateUniqueReferralCode(client, username);
                const newUserSql = `INSERT INTO users (username, password_hash, email, phone, referral_code, referrer_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
                const newUserResult = await client.query(newUserSql, [username, passwordHash, email, phone, newReferralCode, referrer ? referrer.id : null]);
                const newUser = newUserResult.rows[0];
        
                // 4. Lógica de Recompensa (si hubo un referente válido) - ¡SOLO EN PRE-LANZAMIENTO!
                if (preLaunchMode && referrer) {
                    const rewardAmount = parseFloat(settings.referral_reward_amount) || 0;
                    const commissionPercentage = parseFloat(settings.platform_commission_percentage) || 0;
                    const escrowInterval = `${settings.blue_escrow_days || 1} days ${settings.blue_escrow_hours || 0} hours ${settings.blue_escrow_minutes || 0} minutes`;
        
                    if (rewardAmount > 0) {
                        const totalBlueCreated = rewardAmount * 2;
                        const commissionAmount = totalBlueCreated * (commissionPercentage / 100);
        
                        // --- CORRECCIÓN: Las recompensas van al perfil de impulsor según las reglas económicas ---
                        // Recompensa para el referente (al perfil de impulsor)
                        await client.query(`INSERT INTO booster_blue_ledger (user_id, amount, source_publication_id) VALUES ($1, $2, NULL)`, [referrer.id, rewardAmount]);
                        await client.query(`INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, 'referral_bonus', $2, 'Recompensa por referido')`, [referrer.id, rewardAmount]);
                        await client.query(`UPDATE users SET is_booster = TRUE WHERE id = $1`, [referrer.id]);
                        await updateUserBoosterLevel(client, referrer.id);
                        
                        // Recompensa para el nuevo usuario (al perfil de impulsor)
                        await client.query(`INSERT INTO booster_blue_ledger (user_id, amount, source_publication_id) VALUES ($1, $2, NULL)`, [newUser.id, rewardAmount]);
                        await client.query(`INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, 'referral_bonus', $2, 'Recompensa por referido')`, [newUser.id, rewardAmount]);
                        await client.query(`UPDATE users SET is_booster = TRUE WHERE id = $1`, [newUser.id]);
                        await updateUserBoosterLevel(client, newUser.id);
        
                        // --- Ganancia y Equilibrio para la Plataforma (CORREGIDO: Comisión a la billetera de plataforma) ---
                        const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
                        const redForBalance = totalBlueCreated;
                        const redForCommission = commissionAmount;
                        const blueForCommission = commissionAmount;
        
                        // La plataforma recibe el RED para balancear, pero el BLUE de comisión va a la billetera.
                        await client.query(
                            'UPDATE users SET red_balance = red_balance + $1 WHERE username = $2',
                            [redForBalance + redForCommission, platformUsername]
                        );

                        await client.query(
                            `INSERT INTO platform_wallet (id, total_blue_commission_balance) VALUES (1, $1)
                             ON CONFLICT (id) DO UPDATE SET total_blue_commission_balance = platform_wallet.total_blue_commission_balance + $1`,
                            [blueForCommission]
                        );
        
                        // --- Registros de Transacciones para Auditoría (CORREGIDO: Mensajes actualizados para perfil de impulsor) ---
                        // Para el referente
                        await client.query(`INSERT INTO transactions (username, type, description, blue_change) VALUES ($1, 'referral_bonus', $2, $3)`, [referrer.username, `Recompensa (perfil de impulsor) por referir a ${newUser.username}`, rewardAmount]);
                        
                        // Para el nuevo usuario
                        const newUserTxResult = await client.query(`INSERT INTO transactions (username, type, description, blue_change) VALUES ($1, 'referral_bonus', $2, $3) RETURNING id`, [newUser.username, `Recompensa (perfil de impulsor) por usar el código de ${referrer.username}`, rewardAmount]);
                        const newUserTxId = newUserTxResult.rows[0].id;

                        // Para la plataforma
                        await client.query(`INSERT INTO transactions (username, type, description, blue_change, red_change) VALUES ($1, 'referral_commission', $2, $3, $4)`, [platformUsername, `Comisión y balance por referido ${newUser.username}`, blueForCommission, redForBalance + redForCommission]);
        
                        // --- Registro del Vínculo de Referido ---
                        await client.query(`INSERT INTO referral_log (referrer_user_id, referred_user_id) VALUES ($1, $2)`, [referrer.id, newUser.id]);
                        
                        // --- Registro de la Comisión (CORREGIDO: Ahora posible sin ID de publicación) ---
                        await client.query(
                            `INSERT INTO platform_commission_log (related_publication_id, related_user_transaction_id, commission_amount_blue) VALUES ($1, $2, $3)`,
                            [null, newUserTxId, blueForCommission]
                        );
        
                        // --- Notificaciones a los Usuarios (CORREGIDO: Mensajes actualizados para perfil de impulsor) ---
                        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [referrer.username, `¡Felicidades! Has ganado ${rewardAmount.toFixed(4)} BLUE en tu perfil de impulsor porque ${newUser.username} se registró con tu código.`]);
                        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [newUser.username, `¡Bienvenido! Por usar un código de referido, has ganado ${rewardAmount.toFixed(4)} BLUE en tu perfil de impulsor.`]);
                    }
                }
        
                // --- Bono de Bienvenida (CORREGIDO: Ya cumple con las reglas económicas) - ¡SOLO EN PRE-LANZAMIENTO! ---
                if (preLaunchMode && welcomeBonusEnabled && !referrer) {
                    const welcomeBonusAmount = parseFloat(settings.welcome_bonus_amount) || 0;
                    if (welcomeBonusAmount > 0) {
                        await client.query(`INSERT INTO booster_blue_ledger (user_id, amount, source_publication_id) VALUES ($1, $2, NULL)`, [newUser.id, welcomeBonusAmount]);
                        await client.query(`INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, 'welcome_bonus', $2, 'Bono de bienvenida')`, [newUser.id, welcomeBonusAmount]);
                        await client.query(`UPDATE users SET is_booster = TRUE WHERE id = $1`, [newUser.id]);
                        await updateUserBoosterLevel(client, newUser.id);
                        
                        // Notificación para el bono de bienvenida
                        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [newUser.username, `¡Bienvenido! Has recibido ${welcomeBonusAmount.toFixed(4)} BLUE en tu perfil de impulsor como bono de bienvenida.`]);
                    }
                }
        
                // --- FIN DE LA TRANSACCIÓN ---
await client.query('COMMIT');

// SEGURIDAD: Nunca devolver el hash de la contraseña en la respuesta.
const userResponse = newUser;
delete userResponse.password_hash;

res.status(201).json({ 
    message: `Usuario '${userResponse.username}' registrado con éxito.`,
    user: userResponse
});
        
    } catch (error) {
                // Si algo falla, revertimos todos los cambios.
                await client.query('ROLLBACK');
                console.error('Error al registrar usuario:', error);
                
                if (error.code === '23505') { // 'unique_violation'
                    if (error.constraint === 'users_username_key') {
                        return res.status(409).json({ message: 'El nombre de usuario ya está registrado.' });
                    }
                    if (error.constraint === 'users_email_key') {
                        return res.status(409).json({ message: 'El correo electrónico ya está registrado.' });
                    }
                    if (error.constraint === 'users_phone_key') {
                        return res.status(409).json({ message: 'El número de teléfono ya está registrado.' });
                    }
                    if (error.constraint === 'referral_log_referred_user_id_key') {
                        // Este es un caso de borde muy raro pero bueno manejarlo
                        return res.status(409).json({ message: 'Este usuario ya ha sido referido.' });
                    }
                    return res.status(409).json({ message: 'Un valor que ingresaste ya está en uso.' });
                }
                res.status(500).json({ message: 'Error interno del servidor al intentar registrar el usuario.' });
            } finally {
                client.release();
    }
});

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

                if (!user.password_hash) {
                    console.error(`Intento de login para el usuario '${username}' falló: la cuenta está corrupta (no tiene password_hash).`);
                    return res.status(401).json({ message: 'Credenciales inválidas. La cuenta de usuario podría estar corrupta.' });
                }

                const match = await bcrypt.compare(password, user.password_hash);

            if (match) {
                res.status(200).json({
                    message: "Inicio de sesión exitoso.",
                    username: user.username,
                        blue_balance: user.liquid_blue_balance,
                        escrow_blue_balance: user.escrow_blue_balance,
                    red_balance: user.red_balance
                });
            } else {
                res.status(401).json({ message: "Contraseña incorrecta." });
            }
        } catch (error) {
                console.error("Error en el inicio de sesión:", error);
            res.status(500).json({ message: "Error interno del servidor." });
        }
});

// Ruta para crear una nueva Publicación
        app.post('/publish', async (req, res) => {
            const { 
                title, description, blueCost, blueSell, authorUsername, 
                availableSlots, autoApprove, publicationType,
                duration_days, duration_hours, duration_minutes 
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
        
                const userResult = await client.query(`SELECT id FROM users WHERE username = $1`, [authorUsername]);
                if (userResult.rowCount === 0) {
                    throw { status: 404, message: "El autor de la publicación no existe." };
                }
                const authorId = userResult.rows[0].id;

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

                const sql = `INSERT INTO publications (title, description, blue_cost, is_sell_post, author_id, available_slots, auto_approve, category, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`;
                const result = await pool.query(sql, [title, description, cost, isSellPost, authorId, slots, !!autoApprove, publicationType, expiresAt]);
                
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

    // FIX FUNCIONAL: Añadido p.expires_at a la lista de campos
    const sql = `
        SELECT
            p.id, p.title, p.description, p.blue_cost, p.created_at, p.status, p.category,
            p.is_booster_task, p.is_sell_post, p.available_slots, p.expires_at,
            u.username as author_username,
            u.average_rating as author_average_rating,
            u.ratings_count as author_ratings_count,
            (
                SELECT pa.status 
                FROM publication_acceptances pa 
                WHERE pa.publication_id = p.id AND pa.acceptor_username = $1
                ORDER BY
                    CASE pa.status
                        WHEN 'approved' THEN 1
                        WHEN 'completed' THEN 2
                        WHEN 'pending_approval' THEN 3
                        WHEN 'confirmed_paid' THEN 4
                        ELSE 5
                    END
                LIMIT 1
            ) as user_acceptance_status,
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
    const { title, amount, authorUsername, targetUsername } = req.body;

    // 1. Validaciones de entrada básicas
    if (!title || !amount || !authorUsername) {
        return res.status(400).json({ message: "Faltan datos requeridos: título, monto y autor son obligatorios." });
    }

    const cost = parseFloat(String(amount).replace(',', '.'));
    if (isNaN(cost) || cost <= 0) {
        return res.status(400).json({ message: "El monto debe ser un número positivo." });
    }
    
    // Sanitización simple del título para prevenir XSS básico.
    const sanitizedTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const client = await pool.connect();
    try {
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

        // 2. Ejecutar la transferencia de fondos (similar a un pago de 'sell')
        const amount = publication.blue_cost;
        const sellerUsername = publication.author_username;

        // Verificar fondos del comprador
        const buyerBalanceResult = await client.query('SELECT liquid_blue_balance FROM users WHERE username = $1', [buyerUsername]);
        if (buyerBalanceResult.rowCount === 0) {
             throw { status: 404, message: 'El usuario comprador no existe.' };
        }
        const buyerBalance = buyerBalanceResult.rows[0].liquid_blue_balance;
        if (buyerBalance < amount) {
            throw { status: 402, message: 'Fondos insuficientes para realizar la compra.' };
        }

        // Deducir del comprador y añadir al vendedor
        await client.query('UPDATE users SET liquid_blue_balance = liquid_blue_balance - $1 WHERE username = $2', [amount, buyerUsername]);
        await client.query('UPDATE users SET liquid_blue_balance = liquid_blue_balance + $1 WHERE username = $2', [amount, sellerUsername]);

        // 3. Actualizar el estado de la publicación a 'completed'
        await client.query(`UPDATE publications SET status = 'completed', available_slots = 0 WHERE id = $1`, [id]);
        
        // 4. Crear notificación para el vendedor
        const notificationMessage = `¡Venta Rápida completada! ${buyerUsername} ha pagado por tu publicación: "${publication.title}".`;
        await client.query(`
            INSERT INTO notifications (recipient_username, message, type, related_publication_id) 
            VALUES ($1, $2, 'quick_sale_paid', $3)`, 
            [sellerUsername, notificationMessage, id]
        );
        
        await client.query('COMMIT');

        res.status(200).json({ message: "Pago realizado con éxito." });

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
                
                const pubResult = await client.query(`SELECT p.*, u.username as author_username FROM publications p JOIN users u ON p.author_id = u.id WHERE p.id = $1 FOR UPDATE`, [id]);
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

                await client.query(`UPDATE publications SET available_slots = available_slots - 1 WHERE id = $1`, [id]);
                
                // --- LÓGICA DE AUTO-APROBACIÓN ---
                if (pub.auto_approve) {
                    // Si la auto-aprobación está activa, se aprueba directamente.
                    await client.query(`INSERT INTO publication_acceptances (publication_id, acceptor_username, status) VALUES ($1, $2, 'approved')`, [id, acceptorUsername]);
                    const message = `¡Has sido aprobado automáticamente para la tarea "${pub.title}"!`;
                    await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [acceptorUsername, message]);
                    await client.query('COMMIT');
                    res.status(200).json({ message: "¡Aceptaste y fuiste aprobado automáticamente!" });
                } else {
                    // Comportamiento normal: pendiente de aprobación
                    await client.query(`INSERT INTO publication_acceptances (publication_id, acceptor_username, status) VALUES ($1, $2, 'pending_approval')`, [id, acceptorUsername]);
                    const message = `El usuario ${acceptorUsername} quiere realizar la tarea "${pub.title}".`;
                    await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [pub.author_username, message]);
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
        
                const pubResult = await client.query(`SELECT p.*, u.username as author_username FROM publications p JOIN users u ON p.author_id = u.id WHERE p.id = $1 AND u.username = $2 FOR UPDATE`, [id, discarderUsername]);
                const pub = pubResult.rows[0];
                if (!pub) {
                    throw { status: 403, message: "No tienes permiso para gestionar esta tarea." };
                }
        
                const deleteResult = await client.query(
                    `DELETE FROM publication_acceptances WHERE publication_id = $1 AND acceptor_username = $2 AND status = 'pending_approval' RETURNING *`,
                    [id, userToDiscard]
                );
                
                if (deleteResult.rowCount === 0) {
                    throw { status: 404, message: "No se encontró una solicitud pendiente para este usuario." };
                }
        
                await client.query(`UPDATE publications SET available_slots = available_slots + 1 WHERE id = $1`, [id]);
        
                const message = `Tu solicitud para la tarea "${pub.title}" no fue seleccionada. ¡Gracias por tu interés!`;
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [userToDiscard, message]);
        
                await client.query('COMMIT');
                res.status(200).json({ message: `Has descartado la solicitud de ${userToDiscard}.` });
        
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

                const pubResult = await client.query(`SELECT p.*, u.username as author_username FROM publications p JOIN users u ON p.author_id = u.id WHERE p.id = $1 AND u.username = $2`, [id, approverUsername]);
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

                // 1. FETCH SETTINGS FIRST to check preLaunchMode
                const settingsResult = await client.query(`
                    SELECT setting_key, setting_value 
                    FROM app_settings 
                    WHERE setting_key = 'pre_launch_mode_enabled'
                `);
                const preLaunchMode = settingsResult.rows[0]?.setting_value === 'true';

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
                        result = await processDirectPaymentCompletion(client, acceptance, pubId, preLaunchMode, {}); // settings no son necesarios aquí si ya están dentro
                        break;
                    case 'request':
                        result = await processRequestCompletion(client, acceptance);
                        break;
                    default:
                        throw { status: 400, message: "Categoría de publicación no válida." };
                }
                
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
            `SELECT p.blue_cost, p.title, p.category, u.username as author_username, pa.id as acceptance_id
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
                const authoredSql = `SELECT p.*, u.username as author_username FROM publications p JOIN users u ON p.author_id = u.id WHERE u.username = $1 ORDER BY p.created_at DESC`;

                const completedSql = `
                    SELECT p.*, u.username as author_username, pa.status as user_acceptance_status
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
            const sql = `SELECT * FROM transactions WHERE username = $1 ORDER BY created_at DESC`;
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

                const pubResult = await client.query(`SELECT p.*, u.username as author_username FROM publications p JOIN users u ON p.author_id = u.id WHERE p.id = $1 FOR UPDATE`, [id]);
                const pub = pubResult.rows[0];

                if (!pub) throw { status: 404, message: "La publicación no existe." };
                if (pub.author_username !== deleterUsername) throw { status: 403, message: "No tienes permiso para eliminar esto." };

                const participantsCheck = await client.query(
                    `SELECT 1 FROM publication_acceptances WHERE publication_id = $1 AND status IN ('approved', 'completed') LIMIT 1`,
                    [id]
                );
                if (participantsCheck.rowCount > 0) {
                    throw { status: 403, message: "No se puede eliminar una tarea con participantes activos." };
                }
                
                await client.query(`DELETE FROM publications WHERE id = $1`, [id]);
                
                await client.query('COMMIT');
                res.status(200).json({ message: "Publicación eliminada correctamente." });
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
                res.json({ token: accessToken });
            } else {
                res.status(401).json({ message: "Contraseña incorrecta." });
            }
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
                res.status(200).json({ message: `Configuración '${key}' actualizada.`, setting: result.rows[0] });
            } catch (error) {
                console.error("Error al actualizar la configuración:", error);
                res.status(500).json({ message: "Error interno del servidor." });
            }
        });
        
        app.get('/api/admin/users', verifyAdminToken, async (req, res) => {
            const { search = '' } = req.query;
            try {
                const sql = `
                    SELECT id, username, liquid_blue_balance, escrow_blue_balance, red_balance, 
                           average_rating, ratings_count, created_at
                    FROM users WHERE username ILIKE $1 ORDER BY created_at DESC
                `;
                const result = await pool.query(sql, [`%${search}%`]);
                res.status(200).json(result.rows);
            } catch (error) {
                console.error("Error al obtener la lista de usuarios:", error);
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
                        t.username as user_who_paid
                    FROM platform_commission_log pcl
                    LEFT JOIN publications p ON pcl.related_publication_id = p.id
                    LEFT JOIN transactions t ON pcl.related_user_transaction_id = t.id
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
            try {
                const query = `
                    SELECT
                        p.id, p.title, p.description, p.blue_cost, p.status, p.created_at, p.is_paused, p.is_sell_post, p.available_slots, p.category,
                        u.username AS author_username,
                        (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id) AS participants_count,
                        (SELECT COUNT(*) FROM publication_acceptances pa WHERE pa.publication_id = p.id AND pa.status = 'confirmed_paid') AS completed_count
                    FROM publications p
                    JOIN users u ON p.author_id = u.id
                    WHERE p.title ILIKE $1 OR u.username ILIKE $1
                    ORDER BY p.created_at DESC
                `;
                const result = await pool.query(query, [`%${searchTerm}%`]);
                res.json(result.rows);
            } catch (error) {
                console.error('Error fetching all publications for admin:', error);
                res.status(500).json({ message: 'Error interno del servidor.' });
            }
        });

        // Endpoint para que un administrador elimine una publicación
        app.delete('/api/admin/publications/:id', verifyAdminToken, async (req, res) => {
            const { id } = req.params;
            try {
                const deleteResult = await pool.query('DELETE FROM publications WHERE id = $1', [id]);

                if (deleteResult.rowCount === 0) {
                    return res.status(404).json({ message: 'Publicación no encontrada.' });
                }
                
                res.json({ success: true, message: 'Publicación eliminada correctamente.' });
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
            const { title, description, cost: costString, availableSlots: slotsString, isSellPost, autoApprove, isBoosterTask } = req.body;
        
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
        
                const sql = `INSERT INTO publications (title, description, blue_cost, is_sell_post, author_id, available_slots, auto_approve, is_booster_task) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`;
                const result = await pool.query(sql, [title, description, cost, !!isSellPost, authorId, slots, !!autoApprove, !!isBoosterTask]);
                
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
                                'ratings_count', u_participant.ratings_count
                            ))
                            FROM publication_acceptances pa
                            JOIN users u_participant ON pa.acceptor_username = u_participant.username
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
                `SELECT liquid_blue_balance, escrow_blue_balance, red_balance FROM users WHERE username = $1 FOR UPDATE`,
                [username]
            );

            if (userResult.rowCount === 0) {
                return { success: false, message: 'Usuario no encontrado.', actualAmountBurned: 0 };
            }

            const user = userResult.rows[0];
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
                    // CORRECCIÓN: Si la deuda se paga por completo, la eliminamos de la tabla.
                    // La lógica anterior intentaba poner el monto a 0, lo que violaba la restricción de la DB.
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

            // 5. Actualizar los saldos principales del usuario
            await client.query(
                `UPDATE users 
                 SET liquid_blue_balance = liquid_blue_balance - $1,
                     escrow_blue_balance = escrow_blue_balance - $2, 
                     red_balance = red_balance - $3 
                 WHERE username = $4`,
                [burnedFromLiquid, burnedFromEscrow, actualAmountToBurn, username]
            );

            // 6. Registrar la transacción
            const burnDesc = `Quemaste ${actualAmountToBurn.toFixed(4)} tokens. Se usaron ${burnedFromLiquid.toFixed(4)} BLUE (disponible) y ${burnedFromEscrow.toFixed(4)} BLUE (pendiente).`;
            await client.query(
                `INSERT INTO transactions (username, type, description, blue_change, red_change) VALUES ($1, 'burn', $2, $3, $4)`,
                [username, burnDesc, -actualAmountToBurn, -actualAmountToBurn]
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
                        username, 
                        SUM(amount) as total_to_release,
                        array_agg(id) as escrow_ids
                    FROM blue_token_escrows
                    WHERE unlock_at <= NOW() AND is_released = FALSE
                    GROUP BY username
                `);

                if (overdueEscrowsResult.rowCount === 0) {
                    console.log('TOKEN RELEASER: No se encontraron tokens para liberar.');
                    await client.query('ROLLBACK'); // No need to keep transaction open
                    return;
                }
                
                console.log(`TOKEN RELEASER: Se encontraron depósitos para liberar para ${overdueEscrowsResult.rowCount} usuario(s).`);

                // 2. Procesar cada usuario con depósitos a liberar
                for (const userEscrow of overdueEscrowsResult.rows) {
                    const { username, total_to_release, escrow_ids } = userEscrow;
                    const amountToRelease = parseFloat(total_to_release);

                    if (amountToRelease <= 0) continue;

                    console.log(`TOKEN RELEASER: Liberando ${amountToRelease.toFixed(4)} BLUE para el usuario ${username}.`);

                    // 3. Actualizar saldos del usuario
                    await client.query(
                        `UPDATE users 
                         SET liquid_blue_balance = liquid_blue_balance + $1,
                             escrow_blue_balance = escrow_blue_balance - $1
                         WHERE username = $2`,
                        [amountToRelease, username]
                    );

                    // 4. Marcar los depósitos como liberados
                    await client.query(
                        `UPDATE blue_token_escrows SET is_released = TRUE WHERE id = ANY($1::int[])`,
                        [escrow_ids]
                    );
                    
                    // 5. Crear una transacción para el historial
                    const releaseDesc = `Se han liberado ${amountToRelease.toFixed(4)} BLUE que estaban en depósito.`;
                    await client.query(
                        `INSERT INTO transactions (username, type, description, blue_change, red_change) VALUES ($1, 'escrow_release', $2, $3, 0)`,
                        [username, releaseDesc, amountToRelease]
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

function verifyAdminToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.ADMIN_SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
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
                        'ratings_count', p_user.ratings_count
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

app.get('/api/admin/users', verifyAdminToken, async (req, res) => {
    const { search = '' } = req.query;
    try {
        const sql = `
            SELECT id, username, liquid_blue_balance, escrow_blue_balance, red_balance, 
                   average_rating, ratings_count, created_at
            FROM users WHERE username ILIKE $1 ORDER BY created_at DESC
        `;
        const result = await pool.query(sql, [`%${search}%`]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error al obtener la lista de usuarios:", error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
}); 

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

// NUEVO ENDPOINT: Obtener el perfil de impulsor de un usuario
app.get('/api/users/:username/booster-profile', async (req, res) => {
    const { username } = req.params;
    if (!username) {
        return res.status(400).json({ message: 'Se requiere un nombre de usuario.' });
    }

    const client = await pool.connect();
    try {
        const userQuery = `
            SELECT id, is_booster, booster_level 
            FROM users WHERE username = $1
        `;
        const userResult = await client.query(userQuery, [username]);

        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        const user = userResult.rows[0];

        // Si el usuario no es impulsor, devolvemos una respuesta simple
        if (!user.is_booster) {
            return res.json({
                is_booster: false,
                message: 'Este usuario aún no forma parte del programa de impulsores.'
            });
        }

        const a_user_id = user.id;

        // Consultas para obtener todos los datos en paralelo
        const [
            boosterBlueResult,
            levelSettingsResult,
            ledgerResult
        ] = await Promise.all([
            // Total de BLUE de impulsor
            client.query('SELECT SUM(amount) as total FROM booster_blue_ledger WHERE user_id = $1', [a_user_id]),
            // Todos los niveles definidos
            client.query('SELECT * FROM booster_level_settings ORDER BY level ASC'),
            // Historial de ganancias
            client.query(`
                SELECT bl.amount, bl.created_at, p.title as publication_title
                FROM booster_blue_ledger bl
                LEFT JOIN publications p ON bl.source_publication_id = p.id
                WHERE bl.user_id = $1
                ORDER BY bl.created_at DESC
            `, [a_user_id])
        ]);

        const totalBoosterBlue = parseFloat(boosterBlueResult.rows[0].total) || 0;
        const allLevels = levelSettingsResult.rows;
        
        const currentLevelInfo = allLevels.find(l => l.level === user.booster_level) || null;
        const nextLevelInfo = allLevels.find(l => l.level === user.booster_level + 1) || null;

        res.json({
            is_booster: true,
            username: username,
            booster_level: user.booster_level,
            total_booster_blue: totalBoosterBlue,
            current_level_info: currentLevelInfo,
            next_level_info: nextLevelInfo,
            booster_ledger: ledgerResult.rows.map(entry => ({
                ...entry,
                publication_title: entry.publication_title || '(Tarea original eliminada)'
            }))
        });

    } catch (error) {
        console.error(`Error fetching booster profile for ${username}:`, error);
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
                    // Pagar al saldo de escrow del usuario
                    await client.query('UPDATE users SET escrow_blue_balance = escrow_blue_balance + $1 WHERE id = $2', [amountToPay, booster.id]);
                    
                    // Registrar la transacción de pago
                    const paymentDescription = `Recompensa de Impulsor (Nivel ${level.level}) para el mes de ${paymentMonth.toLocaleString('es', { month: 'long', year: 'numeric' })}`;
                    await client.query(`INSERT INTO transactions (username, type, description, blue_change) VALUES ($1, 'booster_reward', $2, $3)`, [booster.username, paymentDescription, amountToPay]);
                    
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
            'allow_donation_publications'
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
        await client.query('INSERT INTO booster_blue_ledger (user_id, amount, source_publication_id) VALUES ($1, $2, $3)', [workerId, cost, pubId]);
        await client.query('UPDATE users SET is_booster = TRUE WHERE id = $1', [workerId]);
        await updateUserBoosterLevel(client, workerId);
    } else {
        // --- MODO NORMAL ---
        const debtInterval = `${settings.debt_cycle_days || 30} days ${settings.debt_cycle_hours || 0} hours ${settings.debt_cycle_minutes || 0} minutes`;
        const escrowInterval = `${settings.blue_escrow_days || 1} days ${settings.blue_escrow_hours || 0} hours ${settings.blue_escrow_minutes || 0} minutes`;
        const commissionPercentage = parseFloat(settings.platform_commission_percentage || '0');
        const commissionAmount = cost * (commissionPercentage / 100);
        const redForAuthor = cost + commissionAmount;

        await client.query(`UPDATE users SET red_balance = red_balance + $1 WHERE username = $2`, [redForAuthor, author]);
        await client.query(`INSERT INTO red_token_debts (username, amount, due_at) VALUES ($1, $2, NOW() + INTERVAL '${debtInterval}')`, [author, redForAuthor]);
        
        await client.query(`UPDATE users SET escrow_blue_balance = escrow_blue_balance + $1 WHERE username = $2`, [cost, workerUsername]);
        await client.query(`INSERT INTO blue_token_escrows (username, amount, unlock_at) VALUES ($1, $2, NOW() + INTERVAL '${escrowInterval}')`, [workerUsername, cost]);
        
        await client.query(`INSERT INTO platform_wallet (id, total_blue_commission_balance) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET total_blue_commission_balance = platform_wallet.total_blue_commission_balance + $1`, [commissionAmount]);
        
        const authorTxResult = await client.query(`INSERT INTO transactions (username, type, description, blue_change, red_change, related_publication_id, platform_fee_blue) VALUES ($1, 'payment_sent', $2, 0, $3, $4, $5) RETURNING id`, [author, `Pagaste por: "${title}"`, redForAuthor, pubId, commissionAmount]);
        const authorTxId = authorTxResult.rows[0].id;
        await client.query(`INSERT INTO transactions (username, type, description, blue_change, red_change, related_publication_id) VALUES ($1, 'payment_received', $2, $3, 0, $4)`, [workerUsername, `Realizaste: "${title}"`, cost, pubId]);
        
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

        await client.query('INSERT INTO booster_blue_ledger (user_id, amount, source_publication_id) VALUES ($1, $2, $3)', [payerId, -cost, pubId]);
        await client.query('INSERT INTO booster_blue_ledger (user_id, amount, source_publication_id) VALUES ($1, $2, $3)', [recipientId, cost, pubId]);
        
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

        await client.query(`UPDATE users SET red_balance = red_balance + $1 WHERE username = $2`, [redForPayer, payer]);
        await client.query(`INSERT INTO red_token_debts (username, amount, due_at) VALUES ($1, $2, NOW() + INTERVAL '${debtInterval}')`, [payer, redForPayer]);
        
        await client.query(`UPDATE users SET escrow_blue_balance = escrow_blue_balance + $1 WHERE username = $2`, [cost, recipient]);
        await client.query(`INSERT INTO blue_token_escrows (username, amount, unlock_at) VALUES ($1, $2, NOW() + INTERVAL '${escrowInterval}')`, [recipient, cost]);
        
        await client.query(`INSERT INTO platform_wallet (id, total_blue_commission_balance) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET total_blue_commission_balance = platform_wallet.total_blue_commission_balance + $1`, [commissionAmount]);
        
        const payerTxResult = await client.query(`INSERT INTO transactions (username, type, description, blue_change, red_change, related_publication_id, platform_fee_blue) VALUES ($1, 'payment_sent', $2, 0, $3, $4, $5) RETURNING id`, [payer, `Pagaste por: "${title}"`, redForPayer, pubId, commissionAmount]);
        const payerTxId = payerTxResult.rows[0].id;
        await client.query(`INSERT INTO transactions (username, type, description, blue_change, red_change, related_publication_id) VALUES ($1, 'payment_received', $2, $3, 0, $4)`, [recipient, `Recibiste por: "${title}"`, cost, pubId]);
        
        await client.query(`INSERT INTO platform_commission_log (related_publication_id, related_user_transaction_id, commission_amount_blue) VALUES ($1, $2, $3)`, [pubId, payerTxId, commissionAmount]);
        
        const recipientNotification = `¡Has recibido el pago de ${cost.toFixed(4)} BLUE (en depósito) por "${title}" de parte de ${payer}!`;
        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [recipient, recipientNotification]);

        resultMessage = "¡Compra/Donación completada y pagada! Gracias.";
    }

    // CORRECCIÓN: Actualizar el estado de la aceptación a 'confirmed_paid'
    await client.query(`UPDATE publication_acceptances SET status = 'confirmed_paid' WHERE id = $1`, [acceptance_id]);

    return { success: true, message: resultMessage };
}