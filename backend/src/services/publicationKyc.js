'use strict';
const {isAddress,ZeroAddress}=require('ethers');
async function requirePublicationKyc(author,verify){
 const wallet=author?.web3_wallet_address;
 if(!wallet||!isAddress(wallet)||wallet.toLowerCase()===ZeroAddress)throw Object.assign(new Error('Para crear cualquier publicación debes activar tu billetera y tener la verificación de identidad (KYC) aprobada.'),{status:403,code:'PUBLICATION_KYC_REQUIRED',requires_kyc:true});
 let approved;
 try{approved=await (verify||require('./web3BridgeService').checkUserKYCStrict.bind(require('./web3BridgeService')))(wallet);}
 catch{throw Object.assign(new Error('No pudimos comprobar tu verificación de identidad. No se creó la publicación. Intenta nuevamente en unos momentos.'),{status:503,code:'KYC_CHECK_UNAVAILABLE'});}
 if(approved!==true)throw Object.assign(new Error('Para crear cualquier publicación debes tener tu verificación de identidad (KYC) aprobada. Completa la verificación en tu billetera.'),{status:403,code:'PUBLICATION_KYC_REQUIRED',requires_kyc:true});
}
module.exports={requirePublicationKyc};
