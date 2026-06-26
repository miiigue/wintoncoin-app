// ============================================================================
// MIGRACIÓN 071: Añadir columna beneficiary_referral_code a la tabla humanitarian_causes
// ============================================================================
// Permite asociar una causa humanitaria con el código de referido del
// beneficiario final (organización), posibilitando que se registren a favor de éste.
//
// Formato: compatible con migrationRunner.js (up/down).
// El runner maneja BEGIN/COMMIT/ROLLBACK de forma automática.
// ============================================================================

'use strict';

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 071] Añadiendo columna beneficiary_referral_code a la tabla humanitarian_causes...');
        
        // Agregar columna beneficiary_referral_code de forma segura e idempotente (IF NOT EXISTS)
        await client.query(`
            ALTER TABLE humanitarian_causes
            ADD COLUMN IF NOT EXISTS beneficiary_referral_code VARCHAR(255) DEFAULT NULL;
        `);
        
        console.log('[MIGRATION 071] ✅ Columna beneficiary_referral_code agregada exitosamente.');
    },

    down: async (client) => {
        console.log('[MIGRATION 071] Revirtiendo columna beneficiary_referral_code...');
        
        // Remover la columna de forma segura e idempotente (IF EXISTS)
        await client.query(`
            ALTER TABLE humanitarian_causes
            DROP COLUMN IF EXISTS beneficiary_referral_code;
        `);
        
        console.log('[MIGRATION 071] ✅ Columna eliminada.');
    }
};
