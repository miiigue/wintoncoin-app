'use strict';

const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');
const { getAddress, isAddress } = require('ethers');
const { INVENTORY_SOURCE_KIND, walletSetDigest } = require('../src/services/v5MigrationReadiness');

const COUNT_QUERY = `SELECT COUNT(*)::int AS total_users,
  COUNT(web3_wallet_address)::int AS rows_with_wallet
  FROM users`;
const WALLETS_QUERY = `SELECT web3_wallet_address
  FROM users
  WHERE web3_wallet_address IS NOT NULL
  ORDER BY LOWER(web3_wallet_address), id`;
const OBSERVED_WALLETS_QUERY = `SELECT source, wallet_address FROM (
  SELECT 'users' AS source, web3_wallet_address AS wallet_address FROM users WHERE web3_wallet_address IS NOT NULL
  UNION ALL SELECT 'exchange_orders', wallet_address FROM web3_exchange_order_snapshots
  UNION ALL SELECT 'pending_refunds', wallet_address FROM web3_pending_refunds
  UNION ALL SELECT 'refund_events', wallet_address FROM web3_refund_events
  UNION ALL SELECT 'wallet_snapshots', wallet_address FROM web3_wallet_snapshots
  UNION ALL SELECT 'collateral_consents', wallet_address FROM exchange_collateral_consents
  UNION ALL SELECT 'red_commitment_lots', wallet_address FROM web3_red_commitment_lots
  UNION ALL SELECT 'governance_actions', affected_wallet_address FROM web3_governance_actions WHERE affected_wallet_address IS NOT NULL
) observed
ORDER BY source, LOWER(wallet_address)`;

function argumentsOf(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith('--')) continue;
    const key = argv[index].slice(2);
    result[key] = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : true;
  }
  return result;
}

function canonicalWallets(values, label, rejectDuplicates = false) {
  const wallets = [];
  const seen = new Set();
  for (const value of values) {
    if (!isAddress(value || '')) throw new Error(`${label} contiene una dirección inválida`);
    const wallet = getAddress(value);
    const key = wallet.toLowerCase();
    if (rejectDuplicates && seen.has(key)) throw new Error(`${label} contiene una billetera duplicada`);
    if (!seen.has(key)) wallets.push(wallet);
    seen.add(key);
  }
  return wallets;
}

async function buildInventory({ client, config, now = new Date() }) {
  if (!config || config.schemaVersion !== 1) throw new Error('La configuración base debe usar schemaVersion 1');
  if (!Array.isArray(config.operationalWallets) || config.operationalWallets.length === 0) {
    throw new Error('operationalWallets debe enumerar relayer, owner y tesorerías aplicables');
  }
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const countResult = await client.query(COUNT_QUERY);
    const walletResult = await client.query(WALLETS_QUERY);
    const observedResult = await client.query(OBSERVED_WALLETS_QUERY);
    const totalUsers = Number(countResult.rows[0]?.total_users);
    const rowsWithWallet = Number(countResult.rows[0]?.rows_with_wallet);
    if (!Number.isSafeInteger(totalUsers) || !Number.isSafeInteger(rowsWithWallet) || rowsWithWallet !== walletResult.rows.length) {
      throw new Error('Los conteos de billeteras no conciliaron dentro del snapshot PostgreSQL');
    }
    const databaseWallets = canonicalWallets(walletResult.rows.map((row) => row.web3_wallet_address), 'users.web3_wallet_address', true);
    const observedWallets = canonicalWallets(observedResult.rows.map((row) => row.wallet_address), 'fuentes DB/indexador');
    const operationalWallets = canonicalWallets(config.operationalWallets, 'operationalWallets');
    const wallets = canonicalWallets([...observedWallets, ...operationalWallets], 'inventario combinado').sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    const sourceCounts = observedResult.rows.reduce((counts, row) => {
      counts[row.source] = (counts[row.source] || 0) + 1;
      return counts;
    }, {});
    const querySha256 = createHash('sha256').update(`${COUNT_QUERY}\n${WALLETS_QUERY}\n${OBSERVED_WALLETS_QUERY}`).digest('hex');
    const output = {
      ...config,
      wallets,
      walletInventory: {
        complete: true,
        sourceKind: INVENTORY_SOURCE_KIND,
        source: 'Snapshot READ ONLY de users e indexadores Web3 más operationalWallets explícitas',
        exportedAt: now.toISOString(),
        recordCount: wallets.length,
        databaseTotalUsers: totalUsers,
        databaseRowsWithWallet: rowsWithWallet,
        databaseRowsWithoutWallet: totalUsers - rowsWithWallet,
        databaseUniqueWallets: databaseWallets.length,
        databaseObservedWalletRows: observedResult.rows.length,
        databaseUniqueObservedWallets: observedWallets.length,
        databaseSourceCounts: sourceCounts,
        operationalWalletCount: operationalWallets.length,
        querySha256,
        addressSetSha256: walletSetDigest(wallets),
      },
    };
    await client.query('COMMIT');
    return output;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const args = argumentsOf(process.argv.slice(2));
  if (!args.config || !args.output) throw new Error('Uso: node backend/scripts/build_v5_audit_inventory.js --config <base.json> --output <inventario.json>');
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL; no se admite inventario manual');
  const config = JSON.parse(fs.readFileSync(path.resolve(args.config), 'utf8'));
  const pool = require('../src/config/db');
  const client = await pool.connect();
  try {
    const inventory = await buildInventory({ client, config });
    fs.writeFileSync(path.resolve(args.output), `${JSON.stringify(inventory, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    process.stdout.write(`INVENTORY_READY wallets=${inventory.walletInventory.recordCount} sha256=${inventory.walletInventory.addressSetSha256}\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(() => {
    process.stderr.write('INVENTORY_BUILD_FAILED: revise conexión, esquema, duplicados y archivo de salida. No se imprimieron direcciones ni credenciales.\n');
    process.exitCode = 2;
  });
}

module.exports = { COUNT_QUERY, OBSERVED_WALLETS_QUERY, WALLETS_QUERY, argumentsOf, buildInventory, canonicalWallets };
