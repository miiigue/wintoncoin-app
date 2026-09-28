'use strict';
const {randomUUID}=require('crypto');
const {keccak256,Transaction,Contract}=require('ethers');
const {confirmedReceipt}=require('./chainConfirmation');
const error=(message,status=409)=>Object.assign(new Error(message),{status});

// Session advisory locks survive SQL commits but are released on connection loss.
// Never send a transaction before its exact signed bytes have committed.
async function locked(pool,key,fn) {
    const client=await pool.connect(); let acquired=false;
    try {
        acquired=(await client.query('SELECT pg_try_advisory_lock(hashtextextended($1, 778)) AS acquired',[key])).rows[0].acquired;
        if(!acquired)throw error('Ya hay una operación en curso. Espera su confirmación.');
        return await fn(client);
    } finally {
        let discard=false;
        if(acquired)try { await client.query('SELECT pg_advisory_unlock(hashtextextended($1,778))',[key]); } catch { discard=true; }
        client.release(discard);
    }
}
function publicResult(row) {
    return {success:row.state==='confirmed',accepted:['pending','conflict'].includes(row.state),pending:row.state==='pending',
        operationId:row.id,state:row.state,kind:row.kind,createdAt:row.created_at,requiresSignature:row.state==='prepared',
        txHash:row.steps?.at(-1)?.hash || null,
        steps:(row.steps || []).map(s=>({hash:s.hash,confirmed:Boolean(s.confirmed),label:s.label})),
        message:row.state==='confirmed'?'Operación confirmada.':row.state==='failed'?'El contrato rechazó la operación. Revisa los pasos confirmados antes de intentarlo de nuevo.':row.state==='conflict'?'La operación requiere revisión; no se volverá a enviar automáticamente.':row.state==='abandoned'?'Pasos pendientes abandonados. Los pasos ya confirmados conservan su efecto.':'Operación registrada; se está comprobando en blockchain.'};
}
async function project(client,row) {
    const p=row.projection;
    if(p.type==='setting') {
        if(!['platform_commission_percentage','debt_cycle_days'].includes(p.key))throw error('Proyección no admitida');
        await client.query(`INSERT INTO app_settings(setting_key,setting_value,updated_at) VALUES($1,$2,NOW())
            ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=NOW()`,[p.key,p.value]);
    } else if(p.type==='credit_manual') {
        const result=await client.query('UPDATE users SET red_credit_limit_override=$1 WHERE LOWER(web3_wallet_address)=LOWER($2)',[p.value,p.wallet]);
        if(result.rowCount!==1)throw error('La identidad requiere conciliación.');
    } else if(p.type==='kyc') {
        const result=await client.query('UPDATE users SET kyc_verified=$1 WHERE LOWER(web3_wallet_address)=LOWER($2)',[p.value,p.wallet]);
        if(result.rowCount!==1)throw error('La identidad requiere conciliación.');
    }
}
class ChainOperationStore {
    constructor(pool,provider,{confirmations=2,finality='safe'}={}) {this.pool=pool;this.provider=provider;this.confirmations=confirmations;this.finality=finality;}
    async get(id,userId) {
        const result=await this.pool.query('SELECT * FROM chain_operations WHERE id=$1 AND ($2::integer IS NULL OR user_id=$2)',[id,userId??null]);
        if(!result.rows[0])throw error('Operación no encontrada.',404);return result.rows[0];
    }
    async prepare({id=randomUUID(),userId=null,key,chainId,sender,resource,kind,payload,projection={}}) {
        const previous=await this.pool.query('SELECT * FROM chain_operations WHERE request_key=$1',[key]);
        if(previous.rows[0]) {
            const row=previous.rows[0];
            if(row.user_id!==userId || !require('util').isDeepStrictEqual(row.payload,payload))throw error('La referencia ya pertenece a otra operación.');
            return row;
        }
        return (await this.pool.query(`INSERT INTO chain_operations(id,user_id,request_key,chain_id,sender,resource_key,kind,payload,projection,state)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'prepared') RETURNING *`,[id,userId,key,chainId,sender.toLowerCase(),resource,kind,JSON.stringify(payload),JSON.stringify(projection)])).rows[0];
    }
    async authorize(id,userId,build) {
        const initial=await this.get(id,userId);
        return locked(this.pool,'signer:'+initial.chain_id+':'+initial.sender,async client=>{
            const row=await this.get(id,userId);
            if(row.state!=='prepared')return publicResult(row);
            const blocked=await client.query("SELECT id FROM chain_operations WHERE chain_id=$1 AND (sender=$2 OR resource_key=$3) AND state IN ('pending','conflict') AND id<>$4 LIMIT 1",[row.chain_id,row.sender,row.resource_key,row.id]);
            if(blocked.rowCount)throw error('Hay una operación pendiente de confirmación o recuperación.');
            const additions=await build(row,client);
            if(!Array.isArray(additions)||additions.length!==1)throw error('Solo se firma un paso después de confirmar el anterior.');
            for(const step of additions) {
                const tx=Transaction.from(step.raw);
                if(tx.from?.toLowerCase()!==row.sender || String(tx.chainId)!==row.chain_id || keccak256(step.raw)!==step.hash)throw error('Firma o red inconsistente');
            }
            const steps=[...row.steps,...additions];
            // Autocommit must succeed before broadcasting. On uncertain DB response, retry by id.
            await client.query("UPDATE chain_operations SET steps=$2,state='pending',updated_at=NOW() WHERE id=$1 AND state='prepared'",[id,JSON.stringify(steps)]);
            return this.advanceLocked({...row,state:'pending',steps},client);
        });
    }
    async advanceLocked(row,client) {
        if(row.state!=='pending')return publicResult(row);
        await client.query('UPDATE chain_operations SET updated_at=NOW() WHERE id=$1',[row.id]);
        if(String((await this.provider.getNetwork()).chainId)!==row.chain_id)throw error('Red incorrecta.',503);
        const steps=row.steps;
        for(let i=0;i<steps.length;i++) {
            const step=steps[i];
            const receipt=await this.provider.getTransactionReceipt(step.hash);
            if(!receipt) {
                if(step.confirmed) { // Never advance a later stage across a reorganization.
                    await client.query("UPDATE chain_operations SET state='conflict',error_code='REORG_AFTER_CONFIRMATION',updated_at=NOW() WHERE id=$1",[row.id]);
                    return publicResult({...row,state:'conflict'});
                }
                const tx=Transaction.from(step.raw);
                if(row.payload.kycContract && !await new Contract(row.payload.kycContract,['function isKYCVerified(address) view returns(bool)'],this.provider).isKYCVerified(row.sender))
                    return publicResult(row); // Suspend delivery while KYC is suspended; don't discard signed evidence.
                const used=await this.provider.getTransactionCount(row.sender,'latest');
                if(used>tx.nonce) {
                    await client.query("UPDATE chain_operations SET state='conflict',error_code='NONCE_USED_WITHOUT_RECEIPT',updated_at=NOW() WHERE id=$1",[row.id]);
                    return publicResult({...row,state:'conflict'});
                }
                try { await this.provider.broadcastTransaction(step.raw); } catch { /* Unknown transport outcome: keep exact bytes and reconcile. */ }
                return publicResult(row);
            }
            if(step.confirmed && step.blockHash!==receipt.blockHash) {
                await client.query("UPDATE chain_operations SET state='conflict',error_code='REORG_AFTER_CONFIRMATION',updated_at=NOW() WHERE id=$1",[row.id]);
                return publicResult({...row,state:'conflict'});
            }
            const verified=await confirmedReceipt(this.provider,step.hash,{finality:this.finality,confirmations:this.confirmations});
            if(!verified||verified.blockHash!==receipt.blockHash||verified.status!==receipt.status)return publicResult(row);
            if(receipt.status!==1) {
                await client.query("UPDATE chain_operations SET state='failed',error_code='CHAIN_REVERT',updated_at=NOW() WHERE id=$1",[row.id]);
                return publicResult({...row,state:'failed'});
            }
            step.confirmed=true;step.blockHash=receipt.blockHash;
            await client.query('UPDATE chain_operations SET steps=$2,updated_at=NOW() WHERE id=$1',[row.id,JSON.stringify(steps)]);
        }
        if(steps.length<(row.payload.planLength || 1)) {
            await client.query("UPDATE chain_operations SET state='prepared',updated_at=NOW() WHERE id=$1",[row.id]);
            return publicResult({...row,state:'prepared'});
        }
        // Projection and completion share a DB transaction. Failure leaves pending and retries the same receipts.
        await client.query('BEGIN');
        try {
            await project(client,row);
            await client.query("UPDATE chain_operations SET state='confirmed',error_code=NULL,updated_at=NOW() WHERE id=$1",[row.id]);
            await client.query('COMMIT');
        } catch(e) {await client.query('ROLLBACK');throw e;}
        return publicResult({...row,state:'confirmed'});
    }
    async abandon(id,userId) {
        const initial=await this.get(id,userId);
        if(initial.kind==='marketplace'||initial.kind==='gas'||!userId)throw error('Esta operación no se puede abandonar.');
        return locked(this.pool,'signer:'+initial.chain_id+':'+initial.sender,async client=>{
            const row=await this.get(id,userId);
            if(row.state==='abandoned')return publicResult(row);
            if(row.state!=='prepared'||row.steps.some(s=>!s.confirmed)||row.steps.length>=(row.payload.planLength||1))throw error('No se puede abandonar una transacción firmada pendiente. Consulta su estado.');
            for(const step of row.steps) {
                const receipt=await confirmedReceipt(this.provider,step.hash,{finality:this.finality,confirmations:this.confirmations});
                if(!receipt||receipt.status!==1||receipt.blockHash!==step.blockHash)throw error('No se pudo verificar el paso anterior.');
            }
            const funding=await client.query("SELECT id FROM chain_operations WHERE kind='gas' AND payload->>'parentId'=$1 AND state IN ('pending','conflict') LIMIT 1",[id]);
            if(funding.rowCount)throw error('Espera la confirmación del patrocinio antes de abandonar.');
            await client.query("UPDATE chain_operations SET state='abandoned',updated_at=NOW() WHERE id=$1",[id]);
            return publicResult({...row,state:'abandoned'});
        });
    }
    async reconcile(id) {
        const row=await this.get(id);
        return locked(this.pool,'signer:'+row.chain_id+':'+row.sender,async client=>this.advanceLocked(await this.get(id),client));
    }
    async sweep(limit=25) {
        const rows=await this.pool.query("SELECT id FROM chain_operations WHERE state='pending' ORDER BY updated_at LIMIT $1",[limit]);
        let confirmed=0;
        for(const row of rows.rows)try {if((await this.reconcile(row.id)).success)confirmed++;}catch { /* Retry next cycle; never erase a signed intent. */ }
        return {checked:rows.rowCount,confirmed};
    }
}
module.exports={ChainOperationStore,locked,publicResult,error};
