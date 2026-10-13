'use strict';
const {JsonRpcProvider,FetchRequest,makeError}=require('ethers');
const RETRY_CODES=new Set(['TIMEOUT','NETWORK_ERROR','SERVER_ERROR','ECONNRESET','ECONNREFUSED','ETIMEDOUT','ENOTFOUND','EAI_AGAIN','ENETUNREACH','EHOSTUNREACH']);
function endpoints(env,chainId){
 let extra;
 try{extra=env.WINTON_FALLBACK_RPC_URLS===undefined
  ?(String(chainId)==='11155420'?['https://optimism-sepolia-rpc.publicnode.com']:[])
  :JSON.parse(env.WINTON_FALLBACK_RPC_URLS);}catch{throw new Error('WINTON_FALLBACK_RPC_URLS debe ser una lista JSON.');}
 if(!Array.isArray(extra)||extra.length>3)throw new Error('Lista de conexiones blockchain inválida.');
 const primary=env.OPTIMISM_RPC_URL||(['31337','1337'].includes(String(chainId))?'http://127.0.0.1:8545':null);
 const urls=[...new Set([primary,...extra].filter(Boolean))];
 if(!urls.length||urls.some(u=>typeof u!=='string'||!/^https?:\/\//.test(u)))throw new Error('Conexión blockchain no configurada.');
 return urls;
}
// Only transports signed bytes. Never signs, changes nonce, or creates a new payment.
class ChainRpcProvider extends JsonRpcProvider{
 constructor(urls,chainId,timeout=5000){
  super(urls[0],Number(chainId),{batchMaxCount:1,cacheTimeout:-1});
  this.urls=urls;this.expectedChain=BigInt(chainId);this.requestTimeout=timeout;
  this.preferred=0;this.checked=new Map();this.retryPrimaryAt=0;
 }
 async transport(url,payload){
  const request=new FetchRequest(url);request.timeout=this.requestTimeout;
  request.setHeader('Content-Type','application/json');request.body=JSON.stringify(payload);
  const response=await request.send();response.assertOk();
  return response.bodyJson;
 }
 async _send(payload){
  // Restrict automatic failover to reads and identical raw signed transactions.
  const entries=Array.isArray(payload)?payload:[payload];
  const permitted=entries.every(p=>/^(eth_(chainId|blockNumber|getBalance|getCode|getStorageAt|getTransactionCount|getBlockByNumber|getBlockByHash|getTransactionByHash|getTransactionReceipt|getLogs|call|estimateGas|gasPrice|maxPriorityFeePerGas|feeHistory|sendRawTransaction)|net_version)$/.test(p.method));
  let last;
  const first=Date.now()>=this.retryPrimaryAt?0:this.preferred;
  for(let offset=0;offset<(permitted?this.urls.length:1);offset++){
   const index=(first+offset)%this.urls.length,url=this.urls[index];
   try{
    if(!this.checked.has(index)||Date.now()-this.checked.get(index)>30000){
     const check=await this.transport(url,{jsonrpc:'2.0',id:999999,method:'eth_chainId',params:[]});
     if(check.error)throw makeError('No se pudo verificar la red.','SERVER_ERROR',{});
     if(BigInt(check.result)!==this.expectedChain)throw makeError('La conexión apunta a otra red blockchain.','NETWORK_MISMATCH',{});
     this.checked.set(index,Date.now());
    }
    const data=await this.transport(url,payload);
    const results=Array.isArray(data)?data:[data];
    // Preserve contract reverts and business errors; they are not transport failures.
    if(results.some(r=>r.error&&r.error.code===-32005))throw makeError('Acceso blockchain saturado.','SERVER_ERROR',{});
    this.preferred=index;this.retryPrimaryAt=index===0?0:Date.now()+30000;
    return results;
   }catch(e){
    last=e;this.checked.delete(index);
    if(!RETRY_CODES.has(e.code))throw e;
   }
  }
  throw makeError('No se pudo conectar con la blockchain. Intenta consultar el estado nuevamente.','SERVER_ERROR',{info:{causeCode:last?.code||'UNAVAILABLE'}});
 }
}
module.exports={ChainRpcProvider,endpoints};
