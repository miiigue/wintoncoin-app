// ============================================================================
// MIGRACIÓN 080: Sincronización de precisión decimal en Causas Solidarias
// ============================================================================
// Corrige la definición de los campos de sumatoria (goal_amount y current_amount)
// para que almacenen 4 posiciones decimales DECIMAL(18,4) en lugar de 2,
// asegurando que las fracciones de donaciones (ej. 0.0011) se acumulen
// matemáticamente sin pérdida de precisión en pantalla.
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 080] Ajustando precisión decimal de humanitarian_causes (DECIMAL(18,2) -> DECIMAL(18,4))...');
        
        await client.query(`
            ALTER TABLE humanitarian_causes 
            ALTER COLUMN goal_amount TYPE DECIMAL(18, 4),
            ALTER COLUMN current_amount TYPE DECIMAL(18, 4);
        `);
        
        console.log('[MIGRATION 080] Rehidratando current_amount desde el historial de donaciones...');
        await client.query(`
            UPDATE humanitarian_causes hc
            SET current_amount = COALESCE((
                SELECT SUM(amount)
                FROM humanitarian_donations hd
                WHERE hd.cause_id = hc.id AND hd.status = 'released'
            ), 0);
        `);
        
        console.log('[MIGRATION 080] ✅ Precisión decimal ajustada con éxito.');
    },

    down: async (client) => {
        console.log('[MIGRATION 080] Revirtiendo precisión decimal de humanitarian_causes...');
        
        await client.query(`
            ALTER TABLE humanitarian_causes 
            ALTER COLUMN goal_amount TYPE DECIMAL(18, 2),
            ALTER COLUMN current_amount TYPE DECIMAL(18, 2);
        `);
        
        console.log('[MIGRATION 080] ✅ Reversión de precisión completada.');
    }
};
