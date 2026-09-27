import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const associated='0x1111111111111111111111111111111111111111';
const unrelated='0x2222222222222222222222222222222222222222';
const source=readFileSync(new URL('../src/modules/web3OnChainService.js',import.meta.url),'utf8')
 .replace(/^import .*;\r?\n/gm,'').replaceAll('export const ','const ').replace('export default web3OnChainService;','globalThis.subject=web3OnChainService;');
function create({selected=associated,ok=true}={}){
 const context={window:{ethereum:{}},localStorage:{getItem:()=>null},getApiUrl:()=>'/test-api', requestOperation:async(action,details)=>({action,details}),
 ethers:{isAddress:value=>/^0x[a-fA-F0-9]{40}$/.test(value)},
 BrowserProvider:class {async send(){return [selected];}async getSigner(){return {getAddress:async()=>selected};}async getNetwork(){return {chainId:11155420};}},
 fetch:async()=>({ok,json:async()=>({web3_wallet_address:associated})})};
 vm.runInNewContext(source,context);return context.subject;
}
test('reading the wallet uses the authenticated account, not a cached external wallet',async()=>{const service=create({selected:unrelated});service.connectedAddress=unrelated;assert.equal(await service.getConnectedAddress(),associated);});
test('an unrelated browser wallet cannot replace the associated identity',async()=>{const service=create({selected:unrelated});assert.equal(await service.connectWallet(),associated);});
test('Exchange calls require the integrated PIN authorization flow',async()=>{const result=await create().createBuyOrder('5');assert.equal(result.action,'buy');assert.equal(result.details.amount,'5');});
test('expired session clears signing identity',async()=>{const service=create({ok:false});service.connectedAddress=associated;await assert.rejects(()=>service.getConnectedAddress(),/sesión/);assert.equal(service.connectedAddress,null);});

