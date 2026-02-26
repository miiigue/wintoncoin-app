// ============================================================================
// MIGRACIÓN 032: Agregar columna base_pay_platino a momentum_campaigns
// ============================================================================
// Se añade el nivel PLATINO como nueva categoría máxima del sistema Momentum.
// Esto permite a los administradores configurar una tarifa base diferenciada
// para creadores de contenido de nivel Platino en cada campaña.
//
// Valor predeterminado: 2000 BLUE IOU (configurable por campaña).
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 032] Agregando columna base_pay_platino a momentum_campaigns...');

        // Agregar la columna con valor por defecto seguro
        await client.query(`
            ALTER TABLE momentum_campaigns
            ADD COLUMN IF NOT EXISTS base_pay_platino NUMERIC(19,4) DEFAULT 2000;
        `);
        console.log('[MIGRATION 032] ✅ Columna base_pay_platino agregada exitosamente.');

        // NOTA: El tier de los perfiles se almacena como VARCHAR, no como ENUM.
        // No se requiere ALTER TYPE. Si en el futuro se usa ENUM, crear una
        // migración independiente para ello.
    },

    down: async (client) => {
        // Rollback: eliminar la columna en caso de reversión
        await client.query(`
            ALTER TABLE momentum_campaigns
            DROP COLUMN IF EXISTS base_pay_platino;
        `);
        console.log('[MIGRATION 032] ✅ Columna base_pay_platino eliminada (rollback).');
    }
};
