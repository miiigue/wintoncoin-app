'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * MIGRACIÓN 109: Arquitectura de Persistencia y Gobernanza Web3 Suite V4 (On-Chain First)
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * Estándar FinTech, Integridad Bancaria SOC 2 y Ciberseguridad Zero-Trust:
 * 
 * 1. Principio Arquitectónico (On-Chain First):
 *    - La Blockchain de Optimism es la fuente primaria e inmutable de la verdad.
 *    - PostgreSQL actúa como registro de alta velocidad, bitácora de auditoría y espejo.
 * 
 * 2. Nuevas Estructuras:
 *    - 'web3_contract_deployments': Directorio institucional de direcciones de contratos V4.
 *    - 'web3_governance_actions': Bitácora inmutable (Append-Only) de calibraciones de admin.
 *    - 'web3_red_commitment_lots': Espejo de lotes de compromiso RED a 30 días de vencimiento.
 *    - 'web3_fifo_exchange_orders': Espejo de órdenes en cola activa del FifoExchange.
 *    - 'web3_wallets_sync': Ajustado a precisión nativa de 6 decimales para colateral y límites.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

exports.up = async (client) => {
    console.log('[MIGRATION 109] 🚀 Iniciando migración de Arquitectura Web3 Suite V4...');

    // ========================================================================
    // 1. TABLA: web3_contract_deployments (Directorio Institucional de Contratos)
    // ========================================================================
    await client.query(`
        CREATE TABLE IF NOT EXISTS web3_contract_deployments (
            id SERIAL PRIMARY KEY,
            network VARCHAR(50) NOT NULL,
            chain_id VARCHAR(50) NOT NULL,
            contract_name VARCHAR(100) NOT NULL,
            contract_address VARCHAR(255) NOT NULL,
            deployer_address VARCHAR(255),
            relayer_address VARCHAR(255),
            abi_version VARCHAR(50) DEFAULT 'V4.0.0',
            is_active BOOLEAN DEFAULT TRUE,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Índice único parcial: Solo un contrato activo por nombre y red a la vez
    await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_active_contract_network 
        ON web3_contract_deployments(network, contract_name) 
        WHERE is_active = TRUE;
    `);

    console.log('[MIGRATION 109] ✅ Tabla web3_contract_deployments e índices creados.');

    // ========================================================================
    // 2. TABLA: web3_governance_actions (Bitácora Inmutable SOC 2 de Gobernanza)
    // ========================================================================
    await client.query(`
        CREATE TABLE IF NOT EXISTS web3_governance_actions (
            id SERIAL PRIMARY KEY,
            action_type VARCHAR(100) NOT NULL,
            target_contract_address VARCHAR(255) NOT NULL,
            affected_wallet_address VARCHAR(255),
            parameter_name VARCHAR(100) NOT NULL,
            old_value TEXT,
            new_value TEXT NOT NULL,
            tx_hash VARCHAR(255),
            performed_by VARCHAR(100) NOT NULL,
            execution_status VARCHAR(50) DEFAULT 'confirmed',
            audit_metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_gov_actions_type 
        ON web3_governance_actions(action_type);
    `);
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_gov_actions_wallet 
        ON web3_governance_actions(affected_wallet_address);
    `);
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_gov_actions_tx 
        ON web3_governance_actions(tx_hash);
    `);

    // Trigger de Inmutabilidad Bancaria SOC 2 (Append-Only)
    await client.query(`
        CREATE OR REPLACE FUNCTION prevent_web3_governance_tampering()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'SOC 2 SECURITY VIOLATION: Las acciones de gobernanza Web3 son inmutables. Prohibido UPDATE y DELETE.';
        END;
        $$ LANGUAGE plpgsql;
    `);

    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_web3_gov_immutability'
            ) THEN
                CREATE TRIGGER trg_enforce_web3_gov_immutability
                BEFORE UPDATE OR DELETE ON web3_governance_actions
                FOR EACH ROW EXECUTE FUNCTION prevent_web3_governance_tampering();
            END IF;
        END $$;
    `);

    console.log('[MIGRATION 109] ✅ Tabla web3_governance_actions y trigger SOC 2 configurados.');

    // ========================================================================
    // 3. TABLA: web3_red_commitment_lots (Espejo de Lotes de Compromiso RED a 30d)
    // ========================================================================
    await client.query(`
        CREATE TABLE IF NOT EXISTS web3_red_commitment_lots (
            id SERIAL PRIMARY KEY,
            onchain_lot_id BIGINT NOT NULL,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            wallet_address VARCHAR(255) NOT NULL,
            original_amount NUMERIC(20, 6) NOT NULL,
            remaining_amount NUMERIC(20, 6) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            due_at TIMESTAMPTZ NOT NULL,
            repaid BOOLEAN NOT NULL DEFAULT FALSE,
            tx_hash VARCHAR(255),
            repaid_at TIMESTAMPTZ,
            repayment_method VARCHAR(50),
            synced_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_lot_wallet_onchain UNIQUE (wallet_address, onchain_lot_id)
        );
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_red_lots_wallet_due 
        ON web3_red_commitment_lots(wallet_address, repaid, due_at);
    `);

    console.log('[MIGRATION 109] ✅ Tabla web3_red_commitment_lots creada.');

    // ========================================================================
    // 4. TABLA: web3_fifo_exchange_orders (Espejo de Órdenes del FifoExchange)
    // ========================================================================
    await client.query(`
        CREATE TABLE IF NOT EXISTS web3_fifo_exchange_orders (
            id SERIAL PRIMARY KEY,
            onchain_order_id BIGINT NOT NULL,
            sequence_id BIGINT,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            wallet_address VARCHAR(255) NOT NULL,
            side VARCHAR(20) NOT NULL CHECK (side IN ('SELL_BLUE', 'BUY_BLUE')),
            original_amount NUMERIC(20, 6) NOT NULL,
            remaining_amount NUMERIC(20, 6) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED')),
            tx_hash VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_exchange_order_side UNIQUE (onchain_order_id, side)
        );
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_fifo_orders_status 
        ON web3_fifo_exchange_orders(status, side, sequence_id);
    `);

    console.log('[MIGRATION 109] ✅ Tabla web3_fifo_exchange_orders creada.');

    // ========================================================================
    // 5. ACTUALIZACIÓN: web3_wallets_sync (Precisión de 6 Decimales y Solvencia)
    // ========================================================================
    await client.query(`
        ALTER TABLE web3_wallets_sync 
        ALTER COLUMN onchain_blue_balance TYPE NUMERIC(20, 6),
        ALTER COLUMN onchain_red_debt TYPE NUMERIC(20, 6);
    `).catch(() => {
        // En caso de que la tabla sea nueva o ya tenga el tipo
    });

    await client.query(`
        ALTER TABLE web3_wallets_sync 
        ADD COLUMN IF NOT EXISTS onchain_vault_collateral NUMERIC(20, 6) DEFAULT 0.000000,
        ADD COLUMN IF NOT EXISTS onchain_free_collateral NUMERIC(20, 6) DEFAULT 0.000000,
        ADD COLUMN IF NOT EXISTS onchain_credit_capacity NUMERIC(20, 6) DEFAULT 0.000000,
        ADD COLUMN IF NOT EXISTS is_delinquent BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_kyc_verified BOOLEAN DEFAULT FALSE;
    `);

    console.log('[MIGRATION 109] ✅ Tabla web3_wallets_sync actualizada con 6 decimales y métricas de bóveda.');

    // ========================================================================
    // 6. AUTO-POBLADO INICIAL IDEMPOTENTE DESDE EL MANIFIESTO V4
    // ========================================================================
    try {
        const manifestPath = path.resolve(__dirname, '../../web3-contracts/deployment-manifest-v4.json');
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const network = manifest.network || 'hardhat';
            const chainId = manifest.chainId || '1337';
            const deployer = manifest.deployer;
            const relayer = manifest.relayer;

            if (manifest.contracts) {
                for (const [contractName, contractAddress] of Object.entries(manifest.contracts)) {
                    await client.query(`
                        INSERT INTO web3_contract_deployments (
                            network, chain_id, contract_name, contract_address, deployer_address, relayer_address, is_active
                        ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                        ON CONFLICT (network, contract_name) WHERE is_active = TRUE
                        DO UPDATE SET 
                            contract_address = EXCLUDED.contract_address,
                            deployer_address = EXCLUDED.deployer_address,
                            relayer_address = EXCLUDED.relayer_address,
                            updated_at = CURRENT_TIMESTAMP;
                    `, [network, chainId, contractName, contractAddress, deployer, relayer]);
                }
                console.log(`[MIGRATION 109] 📦 Manifiesto de despliegue V4 (${network}) registrado en PostgreSQL.`);
            }
        }
    } catch (manifestErr) {
        console.warn('[MIGRATION 109] Nota sobre manifiesto:', manifestErr.message);
    }

    console.log('[MIGRATION 109] 🎯 Migración 109 completada con éxito total.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 109] Revirtiendo estructuras Web3 Suite V4...');
    await client.query('DROP TRIGGER IF EXISTS trg_enforce_web3_gov_immutability ON web3_governance_actions');
    await client.query('DROP FUNCTION IF EXISTS prevent_web3_governance_tampering()');
    await client.query('DROP TABLE IF EXISTS web3_fifo_exchange_orders');
    await client.query('DROP TABLE IF EXISTS web3_red_commitment_lots');
    await client.query('DROP TABLE IF EXISTS web3_governance_actions');
    await client.query('DROP TABLE IF EXISTS web3_contract_deployments');
    console.log('[MIGRATION 109] Rollback completado.');
};
