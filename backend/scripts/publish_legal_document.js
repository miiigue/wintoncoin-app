#!/usr/bin/env node
/**
 * Professional legal publication script (fintech-friendly).
 *
 * Why this script exists:
 * - Editing HTML alone is not enough for compliance.
 * - We must publish a versioned legal artifact in DB.
 * - Re-acceptance is automatically enforced by comparing accepted version/hash
 *   vs the currently published active version per document type.
 *
 * Usage examples:
 *   node scripts/publish_legal_document.js --type terms_and_conditions --file ../frontend/terms.html
 *   node scripts/publish_legal_document.js --type privacy_policy --file ../frontend/privacy.html --version v1.2
 *   node scripts/publish_legal_document.js --type terms_and_conditions --file ../frontend/terms.html --dry-run
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const ALLOWED_TYPES = new Set(['terms_and_conditions', 'privacy_policy']);

function parseArgs(argv) {
    const options = {
        type: null,
        file: null,
        version: null,
        dryRun: false
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--type') options.type = argv[++i];
        else if (arg === '--file') options.file = argv[++i];
        else if (arg === '--version') options.version = argv[++i];
        else if (arg === '--dry-run') options.dryRun = true;
        else if (arg === '--help' || arg === '-h') options.help = true;
    }

    return options;
}

function printHelp() {
    console.log(`
Legal Publisher - WintonCoin

Required:
  --type      terms_and_conditions | privacy_policy
  --file      Relative path to HTML file to publish

Optional:
  --version   Explicit version (example: v1.1). If omitted, script auto-bumps patch version.
  --dry-run   Validates and prints publication plan without writing changes.

Examples:
  npm run legal:publish -- --type terms_and_conditions --file ../frontend/terms.html
  npm run legal:publish -- --type privacy_policy --file ../frontend/privacy.html --version v1.2
  npm run legal:publish:terms -- --version v1.3
`);
}

function assertOptions(options) {
    if (options.help) {
        printHelp();
        process.exit(0);
    }

    if (!options.type || !ALLOWED_TYPES.has(options.type)) {
        throw new Error('Invalid --type. Use terms_and_conditions or privacy_policy.');
    }

    if (!options.file) {
        throw new Error('Missing --file argument.');
    }
}

function sha256(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

function parseVersionParts(version) {
    const match = /^v(\d+)\.(\d+)(?:\.(\d+))?$/i.exec(String(version || '').trim());
    if (!match) return null;
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: match[3] ? parseInt(match[3], 10) : 0
    };
}

function formatVersion(parts) {
    return `v${parts.major}.${parts.minor}.${parts.patch}`;
}

function bumpPatchVersion(baseVersion) {
    const parts = parseVersionParts(baseVersion);
    if (!parts) return 'v1.0.0';
    parts.patch += 1;
    return formatVersion(parts);
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    assertOptions(options);

    // Resolve file path from current working directory (caller context),
    // which makes CLI usage predictable in local/dev/CI environments.
    const targetFile = path.resolve(process.cwd(), options.file);
    if (!fs.existsSync(targetFile)) {
        throw new Error(`File not found: ${targetFile}`);
    }

    const content = fs.readFileSync(targetFile, 'utf8');
    const contentHash = sha256(content);

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const latestResult = await client.query(
            `SELECT id, version, content_hash, is_active, created_at
             FROM legal_documents
             WHERE type = $1
             ORDER BY created_at DESC, id DESC
             LIMIT 1`,
            [options.type]
        );
        const latest = latestResult.rows[0] || null;

        if (latest && latest.content_hash === contentHash) {
            console.log('ℹ️ No changes detected: content hash is identical to latest published version.');
            if (options.dryRun) {
                await client.query('ROLLBACK');
            } else {
                await client.query('COMMIT');
            }
            return;
        }

        const versionToPublish = options.version || bumpPatchVersion(latest?.version || null);
        if (!parseVersionParts(versionToPublish)) {
            throw new Error('Invalid version format. Use format like v1.1 or v1.1.0');
        }

        const existingVersion = await client.query(
            `SELECT id FROM legal_documents WHERE type = $1 AND version = $2`,
            [options.type, versionToPublish]
        );
        if (existingVersion.rowCount > 0) {
            const suggestedVersion = bumpPatchVersion(versionToPublish);
            throw new Error(
                `Version ${versionToPublish} already exists for ${options.type}. ` +
                `Suggested next version: ${suggestedVersion}. ` +
                `Example: npm run legal:publish -- --type ${options.type} --file ${options.file} --version ${suggestedVersion}`
            );
        }

        if (options.dryRun) {
            console.log(JSON.stringify({
                dryRun: true,
                type: options.type,
                file: targetFile,
                previousVersion: latest?.version || null,
                publishVersion: versionToPublish,
                publishHash: contentHash
            }, null, 2));
            await client.query('ROLLBACK');
            return;
        }

        // Deactivate all previously active documents for this type.
        // This is the normal industry path: only one active version per type.
        // If legacy immutability trigger blocks UPDATE in some environments,
        // we fall back to "best effort" and still publish the new version.
        try {
            await client.query('SAVEPOINT deactivate_previous_legal_docs');
            await client.query(
                `UPDATE legal_documents
                 SET is_active = FALSE
                 WHERE type = $1 AND is_active = TRUE`,
                [options.type]
            );
            await client.query('RELEASE SAVEPOINT deactivate_previous_legal_docs');
        } catch (error) {
            await client.query('ROLLBACK TO SAVEPOINT deactivate_previous_legal_docs');
            await client.query('RELEASE SAVEPOINT deactivate_previous_legal_docs');
            console.warn('[LEGAL PUBLISH] Could not deactivate previous active docs (legacy immutable trigger?). Continuing with new publication.');
            console.warn(`[LEGAL PUBLISH] Detail: ${error.message}`);
        }

        const insertResult = await client.query(
            `INSERT INTO legal_documents (type, version, content, content_hash, is_active)
             VALUES ($1, $2, $3, $4, TRUE)
             RETURNING id, type, version, content_hash, created_at`,
            [options.type, versionToPublish, content, contentHash]
        );

        await client.query('COMMIT');

        console.log('✅ Legal document published successfully.');
        console.log(JSON.stringify({
            published: insertResult.rows[0],
            previousVersion: latest?.version || null,
            effect: 'Users with older accepted version/hash will require re-acceptance automatically.'
        }, null, 2));
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch((error) => {
    console.error(`❌ Legal publication failed: ${error.message}`);
    process.exit(1);
});
