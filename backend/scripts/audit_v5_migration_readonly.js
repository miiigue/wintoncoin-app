'use strict';

const fs = require('fs');
const path = require('path');
const { JsonRpcProvider } = require('ethers');
const { auditMigration } = require('../src/services/v5MigrationReadiness');

function argumentsOf(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith('--')) continue;
    const key = argv[index].slice(2);
    result[key] = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : true;
  }
  return result;
}

async function main() {
  const args = argumentsOf(process.argv.slice(2));
  if (!args.config) throw new Error('Uso: node backend/scripts/audit_v5_migration_readonly.js --config <archivo.json> [--output <reporte.json>]');
  const rpcUrl = process.env.READONLY_RPC_URL;
  if (!rpcUrl) throw new Error('Falta READONLY_RPC_URL. Use un endpoint exclusivamente de lectura; no se aceptan claves privadas.');
  const configPath = path.resolve(args.config);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const provider = new JsonRpcProvider(rpcUrl, Number(config.chainId), { staticNetwork: true });
  const result = await auditMigration({ provider, config });
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (args.output) fs.writeFileSync(path.resolve(args.output), output, { encoding: 'utf8', flag: 'wx' });
  else process.stdout.write(output);
  process.exitCode = result.ready ? 0 : 2;
}

if (require.main === module) {
  main().catch((error) => {
    const category = error && error.name ? error.name : 'Error';
    process.stderr.write(`Ensayo abortado de forma segura (${category}). Revise localmente RPC, configuración y permisos; no se imprimen detalles que puedan contener credenciales.\n`);
    process.exitCode = 2;
  });
}

module.exports = { argumentsOf, main };
