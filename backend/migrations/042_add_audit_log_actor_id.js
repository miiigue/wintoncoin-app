// ============================================================================
// MIGRACIÓN 042: Añadir actor_id a audit_log (integridad referencial)
// ============================================================================
// Problema original: audit_log solo almacena actor_username (TEXT), sin FK
// hacia users. Esto impide JOINs confiables y pierde trazabilidad si un
// usuario cambia de nombre.
//
// Solución (estándar fintech):
//   - actor_id INTEGER → FK inmutable hacia users(id) para JOINs y reportes
//   - actor_username TEXT → se conserva como snapshot legible del momento
//
// Ambas columnas coexisten: actor_id es la fuente de verdad para auditoría
// forense; actor_username facilita lectura humana sin JOIN.
//
// Backward compatible: actor_id es nullable para no romper inserts existentes
// que solo pasan username (ej: 'system', 'admin' sin user_id real).
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 042] Añadiendo actor_id a audit_log...');

        await client.query(`
            ALTER TABLE audit_log
            ADD COLUMN IF NOT EXISTS actor_id INTEGER REFERENCES users(id);
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id
            ON audit_log(actor_id)
            WHERE actor_id IS NOT NULL;
        `);

        console.log('[MIGRATION 042] ✅ actor_id añadido a audit_log.');
    },

    down: async (client) => {
        console.log('[MIGRATION 042] Revirtiendo actor_id en audit_log...');
        await client.query('DROP INDEX IF EXISTS idx_audit_log_actor_id;');
        await client.query('ALTER TABLE audit_log DROP COLUMN IF EXISTS actor_id;');
        console.log('[MIGRATION 042] ✅ actor_id eliminado de audit_log.');
    }
};
