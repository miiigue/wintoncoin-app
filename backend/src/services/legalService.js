const pool = require('../config/db');

function normalizeDoc(row) {
    return {
        type: row.type,
        version: row.version,
        content_hash: row.content_hash
    };
}

async function getActiveLegalDocuments(client = pool) {
    const result = await client.query(
        `SELECT DISTINCT ON (type)
            type,
            version,
            content_hash
         FROM legal_documents
         WHERE is_active = TRUE
         ORDER BY type, created_at DESC, id DESC`
    );
    return result.rows.map(normalizeDoc);
}

async function getLatestAcceptedDocumentsByUser(client, userId) {
    const acceptedResult = await client.query(
        `SELECT DISTINCT ON (document_type)
            document_type,
            document_version,
            document_hash,
            accepted_at
         FROM user_agreements_log
         WHERE user_id = $1
         ORDER BY document_type, accepted_at DESC`,
        [userId]
    );

    const acceptedByType = new Map();
    for (const row of acceptedResult.rows) {
        acceptedByType.set(row.document_type, {
            version: row.document_version,
            content_hash: row.document_hash,
            accepted_at: row.accepted_at
        });
    }
    return acceptedByType;
}

function buildLegalStatus(activeDocs, acceptedByType) {
    if (!Array.isArray(activeDocs) || activeDocs.length === 0) {
        return {
            requires_terms_acceptance: true,
            pending_documents: [],
            active_documents: [],
            legal_config_error: 'NO_ACTIVE_LEGAL_DOCUMENTS'
        };
    }

    const pending_documents = [];

    for (const doc of activeDocs) {
        const accepted = acceptedByType.get(doc.type);
        const isUpToDate = !!accepted
            && accepted.version === doc.version
            && accepted.content_hash === doc.content_hash;

        if (!isUpToDate) {
            pending_documents.push(doc);
        }
    }

    return {
        requires_terms_acceptance: pending_documents.length > 0,
        pending_documents,
        active_documents: activeDocs,
        legal_config_error: null
    };
}

async function getUserLegalStatusByUserId(client, userId) {
    const activeDocs = await getActiveLegalDocuments(client);
    const acceptedByType = await getLatestAcceptedDocumentsByUser(client, userId);
    return buildLegalStatus(activeDocs, acceptedByType);
}

async function getUserLegalStatusByUsername(client, username) {
    const userResult = await client.query(
        `SELECT id FROM users WHERE username = $1`,
        [username]
    );

    if (userResult.rowCount === 0) {
        return null;
    }

    return getUserLegalStatusByUserId(client, userResult.rows[0].id);
}

function validateAcceptedDocumentsPayload(acceptedDocuments) {
    if (!Array.isArray(acceptedDocuments) || acceptedDocuments.length === 0) {
        return {
            isValid: false,
            message: 'Debes aceptar los documentos legales vigentes.'
        };
    }

    const normalized = acceptedDocuments
        .filter(Boolean)
        .map((doc) => ({
            type: String(doc.type || '').trim(),
            version: String(doc.version || '').trim(),
            content_hash: String(doc.content_hash || '').trim()
        }))
        .filter(doc => doc.type && doc.version && doc.content_hash);

    if (normalized.length === 0) {
        return {
            isValid: false,
            message: 'El formato de aceptación legal es inválido.'
        };
    }

    return {
        isValid: true,
        acceptedDocuments: normalized
    };
}

function ensureAllActiveDocumentsAccepted(activeDocs, acceptedDocuments) {
    const acceptedSet = new Set(
        acceptedDocuments.map(doc => `${doc.type}|${doc.version}|${doc.content_hash}`)
    );

    const missingDocs = activeDocs.filter(
        doc => !acceptedSet.has(`${doc.type}|${doc.version}|${doc.content_hash}`)
    );

    return {
        allAccepted: missingDocs.length === 0,
        missingDocs
    };
}

module.exports = {
    getActiveLegalDocuments,
    getUserLegalStatusByUserId,
    getUserLegalStatusByUsername,
    validateAcceptedDocumentsPayload,
    ensureAllActiveDocumentsAccepted
};
