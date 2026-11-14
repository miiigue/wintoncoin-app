'use strict';
const fs = require('fs');
const path = require('path');
const {createHash} = require('crypto');
const {Contract,getAddress,keccak256} = require('ethers');
const legacy = require('./chainDeployment');
const {validateV6Demo} = require('./validateV6Demo');

function configuration(env = process.env) {
  const base = legacy.configuration(env);
  if (env.IS_DEMO_ENV !== 'true' || env.WINTON_ENVIRONMENT_ID !== 'demo') return base;
  if (base.chainId !== '11155420') throw Error('Red incorrecta para pagos V6');
  const raw = fs.readFileSync(path.resolve(__dirname,'../../../web3-contracts/deployments/v6-demo-candidate.json'));
  const digest = createHash('sha256').update(raw).digest('hex');
  if (digest !== require('./v6ReleasePin').manifestSha256) throw Error('Manifiesto V6 no reconocido');
  const manifest = JSON.parse(raw);
  if (manifest.chainId !== base.chainId || manifest.epoch !== 'V6_DEMO') throw Error('Suite de pagos V6 incorrecta');
  return {chainId:base.chainId, epoch:manifest.epoch, contracts:manifest.contracts, fingerprint:'0x'+digest, manifest};
}
async function validate(rpc,config) {
  if(config.epoch !== 'V6_DEMO') return legacy.validate(rpc,config);
  return validateV6Demo({provider:rpc,contracts:config.contracts,manifest:config.manifest,
    Contract,getAddress,keccak256,requireFrozen:false});
}
module.exports = {configuration,validate,provider:legacy.provider};
