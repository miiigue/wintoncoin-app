/**
 * backend/src/routes/web3Routes.js
 * Rutas de Interacción Web3 para Usuarios y Testers (Suite V4)
 * 
 * Permite a la Billetera React y al Exchange consultar balances on-chain,
 * verificar garantías, consultar la cola FIFO y realizar pruebas en entornos de demo.
 */

'use strict';

const express = require('express');
const router = express.Router();
const web3BridgeService = require('../services/web3BridgeService');
const { identityFromEnv } = require('../services/exchangeChainReader');
const { readExchangeSnapshot } = require('../services/exchangeSnapshotService');
async function exchangeReadIdentity() {
    if (process.env.IS_DEMO_ENV !== 'true' || process.env.WINTON_ENVIRONMENT_ID !== 'demo') return { identity: identityFromEnv(), v6: false };
    if (process.env.EXCHANGE_INDEXER_V6_ENABLED === 'false') throw Error('V6_INDEXER_DISABLED');
    const release = require('../services/marketplaceDeployment').configuration();
    // Reads compare the pinned stream identity with the cursor verified by the
    // worker. Fetching receipts on every public request makes freshness depend
    // on the caller's RPC quota and duplicates the worker's canonical check.
    const config = require('../services/exchangeIndexerV6').configFromManifest({
      ...release.manifest, startBlocks:require('../services/v6ReleasePin').startBlocks
    });
    return { identity: {chainId:String(config.chainId),exchange:config.streams.find(x=>x.kind==='router').address.toLowerCase(),streamFingerprint:require('ethers').id(JSON.stringify(config.streams))}, v6:true };
}
router.get('/deployment', async(req,res)=>{
    res.set('Cache-Control','no-store');
    const deployment=require('../services/marketplaceDeployment');const rpc=deployment.provider();
    try {
        const selected=deployment.configuration();
        const validated=await deployment.validate(rpc,selected);
        const contracts=deployment.isV6Epoch(selected.epoch)
            ? require('../services/v6ChainBridge').withCompatibilityAliases(validated.contracts)
            : validated.contracts;
        const config={...selected,...validated,contracts};
        const operations=await require('../services/economicWriteGate').operationalStatus({pool:require('../config/db'),config:selected});
        res.json({success:true,...config,operations});
    }
    catch {res.status(503).json({success:false,message:'El despliegue no pudo verificarse.'});}
    finally {rpc.destroy();}
});

// Public blockchain facts only. No identity documents, arbitrary RPC targets,
// or unverified legacy order rows are returned by this endpoint.
router.get('/exchange/:wallet', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const after = req.query.after ?? '0';
    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    if (!/^0x[a-fA-F0-9]{40}$/.test(req.params.wallet) || typeof after !== 'string' ||
        !/^\d{1,20}$/.test(after) || BigInt(after) > (1n << 64n) - 1n ||
        (req.query.limit !== undefined && (typeof req.query.limit !== 'string' || !/^\d{1,3}$/.test(req.query.limit))) ||
        !Number.isInteger(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ success: false, message: 'Dirección o paginación inválida.' });
    }
    let identity;
    let v6;
    try { ({ identity, v6 } = await exchangeReadIdentity()); }
    catch (_) { return res.status(503).json({ success: false, usable: false, status: 'not_configured', data: null }); }
    try {
        const reader = v6 ? require('../services/exchangeSnapshotV6').readExchangeSnapshotV6 : readExchangeSnapshot;
        const snapshot = await reader(require('../config/db'), identity, req.params.wallet.toLowerCase(), { after, limit });
        return res.status(snapshot.usable ? 200 : 503).json({ success: snapshot.usable, ...snapshot });
    } catch (_) {
        return res.status(503).json({ success: false, usable: false, status: 'unavailable', data: null });
    }
});

/**
 * GET /api/web3/exchange-queue
 * Consulta pública de la cola activa de órdenes del FifoExchange (Suite V4)
 * Extraída de los snapshots sincronizados on-chain en PostgreSQL.
 */
router.get('/exchange-queue', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const {identity,v6} = await exchangeReadIdentity();
        const reader = v6 ? require('../services/exchangeSnapshotV6').readExchangeQueueV6 : require('../services/exchangeSnapshotService').readExchangeQueue;
        const snapshot = await reader(require('../config/db'), identity);
        return res.status(snapshot.usable ? 200 : 503).json({ success: snapshot.usable, ...snapshot });
    } catch (_) {
        return res.status(503).json({ success: false, usable: false, status: 'unavailable', data: null });
    }
});

/**
 * GET /api/web3/status
 * Estado público de contratos y red
 */
router.get('/status', async (req, res) => {
    try {
        const status = await web3BridgeService.getProtocolStatus();
        res.status(status.success ? 200 : 503).json(status);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar estado Web3.' });
    }
});

/**
 * GET /api/web3/user/:wallet
 * Consulta pública de balances y compromisos on-chain para una billetera
 */
router.get('/user/:wallet', async (req, res) => {
    const { wallet } = req.params;
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({ success: false, message: 'Dirección Ethereum inválida.' });
    }

    try {
        const audit = await web3BridgeService.getUserAuditDetailed(wallet);
        res.status(audit.success ? 200 : 503).json(audit);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar datos on-chain del usuario.' });
    }
});

/**
 * POST /api/web3/faucet/usdt
 * Faucet para pruebas en Demo / Staging / Local
 */
// La emisión de prueba queda únicamente en la ruta administrativa autenticada.
router.post('/faucet/usdt', (_req,res) => res.status(403).json({success:false,message:'Solicita tokens de prueba a un administrador.'}));

module.exports = router;
