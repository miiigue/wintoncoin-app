'use strict';
const {createMaintenanceWorker}=require('../services/chainMaintenance');
const workers=new WeakMap();
module.exports=async function onchainMaintenanceJob(pool) {
    if(!workers.has(pool))workers.set(pool,createMaintenanceWorker(pool));
    try {
        const result=await workers.get(pool).tick();
        if(result.failed || result.awaiting)console.warn('[CHAIN_MAINTENANCE]',JSON.stringify(result));
        return result;
    } catch {
        console.error('[CHAIN_MAINTENANCE] No se pudo verificar blockchain; no se modificaron saldos heredados.');
        return {status:'unavailable'};
    }
};
