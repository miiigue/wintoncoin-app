import test from 'node:test';
import assert from 'node:assert/strict';
import {configurationFeedback,safeDiagnostic} from '../src/modules/configurationFeedback.js';
const context={key:'platform_commission_percentage',label:'Comisión',value:'5'};
test('success requires explicit confirmation, including zero',()=>{
 const r=configurationFeedback({...context,value:'0',status:200,data:{success:true}});assert.equal(r.kind,'success');assert.equal(r.value,'0');
 assert.equal(configurationFeedback({...context,status:200,data:null}).kind,'error');
});
test('pending and reconciliation are never announced as fully saved',()=>{
 for(const data of [{accepted:true,success:false},{success:true,pendingReconciliation:true}])assert.equal(configurationFeedback({...context,status:202,data}).kind,'warning');
});
test('network loss does not falsely assert no changes occurred',()=>{
 const r=configurationFeedback({...context,networkError:true});assert.equal(r.kind,'warning');assert.match(r.message,/podría haberse recibido/);
});
test('missing signer preserves useful cause and next step',()=>{
 const r=configurationFeedback({...context,status:503,data:{message:'Falta configurar el firmante administrativo de blockchain.'}});
 assert.match(r.message,/Falta configurar/);assert.match(r.action,/servidor/);assert.equal(r.httpStatus,503);
});
test('governance denial explains approval requirement',()=>assert.match(configurationFeedback({...context,status:403,data:{governance_required:true}}).action,/aprobación de gobernanza/));
test('typed references are displayed and diagnostic secrets are removed',()=>{
 const hash='0x'+'a'.repeat(64),r=configurationFeedback({...context,status:503,data:{message:'RPC https://rpc.example/private-key API_KEY=secret Bearer verySecret '+hash,txHash:hash,operationId:'bad'}});
 assert.equal(r.txHash,hash);assert.equal(r.operationId,undefined);assert.doesNotMatch(r.message,/rpc.example|verySecret|API_KEY=secret/);assert.equal(safeDiagnostic({raw:'unexpected'}),'');
});
