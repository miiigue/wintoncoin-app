const {Wallet}=require('ethers');
const {inspect}=require('../src/services/web3Readiness');
const deployment=require('../src/services/chainDeployment');

function fixture(){
 const admin=Wallet.createRandom(),relayer=Wallet.createRandom(),sponsor=Wallet.createRandom();
 const env={ADMIN_SECRET_KEY:'only-test-admin-secret',JWT_SECRET:'only-test-user-secret',ENCRYPTION_SECRET:'test-only-'.repeat(5),ADMIN_CHAIN_PRIVATE_KEY:admin.privateKey,RELAYER_PRIVATE_KEY:relayer.privateKey,GAS_SPONSOR_PRIVATE_KEY:sponsor.privateKey};
 const settings={gas_sponsor_enabled:'true',gas_sponsor_daily_budget_wei:'100',gas_sponsor_max_topup_wei:'10'};
 const state={fresh:true};
 const pool={query:jest.fn(async sql=>{
  if(sql.includes('schema_migrations'))return {rowCount:4,rows:[]};
  if(sql.includes('GROUP BY'))return {rowCount:0,rows:[]};
  if(sql.includes('app_settings'))return {rows:Object.entries(settings).map(([setting_key,setting_value])=>({setting_key,setting_value}))};
  if(sql.includes('web3_exchange_sync'))return {rows:[{status:'ready',fresh:state.fresh}]};
  throw Error('Unexpected SQL');
 })};
 const rpc={getBlock:jest.fn(async()=>({timestamp:Math.floor(Date.now()/1000)})),getBalance:jest.fn(async()=>1n),destroy:jest.fn()};
 const contract=()=>({owner:async()=>admin.address,relayer:async()=>relayer.address,paused:async()=>false});
 return {env,pool,rpc,contract,settings,state,validate:async()=>deployment.configuration(env)};
}
test('comprueba roles, gas, enlace y SQL sin firmar ni escribir ni revelar claves',async()=>{
 const f=fixture(),result=await inspect(f);expect(result.ready).toBe(true);
 expect(f.rpc.destroy).toHaveBeenCalledTimes(1);
 expect(f.pool.query.mock.calls.every(([sql])=>sql.startsWith('SELECT'))).toBe(true);
 for(const key of Object.values(f.env))expect(JSON.stringify(result)).not.toContain(key);
});
test('presupuesto cero bloquea patrocinio aunque la opción esté activada',async()=>{
 const f=fixture();f.settings.gas_sponsor_daily_budget_wei='0';
 expect((await inspect(f)).checks.find(x=>x.id==='gas_budget').ready).toBe(false);
});
test('firmante de pagos distinto al autorizado no aparece listo',async()=>{
 const f=fixture();f.env.RELAYER_PRIVATE_KEY=Wallet.createRandom().privateKey;
 expect((await inspect(f)).checks.find(x=>x.id==='relayer_permission').ready).toBe(false);
});
test('RPC detenido e indexador antiguo se distinguen de conexión correcta',async()=>{
 const f=fixture();f.rpc.getBlock.mockResolvedValue({timestamp:Math.floor(Date.now()/1000)-400});f.state.fresh=false;
 const r=await inspect(f);expect(r.ready).toBe(false);
 expect(r.checks.filter(x=>['rpc_fresh','indexer'].includes(x.id)).every(x=>!x.ready)).toBe(true);
});
test('fallo remoto no filtra endpoint ni claves y aún comprueba presupuesto',async()=>{
 const f=fixture();f.validate=async()=>{throw Error('https://secret-provider/key')};
 const r=await inspect(f);expect(r.ready).toBe(false);expect(JSON.stringify(r)).not.toContain('secret-provider');
 expect(r.checks.find(x=>x.id==='gas_budget').ready).toBe(true);
});
