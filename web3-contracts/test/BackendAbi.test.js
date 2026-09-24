const {expect}=require('chai');const {ethers,artifacts}=require('hardhat');const fs=require('fs');const path=require('path');
describe('ABI del backend frente a contratos compilados',()=>{
 for(const [name,contract]of [['protocol','CoreProtocol'],['vault','CollateralVault'],['exchange','FifoExchange'],['treasury','ProtocolTreasury']]){
  it(contract,async()=>{
   const source=fs.readFileSync(path.resolve(__dirname,'../../backend/src/services/web3BridgeService.js'),'utf8');
   const region=source.split('this.'+name+'Abi = [')[1].split('];')[0];
   const lines=[...region.matchAll(/"([^"]+)"/g)].map(m=>m[1]);
   const actual=new ethers.Interface((await artifacts.readArtifact(contract)).abi);
   for(const fragment of new ethers.Interface(lines).fragments){
    const match=fragment.type==='function'?actual.getFunction(fragment.format('sighash')):actual.getEvent(fragment.format('sighash'));
    expect(match,fragment.format()).not.eq(null);expect(match.format('full')).eq(fragment.format('full'));
   }
  });
 }
});
