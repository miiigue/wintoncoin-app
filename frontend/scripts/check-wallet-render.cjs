const path=require('node:path');
const assert=require('node:assert/strict');
const Module=require('node:module');
const esbuild=require('esbuild');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {MemoryRouter}=require('react-router-dom');
const root=process.env.WALLET_TEST_ROOT||path.resolve(__dirname,'..');
// Real Wallet rendering, no API calls, credentials or transactions.
async function main(){
 const build=await esbuild.build({entryPoints:[path.join(root,'src/pages/Wallet.jsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'transform',plugins:[{name:'wallet-fixtures',setup(b){
  b.onResolve({filter:/^react$/},a=>a.importer.endsWith('Wallet.jsx')?{path:'react-fixture',namespace:'fixture'}:{path:'react',external:true});
  b.onResolve({filter:/react-router-dom/},()=>({path:'react-router-dom',external:true}));
  b.onResolve({filter:/web3OnChainService|AccountSecurity|financialUnits|modules\/config|\.css$/},a=>({path:a.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},a=>{
   if(a.path==='react-fixture')return {contents:`import React from 'react'; export default React; let index=0; export function useState(init){const n=index++; return React.useState(n===1?globalThis.__walletScenario.balance:n===3?globalThis.__walletScenario.address:init);} export const useEffect=React.useEffect;`};
   if(a.path.includes('web3OnChainService'))return {contents:'export const web3OnChainService={}; export const CONTRACT_ADDRESSES={chainId:"11155420"};'};
   if(a.path.includes('financialUnits'))return {contents:'export const displayAmount=v=>Number(v).toFixed(4);'};
   if(a.path.includes('config'))return {contents:'export const getApiUrl=()=>"";'};
   if(a.path.includes('AccountSecurity'))return {contents:'export default function AccountSecurity(){return null;}'};
   return {contents:'export default {};'};
  });
 }}]});
 const compiled=new Module(path.join(root,'wallet-render-fixture.cjs'),module);
 compiled.filename=path.join(root,'wallet-render-fixture.cjs');compiled.paths=Module._nodeModulePaths(root);
 global.localStorage={getItem:key=>key==='username'?'prueba':null};
 for(const scenario of [
  {name:'KYC aprobado y USDT',address:'0x'+'1'.repeat(40),balance:{isKYCVerified:true,usdtWalletBalance:25,debtLots:[]}},
  {name:'KYC aprobado sin USDT',address:'0x'+'1'.repeat(40),balance:{isKYCVerified:true,usdtWalletBalance:0,debtLots:[]}},
  {name:'KYC pendiente',address:'0x'+'1'.repeat(40),balance:{isKYCVerified:false,usdtWalletBalance:25,debtLots:[]}},
  {name:'sin datos confirmados',address:null,balance:null}
 ]){
  global.__walletScenario=scenario;compiled._compile(build.outputFiles[0].text,compiled.filename);
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(compiled.exports.default)));
  assert(html.includes('USDT en tu billetera'));
  const button=html.match(/<button[^>]*>Enviar USDT<\/button>/)?.[0];assert(button);
  assert.equal(button.includes('disabled'),!(scenario.balance?.isKYCVerified&&scenario.balance.usdtWalletBalance>0));
  console.log('PASS:',scenario.name);
 }
 delete global.__walletScenario;delete global.localStorage;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
