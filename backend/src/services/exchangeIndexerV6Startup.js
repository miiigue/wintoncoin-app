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
    const pin = require('./v6ReleasePin');
    const config = release.fingerprint === '0x'+pin.manifestSha256
      ? configFromManifest({...release.manifest,startBlocks:pin.startBlocks})
      : await resolveConfig(rpc,release.manifest);
    return createWorker(pool, rpc, config, { onError: error => console.error('[EXCHANGE_INDEXER_V6]', error.message) });
  } catch (error) { rpc.destroy?.(); throw error; }
}
module.exports = { startVerifiedDemoV6Indexer };

// Render may start while a read-only RPC is warming up. Repeat the entire
// verification on failure before creating the single worker for this process.
function scheduleDemoV6Indexer(pool, {start=startVerifiedDemoV6Indexer, retryMs=15000}={}) {
  let timer, worker, stopped=false;
  async function attempt() {
    try {
      worker = await start(pool);
      if (stopped) worker?.stop();
    } catch (error) {
      console.warn('[EXCHANGE_INDEXER_V6] Verificación de arranque pendiente', error.code || error.name);
      if (!stopped) { timer=setTimeout(attempt,retryMs); timer.unref?.(); }
    }
  }
  void attempt();
  return {stop(){stopped=true;clearTimeout(timer);worker?.stop();}};
}
module.exports.scheduleDemoV6Indexer=scheduleDemoV6Indexer;
