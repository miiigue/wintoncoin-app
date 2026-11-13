'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const hre = require(path.join(process.cwd(), 'node_modules/hardhat'));
const { deploySuite } = require('./deploy-v6-draft.cjs');
async function main() {
  if (hre.network.name !== 'hardhat') throw Error('Solo ensayo local');
  const [funder, guardian, treasury] = await hre.ethers.getSigners();
  const wallet = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  await (await funder.sendTransaction({to: wallet.address, value: hre.ethers.parseEther('10')})).wait();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winton-v6-rehearsal-'));
  const args = { wallet, plan: { owner: wallet.address, guardian: guardian.address, riskOperator: wallet.address, treasury: treasury.address, maxPayment: '1000000000', duration: 2592000, commissionBps: 500, exchangeFeeBps: 0 }, journalPath: path.join(dir, 'journal.json'), maxWei: hre.ethers.parseEther('5') };
  try { await deploySuite({ ...args, stopAfter: 6 }); throw Error('No ocurrió interrupción simulada'); }
  catch (e) { if (e.message !== 'INTERRUPCION_SIMULADA') throw e; }
  const result = await deploySuite(args);
  if (!result.verified || Object.keys(result.contracts).length !== 18) throw Error('Ensayo incompleto');
  const count = await hre.ethers.provider.getTransactionCount(wallet.address);
  await deploySuite(args);
  if (count !== await hre.ethers.provider.getTransactionCount(wallet.address)) throw Error('Reanudación duplicó transacciones');
  try { await deploySuite({ ...args, plan: { ...args.plan, commissionBps: 499 } }); throw Error('Plan alterado aceptado'); }
  catch (e) { if (e.message !== 'Plan o bytecode cambió') throw e; }
  const journal = JSON.parse(fs.readFileSync(args.journalPath, 'utf8'));
  journal.steps['deploy:ProtocolModeController'].requestHash = hre.ethers.ZeroHash;
  fs.writeFileSync(args.journalPath, JSON.stringify(journal));
  try { await deploySuite(args); throw Error('Diario alterado aceptado'); }
  catch (e) { if (!e.message.startsWith('Diario inconsistente:')) throw e; }
  console.log('Ensayo reanudable V6 correcto: interrupción, recuperación e idempotencia; modo congelado.');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
