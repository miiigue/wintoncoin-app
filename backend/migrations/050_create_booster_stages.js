/**
 * Migración 050: Sistema de Multiplicadores por Etapas (Boosters)
 *
 * Esta tabla permite definir ventanas de tiempo (Etapas) con multiplicadores
 * de recompensa específicos. Es fundamental para el protocolo de compensación
 * de pre-lanzamiento de WintonCoin.
 *
 * Campos:
 *   - name        → Identificador de la etapa (ej: "Etapa 1")
 *   - start_date  → Inicio del periodo de validez
 *   - end_date    → Fin del periodo de validez
 *   - multiplier  → Factor de multiplicación (ej: 20, 15, 9, 5, 3)
 *   - is_active   → Si la etapa está activa para el cálculo
 *
 * Constraints:
 *   - dates_check:        start_date < end_date (integridad temporal)
 *   - multiplier_positive: multiplier > 0 (no hay multiplicador cero ni negativo)
 *
 * Índices:
 *   - idx_booster_stages_active_dates: rendimiento en búsquedas por rango de fecha
 *
 * Patrón: up(client) / down(client) — el migration runner maneja
 *         BEGIN, COMMIT, ROLLBACK y client.release() externamente.
 */

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 050] Creando tabla de configuración de etapas de Boosters...');

        // ── 1. Crear tabla con constraints de integridad ─────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS booster_config_stages (
                id              SERIAL PRIMARY KEY,
                name            VARCHAR(50) NOT NULL,
                start_date      TIMESTAMP WITH TIME ZONE NOT NULL,
                end_date        TIMESTAMP WITH TIME ZONE NOT NULL,
                multiplier      NUMERIC(10, 2) NOT NULL DEFAULT 1.0,
                is_active       BOOLEAN DEFAULT TRUE,
                created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

                CONSTRAINT dates_check CHECK (start_date < end_date),
                CONSTRAINT multiplier_positive CHECK (multiplier > 0)
            );
        `);

        // ── 2. Índice de rendimiento para consultas por rango de fecha ──
        // calculateMultipliedAmount() busca: WHERE start_date <= $1 AND end_date >= $1 AND is_active = TRUE
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_booster_stages_active_dates
                ON booster_config_stages (start_date, end_date)
                WHERE is_active = TRUE;
        `);

        // ── 3. Insertar etapas iniciales según protocolo documentado ────
        // Fuente: boosters.wintoncoin.com → Tabla de Multiplicadores
        //
        //   Etapa 1: Mayo 2025 – Octubre 2025 → 20x
        //   Etapa 2: Noviembre 2025 – Abril 2026 → 15x
        //   Etapa 3: Mayo 2026 – Octubre 2026 → 9x
        //   Etapa 4: Noviembre 2026 – Enero 2027 → 5x
        //   Etapa 5: 1–14 Febrero 2027 → 3x
        //
        // ON CONFLICT: Idempotencia — si la migración se re-ejecuta, no falla
        // La migración es idempotente gracias a IF NOT EXISTS y este approach:
        // verificamos si ya existen datos antes de insertar.
        const existingCheck = await client.query(
            `SELECT COUNT(*) as count FROM booster_config_stages`
        );

        if (parseInt(existingCheck.rows[0].count, 10) === 0) {
            await client.query(`
                INSERT INTO booster_config_stages (name, start_date, end_date, multiplier)
                VALUES
                    ('Etapa 1', '2025-05-01 00:00:00+00', '2025-10-31 23:59:59+00', 20.00),
                    ('Etapa 2', '2025-11-01 00:00:00+00', '2026-04-30 23:59:59+00', 15.00),
                    ('Etapa 3', '2026-05-01 00:00:00+00', '2026-10-31 23:59:59+00',  9.00),
                    ('Etapa 4', '2026-11-01 00:00:00+00', '2027-01-31 23:59:59+00',  5.00),
                    ('Etapa 5', '2027-02-01 00:00:00+00', '2027-02-14 23:59:59+00',  3.00);
            `);
            console.log('[MIGRATION 050] 5 etapas iniciales de multiplicadores insertadas.');
        } else {
            console.log('[MIGRATION 050] Etapas ya existen, omitiendo inserción inicial.');
        }

        console.log('[MIGRATION 050] ✅ Etapas de Boosters — completada.');
    },

    down: async (client) => {
        console.log('[MIGRATION 050] Revirtiendo tabla de etapas de Boosters...');
        await client.query(`DROP TABLE IF EXISTS booster_config_stages CASCADE;`);
        console.log('[MIGRATION 050] ✅ Rollback de etapas de Boosters — completado.');
    }
};
