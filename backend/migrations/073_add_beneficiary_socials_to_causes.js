// ============================================================================
// MIGRACIÓN 073: Añadir columna beneficiary_socials a la tabla humanitarian_causes
// ============================================================================
// Permite guardar enlaces a las redes sociales del beneficiario (si los hay).
//
// Formato: compatible con migrationRunner.js (up/down).
// ============================================================================

'use strict';

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 073] Añadiendo columna beneficiary_socials a la tabla humanitarian_causes...');
        
        // Agregar columna beneficiary_socials de forma segura e idempotente
        await client.query(`
            ALTER TABLE humanitarian_causes
            ADD COLUMN IF NOT EXISTS beneficiary_socials TEXT DEFAULT NULL;
        `);
        
        console.log('[MIGRATION 073] ✅ Columna beneficiary_socials agregada exitosamente.');
    },

    down: async (client) => {
        console.log('[MIGRATION 073] Revirtiendo columna beneficiary_socials...');
        
        // Remover la columna de forma segura
        await client.query(`
            ALTER TABLE humanitarian_causes
            DROP COLUMN IF EXISTS beneficiary_socials;
        `);
        
        console.log('[MIGRATION 073] ✅ Columna eliminada.');
    }
};
