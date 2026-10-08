'use strict';
const policy=require('./safeAccountPolicy');
const deployment=require('./chainDeployment');
const signing=require('./safeExecution');
const {error}=require('./chainOperationStore');
const {usage}=require('./gasBudgetUsage');
// Read-only preflight. It neither reserves funds nor replaces per-operation checks.
async function check({pool,rpc,config,userId,env=process.env}) {
    const economic=deployment.configuration(env);
    if(economic.chainId!==String(config.chainId))throw error('La configuración de red requiere revisión del equipo.',503);
    await deployment.validate(rpc,economic);
    await policy.validateInfrastructure(rpc,config);
    const rows=await pool.query("SELECT setting_key,setting_value FROM app_settings WHERE setting_key LIKE 'gas_sponsor_%'");
    const s=Object.fromEntries(rows.rows.map(x=>[x.setting_key,x.setting_value]));
    const digits=v=>typeof v==='string'&&/^\d+$/.test(v);
    const max=s.gas_sponsor_max_topup_wei,daily=s.gas_sponsor_daily_budget_wei;
    const limit=Number(s.gas_sponsor_daily_user_operations);
    if(s.gas_sponsor_enabled!=='true'||!digits(max)||!digits(daily)||BigInt(max)<=0n||BigInt(daily)<BigInt(max)||!Number.isSafeInteger(limit)||limit<1)
        throw error('El servicio que cubre la activación todavía no tiene presupuesto habilitado. Debe configurarlo el equipo.',503);
    const used=await usage(pool,String(config.chainId),userId);
    // New activation requires four on-chain steps, counted as one user operation.
    if(Number(used.user_count)>=limit||BigInt(used.total)+4n*BigInt(max)>BigInt(daily))throw error('El presupuesto disponible no alcanza para iniciar la activación. Inténtalo cuando se renueve.',429);
    if(await rpc.getBalance(signing.relayer(env).address)<4n*BigInt(max))throw error('El servicio de activación necesita fondos. Debe reponerlos el equipo.',503);
    if((env.IDENTITY_DOCUMENT_HMAC_KEY||'').length<32)throw error('La protección de identidad está pendiente de configuración por el equipo.',503);
    const emergency=require('./recoveryEmergency').signer(env);
    const emergencyMax=env.RECOVERY_GAS_MAX_WEI,emergencyDaily=env.RECOVERY_GAS_DAILY_WEI;
    if(!digits(emergencyMax)||!digits(emergencyDaily)||BigInt(emergencyMax)<=0n||BigInt(emergencyDaily)<BigInt(emergencyMax))throw error('El presupuesto de recuperación está pendiente de configuración por el equipo.',503);
    if(await rpc.getBalance(emergency.address)<BigInt(emergencyMax))throw error('El servicio de recuperación necesita fondos. Debe reponerlos el equipo.',503);
    return true;
}
module.exports={check};
