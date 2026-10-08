const {Wallet}=require('ethers');
const policy=require('../src/services/safeAccountPolicy');
const deployment=require('../src/services/chainDeployment');
const {check}=require('../src/services/accountActivationReadiness');
function fixture(){
 const env={WINTON_CHAIN_ID:'11155420',RELAYER_PRIVATE_KEY:Wallet.createRandom().privateKey,RECOVERY_RELAYER_PRIVATE_KEY:Wallet.createRandom().privateKey,IDENTITY_DOCUMENT_HMAC_KEY:'x'.repeat(32),RECOVERY_GAS_MAX_WEI:'10',RECOVERY_GAS_DAILY_WEI:'100'};
 const settings={gas_sponsor_enabled:'true',gas_sponsor_max_topup_wei:'10',gas_sponsor_daily_budget_wei:'100',gas_sponsor_daily_user_operations:'3'};
 const used={total:'0',user_count:0};
 const pool={query:jest.fn(async sql=>sql.includes('app_settings')?{rows:Object.entries(settings).map(([setting_key,setting_value])=>({setting_key,setting_value}))}:{rows:[used]})};
 const rpc={getBalance:jest.fn(async()=>100n)};
 return {pool,rpc,config:{chainId:'11155420'},userId:1,env,settings,used};
}
beforeEach(()=>{jest.spyOn(deployment,'validate').mockResolvedValue({});jest.spyOn(policy,'validateInfrastructure').mockResolvedValue();});
afterEach(()=>jest.restoreAllMocks());
test('preflight solo lee y no reserva ni firma',async()=>{const f=fixture();await expect(check(f)).resolves.toBe(true);expect(f.pool.query.mock.calls.every(([s])=>s.startsWith('SELECT'))).toBe(true);});
test('no inicia con red equivocada',async()=>{const f=fixture();f.config.chainId='10';await expect(check(f)).rejects.toThrow('red');});
test('no oculta fallo de contratos',async()=>{const f=fixture();policy.validateInfrastructure.mockRejectedValue(Error('contract mismatch'));await expect(check(f)).rejects.toThrow('contract mismatch');});
test('no inicia sin presupuesto',async()=>{const f=fixture();f.settings.gas_sponsor_enabled='false';await expect(check(f)).rejects.toThrow('presupuesto');});
test('reserva potencial contempla cuatro pasos',async()=>{const f=fixture();f.used.total='70';await expect(check(f)).rejects.toThrow('presupuesto');});
test('no inicia con cuota agotada',async()=>{const f=fixture();f.used.user_count=3;await expect(check(f)).rejects.toThrow('presupuesto');});
test('no inicia sin fondos del ejecutor',async()=>{const f=fixture();f.rpc.getBalance.mockResolvedValue(0n);await expect(check(f)).rejects.toThrow('fondos');});
test('no inicia sin protección de identidad',async()=>{const f=fixture();f.env.IDENTITY_DOCUMENT_HMAC_KEY='';await expect(check(f)).rejects.toThrow('identidad');});
test('no inicia si emergencia reutiliza clave',async()=>{const f=fixture();f.env.RECOVERY_RELAYER_PRIVATE_KEY=f.env.RELAYER_PRIVATE_KEY;await expect(check(f)).rejects.toThrow('independiente');});
test('no inicia sin presupuesto de emergencia',async()=>{const f=fixture();f.env.RECOVERY_GAS_MAX_WEI='0';await expect(check(f)).rejects.toThrow('recuperación');});
test('no inicia sin fondos de emergencia',async()=>{const f=fixture();f.rpc.getBalance.mockResolvedValueOnce(100n).mockResolvedValueOnce(0n);await expect(check(f)).rejects.toThrow('recuperación');});
