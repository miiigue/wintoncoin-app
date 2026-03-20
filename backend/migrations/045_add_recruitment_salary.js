// ============================================================================
// MIGRACIÓN 045: Añadir campo Salario Pretendido al Sistema de Reclutamiento
// ============================================================================
// Propósito: Permitir a los reclutadores visualizar las expectativas económicas.
// Estándar: VARCHAR(100) para flexibilidad en monedas/períodos.
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 045] Aplicando: expected_salary en recruitment_proposals...');

        await client.query(`
            ALTER TABLE recruitment_proposals
            ADD COLUMN IF NOT EXISTS expected_salary VARCHAR(100);
        `);

        console.log('[MIGRATION 045] ✅ Columna añadida con éxito.');
    },

    down: async (client) => {
        console.log('[MIGRATION 045] Revirtiendo cambio...');
        await client.query('ALTER TABLE recruitment_proposals DROP COLUMN IF EXISTS expected_salary;');
        console.log('[MIGRATION 045] ✅ Revertido.');
    }
};
