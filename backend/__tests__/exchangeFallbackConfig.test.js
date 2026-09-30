'use strict';
jest.mock('../src/services/exchangeChainReader',()=>({
 createReader:jest.fn((url)=>({url,provider:{destroy:jest.fn()}})),
 fail:code=>{throw Object.assign(new Error(code),{indexerCode:code});}
}));
const {createReader}=require('../src/services/exchangeChainReader');
const {createExchangeWorker,FailoverExchangeIndexer}=require('../src/services/exchangeFailover');
const config={chainId:'11155420',exchange:'0x1111111111111111111111111111111111111111'};
const env={OPTIMISM_RPC_URL:'https://primary.example'};
beforeEach(()=>jest.clearAllMocks());
test('Demo incorpora alternativa pública y conserva el proveedor principal',()=>{
 const w=createExchangeWorker({},config,env);
 expect(w.workers.map(x=>x.chain.url)).toEqual([env.OPTIMISM_RPC_URL,'https://optimism-sepolia-rpc.publicnode.com']);w.destroy();
});
test('No agrega proveedores a mainnet ni a una red local',()=>{
 for(const chainId of ['10','1337']){const w=createExchangeWorker({},{...config,chainId},env);expect(w.workers).toHaveLength(1);w.destroy();}
});
test('Una lista vacía explícita desactiva la alternativa',()=>{
 const w=createExchangeWorker({},config,{...env,EXCHANGE_INDEXER_FALLBACK_RPC_URLS:'[]'});expect(w.workers).toHaveLength(1);w.destroy();
});
test('Alternativas configuradas sustituyen el valor Demo y eliminan duplicados',()=>{
 const w=createExchangeWorker({},config,{...env,EXCHANGE_INDEXER_FALLBACK_RPC_URLS:JSON.stringify([env.OPTIMISM_RPC_URL,'https://alternative.example'])});
 expect(w.workers.map(x=>x.chain.url)).toEqual([env.OPTIMISM_RPC_URL,'https://alternative.example']);w.destroy();
});
test('Configuración inválida falla sin conectarse a un proveedor por defecto',()=>{
 for(const value of ['', '{}','["file:///secret"]','[1]','["https://a","https://b","https://c","https://d"]'])
  expect(()=>createExchangeWorker({},config,{...env,EXCHANGE_INDEXER_FALLBACK_RPC_URLS:value})).toThrow('INVALID_RPC_CONFIG');
 expect(createReader).not.toHaveBeenCalled();
});
test('Si el proveedor principal aún no ve el despliegue nuevo, consulta la alternativa',async()=>{
 const worker=new FailoverExchangeIndexer({},config,[{},{}]);
 worker.workers=[{tick:jest.fn().mockResolvedValue({status:'waiting_deployment'})},{tick:jest.fn().mockResolvedValue({status:'ready',block:123})}];
 expect(await worker.tick()).toEqual({status:'ready',block:123});
 expect(worker.preferred).toBe(1);
});
