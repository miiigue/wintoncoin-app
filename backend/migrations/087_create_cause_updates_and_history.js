// ============================================================================
// MIGRACIÓN 087: Tablas de Novedades e Historial de Edición de Causas
// ============================================================================
// Propósito: Crear las tablas 'humanitarian_cause_updates' para las bitácoras 
//            de avance y 'humanitarian_cause_history' para auditar los cambios 
//            en la descripción principal (cumplimiento SOC 2).
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 087] Creando tabla humanitarian_cause_updates...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS humanitarian_cause_updates (
                id SERIAL PRIMARY KEY,
                cause_id INTEGER NOT NULL REFERENCES humanitarian_causes(id) ON DELETE CASCADE,
                update_title VARCHAR(255) NOT NULL,
                update_text TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_cause_updates_cause_id ON humanitarian_cause_updates(cause_id);');

        console.log('[MIGRATION 087] Creando tabla humanitarian_cause_history...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS humanitarian_cause_history (
                id SERIAL PRIMARY KEY,
                cause_id INTEGER NOT NULL REFERENCES humanitarian_causes(id) ON DELETE CASCADE,
                old_story TEXT NOT NULL,
                new_story TEXT NOT NULL,
                changed_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_cause_history_cause_id ON humanitarian_cause_history(cause_id);');

        console.log('[MIGRATION 087] ✅ Tablas creadas con éxito.');
    },

    down: async (client) => {
        console.log('[MIGRATION 087] Eliminando tablas de novedades e historial...');
        await client.query('DROP TABLE IF EXISTS humanitarian_cause_history CASCADE;');
        await client.query('DROP TABLE IF EXISTS humanitarian_cause_updates CASCADE;');
        console.log('[MIGRATION 087] ✅ Tablas eliminadas.');
    }
};
