'use strict';
const {createHmac, randomUUID}=require('crypto');
const fail=(message,status=409)=>Object.assign(new Error(message),{status});

// A document identifies evidence, never the person. Numbers may repeat between
// issuers and change on renewal. No document number or biometric goes on-chain.
function documentReference({country,type,number},key) {
    if(typeof key!=='string'||key.length<32)throw fail('Falta configurar la protección de identidad.',503);
    if(typeof country!=='string'||!/^[A-Z]{2}$/.test(country))throw fail('País emisor inválido.',400);
    if(!['national_id','passport','residence_permit'].includes(type))throw fail('Tipo de documento inválido.',400);
    if(typeof number!=='string')throw fail('Número de documento inválido.',400);
    const normalized=number.normalize('NFKC').trim().toUpperCase().replace(/[\s-]/g,'');
    if(!/^[A-Z0-9]{3,40}$/.test(normalized))throw fail('Número de documento inválido.',400);
    return createHmac('sha256',key).update(JSON.stringify(['winton-document-v1',country,type,normalized])).digest('hex');
}
async function ensureIdentity(client,userId) {
    // Caller holds a transaction; the unique user constraint handles concurrency.
    await client.query('INSERT INTO account_identities(id,user_id) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING',[randomUUID(),userId]);
    return (await client.query('SELECT * FROM account_identities WHERE user_id=$1 FOR UPDATE',[userId])).rows[0];
}
async function attachReviewedDocument(client,{userId,reviewerId,country,type,number,evidenceReference},key) {
    if(!Number.isInteger(reviewerId)||reviewerId<1)throw fail('Se requiere revisión administrativa.',403);
    if(typeof evidenceReference!=='string'||evidenceReference.length<8||evidenceReference.length>200)throw fail('Falta la referencia de la verificación.',400);
    const fingerprint=documentReference({country,type,number},key);
    const identity=await ensureIdentity(client,userId);
    const existing=await client.query('SELECT identity_id FROM identity_documents WHERE document_fingerprint=$1',[fingerprint]);
    if(existing.rows[0]&&existing.rows[0].identity_id!==identity.id)
        throw fail('Este documento requiere revisar una identidad existente. No se ha creado otra cuenta.');
    // Unique fingerprint closes races; do not expose another user's identity.
    await client.query(`INSERT INTO identity_documents(identity_id,issuer_country,document_type,document_fingerprint,evidence_reference,reviewer_id)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(document_fingerprint) DO NOTHING`,[identity.id,country,type,fingerprint,evidenceReference,reviewerId]);
    const owner=(await client.query('SELECT identity_id FROM identity_documents WHERE document_fingerprint=$1',[fingerprint])).rows[0];
    if(owner.identity_id!==identity.id)throw fail('Documento pendiente de revisión de identidad.');
    await client.query('INSERT INTO account_security_events(identity_id,event_type,actor_id,details) VALUES($1,$2,$3,$4)',
        [identity.id,'document_reviewed',String(reviewerId),JSON.stringify({country,type,evidenceReference})]);
    return {identityId:identity.id};
}
module.exports={documentReference,ensureIdentity,attachReviewedDocument};
