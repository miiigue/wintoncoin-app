'use strict';
jest.mock('../src/services/chainDeployment', () => ({ validate:jest.fn(async()=>{}),configuration:jest.fn() }));
jest.mock('../src/services/chainSigning', () => ({ signStep:jest.fn(async()=>({raw:'signed-test-only'})) }));
const mockCore={paused:jest.fn(async()=>false),isKYCVerified:jest.fn(async()=>true),isDelinquent:jest.fn(async()=>true)};
jest.mock('ethers',()=>({...jest.requireActual('ethers'),Contract:jest.fn(()=>mockCore)}));
const { Wallet } = require('ethers');
const {createMaintenanceWorker,settle}=require('../src/services/chainMaintenance');
const wallet='0x'+'2'.repeat(40),hash='0x'+'a'.repeat(64);
const config={chainId:'1337',contracts:{CoreProtocol:'0x'+'1'.repeat(40)},fingerprint:'test'};
const snapshot=()=>({success:true,blockNumber:42,blockHash:hash,blueBalance:'2.000001',credit:{isKYCVerified:true,isDelinquent:true}});

test('solo guarda el resultado anclado al bloque; no usa saldos ni relojes SQL para amortizar',async()=>{
 const pool={query:jest.fn(async sql=>({rows:sql.includes('FROM users')?[{id:1,web3_wallet_address:wallet}]:[]}))};
 const bridge={getUserAuditDetailed:jest.fn(async()=>snapshot())},rpc={getBlock:async()=>({hash})},execute=jest.fn(async()=>({success:false,status:'not_configured'}));
 const worker=createMaintenanceWorker(pool,{bridge,rpc,config,execute});
 expect(await worker.tick()).toMatchObject({checked:1,awaiting:1});
 expect(bridge.getUserAuditDetailed).toHaveBeenCalledWith(wallet,0,1,'safe');
 expect(pool.query.mock.calls[1][1]).toEqual(['1337',config.contracts.CoreProtocol,wallet,42,hash,JSON.stringify(snapshot())]);
 expect(pool.query.mock.calls.some(([sql])=>sql.includes('record_balance_event')||sql.includes('UPDATE users'))).toBe(false);
});
test('reorganización no guarda ni envía amortización',async()=>{
 const pool={query:jest.fn(async()=>({rows:[{id:1,web3_wallet_address:wallet}]}))},execute=jest.fn();
 const worker=createMaintenanceWorker(pool,{config,rpc:{getBlock:async()=>({hash:'changed'})},bridge:{getUserAuditDetailed:async()=>snapshot()},execute});
 expect(await worker.tick()).toMatchObject({failed:1});expect(pool.query).toHaveBeenCalledTimes(1);expect(execute).not.toHaveBeenCalled();
});
test('KYC suspendido y saldo cero no activan transacciones; el saldo real sí se refleja',async()=>{
 const pool={query:jest.fn(async sql=>({rows:sql.includes('FROM users')?[{id:1,web3_wallet_address:wallet}]:[]}))},execute=jest.fn();
 for(const s of [{...snapshot(),credit:{isKYCVerified:false,isDelinquent:true}},{...snapshot(),blueBalance:'0.0'}]){
  await createMaintenanceWorker(pool,{config,rpc:{getBlock:async()=>({hash})},bridge:{getUserAuditDetailed:async()=>s},execute}).tick();
 }
 expect(execute).not.toHaveBeenCalled();
});
test('lectura RPC fallida no modifica datos ni bloquea cuentas posteriores',async()=>{
 const pool={query:jest.fn(async sql=>({rows:sql.includes('FROM users')?[{id:1,web3_wallet_address:wallet},{id:2,web3_wallet_address:wallet}]:[]}))},execute=jest.fn(async()=>({success:true}));
 const bridge={getUserAuditDetailed:jest.fn().mockResolvedValueOnce({success:false}).mockResolvedValueOnce(snapshot())};
 expect(await createMaintenanceWorker(pool,{config,rpc:{getBlock:async()=>({hash})},bridge,execute}).tick()).toMatchObject({checked:1,failed:1});
 expect(execute).toHaveBeenCalledTimes(1);
});
test('sin presupuesto no firma ni consulta contrato ni pide una clave al usuario',async()=>{
 expect(await settle({pool:{query:async()=>({rows:[]})},rpc:{},config,wallet,env:{}})).toEqual({status:'not_configured'});
});
function budgetFixture(){
 const env={RELAYER_PRIVATE_KEY:Wallet.createRandom().privateKey,MAINTENANCE_MAX_STEP_FEE_WEI:'10',MAINTENANCE_DAILY_BUDGET_WEI:'20'};
 const state={used:'0',active:[]};
 const client={query:jest.fn(async sql=>sql.includes('pg_try')?{rows:[{acquired:true}]}:sql.includes('AS total')?{rows:[{total:'0',user_count:0}]}:sql.includes('SUM(')?{rows:[{used:state.used}]}:sql.includes('SELECT id,state')?{rows:state.active}:{rows:[]}),release:jest.fn()};
 const pool={connect:async()=>client,query:async()=>({rows:Object.entries({gas_sponsor_enabled:'true',gas_sponsor_daily_budget_wei:'100',gas_sponsor_maintenance_max_step_wei:'10',gas_sponsor_maintenance_daily_budget_wei:'20'}).map(([setting_key,setting_value])=>({setting_key,setting_value}))})};
 const store={prepare:jest.fn(async input=>({id:'new',...input})),authorize:jest.fn(async()=>({pending:true})),reconcile:jest.fn(async()=>({pending:true}))};
 return {pool,rpc:{},config,wallet,env,store,state};
}
test('presupuesto máximo se respeta antes de crear una operación',async()=>{
 const f=budgetFixture();f.state.used='11';expect(await settle(f)).toEqual({status:'budget_exhausted'});expect(f.store.prepare).not.toHaveBeenCalled();
});
test('una firma pendiente se recupera por su referencia sin duplicar el envío',async()=>{
 const f=budgetFixture();f.state.active=[{id:'existing',state:'pending'}];await settle(f);
 expect(f.store.reconcile).toHaveBeenCalledWith('existing');expect(f.store.prepare).not.toHaveBeenCalled();
});
test('guarda propósito, red y límite antes de autorizar la operación',async()=>{
 const f=budgetFixture();await settle(f);const plan=f.store.prepare.mock.calls[0][0];
 expect(plan).toMatchObject({kind:'settleMatured',chainId:'1337',payload:{maxFeeWei:'10',fingerprint:'test'}});
 expect(f.store.authorize).toHaveBeenCalledWith('new',null,expect.any(Function));
});
