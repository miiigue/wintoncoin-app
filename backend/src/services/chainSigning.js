'use strict';
const {keccak256,Transaction,Contract}=require('ethers');
const {error}=require('./chainOperationStore');
async function signStep(provider,signer,call,chainId,maxFeeWei) {
    const sender=await signer.getAddress();
    const [network,fees,nonce,latest]=await Promise.all([provider.getNetwork(),provider.getFeeData(),provider.getTransactionCount(sender,'pending'),provider.getTransactionCount(sender,'latest')]);
    if(String(network.chainId)!==String(chainId))throw error('Red incorrecta.',503);
    if(nonce!==latest)throw error('Tu billetera tiene otra transacción pendiente.');
    const gasLimit=(await provider.estimateGas({...call,from:sender}))*125n/100n;
    if(gasLimit>8000000n)throw error('La operación requiere demasiado gas. Debe procesarse en partes.');
    const gasPrice=fees.gasPrice;
    if(!gasPrice)throw error('No se pudo estimar el coste de red.',503);
    const {label,...transaction}=call;
    const raw=await signer.signTransaction({...transaction,chainId:BigInt(chainId),nonce,gasLimit,gasPrice,type:0});
    let extra=0n;
    if(['10','11155420'].includes(String(chainId))) {
        const oracle=new Contract('0x420000000000000000000000000000000000000F',['function getL1Fee(bytes) view returns(uint256)','function getOperatorFee(uint256) view returns(uint256)'],provider);
        // Fail closed if the network fee API changed; don't assume L2 gas is the whole fee.
        extra=(await oracle.getL1Fee(Transaction.from(raw).unsignedSerialized))+(await oracle.getOperatorFee(gasLimit));
    }
    const budget=gasLimit*gasPrice+extra*2n;
    if(budget>BigInt(maxFeeWei))throw error('El coste de red supera el máximo autorizado. Vuelve a consultar el importe.');
    if(await provider.getBalance(sender)<budget+BigInt(call.value || 0))throw Object.assign(error('No hay gas suficiente para esta operación.',402),{requiredWei:(budget+BigInt(call.value || 0)).toString()});
    const tx=Transaction.from(raw);
    return {raw,hash:keccak256(raw),label:call.label || 'Operación',nonce:tx.nonce};
}
module.exports={signStep};
