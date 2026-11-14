'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const dep=require('../src/services/marketplaceDeployment');const gate=require('../src/services/economicWriteGate');
const {WalletOperations}=require('../src/services/walletOperations');
const {ChainOperationStore}=require('../src/services/chainOperationStore');
const c=Object.fromEntries(['USDT','CollateralVaultV6','PaymentEngine','BlueTokenV6','RedTokenV6','ExchangeCustody','ExchangeRouter','RiskRegistry'].map((n,i)=>[n,'0x'+String(i+1).padStart(40,'0')]));
const user='0x'+'9'.repeat(40);
test('prepare V6 verifica KYC en RiskRegistry y guarda el plan junto a la época',async()=>{
  const originalGate=gate.assertOperational,originalValidate=dep.validate;let kycAt, saved;
  gate.assertOperational=async()=>{};dep.validate=async()=>{};
  class MockContract{constructor(addr){this.addr=addr;}async isKYCVerified(){kycAt=this.addr;return true;}async balanceOf(){return 10000000n;}async allowance(){return 0n;}}
  const safe={relayer:()=>({address:user})};
  try {
    const service=new WalletOperations({}, {}, {epoch:'V6_DEMO',chainId:'11155420',fingerprint:'v6',contracts:c}, {}, {ContractClass:MockContract,safeExecution:safe});
    assert.equal(service.store.deployment,dep);
    service.identity=async()=>({address:user});service.store={prepare:async input=>{saved=input;return {id:input.id,kind:input.kind,state:'prepared',steps:[]};}};
    await service.prepare(1,{action:'deposit',amount:'1'});
    assert.equal(kycAt,c.RiskRegistry);assert.equal(saved.payload.kycContract,c.RiskRegistry);assert.equal(saved.payload.fingerprint,'v6');assert.equal(saved.payload.plan[1].to,c.CollateralVaultV6);
  } finally {gate.assertOperational=originalGate;dep.validate=originalValidate;}
});
test('prepare V6 rechaza funciones de garantía aún no implementadas antes de validación on-chain',async()=>{
  const original=gate.assertOperational;gate.assertOperational=async()=>{};
  try {const service=new WalletOperations({}, {}, {epoch:'V6_DEMO',contracts:c}, {}, {});service.identity=async()=>({address:user});await assert.rejects(service.prepare(1,{action:'autoCollateral',enabled:true}),/no está disponible/);}
  finally{gate.assertOperational=original;}
});
test('reconciliación usa selector V6 y bloquea huella distinta sin transmitir',async()=>{
  let gateCalls=0;const deployment={configuration:()=>({epoch:'V6_DEMO',chainId:'11155420',fingerprint:'otra'})};
  const writeGate={operationalStatus:async()=>{gateCalls++;return {enabled:true};},isContainmentAction:()=>false};
  const store=new ChainOperationStore({}, {}, {deployment,writeGate});store.quarantine=async()=>({state:'conflict'});
  const result=await store.ensureBroadcastAllowed({chain_id:'11155420',kind:'buy',payload:{fingerprint:'esperada'}},{});
  assert.equal(result.allowed,false);assert.equal(gateCalls,0);
});
