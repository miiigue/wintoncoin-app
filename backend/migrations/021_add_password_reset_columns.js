// ============================================================================
// Migración 021: Add password reset columns to users table
// ============================================================================
// Adds columns required for the password recovery (forgot password) feature:
// - password_reset_hash:        HMAC hash of the OTP code
// - password_reset_expires_at:  expiration timestamp of the OTP
// - password_reset_attempts:    counter for failed OTP verification attempts
// - password_invalidate_before: timestamp to invalidate all JWT tokens issued before it
// ============================================================================

const { Pool } = require('pg');
require('../config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrationQuery = `
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
`;

async function runMigration() {
    const client = await pool.connect();
    console.log('🚀 Iniciando migración: 021_add_password_reset_columns');

    try {
        await client.query('BEGIN');
        await client.query(migrationQuery);
        await client.query('COMMIT');
        console.log('🎉 Migración 021 completada con éxito.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante la migración 021:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Exportar para el runner
module.exports = {
    up: async (client) => {
        await client.query(migrationQuery);
    }
};

// Auto-ejecución si se llama directamente
if (require.main === module) {
    runMigration();
}
