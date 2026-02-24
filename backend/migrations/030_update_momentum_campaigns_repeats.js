// ============================================================================
// MIGRACIÓN 030: Flexibilidad en Campañas Momentum
// ============================================================================
// 1. Añade 'allow_multiple' a momentum_campaigns para permitir repetición.
// 2. Elimina la restricción UNIQUE status en submissions para permitir
//    múltiples aprobaciones si la campaña lo permite.
// ============================================================================

const migrationLogic = async (client) => {
    console.log('[MIGRATION 030] Actualizando momentum_campaigns y submissions...');

    // 1. Añadir columna allow_multiple
    await client.query(`
        ALTER TABLE momentum_campaigns 
        ADD COLUMN IF NOT EXISTS allow_multiple BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // 2. Eliminar la restricción UNIQUE limitada
    // Primero identificamos el nombre de la restricción (por defecto en 029 era implícita)
    // En PostgreSQL, el UNIQUE(profile_id, campaign_id, status) suele llamarse momentum_submissions_profile_id_campaign_id_status_key
    await client.query(`
        ALTER TABLE momentum_submissions 
        DROP CONSTRAINT IF EXISTS momentum_submissions_profile_id_campaign_id_status_key
    `);

    console.log('[MIGRATION 030] ✅ Campañas actualizadas con soporte para repetición.');
};

module.exports = {
    up: async (client) => {
        await migrationLogic(client);
    },
    down: async (client) => {
        await client.query(`
            ALTER TABLE momentum_campaigns DROP COLUMN IF EXISTS allow_multiple
        `);
        // Volvemos a poner la restricción (podría fallar si hay datos duplicados ahora)
        await client.query(`
            ALTER TABLE momentum_submissions 
            ADD CONSTRAINT momentum_submissions_profile_id_campaign_id_status_key 
            UNIQUE (profile_id, campaign_id, status)
        `);
    }
};
