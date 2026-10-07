import {BrowserProvider,Contract,Interface,JsonRpcProvider,ZeroAddress,keccak256} from 'ethers';
import {signAccountTransaction} from './recoverableAccount.js';
const safeAbi=[
 'function nonce() view returns(uint256)',
 'function getTransactionHash(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,uint256) view returns(bytes32)',
 'function execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes) payable returns(bool)'
];
const recoveryAbi=['function cancelRecovery()','function getRecoveryRequest(address) view returns(tuple(uint256,uint256,uint64 executeAfter,address[]))'];
export function cancellationCall(account,module,signature){
 const data=new Interface(recoveryAbi).encodeFunctionData('cancelRecovery',[]);
 return {to:account,value:'0x0',data:new Interface(safeAbi).encodeFunctionData('execTransaction',[module,0,data,0,0,0,0,ZeroAddress,ZeroAddress,signature])};
}
// Uses the loaded account context and public RPC, not Winton's quote, quota or
// relayer endpoints. The other wallet only submits and pays ETH gas.
export async function cancelWithExternalWallet(context,injected=window.ethereum){
 if(!injected?.request)throw new Error('Abre esta página en un navegador con una billetera Web3 compatible. Necesitarás ETH en la red indicada para pagar el gas.');
 const {account,configuration:c}=context;
 if(!account||account.state!=='active')throw new Error('Primero carga la información de tu cuenta.');
 const rpc=new JsonRpcProvider(c.publicRpcUrl);
 const wallet=new BrowserProvider(injected);
 try{
  await injected.request({method:'eth_requestAccounts'});
  if(String((await rpc.getNetwork()).chainId)!==String(c.chainId)||String((await wallet.getNetwork()).chainId)!==String(c.chainId))throw new Error('Selecciona en la otra billetera la misma red de tu cuenta WintonCoin.');
  const module=c.contracts.recoveryModule;
  if(keccak256(await rpc.getCode(account.address))!==c.proxyCodeHash||keccak256(await rpc.getCode(module.address))!==module.codeHash)throw new Error('No se pudo verificar la cuenta o el contrato de recuperación.');
  const recovery=new Contract(module.address,recoveryAbi,rpc);
  if((await recovery.getRecoveryRequest(account.address)).executeAfter===0n)throw new Error('No hay una recuperación pendiente para cancelar.');
  const safe=new Contract(account.address,safeAbi,rpc);
  const tx={to:module.address,value:'0',data:recovery.interface.encodeFunctionData('cancelRecovery',[]),operation:0,safeTxGas:'0',baseGas:'0',gasPrice:'0',gasToken:ZeroAddress,refundReceiver:ZeroAddress,nonce:String(await safe.nonce())};
  const hash=await safe.getTransactionHash(tx.to,0,tx.data,0,0,0,0,ZeroAddress,ZeroAddress,tx.nonce);
  const signature=await signAccountTransaction({account:account.address,transaction:tx,hash,chainId:String(c.chainId),manifestHash:c.hash},context);
  const sender=await wallet.getSigner();
  const call=cancellationCall(account.address,module.address,signature.signature);
  await rpc.call({...call,from:await sender.getAddress()});
  const sent=await sender.sendTransaction({...call,chainId:BigInt(c.chainId)});
  // Sending is not confirmation; the UI must retain and show the hash.
  return {hash:sent.hash};
 }finally{rpc.destroy();wallet.destroy();}
}
