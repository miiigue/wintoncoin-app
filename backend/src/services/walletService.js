'use strict';
// Server-assisted signing, not exclusive user custody.
const { ethers } = require('ethers');
const crypto = require('crypto');
const { promisify } = require('util');
const bcrypt = require('bcrypt');
const pbkdf2 = promisify(crypto.pbkdf2);
const failure = (status, message) => Object.assign(new Error(message), {status});
function secret() {
    if (!process.env.ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET.length < 32)
        throw failure(503, 'La protección de billeteras no está configurada. No se modificó tu billetera.');
    return process.env.ENCRYPTION_SECRET;
}
function passphraseText(phrase) {
    if (typeof phrase !== 'string') throw failure(400, 'La frase de seguridad debe ser una cadena de texto.');
    const normalized = phrase.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
    const words = normalized.split(' ').filter(Boolean);
    if (words.length < 4 || words.length > 6) {
        throw failure(400, 'La frase de seguridad debe contener entre 4 y 6 palabras.');
    }
    for (const w of words) {
        if (w.length < 2) {
            throw failure(400, 'Cada palabra de la frase debe tener al menos 2 letras.');
        }
    }
    if (new Set(words).size < 3) {
        throw failure(400, 'Por tu seguridad, no repitas la misma palabra en tu frase.');
    }
    return normalized;
}
function pinText(phrase) { return passphraseText(phrase); }
function pepper(phrase) { return crypto.createHmac('sha256', secret()).update('winton-phrase-v2:').update(passphraseText(phrase)).digest('base64'); }
function seal(text, key) {
    const iv=crypto.randomBytes(12), cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
    const ciphertext=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);
    return {iv:iv.toString('hex'),authTag:cipher.getAuthTag().toString('hex'),ciphertext:ciphertext.toString('hex')};
}
function open(box,key) {
    const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(box.iv,'hex'));
    decipher.setAuthTag(Buffer.from(box.authTag,'hex'));
    return Buffer.concat([decipher.update(Buffer.from(box.ciphertext,'hex')),decipher.final()]).toString('utf8');
}
class WalletService {
    generateEncryptedWallet() {
        secret(); const wallet=ethers.Wallet.createRandom();
        return {address:wallet.address,encryptedPrivateKey:this.encrypt(wallet.privateKey)};
    }
    encrypt(text) { return 'v2:'+Buffer.from(JSON.stringify(seal(text,crypto.scryptSync(secret(),'winton-wallet-envelope-v2',32)))).toString('base64'); }
    decrypt(value) {
        const master=secret();
        if (typeof value !== 'string') throw failure(409,'No hay material de billetera válido.');
        if(value.startsWith('v2:')) return open(JSON.parse(Buffer.from(value.slice(3),'base64').toString('utf8')),crypto.scryptSync(master,'winton-wallet-envelope-v2',32));
        const [iv,ciphertext]=value.split(':');
        const decipher=crypto.createDecipheriv('aes-256-cbc',crypto.scryptSync(master,'salt',32),Buffer.from(iv,'hex'));
        return Buffer.concat([decipher.update(Buffer.from(ciphertext,'hex')),decipher.final()]).toString('utf8');
    }
    deriveKeyFromPin(phrase,saltHex) { return crypto.pbkdf2Sync(passphraseText(phrase),Buffer.from(saltHex,'hex'),100000,32,'sha256'); }
    async unlock(ks,phrase) {
        if(typeof ks==='string') ks=JSON.parse(ks);
        if(!ks || ![1,2].includes(ks.version) || ks.iterations !== 100000) throw failure(409,'Formato de billetera no compatible.');
        const key=await pbkdf2(ks.version===2 ? pepper(phrase) : passphraseText(phrase),Buffer.from(ks.salt,'hex'),100000,32,'sha256');
        return open(ks,key);
    }
    async verifyTransactionPin(_businessClient,userId,phrase) {
        passphraseText(phrase);
        // Independent row/transaction: a financial rollback cannot erase an attempt.
        const client=await require('./pinAttemptsPool').connect(); let committed=false;
        try {
            await client.query('BEGIN');
            await client.query('INSERT INTO wallet_pin_attempts (user_id) VALUES ($1) ON CONFLICT DO NOTHING',[userId]);
            const attempts=(await client.query('SELECT failed_attempts, locked_until FROM wallet_pin_attempts WHERE user_id=$1 FOR UPDATE',[userId])).rows[0];
            const user=(await client.query('SELECT has_transaction_pin, transaction_pin_hash, web3_keystore FROM users WHERE id=$1',[userId])).rows[0];
            if(!user?.has_transaction_pin || !user.transaction_pin_hash) throw failure(412,'Configura tu Frase de Seguridad antes de continuar.');
            if(attempts.locked_until && new Date(attempts.locked_until)>new Date()) throw failure(429,'Frase de seguridad bloqueada temporalmente. Intenta nuevamente en 15 minutos.');
            const ks=typeof user.web3_keystore==='string' ? JSON.parse(user.web3_keystore) : user.web3_keystore;
            const match=await bcrypt.compare(ks?.version===2 ? pepper(phrase) : phrase,user.transaction_pin_hash);
            if(!match) {
                const count=(attempts.locked_until ? 0 : attempts.failed_attempts)+1;
                await client.query("UPDATE wallet_pin_attempts SET failed_attempts=$2, locked_until=CASE WHEN $2>=5 THEN NOW()+INTERVAL '15 minutes' ELSE NULL END WHERE user_id=$1",[userId,count]);
                await client.query('COMMIT'); committed=true;
                throw failure(count>=5 ? 429 : 401,count>=5 ? 'Frase de seguridad bloqueada por 15 minutos.' : `Frase de seguridad incorrecta. Quedan ${5-count} intentos.`);
            }
            await client.query('UPDATE wallet_pin_attempts SET failed_attempts=0, locked_until=NULL WHERE user_id=$1',[userId]);
            await client.query('COMMIT'); committed=true; return {valid:true};
        } catch(error) { if(!committed) await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
    }
    async setupTransactionPin(client,userId,phrase,currentPhrase=null) {
        passphraseText(phrase); secret();
        const user=(await client.query('SELECT id, username, web3_wallet_address, web3_private_key_encrypted, web3_keystore, has_transaction_pin FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];
        if(!user) throw failure(404,'Usuario no encontrado.');
        let privateKey;
        if(user.has_transaction_pin) {
            if(!currentPhrase) throw failure(400,'Se requiere la frase de seguridad actual.');
            await this.verifyTransactionPin(client,userId,currentPhrase);
            privateKey=await this.unlock(user.web3_keystore,currentPhrase);
        } else if(user.web3_private_key_encrypted) {
            try {
                privateKey=this.decrypt(user.web3_private_key_encrypted);
            } catch (decErr) {
                console.error(`[WALLET SERVICE] Error al descifrar clave privada previa de usuario ${userId}:`, decErr.message);
                throw failure(409, 'La billetera asociada requiere recuperación; no se reemplazará su dirección.');
            }
        }
        else if(user.web3_wallet_address || user.web3_keystore) throw failure(409,'La billetera asociada requiere recuperación; no se reemplazará su dirección.');
        else privateKey=ethers.Wallet.createRandom().privateKey;
        const address=new ethers.Wallet(privateKey).address;
        if(user.web3_wallet_address && address.toLowerCase()!==user.web3_wallet_address.toLowerCase()) throw failure(409,'La clave no corresponde a la billetera asociada. Se requiere revisión.');
        const salt=crypto.randomBytes(32).toString('hex'), key=await pbkdf2(pepper(phrase),Buffer.from(salt,'hex'),100000,32,'sha256');
        const ks={version:2,algorithm:'aes-256-gcm',kdf:'pbkdf2-sha256-server-pepper',iterations:100000,salt,...seal(privateKey,key)};
        if(new ethers.Wallet(await this.unlock(ks,phrase)).address!==address) throw failure(500,'No se pudo verificar la protección de la billetera.');
        const hash=await bcrypt.hash(pepper(phrase),10);
        await client.query(`UPDATE users SET has_transaction_pin=TRUE,transaction_pin_hash=$1,transaction_pin_salt=$2,
            web3_keystore=$3,web3_wallet_address=$4,web3_private_key_encrypted=NULL,
            transaction_pin_failed_attempts=0,transaction_pin_locked_until=NULL WHERE id=$5`,[hash,salt,JSON.stringify(ks),address,userId]);
        await client.query('INSERT INTO wallet_pin_attempts (user_id,failed_attempts,locked_until) VALUES ($1,0,NULL) ON CONFLICT (user_id) DO UPDATE SET failed_attempts=0,locked_until=NULL',[userId]);
        return {success:true,walletAddress:address,message:'Frase de seguridad configurada; billetera en autocustodia protegida.'};
    }
    async decryptPrivateKeyWithPin(client,userId,pin) {
        await this.verifyTransactionPin(client,userId,pin);
        const user=(await client.query('SELECT web3_keystore,web3_wallet_address FROM users WHERE id=$1',[userId])).rows[0];
        const key=await this.unlock(user?.web3_keystore,pin);
        if(!user.web3_wallet_address || new ethers.Wallet(key).address.toLowerCase()!==user.web3_wallet_address.toLowerCase()) throw failure(409,'La clave no corresponde a tu billetera.');
        // Upgrade legacy PIN protection only after successful authorization and address validation.
        const ks=typeof user.web3_keystore==='string'?JSON.parse(user.web3_keystore):user.web3_keystore;
        if(ks.version===1) await this.setupTransactionPin(client,userId,pin,pin);
        return key;
    }
    async getPinStatus(client,userId) {
        const row=(await client.query(`SELECT u.kyc_verified,u.has_transaction_pin,a.failed_attempts,a.locked_until
            FROM users u LEFT JOIN wallet_pin_attempts a ON a.user_id=u.id WHERE u.id=$1`,[userId])).rows[0];
        if(!row) throw failure(404,'Usuario no encontrado.');
        const isLocked=Boolean(row.locked_until && new Date(row.locked_until)>new Date());
        return {hasPin:Boolean(row.has_transaction_pin),kycVerified:Boolean(row.kyc_verified),isLocked,
            remainingAttempts:isLocked ? 0 : row.locked_until ? 5 : Math.max(0,5-(row.failed_attempts||0))};
    }
}
module.exports=new WalletService();
