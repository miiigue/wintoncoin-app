// ============================================================================
// MIGRACIÓN 035: Actualizar CHECK constraint para incluir RECHAZADO
// ============================================================================
// La tabla momentum_profiles necesita poder cambiar los perfiles no deseados
// de PENDIENTE a RECHAZADO para mantener el panel de solicitudes limpio.
// Actualizamos la restricción del tier para permitir esta transición.
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 035] Actualizando constraint momentum_profiles_tier_check para incluir RECHAZADO...');

        // Dropear la restricción antigua (usamos IF EXISTS por precaución)
        await client.query(`
            ALTER TABLE momentum_profiles 
            DROP CONSTRAINT IF EXISTS momentum_profiles_tier_check;
        `);

        // Añadir la nueva restricción con los nuevos valores
        await client.query(`
            ALTER TABLE momentum_profiles
            ADD CONSTRAINT momentum_profiles_tier_check 
            CHECK (tier IN ('PENDIENTE', 'RECHAZADO', 'VISIONARIO', 'BRONCE', 'PLATA', 'ORO', 'PLATINO'));
        `);

        console.log('[MIGRATION 035] ✅ Constraint actualizada exitosamente para soportar rechazos.');
    },

    down: async (client) => {
        console.log('[MIGRATION 035] Revirtiendo constraint momentum_profiles_tier_check...');

        // Dropear la nueva restricción
        await client.query(`
            ALTER TABLE momentum_profiles
            DROP CONSTRAINT IF EXISTS momentum_profiles_tier_check;
        `);

        // Restaurar la restricción anterior sin el estado RECHAZADO (puede fallar si hay filas en ese estado)
        await client.query(`
            ALTER TABLE momentum_profiles
            ADD CONSTRAINT momentum_profiles_tier_check 
            CHECK (tier IN ('PENDIENTE', 'VISIONARIO', 'BRONCE', 'PLATA', 'ORO', 'PLATINO'));
        `);
        console.log('[MIGRATION 035] ✅ Constraint revertida.');
    }
};
