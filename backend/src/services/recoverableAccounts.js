'use strict';
const {randomUUID}=require('crypto');
const {Contract,Interface,ZeroAddress,keccak256,concat,zeroPadValue,toBeHex,getCreate2Address,verifyMessage,getAddress}=require('ethers');
const {generateRegistrationOptions,verifyRegistrationResponse}=require('@simplewebauthn/server');
const {decodeCredentialPublicKey}=require('@simplewebauthn/server/helpers');
const {ChainOperationStore,publicResult,error}=require('./chainOperationStore');
const {ensureIdentity}=require('./accountIdentity');
const policy=require('./safeAccountPolicy');
const signing=require('./safeExecution');
const deployment=require('./chainDeployment');
const factoryAbi=['function proxyCreationCode() view returns(bytes)','function createProxyWithNonce(address,bytes,uint256) returns(address)'];
const passkeyAbi=['function getSigner(uint256,uint256,uint176) view returns(address)','function createSigner(uint256,uint256,uint176) returns(address)'];
function backupMessage(id,userId,config){return ['WintonCoin: confirmar respaldo de recuperación',id,String(userId),String(config.chainId),config.hash].join('\n');}
class RecoverableAccounts {
    constructor(pool,rpc=deployment.provider(),config=policy.configuration()) {this.pool=pool;this.rpc=rpc;this.config=config;this.store=new ChainOperationStore(pool,rpc);}
    async status(userId) {
        const result=await this.pool.query(`SELECT a.* FROM smart_accounts a JOIN account_identities i ON i.id=a.identity_id WHERE i.user_id=$1 AND a.chain_id=$2`,[userId,String(this.config.chainId)]);
        const a=result.rows[0];
        const activation=a&&a.state!=='active'?(await this.pool.query("SELECT id FROM chain_operations WHERE user_id=$1 AND kind='accountActivation' AND payload->>'account'=$2 ORDER BY created_at DESC LIMIT 1",[userId,a.address])).rows[0]:null;
        return {success:true,activationId:activation?.id,account:a?{address:a.address,state:a.state,passkey:a.passkey,backupConfirmed:Boolean(a.backup_confirmed_at)}:null,
            configuration:{...this.config,assistedRecoveryEnabled:false,assistedRecoveryFee:null}};
    }
    async assertOrMigrateLegacyAddress(userId, user, client = null) {
        if (!user || !user.web3_wallet_address) return true;
        const legacyAddress = user.web3_wallet_address;
        const runner = client || this.pool;
        const existingSafe = await runner.query(
            `SELECT address FROM smart_accounts a JOIN account_identities i ON i.id = a.identity_id WHERE i.user_id = $1 AND a.chain_id = $2`,
            [userId, String(this.config.chainId)]
        );
        if (existingSafe.rows[0] && existingSafe.rows[0].address.toLowerCase() === legacyAddress.toLowerCase()) {
            return true;
        }
        const pendingPayments = await runner.query(
            `SELECT COUNT(*) FROM marketplace_payments WHERE (payer_id = $1 OR payee_id = $1) AND status IN ('pending', 'in_escrow')`,
            [userId]
        );
        if (parseInt(pendingPayments.rows[0].count, 10) > 0) {
            throw error('La cuenta posee pagos de marketplace en curso. No se puede sustituir la dirección.', 409);
        }
        if (this.rpc && typeof this.rpc.call === 'function') {
            try {
                const addrs = deployment.addresses();
                const erc20Abi = ['function balanceOf(address) view returns(uint256)'];
                if (addrs.blueToken) {
                    const blueContract = new Contract(addrs.blueToken, [...erc20Abi, 'function lockedBalanceOf(address) view returns(uint256)'], this.rpc);
                    const [bal, locked] = await Promise.all([
                        blueContract.balanceOf(legacyAddress).catch(() => 0n),
                        blueContract.lockedBalanceOf(legacyAddress).catch(() => 0n)
                    ]);
                    if (bal > 0n || locked > 0n) {
                        throw error('La dirección previa posee saldo BLUE activo y requiere retiro antes de reemplazo.', 409);
                    }
                }
                if (addrs.redToken) {
                    const redContract = new Contract(addrs.redToken, erc20Abi, this.rpc);
                    const redBal = await redContract.balanceOf(legacyAddress).catch(() => 0n);
                    if (redBal > 0n) {
                        throw error('La dirección previa posee compromisos RED activos que deben ser amortizados.', 409);
                    }
                }
                if (addrs.usdt) {
                    const usdtContract = new Contract(addrs.usdt, erc20Abi, this.rpc);
                    const usdtBal = await usdtContract.balanceOf(legacyAddress).catch(() => 0n);
                    if (usdtBal > 0n) {
                        throw error('La dirección previa posee saldo USDT activo.', 409);
                    }
                }
            } catch (err) {
                if (err.status === 409 || err.statusCode === 409) throw err;
            }
        }
        return true;
    }
    async options(userId,rp) {
        await policy.validateInfrastructure(this.rpc,this.config);
        const user=(await this.pool.query('SELECT username,account_status,web3_wallet_address FROM users WHERE id=$1',[userId])).rows[0];
        if(!user||user.account_status!=='active')throw error('Cuenta no habilitada.',403);
        if(user.web3_wallet_address) {
            await this.assertOrMigrateLegacyAddress(userId, user);
        }
        const existing=await this.status(userId);
        if(existing.account)throw error('La activación ya está preparada. Continúa desde su estado.');
        const id=randomUUID();
        const options=await generateRegistrationOptions({rpName:'WintonCoin',rpID:rp.rpId,userID:String(userId),userName:user.username,
            attestationType:'none',supportedAlgorithmIDs:[-7],authenticatorSelection:{residentKey:'required',userVerification:'required'}});
        const payload={options,rp,manifestHash:this.config.hash};
        await this.pool.query("INSERT INTO account_security_challenges(id,user_id,purpose,payload,expires_at) VALUES($1,$2,'register',$3,NOW()+INTERVAL '15 minutes')",[id,userId,JSON.stringify(payload)]);
        return {success:true,id,options,backupMessage:backupMessage(id,userId,this.config)};
    }
    async register(userId,{id,response,recoveryAddress,recoverySignature}) {
        if(typeof id!=='string'||id.length!==36)throw error('Referencia inválida.',400);
        await policy.validateInfrastructure(this.rpc,this.config);
        const client=await this.pool.connect();
        try {
            await client.query('BEGIN');
            const c=(await client.query("SELECT * FROM account_security_challenges WHERE id=$1 AND user_id=$2 AND purpose='register' AND consumed_at IS NULL AND expires_at>NOW() FOR UPDATE",[id,userId])).rows[0];
            if(!c||c.payload.manifestHash!==this.config.hash)throw error('La activación venció. Vuelve a comenzar.');
            const user=(await client.query('SELECT web3_wallet_address,account_status FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];
            if(!user||user.account_status!=='active')throw error('La cuenta cambió o no está habilitada.');
            if(user.web3_wallet_address) {
                await this.assertOrMigrateLegacyAddress(userId, user, client);
            }
            if(verifyMessage(backupMessage(id,userId,this.config),recoverySignature).toLowerCase()!==getAddress(recoveryAddress).toLowerCase()||getAddress(recoveryAddress)===ZeroAddress)throw error('No se pudo comprobar el respaldo.');
            const verification=await verifyRegistrationResponse({response,expectedChallenge:c.payload.options.challenge,
                expectedOrigin:c.payload.rp.origin,expectedRPID:c.payload.rp.rpId,requireUserVerification:true});
            if(!verification.verified)throw error('No se pudo verificar el dispositivo.');
            const info=verification.registrationInfo, cose=decodeCredentialPublicKey(info.credentialPublicKey);
            if(cose.get(1)!==2||cose.get(3)!==-7||cose.get(-1)!==1)throw error('El dispositivo no admite el tipo de firma requerido.');
            const coordinates={x:'0x'+Buffer.from(cose.get(-2)).toString('hex'),y:'0x'+Buffer.from(cose.get(-3)).toString('hex')};
            const pc=this.config.contracts;
            const verifier=pc.passkeyVerifier.address;
            const passkeyFactory=new Contract(pc.passkeyFactory.address,passkeyAbi,this.rpc);
            const owner=await passkeyFactory.getSigner(coordinates.x,coordinates.y,verifier);
            const initializer=new Interface(policy.abi).encodeFunctionData('setup',[[owner],1,ZeroAddress,'0x',pc.fallbackHandler.address,ZeroAddress,0,ZeroAddress]);
            const nonce=BigInt('0x'+id.replace(/-/g,''));
            const factory=new Contract(pc.factory.address,factoryAbi,this.rpc);
            const salt=keccak256(concat([keccak256(initializer),zeroPadValue(toBeHex(nonce),32)]));
            const address=getCreate2Address(pc.factory.address,salt,keccak256(concat([await factory.proxyCreationCode(),zeroPadValue(pc.singleton.address,32)])));
            const identity=await ensureIdentity(client,userId);
            const passkey={rawId:Buffer.from(info.credentialID).toString('hex'),coordinates,verifierAddress:verifier,rpId:c.payload.rp.rpId,owner};
            await client.query(`INSERT INTO smart_accounts(identity_id,chain_id,address,passkey,recovery_address,manifest_hash,state,backup_confirmed_at)
                VALUES($1,$2,$3,$4,$5,$6,'prepared',NOW())`,[identity.id,String(this.config.chainId),address.toLowerCase(),JSON.stringify(passkey),getAddress(recoveryAddress).toLowerCase(),this.config.hash]);
            const plan=[
                {to:pc.passkeyFactory.address,data:new Interface(passkeyAbi).encodeFunctionData('createSigner',[coordinates.x,coordinates.y,verifier]),value:'0',label:'Registrar dispositivo'},
                {to:pc.factory.address,data:new Interface(factoryAbi).encodeFunctionData('createProxyWithNonce',[pc.singleton.address,initializer,nonce]),value:'0',label:'Crear cuenta permanente'},
                {to:address,data:new Interface(policy.abi).encodeFunctionData('enableModule',[pc.recoveryModule.address]),value:'0',label:'Activar recuperación',userSignature:true},
                {to:pc.recoveryModule.address,data:new Interface(policy.recoveryAbi).encodeFunctionData('addGuardianWithThreshold',[recoveryAddress,1]),value:'0',label:'Registrar respaldo',userSignature:true}
            ];
            await client.query(`INSERT INTO chain_operations(id,user_id,request_key,chain_id,sender,resource_key,kind,payload,projection,state)
              VALUES($1,$2,$3,$4,$5,$6,'accountActivation',$7,'{}','prepared')`,[id,userId,'account:'+id,String(this.config.chainId),signing.relayer().address.toLowerCase(),'account:'+address.toLowerCase(),JSON.stringify({plan,planLength:plan.length,account:address.toLowerCase(),manifestHash:this.config.hash})]);
            await client.query('UPDATE account_security_challenges SET consumed_at=NOW() WHERE id=$1',[id]);
            await client.query('INSERT INTO account_security_events(identity_id,event_type,actor_id,details) VALUES($1,$2,$3,$4)',[identity.id,'backup_proved',String(userId),JSON.stringify({address,chainId:String(this.config.chainId)})]);
            await client.query('COMMIT');
            return {success:true,operationId:id,address,passkey};
        } catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
    }
    async activationStatus(userId,id) {
        let row=await this.store.get(id,userId);
        if(row.kind!=='accountActivation')throw error('Operación inválida.',400);
        const result=await this.store.reconcile(id);
        row=await this.store.get(id,userId);
        if(result.success) {
            const a=await signing.account(this.pool,userId,this.config.chainId,{active:false});
            const safe=await policy.validateAccount(this.rpc,this.config,a);
            const owners=await safe.getOwners();
            if(owners.length!==1||owners[0].toLowerCase()!==a.passkey.owner.toLowerCase())throw error('El acceso de la cuenta requiere revisión.');
            const client=await this.pool.connect();
            try {
                await client.query('BEGIN');
                const user=(await client.query('SELECT web3_wallet_address FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];
                if(user.web3_wallet_address&&user.web3_wallet_address.toLowerCase()!==a.address.toLowerCase()) {
                    await this.assertOrMigrateLegacyAddress(userId, user, client);
                    await client.query(`INSERT INTO account_security_events(identity_id,event_type,actor_id,details) VALUES($1,$2,$3,$4)`,
                        [a.identity_id,'legacy_address_replaced',String(userId),JSON.stringify({oldAddress:user.web3_wallet_address,newAddress:a.address,chainId:String(this.config.chainId)})]);
                }
                await client.query('UPDATE users SET web3_wallet_address=$1 WHERE id=$2',[a.address,userId]);
                await client.query("UPDATE smart_accounts SET state='active' WHERE identity_id=$1 AND chain_id=$2",[a.identity_id,String(this.config.chainId)]);
                await client.query('COMMIT');
            }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
        }
        const next=row.payload.plan[row.steps.length];
        return {...result,next:next?.label,authorization:result.requiresSignature&&next?.userSignature?
            await signing.quote(this.pool,this.rpc,this.config,userId,next,{active:false}):null};
    }
    async activate(userId,id,{signature,hash}={}) {
        const row=await this.store.get(id,userId);
        if(row.kind!=='accountActivation'||row.payload.manifestHash!==this.config.hash)throw error('Activación inválida.');
        await policy.validateInfrastructure(this.rpc,this.config);
        return this.store.authorize(id,userId,async fresh=>{
            const next=fresh.payload.plan[fresh.steps.length];
            let call=next;
            if(next.userSignature) {
                const q=await signing.quote(this.pool,this.rpc,this.config,userId,next,{active:false});
                if(q.hash!==hash)throw error('La autorización cambió. Confirma de nuevo.');
                call=await signing.build(this.rpc,this.config,q,signature);
            }
            return [await signing.sponsoredStep(this.pool,this.rpc,this.config.chainId,userId,fresh,call)];
        });
    }
}
module.exports={RecoverableAccounts,backupMessage};
