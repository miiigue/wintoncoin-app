const { Pool } = require('pg');
require('dotenv').config();

// Configuración de conexión que prioriza DATABASE_URL para producción
const pool = new Pool(
    process.env.DATABASE_URL 
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        }
        : {
            user: 'postgres',
            host: 'localhost',
            database: 'wintoncoin_dev',
            password: 'Miiiguebotbinance',
            port: 5432,
        }
);

async function resetProductionDatabase() {
    const client = await pool.connect();
    try {
        console.log('🚨 INICIANDO RESET COMPLETO DE PRODUCCIÓN...');
        console.log('⚠️  ADVERTENCIA: Esto eliminará TODOS los datos existentes');
        
        // Confirmación de seguridad
        if (process.env.NODE_ENV === 'production') {
            console.log('🔒 AMBIENTE DE PRODUCCIÓN DETECTADO');
            console.log('📋 Verificando variable de entorno RESET_PRODUCTION...');
            
            if (process.env.RESET_PRODUCTION !== 'true') {
                console.log('❌ RESET_PRODUCTION no está habilitado. Para continuar:');
                console.log('   1. Agregar RESET_PRODUCTION=true en variables de entorno');
                console.log('   2. Hacer deploy');
                console.log('   3. Remover la variable después del reset');
                return;
            }
        }

        await client.query('BEGIN');

        console.log('🗑️  Eliminando todas las tablas...');
        
        // 1. Eliminar todas las tablas existentes
        await client.query(`
            DO $$ DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
                END LOOP;
            END $$;
        `);
        
        console.log('✅ Todas las tablas eliminadas');

        // 2. Recrear estructura completa
        console.log('🏗️  Recreando estructura de base de datos...');
        
        // Tabla de usuarios
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                liquid_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
                escrow_blue_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
                red_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
                average_rating REAL NOT NULL DEFAULT 0,
                ratings_count INTEGER NOT NULL DEFAULT 0,
                email VARCHAR(255) UNIQUE,
                phone VARCHAR(50) UNIQUE,
                referral_code VARCHAR(20) UNIQUE,
                referrer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                is_booster BOOLEAN DEFAULT FALSE,
                booster_level INTEGER DEFAULT 1,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Tabla de publicaciones
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
                is_booster_task BOOLEAN NOT NULL DEFAULT FALSE,
                allow_repeat_participation BOOLEAN DEFAULT FALSE,
                max_repeat_per_user INTEGER DEFAULT 1,
                repeat_cooldown_hours INTEGER DEFAULT 24
            );
        `);

        // Tabla de aceptaciones
        await client.query(`
            CREATE TABLE IF NOT EXISTS publication_acceptances (
                id SERIAL PRIMARY KEY,
                publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
                acceptor_username VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending_approval',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // Tabla de notificaciones
        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                recipient_username VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // Tabla de transacciones
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
                related_acceptance_id INTEGER,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // Tabla de calificaciones
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

        // Tabla de deudas RED
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

        // Tabla de configuraciones
        await client.query(`
            CREATE TABLE IF NOT EXISTS app_settings (
                setting_key VARCHAR(255) PRIMARY KEY,
                setting_value TEXT NOT NULL,
                description TEXT
            );
        `);

        // Tabla de depósitos BLUE
        await client.query(`
            CREATE TABLE IF NOT EXISTS blue_token_escrows (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                amount NUMERIC(19, 4) NOT NULL,
                unlock_at TIMESTAMPTZ NOT NULL,
                is_released BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // Tabla de billetera de plataforma
        await client.query(`
            CREATE TABLE IF NOT EXISTS platform_wallet (
                id INT PRIMARY KEY DEFAULT 1,
                total_blue_commission_balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000
            );
        `);

        // Tabla de log de comisiones
        await client.query(`
            CREATE TABLE IF NOT EXISTS platform_commission_log (
                id SERIAL PRIMARY KEY,
                related_publication_id INTEGER REFERENCES publications(id) ON DELETE SET NULL,
                related_user_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
                commission_amount_blue NUMERIC(15, 4) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Tabla de log de referidos
        await client.query(`
            CREATE TABLE IF NOT EXISTS referral_log (
                id SERIAL PRIMARY KEY,
                referrer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Tabla de niveles de impulsores
        await client.query(`
            CREATE TABLE IF NOT EXISTS booster_levels (
                level INTEGER PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                min_blue_required NUMERIC(19, 4) NOT NULL,
                description TEXT
            );
        `);

        // Tabla de perfiles de impulsores
        await client.query(`
            CREATE TABLE IF NOT EXISTS booster_profiles (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                blue_accumulated NUMERIC(19, 4) DEFAULT 0,
                level INTEGER DEFAULT 1,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Tabla de transacciones de impulsores
        await client.query(`
            CREATE TABLE IF NOT EXISTS booster_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                amount NUMERIC(19, 4) NOT NULL,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Tabla de libro mayor de impulsores
        await client.query(`
            CREATE TABLE IF NOT EXISTS booster_blue_ledger (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount NUMERIC(19, 4) NOT NULL,
                source_publication_id INTEGER REFERENCES publications(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // Tabla de log de pagos de impulsores
        await client.query(`
            CREATE TABLE IF NOT EXISTS booster_payment_log (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount_paid NUMERIC(19, 4) NOT NULL,
                payment_month DATE NOT NULL,
                booster_level_at_payment INTEGER NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        console.log('✅ Estructura de base de datos recreada');

        // 3. Insertar configuraciones por defecto
        console.log('⚙️  Configurando valores por defecto...');
        
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
            ('welcome_bonus_enabled', 'true', 'Habilitar bono de bienvenida'),
            ('welcome_bonus_amount', '25.0000', 'Cantidad del bono de bienvenida'),
            ('booster_system_enabled', 'true', 'Habilitar sistema de impulsores'),
            ('referral_system_enabled', 'true', 'Habilitar sistema de referidos'),
            ('referral_reward_amount', '10.0000', 'Cantidad de recompensa por referido'),
            -- NUEVOS AJUSTES PARA GESTIÓN DE FASES Y PUBLICACIONES
            ('pre_launch_mode_enabled', 'false', 'Activa el modo pre-lanzamiento (todas las ganancias a perfil impulsor).'),
            ('allow_request_publications', 'true', 'Permitir crear publicaciones de tipo "Solicitud".'),
            ('allow_sell_publications', 'true', 'Permitir crear publicaciones de tipo "Venta/Servicio".'),
            ('allow_donation_publications', 'true', 'Permitir crear publicaciones de tipo "Donación".')
            ON CONFLICT (setting_key) DO NOTHING;
        `);

        // 4. Insertar niveles de impulsores por defecto
        await client.query(`
            INSERT INTO booster_levels (level, name, min_blue_required, description) VALUES
            (1, 'Impulsor Inicial', 0, 'El primer paso en tu viaje como impulsor.'),
            (2, 'Impulsor Bronce', 1001, 'Has demostrado un compromiso constante.'),
            (3, 'Impulsor Plata', 10001, 'Un pilar importante en la comunidad.'),
            (4, 'Impulsor Oro', 50001, 'Una fuerza motriz para el crecimiento de la plataforma.'),
            (5, 'Impulsor Platino', 100001, 'Reconocido como un Socio Estratégico clave.')
            ON CONFLICT (level) DO NOTHING;
        `);

        // 5. Crear usuario de plataforma
        const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
        const platformPassword = process.env.PLATFORM_USER_PASSWORD || 'temporal_insegura_cambiar_urgente';
        const bcrypt = require('bcrypt');
        const passwordHash = await bcrypt.hash(platformPassword, 10);
        
        await client.query(`
            INSERT INTO users (username, password_hash, email, phone, is_booster, booster_level) VALUES
            ($1, $2, $3, $4, true, 5)
            ON CONFLICT (username) DO NOTHING;
        `, [
            platformUsername, 
            passwordHash, 
            'platform@wintoncoin.io', 
            '000000-platform'
        ]);

        // 6. Inicializar billetera de plataforma
        await client.query(`
            INSERT INTO platform_wallet (id, total_blue_commission_balance) VALUES (1, 0.0000)
            ON CONFLICT (id) DO NOTHING;
        `);

        await client.query('COMMIT');
        
        console.log('✅ RESET COMPLETO EXITOSO');
        console.log('🎉 Base de datos lista para pruebas reales');
        console.log('📋 Usuario de plataforma creado:', platformUsername);
        console.log('🔑 Contraseña temporal:', platformPassword);
        console.log('⚠️  IMPORTANTE: Cambiar la contraseña de la plataforma en producción');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante el reset:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Solo ejecutar si se llama directamente
if (require.main === module) {
    resetProductionDatabase()
        .then(() => {
            console.log('✅ Reset completado exitosamente');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Error en reset:', error);
            process.exit(1);
        });
}

module.exports = { resetProductionDatabase }; 