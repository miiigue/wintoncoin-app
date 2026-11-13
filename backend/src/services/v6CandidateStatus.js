'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {Contract, getAddress, keccak256} = require('ethers');
const {validateV6Demo} = require('./validateV6Demo');

// Fixed path and SHA-256 pin bind the candidate to an explicitly provisioned
// manifest. Never accept an address, endpoint or file path from an HTTP request.
async function inspect(env = process.env) {
  if (env.WINTON_V6_CANDIDATE_ENABLED === 'false') return {success:true, configured:false};
  if (env.IS_DEMO_ENV !== 'true' || env.WINTON_ENVIRONMENT_ID !== 'demo') {
    if (env.WINTON_V6_CANDIDATE_ENABLED === 'true') throw new Error('Entorno incorrecto');
    return {success:true, configured:false};
  }
  const expected = String(env.WINTON_V6_MANIFEST_SHA256 || require('./v6ReleasePin').manifestSha256 || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('Huella ausente');
  const raw = fs.readFileSync(path.resolve(__dirname, '../../../web3-contracts/deployments/v6-demo-candidate.json'));
  if (crypto.createHash('sha256').update(raw).digest('hex') !== expected) throw new Error('Huella incorrecta');
  const manifest = JSON.parse(raw.toString('utf8'));
  const provider = require('./chainDeployment').provider();
  try {
    const result = await validateV6Demo({provider, contracts:manifest.contracts, Contract, getAddress, keccak256, manifest});
    return {success:true, configured:true, ...result};
  } finally { provider.destroy(); }
}
module.exports = {inspect};
