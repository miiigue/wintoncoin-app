'use strict';
async function up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS account_identities (
        id UUID PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
        review_state TEXT NOT NULL DEFAULT 'pending' CHECK(review_state IN ('pending','verified','review_required','suspended')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS identity_documents (
        id BIGSERIAL PRIMARY KEY, identity_id UUID NOT NULL REFERENCES account_identities(id),
        issuer_country CHAR(2) NOT NULL, document_type TEXT NOT NULL,
        document_fingerprint CHAR(64) NOT NULL UNIQUE, evidence_reference TEXT NOT NULL,
        reviewer_id INTEGER NOT NULL REFERENCES admin_users(id), reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS smart_accounts (
        identity_id UUID NOT NULL REFERENCES account_identities(id), chain_id TEXT NOT NULL,
        address TEXT NOT NULL CHECK(address=LOWER(address)),
        passkey JSONB NOT NULL, recovery_address TEXT NOT NULL,
        manifest_hash TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('prepared','deployed','active','review_required')),
        backup_confirmed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(identity_id,chain_id), UNIQUE(chain_id,address)
      );
      CREATE TABLE IF NOT EXISTS account_security_challenges (
        id UUID PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), purpose TEXT NOT NULL,
        payload JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS account_security_events (
        id BIGSERIAL PRIMARY KEY, identity_id UUID NOT NULL REFERENCES account_identities(id),
        event_type TEXT NOT NULL, actor_id TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS account_recovery_cases (
        id UUID PRIMARY KEY, identity_id UUID NOT NULL REFERENCES account_identities(id), chain_id TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'requested' CHECK(state IN ('requested','verifying','approved','submitted','confirmed','rejected','cancelled')),
        quoted_fee_usdt NUMERIC(24,6) NOT NULL DEFAULT 0 CHECK(quoted_fee_usdt>=0),
        terms_version TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY(identity_id,chain_id) REFERENCES smart_accounts(identity_id,chain_id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS account_recovery_one_open ON account_recovery_cases(identity_id,chain_id)
        WHERE state IN ('requested','verifying','approved','submitted');
    `);
    // No automatic KYC approval, wallet reassignment, balance mutation or secret migration.
}
async function down(){throw new Error('La identidad y su auditoría requieren una migración explícita, no se eliminan.');}
module.exports={up,down};
