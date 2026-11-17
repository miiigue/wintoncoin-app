'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const governance = require('../src/services/v6ModeGovernance');
const {Interface}=require('ethers');
const target='0x1111111111111111111111111111111111111111',owner='0x2222222222222222222222222222222222222222';
const operationId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',txHash='0x'+'a'.repeat(64);
const data=new Interface(['function setMode(uint8)']).encodeFunctionData('setMode',[0]);
test('readiness real permanece bloqueada si falta configuración de entorno V6 o estado listo',async()=>{
  await assert.rejects(governance.ready({pool:{},env:{}}));
  assert.equal((await governance.status({pool:{}})).activationReady,false);
});

function setup() {
  const c={chainId:'11155420',mode:'PRELAUNCH_FROZEN',contracts:{ProtocolModeController:target}};
  const state={c,owner,mode:0n,tx:{from:owner,to:target,data,value:0n,chainId:11155420n},receipt:{status:1,blockNumber:10,blockHash:'0xblock'},block:{hash:'0xblock'},head:11,active:false};
  const row={id:operationId,kind:'v6-owner:normal',chain_id:'11155420',sender:owner.toLowerCase(),payload:{to:target,data},state:'prepared'};
  const pool={query:async(sql)=>sql.startsWith('SELECT id')?{rowCount:state.active?1:0}:{rowCount:1}};
  const provider={call:async()=>{},getTransaction:async()=>state.tx,getTransactionReceipt:async()=>state.receipt,getBlock:async()=>state.block,getBlockNumber:async()=>state.head};
  class MockContract {async owner(){return state.owner;} async mode(){return state.mode;}}
  class MockStore {async prepare(){return row;} async get(){return row;}}
  const api=governance.createGovernance({readiness:async()=>state.c,ContractClass:MockContract,Store:MockStore,lock:async(_pool,_key,fn)=>fn(pool)});
  return {api,state,pool,provider,row};
}
test('prepare produce payload propietario con suite verificada',async()=>{const {api,pool,provider}=setup();const r=await api.prepare({pool,provider});assert.equal(r.to,target);assert.equal(r.owner,owner);assert.equal(r.data,data);});
test('prepare rechaza modo no congelado',async()=>{const {api,pool,provider,state}=setup();state.c.mode='NORMAL';await assert.rejects(api.prepare({pool,provider}),/no está congelado/);});
test('prepare rechaza operación previa',async()=>{const {api,pool,provider,state}=setup();state.active=true;await assert.rejects(api.prepare({pool,provider}),/pendiente/);});
test('confirm verifica transacción y modo NORMAL',async()=>{const {api,pool,provider}=setup();const r=await api.confirm({pool,provider,operationId,txHash});assert.equal(r.state,'confirmed');assert.equal(r.mode,'NORMAL');});
test('confirm rechaza remitente ajeno',async()=>{const {api,pool,provider,state}=setup();state.tx.from=target;await assert.rejects(api.confirm({pool,provider,operationId,txHash}),/ajena/);});
test('confirm espera confirmaciones sin reenviar',async()=>{const {api,pool,provider,state}=setup();state.head=10;const r=await api.confirm({pool,provider,operationId,txHash});assert.equal(r.pending,true);});
test('confirm es recuperable con mismo hash',async()=>{const {api,pool,provider,row}=setup();row.state='confirmed';row.steps=[{hash:txHash}];const r=await api.confirm({pool,provider,operationId,txHash});assert.equal(r.state,'confirmed');});
test('confirm rechaza usar otro hash para operación confirmada',async()=>{const {api,pool,provider,row}=setup();row.state='confirmed';row.steps=[{hash:'0x'+'b'.repeat(64)}];await assert.rejects(api.confirm({pool,provider,operationId,txHash}),/otra transacción/);});
test('confirm rechaza contrato que continúa congelado',async()=>{const {api,pool,provider,state}=setup();state.mode=1n;await assert.rejects(api.confirm({pool,provider,operationId,txHash}),/no está confirmado/);});
test('consulta permite firmar solo si readiness está congelada',async()=>{const {api,pool,state}=setup();assert.equal((await api.status({pool})).activationReady,true);state.c.mode='NORMAL';assert.equal((await api.status({pool})).activationReady,false);});
test('confirmación rechaza identificadores inválidos sin consultar DB ni RPC', async()=>{
  await assert.rejects(governance.confirm({pool:{},provider:{},operationId:'bad',txHash:'bad'}),/Referencia inválida/);
});
