// ============================================================================
// MIGRACIÓN 037: Reparación de consistencia en momentum_campaigns
// ============================================================================
// Esta migración asegura que las columnas añadidas en migraciones previas (030-033)
// realmente existan en la base de datos de producción.
// ============================================================================

const migrationLogic = async (client) => {
    console.log('[MIGRATION 037] Verificando consistencia de columnas en momentum_campaigns...');

    // 1. Asegurar allow_multiple (falla reportada)
    await client.query(`
        ALTER TABLE momentum_campaigns 
        ADD COLUMN IF NOT EXISTS allow_multiple BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // 2. Asegurar base_pay_visionario
    await client.query(`
        ALTER TABLE momentum_campaigns 
        ADD COLUMN IF NOT EXISTS base_pay_visionario NUMERIC(19, 4) NOT NULL DEFAULT 0
    `);

    // 3. Asegurar base_pay_platino
    await client.query(`
        ALTER TABLE momentum_campaigns 
        ADD COLUMN IF NOT EXISTS base_pay_platino NUMERIC(19, 4) NOT NULL DEFAULT 0
    `);

    console.log('[MIGRATION 037] ✅ Columnas aseguradas en momentum_campaigns.');
};

module.exports = {
    up: async (client) => {
        await migrationLogic(client);
    },
    down: async (client) => {
        // No revertimos por seguridad (son reparaciones)
    }
};
