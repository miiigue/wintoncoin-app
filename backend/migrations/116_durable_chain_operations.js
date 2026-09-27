'use strict';
async function up(client) {
    await client.query(`CREATE TABLE IF NOT EXISTS chain_operations (
        id UUID PRIMARY KEY, user_id INTEGER REFERENCES users(id), request_key TEXT NOT NULL UNIQUE,
        chain_id TEXT NOT NULL, sender TEXT NOT NULL, resource_key TEXT NOT NULL,
        kind TEXT NOT NULL, payload JSONB NOT NULL, projection JSONB NOT NULL DEFAULT '{}',
        state TEXT NOT NULL CHECK(state IN ('prepared','pending','confirmed','failed','conflict')),
        steps JSONB NOT NULL DEFAULT '[]', error_code TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE INDEX IF NOT EXISTS chain_operations_pending ON chain_operations(state,created_at)
        WHERE state IN ('pending','conflict')`);
    await client.query(`CREATE INDEX IF NOT EXISTS chain_operations_identity ON chain_operations(chain_id,sender,state)`);
    await client.query(`CREATE TABLE IF NOT EXISTS credit_policy_versions (
        id BIGSERIAL PRIMARY KEY, settings JSONB NOT NULL, actor_id INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS credit_policy_jobs (
        version_id BIGINT PRIMARY KEY REFERENCES credit_policy_versions(id), cursor_id INTEGER NOT NULL DEFAULT 0,
        state TEXT NOT NULL DEFAULT 'pending', operation_id UUID REFERENCES chain_operations(id),
        pending_user_id INTEGER, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    for(const [key,value] of Object.entries({gas_sponsor_enabled:'false',gas_sponsor_daily_user_operations:'3',gas_sponsor_daily_budget_wei:'0',gas_sponsor_max_topup_wei:'0'}))
        await client.query('INSERT INTO app_settings(setting_key,setting_value) VALUES($1,$2) ON CONFLICT DO NOTHING',[key,value]);
}
async function down() { throw new Error('No se elimina el registro de operaciones firmadas mediante rollback.'); }
module.exports={up,down};
