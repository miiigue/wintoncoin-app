const mockL1Fee=jest.fn().mockResolvedValue(100n),mockOperatorFee=jest.fn().mockResolvedValue(20n);
jest.mock('ethers',()=>({...jest.requireActual('ethers'),Contract:jest.fn().mockImplementation(()=>({getL1Fee:mockL1Fee,getOperatorFee:mockOperatorFee}))}));
const {Wallet,Transaction}=require('ethers');
const {signStep}=require('../src/services/chainSigning');
const signer=Wallet.createRandom();
const provider=()=>({getNetwork:async()=>({chainId:10n}),getFeeData:async()=>({gasPrice:1n}),getTransactionCount:async()=>0,estimateGas:async()=>21000n,getBalance:async()=>1000000000n});
beforeEach(()=>jest.clearAllMocks());
test('Optimism calcula tarifa L1 con transacción sin firma y suma tarifa de operador',async()=>{
 const step=await signStep(provider(),signer,{to:Wallet.createRandom().address,value:0n,data:'0x'},'10','30000');
 expect(mockL1Fee).toHaveBeenCalledWith(Transaction.from(step.raw).unsignedSerialized);
 expect(mockOperatorFee).toHaveBeenCalledWith(26250n);
});
test('No ignora la tarifa adicional cuando supera el presupuesto',async()=>{
 await expect(signStep(provider(),signer,{to:Wallet.createRandom().address,value:0n,data:'0x'},'10','26300')).rejects.toThrow('máximo');
});
test('Una transacción pendiente bloquea otra firma con nonce ambiguo',async()=>{
 const rpc=provider();rpc.getTransactionCount=async(_,tag)=>tag==='pending'?1:0;
 await expect(signStep(rpc,signer,{to:Wallet.createRandom().address},'10','30000')).rejects.toThrow('pendiente');
});
