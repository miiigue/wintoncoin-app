'use strict';
// Read the receipt between two checks of the canonical anchor. Contradictions
// are a retryable read failure, never evidence that a payment completed.
async function confirmedReceipt(provider,hash,{finality='safe',confirmations=2}={}) {
 const head=await provider.getBlock(finality||'latest');
 const receipt=await provider.getTransactionReceipt(hash);
 if(!head||!receipt||head.number<receipt.blockNumber+(finality?0:confirmations-1))return null;
 const block=await provider.getBlock(receipt.blockNumber);
 if(!block||block.hash!==receipt.blockHash)return null;
 if(head.number===receipt.blockNumber&&head.hash!==receipt.blockHash)return null;
 const anchor=await provider.getBlock(head.number);
 const again=await provider.getTransactionReceipt(hash);
 const canonical=await provider.getBlock(receipt.blockNumber);
 if(!anchor||anchor.hash!==head.hash||!again||again.blockHash!==receipt.blockHash||again.status!==receipt.status||!canonical||canonical.hash!==receipt.blockHash)return null;
 return receipt;
}
module.exports={confirmedReceipt};
