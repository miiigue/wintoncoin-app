"use strict";
const service=require('../src/services/walletService');
test.each(['generateEncryptedWallet','setupTransactionPin','decryptPrivateKeyWithPin','verifyTransactionPin'])('%s no custodia ni descifra claves de usuarios',name=>{
 const client={query:jest.fn()};
 expect(()=>service[name](client,1,'synthetic-do-not-use')).toThrow('No envíes frases');
 expect(client.query).not.toHaveBeenCalled();
});
test('no expone primitivas heredadas de cifrado o descifrado',()=>{
 for(const name of ['encrypt','decrypt','unlock'])expect(service[name]).toBeUndefined();
});
