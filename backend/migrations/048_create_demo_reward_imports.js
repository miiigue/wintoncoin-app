/**
 * Migración 048: Infraestructura para Transferencia de Recompensas Demo → Producción
 *
 * Tabla `demo_reward_imports`:
 *   Registra cada archivo de recompensas importado desde un entorno demo.
 *   El campo `file_hash` (UNIQUE) previene importaciones duplicadas.
 *   `vote_ids_json` almacena los IDs de votos demo procesados para
 *   deduplicación a nivel de voto individual (defensa en profundidad).
 *
 * Columna `governance_votes.demo_exported_at`:
 *   Marca la fecha en que un voto fue incluido en un reporte de exportación.
 *   Votos con demo_exported_at IS NULL son candidatos para la próxima exportación.
 *
 * Patrón: up(client) / down(client) — migration runner maneja
 *         BEGIN, COMMIT, ROLLBACK y client.release() externamente.
 */

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 048] Creating demo_reward_imports table...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS demo_reward_imports (
                id              SERIAL PRIMARY KEY,
                file_hash       VARCHAR(128) NOT NULL UNIQUE,
                source_env      VARCHAR(50)  NOT NULL DEFAULT 'demo',
                exported_at     TIMESTAMPTZ  NOT NULL,
                imported_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                imported_by     INTEGER,
                total_guardians INTEGER      NOT NULL DEFAULT 0,
                total_votes     INTEGER      NOT NULL DEFAULT 0,
                total_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,
                rate_used       NUMERIC(18,2) NOT NULL DEFAULT 0,
                vote_ids_json   JSONB        NOT NULL DEFAULT '[]',
                metadata        JSONB        DEFAULT '{}'
            );
        `);

        console.log('[MIGRATION 048] Adding demo_exported_at column to governance_votes...');

        await client.query(`
            ALTER TABLE governance_votes
            ADD COLUMN IF NOT EXISTS demo_exported_at TIMESTAMPTZ;
        `);

        console.log('[MIGRATION 048] ✅ demo_reward_imports + demo_exported_at — completados.');
    },

    down: async (client) => {
        console.log('[MIGRATION 048] Reverting demo_reward_imports...');
        await client.query(`DROP TABLE IF EXISTS demo_reward_imports;`);
        await client.query(`ALTER TABLE governance_votes DROP COLUMN IF EXISTS demo_exported_at;`);
        console.log('[MIGRATION 048] ✅ Rollback — completado.');
    },
};
