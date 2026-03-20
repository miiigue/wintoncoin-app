// ============================================================================
// MIGRACIÓN 044: Actualización del Sistema de Reclutamiento (Admin Panel)
// ============================================================================
// Contexto: El panel admin de Winton Talent necesita columnas de revisión
// y estados alineados con el flujo real (pending → reviewing → accepted/rejected).
//
// Cambios:
//   1. Nuevas columnas: reviewed_at (TIMESTAMPTZ), reviewer_notes (TEXT)
//   2. Actualización del CHECK constraint de 'status':
//      - Antes: 'pending', 'reviewed', 'interview', 'hired', 'rejected'
//      - Ahora: 'pending', 'reviewing', 'accepted', 'rejected'
//   3. Migración de datos existentes con estados antiguos
//
// ORDEN DE OPERACIONES (crítico para producción):
//   Paso 1: Añadir columnas nuevas
//   Paso 2: Eliminar el CHECK constraint anterior
//   Paso 3: Actualizar registros con estados antiguos (ANTES del nuevo constraint)
//   Paso 4: Añadir nuevo CHECK constraint (DESPUÉS de limpiar datos)
//
// Backward compatible: columnas nuevas son nullable.
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 044] Actualizando tabla recruitment_proposals...');

        // 1. Añadir columnas de revisión administrativa (nullable para backward compat)
        await client.query(`
            ALTER TABLE recruitment_proposals
            ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;
        `);
        console.log('[MIGRATION 044]   ↳ Columnas reviewed_at y reviewer_notes añadidas.');

        // 2. Eliminar el CHECK constraint anterior (si existe)
        //    PostgreSQL genera nombres como "recruitment_proposals_status_check"
        //    Usamos DO $$ block para manejar el caso de que no exista
        await client.query(`
            DO $$
            BEGIN
                ALTER TABLE recruitment_proposals DROP CONSTRAINT IF EXISTS recruitment_proposals_status_check;
            EXCEPTION WHEN undefined_object THEN
                -- El constraint no existe, no pasa nada
                NULL;
            END $$;
        `);
        console.log('[MIGRATION 044]   ↳ CHECK constraint anterior eliminado.');

        // 3. PRIMERO: Actualizar registros existentes que tengan estados antiguos
        //    DEBE ejecutarse ANTES de añadir el nuevo constraint, porque si hay registros
        //    con 'reviewed'/'interview'/'hired', el nuevo constraint los rechazaría.
        const updateResult = await client.query(`
            UPDATE recruitment_proposals SET status = 'reviewing' WHERE status IN ('reviewed', 'interview');
        `);
        const updateResult2 = await client.query(`
            UPDATE recruitment_proposals SET status = 'accepted' WHERE status = 'hired';
        `);
        const totalMigrated = (updateResult.rowCount || 0) + (updateResult2.rowCount || 0);
        console.log(`[MIGRATION 044]   ↳ ${totalMigrated} registros migrados a nuevos estados.`);

        // 4. DESPUÉS: Añadir el nuevo CHECK constraint con los estados correctos
        //    Ahora es seguro porque todos los registros ya tienen estados válidos
        await client.query(`
            ALTER TABLE recruitment_proposals
            ADD CONSTRAINT recruitment_proposals_status_check
            CHECK (status IN ('pending', 'reviewing', 'accepted', 'rejected'));
        `);
        console.log('[MIGRATION 044]   ↳ Nuevo CHECK constraint aplicado.');

        console.log('[MIGRATION 044] ✅ Tabla recruitment_proposals actualizada correctamente.');
    },

    down: async (client) => {
        console.log('[MIGRATION 044] Revirtiendo actualización de reclutamiento...');

        // Eliminar columnas añadidas
        await client.query(`
            ALTER TABLE recruitment_proposals
            DROP COLUMN IF EXISTS reviewed_at,
            DROP COLUMN IF EXISTS reviewer_notes;
        `);

        // Eliminar CHECK constraint actual
        await client.query(`
            DO $$
            BEGIN
                ALTER TABLE recruitment_proposals DROP CONSTRAINT IF EXISTS recruitment_proposals_status_check;
            EXCEPTION WHEN undefined_object THEN
                NULL;
            END $$;
        `);

        // Restaurar CHECK constraint original
        await client.query(`
            ALTER TABLE recruitment_proposals
            ADD CONSTRAINT recruitment_proposals_status_check
            CHECK (status IN ('pending', 'reviewed', 'interview', 'hired', 'rejected'));
        `);

        console.log('[MIGRATION 044] ✅ Revertido.');
    }
};

