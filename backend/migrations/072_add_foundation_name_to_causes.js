// ============================================================================
// MIGRACIÓN 072: Añadir columna foundation_name a la tabla humanitarian_causes
// ============================================================================
// Permite guardar el nombre descriptivo de la fundación o entidad beneficiaria.
//
// Formato: compatible con migrationRunner.js (up/down).
// ============================================================================

'use strict';

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 072] Añadiendo columna foundation_name a la tabla humanitarian_causes...');
        
        // Agregar columna foundation_name de forma segura e idempotente
        await client.query(`
            ALTER TABLE humanitarian_causes
            ADD COLUMN IF NOT EXISTS foundation_name VARCHAR(255) DEFAULT NULL;
        `);
        
        console.log('[MIGRATION 072] ✅ Columna foundation_name agregada exitosamente.');
    },

    down: async (client) => {
        console.log('[MIGRATION 072] Revirtiendo columna foundation_name...');
        
        // Remover la columna de forma segura
        await client.query(`
            ALTER TABLE humanitarian_causes
            DROP COLUMN IF EXISTS foundation_name;
        `);
        
        console.log('[MIGRATION 072] ✅ Columna eliminada.');
    }
};
