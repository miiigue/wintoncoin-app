// ============================================================================
// MIGRACIÓN 086: Clasificación de Donaciones Solidarias
// ============================================================================
// Propósito: Agregar columna 'donation_type' para distinguir entre donaciones 
//            voluntarias ('voluntary') y donaciones por referido ('referral').
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 086] Agregando columna donation_type a la tabla humanitarian_donations...');
        
        await client.query(`
            ALTER TABLE humanitarian_donations 
            ADD COLUMN IF NOT EXISTS donation_type VARCHAR(50) NOT NULL DEFAULT 'voluntary';
        `);

        console.log('[MIGRATION 086] ✅ Columna donation_type agregada correctamente.');
    },

    down: async (client) => {
        console.log('[MIGRATION 086] Eliminando columna donation_type de la tabla humanitarian_donations...');
        
        await client.query(`
            ALTER TABLE humanitarian_donations 
            DROP COLUMN IF EXISTS donation_type;
        `);
        
        console.log('[MIGRATION 086] ✅ Columna donation_type eliminada.');
    }
};
