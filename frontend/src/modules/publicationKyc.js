// A failed lookup is unknown, never proof that identity was rejected.
export async function publicationKycWarning(service) {
  try {
    const account=await service.getAssociatedAccount({allowUnconfigured:true});
    if(!account.web3_wallet_address)return true;
    const state=await service.fetchUserOnChainState(account.web3_wallet_address);
    return state?.isKYCVerified===true?false:state?.isKYCVerified===false?true:null;
  }catch{return null;}
}
