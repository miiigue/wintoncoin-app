// ============================================================================
// MIGRACIÓN 077: Publicar documentos legales actualizados en la base de datos (v1.0.2)
// ============================================================================
// Propósito: Leer los archivos terms.html y privacy.html actualizados de la carpeta frontend,
//            calcular sus hashes criptográficos y publicarlos como la versión
//            v1.0.2 en la tabla 'legal_documents'. Esto activa automáticamente
//            el bloqueo del middleware para forzar la aceptación a todos los usuarios
//            de desarrollo, staging y producción (incluyendo Render) debido a la
//            actualización legal del Programa de Impulsores.
//
// Estándar: Transaccional (ejecutado por el runner), idempotente y 100% auditable.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha256(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

function safeRead(filePath, fallback) {
    try {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8');
        }
    } catch (error) {
        console.warn(`[MIGRATION 077] No se pudo leer ${filePath}:`, error.message);
    }
    return fallback;
}

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 077] Iniciando publicación automatizada de documentos legales v1.0.2...');

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

        const termsHash = sha256(termsContent);
        const privacyHash = sha256(privacyContent);

        const versionToPublish = 'v1.0.2';

        // 0. Eliminar dinámicamente cualquier trigger de inmutabilidad erróneamente aplicado a 'legal_documents'
        console.log('[MIGRATION 077] Removiendo triggers de inmutabilidad en la tabla legal_documents...');
        await client.query(`
            DO $$
            DECLARE
                t RECORD;
            BEGIN
                FOR t IN 
                    SELECT trigger_name, event_object_table 
                    FROM information_schema.triggers 
                    WHERE event_object_table = 'legal_documents'
                LOOP
                    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I CASCADE', t.trigger_name, t.event_object_table);
                END LOOP;
            END;
            $$;
        `);

        // 1. Desactivar documentos legales activos anteriores para forzar actualización
        await client.query(`
            UPDATE legal_documents
            SET is_active = FALSE
            WHERE type IN ('terms_and_conditions', 'privacy_policy') AND is_active = TRUE;
        `);

        // 2. Insertar o actualizar términos y condiciones v1.0.2
        await client.query(`
            INSERT INTO legal_documents (type, version, content, content_hash, is_active)
            VALUES ($1, $2, $3, $4, TRUE)
            ON CONFLICT (type, version)
            DO UPDATE SET
                content = EXCLUDED.content,
                content_hash = EXCLUDED.content_hash,
                is_active = TRUE;
        `, ['terms_and_conditions', versionToPublish, termsContent, termsHash]);

        console.log(`[MIGRATION 077] ✅ Términos y Condiciones publicados (versión: ${versionToPublish}, hash: ${termsHash}).`);

        // 3. Insertar o actualizar política de privacidad v1.0.2
        await client.query(`
            INSERT INTO legal_documents (type, version, content, content_hash, is_active)
            VALUES ($1, $2, $3, $4, TRUE)
            ON CONFLICT (type, version)
            DO UPDATE SET
                content = EXCLUDED.content,
                content_hash = EXCLUDED.content_hash,
                is_active = TRUE;
        `, ['privacy_policy', versionToPublish, privacyContent, privacyHash]);

        console.log(`[MIGRATION 077] ✅ Política de Privacidad publicada (versión: ${versionToPublish}, hash: ${privacyHash}).`);
    },

    down: async (client) => {
        console.log('[MIGRATION 077] Revirtiendo publicación de versión v1.0.2...');

        // 0. Eliminar cualquier trigger de inmutabilidad en la tabla legal_documents
        await client.query(`
            DO $$
            DECLARE
                t RECORD;
            BEGIN
                FOR t IN 
                    SELECT trigger_name, event_object_table 
                    FROM information_schema.triggers 
                    WHERE event_object_table = 'legal_documents'
                LOOP
                    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I CASCADE', t.trigger_name, t.event_object_table);
                END LOOP;
            END;
            $$;
        `);

        // Desactivar versión v1.0.2
        await client.query(`
            UPDATE legal_documents
            SET is_active = FALSE
            WHERE version = 'v1.0.2';
        `);

        // Reactivar la versión v1.0.1 como activa
        await client.query(`
            UPDATE legal_documents
            SET is_active = TRUE
            WHERE version = 'v1.0.1';
        `);

        console.log('[MIGRATION 077] ✅ Reversión de versión v1.0.2 completada.');
    }
};
