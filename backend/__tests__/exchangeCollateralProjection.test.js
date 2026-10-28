'use strict';

const {ExchangeIndexer}=require('../src/services/exchangeIndexer');
const {iface,keccak256}=require('../src/services/exchangeChainReader');

const exchange='0x'+'1'.repeat(40),wallet='0x'+'2'.repeat(40),hash='0x'+'a'.repeat(64);
const code='0x60006000';
function fixture(collateralized=4000000n){
    const encoded=iface.encodeEventLog(iface.getEvent('ExchangeOrderCollateralized'),[wallet,1,collateralized,true]);
    const log={...encoded,address:exchange,blockNumber:2,blockHash:hash,transactionHash:'0x'+'b'.repeat(64),index:0,removed:false};
    return {
        block:jest.fn(async()=>({number:2,hash,timestamp:1})),
        logs:jest.fn(async()=>[log]),
        order:jest.fn(async()=>({id:1n,sequenceId:1n,remainingAmount:10000000n,user:wallet,status:2n,side:1n,createdAt:1n,originalAmount:10000000n,refundedAmount:0n})),
        isAmortization:jest.fn(async()=>true),
        exchangeCollateralized:jest.fn(async()=>collateralized),
        refunds:jest.fn(async()=>({blue:0n,usdt:0n})),
        code:jest.fn(async()=>code)
    };
}

test('captura y expone el bloqueo parcial fijado al mismo bloque del pedido',async()=>{
    const chain=fixture();
    const indexer=new ExchangeIndexer({},chain,{chainId:'1337',exchange,supportsExchangeCollateral:true,maxLogs:10});
    const page=await indexer.page({cursor_block:'1',cursor_hash:null,runtime_hash:keccak256(code)},{number:2,hash});
    expect(page.snapshots).toHaveLength(1);
    expect(page.snapshots[0]).toMatchObject({id:'1',collateralized:4000000n,isAmortization:true});
    expect(chain.exchangeCollateralized).toHaveBeenCalledWith('1',hash);
});

test('falla cerrado si el bloqueo informado supera el remanente de la orden',async()=>{
    const chain=fixture(10000001n);
    const indexer=new ExchangeIndexer({},chain,{chainId:'1337',exchange,supportsExchangeCollateral:true,maxLogs:10});
    await expect(indexer.page({cursor_block:'1',cursor_hash:null,runtime_hash:keccak256(code)},{number:2,hash}))
        .rejects.toMatchObject({indexerCode:'INVALID_EXCHANGE_COLLATERAL'});
});
