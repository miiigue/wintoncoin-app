const pool = require('./db');
const bcrypt = require('bcrypt');
const saltRounds = 10;

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
                hidden_for_users INTEGER[] DEFAULT ARRAY[]::INTEGER[],
                allow_repeat_participation BOOLEAN DEFAULT FALSE,
                max_repeat_per_user INTEGER DEFAULT 1,
                repeat_cooldown_hours INTEGER DEFAULT 24
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
                -- LEGACY (SMS): antes se guardaba el OTP en texto plano. Ya no se usa para validar.
                -- Lo dejamos como columna opcional para compatibilidad y migración progresiva.
                verification_code VARCHAR(10),
                -- NUEVO (Email OTP): hash HMAC del OTP (nunca guardar OTP en texto plano).
                verification_code_hash TEXT,
                -- Controles anti-fraude / anti-bruteforce (estándar fintech)
                verification_attempts INTEGER NOT NULL DEFAULT 0,
                resend_count INTEGER NOT NULL DEFAULT 0,
                last_sent_at TIMESTAMPTZ,
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

            // MIGRACIÓN OTP (Email): asegurar columnas y constraints para verificación por correo
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;`,
            `ALTER TABLE pending_verifications ADD COLUMN IF NOT EXISTS verification_code_hash TEXT;`,
            `ALTER TABLE pending_verifications ADD COLUMN IF NOT EXISTS verification_attempts INTEGER NOT NULL DEFAULT 0;`,
            `ALTER TABLE pending_verifications ADD COLUMN IF NOT EXISTS resend_count INTEGER NOT NULL DEFAULT 0;`,
            `ALTER TABLE pending_verifications ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;`,
            `DO $$
         BEGIN
             -- Hacemos la columna legacy opcional para poder dejar de guardar OTP en texto plano.
             IF EXISTS (
                 SELECT 1 FROM information_schema.columns
                 WHERE table_name='pending_verifications' AND column_name='verification_code'
             ) THEN
                 -- Si todavía es NOT NULL, lo relajamos.
                 BEGIN
                     ALTER TABLE pending_verifications ALTER COLUMN verification_code DROP NOT NULL;
                 EXCEPTION WHEN others THEN
                     -- Si falla por cualquier razón, no rompemos el arranque.
                     NULL;
                 END;
             END IF;
         END $$;`,

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
            settled_at TIMESTAMPTZ DEFAULT NULL,
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
            type VARCHAR(50) NOT NULL DEFAULT 'legacy_entry',
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
            END $$;`,
            // MIGRACIÓN: Agregar form_fields a publications (formularios dinámicos por paso)
            `DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publications' AND column_name='form_fields') THEN
                    ALTER TABLE publications ADD COLUMN form_fields JSONB DEFAULT NULL;
                END IF;
            END $$;`,
            // MIGRACIÓN: Agregar form_responses a publication_acceptances (respuestas del usuario)
            `DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publication_acceptances' AND column_name='form_responses') THEN
                    ALTER TABLE publication_acceptances ADD COLUMN form_responses JSONB DEFAULT NULL;
                END IF;
            END $$;`,
            // MIGRACIÓN: Agregar form_responses_submitted_at a publication_acceptances (timestamp de envío)
            `DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publication_acceptances' AND column_name='form_responses_submitted_at') THEN
                    ALTER TABLE publication_acceptances ADD COLUMN form_responses_submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
                END IF;
            END $$;`,
            // MIGRACIÓN: Tabla de difusiones de correo (Email Broadcasts)
            `CREATE TABLE IF NOT EXISTS email_broadcasts (
                id SERIAL PRIMARY KEY,
                admin_id INTEGER NOT NULL REFERENCES users(id),
                subject VARCHAR(255) NOT NULL,
                title VARCHAR(255),
                body TEXT NOT NULL,
                target_group VARCHAR(50) NOT NULL, -- 'all', 'verified', 'booster', 'specific'
                target_username VARCHAR(255),
                total_recipients INTEGER DEFAULT 0,
                sent_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sending', 'completed', 'failed'
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );`,
            // Asegurar columna title si la tabla ya existía sin ella
            `DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_broadcasts' AND column_name='title') THEN
                    ALTER TABLE email_broadcasts ADD COLUMN title VARCHAR(255);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_broadcasts' AND column_name='button_text') THEN
                    ALTER TABLE email_broadcasts ADD COLUMN button_text VARCHAR(50);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_broadcasts' AND column_name='button_url') THEN
                    ALTER TABLE email_broadcasts ADD COLUMN button_url VARCHAR(255);
                END IF;
            END $$;`,
            // MIGRACIÓN: Tabla de destinatarios de difusiones (Email Broadcast Recipients)
            `CREATE TABLE IF NOT EXISTS email_broadcast_recipients (
                id SERIAL PRIMARY KEY,
                broadcast_id INTEGER REFERENCES email_broadcasts(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
                error_message TEXT,
                sent_at TIMESTAMP WITH TIME ZONE
            );`
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
            is_verified BOOLEAN DEFAULT FALSE,
            referral_code VARCHAR(255) UNIQUE
        );`,
        `CREATE TABLE IF NOT EXISTS pending_verifications (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            phone_number VARCHAR(50) UNIQUE NOT NULL,
            -- LEGACY (SMS): antes se guardaba el OTP en texto plano. Ya no se usa para validar.
            verification_code VARCHAR(10),
            -- NUEVO (Email OTP): hash HMAC del OTP (nunca guardar OTP en texto plano).
            verification_code_hash TEXT,
            -- Controles anti-fraude / anti-bruteforce
            verification_attempts INTEGER NOT NULL DEFAULT 0,
            resend_count INTEGER NOT NULL DEFAULT 0,
            last_sent_at TIMESTAMPTZ,
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
            settled_at TIMESTAMPTZ DEFAULT NULL,
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
        `CREATE TABLE IF NOT EXISTS platform_wallet_log (
            id SERIAL PRIMARY KEY,
            transaction_type VARCHAR(50) NOT NULL, -- ej: 'burn', 'booster_payout'
            amount NUMERIC(19, 4) NOT NULL,
            related_username VARCHAR(255),
            description TEXT,
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
        // --- NUEVO: Tablas para el sistema P2P (BLUE) ---
        `CREATE TABLE IF NOT EXISTS p2p_payment_methods (
            id SERIAL PRIMARY KEY,
            code VARCHAR(50) UNIQUE NOT NULL,
            label VARCHAR(100) NOT NULL,
            is_cash BOOLEAN NOT NULL DEFAULT FALSE,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS p2p_offers (
            id SERIAL PRIMARY KEY,
            creator_username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            offer_type VARCHAR(10) NOT NULL CHECK (offer_type IN ('buy', 'sell')),
            currency VARCHAR(10) NOT NULL,
            price_per_blue NUMERIC(19, 6) NOT NULL,
            usd_reference_rate NUMERIC(19, 6),
            min_fiat_amount NUMERIC(19, 4) NOT NULL,
            max_fiat_amount NUMERIC(19, 4) NOT NULL,
            available_blue_amount NUMERIC(19, 4) NOT NULL,
            allow_partial BOOLEAN NOT NULL DEFAULT TRUE,
            terms TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS p2p_offer_methods (
            offer_id INTEGER NOT NULL REFERENCES p2p_offers(id) ON DELETE CASCADE,
            method_id INTEGER NOT NULL REFERENCES p2p_payment_methods(id) ON DELETE RESTRICT,
            PRIMARY KEY (offer_id, method_id)
        );`,
        `CREATE TABLE IF NOT EXISTS p2p_orders (
            id SERIAL PRIMARY KEY,
            offer_id INTEGER NOT NULL REFERENCES p2p_offers(id) ON DELETE RESTRICT,
            buyer_username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE RESTRICT,
            seller_username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE RESTRICT,
            fiat_amount NUMERIC(19, 4) NOT NULL,
            blue_amount NUMERIC(19, 4) NOT NULL,
            price_per_blue NUMERIC(19, 6) NOT NULL,
            currency VARCHAR(10) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'payment_pending',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            paid_at TIMESTAMPTZ,
            released_at TIMESTAMPTZ,
            cancelled_at TIMESTAMPTZ,
            extension_count INTEGER NOT NULL DEFAULT 0,
            extension_requested_by VARCHAR(255),
            extension_requested_at TIMESTAMPTZ,
            disputed_at TIMESTAMPTZ
        );`,
        `CREATE TABLE IF NOT EXISTS p2p_disputes (
            id SERIAL PRIMARY KEY,
            order_id INTEGER NOT NULL REFERENCES p2p_orders(id) ON DELETE CASCADE,
            opened_by VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE RESTRICT,
            reason TEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'open',
            resolution TEXT,
            resolved_by VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            resolved_at TIMESTAMPTZ
        );`,
        `CREATE TABLE IF NOT EXISTS p2p_ratings (
            id SERIAL PRIMARY KEY,
            order_id INTEGER NOT NULL REFERENCES p2p_orders(id) ON DELETE CASCADE,
            rater_username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE RESTRICT,
            ratee_username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE RESTRICT,
            rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
            comment TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (order_id, rater_username)
        );`,
        `CREATE TABLE IF NOT EXISTS email_broadcasts (
            id SERIAL PRIMARY KEY,
            admin_id INTEGER NOT NULL REFERENCES users(id),
            subject VARCHAR(255) NOT NULL,
            title VARCHAR(255),
            body TEXT NOT NULL,
            target_group VARCHAR(50) NOT NULL, -- 'all', 'verified', 'booster', 'specific'
            target_username VARCHAR(255),
            total_recipients INTEGER DEFAULT 0,
            sent_count INTEGER DEFAULT 0,
            failed_count INTEGER DEFAULT 0,
            status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sending', 'completed', 'failed'
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            button_text VARCHAR(50),
            button_url VARCHAR(255)
        );`,
        `CREATE TABLE IF NOT EXISTS email_broadcast_recipients (
            id SERIAL PRIMARY KEY,
            broadcast_id INTEGER REFERENCES email_broadcasts(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
            error_message TEXT,
            sent_at TIMESTAMP WITH TIME ZONE
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
        ['allow_quick_sale_publications', 'true', 'Permitir crear publicaciones de tipo "Venta Rápida".'],
        // --- NUEVAS CONFIGURACIONES P2P ---
        ['p2p_enabled', 'true', 'Habilita el módulo P2P para compra/venta de BLUE entre usuarios.'],
        ['p2p_price_min', '0.95', 'Precio mínimo permitido en USD (1 BLUE = 0.95 USD).'],
        ['p2p_price_max', '1.05', 'Precio máximo permitido en USD (1 BLUE = 1.05 USD).'],
        ['p2p_fee_percentage', '0', 'Comisión P2P total (porcentaje). Se puede dividir luego 50/50.'],
        ['p2p_payment_window_minutes', '15', 'Minutos máximos para confirmar el pago en P2P.'],
        ['p2p_extension_minutes', '15', 'Minutos de extensión al aceptar una prórroga.'],
        ['p2p_extension_limit', '1', 'Cantidad máxima de extensiones por orden.'],
        ['p2p_cash_min_rating', '4.5', 'Reputación mínima para usar efectivo en persona.'],
        // --- CONFIGURACIONES DE GOBERNANZA (Winton-Consensus) ---
        ['gov_quorum_percentage', '67', 'Porcentaje de votos necesarios para aprobar o rechazar una solicitud (ej: 67 para ⅔).'],
        ['gov_timelock_hours', '48', 'Horas de espera (Time-Lock) tras el quórum de aprobación, antes de ejecutar un cambio de membresía (NOW + horas en BD).'],
        ['gov_request_expiry_hours', '24', 'Horas que tiene una solicitud para alcanzar quórum antes de expirar.'],
        ['gov_reminder_threshold_hours', '12', 'Horas restantes antes de expiración para enviar recordatorio de voto.'],
        ['gov_reminder_cooldown_hours', '6', 'Horas mínimas entre recordatorios sucesivos al mismo guardián.'],
        ['gov_vote_reward_blue', '0', 'BLUE IOU acreditados a un guardián al emitir su voto (0 = desactivado).'],
    ];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Paso 1: Migraciones de esquema.
        console.log('[INIT] Bypassing applyMigrations to break Render lock...');
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

        // ---------------------------------------------------------------------------------
        // AUTO-MIGRACIÓN OTP (Email): asegurar columnas en pending_verifications
        // NOTA: Como applyMigrations() está comentado, necesitamos este paso para BD existentes.
        // ---------------------------------------------------------------------------------
        await client.query(`ALTER TABLE pending_verifications ADD COLUMN IF NOT EXISTS verification_code_hash TEXT;`);
        await client.query(`ALTER TABLE pending_verifications ADD COLUMN IF NOT EXISTS verification_attempts INTEGER NOT NULL DEFAULT 0;`);
        await client.query(`ALTER TABLE pending_verifications ADD COLUMN IF NOT EXISTS resend_count INTEGER NOT NULL DEFAULT 0;`);
        await client.query(`ALTER TABLE pending_verifications ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;`);
        await client.query(`
            DO $$
            BEGIN
                -- Permite dejar de guardar OTP en texto plano (compatibilidad legacy).
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='pending_verifications' AND column_name='verification_code'
                ) THEN
                    BEGIN
                        ALTER TABLE pending_verifications ALTER COLUMN verification_code DROP NOT NULL;
                    EXCEPTION WHEN others THEN
                        NULL;
                    END;
                END IF;
            END $$;
        `);

        // ---------------------------------------------------------------------------------
        // AUTO-MIGRACIÓN: Columnas para recuperación de contraseña (forgot password)
        // password_reset_hash           → HMAC hash del OTP
        // password_reset_expires_at     → expiración del OTP
        // password_reset_attempts       → contador de intentos fallidos (anti-bruteforce)
        // password_invalidate_before    → invalida JWTs emitidos antes de esta fecha
        // ---------------------------------------------------------------------------------
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'password_reset_hash'
                ) THEN
                    ALTER TABLE users ADD COLUMN password_reset_hash TEXT;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'password_reset_expires_at'
                ) THEN
                    ALTER TABLE users ADD COLUMN password_reset_expires_at TIMESTAMPTZ;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'password_reset_attempts'
                ) THEN
                    ALTER TABLE users ADD COLUMN password_reset_attempts INTEGER NOT NULL DEFAULT 0;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'password_invalidate_before'
                ) THEN
                    ALTER TABLE users ADD COLUMN password_invalidate_before TIMESTAMPTZ;
                END IF;
            END $$;
        `);

        // ---------------------------------------------------------------------------------
        // AUTO-MIGRACIÓN (compatibilidad): booster_transactions.related_publication_id
        // Algunas BD antiguas no tienen esta columna, pero el perfil de impulsor la usa para
        // enlazar/describir correctamente eventos asociados a publicaciones.
        // ---------------------------------------------------------------------------------
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name='booster_transactions'
                      AND column_name='related_publication_id'
                ) THEN
                    ALTER TABLE booster_transactions ADD COLUMN related_publication_id INTEGER;
                END IF;

                IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_booster_transactions_user_related_pub') THEN
                    CREATE INDEX idx_booster_transactions_user_related_pub
                    ON booster_transactions (user_id, related_publication_id, created_at);
                END IF;
            END $$;
        `);

        // ---------------------------------------------------------------------------------
        // FIX PROFESIONAL (ledger) SIN RECURSIÓN:
        // En algunas BD ya existe un trigger legacy (sync_booster_legacy_insert) que llama record_booster_event
        // al insertar en booster_blue_ledger, causando recursión infinita si record_booster_event inserta al ledger.
        //
        // Solución (sin asumir y respetando reglas DB):
        // - Borrar trigger/función legacy recursiva si existe
        // - NO tocar balances en users (hay trigger prevent_manual_balance_update en tu DB que lo bloquea)
        // - Definir record_booster_event como wrapper que SOLO inserta en el ledger (fuente de verdad)
        // ---------------------------------------------------------------------------------
        // Eliminación segura (sin suposiciones): borrar cualquier trigger en booster_blue_ledger
        // que apunte a la función legacy sync_booster_legacy_insert() para evitar recursión.
        await client.query(`
            DO $$
            DECLARE r RECORD;
            BEGIN
                FOR r IN
                    SELECT t.tgname
                    FROM pg_trigger t
                    JOIN pg_class c ON c.oid = t.tgrelid
                    JOIN pg_proc p ON p.oid = t.tgfoid
                    WHERE c.relname = 'booster_blue_ledger'
                      AND t.tgisinternal = FALSE
                      AND p.proname = 'sync_booster_legacy_insert'
                LOOP
                    EXECUTE format('DROP TRIGGER IF EXISTS %I ON booster_blue_ledger', r.tgname);
                END LOOP;
            END $$;
        `);

        // Asegurar que las columnas del ledger existen antes de crear la función
        // Esto previene fallas al inicializar bases de datos desde cero
        await client.query(`ALTER TABLE booster_blue_ledger ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'legacy_entry';`);
        await client.query(`ALTER TABLE booster_blue_ledger ADD COLUMN IF NOT EXISTS reference_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`);

        // Ahora sí, ya sin dependencias, podemos eliminar/recrear funciones con seguridad.
        // Usamos CASCADE para cubrir objetos legacy desconocidos (y luego recreamos lo necesario).
        await client.query(`DROP FUNCTION IF EXISTS sync_booster_legacy_insert() CASCADE;`);
        await client.query(`DROP FUNCTION IF EXISTS record_booster_event(integer,text,numeric,integer) CASCADE;`);
        await client.query(`DROP FUNCTION IF EXISTS record_booster_event(integer,text,numeric,integer,integer) CASCADE;`);

        // Nota: NO recreamos sync_booster_legacy_insert como trigger porque tu DB tiene
        // prevent_manual_balance_update y bloquearía UPDATE users.booster_blue_balance.
        // A partir de ahora, el ledger es la única fuente de verdad para "total_booster_blue".

        await client.query(`
            CREATE OR REPLACE FUNCTION record_booster_event(
                p_user_id INTEGER,
                p_type TEXT,
                p_amount NUMERIC,
                p_publication_id INTEGER DEFAULT NULL,
                p_reference_user_id INTEGER DEFAULT NULL
            )
            RETURNS VOID
            LANGUAGE plpgsql
            AS $$
            BEGIN
                -- Modificado para insertar el parámetro p_type y reference_user_id de forma nativa
                -- garantizando auditabilidad profunda y rastreo en el ledger (Data Lineage).
                INSERT INTO booster_blue_ledger (user_id, amount, source_publication_id, type, reference_user_id)
                VALUES (p_user_id, p_amount, p_publication_id, p_type, p_reference_user_id);
            END;
            $$;
        `);

        // ---------------------------------------------------------------------------------
        // BACKFILL / RECONCILIACIÓN (local/prod-safe):
        // Objetivo: que el historial muestre cada actividad real cuando exista evidencia (booster_transactions),
        // y solo usar una línea "histórica" residual si falta detalle.
        //
        // Restricción real de tu DB: prevent_manual_balance_update() bloquea UPDATE de balances, así que aquí
        // NO hacemos UPDATE a users.booster_blue_balance; solo leemos e insertamos en el ledger.
        // ---------------------------------------------------------------------------------
        await client.query(`
            DO $$
            DECLARE r RECORD;
            DECLARE legacy_col_exists BOOLEAN;
            DECLARE sum_bt NUMERIC;
            DECLARE diff NUMERIC;
            BEGIN
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'booster_blue_balance'
                ) INTO legacy_col_exists;

                IF legacy_col_exists THEN
                    FOR r IN
                        SELECT u.id AS user_id, u.booster_blue_balance AS legacy_total
                        FROM users u
                        WHERE u.booster_blue_balance > 0
                          AND NOT EXISTS (SELECT 1 FROM booster_blue_ledger bbl WHERE bbl.user_id = u.id)
                    LOOP
                        -- 1) Si existen eventos detallados, insertarlos al ledger preservando created_at.
                        INSERT INTO booster_blue_ledger (user_id, amount, source_publication_id, created_at)
                        SELECT bt.user_id, bt.amount, bt.related_publication_id, bt.created_at
                        FROM booster_transactions bt
                        WHERE bt.user_id = r.user_id
                        ORDER BY bt.created_at ASC;

                        SELECT COALESCE(SUM(bt.amount), 0)
                        INTO sum_bt
                        FROM booster_transactions bt
                        WHERE bt.user_id = r.user_id;

                        -- 2) Si NO hay detalle en booster_transactions, hacemos un backfill único (como legacy).
                        IF sum_bt = 0 THEN
                            INSERT INTO booster_blue_ledger (user_id, amount, source_publication_id)
                            VALUES (r.user_id, r.legacy_total, NULL);

                            INSERT INTO booster_transactions (user_id, type, amount, description, related_publication_id)
                            VALUES (
                                r.user_id,
                                'legacy_backfill',
                                r.legacy_total,
                                'Ajuste de saldo histórico (sin detalle disponible)',
                                NULL
                            );
                        ELSE
                            -- 3) Si sí hay detalle, reconciliar contra el total legacy con una línea residual si hace falta.
                            diff := r.legacy_total - sum_bt;
                            IF diff > 0.00009 THEN
                                INSERT INTO booster_blue_ledger (user_id, amount, source_publication_id)
                                VALUES (r.user_id, diff, NULL);

                                INSERT INTO booster_transactions (user_id, type, amount, description, related_publication_id)
                                VALUES (
                                    r.user_id,
                                    'legacy_backfill',
                                    diff,
                                    'Ajuste de saldo histórico (sin detalle disponible)',
                                    NULL
                                );
                            END IF;
                        END IF;
                    END LOOP;
                END IF;
            END $$;
        `);

        // Paso 3: Asegurar que todas las configuraciones por defecto existen.
        for (const setting of defaultSettings) {
            await client.query(
                'INSERT INTO app_settings (setting_key, setting_value, description) VALUES ($1, $2, $3) ON CONFLICT (setting_key) DO NOTHING',
                setting
            );
        }
        console.log("Configuraciones por defecto aseguradas en 'app_settings'.");

        // --- NUEVO PASO 3.6: Semillas de métodos de pago P2P ---
        const methodsResult = await client.query('SELECT COUNT(*)::int AS count FROM p2p_payment_methods');
        if (methodsResult.rows[0].count === 0) {
            const defaultMethods = [
                ['bank_transfer', 'Transferencia bancaria', false],
                ['spei', 'SPEI (México)', false],
                ['cbu_alias', 'CBU / Alias (Argentina)', false],
                ['pix', 'PIX (Brasil)', false],
                ['pse', 'PSE (Colombia)', false],
                ['ach_local', 'Transferencia ACH local', false],
                ['mercadopago', 'MercadoPago', false],
                ['uala', 'Ualá', false],
                ['nequi', 'Nequi', false],
                ['daviplata', 'Daviplata', false],
                ['paypal', 'PayPal', false],
                ['wise', 'Wise', false],
                ['payoneer', 'Payoneer', false],
                ['cash_in_person', 'Efectivo en persona', true],
                ['cash_deposit', 'Depósito en ventanilla/cajero', true]
            ];
            for (const method of defaultMethods) {
                await client.query(
                    'INSERT INTO p2p_payment_methods (code, label, is_cash) VALUES ($1, $2, $3)',
                    method
                );
            }
            console.log("Métodos de pago P2P por defecto creados.");
        }

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

        // --- AUDIT COMPLIANCE 2026-06-28: Redefinición y alineación de los 5 Niveles de Carrera
        // Se configuran los nombres y mínimos exactos presentados en el Panel de Administración.
        // Las descripciones son un tributo a Sir Nicholas Winton y su obra humanitaria.
        const boosterLevels = [
            // [Nivel, Nombre de Nivel, BLUE Mínimo Requerido, Descripción Temática]
            [1, 'Impulsor Visionario', 0, '"La lucidez de ver lo que otros ignoran." Al igual que Nicholas Winton presintió el cambio antes que nadie, tú has detectado el potencial de WintonCoin mientras el mundo sigue dormido.'],
            [2, 'Impulsor Pionero', 5001, '"El coraje de romper la inercia." Winton no esperó permiso; organizó trenes y actuó. Tú has hecho lo mismo: has dejado de ser espectador para "subirte al tren".'],
            [3, 'Impulsor Guardian', 25001, '"La voluntad de ser protector." Winton se involucró hasta el fondo para salvar vidas. Tú haces lo mismo con tu futuro: aquí conviertes tus buenos deseos en acciones.'],
            [4, 'Impulsor Salvador', 200001, '"El poder de transformar realidades." Winton logró lo imposible y garantizó una nueva vida para 669 niños. Tú has alcanzado esa eficacia: has "salvado" tu economía personal.'],
            [5, 'Impulsor Legado Infinito', 1000000, '"La huella que trasciende el tiempo." La obra silenciosa de Winton generó miles de descendientes. Tú has llegado a la cima: Eres una leyenda viva.']
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

        const userExists = await client.query('SELECT id, email FROM users WHERE username = $1', [platformUsername]);
        const officialEmail = 'accounting@wintoncoin.com';

        if (userExists.rowCount === 0) {
            console.log(`Creando el usuario del sistema '${platformUsername}'...`);
            const passwordHash = await bcrypt.hash(securePassword, saltRounds);

            // Create a safe, unique identifier from the username to avoid conflicts.
            const uniqueIdentifier = platformUsername.toLowerCase().replace(/\s+/g, '-');
            // const email = `platform-${uniqueIdentifier}@wintoncoin.io`;
            const phone = `000000-${uniqueIdentifier}`; // Guarantees a unique phone placeholder

            await client.query(
                'INSERT INTO users (username, password_hash, email, phone_number) VALUES ($1, $2, $3, $4)',
                [platformUsername, passwordHash, officialEmail, phone]
            );
            console.log(`Usuario del sistema '${platformUsername}' creado con email: ${officialEmail}`);
        } else {
            // FIX DE MANTENIMIENTO: Asegurar que el usuario Plataforma tenga SIEMPRE el email oficial.
            // Esto corrige instalaciones previas que usaban emails aleatorios.
            const currentUser = userExists.rows[0];
            if (currentUser.email !== officialEmail) {
                console.log(`MANTENIMIENTO: Actualizando email de plataforma a '${officialEmail}'...`);
                await client.query('UPDATE users SET email = $1 WHERE id = $2', [officialEmail, currentUser.id]);
            }
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
module.exports = { initializeDatabase, applyMigrations, generateUniqueReferralCode };
