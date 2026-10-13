const {ChainRpcProvider,endpoints}=require('../src/services/chainRpcProvider');
const {makeError}=require('ethers');
const providers=[];
function fixture(){const p=new ChainRpcProvider(['http://primary','http://backup'],11155420);providers.push(p);return p;}
afterEach(()=>{for(const p of providers.splice(0))p.destroy();});
const chain={jsonrpc:'2.0',id:999999,result:'0xaa37dc'};
const query={jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]};
test('Demo backup only; production requires configuration and explicit [] opts out',()=>{
 expect(endpoints({},11155420)).toEqual(['https://optimism-sepolia-rpc.publicnode.com']);
 expect(()=>endpoints({},10)).toThrow();
 expect(endpoints({OPTIMISM_RPC_URL:'https://configured',WINTON_FALLBACK_RPC_URLS:'[]'},11155420)).toEqual(['https://configured']);
 expect(()=>endpoints({WINTON_FALLBACK_RPC_URLS:'invalid'},11155420)).toThrow();
});
test('transport failure switches to verified backup and avoids failed primary on next read',async()=>{
 const p=fixture();p.transport=jest.fn(async(url,payload)=>{if(url.includes('primary'))throw makeError('timeout','TIMEOUT',{});return payload.method==='eth_chainId'?chain:{id:payload.id,jsonrpc:'2.0',result:'0x123'};});
 expect((await p._send(query))[0].result).toBe('0x123');
 p.transport.mockClear();await p._send(query);expect(p.transport.mock.calls.every(([url])=>url==='http://backup')).toBe(true);
});
test('wrong network cannot serve a request',async()=>{
 const p=fixture();p.transport=jest.fn(async()=>({...chain,result:'0x1'}));
 await expect(p._send(query)).rejects.toMatchObject({code:'NETWORK_MISMATCH'});expect(p.transport).toHaveBeenCalledTimes(1);
});
test('contract reverts are returned without retry',async()=>{
 const p=fixture();const revert={jsonrpc:'2.0',id:1,error:{code:3,message:'execution reverted',data:'0x1234'}};
 p.transport=jest.fn(async(_,payload)=>payload.method==='eth_chainId'?chain:revert);
 expect(await p._send({...query,method:'eth_call'})).toEqual([revert]);expect(p.transport.mock.calls.every(([url])=>url==='http://primary')).toBe(true);
});
test('uncertain broadcast retries identical signed bytes, never signs or changes nonce',async()=>{
 const p=fixture(),submitted=[];const raw={...query,method:'eth_sendRawTransaction',params:['0xdeadbeef']};
 p.transport=jest.fn(async(url,payload)=>{if(payload.method==='eth_chainId')return chain;submitted.push(JSON.stringify(payload));if(url.includes('primary'))throw makeError('lost response','TIMEOUT',{});return {id:1,jsonrpc:'2.0',result:'0xhash'};});
 await p._send(raw);expect(submitted).toEqual([JSON.stringify(raw),JSON.stringify(raw)]);
});
test('all transports fail with safe diagnostic without endpoint credentials',async()=>{
 const p=fixture();p.transport=async()=>{throw makeError('secret-url','TIMEOUT',{});};
 await expect(p._send(query)).rejects.toThrow('No se pudo conectar');
});
test('unknown RPC mutation is not failed over',async()=>{
 const p=fixture();p.transport=jest.fn(async()=>{throw makeError('timeout','TIMEOUT',{});});
 await expect(p._send({...query,method:'eth_sendTransaction'})).rejects.toThrow();expect(p.transport).toHaveBeenCalledTimes(1);
});

test('connection refused also fails over',async()=>{const p=fixture();p.transport=async(url,payload)=>{if(url.includes('primary'))throw Object.assign(new Error('refused'),{code:'ECONNREFUSED'});return payload.method==='eth_chainId'?chain:{id:1,jsonrpc:'2.0',result:'0x123'};};expect((await p._send(query))[0].result).toBe('0x123');});
