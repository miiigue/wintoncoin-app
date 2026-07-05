// backend/migrations/084_reapply_ledger_referral_lineage.js

exports.up = async (client) => {
    console.log('[MIGRATION 084] Iniciando migración correctiva de Data Lineage para referidos históricos (referral_bonus_sent)...');

    // Desactivar temporalmente el trigger de inmutabilidad para permitir la auditoría forense
    await client.query('ALTER TABLE booster_blue_ledger DISABLE TRIGGER trg_prevent_mutation_booster_blue_ledger;');

    console.log('[MIGRATION 084] DML: Ejecutando auditoría forense para vincular registros de tipo referral_bonus_sent...');
    const result = await client.query(`
        WITH target_transactions AS (
            -- Extraemos el username del texto descriptivo de las transacciones
            SELECT 
                t.user_id as referrer_id,
                t.created_at,
                SUBSTRING(t.description FROM 'por referir a (.+)$') as referred_username,
                t.blue_change as amount
            FROM transactions t
            WHERE t.type = 'referral_bonus'
            AND t.description LIKE 'Recompensa (perfil impulsor) por referir a %'
        ),
        matched_users AS (
            -- Buscamos el ID real de ese usuario referido
            SELECT 
                tt.referrer_id,
                tt.created_at,
                tt.amount,
                u.id as referred_user_id
            FROM target_transactions tt
            JOIN users u ON u.username = tt.referred_username
        )
        -- Actualizamos el ledger buscando el registro más cercano (dentro de un minuto) con el mismo monto
        -- y que tenga como tipo 'referral_reward' o 'referral_bonus_sent'
        UPDATE booster_blue_ledger bbl
        SET reference_user_id = mu.referred_user_id
        FROM matched_users mu
        WHERE bbl.user_id = mu.referrer_id
          AND bbl.type IN ('referral_reward', 'referral_bonus_sent')
          AND bbl.amount = mu.amount
          AND bbl.reference_user_id IS NULL
          AND ABS(EXTRACT(EPOCH FROM (bbl.created_at - mu.created_at))) < 60;
    `);

    // Reactivar el blindaje de inmutabilidad inmediatamente después de la corrección
    await client.query('ALTER TABLE booster_blue_ledger ENABLE TRIGGER trg_prevent_mutation_booster_blue_ledger;');

    console.log(`[MIGRATION 084] ✅ DML: Se vincularon exitosamente ${result.rowCount} registros históricos adicionales.`);
    console.log('[MIGRATION 084] Migración correctiva de Data Lineage completada.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 084] Deshaciendo migración correctiva de Data Lineage...');
    
    await client.query('ALTER TABLE booster_blue_ledger DISABLE TRIGGER trg_prevent_mutation_booster_blue_ledger;');
    
    await client.query(`
        UPDATE booster_blue_ledger 
        SET reference_user_id = NULL 
        WHERE type = 'referral_bonus_sent';
    `);
    
    await client.query('ALTER TABLE booster_blue_ledger ENABLE TRIGGER trg_prevent_mutation_booster_blue_ledger;');
    
    console.log('[MIGRATION 084] ✅ Rollback de la migración correctiva completado.');
};
