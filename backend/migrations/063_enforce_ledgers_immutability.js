/**
 * backend/migrations/063_enforce_ledgers_immutability.js
 * 
 * PROPÓSITO: Blindaje físico de inmutabilidad (Capa 2 del modelo de Defensa en Tres Capas)
 * para los libros mayores (ledgers) y bitácoras contables críticas de la plataforma.
 * 
 * TABLAS AFECTADAS:
 * - booster_payment_log (historial de liquidación de recompensas a impulsores)
 * - platform_wallet_log (libro mayor de la billetera de la plataforma)
 * - booster_blue_ledger (libro mayor de saldos off-chain de impulsores)
 * - platform_commission_log (registro de comisiones recibidas por la plataforma)
 * 
 * COMPLIANCE: Normas de auditoría bancaria e inalterabilidad de registros (SOC 2, FinCEN).
 */

'use strict';

exports.up = async (client) => {
    console.log('[MIGRATION 063] Creando función de prevención de mutaciones contables...');

    // 1. Crear la función trigger centralizada que aborta cualquier UPDATE o DELETE
    await client.query(`
        CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'Operación no permitida: La tabla % es inmutable y de solo lectura (Append-Only).', TG_TABLE_NAME;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // Definición de las tablas contables críticas que deben protegerse
    const tablesToProtect = [
        'booster_payment_log',
        'platform_wallet_log',
        'booster_blue_ledger',
        'platform_commission_log'
    ];

    console.log('[MIGRATION 063] Aplicando triggers de inmutabilidad física sobre tablas contables...');

    for (const table of tablesToProtect) {
        const triggerName = `trg_prevent_mutation_${table}`;
        
        // Dropear trigger previo si existe para asegurar idempotencia
        await client.query(`DROP TRIGGER IF EXISTS ${triggerName} ON ${table};`);
        
        // Crear el trigger BEFORE UPDATE OR DELETE
        await client.query(`
            CREATE TRIGGER ${triggerName}
            BEFORE UPDATE OR DELETE ON ${table}
            FOR EACH ROW
            EXECUTE FUNCTION prevent_ledger_mutation();
        `);
        
        console.log(`[MIGRATION 063]   -> Trigger de inmutabilidad aplicado a: ${table}`);
    }

    console.log('[MIGRATION 063] ✅ Inmutabilidad física aplicada con éxito en todos los libros contables.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 063] Revirtiendo migración: Eliminando triggers de inmutabilidad física...');

    const tablesToProtect = [
        'booster_payment_log',
        'platform_wallet_log',
        'booster_blue_ledger',
        'platform_commission_log'
    ];

    for (const table of tablesToProtect) {
        const triggerName = `trg_prevent_mutation_${table}`;
        await client.query(`DROP TRIGGER IF EXISTS ${triggerName} ON ${table};`);
        console.log(`[MIGRATION 063]   -> Trigger de inmutabilidad removido de: ${table}`);
    }

    // Eliminar la función trigger
    await client.query('DROP FUNCTION IF EXISTS prevent_ledger_mutation();');
    console.log('[MIGRATION 063] Reversión finalizada.');
};
