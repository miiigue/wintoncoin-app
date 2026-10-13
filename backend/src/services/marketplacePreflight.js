 'use strict';
async function assertTreasuryReady(core,amount,feeBps){
 if(BigInt(amount)*BigInt(feeBps)/10000n===0n)return;
 const treasury=await core.treasury();
 if(!await core.isKYCVerified(treasury))throw Object.assign(new Error('La tesorería de la plataforma no está habilitada para recibir la comisión. Un administrador debe corregir la configuración. Este pago no se ha enviado.'),{status:503,code:'TREASURY_KYC_REQUIRED'});
}
module.exports={assertTreasuryReady};
