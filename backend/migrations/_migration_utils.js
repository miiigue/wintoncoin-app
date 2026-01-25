const crypto = require('crypto');

async function ensureSchemaMigrationsTable(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            migration_name TEXT PRIMARY KEY,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            applied_by TEXT,
            environment TEXT,
            checksum TEXT
        );
    `);
}

function computeChecksum(content) {
    if (!content) return null;
    return crypto.createHash('sha256').update(String(content)).digest('hex');
}

async function recordMigration(client, migrationName, checksum) {
    const appliedBy = process.env.MIGRATION_EXECUTED_BY
        || process.env.USER
        || process.env.USERNAME
        || null;
    const environment = process.env.NODE_ENV || null;

    await client.query(
        `
        INSERT INTO schema_migrations (migration_name, applied_by, environment, checksum)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (migration_name) DO NOTHING
        `,
        [migrationName, appliedBy, environment, checksum]
    );
}

module.exports = {
    ensureSchemaMigrationsTable,
    computeChecksum,
    recordMigration
};
