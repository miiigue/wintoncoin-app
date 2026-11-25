#!/usr/bin/env node
'use strict';

/**
 * ============================================================================
 * CLI READ-ONLY: EXPORTADOR DE INVENTARIO V6 DEMO (OPTIMISM SEPOLIA 11155420)
 * ============================================================================
 * Script delgado que invoca `backend/src/services/v6DemoInventoryExporter.js`
 * y escribe el informe JSON sanitizado en una ruta local explícita ignorada
 * por Git (`backend/scratch/v6-demo-inventory-<timestamp>.json` por defecto).
 *
 * Seguridad (Zero-Trust / CODEX-203):
 * - NO carga archivos `.env` genéricos con secretos.
 * - NO instancia Wallet/Signer ni envía transacciones.
 * - Valida allowlist explícita de RPC Demo y SQL Demo ANTES de conectar.
 * - Nunca imprime credenciales, URLs completas con tokens ni PII por consola.
 * ============================================================================
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  exportV6DemoInventory,
  sanitizeText
} = require('../src/services/v6DemoInventoryExporter');

const DEFAULT_SCRATCH_DIR = path.resolve(__dirname, '../scratch');

/**
 * Construye el nombre de archivo de salida por defecto dentro de `backend/scratch/`
 * (carpeta explícitamente ignorada por `.gitignore`).
 */
function buildDefaultOutputPath(now = new Date(), baseDir = DEFAULT_SCRATCH_DIR) {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return path.join(baseDir, `v6-demo-inventory-${stamp}.json`);
}

/**
 * Parsea los argumentos CLI de forma estricta (sin lectura implícita de `.env`).
 */
function parseCliArgs(argv = process.argv.slice(2), env = {}) {
  const opts = {
    rpcUrl: env.V6_DEMO_INVENTORY_RPC_URL || null,
    databaseUrl: env.V6_DEMO_INVENTORY_DATABASE_URL || null,
    outPath: null,
    skipSql: false,
    allowLocalRpc: false,
    allowLocalSql: false,
    maxLogBlockSpan: 10_000,
    sqlStatementTimeoutMs: 15_000,
    rpcRequestDelayMs: 120,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--skip-sql') {
      opts.skipSql = true;
    } else if (arg === '--allow-local-rpc') {
      opts.allowLocalRpc = true;
    } else if (arg === '--allow-local-sql') {
      opts.allowLocalSql = true;
    } else if (arg === '--rpc-url' && argv[i + 1]) {
      opts.rpcUrl = argv[++i];
    } else if (arg === '--database-url' && argv[i + 1]) {
      opts.databaseUrl = argv[++i];
    } else if ((arg === '--out' || arg === '-o') && argv[i + 1]) {
      opts.outPath = path.resolve(argv[++i]);
    } else if (arg === '--max-log-span' && argv[i + 1]) {
      const parsed = Number(argv[++i]);
      if (!Number.isSafeInteger(parsed) || parsed < 1) {
        throw new Error('Argumento inválido: --max-log-span debe ser un entero positivo.');
      }
      opts.maxLogBlockSpan = parsed;
    } else if (arg === '--sql-timeout-ms' && argv[i + 1]) {
      const parsed = Number(argv[++i]);
      if (!Number.isSafeInteger(parsed) || parsed < 1000) {
        throw new Error('Argumento inválido: --sql-timeout-ms debe ser >= 1000.');
      }
      opts.sqlStatementTimeoutMs = parsed;
    } else if (arg === '--rpc-delay-ms' && argv[i + 1]) {
      const parsed = Number(argv[++i]);
      if (!Number.isSafeInteger(parsed) || parsed < 0) {
        throw new Error('Argumento inválido: --rpc-delay-ms debe ser un entero >= 0.');
      }
      opts.rpcRequestDelayMs = parsed;
    } else {
      throw new Error(`Argumento no reconocido o incompleto: "${arg}". Usa --help para ver las opciones.`);
    }
  }

  return opts;
}

function usageText() {
  return [
    'Uso: node backend/scripts/export-v6-demo-inventory.js --rpc-url <URL_OP_SEPOLIA> [--database-url <PG_DEMO_URL> | --skip-sql] [--out <RUTA_JSON>]',
    '',
    'Opciones:',
    '  --rpc-url <url>           URL RPC de Optimism Sepolia Demo (obligatoria; o V6_DEMO_INVENTORY_RPC_URL).',
    '  --database-url <url>      URL PostgreSQL Demo solo lectura (o V6_DEMO_INVENTORY_DATABASE_URL).',
    '  --skip-sql                Omite consultas SQL (fuerza fullComplete=false y routeAEligible=false).',
    '  --out, -o <ruta>          Ruta de salida JSON (por defecto: backend/scratch/v6-demo-inventory-<timestamp>.json).',
    '  --max-log-span <n>        Ventana máxima de bloques para eth_getLogs (por defecto: 10000).',
    '  --sql-timeout-ms <ms>     statement_timeout SQL en ms dentro de transacción READ ONLY (por defecto: 15000).',
    '  --allow-local-rpc         Habilita localhost/127.0.0.1 para pruebas locales explícitas.',
    '  --allow-local-sql         Habilita PostgreSQL local de demo/test para pruebas locales explícitas.',
    '  --help, -h                Muestra esta ayuda.'
  ].join('\n');
}

/**
 * Ejecuta el CLI y escribe el JSON sanitizado en disco.
 * Permite inyección de `exporterFn` para pruebas unitarias deterministas.
 */
async function runCli({
  argv = process.argv.slice(2),
  env = process.env,
  exporterFn = exportV6DemoInventory,
  stdout = process.stdout,
  stderr = process.stderr
} = {}) {
  try {
    const opts = parseCliArgs(argv, env);
    if (opts.help) {
      stdout.write(`${usageText()}\n`);
      return { exitCode: 0, help: true };
    }

    const report = await exporterFn({
      rpcUrl: opts.rpcUrl,
      databaseUrl: opts.databaseUrl,
      skipSql: opts.skipSql,
      allowLocalRpc: opts.allowLocalRpc,
      allowLocalSql: opts.allowLocalSql,
      maxLogBlockSpan: opts.maxLogBlockSpan,
      sqlStatementTimeoutMs: opts.sqlStatementTimeoutMs,
      rpcRequestDelayMs: opts.rpcRequestDelayMs
    });

    const outPath = opts.outPath || buildDefaultOutputPath();
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    const summary = {
      outputPath: outPath,
      chainId: report.environment?.chainId,
      epoch: report.environment?.epoch,
      finalizedBlockNumber: report.metadata?.rpc?.finalizedBlockNumber,
      onchainComplete: report.completeness?.onchainComplete,
      sqlComplete: report.completeness?.sqlComplete,
      fullComplete: report.completeness?.fullComplete,
      invariantsAllPassed: report.invariants?.allPassed,
      candidateEmptyAtBlock: report.eligibility?.candidateEmptyAtBlock,
      routeAEligible: report.eligibility?.routeAEligible,
      accountsCount: report.onchain?.accountsCount
    };

    stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

    // Sin --skip-sql se exige completitud total (on-chain + SQL) e invariantes sanos;
    // con --skip-sql se exige completitud on-chain e invariantes sanos.
    const isSuccess = opts.skipSql
      ? Boolean(report.completeness?.onchainComplete && report.invariants?.allPassed)
      : Boolean(report.completeness?.fullComplete && report.invariants?.allPassed);
    const exitCode = isSuccess ? 0 : 2;
    return { exitCode, outPath, report, summary };
  } catch (error) {
    stderr.write(`[V6_DEMO_INVENTORY_ERROR] ${sanitizeText(error.message)}\n`);
    return { exitCode: 1, error };
  }
}

if (require.main === module) {
  runCli().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}

module.exports = {
  buildDefaultOutputPath,
  parseCliArgs,
  runCli,
  usageText
};
