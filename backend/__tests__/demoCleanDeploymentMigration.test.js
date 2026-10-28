'use strict';

const migration=require('../migrations/124_demo_clean_deployment');

describe('migración de configuración económica V5',()=>{
    const original={IS_DEMO_ENV:process.env.IS_DEMO_ENV,WINTON_DEPLOYMENT_EPOCH:process.env.WINTON_DEPLOYMENT_EPOCH};
    afterEach(()=>{
        for(const [key,value] of Object.entries(original)){
            if(value===undefined)delete process.env[key];else process.env[key]=value;
        }
    });

    test('no modifica la demo mientras siga seleccionada la suite V4 activa',async()=>{
        process.env.IS_DEMO_ENV='true';
        delete process.env.WINTON_DEPLOYMENT_EPOCH;
        const client={query:jest.fn()};
        await migration.up(client);
        expect(client.query).not.toHaveBeenCalled();
    });

    test('aplica parámetros únicamente durante un corte V5 explícito',async()=>{
        process.env.IS_DEMO_ENV='true';
        process.env.WINTON_DEPLOYMENT_EPOCH='V5_CODEX_163';
        const client={query:jest.fn(async()=>({rows:[]}))};
        await migration.up(client);
        expect(client.query).toHaveBeenCalled();
        for(const call of client.query.mock.calls)expect(call[0]).toMatch(/^INSERT INTO app_settings/);
    });
});
