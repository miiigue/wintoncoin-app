const { Interface, Wallet, Transaction, keccak256 }=require('ethers');
const {actionPlan,confirm}=require('../src/services/externalOwnerAdministration');
const deployment=require('../src/services/chainDeployment');
const indexer=require('../src/services/exchangeChainReader');
const {ChainOperationStore}=require('../src/services/chainOperationStore');
const current=require('../../web3-contracts/deployment-manifest-v4.json');
const legacy=require('../../web3-contracts/deployments/optimism-sepolia-legacy-2026-09-25.json');

const contracts=current.contracts;
const method=(plan,name)=>new Interface([`function ${name}(${name==='setCommissionBps'?'uint256':name==='setCommitmentDuration'?'uint256':'address,uint256'})`]).parseTransaction({data:plan.data});

test('Demo usa toda la suite nueva aunque las variables apunten a la antigua',()=>{
  const env={WINTON_CHAIN_ID:current.chainId,CORE_PROTOCOL_ADDRESS:legacy.contracts.CoreProtocol,
    FIFO_EXCHANGE_ADDRESS:legacy.contracts.FifoExchange,EXCHANGE_INDEXER_CHAIN_ID:current.chainId,
    EXCHANGE_INDEXER_ADDRESS:legacy.contracts.FifoExchange,
    EXCHANGE_INDEXER_START_BLOCK:String(legacy.startBlocks.FifoExchange)};
  expect(deployment.configuration(env).contracts).toEqual(current.contracts);
  expect(indexer.configFromEnv(env).exchange).toBe(current.contracts.FifoExchange.toLowerCase());
  expect(indexer.configFromEnv(env).startBlock).toBe(current.startBlocks.FifoExchange);
  expect(()=>deployment.configuration({...env,CORE_PROTOCOL_ADDRESS:'0x0000000000000000000000000000000000000001'})).toThrow();
});

test('solo genera acciones admitidas, en unidades correctas y con comisión cero',()=>{
  const zero=actionPlan('commission',{value:'0'},contracts);
  expect(method(zero,'setCommissionBps').args[0]).toBe(0n);
  const duration=actionPlan('commitment_duration',{value:'30'},contracts);
  expect(method(duration,'setCommitmentDuration').args[0]).toBe(2592000n);
  const credit=actionPlan('credit_limit',{walletAddress:current.deployer,limit:'10.000001'},contracts);
  expect(method(credit,'setCreditLimit').args[1]).toBe(10000001n);
  expect(()=>actionPlan('commission',{value:'10.01'},contracts)).toThrow();
  expect(()=>actionPlan('max_transaction',{amount:'0'},contracts)).toThrow();
  expect(()=>actionPlan('arbitrary',{value:'1'},contracts)).toThrow();
});

test('una firma con datos distintos no puede confirmar un cambio administrativo',async()=>{
  const owner=Wallet.createRandom();
  const wanted=actionPlan('commission',{value:'5'},contracts);
  const other=actionPlan('commission',{value:'10'},contracts);
  const raw=await owner.signTransaction({to:other.target,data:other.data,value:0n,nonce:0,gasLimit:100000,gasPrice:1n,chainId:11155420});
  const hash=keccak256(raw);
  const row={id:'11111111-1111-1111-1111-111111111111',kind:'owner:commission',state:'prepared',
    chain_id:'11155420',sender:owner.address.toLowerCase(),payload:{to:wanted.target,data:wanted.data,fingerprint:'fixed'},steps:[]};
  const client={query:jest.fn(async sql=>({rows:[{acquired:true}],rowCount:1})),release:jest.fn()};
  const pool={connect:jest.fn(async()=>client)};
  const provider={getTransaction:jest.fn(async()=>Transaction.from(raw))};
  jest.spyOn(deployment,'validate').mockResolvedValue({chainId:'11155420',fingerprint:'fixed'});
  jest.spyOn(ChainOperationStore.prototype,'get').mockResolvedValue(row);
  const advance=jest.spyOn(ChainOperationStore.prototype,'advanceLocked');
  await expect(confirm({pool,provider,id:row.id,hash})).rejects.toThrow('Transacción ajena');
  expect(advance).not.toHaveBeenCalled();
  expect(client.query.mock.calls.some(([sql])=>sql.startsWith('UPDATE chain_operations'))).toBe(false);
  jest.restoreAllMocks();
});
