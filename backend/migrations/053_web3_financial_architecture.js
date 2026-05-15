/**
 * backend/migrations/053_web3_financial_architecture.js
 * 
 * PROPÓSITO: Establecer la arquitectura de base de datos definitiva para la 
 * economía Web3 real (On-Chain) separada del modo pre-lanzamiento (BLUE IOU).
 * 
 * CONTEXTO: 
 * 1. web3_wallets_sync: Espejo ultra rápido de los saldos en Optimism.
 * 2. web3_escrow_holds: Sistema de retención (Escrow) lógico para separar 
 *    el "poder adquisitivo" del usuario antes de que la blockchain ejecute.
 * 3. web3_pending_transactions: Red de seguridad para evitar pérdida de pagos 
 *    si el RPC de Optimism sufre timeouts.
 * 
 * ESTÁNDAR DE INGENIERÍA: Estructuras relacionales con integridad referencial 
 * e índices de rendimiento (B-Tree).
 */

exports.up = async (client) => {
    console.log('[MIGRATION 053] Iniciando creación de Arquitectura Financiera Web3...');

    // 1. Crear tabla de Sincronización de Billeteras Web3
    await client.query(`
        CREATE TABLE IF NOT EXISTS web3_wallets_sync (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            onchain_blue_balance NUMERIC(20, 2) DEFAULT 0.00,
            onchain_red_debt NUMERIC(20, 2) DEFAULT 0.00,
            last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            sync_status VARCHAR(50) DEFAULT 'synced'
        );
    `);
    console.log('[MIGRATION 053] ✅ Tabla web3_wallets_sync creada/verificada.');

    // 2. Crear tabla del Nuevo Sistema de Escrow (Bloqueos Lógicos)
    await client.query(`
        CREATE TABLE IF NOT EXISTS web3_escrow_holds (
            id SERIAL PRIMARY KEY,
            publication_id INTEGER REFERENCES publications(id) ON DELETE CASCADE,
            author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            responsible_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            amount_locked NUMERIC(20, 2) NOT NULL,
            commission_rate_locked NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
            status VARCHAR(50) DEFAULT 'locked',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            released_at TIMESTAMP WITH TIME ZONE
        );
    `);
    console.log('[MIGRATION 053] ✅ Tabla web3_escrow_holds creada/verificada.');

    // 3. Crear tabla de Transacciones Pendientes (Anti-Timeouts)
    await client.query(`
        CREATE TABLE IF NOT EXISTS web3_pending_transactions (
            tx_hash VARCHAR(255) PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            tx_type VARCHAR(100) NOT NULL,
            payload JSONB,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP WITH TIME ZONE,
            error_reason TEXT
        );
    `);
    console.log('[MIGRATION 053] ✅ Tabla web3_pending_transactions creada/verificada.');

    // Añadir índices para mejorar el rendimiento de consultas
    await client.query(`CREATE INDEX IF NOT EXISTS idx_web3_escrow_holds_author ON web3_escrow_holds(author_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_web3_escrow_holds_responsible ON web3_escrow_holds(responsible_user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_web3_escrow_holds_publication ON web3_escrow_holds(publication_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_web3_pending_txs_status ON web3_pending_transactions(status);`);
    console.log('[MIGRATION 053] ✅ Índices de rendimiento (B-Tree) creados.');

    console.log('[MIGRATION 053] Proceso finalizado exitosamente.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 053] Revirtiendo: eliminando Arquitectura Financiera Web3...');

    await client.query('DROP TABLE IF EXISTS web3_pending_transactions CASCADE;');
    await client.query('DROP TABLE IF EXISTS web3_escrow_holds CASCADE;');
    await client.query('DROP TABLE IF EXISTS web3_wallets_sync CASCADE;');

    console.log('[MIGRATION 053] ✅ Tablas eliminadas.');
};
