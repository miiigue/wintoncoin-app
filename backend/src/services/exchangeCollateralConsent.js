'use strict';

const {getAddress}=require('ethers');
const DOCUMENT_TYPE='automatic_exchange_collateral_authorization';

function failure(message,status=400,code='AUTOMATIC_COLLATERAL_CONSENT_INVALID'){
    return Object.assign(new Error(message),{status,code});
}
function canonicalWallet(value){
    try{return getAddress(value).toLowerCase();}
    catch{throw failure('La billetera asociada no es válida.',409,'WALLET_IDENTITY_INVALID');}
}
function requestEvidence(req={}){
    const forwarded=String(req.headers?.['x-forwarded-for']||'').split(',')[0].trim();
    return {
        ip:(forwarded||req.socket?.remoteAddress||null)?.slice(0,45)||null,
        userAgent:String(req.headers?.['user-agent']||'').slice(0,1000)||null
    };
}
async function activeDocument(client){
    const result=await client.query(
        `SELECT type,version,content,content_hash,created_at
         FROM exchange_collateral_consent_documents WHERE type=$1 AND is_active=TRUE
         ORDER BY created_at DESC,id DESC LIMIT 2`,[DOCUMENT_TYPE]
    );
    if(result.rowCount!==1)throw failure('La autorización legal vigente no está publicada de forma inequívoca.',503,'CONSENT_DOCUMENT_UNAVAILABLE');
    return result.rows[0];
}
async function lockedIdentity(client,userId){
    const result=await client.query(
        'SELECT id,web3_wallet_address FROM users WHERE id=$1 FOR UPDATE',[userId]
    );
    if(result.rowCount!==1)throw failure('No se encontró la cuenta.',404,'USER_NOT_FOUND');
    return {userId:result.rows[0].id,walletAddress:canonicalWallet(result.rows[0].web3_wallet_address)};
}
async function latestConsent(client,userId){
    const result=await client.query(
        `SELECT id,wallet_address,document_type,document_version,document_hash,accepted_at,revoked_at
         FROM exchange_collateral_consents WHERE user_id=$1 ORDER BY accepted_at DESC,id DESC LIMIT 1`,[userId]
    );
    return result.rows[0]||null;
}
function statusFor(document,identity,consent){
    const current=Boolean(consent&&!consent.revoked_at
        && consent.document_type===document.type
        && consent.document_version===document.version
        && consent.document_hash===document.content_hash
        && consent.wallet_address.toLowerCase()===identity.walletAddress);
    return {
        document:{type:document.type,version:document.version,content:document.content,contentHash:document.content_hash,publishedAt:document.created_at},
        walletAddress:identity.walletAddress,
        accepted:current,
        acceptedAt:current?consent.accepted_at:null,
        lastRevokedAt:consent?.revoked_at||null
    };
}
async function getStatus(client,userId){
    const document=await activeDocument(client);
    const result=await client.query('SELECT id,web3_wallet_address FROM users WHERE id=$1',[userId]);
    if(result.rowCount!==1)throw failure('No se encontró la cuenta.',404,'USER_NOT_FOUND');
    const identity={userId,walletAddress:canonicalWallet(result.rows[0].web3_wallet_address)};
    return statusFor(document,identity,await latestConsent(client,userId));
}
async function accept(client,userId,payload,req){
    await client.query('BEGIN');
    try{
        const identity=await lockedIdentity(client,userId);
        const document=await activeDocument(client);
        if(String(payload?.version||'')!==document.version||String(payload?.contentHash||'')!==document.content_hash)
            throw failure('El texto cambió. Revísalo y vuelve a aceptar.',409,'CONSENT_DOCUMENT_CHANGED');
        if(canonicalWallet(payload?.walletAddress)!==identity.walletAddress)
            throw failure('La billetera cambió. Revisa nuevamente la autorización.',409,'CONSENT_WALLET_CHANGED');
        const previous=await latestConsent(client,userId);
        const current=statusFor(document,identity,previous);
        if(current.accepted){await client.query('COMMIT');return current;}
        await client.query('UPDATE exchange_collateral_consents SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=$1 AND revoked_at IS NULL',[userId]);
        const evidence=requestEvidence(req);
        await client.query(
            `INSERT INTO exchange_collateral_consents
             (user_id,wallet_address,document_type,document_version,document_hash,acceptance_ip,acceptance_user_agent)
             VALUES($1,$2,$3,$4,$5,$6,$7)`,
            [userId,identity.walletAddress,document.type,document.version,document.content_hash,evidence.ip,evidence.userAgent]
        );
        const result=statusFor(document,identity,await latestConsent(client,userId));
        await client.query('COMMIT');
        return result;
    }catch(error){await client.query('ROLLBACK');throw error;}
}
async function revoke(client,userId,req){
    await client.query('BEGIN');
    try{
        await lockedIdentity(client,userId);
        const evidence=requestEvidence(req);
        const result=await client.query(
            `UPDATE exchange_collateral_consents
             SET revoked_at=NOW(),revocation_ip=$2,revocation_user_agent=$3
             WHERE user_id=$1 AND revoked_at IS NULL RETURNING revoked_at`,
            [userId,evidence.ip,evidence.userAgent]
        );
        await client.query('COMMIT');
        return {accepted:false,revokedAt:result.rows[0]?.revoked_at||null};
    }catch(error){await client.query('ROLLBACK');throw error;}
}
async function assertCurrentConsent(client,userId,walletAddress){
    const status=await getStatus(client,userId);
    if(status.walletAddress!==canonicalWallet(walletAddress)||!status.accepted)
        throw failure('Debes revisar y aceptar la autorización específica vigente antes de activar la garantía automática.',403,'AUTOMATIC_COLLATERAL_CONSENT_REQUIRED');
    return status;
}

module.exports={DOCUMENT_TYPE,getStatus,accept,revoke,assertCurrentConsent,canonicalWallet,statusFor};
