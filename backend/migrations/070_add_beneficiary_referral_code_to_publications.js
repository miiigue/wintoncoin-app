// ============================================================================
// MIGRACIÓN 070: Añadir columna beneficiary_referral_code a la tabla publications
// ============================================================================
// Permite asociar una publicación de donación con el código de referido del
// beneficiario final (organización).
//
// Formato: compatible con migrationRunner.js (up/down).
// El runner maneja BEGIN/COMMIT/ROLLBACK de forma automática.
// ============================================================================

'use strict';

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 070] Añadiendo columna beneficiary_referral_code a la tabla publications...');
        
        // Agregar columna beneficiary_referral_code de forma segura e idempotente (IF NOT EXISTS)
        await client.query(`
            ALTER TABLE publications
            ADD COLUMN IF NOT EXISTS beneficiary_referral_code VARCHAR(255) DEFAULT NULL;
        `);
        
        console.log('[MIGRATION 070] ✅ Columna beneficiary_referral_code agregada exitosamente.');
    },

    down: async (client) => {
        console.log('[MIGRATION 070] Revirtiendo columna beneficiary_referral_code...');
        
        // Remover la columna de forma segura e idempotente (IF EXISTS)
        await client.query(`
            ALTER TABLE publications
            DROP COLUMN IF EXISTS beneficiary_referral_code;
        `);
        
        console.log('[MIGRATION 070] ✅ Columna eliminada.');
    }
};
