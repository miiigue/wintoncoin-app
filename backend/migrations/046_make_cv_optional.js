// ============================================================================
// MIGRACIÓN 046: Hacer opcional el CV en Reclutamiento
// ============================================================================
// Propósito: Permitir postulaciones sin enviar archivo adjunto.
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 046] Modificando cv_filename a NULLABLE...');

        await client.query(`
            ALTER TABLE recruitment_proposals
            ALTER COLUMN cv_filename DROP NOT NULL;
        `);

        console.log('[MIGRATION 046] ✅ cv_filename ahora es opcional.');
    },

    down: async (client) => {
        console.log('[MIGRATION 046] Revirtiendo cambio...');
        await client.query('ALTER TABLE recruitment_proposals ALTER COLUMN cv_filename SET NOT NULL;');
        console.log('[MIGRATION 046] ✅ Revertido.');
    }
};
