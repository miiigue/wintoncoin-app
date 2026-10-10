const path=require('node:path');
const assert=require('node:assert/strict');
const Module=require('node:module');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const built=await require('esbuild').build({entryPoints:[path.join(root,'src/modules/recoverableAccount.js')],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'isolate-browser-adapters',setup(b){
 b.onLoad({filter:/passkeyAuthorization\.js$/},()=>({contents:'export const signPasskeyHash=()=>{};'}));
 b.onLoad({filter:/modules[\\/]config\.js$/},()=>({contents:"export const getApiUrl=()=>'';"}));
 }}]});
 const m=new Module(path.join(__dirname,'backup-validation-fixture.cjs'));m.filename=path.join(__dirname,'backup-validation-fixture.cjs');m.paths=Module._nodeModulePaths(__dirname);m._compile(built.outputFiles[0].text,m.filename);
 const {restoreBackup,verifyBackupWords}=m.exports;
 const {HDNodeWallet}=require('ethers');const w=HDNodeWallet.createRandom(),other=HDNodeWallet.createRandom();
 for(const phrase of ['', 'word word',Array(13).fill('word').join(' ')])assert.throws(()=>restoreBackup(phrase,w.address),/12 palabras completas/);
 assert.throws(()=>restoreBackup(Array(12).fill('invalidword').join(' '),w.address),e=>!e.message.includes('invalidword')&&!e.message.includes('mnemonic')&&e.message.includes('No pudimos reconocer'));
 assert.throws(()=>restoreBackup(other.mnemonic.phrase,w.address),/otro respaldo/);
 assert.equal(restoreBackup('  '+w.mnemonic.phrase.toUpperCase().replaceAll(' ','\n')+' ',w.address).address,w.address);
 const words=w.mnemonic.phrase.split(' ');
 assert(verifyBackupWords(w.mnemonic.phrase,[0,1,8],[words[0],words[1],words[8]]));
 assert(!verifyBackupWords(w.mnemonic.phrase,[0,1,8],[words[0],words[1],'incorrect']));
 console.log('PASS: 8 backup validation checks with real mnemonic validation; no secrets printed.');
})().catch(()=>{console.error('Backup validation checks failed. No sensitive values logged.');process.exitCode=1;});
