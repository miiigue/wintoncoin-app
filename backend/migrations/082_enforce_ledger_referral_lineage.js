// backend/migrations/082_enforce_ledger_referral_lineage.js

exports.up = async (client) => {
    console.log('[MIGRATION 082] Iniciando migración de Data Lineage para Referidos (AML)...');

    // 1. Agregar columna reference_user_id a booster_blue_ledger si no existe
    console.log('[MIGRATION 082] DDL: Añadiendo columna reference_user_id a booster_blue_ledger...');
    await client.query(`
        ALTER TABLE booster_blue_ledger 
        ADD COLUMN IF NOT EXISTS reference_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);

    // 2. Recrear la función SQL record_booster_event para aceptar el quinto parámetro (reference_user_id)
    // Se añade un valor por defecto (NULL) para mantener retrocompatibilidad con inserciones que usen 4 parámetros temporales.
    console.log('[MIGRATION 082] DDL: Actualizando función record_booster_event para incluir reference_user_id...');
    await client.query(`
        CREATE OR REPLACE FUNCTION record_booster_event(
            p_user_id INTEGER,
            p_type TEXT,
            p_amount NUMERIC,
            p_publication_id INTEGER DEFAULT NULL,
            p_reference_user_id INTEGER DEFAULT NULL
        )
        RETURNS VOID
        LANGUAGE plpgsql
        AS $$
        BEGIN
            INSERT INTO booster_blue_ledger (user_id, amount, source_publication_id, type, reference_user_id)
            VALUES (p_user_id, p_amount, p_publication_id, p_type, p_reference_user_id);
        END;
        $$;
    `);

    // 3. Data Forensics (DML): Vincular los registros antiguos de referral_reward a sus referidos
    // Basado en el campo description de la tabla transactions que tiene la huella: "Recompensa (perfil impulsor) por referir a [username]"
    console.log('[MIGRATION 082] DML: Ejecutando auditoría forense para reconstruir historial de referidos...');
    
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
        UPDATE booster_blue_ledger bbl
        SET reference_user_id = mu.referred_user_id
        FROM matched_users mu
        WHERE bbl.user_id = mu.referrer_id
          AND bbl.type = 'referral_reward'
          AND bbl.amount = mu.amount
          AND bbl.reference_user_id IS NULL
          AND ABS(EXTRACT(EPOCH FROM (bbl.created_at - mu.created_at))) < 60;
    `);

    console.log(\`[MIGRATION 082] ✅ DML: Se vincularon exitosamente \${result.rowCount} registros históricos de referidos.\`);
    console.log('[MIGRATION 082] Migración de Data Lineage completada.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 082] Revirtiendo cambios de Data Lineage...');
    
    // Restaurar función anterior (4 parámetros)
    await client.query(`
        CREATE OR REPLACE FUNCTION record_booster_event(
            p_user_id INTEGER,
            p_type TEXT,
            p_amount NUMERIC,
            p_publication_id INTEGER
        )
        RETURNS VOID
        LANGUAGE plpgsql
        AS $$
        BEGIN
            INSERT INTO booster_blue_ledger (user_id, amount, source_publication_id, type)
            VALUES (p_user_id, p_amount, p_publication_id, p_type);
        END;
        $$;
    `);

    // Eliminar columna (opcional, aunque en sistemas de auditoría es mejor no eliminar datos. Se comenta por seguridad)
    // await client.query('ALTER TABLE booster_blue_ledger DROP COLUMN IF EXISTS reference_user_id;');
    
    console.log('[MIGRATION 082] Reversión completada. (Columna reference_user_id conservada por seguridad)');
};
