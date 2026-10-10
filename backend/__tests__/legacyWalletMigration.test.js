'use strict';
const {Interface}=require('ethers');
const {inspect}=require('../src/services/legacyWalletMigration');
const {RecoverableAccounts}=require('../src/services/recoverableAccounts');
const migration=require('../src/services/legacyWalletMigration');
const signing=require('../src/services/safeExecution');
const policy=require('../src/services/safeAccountPolicy');
const address='0x'+'1'.repeat(40),next='0x'+'2'.repeat(40),hash='0x'+'a'.repeat(64);
const roles=['BlueToken','RedToken','USDT','CoreProtocol','CollateralVault','FifoExchange'];
const contracts=Object.fromEntries(roles.map((k,i)=>[k,'0x'+String(i+3).repeat(40)]));
const abi=new Interface([
 'function balanceOf(address) view returns(uint256)',
 ...['userCollateral','exchangeReserved','pendingReserve','activeAmortizationOrder'].map(n=>'function '+n+'(address) view returns(uint256)'),
 ...['pendingRefundBlue','pendingRefundUsdt'].map(n=>'function '+n+'(address) view returns(uint128)'),
 'function isKYCVerified(address) view returns(bool)','function nextOrderId() view returns(uint64)',
 'function orders(uint64) view returns(uint64,uint64,uint128,address,uint8,uint8,uint48,uint128,uint128)']);
function fixture(overrides={}){
 const runner={query:jest.fn(async()=>({rows:[]}))};
 const rpc={getNetwork:async()=>({chainId:10n}),getBlock:async()=>({number:100,hash}),send:jest.fn(async(method,args)=>{
  if(method==='eth_getCode')return args[0]===address?'0x':'0x1234';
  if(method==='eth_getBlockByNumber')return {hash};
  if(method==='eth_getBalance'||method==='eth_getTransactionCount')return '0x0';
  const call=abi.parseTransaction({data:args[0].data});
  const key=args[0].to+':'+call.name;
  const value=overrides[key]??overrides[call.name]??(call.name==='nextOrderId'?1n:call.name==='isKYCVerified'?false:0n);
  return abi.encodeFunctionResult(call.fragment,Array.isArray(value)?value:[value]);
 })};
 return {rpc,runner,userId:1,address,chainId:'10',deployments:[contracts]};
}
test('permite dirección vacía comprobada sin hacer escrituras',async()=>{
 const f=fixture();await expect(inspect(f)).resolves.toMatchObject({address,blockNumber:100});
 expect(f.runner.query.mock.calls.every(([q])=>q.startsWith('SELECT'))).toBe(true);
 expect(f.rpc.send.mock.calls.filter(([m])=>m==='eth_call').every(([,a])=>a[1]==='0x64')).toBe(true);
});
test.each(['balanceOf','userCollateral','exchangeReserved','pendingReserve','activeAmortizationOrder','pendingRefundBlue','pendingRefundUsdt'])('bloquea %s incluso si BLUE/RED aparentan cero',async name=>{
 await expect(inspect(fixture({[name]:1n}))).rejects.toMatchObject({code:'LEGACY_MIGRATION_REQUIRED'});
});
test('bloquea KYC todavía habilitado en dirección antigua',async()=>{await expect(inspect(fixture({isKYCVerified:true}))).rejects.toThrow('habilitada');});
test.each([1n,2n,5n])('bloquea orden propia con estado %s',async state=>{
 await expect(inspect(fixture({nextOrderId:2n,orders:[1n,1n,1n,address,state,0n,0n,1n,0n]}))).rejects.toThrow('orden pendiente');
});
test('las órdenes de otro usuario no bloquean al solicitante',async()=>{
 await expect(inspect(fixture({nextOrderId:2n,orders:[1n,1n,1n,next,1n,0n,0n,1n,0n]}))).resolves.toHaveProperty('address',address);
});
test('comprueba también un despliegue anterior',async()=>{
 const old={...contracts,BlueToken:'0x'+'9'.repeat(40)};
 const f=fixture({[old.BlueToken+':balanceOf']:5n});f.deployments.push(old);
 await expect(inspect(f)).rejects.toThrow('tokens');
});
test.each(['eth_getBalance','eth_getTransactionCount'])('bloquea fondos nativos o actividad: %s',async method=>{
 const f=fixture(),send=f.rpc.send;f.rpc.send=async(m,a)=>m===method?'0x1':send(m,a);
 await expect(inspect(f)).rejects.toMatchObject({code:'LEGACY_MIGRATION_REQUIRED'});
});
test('fallo RPC no se interpreta como cero',async()=>{
 const f=fixture();f.rpc.send.mockRejectedValue(Error('offline'));await expect(inspect(f)).rejects.toThrow('No pudimos comprobar');
});
test('cambio de bloque impide aprobar una comprobación inconsistente',async()=>{
 const f=fixture(),send=f.rpc.send;f.rpc.send=async(m,a)=>m==='eth_getBlockByNumber'?{hash:'different'}:send(m,a);
 await expect(inspect(f)).rejects.toThrow('No pudimos comprobar');
});
test('red equivocada no permite reemplazo',async()=>{const f=fixture();f.rpc.getNetwork=async()=>({chainId:99n});await expect(inspect(f)).rejects.toThrow('red');});
test('una operación pendiente conserva dirección y no consulta cadena',async()=>{
 const f=fixture();f.runner.query.mockResolvedValueOnce({rows:[{id:'pending'}]});await expect(inspect(f)).rejects.toThrow('operación pendiente');expect(f.rpc.send).not.toHaveBeenCalled();
});
test('cola heredada pendiente también impide reemplazo',async()=>{
 const f=fixture();f.runner.query.mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{tx_hash:'pending'}]});await expect(inspect(f)).rejects.toThrow('operación pendiente');
});
test('suite desconocida en registro exige revisión',async()=>{
 const f=fixture();f.runner.query.mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{contract_name:'BlueToken',contract_address:next}]});await expect(inspect(f)).rejects.toThrow('despliegue anterior');
});
test('historial demasiado grande se bloquea sin bucle ilimitado',async()=>{const f=fixture({nextOrderId:202n});await expect(inspect(f)).rejects.toThrow('historial');});

describe('sustitución final ligada a la activación',()=>{
 afterEach(()=>jest.restoreAllMocks());
 function activation(){
  const client={query:jest.fn(async sql=>({rows:sql.includes('SELECT web3_wallet_address')?[{web3_wallet_address:address,account_status:'active'}]:sql.includes('SELECT address, state')?[{address:next,state:'prepared'}]:[]})),release:jest.fn()};
  const service=new RecoverableAccounts({connect:async()=>client},{},{chainId:'10',hash:'manifest'});
  service.store={get:async()=>({kind:'accountActivation',payload:{account:next,manifestHash:'manifest',legacyAddress:address,plan:[]},steps:[]}),reconcile:async()=>({success:true})};
  jest.spyOn(signing,'account').mockResolvedValue({address:next,identity_id:'identity',passkey:{owner:next}});
  jest.spyOn(policy,'validateAccount').mockResolvedValue({getOwners:async()=>[next]});
  const check=jest.spyOn(migration,'inspect').mockResolvedValue({address,blockNumber:100});
  return {service,client,check};
 }
 test('recomprueba, registra la dirección anterior y activa la nueva en una transacción',async()=>{
  const {service,client,check}=activation();await expect(service.activationStatus(1,'activation-id')).resolves.toMatchObject({success:true});
  expect(check).toHaveBeenCalledWith(expect.objectContaining({address,excludeOperationId:'activation-id'}));
  expect(client.query.mock.calls.some(([q,args])=>q.startsWith('UPDATE users')&&args[0]===next)).toBe(true);
  expect(client.query.mock.calls.some(([q])=>q.includes('INSERT INTO account_security_events'))).toBe(true);
  expect(client.query.mock.calls.at(-1)[0]).toBe('COMMIT');
 });
 test('fondos aparecidos durante activación impiden desvincular dirección anterior',async()=>{
  const {service,client,check}=activation();check.mockRejectedValue(Error('saldo nuevo'));
  await expect(service.activationStatus(1,'activation-id')).rejects.toThrow('saldo nuevo');
  expect(client.query.mock.calls.some(([q])=>q.startsWith('UPDATE'))).toBe(false);
  expect(client.query.mock.calls.at(-1)[0]).toBe('ROLLBACK');
 });
 test('otro origen de migración no permite sustituir dirección',async()=>{
  const {service,client,check}=activation();const get=service.store.get;service.store.get=async()=>{const row=await get();row.payload.legacyAddress=next;return row;};
  await expect(service.activationStatus(1,'activation-id')).rejects.toThrow('cambió');expect(check).not.toHaveBeenCalled();
  expect(client.query.mock.calls.some(([q])=>q.startsWith('UPDATE'))).toBe(false);
 });
});

test('planifica USDT y KYC sin confundirlos con permiso para abandonar fondos',async()=>{
 const f=fixture({[contracts.USDT+':balanceOf']:500000000n,isKYCVerified:true});f.migration={planning:true};
 const snapshot=await inspect(f);expect(snapshot.usdt).toEqual([{token:contracts.USDT,amount:'500000000'}]);expect(snapshot.authorizations).toEqual([contracts.CoreProtocol]);
 f.migration=null;await expect(inspect(f)).rejects.toThrow('tokens');
});
test('planificación tampoco permite abandonar BLUE o compromisos RED',async()=>{
 const f=fixture({[contracts.RedToken+':balanceOf']:1n});f.migration={planning:true};await expect(inspect(f)).rejects.toThrow('tokens');
});
