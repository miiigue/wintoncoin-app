jest.mock('../src/services/chainSigning',()=>({signStep:jest.fn(async()=>({raw:'synthetic',hash:'test'}))}));
const {Wallet,Interface,ZeroAddress}=require('ethers');
const emergency=require('../src/services/recoveryEmergency');
const policy=require('../src/services/safeAccountPolicy');
const env={RECOVERY_RELAYER_PRIVATE_KEY:Wallet.createRandom().privateKey,RELAYER_PRIVATE_KEY:Wallet.createRandom().privateKey,RECOVERY_GAS_MAX_WEI:'10',RECOVERY_GAS_DAILY_WEI:'100'};
const config={chainId:'1337',hash:'test',contracts:{recoveryModule:{address:Wallet.createRandom().address}}};
const account=Wallet.createRandom().address;
function fixture(){
 const tx=policy.transaction({to:config.contracts.recoveryModule.address,data:new Interface(policy.recoveryAbi).encodeFunctionData('cancelRecovery',[])},0);
 const call=policy.execution(account,tx,'0x'+'11'.repeat(65));
 const row={id:'test',sender:emergency.signer(env).address,kind:'accountRecoveryCancel',payload:{authorization:{account,chainId:'1337',manifestHash:'test'}}};
 const client={query:jest.fn(async sql=>({rows:sql.includes('pg_try')?[{acquired:true}]:sql.includes('SUM')?[{total:'0'}]:[],rowCount:1})),release:jest.fn()};
 return {call,row,tx,client,pool:{connect:async()=>client}};
}
test('no usa cuota ni presupuesto de pagos normales',async()=>{
 const f=fixture();await expect(emergency.sponsor(f.pool,{},config,f.row,f.call,env)).resolves.toHaveProperty('raw');
 expect(f.client.query.mock.calls.some(([sql])=>sql.includes('app_settings')||sql.includes('user_count'))).toBe(false);
 expect(f.client.query.mock.calls.some(([sql])=>sql.includes('emergencyReservedWei'))).toBe(true);
});
test('bloquea si se agotó presupuesto de emergencia',async()=>{
 const f=fixture();f.client.query.mockImplementation(async sql=>({rows:sql.includes('pg_try')?[{acquired:true}]:sql.includes('SUM')?[{total:'100'}]:[],rowCount:1}));
 await expect(emergency.sponsor(f.pool,{},config,f.row,f.call,env)).rejects.toMatchObject({status:429});
});
test('ejecutor de emergencia debe ser independiente de relayer habitual, admin y patrocinador',()=>{
 const key=env.RECOVERY_RELAYER_PRIVATE_KEY;
 expect(()=>emergency.signer({...env,RELAYER_PRIVATE_KEY:key})).toThrow('independiente');
 expect(()=>emergency.signer({...env,ADMIN_CHAIN_PRIVATE_KEY:key})).toThrow('independiente');
 expect(()=>emergency.signer({...env,GAS_SPONSOR_PRIVATE_KEY:key})).toThrow('independiente');
});
test('valida consistencia con RECOVERY_RELAYER_ADDRESS si esta configurada',()=>{
 const wallet=new Wallet(env.RECOVERY_RELAYER_PRIVATE_KEY);
 expect(()=>emergency.signer({...env,RECOVERY_RELAYER_ADDRESS:wallet.address})).not.toThrow();
 expect(()=>emergency.signer({...env,RECOVERY_RELAYER_ADDRESS:Wallet.createRandom().address})).toThrow('no coincide');
});
test.each(['transfer','delegate','refund','target','kind'])('rechaza abuso: %s',mode=>{
 const f=fixture();
 if(mode==='transfer')f.tx.value='1';
 if(mode==='delegate')f.tx.operation=1;
 if(mode==='refund')f.tx.refundReceiver=Wallet.createRandom().address;
 if(mode==='target')f.tx.to=Wallet.createRandom().address;
 if(mode==='kind')f.row.kind='wallet';
 const call=policy.execution(account,f.tx,'0x'+'11'.repeat(65));
 expect(()=>emergency.assertCancellation(config,f.row,call)).toThrow();
});
test('sin presupuesto configurado no promete enviar',async()=>{
 const f=fixture();await expect(emergency.sponsor(f.pool,{},config,f.row,f.call,{...env,RECOVERY_GAS_DAILY_WEI:'0'})).rejects.toMatchObject({status:503});
});

test('rechaza dirección del ejecutor expuesto sin usar su clave',()=>{
 expect(()=>emergency.assertExecutorAllowed('0xF28a82bBc295c00f036d304D252E45A10B336323')).toThrow('sustituido');
 expect(()=>emergency.assertExecutorAllowed(Wallet.createRandom().address)).not.toThrow();
});
