const pool = require('../config/db');
const {
    getActiveLegalDocuments,
    getUserLegalStatusByUserId,
    validateAcceptedDocumentsPayload
} = require('../services/legalService');

exports.getActiveDocuments = async (req, res) => {
    try {
        const activeDocuments = await getActiveLegalDocuments(pool);
        return res.status(200).json({ activeDocuments });
    } catch (error) {
        console.error('[LEGAL] Error al obtener documentos activos:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

exports.getMyLegalStatus = async (req, res) => {
    const userId = req.user?.userId;
    const username = req.user?.username;

    if (!userId) {
        return res.status(401).json({ message: 'No autenticado.' });
    }

    try {
        const legalStatus = await getUserLegalStatusByUserId(pool, userId);
        return res.status(200).json({
            username,
            ...legalStatus
        });
    } catch (error) {
        console.error('[LEGAL] Error al obtener estado legal del usuario:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

exports.acceptActiveDocuments = async (req, res) => {
    const userId = req.user?.userId;
    const username = req.user?.username;
    const { acceptedDocuments } = req.body;

    if (!userId) {
        return res.status(401).json({ message: 'No autenticado.' });
    }

    const payloadValidation = validateAcceptedDocumentsPayload(acceptedDocuments);
    if (!payloadValidation.isValid) {
        return res.status(400).json({ message: payloadValidation.message });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const activeDocs = await getActiveLegalDocuments(client);
        if (activeDocs.length === 0) {
            await client.query('ROLLBACK');
            return res.status(503).json({
                message: 'No hay documentos legales activos publicados. Intenta nuevamente más tarde.'
            });
        }

        const legalStatusBeforeAccept = await getUserLegalStatusByUserId(client, userId);
        const requiredDocs = legalStatusBeforeAccept.pending_documents || [];

        // Idempotencia: si ya está al día, no intentamos insertar nada.
        if (requiredDocs.length === 0) {
            await client.query('COMMIT');
            return res.status(200).json({
                message: 'Tu cuenta ya tenía los documentos legales al día.',
                username,
                ...legalStatusBeforeAccept
            });
        }

        const acceptedSet = new Set(
            payloadValidation.acceptedDocuments.map(doc => `${doc.type}|${doc.version}|${doc.content_hash}`)
        );
        const missingRequired = requiredDocs.filter(
            doc => !acceptedSet.has(`${doc.type}|${doc.version}|${doc.content_hash}`)
        );

        if (missingRequired.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                message: 'Debes aceptar los documentos legales pendientes.',
                missingDocuments: missingRequired
            });
        }

        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
        const userAgent = req.headers['user-agent'] || 'Unknown';

        for (const doc of requiredDocs) {
            await client.query(
                `INSERT INTO user_agreements_log
                    (user_id, document_type, document_version, document_hash, ip_address, user_agent)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (user_id, document_type, document_version, document_hash) DO NOTHING`,
                [userId, doc.type, doc.version, doc.content_hash, ipAddress, userAgent]
            );
        }

        await client.query('COMMIT');

        const legalStatus = await getUserLegalStatusByUserId(pool, userId);
        return res.status(200).json({
            message: 'Documentos legales aceptados correctamente.',
            username,
            ...legalStatus
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[LEGAL] Error al registrar aceptación legal:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};
