const policy=require('../src/services/safeAccountPolicy');
const fs=require('fs'),os=require('os'),path=require('path');
test('Demo explícita carga su despliegue versionado sin archivo externo',()=>{
 const c=policy.configuration({WINTON_CHAIN_ID:'11155420'});
 expect(c.chainId).toBe('11155420');expect(Object.keys(c.contracts)).toHaveLength(9);
 expect(c.recoveryDelaySeconds).toBe(86400);
});
test.each([{NODE_ENV:'test'}, {WINTON_CHAIN_ID:'10'}, {WINTON_CHAIN_ID:'1337'}])('red distinta a Demo exige su manifiesto: %j',env=>{
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

test('sin variable de red sigue la suite Demo versionada',()=>{
 const env={NODE_ENV:'production'};
 expect(policy.configuration(env).chainId).toBe(require('../src/services/chainDeployment').configuration(env).chainId);
});
test('manifiesto explícito de otra red se rechaza también sin variable de red',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'winton-manifest-'));
 try{const file=path.join(dir,'manifest.json');fs.writeFileSync(file,JSON.stringify({chainId:'10'}));
 expect(()=>policy.configuration({NODE_ENV:'production',SMART_ACCOUNT_MANIFEST:file})).toThrow('no coincide');}
 finally{fs.rmSync(dir,{recursive:true});}
});
test('error de despliegue económico no se ignora para cargar Demo',()=>{
 expect(()=>policy.configuration({WINTON_CHAIN_ID:'11155420',CORE_PROTOCOL_ADDRESS:'invalid'})).toThrow();
});
