/**
 * Migración 047: Recompensa por Voto en Gobernanza
 *
 * Añade la columna `reward_credited` a `governance_votes`:
 *   - Columna booleana NOT NULL DEFAULT FALSE
 *   - Sirve como flag de idempotencia: previene pago doble aunque el evento
 *     se dispare más de una vez (ej.: reintentos de mensaje, caídas parciales).
 *   - El servicio de recompensa ejecuta FOR UPDATE + comprobación antes de pagar.
 *
 * Índice parcial: sólo indexa filas con reward_credited = FALSE.
 * Cuando se marca TRUE deja de aparecer en el índice → el índice es pequeño
 * y el "scan de pendientes" es O(log n) en todo momento.
 *
 * Patrón: up(client) / down(client) — el migration runner maneja
 *         BEGIN, COMMIT, ROLLBACK y client.release() externamente.
 */

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 047] Añadiendo columna reward_credited a governance_votes...');

        // ADD COLUMN IF NOT EXISTS — safe para re-ejecución (idempotente)
        await client.query(`
            ALTER TABLE governance_votes
            ADD COLUMN IF NOT EXISTS reward_credited BOOLEAN NOT NULL DEFAULT FALSE;
        `);

        // Índice parcial: sólo filas aún no pagadas → mínimo footprint en disco
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_gov_votes_reward_pending
                ON governance_votes (request_id, guardian_id)
                WHERE reward_credited = FALSE;
        `);

        console.log('[MIGRATION 047] ✅ reward_credited + índice parcial — completados.');
    },

    down: async (client) => {
        console.log('[MIGRATION 047] Revirtiendo reward_credited...');
        await client.query(`DROP INDEX IF EXISTS idx_gov_votes_reward_pending;`);
        await client.query(`ALTER TABLE governance_votes DROP COLUMN IF EXISTS reward_credited;`);
        console.log('[MIGRATION 047] ✅ Rollback reward_credited — completado.');
    },
};
