/**
 * Migración 096: Tabla de Auditoría Inmutable de Scoring (Winton Trust Score)
 * ════════════════════════════════════════════════════════════════════════════════════
 * Estándar de Ciberseguridad & Auditoría FinTech (SOC 2 / ISO 27001 / Zero-Trust):
 * Registra inmutablemente cada evaluación de scoring y cambio de límite de compromiso RED
 * otorgado a los usuarios. Incorpora un trigger en PostgreSQL que prohíbe operaciones
 * UPDATE o DELETE (Patrón Append-Only Bancario).
 *
 * FORMATO: Moderno (exports.up). El migrationRunner.js inyecta el client transaccional
 * y gestiona BEGIN/COMMIT/ROLLBACK externamente. NO crear pool propio ni transacciones.
 */

exports.up = async (client) => {
    console.log('[MIGRATION 096] Iniciando creación de tabla inmutable user_trust_score_logs...');

    // 1. Crear tabla de auditoría de límites de compromiso RED
    await client.query(`
        CREATE TABLE IF NOT EXISTS user_trust_score_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            wallet_address VARCHAR(255),
            previous_limit NUMERIC(15, 4) NOT NULL DEFAULT 0,
            new_limit NUMERIC(15, 4) NOT NULL DEFAULT 0,
            total_referrals_count INTEGER DEFAULT 0,
            verified_referrals_count INTEGER DEFAULT 0,
            activity_bonus_applied BOOLEAN DEFAULT FALSE,
            calculation_details JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 2. Crear función Trigger de inmutabilidad (Prohíbe UPDATE y DELETE)
    await client.query(`
        CREATE OR REPLACE FUNCTION prevent_trust_score_logs_tampering()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'SOC 2 SECURITY VIOLATION: Los registros de auditoría de score de compromiso son inmutables. No se permite UPDATE ni DELETE.';
        END;
        $$ LANGUAGE plpgsql;
    `);

    // 3. Vincular Trigger a la tabla user_trust_score_logs si no existe
    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_trust_score_logs_immutability'
            ) THEN
                CREATE TRIGGER trg_enforce_trust_score_logs_immutability
                BEFORE UPDATE OR DELETE ON user_trust_score_logs
                FOR EACH ROW EXECUTE FUNCTION prevent_trust_score_logs_tampering();
            END IF;
        END $$;
    `);

    console.log('[MIGRATION 096] ✅ Tabla inmutable user_trust_score_logs y trigger SOC 2 creados exitosamente.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 096] Revirtiendo: Eliminando tabla user_trust_score_logs y trigger...');
    await client.query('DROP TRIGGER IF EXISTS trg_enforce_trust_score_logs_immutability ON user_trust_score_logs');
    await client.query('DROP FUNCTION IF EXISTS prevent_trust_score_logs_tampering()');
    await client.query('DROP TABLE IF EXISTS user_trust_score_logs');
    console.log('[MIGRATION 096] Rollback completado.');
};

