const { Pool } = require('pg');
require('./config'); // Carga la configuración del entorno

const pool = new Pool({
    // Las credenciales se leen directamente del archivo .env correspondiente
    // gracias al gestor de configuración. No es necesario escribirlas aquí.
    connectionString: process.env.DATABASE_URL,
    // La configuración SSL se activa automáticamente si NODE_ENV es 'production'
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function resetDatabase() {
    const client = await pool.connect();
    try {
        console.log('🔄 Reseteando base de datos local...');
        
        // 0. Habilitar extensiones necesarias para criptografía y UUIDs
        await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
        await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

        // 1. Eliminar todas las tablas existentes
        await client.query(`
            DO $$ DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
                END LOOP;
                
                -- Eliminar tipos enum si existen (limpieza completa)
                DROP TYPE IF EXISTS user_role CASCADE; 
            END $$;
        `);
        
        console.log('✅ Todas las tablas eliminadas');
        
        // 2. Recrear las tablas con la estructura correcta y SEGURIDAD (Event Sourcing)
        
        // --- TABLAS BASE ---
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone_number VARCHAR(50),
                given_name VARCHAR(100),
                family_name VARCHAR(100),
                date_of_birth DATE,
                document_type VARCHAR(50),
                document_number VARCHAR(50),
                liquid_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
                escrow_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
                red_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
                booster_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
                booster_level INTEGER NOT NULL DEFAULT 1,
                average_rating REAL NOT NULL DEFAULT 0,
                ratings_count INTEGER NOT NULL DEFAULT 0,
                is_verified BOOLEAN DEFAULT FALSE,
                is_minor BOOLEAN DEFAULT FALSE,
                account_status VARCHAR(50) DEFAULT 'active',
                is_booster BOOLEAN DEFAULT FALSE,
                referral_code VARCHAR(255) UNIQUE,
                referred_by_id INTEGER REFERENCES users(id),
                tutor_user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP WITH TIME ZONE
            );

            CREATE TABLE IF NOT EXISTS pending_verifications (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                phone_number VARCHAR(50) UNIQUE NOT NULL,
                verification_code VARCHAR(10) NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                referral_code VARCHAR(255),
                date_of_birth DATE,
                is_minor BOOLEAN DEFAULT FALSE
            );
        `);

        // --- TABLAS DE EVENTOS (EVENT SOURCING) ---
        
        // Eventos principales (Post-Lanzamiento)
        await client.query(`
            CREATE TABLE IF NOT EXISTS balance_events (
                id BIGSERIAL PRIMARY KEY,
                event_id UUID UNIQUE DEFAULT gen_random_uuid(),
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                event_type VARCHAR(50) NOT NULL, -- 'credit', 'debit', 'transfer', 'burn', 'fee'
                balance_type VARCHAR(20) NOT NULL, -- 'liquid_blue', 'escrow_blue', 'red'
                amount NUMERIC(19, 4) NOT NULL,
                previous_balance NUMERIC(19, 4) NOT NULL,
                new_balance NUMERIC(19, 4) NOT NULL,
                related_transaction_id INTEGER, -- Referencia opcional a transactions
                event_hash TEXT NOT NULL, -- SHA-256
                previous_event_hash TEXT, -- Chain validation
                created_at TIMESTAMPTZ DEFAULT NOW(),
                metadata JSONB
            );
            
            CREATE INDEX idx_balance_events_user_id ON balance_events(user_id);
            CREATE INDEX idx_balance_events_chain ON balance_events(user_id, balance_type, created_at);
        `);

        // Eventos de Booster (Pre-Lanzamiento)
        await client.query(`
            CREATE TABLE IF NOT EXISTS booster_events (
                id BIGSERIAL PRIMARY KEY,
                event_id UUID UNIQUE DEFAULT gen_random_uuid(),
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                event_type VARCHAR(50) NOT NULL, -- 'bonus', 'task_reward', 'referral_reward'
                amount NUMERIC(19, 4) NOT NULL,
                previous_balance NUMERIC(19, 4) NOT NULL,
                new_balance NUMERIC(19, 4) NOT NULL,
                source_publication_id INTEGER, -- Referencia opcional
                event_hash TEXT NOT NULL,
                previous_event_hash TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                metadata JSONB
            );
             CREATE INDEX idx_booster_events_user_id ON booster_events(user_id);
        `);

        // --- FUNCIONES Y TRIGGERS DE SEGURIDAD ---

        // Función para calcular Hash SHA-256
        await client.query(`
            CREATE OR REPLACE FUNCTION calculate_event_hash(
                p_user_id INTEGER,
                p_amount NUMERIC,
                p_prev_hash TEXT,
                p_timestamp TIMESTAMPTZ
            ) RETURNS TEXT AS $$
            BEGIN
                RETURN encode(digest(
                    p_user_id::text || p_amount::text || COALESCE(p_prev_hash, 'GENESIS') || p_timestamp::text,
                    'sha256'
                ), 'hex');
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Función: Registrar Evento Principal (Actualiza users automáticamente)
        await client.query(`
            CREATE OR REPLACE FUNCTION record_balance_event(
                p_user_id INTEGER,
                p_event_type VARCHAR,
                p_balance_type VARCHAR,
                p_amount NUMERIC,
                p_related_tx_id INTEGER DEFAULT NULL
            ) RETURNS VOID AS $$
            DECLARE
                v_prev_balance NUMERIC(19, 4) := 0;
                v_new_balance NUMERIC(19, 4);
                v_prev_hash TEXT := NULL;
                v_hash TEXT;
            BEGIN
                -- 0. AUTORIZACIÓN: Usar la "llave maestra" para permitir el update
                PERFORM set_config('app.allow_balance_update', 'true', true);

                -- 1. Obtener último estado
                SELECT new_balance, event_hash INTO v_prev_balance, v_prev_hash
                FROM balance_events
                WHERE user_id = p_user_id AND balance_type = p_balance_type
                ORDER BY id DESC LIMIT 1;
                
                IF v_prev_balance IS NULL THEN v_prev_balance := 0; END IF;

                -- 2. Calcular nuevo balance
                IF p_event_type IN ('credit', 'deposit', 'payment_received', 'bonus') THEN
                    v_new_balance := v_prev_balance + p_amount;
                ELSIF p_event_type IN ('debit', 'payment_sent', 'withdrawal', 'fee', 'burn') THEN
                    v_new_balance := v_prev_balance - p_amount;
                ELSE
                    RAISE EXCEPTION 'Tipo de evento desconocido: %', p_event_type;
                END IF;

                -- 3. Generar Hash
                v_hash := calculate_event_hash(p_user_id, p_amount, v_prev_hash, NOW());

                -- 4. Insertar Evento (Inmutable)
                INSERT INTO balance_events (
                    user_id, event_type, balance_type, amount, 
                    previous_balance, new_balance, related_transaction_id, 
                    event_hash, previous_event_hash
                ) VALUES (
                    p_user_id, p_event_type, p_balance_type, p_amount,
                    v_prev_balance, v_new_balance, p_related_tx_id,
                    v_hash, v_prev_hash
                );

                -- 5. Actualizar Cache en Tabla Users (Trigger manual optimizado)
                IF p_balance_type = 'liquid_blue' THEN
                    UPDATE users SET liquid_blue_balance = v_new_balance WHERE id = p_user_id;
                ELSIF p_balance_type = 'escrow_blue' THEN
                    UPDATE users SET escrow_blue_balance = v_new_balance WHERE id = p_user_id;
                ELSIF p_balance_type = 'red' THEN
                    UPDATE users SET red_balance = v_new_balance WHERE id = p_user_id;
                END IF;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Función: Registrar Evento Booster (Actualiza users automáticamente)
        await client.query(`
            CREATE OR REPLACE FUNCTION record_booster_event(
                p_user_id INTEGER,
                p_event_type VARCHAR,
                p_amount NUMERIC,
                p_source_pub_id INTEGER DEFAULT NULL
            ) RETURNS VOID AS $$
            DECLARE
                v_prev_balance NUMERIC(19, 4) := 0;
                v_new_balance NUMERIC(19, 4);
                v_prev_hash TEXT := NULL;
                v_hash TEXT;
            BEGIN
                -- 0. AUTORIZACIÓN: Usar la "llave maestra"
                PERFORM set_config('app.allow_balance_update', 'true', true);

                SELECT new_balance, event_hash INTO v_prev_balance, v_prev_hash
                FROM booster_events
                WHERE user_id = p_user_id
                ORDER BY id DESC LIMIT 1;
                
                IF v_prev_balance IS NULL THEN v_prev_balance := 0; END IF;
                
                v_new_balance := v_prev_balance + p_amount; -- Booster siempre suma o resta directo
                v_hash := calculate_event_hash(p_user_id, p_amount, v_prev_hash, NOW());

                INSERT INTO booster_events (
                    user_id, event_type, amount, 
                    previous_balance, new_balance, source_publication_id, 
                    event_hash, previous_event_hash
                ) VALUES (
                    p_user_id, p_event_type, p_amount,
                    v_prev_balance, v_new_balance, p_source_pub_id,
                    v_hash, v_prev_hash
                );

                -- Actualizar Cache
                UPDATE users SET booster_blue_balance = v_new_balance WHERE id = p_user_id;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // --- CANDADO FINAL: TRIGGER DE BLOQUEO MANUAL ---
        await client.query(`
            CREATE OR REPLACE FUNCTION prevent_manual_balance_update() RETURNS TRIGGER AS $$
            BEGIN
                -- Si alguien intenta cambiar saldos y NO tiene la "llave maestra" activada...
                IF (OLD.liquid_blue_balance IS DISTINCT FROM NEW.liquid_blue_balance OR
                    OLD.escrow_blue_balance IS DISTINCT FROM NEW.escrow_blue_balance OR
                    OLD.red_balance IS DISTINCT FROM NEW.red_balance OR
                    OLD.booster_blue_balance IS DISTINCT FROM NEW.booster_blue_balance) 
                   AND current_setting('app.allow_balance_update', true) IS DISTINCT FROM 'true' THEN
                    
                    RAISE EXCEPTION 'ACCESO DENEGADO: No puedes modificar los saldos manualmente. Debes usar funciones de Event Sourcing (record_balance_event).';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER trg_prevent_manual_balance_update
            BEFORE UPDATE ON users
            FOR EACH ROW
            EXECUTE FUNCTION prevent_manual_balance_update();
        `);

        // --- CANDADO DE INMUTABILIDAD: PROHIBIR MODIFICAR EVENTOS ---
        await client.query(`
            CREATE OR REPLACE FUNCTION prevent_event_modification() RETURNS TRIGGER AS $$
            BEGIN
                RAISE EXCEPTION 'INMUTABILIDAD VIOLADA: No se permite modificar ni borrar eventos históricos. Solo se permiten nuevos registros (Append-Only).';
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER trg_immutable_balance_events
            BEFORE UPDATE OR DELETE ON balance_events
            FOR EACH ROW EXECUTE FUNCTION prevent_event_modification();

            CREATE TRIGGER trg_immutable_booster_events
            BEFORE UPDATE OR DELETE ON booster_events
            FOR EACH ROW EXECUTE FUNCTION prevent_event_modification();
        `);

        // --- RESTO DE TABLAS (Sin cambios estructurales mayores, solo dependencias) ---
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS publications (
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
                category VARCHAR(50) NOT NULL DEFAULT 'request',
                is_booster_task BOOLEAN DEFAULT FALSE,
                is_quick_sale BOOLEAN DEFAULT FALSE,
                target_username VARCHAR(255),
                expires_at TIMESTAMPTZ
            );
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS publication_acceptances (
                id SERIAL PRIMARY KEY,
                publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
                acceptor_username VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending_approval',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS hidden_publications (
                id SERIAL PRIMARY KEY,
                publication_id INT REFERENCES publications(id) ON DELETE CASCADE,
                hider_username VARCHAR(255) REFERENCES users(username) ON DELETE CASCADE,
                UNIQUE (publication_id, hider_username)
            );
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                recipient_username VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                blue_change NUMERIC(19, 4) NOT NULL DEFAULT 0,
                red_change NUMERIC(19, 4) NOT NULL DEFAULT 0,
                related_publication_id INTEGER,
                platform_fee_blue NUMERIC(19, 4) DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS ratings (
                id SERIAL PRIMARY KEY,
                publication_id INTEGER NOT NULL REFERENCES publications(id),
                rater_username VARCHAR(255) NOT NULL,
                ratee_username VARCHAR(255) NOT NULL,
                rating INTEGER NOT NULL,
                comment TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS red_token_debts (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                amount NUMERIC(19, 4) NOT NULL,
                due_at TIMESTAMPTZ NOT NULL,
                is_settled BOOLEAN NOT NULL DEFAULT FALSE,
                is_penalized BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS app_settings (
                setting_key VARCHAR(255) PRIMARY KEY,
                setting_value TEXT NOT NULL,
                description TEXT
            );
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS blue_token_escrows (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id),
                amount NUMERIC(19, 4) NOT NULL,
                unlock_at TIMESTAMPTZ NOT NULL,
                is_released BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS booster_blue_ledger (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount NUMERIC(19, 4) NOT NULL,
                source_publication_id INTEGER REFERENCES publications(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS booster_payment_log (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount_paid NUMERIC(19, 4) NOT NULL,
                payment_month DATE NOT NULL,
                booster_level_at_payment INTEGER NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS booster_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount NUMERIC(19, 4) NOT NULL,
                type VARCHAR(50),
                description TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS booster_level_settings (
                level INTEGER PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                min_blue_required NUMERIC(19, 4) NOT NULL,
                description TEXT
            );

            -- Insertar niveles por defecto
            INSERT INTO booster_level_settings (level, name, min_blue_required, description) VALUES
            (1, 'Impulsor Inicial', 0, 'El primer paso en tu viaje como impulsor.'),
            (2, 'Impulsor Bronce', 1001, 'Has demostrado un compromiso constante.'),
            (3, 'Impulsor Plata', 10001, 'Un pilar importante en la comunidad.'),
            (4, 'Impulsor Oro', 50001, 'Una fuerza motriz para el crecimiento de la plataforma.'),
            (5, 'Impulsor Platino', 100001, 'Reconocido como un Socio Estratégico clave.')
            ON CONFLICT (level) DO UPDATE 
            SET min_blue_required = EXCLUDED.min_blue_required,
                description = EXCLUDED.description,
                name = EXCLUDED.name;

            -- Trigger para sincronizar legacy inserts a booster_blue_ledger con Event Sourcing
            -- Esto asegura que el código viejo siga funcionando pero alimente el sistema nuevo
            CREATE OR REPLACE FUNCTION sync_booster_legacy_insert() RETURNS TRIGGER AS $$
            BEGIN
                -- Llamar a la función de evento nueva
                PERFORM record_booster_event(NEW.user_id, 'legacy_insert', NEW.amount, NEW.source_publication_id);
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER trg_sync_booster_legacy
            AFTER INSERT ON booster_blue_ledger
            FOR EACH ROW
            EXECUTE FUNCTION sync_booster_legacy_insert();
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS platform_wallet (
                id INT PRIMARY KEY DEFAULT 1,
                total_blue_commission_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000
            );
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS platform_commission_log (
                id SERIAL PRIMARY KEY,
                related_publication_id INTEGER REFERENCES publications(id) ON DELETE SET NULL,
                related_user_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
                commission_amount_blue NUMERIC(15, 4) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_agreements_log (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                document_type VARCHAR(50) NOT NULL, -- 'terms_and_conditions', 'privacy_policy'
                document_version VARCHAR(20) NOT NULL,
                document_hash TEXT NOT NULL, -- SHA-256 del texto
                ip_address VARCHAR(45),
                user_agent TEXT,
                accepted_at TIMESTAMPTZ DEFAULT NOW()
            );
            
            CREATE TABLE IF NOT EXISTS legal_documents (
                id SERIAL PRIMARY KEY,
                type VARCHAR(50) NOT NULL,
                version VARCHAR(20) NOT NULL,
                content TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                is_active BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(type, version)
            );

            -- Insertar documentos legales iniciales (v1.0)
            -- NOTA: Estos son los textos base. El hash se calculará automáticamente.
            INSERT INTO legal_documents (type, version, content, content_hash, is_active) VALUES
            ('terms_and_conditions', 'v1.0', 'Contenido inicial de Términos y Condiciones...', encode(digest('Contenido inicial de Términos y Condiciones...', 'sha256'), 'hex'), TRUE),
            ('privacy_policy', 'v1.0', 'Contenido inicial de Política de Privacidad...', encode(digest('Contenido inicial de Política de Privacidad...', 'sha256'), 'hex'), TRUE)
            ON CONFLICT (type, version) DO NOTHING;

            CREATE TABLE IF NOT EXISTS referral_log (
                id SERIAL PRIMARY KEY,
                referrer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- TRIGGERS DE SEGURIDAD (Movidos al final para asegurar que las tablas existen)
            CREATE TRIGGER trg_immutable_user_agreements
            BEFORE UPDATE OR DELETE ON user_agreements_log
            FOR EACH ROW EXECUTE FUNCTION prevent_event_modification();

            CREATE TRIGGER trg_immutable_legal_documents
            BEFORE UPDATE OR DELETE ON legal_documents
            FOR EACH ROW EXECUTE FUNCTION prevent_event_modification();
        `);
        
        // Insertar configuraciones por defecto
        await client.query(`
            INSERT INTO app_settings (setting_key, setting_value, description) VALUES
            ('allow_new_registrations', 'true', 'Permitir nuevos registros'),
            ('allow_new_publications', 'true', 'Permitir nuevas publicaciones'),
            ('platform_commission_percentage', '5.00', 'Porcentaje de comisión de la plataforma'),
            ('public_profiles_enabled', 'true', 'Habilitar perfiles públicos'),
            ('debt_system_enabled', 'true', 'Habilitar sistema de deudas'),
            ('blue_escrow_days', '1', 'Días de depósito para tokens BLUE'),
            ('blue_escrow_hours', '0', 'Horas de depósito para tokens BLUE'),
            ('blue_escrow_minutes', '5', 'Minutos de depósito para tokens BLUE'),
            ('debt_cycle_days', '30', 'Días del ciclo de deuda'),
            ('debt_cycle_hours', '0', 'Horas del ciclo de deuda'),
            ('debt_cycle_minutes', '0', 'Minutos del ciclo de deuda'),
            ('referral_system_enabled', 'true', 'Habilitar sistema de referidos completo'),
            ('referral_bonus_enabled', 'true', 'Habilitar bonos por referidos (Legacy)'),
            ('referral_bonus_amount', '10.0000', 'Cantidad del bono por referido'),
            ('welcome_bonus_enabled', 'true', 'Habilitar bono de bienvenida'),
            ('welcome_bonus_amount', '25.0000', 'Cantidad del bono de bienvenida'),
            ('pre_launch_mode_enabled', 'true', 'Modo Prelanzamiento (Impulsores y Recompensas)'),
            ('referral_codes_expiry_date', '2025-12-31T23:59:59Z', 'Fecha de expiración de códigos de referido')
            ON CONFLICT (setting_key) DO UPDATE 
            SET setting_value = EXCLUDED.setting_value;
        `);
        
        console.log('✅ Base de datos reseteada correctamente');
        console.log('🎉 Ahora puedes iniciar el servidor sin problemas');
        
    } catch (error) {
        console.error('❌ Error al resetear la base de datos:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

resetDatabase(); 