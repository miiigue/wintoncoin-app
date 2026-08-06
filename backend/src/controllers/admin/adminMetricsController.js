'use strict';

const pool = require('../../config/db');

/**
 * Obtiene el conteo consolidado de métricas (badges) para el panel administrativo.
 * Esto evita el problema de N+1 peticiones usando un solo endpoint ligero.
 */
async function getAdminBadges(req, res) {
    const client = await pool.connect();
    try {
        // Ejecutamos consultas ligeras y concurrentes
        const [
            sosVictimsData,
            talentData,
            humanitarianData,
            momentumData,
            publicationsData,
            governanceData
        ] = await Promise.all([
            // SOS Damnificados en verificación
            client.query(`SELECT COUNT(*) as count FROM disaster_victims_registry WHERE status = 'verification'`).catch(() => ({rows:[{count:0}]})),
            // Talento pendiente
            client.query(`SELECT COUNT(*) as count FROM recruitment_proposals WHERE status = 'pending'`).catch(() => ({rows:[{count:0}]})),
            // Causas solidarias pendientes
            client.query(`SELECT COUNT(*) as count FROM humanitarian_causes WHERE status = 'pending'`).catch(() => ({rows:[{count:0}]})),
            // Envíos Momentum pendientes
            client.query(`SELECT COUNT(*) as count FROM momentum_submissions WHERE status = 'pending'`).catch(() => ({rows:[{count:0}]})),
            // Publicaciones con entregas o pagos pendientes de revisión administrativa
            client.query(`
                SELECT COUNT(pa.id) as count 
                FROM publication_acceptances pa
                WHERE pa.status IN ('pending', 'pending_approval', 'completed')
            `).catch(() => ({rows:[{count:0}]})),
            // Gobernanza pendientes
            client.query(`SELECT COUNT(*) as count FROM governance_requests WHERE status = 'pending'`).catch(() => ({rows:[{count:0}]}))
        ]);

        const badges = {
            sos: parseInt(sosVictimsData.rows[0]?.count || 0, 10),
            talent: parseInt(talentData.rows[0]?.count || 0, 10),
            humanitarian: parseInt(humanitarianData.rows[0]?.count || 0, 10),
            momentum: parseInt(momentumData.rows[0]?.count || 0, 10),
            publications: parseInt(publicationsData.rows[0]?.count || 0, 10),
            governance: parseInt(governanceData.rows[0]?.count || 0, 10),
            kyc: 0, // El KYC es manejado on-chain en WintonCoin
            crm: 0  // El CRM es un sistema externo (Zendesk / etc)
        };

        res.status(200).json(badges);
    } catch (error) {
        console.error("[AdminMetricsController] Error al obtener badges:", error);
        res.status(500).json({ message: "Error interno al procesar las notificaciones." });
    } finally {
        client.release();
    }
}

module.exports = {
    getAdminBadges
};
