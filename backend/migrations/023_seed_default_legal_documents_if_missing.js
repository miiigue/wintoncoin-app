// ============================================================================
// Migración 023: Seed de documentos legales activos por defecto
// ============================================================================
// Objetivo:
// - Evitar entornos locales/demo sin documentos legales activos.
// - Insertar TyC y Privacidad (v1.0) solo cuando no existen activos.
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
require('../config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

function sha256(text) {
    return crypto.createHash('sha256').update(String(text)).digest('hex');
}

function safeRead(filePath, fallback) {
    try {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8');
        }
    } catch (error) {
        console.warn(`[MIGRATION 023] No se pudo leer ${filePath}:`, error.message);
    }
    return fallback;
}

async function seedLegalDocuments(client) {
    const termsPath = path.join(__dirname, '../../frontend/terms.html');
    const privacyPath = path.join(__dirname, '../../frontend/privacy.html');

    const termsContent = safeRead(
        termsPath,
        'Términos y condiciones de uso de la plataforma.'
    );
    const privacyContent = safeRead(
        privacyPath,
        'Política de privacidad y tratamiento de datos personales.'
    );

    const docs = [
        {
            type: 'terms_and_conditions',
            version: 'v1.0',
            content: termsContent,
            content_hash: sha256(termsContent)
        },
        {
            type: 'privacy_policy',
            version: 'v1.0',
            content: privacyContent,
            content_hash: sha256(privacyContent)
        }
    ];

    for (const doc of docs) {
        await client.query(
            `INSERT INTO legal_documents (type, version, content, content_hash, is_active)
             VALUES ($1, $2, $3, $4, TRUE)
             ON CONFLICT (type, version)
             DO UPDATE SET
                content = EXCLUDED.content,
                content_hash = EXCLUDED.content_hash,
                is_active = TRUE`,
            [doc.type, doc.version, doc.content, doc.content_hash]
        );
    }
}

const migrationQuery = `
DO $$
BEGIN
    -- Asegurar tabla (por si migración previa no se aplicó)
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
END $$;
`;

async function runMigration() {
    const client = await pool.connect();
    console.log('🚀 Iniciando migración: 023_seed_default_legal_documents_if_missing');
    try {
        await client.query('BEGIN');
        await client.query(migrationQuery);

        const activeCount = await client.query(
            `SELECT COUNT(*)::int AS count
             FROM legal_documents
             WHERE is_active = TRUE`
        );

        if ((activeCount.rows[0]?.count || 0) === 0) {
            await seedLegalDocuments(client);
            console.log('📄 Documentos legales por defecto sembrados (v1.0).');
        } else {
            console.log('ℹ️ Ya existen documentos legales activos. No se requiere seed.');
        }

        await client.query('COMMIT');
        console.log('🎉 Migración 023 completada con éxito.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante la migración 023:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

module.exports = {
    up: async (client) => {
        await client.query(migrationQuery);
        const activeCount = await client.query(
            `SELECT COUNT(*)::int AS count
             FROM legal_documents
             WHERE is_active = TRUE`
        );
        if ((activeCount.rows[0]?.count || 0) === 0) {
            await seedLegalDocuments(client);
        }
    }
};

if (require.main === module) {
    runMigration();
}
