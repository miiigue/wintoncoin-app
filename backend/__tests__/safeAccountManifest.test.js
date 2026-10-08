const policy=require('../src/services/safeAccountPolicy');
const fs=require('fs'),os=require('os'),path=require('path');
test('Demo explícita carga su despliegue versionado sin archivo externo',()=>{
 const c=policy.configuration({WINTON_CHAIN_ID:'11155420'});
 expect(c.chainId).toBe('11155420');expect(Object.keys(c.contracts)).toHaveLength(9);
 expect(c.recoveryDelaySeconds).toBe(86400);
});
test.each([{}, {WINTON_CHAIN_ID:'10'}, {WINTON_CHAIN_ID:'1337'}])('sin selección explícita de Demo no adopta contratos de prueba: %j',env=>{
 expect(()=>policy.configuration(env)).toThrow('pendiente');
});
test('ruta explícita inválida no recurre a configuración Demo',()=>{
 expect(()=>policy.configuration({WINTON_CHAIN_ID:'11155420',SMART_ACCOUNT_MANIFEST:path.join(os.tmpdir(),'no-such-winton-manifest.json')})).toThrow();
});
test('rechaza manifiesto de otra red aun con ruta explícita',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'winton-manifest-'));
 try {
 const file=path.join(dir,'manifest.json');fs.writeFileSync(file,JSON.stringify({chainId:'10'}));
 expect(()=>policy.configuration({WINTON_CHAIN_ID:'11155420',SMART_ACCOUNT_MANIFEST:file})).toThrow('no coincide');
 }finally{fs.rmSync(dir,{recursive:true});}
});
test('verificación en cadena no acepta contrato ausente o código diferente',async()=>{
 const c=policy.configuration({WINTON_CHAIN_ID:'11155420'});
 await expect(policy.validateInfrastructure({getNetwork:async()=>({chainId:11155420n}),getCode:async()=>'0x'},c)).rejects.toThrow('verificar');
 await expect(policy.validateInfrastructure({getNetwork:async()=>({chainId:10n})},c)).rejects.toThrow('Red');
});
