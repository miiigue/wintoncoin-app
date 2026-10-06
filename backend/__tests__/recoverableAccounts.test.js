'use strict';
const {Wallet,Interface,ZeroAddress}=require('ethers');
const {documentReference,attachReviewedDocument}=require('../src/services/accountIdentity');
const policy=require('../src/services/safeAccountPolicy');
const {RecoverableAccounts,backupMessage}=require('../src/services/recoverableAccounts');
const {PersonalRecovery}=require('../src/services/personalRecovery');
const key='synthetic-test-only-identity-key-00000000';
test('normalizar espacios no permite reutilizar un documento',()=>{
 expect(documentReference({country:'AR',type:'passport',number:'AB-123 456'},key)).toBe(documentReference({country:'AR',type:'passport',number:'ab123456'},key));
});
test('números iguales de distintos países no demuestran identidad',()=>{
 const doc={country:'AR',type:'passport',number:'123456'};
 expect(documentReference(doc,key)).not.toBe(documentReference({...doc,country:'ES'},key));
});
test('falla sin protección de datos o documento válido',()=>{
 expect(()=>documentReference({country:'AR',type:'passport',number:'1234'},'weak')).toThrow('protección');
 expect(()=>documentReference({country:'AR',type:'passport',number:'<script>'},key)).toThrow('inválido');
});
test('rechaza el documento ya vinculado a otra identidad',async()=>{
 const client={query:jest.fn(async sql=>({rows:sql.startsWith('SELECT * FROM account_identities')?[{id:'a'}]:sql.startsWith('SELECT identity_id')?[{identity_id:'b'}]:[]}))};
 await expect(attachReviewedDocument(client,{userId:1,reviewerId:2,country:'AR',type:'passport',number:'123456',evidenceReference:'verified-case-123'},key)).rejects.toThrow('identidad existente');
 expect(client.query.mock.calls.some(([sql])=>sql.startsWith('INSERT INTO identity_documents'))).toBe(false);
});
test('el respaldo firmado vincula usuario, solicitud, red y manifiesto',()=>{
 const c={chainId:'10',hash:'manifest-a'},message=backupMessage('id-a',1,c);
 expect(message).not.toBe(backupMessage('id-b',1,c));
 expect(message).not.toBe(backupMessage('id-a',2,c));
 expect(message).not.toBe(backupMessage('id-a',1,{...c,chainId:'11155420'}));
 expect(message).not.toBe(backupMessage('id-a',1,{...c,hash:'manifest-b'}));
});
test('un desafío consumido no activa ni modifica la cuenta',async()=>{
 const client={query:jest.fn(async()=>({rows:[]})),release:jest.fn()};
 const rpc={getNetwork:async()=>({chainId:10n})};
 const service=new RecoverableAccounts({connect:async()=>client},rpc,{chainId:'10',contracts:{},recoveryDeploymentEvidence:'test-only'});
 await expect(service.register(1,{id:'12345678-1234-4234-8234-123456789012'})).rejects.toThrow('venció');
 expect(client.query.mock.calls.some(([sql])=>sql.startsWith('INSERT'))).toBe(false);
 expect(client.release).toHaveBeenCalled();
});
test('patrocinio no reembolsa fondos del usuario ni permite delegatecall',()=>{
 const call={to:Wallet.createRandom().address,data:'0x1234',value:'0',operation:1,gasPrice:'999',refundReceiver:Wallet.createRandom().address};
 const tx=policy.transaction(call,4n);
 expect(tx).toMatchObject({operation:0,gasPrice:'0',safeTxGas:'0',refundReceiver:ZeroAddress,nonce:'4'});
 const execution=policy.execution(Wallet.createRandom().address,tx,'0x'+'11'.repeat(65));
 const decoded=new Interface(policy.abi).parseTransaction(execution);
 expect(decoded.args[3]).toBe(0n);expect(decoded.args[6]).toBe(0n);
 expect(()=>policy.execution(call.to,tx,'0x12')).toThrow('inválida');
});
test.each([{id:'case-1',ready:false},{id:'other-case',ready:true}])('no finaliza antes de tiempo ni otra solicitud: %j',async state=>{
 const service=new PersonalRecovery({pool:{},rpc:{},config:{},store:{prepare:jest.fn()}});
 service.status=async()=>({recovery:state});
 await expect(service.finalize(1,'case-1')).rejects.toThrow('no está lista');
 expect(service.store.prepare).not.toHaveBeenCalled();
});
