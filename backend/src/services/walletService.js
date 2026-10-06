'use strict';
// Legacy endpoints remain explicit errors: no user key is generated, decrypted
// or signed on the server. Stored legacy material is preserved for audited migration.
const unavailable=()=>{throw Object.assign(new Error('Configura tu cuenta recuperable en Billetera. No envíes frases al servidor.'),{status:410});};
module.exports={
 generateEncryptedWallet:unavailable,setupTransactionPin:unavailable,
 decryptPrivateKeyWithPin:unavailable,verifyTransactionPin:unavailable,
 async getPinStatus(client,userId){
  const chainId=require('./chainDeployment').configuration().chainId;
  const row=(await client.query(`SELECT a.state,a.backup_confirmed_at FROM smart_accounts a JOIN account_identities i ON i.id=a.identity_id WHERE i.user_id=$1 AND a.chain_id=$2`,[userId,chainId])).rows[0];
  return {hasPin:row?.state==='active'&&Boolean(row.backup_confirmed_at),authorizationMethod:'passkey',isLocked:false};
 }
};
