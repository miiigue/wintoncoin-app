/**
 * backend/migrations/054_web3_pending_transactions_outbox.js
 * 
 * PROPÓSITO: Ajustar la tabla web3_pending_transactions para soportar
 * el patrón Outbox (Safety Net / Red de Seguridad).
 * 
 * CONTEXTO:
 * La tabla original usa tx_hash como PRIMARY KEY, pero al momento de
 * crear el registro de intención (antes de llamar a la blockchain)
 * aún no tenemos el tx_hash. Este ajuste añade un SERIAL id como PK
 * y convierte tx_hash en un campo actualizable post-confirmación.
 * 
 * ESTÁNDAR: Outbox Pattern (Microservices Saga) — usado por Stripe,
 * Square y Coinbase para garantizar consistencia entre DB y sistemas
 * externos (blockchain, pasarelas de pago).
 */

exports.up = async (client) => {
    console.log('[MIGRATION 054] Ajustando web3_pending_transactions para Outbox Pattern...');

    // Verificar si la tabla tiene tx_hash como PK (esquema original de 053).
    const pkCheck = await client.query(`
        SELECT column_name FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'web3_pending_transactions' AND tc.constraint_type = 'PRIMARY KEY'
    `);

    // Si la PK actual es tx_hash, necesitamos reestructurar.
    if (pkCheck.rows.length > 0 && pkCheck.rows[0].column_name === 'tx_hash') {
        // 1. Eliminar la PK existente (tx_hash).
        await client.query(`
            ALTER TABLE web3_pending_transactions DROP CONSTRAINT web3_pending_transactions_pkey
        `);

        // 2. Añadir columna id SERIAL como nueva PK.
        await client.query(`
            ALTER TABLE web3_pending_transactions ADD COLUMN id SERIAL PRIMARY KEY
        `);

        // 3. Hacer tx_hash nullable (se llena después de la confirmación blockchain).
        await client.query(`
            ALTER TABLE web3_pending_transactions ALTER COLUMN tx_hash DROP NOT NULL
        `);

        // 4. Añadir índice único en tx_hash para cuando se actualice (evitar duplicados).
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_web3_pending_txs_hash ON web3_pending_transactions(tx_hash)
            WHERE tx_hash IS NOT NULL
        `);

        console.log('[MIGRATION 054] ✅ Tabla reestructurada: id SERIAL como PK, tx_hash nullable.');
    } else {
        console.log('[MIGRATION 054] ⏩ Tabla ya tiene la estructura correcta. Nada que hacer.');
    }

    // Añadir columna intent_id para identificar la intención antes del tx_hash.
    await client.query(`
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'web3_pending_transactions' AND column_name = 'intent_id'
            ) THEN
                ALTER TABLE web3_pending_transactions ADD COLUMN intent_id UUID DEFAULT gen_random_uuid();
            END IF;
        END $$;
    `);

    // Índice para búsquedas rápidas por intent_id (usado por reconciliación).
    await client.query(`CREATE INDEX IF NOT EXISTS idx_web3_pending_txs_intent ON web3_pending_transactions(intent_id)`);

    console.log('[MIGRATION 054] ✅ Columna intent_id añadida con índice.');
    console.log('[MIGRATION 054] Proceso finalizado exitosamente.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 054] Revirtiendo ajustes de Outbox Pattern...');
    await client.query(`ALTER TABLE web3_pending_transactions DROP COLUMN IF EXISTS intent_id`);
    await client.query(`DROP INDEX IF EXISTS idx_web3_pending_txs_intent`);
    console.log('[MIGRATION 054] ✅ Revertido.');
};
