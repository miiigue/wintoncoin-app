const pool = require('../config/db');
const cron = require('node-cron');

// =================================================================================
// == AUDIT LOG (Bank-grade traceability) =========================================
// =================================================================================
// Append-only audit events. Do NOT store secrets (passwords/tokens/private keys).
// Retention: 48 months (cleanup job below).

async function logAuditEvent(clientOrPool, req, {
    eventType,
    actorId = null,
    actorUsername = null,
    targetUsername = null,
    publicationId = null,
    category = null,
    metadata = {}
}) {
    try {
        const ipAddress = req?.clientIp || req?.ip || null;
        const userAgent = req?.headers?.['user-agent'] || null;
        const sql = `
            INSERT INTO audit_log
                (event_type, actor_id, actor_username, target_username, publication_id, category, ip_address, user_agent, metadata)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        `;
        const params = [
            eventType,
            actorId,
            actorUsername,
            targetUsername,
            publicationId,
            category,
            ipAddress,
            userAgent,
            JSON.stringify(metadata || {})
        ];
        await clientOrPool.query(sql, params);
    } catch (err) {
        console.error('[AUDIT_LOG] Failed to write audit event:', err);
    }
}

// Retention cleanup (48 months): run daily at 03:15 server time
function startAuditCleanupJob() {
    cron.schedule('15 3 * * *', async () => {
        try {
            const retentionMonths = 48;
            await pool.query(`DELETE FROM audit_log WHERE created_at < NOW() - ($1 || ' months')::interval`, [retentionMonths]);
            console.log('[AUDIT_LOG] Retention cleanup completed.');
        } catch (err) {
            console.error('[AUDIT_LOG] Retention cleanup failed:', err);
        }
    });
}

module.exports = {
    logAuditEvent,
    startAuditCleanupJob
};
