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
        
        // 2. Recrear las tablas con la estructura correcta
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
                referral_code VARCHAR(255) UNIQUE,
                referred_by_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP WITH TIME ZONE
            );
        `);
        
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
                category VARCHAR(50) NOT NULL DEFAULT 'request'
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
                username VARCHAR(255) NOT NULL,
                type VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                blue_change NUMERIC(19, 4) NOT NULL DEFAULT 0,
                red_change NUMERIC(19, 4) NOT NULL DEFAULT 0,
                related_publication_id INTEGER,
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
                amount NUMERIC(19, 4) NOT NULL,
                unlock_at TIMESTAMPTZ NOT NULL,
                is_released BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
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
            CREATE TABLE IF NOT EXISTS referral_log (
                id SERIAL PRIMARY KEY,
                referrer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
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
            ('referral_bonus_enabled', 'true', 'Habilitar bonos por referidos'),
            ('referral_bonus_amount', '10.0000', 'Cantidad del bono por referido'),
            ('welcome_bonus_enabled', 'false', 'Habilitar bono de bienvenida'),
            ('welcome_bonus_amount', '25.0000', 'Cantidad del bono de bienvenida')
            ON CONFLICT (setting_key) DO NOTHING;
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