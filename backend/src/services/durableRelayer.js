'use strict';
const {Wallet,keccak256}=require('ethers');
const {randomUUID}=require('crypto');
const deployment=require('./chainDeployment');
const {ChainOperationStore}=require('./chainOperationStore');
const {signStep}=require('./chainSigning');
// All institutional relayer writes share the same signer lock and journal,
// including administrative test actions. They cannot take a payment's nonce.
async function execute(bridge,contract,method,args,{deduplicate=false}={}){
 const pool=require('../config/db'),config=await deployment.validate(bridge.provider);
 const signer=new Wallet(process.env.RELAYER_PRIVATE_KEY),store=new ChainOperationStore(pool,bridge.provider);
 const target=await contract.getAddress(),data=contract.interface.encodeFunctionData(method,args);
 const key=['relayer',config.chainId,target.toLowerCase(),method,deduplicate?keccak256(data):randomUUID()].join(':');
 const row=await store.prepare({key,chainId:config.chainId,sender:signer.address,resource:'relayer:'+target.toLowerCase(),kind:method,payload:{to:target,data,fingerprint:config.fingerprint}});
 return store.authorize(row.id,null,async()=>[await signStep(bridge.provider,signer,{to:target,data,value:'0',label:method},config.chainId,process.env.MARKETPLACE_MAX_STEP_FEE_WEI||'1000000000000000')]);
}
module.exports={execute};
