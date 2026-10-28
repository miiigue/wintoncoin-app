'use strict';

async function apply({env=process.env,pool=require('../src/config/db'),deployment=require('../src/services/chainDeployment'),
    migration=require('../migrations/124_demo_clean_deployment')}={}) {
    if(env.IS_DEMO_ENV!=='true'||env.WINTON_DEPLOYMENT_EPOCH!=='V5_CODEX_163')
        throw new Error('El corte de configuración solo está permitido en Demo con la época V5_CODEX_163 explícita.');
    const config=deployment.configuration(env);
    if(config.chainId!=='11155420'||config.epoch!=='V5_CODEX_163')throw new Error('La suite V5 no está seleccionada.');
    await deployment.validate(deployment.provider(),config);
    const client=await pool.connect();
    try {
        await client.query('BEGIN');
        const previousDemo=process.env.IS_DEMO_ENV,previousEpoch=process.env.WINTON_DEPLOYMENT_EPOCH;
        process.env.IS_DEMO_ENV='true';process.env.WINTON_DEPLOYMENT_EPOCH='V5_CODEX_163';
        try {await migration.up(client);} finally {
            if(previousDemo===undefined)delete process.env.IS_DEMO_ENV;else process.env.IS_DEMO_ENV=previousDemo;
            if(previousEpoch===undefined)delete process.env.WINTON_DEPLOYMENT_EPOCH;else process.env.WINTON_DEPLOYMENT_EPOCH=previousEpoch;
        }
        await client.query('COMMIT');
        return {applied:true,chainId:config.chainId,epoch:config.epoch,fingerprint:config.fingerprint};
    } catch(error) {await client.query('ROLLBACK');throw error;}
    finally {client.release();}
}

if(require.main===module)apply().then(result=>{
    process.stdout.write(`V5_DEMO_SETTINGS_APPLIED ${JSON.stringify(result)}\n`);
    process.exit(0);
}).catch(error=>{
    process.stderr.write(`V5_DEMO_SETTINGS_ABORTED ${error.message}\n`);
    process.exit(2);
});

module.exports={apply};
