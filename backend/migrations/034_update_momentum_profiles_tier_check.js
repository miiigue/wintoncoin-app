// ============================================================================
// MIGRACIÓN 034: Actualizar CHECK constraint para incluir VISIONARIO y PLATINO
// ============================================================================
// La tabla momentum_profiles tenía una restricción CHECK que solo permitía
// 'PENDIENTE', 'BRONCE', 'PLATA', 'ORO'.
// Actulizamos para soportar los nuevos niveles.
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 034] Actualizando constraint momentum_profiles_tier_check...');

        // Dropear la restricción antigua (usamos IF EXISTS por precaución)
        await client.query(`
            ALTER TABLE momentum_profiles 
            DROP CONSTRAINT IF EXISTS momentum_profiles_tier_check;
        `);

        // Añadir la nueva restricción con los nuevos valores
        await client.query(`
            ALTER TABLE momentum_profiles
            ADD CONSTRAINT momentum_profiles_tier_check 
            CHECK (tier IN ('PENDIENTE', 'VISIONARIO', 'BRONCE', 'PLATA', 'ORO', 'PLATINO'));
        `);

        console.log('[MIGRATION 034] ✅ Constraint actualizada exitosamente.');
    },

    down: async (client) => {
        console.log('[MIGRATION 034] Revirtiendo constraint momentum_profiles_tier_check...');

        // Rollback: Restaurar la restricción original
        await client.query(`
            ALTER TABLE momentum_profiles
            DROP CONSTRAINT IF EXISTS momentum_profiles_tier_check;
        `);

        await client.query(`
            ALTER TABLE momentum_profiles
            ADD CONSTRAINT momentum_profiles_tier_check 
            CHECK (tier IN ('PENDIENTE', 'BRONCE', 'PLATA', 'ORO'));
        `);
        console.log('[MIGRATION 034] ✅ Constraint revertida.');
    }
};
