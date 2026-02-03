/**
 * Script para añadir índices y constraints faltantes a la DB demo
 */
require('dotenv').config({ path: '../.env.demo.local' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function addMissingConstraints() {
    console.log('🔧 Añadiendo índices y constraints faltantes a la DB demo...\n');
    const client = await pool.connect();

    try {
        const constraints = [
            // app_settings
            `ALTER TABLE app_settings ADD CONSTRAINT IF NOT EXISTS app_settings_pkey PRIMARY KEY (id)`,
            `CREATE UNIQUE INDEX IF NOT EXISTS app_settings_setting_key_key ON app_settings (setting_key)`,

            // users
            `ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS users_pkey PRIMARY KEY (id)`,
            `CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (username)`,
            `CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (email)`,
            `CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_key ON users (referral_code)`,

            // publications
            `ALTER TABLE publications ADD CONSTRAINT IF NOT EXISTS publications_pkey PRIMARY KEY (id)`,

            // transactions
            `ALTER TABLE transactions ADD CONSTRAINT IF NOT EXISTS transactions_pkey PRIMARY KEY (id)`,

            // pending_verifications
            `ALTER TABLE pending_verifications ADD CONSTRAINT IF NOT EXISTS pending_verifications_pkey PRIMARY KEY (id)`,
            `CREATE UNIQUE INDEX IF NOT EXISTS pending_verifications_email_key ON pending_verifications (email)`,

            // schema_migrations
            `CREATE UNIQUE INDEX IF NOT EXISTS schema_migrations_version_key ON schema_migrations (version)`,

            // p2p_payment_methods
            `ALTER TABLE p2p_payment_methods ADD CONSTRAINT IF NOT EXISTS p2p_payment_methods_pkey PRIMARY KEY (id)`,
            `CREATE UNIQUE INDEX IF NOT EXISTS p2p_payment_methods_method_key_key ON p2p_payment_methods (method_key)`,

            // booster_level_settings
            `ALTER TABLE booster_level_settings ADD CONSTRAINT IF NOT EXISTS booster_level_settings_pkey PRIMARY KEY (id)`,
            `CREATE UNIQUE INDEX IF NOT EXISTS booster_level_settings_level_key ON booster_level_settings (level)`,

            // legal_documents
            `ALTER TABLE legal_documents ADD CONSTRAINT IF NOT EXISTS legal_documents_pkey PRIMARY KEY (id)`,
            `CREATE UNIQUE INDEX IF NOT EXISTS legal_documents_doc_type_key ON legal_documents (doc_type)`,

            // Otras tablas con PRIMARY KEY
            `ALTER TABLE audit_log ADD CONSTRAINT IF NOT EXISTS audit_log_pkey PRIMARY KEY (id)`,
            `ALTER TABLE notifications ADD CONSTRAINT IF NOT EXISTS notifications_pkey PRIMARY KEY (id)`,
            `ALTER TABLE publication_acceptances ADD CONSTRAINT IF NOT EXISTS publication_acceptances_pkey PRIMARY KEY (id)`,
            `ALTER TABLE ratings ADD CONSTRAINT IF NOT EXISTS ratings_pkey PRIMARY KEY (id)`,
            `ALTER TABLE referral_log ADD CONSTRAINT IF NOT EXISTS referral_log_pkey PRIMARY KEY (id)`,
            `ALTER TABLE booster_events ADD CONSTRAINT IF NOT EXISTS booster_events_pkey PRIMARY KEY (id)`,
            `ALTER TABLE booster_transactions ADD CONSTRAINT IF NOT EXISTS booster_transactions_pkey PRIMARY KEY (id)`,
            `ALTER TABLE booster_blue_ledger ADD CONSTRAINT IF NOT EXISTS booster_blue_ledger_pkey PRIMARY KEY (id)`,
            `ALTER TABLE hidden_publications ADD CONSTRAINT IF NOT EXISTS hidden_publications_pkey PRIMARY KEY (id)`,
            `ALTER TABLE user_agreements_log ADD CONSTRAINT IF NOT EXISTS user_agreements_log_pkey PRIMARY KEY (id)`,
            `ALTER TABLE balance_events ADD CONSTRAINT IF NOT EXISTS balance_events_pkey PRIMARY KEY (id)`,
            `ALTER TABLE blue_token_escrows ADD CONSTRAINT IF NOT EXISTS blue_token_escrows_pkey PRIMARY KEY (id)`,
            `ALTER TABLE red_token_debts ADD CONSTRAINT IF NOT EXISTS red_token_debts_pkey PRIMARY KEY (id)`,
            `ALTER TABLE platform_wallet ADD CONSTRAINT IF NOT EXISTS platform_wallet_pkey PRIMARY KEY (id)`,
            `ALTER TABLE platform_commission_log ADD CONSTRAINT IF NOT EXISTS platform_commission_log_pkey PRIMARY KEY (id)`,
            `ALTER TABLE booster_payment_log ADD CONSTRAINT IF NOT EXISTS booster_payment_log_pkey PRIMARY KEY (id)`,
            `ALTER TABLE p2p_offers ADD CONSTRAINT IF NOT EXISTS p2p_offers_pkey PRIMARY KEY (id)`,
            `ALTER TABLE p2p_orders ADD CONSTRAINT IF NOT EXISTS p2p_orders_pkey PRIMARY KEY (id)`,
            `ALTER TABLE p2p_disputes ADD CONSTRAINT IF NOT EXISTS p2p_disputes_pkey PRIMARY KEY (id)`,
            `ALTER TABLE p2p_ratings ADD CONSTRAINT IF NOT EXISTS p2p_ratings_pkey PRIMARY KEY (id)`,
            `ALTER TABLE p2p_offer_methods ADD CONSTRAINT IF NOT EXISTS p2p_offer_methods_pkey PRIMARY KEY (id)`,
        ];

        for (const sql of constraints) {
            try {
                await client.query(sql);
                console.log('✅', sql.substring(0, 70) + '...');
            } catch (err) {
                if (err.code === '42710' || err.code === '42P07') {
                    // Constraint/index already exists
                    console.log('⏩ Ya existe:', sql.substring(0, 50));
                } else {
                    console.log('⚠️ Error:', err.message, '| SQL:', sql.substring(0, 50));
                }
            }
        }

        console.log('\n✅ Constraints e índices añadidos.');

    } catch (error) {
        console.error('❌ Error general:', error);
    } finally {
        client.release();
        pool.end();
    }
}

addMissingConstraints();
