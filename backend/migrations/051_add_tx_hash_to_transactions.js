/**
 * backend/migrations/051_add_tx_hash_to_transactions.js
 * 
 * PROPÓSITO: Añadir la columna tx_hash a la tabla de transacciones para 
 * almacenar y mostrar el hash de las operaciones registradas en la blockchain.
 */

exports.up = async (client) => {
    console.log('[MIGRATION 051] Añadiendo columna tx_hash a tabla transactions...');

    await client.query(`
        ALTER TABLE transactions 
        ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(66)
    `);
    
    console.log('[MIGRATION 051] Columna tx_hash añadida exitosamente.');
};

exports.down = async (client) => {
    await client.query(`
        ALTER TABLE transactions 
        DROP COLUMN IF EXISTS tx_hash
    `);
};
