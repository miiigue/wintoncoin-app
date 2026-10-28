'use strict';

const {createHash}=require('crypto');

const DOCUMENT_TYPE='automatic_exchange_collateral_authorization';
const DOCUMENT_VERSION='1.0-2026-10-27';
const DOCUMENT_CONTENT=`AUTORIZACIÓN ESPECÍFICA DE GARANTÍA AUTOMÁTICA CON USDT DEL EXCHANGE

1. Alcance. Autorizo que, cuando existan compromisos RED vencidos, el contrato intente quemar primero los BLUE disponibles conforme al protocolo y, únicamente por el faltante vencido, bloquee USDT de mis órdenes de compra BLUE activas en el Exchange FIFO. Esta autorización no mueve el mismo USDT dos veces ni lo convierte inmediatamente en BLUE.

2. Monto. No autorizo un monto fijo ni ilimitado. En cada ejecución solo podrá afectarse el importe necesario para cubrir el compromiso RED vencido que permanezca después de aplicar BLUE, limitado por el USDT todavía libre de mis órdenes elegibles y por las comprobaciones del contrato. El importe efectivamente bloqueado queda registrado on-chain.

3. Comisión y liquidez. El presupuesto de USDT puede incluir la comisión del Exchange vigente cuando se produzca cada match (el contrato limita esa comisión a 500 puntos básicos, 5 %). La tasa nominal 1 BLUE por 1 USDT no garantiza liquidez, precio de mercado ni ejecución inmediata. El USDT bloqueado no puede retirarse mientras espera adquirir BLUE y amortizar RED.

4. Keeper y ejecución. La llamada de mantenimiento puede enviarla cualquier tercero (keeper); el contrato, no el keeper, limita el importe, exige órdenes FIFO y verifica el vencimiento y los estados aplicables. La autorización no garantiza que un keeper actúe, ni un plazo, patrocinio de gas o resultado económico.

5. Revocación prospectiva. Puedo revocar para futuras afectaciones desactivando primero la autorización on-chain. La revocación no libera garantías ya bloqueadas, no cancela compromisos RED, órdenes o matches previos y no revierte operaciones confirmadas.

6. Riesgos y jurisdicción. La interfaz identifica a WTN Solutions LLC como entidad de Wyoming, Estados Unidos. Esta elección no elimina normas imperativas, derechos de consumidores o protección de datos que puedan corresponder según mi residencia o lugar de uso, incluidos Argentina o Venezuela. La función usa contratos en blockchain, puede implicar riesgo tecnológico, de liquidez, comisión, red y regulación. Esta aceptación no constituye asesoría legal, certificación de cumplimiento, depósito bancario ni promesa de rentabilidad.`;
const DOCUMENT_HASH=createHash('sha256').update(DOCUMENT_CONTENT,'utf8').digest('hex');

async function up(client){
    await client.query(`
        CREATE TABLE IF NOT EXISTS exchange_collateral_consent_documents (
            id SERIAL PRIMARY KEY,
            type VARCHAR(50) NOT NULL,
            version VARCHAR(32) NOT NULL,
            content TEXT NOT NULL,
            content_hash VARCHAR(64) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(type,version),
            CHECK (content_hash ~ '^[0-9a-f]{64}$')
        );

        CREATE TABLE IF NOT EXISTS exchange_collateral_consents (
            id BIGSERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            wallet_address VARCHAR(42) NOT NULL,
            document_type VARCHAR(50) NOT NULL,
            document_version VARCHAR(32) NOT NULL,
            document_hash VARCHAR(64) NOT NULL,
            accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            revoked_at TIMESTAMPTZ,
            acceptance_ip VARCHAR(45),
            acceptance_user_agent TEXT,
            revocation_ip VARCHAR(45),
            revocation_user_agent TEXT,
            CHECK (wallet_address ~ '^0x[0-9a-f]{40}$'),
            CHECK (document_hash ~ '^[0-9a-f]{64}$'),
            CHECK (revoked_at IS NULL OR revoked_at >= accepted_at)
        )
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_exchange_collateral_consent_document_active
        ON exchange_collateral_consent_documents(type) WHERE is_active=TRUE`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_exchange_collateral_consents_user_history
        ON exchange_collateral_consents(user_id, accepted_at DESC)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_exchange_collateral_consent_current
        ON exchange_collateral_consents(user_id) WHERE revoked_at IS NULL`);

    const existing=await client.query(
        'SELECT content, content_hash FROM exchange_collateral_consent_documents WHERE type=$1 AND version=$2',
        [DOCUMENT_TYPE,DOCUMENT_VERSION]
    );
    if(existing.rowCount>0) {
        const row=existing.rows[0];
        if(row.content!==DOCUMENT_CONTENT||row.content_hash!==DOCUMENT_HASH) {
            throw new Error('El documento legal versionado ya existe con contenido diferente.');
        }
    } else {
        await client.query(
            `INSERT INTO exchange_collateral_consent_documents(type,version,content,content_hash,is_active)
             VALUES($1,$2,$3,$4,TRUE)`,
            [DOCUMENT_TYPE,DOCUMENT_VERSION,DOCUMENT_CONTENT,DOCUMENT_HASH]
        );
    }
    await client.query('UPDATE exchange_collateral_consent_documents SET is_active=(version=$2) WHERE type=$1',[DOCUMENT_TYPE,DOCUMENT_VERSION]);
}

module.exports={up,DOCUMENT_TYPE,DOCUMENT_VERSION,DOCUMENT_CONTENT,DOCUMENT_HASH};
