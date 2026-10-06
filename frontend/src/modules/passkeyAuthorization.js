// P-256 returns an ABI-encoded contract signature, not an ECDSA r/s/v value.
// Preserve every byte; ECDSA "v" normalization must never touch this encoding.
export async function signPasskeyHash(sdk,hash){
 if(!/^0x[0-9a-f]{64}$/i.test(hash))throw new Error('Resumen de autorización inválido.');
 const provider=sdk.getSafeProvider();
 if(!await provider.isPasskeySigner())throw new Error('Se requiere el acceso registrado del dispositivo.');
 const client=await provider.getExternalSigner();
 const signature=await client.signMessage({message:{raw:hash}});
 const {EthSafeSignature}=await import('@safe-global/protocol-kit');
 return new EthSafeSignature(client.account.address,signature,true);
}
