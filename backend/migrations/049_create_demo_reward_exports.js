/**
 * Migración 049: Archivo de Exportaciones Demo (Message Archive)
 *
 * Tabla `demo_reward_exports`:
 *   Almacena una copia firmada de cada exportación para re-descarga.
 *   Sigue el patrón "Message Archive" utilizado en SWIFT y sistemas
 *   bancarios para garantizar la recuperabilidad de archivos de transferencia.
 *
 *   - `file_hash` (UNIQUE): Previene almacenamiento duplicado
 *   - `export_data` (JSONB): Archivo completo con firma HMAC
 *   - `exported_by`: ID del admin que ejecutó la exportación
 *   - `downloaded_count`: Contador de re-descargas (auditoría)
 *
 * Patrón: up(client) / down(client) — migration runner maneja
 *         BEGIN, COMMIT, ROLLBACK y client.release() externamente.
 */

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 049] Creating demo_reward_exports table...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS demo_reward_exports (
                id               SERIAL PRIMARY KEY,
                file_hash        VARCHAR(128) NOT NULL UNIQUE,
                exported_at      TIMESTAMPTZ  NOT NULL,
                exported_by      INTEGER,
                total_guardians  INTEGER      NOT NULL DEFAULT 0,
                total_votes      INTEGER      NOT NULL DEFAULT 0,
                export_data      JSONB        NOT NULL,
                downloaded_count INTEGER      NOT NULL DEFAULT 0,
                created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            );
        `);

        console.log('[MIGRATION 049] ✅ demo_reward_exports — completada.');
    },

    down: async (client) => {
        console.log('[MIGRATION 049] Reverting demo_reward_exports...');
        await client.query(`DROP TABLE IF EXISTS demo_reward_exports;`);
        console.log('[MIGRATION 049] ✅ Rollback — completado.');
    },
};
