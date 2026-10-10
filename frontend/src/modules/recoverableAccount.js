import {signPasskeyHash} from './passkeyAuthorization.js';

import {HDNodeWallet,Contract,JsonRpcProvider,TypedDataEncoder} from 'ethers';
import {getApiUrl} from './config.js';

export async function accountRequest(path,body) {
  const token=localStorage.getItem('token');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),60000);
  try {
  const response=await fetch(`${getApiUrl()}/api/me/account${path}`,{signal:controller.signal,method:body?'POST':'GET',credentials:'include',cache:'no-store',
    headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  if(!response.ok)throw Object.assign(new Error(response.status===401?'Tu sesión venció. Inicia sesión nuevamente.':data.message||'No se pudo comprobar la cuenta.'),{status:response.status});
  return data;
  }catch(e){if(e.name==='AbortError')throw new Error('La solicitud tardó demasiado. Comprueba el estado antes de repetirla; puede haberse registrado.');throw e;}finally{clearTimeout(timer);}
}
export function createBackup() {
  const wallet=HDNodeWallet.createRandom();
  return {phrase:wallet.mnemonic.phrase,address:wallet.address};
}
export function restoreBackup(phrase,address) {
  const normalized=typeof phrase==='string'?phrase.normalize('NFKD').trim().toLowerCase().replace(/\s+/g,' '):'';
  const count=normalized?normalized.split(' ').length:0;
  if(count!==12)throw new Error(`Escribe las 12 palabras completas, en el orden en que las guardaste. Has introducido ${count} de 12.`);
  let wallet;
  try{wallet=HDNodeWallet.fromPhrase(normalized);}catch{
    // Never show library errors: they can contain sensitive arguments.
    throw new Error('No pudimos reconocer este respaldo. Revisa las 12 palabras y su orden; escribe solo las palabras, sin números.');
  }
  if(typeof address!=='string'||wallet.address.toLowerCase()!==address.toLowerCase())throw new Error('Estas palabras pertenecen a otro respaldo. Utiliza las que guardaste para esta configuración pendiente.');
  return {phrase:normalized,address:wallet.address};
}
export function backupPositions() {
  const indices=new Set();
  while(indices.size<3){const n=crypto.getRandomValues(new Uint32Array(1))[0];if(n<4294967292)indices.add(n%12);}
  return [...indices].sort((a,b)=>a-b);
}
export function verifyBackupWords(phrase,positions,answers) {
  const words=phrase.trim().split(/\s+/);
  return words.length===12&&positions.length===3&&new Set(positions).size===3&&positions.every((n,i)=>answers[i]?.trim().toLowerCase()===words[n]);
}
export async function proveBackup(phrase,message) {
  // Exists only for this call. Never persisted or sent to the API.
  const wallet=HDNodeWallet.fromPhrase(phrase);
  return {recoveryAddress:wallet.address,recoverySignature:await wallet.signMessage(message)};
}
export async function authorizeRecovery(phrase,prepared,context){
  const wallet=HDNodeWallet.fromPhrase(phrase.trim().toLowerCase().replace(/\s+/g,' '));
  if(wallet.address.toLowerCase()!==prepared.recoveryAddress.toLowerCase()||prepared.address.toLowerCase()!==context.account.address.toLowerCase()||String(prepared.chainId)!==String(context.configuration.chainId)||prepared.module.toLowerCase()!==context.configuration.contracts.recoveryModule.address.toLowerCase())throw new Error('El respaldo o la cuenta no corresponden.');
  const provider=new JsonRpcProvider(context.configuration.publicRpcUrl);
  try{
    if(String((await provider.getNetwork()).chainId)!==String(prepared.chainId))throw new Error('Red incorrecta.');
    const module=new Contract(prepared.module,['function getRecoveryHash(address,address[],uint256,uint256) view returns(bytes32)'],provider);
    const digest=await module.getRecoveryHash(prepared.address,[prepared.newOwner],1,prepared.nonce);
    if(digest!==prepared.digest)throw new Error('La solicitud no coincide con el contrato.');
    return wallet.signingKey.sign(digest).serialized;
  }finally{provider.destroy();}
}
async function sdkFor(account,configuration) {
  if(!window.isSecureContext||!navigator.credentials)throw new Error('Utiliza un navegador compatible y una conexión segura.');
  const getFn=options=>navigator.credentials.get({...options,publicKey:{...options.publicKey,rpId:account.passkey.rpId,userVerification:'required'}});
  const {default:Safe}=await import('@safe-global/protocol-kit');
  const contracts=configuration.contracts;
  const network={safeSingletonAddress:contracts.singleton.address,safeProxyFactoryAddress:contracts.factory.address,fallbackHandlerAddress:contracts.fallbackHandler.address,safeWebAuthnSignerFactoryAddress:contracts.passkeyFactory.address};
  for(const [key,name] of [['multiSend','multiSendAddress'],['multiSendCallOnly','multiSendCallOnlyAddress'],['passkeySharedSigner','safeWebAuthnSharedSignerAddress']])if(contracts[key])network[name]=contracts[key].address;
  return Safe.init({provider:configuration.publicRpcUrl,safeAddress:account.address,contractNetworks:{[configuration.chainId]:network},signer:{...account.passkey,getFn}});
}
export async function signAccountTransaction(authorization,context) {
  const data=context||await accountRequest('/status');
  if(!data.account||data.account.address.toLowerCase()!==authorization.account.toLowerCase()||String(data.configuration.chainId)!==String(authorization.chainId)||data.configuration.hash!==authorization.manifestHash)
    throw new Error('La cuenta o la red cambió. Vuelve a revisar la operación.');
  const sdk=await sdkFor(data.account,data.configuration);
  const t=authorization.transaction;
  const transaction=await sdk.createTransaction({transactions:[{to:t.to,value:t.value,data:t.data,operation:0}],options:{...t,nonce:Number(t.nonce)}});
  if(await sdk.getTransactionHash(transaction)!==authorization.hash)throw new Error('La operación recibida no coincide con la que se va a firmar.');
  transaction.addSignature(await signPasskeyHash(sdk,authorization.hash));
  return {hash:authorization.hash,signature:transaction.encodedSignatures()};
}
export async function signMarketplace(typedData) {
  const context=await accountRequest('/status');
  if(context.account?.state!=='active'||context.account.address.toLowerCase()!==typedData.message.payer.toLowerCase()||String(context.configuration.chainId)!==String(typedData.domain.chainId))throw new Error('Cuenta o red incorrecta.');
  const sdk=await sdkFor(context.account,context.configuration);
  const message=sdk.createMessage(typedData);
  // Passkey clients cannot use eth_signTypedData. Sign the Safe wrapper hash
  // explicitly, which the CompatibilityFallbackHandler checks via EIP-1271.
  const digest=TypedDataEncoder.hash(typedData.domain,typedData.types,typedData.message);
  message.addSignature(await signPasskeyHash(sdk,await sdk.getSafeMessageHash(digest)));
  return message.encodedSignatures();
}
