/**
 * Migración 041: Sistema de Gobernanza Winton-Consensus
 *
 * Crea la infraestructura completa para gobernanza multifirma:
 *   - governance_guardians        → Supervisores y auxiliares con credenciales WebAuthn
 *   - governance_requests         → Solicitudes de cambio con Time-Lock y expiración
 *   - governance_votes            → Votos con firma criptográfica (WebAuthn)
 *   - governance_webauthn_challenges → Challenges temporales para biometría
 *   - governance_recovery_codes   → Códigos de recuperación Break Glass (M-de-N)
 *   - governance_break_glass_log  → Auditoría de emergencias
 *
 * Principios de diseño:
 *   1. Maker ≠ Checker — quien propone no puede aprobar
 *   2. Quórum simétrico — rechazo requiere mismo quórum que aprobación
 *   3. Time-Lock 48h — cambios de membresía con ventana de cancelación
 *   4. Break Glass — recuperación de emergencia con M-de-N códigos
 *   5. Biometría obligatoria — votos requieren firma WebAuthn
 *
 * Patrón: up(client) / down(client) — el migration runner maneja
 *         BEGIN, COMMIT, ROLLBACK y client.release() externamente.
 */

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 041] Creando esquema de gobernanza Winton-Consensus...');

        // ─── 1. Guardianes del Sistema ──────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS governance_guardians (
                id                      SERIAL PRIMARY KEY,
                user_id                 INTEGER REFERENCES users(id) ON DELETE CASCADE,
                role                    VARCHAR(20) NOT NULL
                                            CHECK (role IN ('supervisor', 'auxiliary')),
                status                  VARCHAR(20) DEFAULT 'active'
                                            CHECK (status IN ('active', 'inactive', 'suspended')),
                webauthn_credential_id  TEXT,
                webauthn_public_key     TEXT,
                webauthn_counter        BIGINT DEFAULT 0,
                webauthn_transports     TEXT[],
                appointed_by            INTEGER REFERENCES users(id),
                created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id)
            );
        `);

        // ─── 2. Solicitudes de Gobernanza ───────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS governance_requests (
                id                  SERIAL PRIMARY KEY,
                requester_id        INTEGER REFERENCES users(id),
                action_type         VARCHAR(50) NOT NULL,
                target_key          VARCHAR(100),
                old_value           JSONB,
                new_value           JSONB,
                status              VARCHAR(20) DEFAULT 'pending'
                                        CHECK (status IN (
                                            'pending', 'approved', 'rejected',
                                            'expired', 'executed', 'cancelled'
                                        )),
                description         TEXT,
                created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                expires_at          TIMESTAMP WITH TIME ZONE NOT NULL,
                execution_time      TIMESTAMP WITH TIME ZONE,
                executed_at         TIMESTAMP WITH TIME ZONE,
                cancelled_by        INTEGER REFERENCES users(id),
                cancelled_at        TIMESTAMP WITH TIME ZONE,
                metadata            JSONB
            );
        `);

        // ─── 3. Votos con Firma Criptográfica ──────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS governance_votes (
                id                  SERIAL PRIMARY KEY,
                request_id          INTEGER REFERENCES governance_requests(id) ON DELETE CASCADE,
                guardian_id         INTEGER REFERENCES governance_guardians(id),
                vote                VARCHAR(20) NOT NULL
                                        CHECK (vote IN ('approve', 'reject')),
                signature           TEXT,
                authenticator_data  TEXT,
                client_data_json    TEXT,
                challenge           TEXT,
                created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(request_id, guardian_id)
            );
        `);

        // ─── 4. Challenges WebAuthn (temporales, 5 min TTL) ────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS governance_webauthn_challenges (
                id              SERIAL PRIMARY KEY,
                user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
                challenge       TEXT NOT NULL,
                type            VARCHAR(20) NOT NULL
                                    CHECK (type IN ('registration', 'authentication')),
                request_id      INTEGER REFERENCES governance_requests(id),
                expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
                used            BOOLEAN DEFAULT FALSE,
                created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // ─── 5. Códigos de Recuperación Break Glass ────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS governance_recovery_codes (
                id                  SERIAL PRIMARY KEY,
                code_index          INTEGER NOT NULL,
                code_hash           TEXT NOT NULL,
                total_codes         INTEGER NOT NULL,
                threshold           INTEGER NOT NULL,
                holder_description  TEXT NOT NULL,
                is_used             BOOLEAN DEFAULT FALSE,
                used_at             TIMESTAMP WITH TIME ZONE,
                created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                invalidated_at      TIMESTAMP WITH TIME ZONE
            );
        `);

        // ─── 6. Log de Emergencias Break Glass ─────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS governance_break_glass_log (
                id              SERIAL PRIMARY KEY,
                initiated_by    TEXT NOT NULL,
                reason          TEXT NOT NULL,
                codes_used      INTEGER[],
                action_taken    TEXT NOT NULL,
                result          VARCHAR(20)
                                    CHECK (result IN ('success', 'failure')),
                ip_address      TEXT,
                user_agent      TEXT,
                evidence        JSONB,
                created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // ─── 7. Índices de Rendimiento ──────────────────────────────────
        await client.query(`CREATE INDEX IF NOT EXISTS idx_gov_guardians_status ON governance_guardians(status);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_gov_requests_status ON governance_requests(status);`);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_gov_requests_timelock
                ON governance_requests(status, execution_time)
                WHERE status = 'approved' AND execution_time IS NOT NULL;
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_gov_requests_expiry
                ON governance_requests(status, expires_at)
                WHERE status = 'pending';
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_gov_votes_request ON governance_votes(request_id);`);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_gov_challenges_lookup
                ON governance_webauthn_challenges(user_id, type)
                WHERE used = FALSE;
        `);

        console.log('[MIGRATION 041] ✅ Gobernanza Winton-Consensus — completada.');
    },

    down: async (client) => {
        console.log('[MIGRATION 041] Revirtiendo gobernanza Winton-Consensus...');
        await client.query('DROP TABLE IF EXISTS governance_break_glass_log CASCADE;');
        await client.query('DROP TABLE IF EXISTS governance_recovery_codes CASCADE;');
        await client.query('DROP TABLE IF EXISTS governance_webauthn_challenges CASCADE;');
        await client.query('DROP TABLE IF EXISTS governance_votes CASCADE;');
        await client.query('DROP TABLE IF EXISTS governance_requests CASCADE;');
        await client.query('DROP TABLE IF EXISTS governance_guardians CASCADE;');
        console.log('[MIGRATION 041] ✅ Rollback de gobernanza — completado.');
    }
};
