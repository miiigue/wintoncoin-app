// ============================================================================
// MIGRACIÓN 076: Publicar documentos legales actualizados en la base de datos
// ============================================================================
// Propósito: Leer los archivos terms.html y privacy.html de la carpeta frontend,
//            calcular sus hashes criptográficos y publicarlos como la versión
//            v1.0.1 en la tabla 'legal_documents'. Esto activa automáticamente
//            el bloqueo del middleware para forzar la aceptación a todos los usuarios
//            de desarrollo, staging y producción (incluyendo Render).
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
        console.warn(`[MIGRATION 076] No se pudo leer ${filePath}:`, error.message);
    }
    return fallback;
}

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 076] Iniciando publicación automatizada de documentos legales...');

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

        const versionToPublish = 'v1.0.1';

        // 1. Desactivar documentos legales activos anteriores para forzar actualización
        await client.query(`
            UPDATE legal_documents
            SET is_active = FALSE
            WHERE type IN ('terms_and_conditions', 'privacy_policy') AND is_active = TRUE;
        `);

        // 2. Insertar o actualizar términos y condiciones v1.0.1
        await client.query(`
            INSERT INTO legal_documents (type, version, content, content_hash, is_active)
            VALUES ($1, $2, $3, $4, TRUE)
            ON CONFLICT (type, version)
            DO UPDATE SET
                content = EXCLUDED.content,
                content_hash = EXCLUDED.content_hash,
                is_active = TRUE;
        `, ['terms_and_conditions', versionToPublish, termsContent, termsHash]);

        console.log(`[MIGRATION 076] ✅ Términos y Condiciones publicados (versión: ${versionToPublish}, hash: ${termsHash}).`);

        // 3. Insertar o actualizar política de privacidad v1.0.1
        await client.query(`
            INSERT INTO legal_documents (type, version, content, content_hash, is_active)
            VALUES ($1, $2, $3, $4, TRUE)
            ON CONFLICT (type, version)
            DO UPDATE SET
                content = EXCLUDED.content,
                content_hash = EXCLUDED.content_hash,
                is_active = TRUE;
        `, ['privacy_policy', versionToPublish, privacyContent, privacyHash]);

        console.log(`[MIGRATION 076] ✅ Política de Privacidad publicada (versión: ${versionToPublish}, hash: ${privacyHash}).`);
    },

    down: async (client) => {
        console.log('[MIGRATION 076] Revirtiendo publicación de versión v1.0.1...');

        // Desactivar versión v1.0.1
        await client.query(`
            UPDATE legal_documents
            SET is_active = FALSE
            WHERE version = 'v1.0.1';
        `);

        // Reactivar la última versión v1.0 si existe
        await client.query(`
            UPDATE legal_documents
            SET is_active = TRUE
            WHERE version = 'v1.0';
        `);

        console.log('[MIGRATION 076] ✅ Reversión de versión v1.0.1 completada.');
    }
};
