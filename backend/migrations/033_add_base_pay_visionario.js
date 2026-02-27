// ============================================================================
// MIGRACIÓN 033: Agregar columna base_pay_visionario a momentum_campaigns
// ============================================================================
// Se añade el nivel VISIONARIO como nueva categoría de entrada del sistema Momentum.
// Creadores con 1K - 10K seguidores entran aquí.
// Valor predeterminado: 500 BLUE IOU.
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 033] Agregando columna base_pay_visionario a momentum_campaigns...');

        // Agregar la columna con valor por defecto
        await client.query(`
            ALTER TABLE momentum_campaigns
            ADD COLUMN IF NOT EXISTS base_pay_visionario NUMERIC(19,4) DEFAULT 500;
        `);
        console.log('[MIGRATION 033] ✅ Columna base_pay_visionario agregada exitosamente.');
    },

    down: async (client) => {
        // Rollback: eliminar la columna
        await client.query(`
            ALTER TABLE momentum_campaigns
            DROP COLUMN IF EXISTS base_pay_visionario;
        `);
        console.log('[MIGRATION 033] ✅ Columna base_pay_visionario eliminada (rollback).');
    }
};
