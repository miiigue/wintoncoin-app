'use strict';
const { configFromManifest, resolveConfig } = require('./exchangeIndexerV6');
const { startExchangeIndexerV6 } = require('./exchangeIndexerV6Worker');

// Explicitly enabled for Demo only. Never starts using an unverified manifest.
async function startVerifiedDemoV6Indexer(pool, { env = process.env, deployment, createWorker = startExchangeIndexerV6 } = {}) {
  if (env.EXCHANGE_INDEXER_V6_ENABLED === 'false') return null;
  if (env.IS_DEMO_ENV !== 'true' || env.WINTON_ENVIRONMENT_ID !== 'demo') throw Error('V6_INDEXER_DEMO_ONLY');
  const service = deployment || require('./marketplaceDeployment');
  const release = service.configuration(env);
  if (release.epoch !== 'V6_DEMO' || String(release.chainId) !== '11155420') throw Error('V6_INDEXER_EPOCH_MISMATCH');
  const rpc = service.provider();
  try {
    await service.validate(rpc, release);
    const config = await resolveConfig(rpc,release.manifest);
    return createWorker(pool, rpc, config, { onError: error => console.error('[EXCHANGE_INDEXER_V6]', error.message) });
  } catch (error) { rpc.destroy?.(); throw error; }
}
module.exports = { startVerifiedDemoV6Indexer };
