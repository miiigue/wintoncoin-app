'use strict';

const {createHash}=require('crypto');
const consent=require('../src/services/exchangeCollateralConsent');
const migration=require('../migrations/126_exchange_collateral_consent');

const wallet='0x1111111111111111111111111111111111111111';
const document={
    type:consent.DOCUMENT_TYPE,
    version:'1.0-2026-10-27',
    content:'texto vigente',
    content_hash:createHash('sha256').update('texto vigente').digest('hex'),
    created_at:new Date('2026-10-27T12:00:00Z')
};

function clientWith(latest){
    return {query:jest.fn(async(sql)=>{
        if(sql.includes('exchange_collateral_consent_documents'))return {rowCount:1,rows:[document]};
        if(sql.includes('SELECT id,web3_wallet_address FROM users'))return {rowCount:1,rows:[{id:7,web3_wallet_address:wallet}]};
        if(sql.includes('FROM exchange_collateral_consents'))return {rowCount:latest?1:0,rows:latest?[latest]:[]};
        throw new Error('Consulta inesperada en prueba: '+sql);
    })};
}

describe('consentimiento específico de garantía automática',()=>{
    test('la versión publicada conserva un hash reproducible y no se mezcla con los términos generales',()=>{
        expect(migration.DOCUMENT_HASH).toBe(createHash('sha256').update(migration.DOCUMENT_CONTENT,'utf8').digest('hex'));
        expect(migration.DOCUMENT_CONTENT).toContain('No autorizo un monto fijo ni ilimitado');
        expect(migration.DOCUMENT_CONTENT).toContain('500 puntos básicos, 5 %');
        expect(migration.DOCUMENT_CONTENT).toContain('cualquier tercero (keeper)');
        expect(migration.DOCUMENT_CONTENT).toContain('Argentina o Venezuela');
    });

    test('solo considera vigente la aceptación de la versión, hash y billetera actuales',async()=>{
        const latest={
            id:1,wallet_address:wallet,document_type:document.type,
            document_version:document.version,document_hash:document.content_hash,
            accepted_at:new Date('2026-10-27T13:00:00Z'),revoked_at:null
        };
        await expect(consent.getStatus(clientWith(latest),7)).resolves.toMatchObject({accepted:true,walletAddress:wallet});
        await expect(consent.assertCurrentConsent(clientWith(latest),7,wallet)).resolves.toMatchObject({accepted:true});
    });

    test.each([
        ['revocada',{revoked_at:new Date('2026-10-27T14:00:00Z')}],
        ['versión anterior',{document_version:'0.9'}],
        ['hash anterior',{document_hash:'0'.repeat(64)}],
        ['otra billetera',{wallet_address:'0x2222222222222222222222222222222222222222'}]
    ])('rechaza una aceptación %s',async(_label,change)=>{
        const latest={
            id:1,wallet_address:wallet,document_type:document.type,
            document_version:document.version,document_hash:document.content_hash,
            accepted_at:new Date('2026-10-27T13:00:00Z'),revoked_at:null,...change
        };
        await expect(consent.assertCurrentConsent(clientWith(latest),7,wallet)).rejects.toMatchObject({
            status:403,code:'AUTOMATIC_COLLATERAL_CONSENT_REQUIRED'
        });
    });
});
