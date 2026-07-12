// ============================================================================
// MIGRACIÓN 088: Columna accepted_terms en humanitarian_donations
// ============================================================================
// Propósito: Añadir la columna 'accepted_terms' para registrar el consentimiento
//            explícito del donante con los TyC de la campaña (SOC 2 Compliant).
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 088] Añadiendo columna accepted_terms a humanitarian_donations...');
        await client.query(`
            ALTER TABLE humanitarian_donations 
            ADD COLUMN IF NOT EXISTS accepted_terms BOOLEAN NOT NULL DEFAULT FALSE;
        `);
        
        // Marcar donaciones existentes como aceptadas para consistencia retroactiva
        await client.query(`
            UPDATE humanitarian_donations 
            SET accepted_terms = TRUE;
        `);
        
        console.log('[MIGRATION 088] ✅ Columna accepted_terms añadida.');
    },

    down: async (client) => {
        console.log('[MIGRATION 088] Eliminando columna accepted_terms de humanitarian_donations...');
        await client.query(`
            ALTER TABLE humanitarian_donations 
            DROP COLUMN IF EXISTS accepted_terms;
        `);
        console.log('[MIGRATION 088] ✅ Columna accepted_terms eliminada.');
    }
};
