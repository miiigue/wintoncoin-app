// ============================================================================
// Migración 022: Legal documents + acceptance flow hardening
// ============================================================================
// Objetivo:
// - Asegurar tablas legales en todos los entornos.
// - Añadir índice único para evitar duplicidad de aceptaciones.
// - Guardar aceptación legal en pending_verifications durante registro OTP.
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
    -- Tabla de documentos legales versionados
    CREATE TABLE IF NOT EXISTS legal_documents (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        version VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        content_hash VARCHAR(64) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(type, version)
    );

    -- Log de aceptación por usuario
    CREATE TABLE IF NOT EXISTS user_agreements_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL,
        document_version VARCHAR(20) NOT NULL,
        document_hash VARCHAR(64) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        accepted_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Columna para persistir aceptación entre register-request y register-verify
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pending_verifications'
          AND column_name = 'legal_acceptances_json'
    ) THEN
        ALTER TABLE pending_verifications
        ADD COLUMN legal_acceptances_json JSONB;
    END IF;
END $$;
`;

const indexQueries = [
    `CREATE INDEX IF NOT EXISTS idx_legal_documents_active_type ON legal_documents (is_active, type);`,
    `CREATE INDEX IF NOT EXISTS idx_user_agreements_log_user_id ON user_agreements_log (user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_user_agreements_log_user_doc ON user_agreements_log (user_id, document_type, accepted_at DESC);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_user_agreement_doc_version_hash
     ON user_agreements_log (user_id, document_type, document_version, document_hash);`
];

async function runMigration() {
    const client = await pool.connect();
    console.log('🚀 Iniciando migración: 022_create_legal_documents_and_acceptance_flow');

    try {
        await client.query('BEGIN');
        await client.query(migrationQuery);
        for (const query of indexQueries) {
            await client.query(query);
        }
        await client.query('COMMIT');
        console.log('🎉 Migración 022 completada con éxito.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante la migración 022:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

module.exports = {
    up: async (client) => {
        await client.query(migrationQuery);
        for (const query of indexQueries) {
            await client.query(query);
        }
    }
};

if (require.main === module) {
    runMigration();
}
