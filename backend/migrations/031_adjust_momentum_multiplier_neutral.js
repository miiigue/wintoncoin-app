// ============================================================================
// MIGRACIÓN 031: Ajuste de Multiplicador Momentum a valor Neutral (1x)
// ============================================================================
// Siguiendo estándares de auditoría y control de riesgos económicos, se ajusta
// el multiplicador por defecto de 15x a 1x.
//
// Razón: Mantener un baseline de 1x asegura que los pagos base definidos en las
// campañas sean los efectivamente pagados, a menos que el Admin decida 
// explícitamente aplicar una aceleración (Momentum).
// ============================================================================

const migrationLogic = async (client) => {
    console.log('[MIGRATION 031] Ajustando multiplicador global a 1 (Neutral)...');

    // 1. Actualizar el valor actual en la configuración global
    await client.query(`
        UPDATE momentum_global_config 
        SET multiplier = 1, 
            updated_at = NOW() 
        WHERE id = 1
    `);

    console.log('[MIGRATION 031] ✅ Multiplicador ajustado con éxito.');
};

module.exports = {
    up: async (client) => {
        await migrationLogic(client);
    },
    down: async (client) => {
        // En caso de rollback, volvemos al valor previo conocido (15), 
        // aunque lo ideal es manejarlo desde el panel.
        await client.query(`
            UPDATE momentum_global_config 
            SET multiplier = 15, 
                updated_at = NOW() 
            WHERE id = 1
        `);
    }
};
