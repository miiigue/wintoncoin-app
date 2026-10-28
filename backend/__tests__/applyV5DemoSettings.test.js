'use strict';

const {apply}=require('../scripts/apply_v5_demo_settings');

function fixture(){
    const client={query:jest.fn(async()=>({rows:[]})),release:jest.fn()};
    const pool={connect:jest.fn(async()=>client)};
    const config={chainId:'11155420',epoch:'V5_CODEX_163',fingerprint:'0x123',contracts:{}};
    const deployment={configuration:jest.fn(()=>config),provider:jest.fn(()=>({})),validate:jest.fn(async()=>config)};
    const migration={up:jest.fn(async c=>c.query('APPLY SETTINGS'))};
    return {client,pool,deployment,migration};
}

test('rechaza aplicar parámetros fuera del corte V5 explícito',async()=>{
    const f=fixture();
    await expect(apply({...f,env:{IS_DEMO_ENV:'true'}})).rejects.toThrow(/V5_CODEX_163 explícita/);
    expect(f.pool.connect).not.toHaveBeenCalled();
});

test('valida contratos y aplica todos los parámetros en una sola transacción',async()=>{
    const f=fixture();
    await expect(apply({...f,env:{IS_DEMO_ENV:'true',WINTON_DEPLOYMENT_EPOCH:'V5_CODEX_163'}}))
        .resolves.toMatchObject({applied:true,epoch:'V5_CODEX_163',fingerprint:'0x123'});
    expect(f.deployment.validate).toHaveBeenCalled();
    expect(f.migration.up).toHaveBeenCalledWith(f.client);
    expect(f.client.query.mock.calls.map(call=>call[0])).toEqual(['BEGIN','APPLY SETTINGS','COMMIT']);
    expect(f.client.release).toHaveBeenCalled();
});

test('un fallo revierte sin publicar configuración parcial',async()=>{
    const f=fixture();f.migration.up.mockRejectedValueOnce(new Error('fallo SQL'));
    await expect(apply({...f,env:{IS_DEMO_ENV:'true',WINTON_DEPLOYMENT_EPOCH:'V5_CODEX_163'}})).rejects.toThrow('fallo SQL');
    expect(f.client.query.mock.calls.map(call=>call[0])).toEqual(['BEGIN','ROLLBACK']);
});
