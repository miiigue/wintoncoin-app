/**
 * Migración 098: Tabla de Auditoría de Depósitos de Garantía (Collateral Deposits)
 * ════════════════════════════════════════════════════════════════════════════════════
 * Estándar de Ciberseguridad & Auditoría FinTech (SOC 2 / ISO 27001 / Zero-Trust):
 * Registra inmutablemente cada depósito, retiro y liquidación de garantías (Stablecoins)
 * que los usuarios realizan en la Bóveda (WintonCollateralVault) para aumentar su
 * Límite de Compromiso RED.
 *
 * Incorpora un trigger en PostgreSQL que prohíbe operaciones UPDATE o DELETE
 * (Patrón Append-Only Bancario), garantizando que el historial nunca sea alterado.
 *
 * FORMATO: Moderno (exports.up). El migrationRunner.js inyecta el client transaccional
 * y gestiona BEGIN/COMMIT/ROLLBACK externamente. NO crear pool propio ni transacciones.
 */

exports.up = async (client) => {
    console.log('[MIGRATION 098] Iniciando creación de tabla inmutable collateral_deposits...');

    // 1. Crear tabla de auditoría de depósitos de garantía (Collateral Vault)
    // Cada fila representa una operación individual (depósito, retiro o liquidación).
    await client.query(`
        CREATE TABLE IF NOT EXISTS collateral_deposits (
            id SERIAL PRIMARY KEY,

            -- Identificación del usuario y su billetera Web3
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            wallet_address VARCHAR(255) NOT NULL,

            -- Tipo de operación: 'deposit' | 'withdraw' | 'liquidation'
            operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('deposit', 'withdraw', 'liquidation')),

            -- Token utilizado como garantía (ej. 'USDT', 'USDC', 'DAI')
            token_symbol VARCHAR(10) NOT NULL,

            -- Dirección del contrato del token ERC20 en la blockchain
            token_contract_address VARCHAR(255) NOT NULL,

            -- Monto de la operación (positivo para depósito, negativo para retiro/liquidación)
            amount NUMERIC(30, 18) NOT NULL,

            -- Saldo del usuario en la bóveda DESPUÉS de esta operación
            balance_after NUMERIC(30, 18) NOT NULL DEFAULT 0,

            -- Hash de la transacción en la blockchain (prueba criptográfica de la operación)
            tx_hash VARCHAR(255),

            -- En caso de liquidación: la deuda RED del usuario al momento de la confiscación
            debt_at_liquidation NUMERIC(15, 4) DEFAULT 0,

            -- Dirección de la tesorería receptora (solo aplica en liquidaciones)
            treasury_address VARCHAR(255),

            -- Metadatos adicionales para auditoría (JSON con contexto de la operación)
            audit_metadata JSONB,

            -- Marca temporal inmutable de la operación
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 2. Crear índices para consultas frecuentes del backend (creditScoringService.js)
    // Índice compuesto para buscar el saldo actual de un usuario rápidamente
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_collateral_deposits_user_id 
        ON collateral_deposits(user_id);
    `);

    // Índice para auditoría por tipo de operación
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_collateral_deposits_operation 
        ON collateral_deposits(operation_type);
    `);

    // Índice para búsqueda por hash de transacción (verificación blockchain)
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_collateral_deposits_tx_hash 
        ON collateral_deposits(tx_hash);
    `);

    // 3. Crear función Trigger de inmutabilidad (Prohíbe UPDATE y DELETE - Patrón SOC 2)
    // Esto garantiza que NADIE (ni siquiera un administrador con acceso directo a la DB)
    // pueda alterar o borrar registros históricos de depósitos/retiros de garantía.
    await client.query(`
        CREATE OR REPLACE FUNCTION prevent_collateral_deposits_tampering()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'SOC 2 SECURITY VIOLATION: Los registros de depósitos de garantía son inmutables. No se permite UPDATE ni DELETE.';
        END;
        $$ LANGUAGE plpgsql;
    `);

    // 4. Vincular Trigger a la tabla collateral_deposits si no existe
    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_collateral_deposits_immutability'
            ) THEN
                CREATE TRIGGER trg_enforce_collateral_deposits_immutability
                BEFORE UPDATE OR DELETE ON collateral_deposits
                FOR EACH ROW EXECUTE FUNCTION prevent_collateral_deposits_tampering();
            END IF;
        END $$;
    `);

    console.log('[MIGRATION 098] ✅ Tabla inmutable collateral_deposits, índices y trigger SOC 2 creados exitosamente.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 098] Revirtiendo: Eliminando tabla collateral_deposits y trigger...');
    await client.query('DROP TRIGGER IF EXISTS trg_enforce_collateral_deposits_immutability ON collateral_deposits');
    await client.query('DROP FUNCTION IF EXISTS prevent_collateral_deposits_tampering()');
    await client.query('DROP INDEX IF EXISTS idx_collateral_deposits_tx_hash');
    await client.query('DROP INDEX IF EXISTS idx_collateral_deposits_operation');
    await client.query('DROP INDEX IF EXISTS idx_collateral_deposits_user_id');
    await client.query('DROP TABLE IF EXISTS collateral_deposits');
    console.log('[MIGRATION 098] Rollback completado.');
};
