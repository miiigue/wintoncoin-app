const {createRetryPolicy}=require('../src/services/exchangeRetryPolicy');
const {ExchangeChainReader}=require('../src/services/exchangeChainReader');
test('retries back off without flooding logs and emit a periodic reminder',()=>{
 let time=0;const p=createRetryPolicy(5000,()=>time),e={indexerCode:'RPC_BEHIND_CURSOR'};
 expect(p.failed(e)).toMatchObject({delay:5000,shouldLog:true});
 expect(p.failed(e)).toMatchObject({delay:10000,shouldLog:false});
 expect(p.failed(e).delay).toBe(20000);expect(p.failed(e).delay).toBe(40000);expect(p.failed(e).delay).toBe(60000);
 time=300000;expect(p.failed(e)).toMatchObject({delay:60000,shouldLog:true});
});
test('recovery resets retry budget, but another worker owning the lock is not recovery',()=>{
 const p=createRetryPolicy();p.failed({indexerCode:'RPC_BEHIND_CURSOR'});
 expect(p.succeeded({status:'busy'}).recovered).toBe(false);
 expect(p.succeeded({status:'ready'})).toEqual({recovered:true,delay:5000});
 expect(p.failed({indexerCode:'RPC_BEHIND_CURSOR'})).toMatchObject({delay:5000,shouldLog:true});
});
test('a new error logs promptly and never leaks upstream URL or message',()=>{
 const p=createRetryPolicy();p.failed({indexerCode:'RPC_BEHIND_CURSOR'});
 const result=p.failed({indexerCode:'https://private/token',message:'secret',indexerDetails:{cursorBlock:42,targetBlock:40,lagBlocks:2,url:'secret'}});
 expect(result).toMatchObject({shouldLog:true,report:{code:'SYNC_FAILED',cursorBlock:42,targetBlock:40,lagBlocks:2}});
 expect(JSON.stringify(result)).not.toMatch(/secret|private/);
});
test('numeric block request must return that exact height',async()=>{
 const r=new ExchangeChainReader({send:async()=>({number:'0x2',timestamp:'0x1',hash:'0x'+'1'.repeat(64)})},'0x'+'2'.repeat(40));
 await expect(r.block(3)).rejects.toMatchObject({indexerCode:'BLOCK_NUMBER_MISMATCH'});
 await expect(r.block(2)).resolves.toMatchObject({number:2});
});
