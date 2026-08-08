// ============================================================================
// MIGRACIÓN 103: Campos de Perfil de Talento Ampliado (CV URL & Datos Estructurados)
// ============================================================================
// Propósito: Permitir a los postulantes adjuntar enlaces de CV en la nube 
//            (Google Drive, Dropbox, Notion, Web) y datos estructurados de perfil.
// Estándar: Zero-Trust, consultas idempotent ADD COLUMN IF NOT EXISTS.
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 103] Aplicando: cv_url, portfolio_url, github_url, years_experience y cover_letter en recruitment_proposals...');

        await client.query(`
            ALTER TABLE recruitment_proposals
            ADD COLUMN IF NOT EXISTS cv_url VARCHAR(500),
            ADD COLUMN IF NOT EXISTS portfolio_url VARCHAR(500),
            ADD COLUMN IF NOT EXISTS github_url VARCHAR(500),
            ADD COLUMN IF NOT EXISTS years_experience VARCHAR(50),
            ADD COLUMN IF NOT EXISTS cover_letter TEXT;
        `);

        console.log('[MIGRATION 103] ✅ Columnas de reclutamiento ampliadas con éxito.');
    },

    down: async (client) => {
        console.log('[MIGRATION 103] Revirtiendo campos de reclutamiento extendidos...');
        await client.query(`
            ALTER TABLE recruitment_proposals
            DROP COLUMN IF EXISTS cv_url,
            DROP COLUMN IF EXISTS portfolio_url,
            DROP COLUMN IF EXISTS github_url,
            DROP COLUMN IF EXISTS years_experience,
            DROP COLUMN IF EXISTS cover_letter;
        `);
        console.log('[MIGRATION 103] ✅ Migración 103 revertida.');
    }
};
