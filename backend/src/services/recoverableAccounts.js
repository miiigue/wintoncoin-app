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
const legacyMigration=require('./legacyWalletMigration');
const migrationExecution=require('./legacyMigrationExecution');
const factoryAbi=['function proxyCreationCode() view returns(bytes)','function createProxyWithNonce(address,bytes,uint256) returns(address)'];
const passkeyAbi=['function getSigner(uint256,uint256,uint176) view returns(address)','function createSigner(uint256,uint256,uint176) returns(address)'];
function backupMessage(id,userId,config){return ['WintonCoin: confirmar respaldo de recuperación',id,String(userId),String(config.chainId),config.hash].join('\n');}
class RecoverableAccounts {
    constructor(pool,rpc=deployment.provider(),config=policy.configuration()) {this.pool=pool;this.rpc=rpc;this.config=config;this.store=new ChainOperationStore(pool,rpc);}
    async activationReadiness(userId) {
        const context=await this.status(userId); // Also checks the account schema.
        const user=(await this.pool.query('SELECT web3_wallet_address,account_status FROM users WHERE id=$1',[userId])).rows[0];
        if(!user||user.account_status!=='active')throw error('Tu cuenta no está habilitada. Contacta con soporte.',403);
        if(user.web3_wallet_address)await this.assertOrMigrateLegacyAddress(userId,user);
        await require('./accountActivationReadiness').check({pool:this.pool,rpc:this.rpc,config:this.config,userId});
        return {success:true,ready:true,replacingLegacy:Boolean(user.web3_wallet_address&&!context.account),checkedAt:new Date().toISOString(),alreadyActive:context.account?.state==='active'};
    }
    async status(userId) {
        const result=await this.pool.query(`SELECT a.* FROM smart_accounts a JOIN account_identities i ON i.id=a.identity_id WHERE i.user_id=$1 AND a.chain_id=$2`,[userId,String(this.config.chainId)]);
        const a=result.rows[0];
        const activation=a&&a.state!=='active'?(await this.pool.query("SELECT id FROM chain_operations WHERE user_id=$1 AND kind='accountActivation' AND payload->>'account'=$2 ORDER BY created_at DESC LIMIT 1",[userId,a.address])).rows[0]:null;
        return {success:true,userId,activationId:activation?.id,account:a?{address:a.address,state:a.state,passkey:a.passkey,backupConfirmed:Boolean(a.backup_confirmed_at)}:null,
            configuration:{...this.config,assistedRecoveryEnabled:false,assistedRecoveryFee:null}};
    }
    // Verify only; never detach the old address before the replacement is complete.
    async assertOrMigrateLegacyAddress(userId,user,client=null,completion=null) {
        if(!user)throw error('No se pudo comprobar la cuenta.',409);
        if(!user.web3_wallet_address)return true;
        const runner=client||this.pool;
        const existing=(await runner.query(`SELECT address, state FROM smart_accounts a
            JOIN account_identities i ON i.id=a.identity_id WHERE i.user_id=$1 AND a.chain_id=$2`,
            [userId,String(this.config.chainId)])).rows[0];
        const old=user.web3_wallet_address.toLowerCase();
        if(existing?.state==='active'&&existing.address.toLowerCase()===old)return true;
        if(existing && (!completion || existing.state!=='prepared' ||
            existing.address.toLowerCase()!==completion.account || completion.legacyAddress!==old))
            throw Object.assign(error('La actualización de tu billetera requiere revisión. Tu dirección se conserva.',409),{code:'LEGACY_MIGRATION_REQUIRED'});
        if(!completion)return migrationExecution.plan(this,runner,userId,old);
        return legacyMigration.inspect({rpc:this.rpc,runner,userId,address:old,chainId:this.config.chainId,
            excludeOperationId:completion.id,migration:completion.allowances||null});
    }
    async options(userId,rp) {
        await policy.validateInfrastructure(this.rpc,this.config);
        const user=(await this.pool.query('SELECT username,account_status,web3_wallet_address FROM users WHERE id=$1',[userId])).rows[0];
        if(!user||user.account_status!=='active')throw error('Cuenta no habilitada.',403);
        const legacyPlan=user.web3_wallet_address?await this.assertOrMigrateLegacyAddress(userId,user):null;
        const existing=await this.status(userId);
        if(existing.account)throw error('La activación ya está preparada. Continúa desde su estado.');
        const id=randomUUID();
        const options=await generateRegistrationOptions({rpName:'WintonCoin',rpID:rp.rpId,userID:String(userId),userName:user.username,
            attestationType:'none',supportedAlgorithmIDs:[-7],authenticatorSelection:{residentKey:'required',userVerification:'required'}});
        const payload={options,rp,manifestHash:this.config.hash,legacyPlan,legacyAddress:user.web3_wallet_address?.toLowerCase()||null};
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
            if((user.web3_wallet_address?.toLowerCase()||null)!==(c.payload.legacyAddress||null))throw error('Tu billetera cambió. Vuelve a iniciar la configuración.',409);
            const legacyPlan=user.web3_wallet_address?await this.assertOrMigrateLegacyAddress(userId,user,client):null;
            if(JSON.stringify(migrationExecution.terms(legacyPlan))!==JSON.stringify(migrationExecution.terms(c.payload.legacyPlan)))throw error('El estado de tu billetera cambió. Vuelve a confirmar la configuración.');
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
              VALUES($1,$2,$3,$4,$5,$6,'accountActivation',$7,'{}','prepared')`,[id,userId,'account:'+id,String(this.config.chainId),signing.relayer().address.toLowerCase(),'account:'+address.toLowerCase(),JSON.stringify({plan,planLength:plan.length,account:address.toLowerCase(),manifestHash:this.config.hash,legacyPlan,legacyAddress:c.payload.legacyAddress||null})]);
            await client.query('UPDATE account_security_challenges SET consumed_at=NOW() WHERE id=$1',[id]);
            await client.query('INSERT INTO account_security_events(identity_id,event_type,actor_id,details) VALUES($1,$2,$3,$4)',[identity.id,'backup_proved',String(userId),JSON.stringify({address,chainId:String(this.config.chainId)})]);
            await client.query('COMMIT');
            return {success:true,operationId:id,address,passkey};
        } catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
    }
    async activationStatus(userId,id) {
        let row=await this.store.get(id,userId);
        if(row.kind!=='accountActivation'||row.payload?.manifestHash!==this.config.hash)throw error('Operación inválida.',400);
        const result=await this.store.reconcile(id);
        row=await this.store.get(id,userId);
        if(result.success) {
            const a=await signing.account(this.pool,userId,this.config.chainId,{active:false});
            if(a.address.toLowerCase()!==row.payload.account)throw error('La cuenta de la activación no coincide.',409);
            const safe=await policy.validateAccount(this.rpc,this.config,a);
            const owners=await safe.getOwners();
            if(owners.length!==1||owners[0].toLowerCase()!==a.passkey.owner.toLowerCase())throw error('El acceso de la cuenta requiere revisión.');
            let migrationResult=null;
            if(row.payload.legacyPlan&&a.state!=='active'){
                migrationResult=await migrationExecution.status(this,row,userId);
                if(!migrationResult.done)return {success:false,state:row.payload.migrationApproved?'pending':'prepared',operationId:id,requiresSignature:!row.payload.migrationApproved,migration:true,next:migrationResult.task.label,message:row.payload.migrationLastError||(row.payload.migrationApproved?'Actualización en curso: '+migrationResult.task.label+'. Conservamos los comprobantes y continuaremos automáticamente.':'La nueva billetera está creada. Confirma la actualización para trasladar tu saldo y conservar tus permisos.')};
            }
            const client=await this.pool.connect();
            try {
                await client.query('BEGIN');
                const user=(await client.query('SELECT web3_wallet_address,account_status FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];
                if(!user||user.account_status!=='active')throw error('La cuenta no está habilitada.',403);
                const currentAddress=user.web3_wallet_address?.toLowerCase()||null;
                if(currentAddress!==a.address.toLowerCase()&&currentAddress!==(row.payload.legacyAddress||null))throw error('La billetera cambió durante la activación.',409);
                if(user.web3_wallet_address&&currentAddress!==a.address.toLowerCase()) {
                    const evidence=await this.assertOrMigrateLegacyAddress(userId,user,client,{id,account:row.payload.account,legacyAddress:row.payload.legacyAddress,allowances:migrationResult?.evidence});
                    await client.query(`INSERT INTO account_security_events(identity_id,event_type,actor_id,details) VALUES($1,$2,$3,$4)`,
                        [a.identity_id,'legacy_address_replaced',String(userId),JSON.stringify({oldAddress:user.web3_wallet_address,newAddress:a.address,chainId:String(this.config.chainId),evidence,migration:migrationResult?.evidence||null})]);
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
        if(row.state==='confirmed'&&row.payload.legacyPlan){
            await migrationExecution.status(this,row,userId);
            await this.pool.query("UPDATE chain_operations SET payload=payload||jsonb_build_object('migrationApproved',true,'migrationApprovedAt',COALESCE(payload->>'migrationApprovedAt',NOW()::text)) WHERE id=$1 AND user_id=$2",[id,userId]);
            const approved=await this.store.get(id,userId);
            const result=await migrationExecution.advance(this,approved,userId);
            return {...result,success:false,requiresSignature:false,migration:true,state:'pending'};
        }
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
