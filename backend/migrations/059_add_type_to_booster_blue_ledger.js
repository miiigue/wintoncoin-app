/**
 * backend/migrations/059_add_type_to_booster_blue_ledger.js
 * 
 * PROPÓSITO:
 * 1. Agregar la columna 'type' a la tabla 'booster_blue_ledger' de forma segura y robusta.
 * 2. Ejecutar una reconciliación heurística retroactiva para reconstruir el historial
 *    de transacciones de los usuarios actuales cruzando datos con 'booster_transactions'
 *    y otras tablas del sistema operativo (donaciones humanitarias, etc.).
 * 3. Establecer restricciones NOT NULL y DEFAULT sobre la columna una vez poblada.
 * 4. Recrear la función record_booster_event() para soportar de forma nativa la
 *    inserción del tipo de evento.
 * 
 * ENFOQUE DE INGENIERÍA:
 * - Evitar bloqueos de tabla prolongados desactivando temporalmente los triggers (DISABLE TRIGGER).
 * - Utilizar transacciones atómicas e idempotencia de migración para evitar estados intermedios inconsistentes.
 * - Comentarios exhaustivos línea por línea en cumplimiento de las directivas de auditoría bancaria.
 */

exports.up = async (client) => {
    console.log('[MIGRATION 059] Iniciando migración de Ledger de Impulsores...');

    // 1. Agregar la columna 'type' permitiendo temporalmente valores NULL para poder realizar el backfill de datos antiguos.
    console.log('[MIGRATION 059] DDL: Añadiendo columna nullable \'type\' a booster_blue_ledger...');
    await client.query(`
        ALTER TABLE booster_blue_ledger 
        ADD COLUMN IF NOT EXISTS type VARCHAR(50);
    `);

    // Nota: Omitimos la desactivación global de triggers (DISABLE TRIGGER ALL) porque requiere
    // privilegios de superusuario y falla en bases de datos en la nube administradas (como Render PostgreSQL)
    // al intentar desactivar triggers del sistema que controlan claves foráneas (RI_ConstraintTrigger).
    // Dado que booster_blue_ledger no posee triggers de usuario creados por nosotros, es seguro continuar sin desactivarlos.

    try {
        // 3. PASO DE RECONCILIACIÓN 1: Cruzar con booster_transactions mediante coincidencia de parámetros y fecha aproximada (15 segundos).
        // Se hace un JOIN por user_id, amount, y source_publication_id (si coinciden o ambos son NULL),
        // y se valida que la marca de tiempo de creación esté en un margen de +/- 15 segundos debido a que
        // en el backend se insertaban secuencialmente en el mismo hilo de ejecución.
        console.log('[MIGRATION 059] Backfill: Reconciliando con booster_transactions...');
        const matchResult = await client.query(`
            UPDATE booster_blue_ledger bbl
            SET type = bt.type
            FROM booster_transactions bt
            WHERE bbl.user_id = bt.user_id
              AND bbl.amount = bt.amount
              AND (
                  (bbl.source_publication_id IS NULL AND bt.related_publication_id IS NULL) OR
                  (bbl.source_publication_id = bt.related_publication_id)
              )
              AND bbl.created_at >= bt.created_at - INTERVAL '15 seconds'
              AND bbl.created_at <= bt.created_at + INTERVAL '15 seconds'
              AND bbl.type IS NULL;
        `);
        console.log(`[MIGRATION 059] Reconciliación 1 completada. Registros actualizados: ${matchResult.rowCount}`);

        // 4. PASO DE RECONCILIACIÓN 2: Heurística secundaria para debitos (amount < 0) - Donaciones Humanitarias.
        // Si hay registros negativos que no se cruzaron con booster_transactions pero corresponden a donaciones
        // registradas en humanitarian_donations, los catalogamos como 'humanitarian_donation_sent'.
        console.log('[MIGRATION 059] Backfill: Reconciliando débitos con humanitarian_donations...');
        const donationResult = await client.query(`
            UPDATE booster_blue_ledger bbl
            SET type = 'humanitarian_donation_sent'
            FROM humanitarian_donations hd
            WHERE bbl.user_id = hd.donor_id
              AND bbl.amount = -hd.amount
              AND bbl.source_publication_id = hd.publication_id
              AND bbl.type IS NULL;
        `);
        console.log(`[MIGRATION 059] Reconciliación 2 completada (Donaciones). Registros actualizados: ${donationResult.rowCount}`);

        // 5. PASO DE RECONCILIACIÓN 3: Heurística secundaria para creditos (amount > 0) con publicación asociada.
        // Si tienen una publicación de origen y es saldo positivo, asumimos por descarte que fue una recompensa de tarea.
        console.log('[MIGRATION 059] Backfill: Reconciliando créditos con publicaciones activas...');
        const taskResult = await client.query(`
            UPDATE booster_blue_ledger bbl
            SET type = 'task_reward'
            WHERE bbl.source_publication_id IS NOT NULL 
              AND bbl.amount > 0 
              AND bbl.type IS NULL;
        `);
        console.log(`[MIGRATION 059] Reconciliación 3 completada (Tareas). Registros actualizados: ${taskResult.rowCount}`);

        // 6. PASO DE RECONCILIACIÓN 4: Clasificación residual.
        // Cualquier transacción huérfana que persista en NULL se marca como 'legacy_entry' para garantizar que no queden nulos.
        console.log('[MIGRATION 059] Backfill: Clasificando registros residuales como \'legacy_entry\'...');
        const legacyResult = await client.query(`
            UPDATE booster_blue_ledger 
            SET type = 'legacy_entry' 
            WHERE type IS NULL;
        `);
        console.log(`[MIGRATION 059] Reconciliación 4 completada (Residuales). Registros marcados: ${legacyResult.rowCount}`);

    } finally {
        // No se requirió habilitar triggers en este bloque debido a la compatibilidad con base de datos en la nube.
    }

    // 8. Endurecer el esquema aplicando las restricciones NOT NULL y el DEFAULT contable para futuras inserciones.
    console.log('[MIGRATION 059] DDL: Estableciendo restricción NOT NULL y DEFAULT en booster_blue_ledger...');
    await client.query(`
        ALTER TABLE booster_blue_ledger 
        ALTER COLUMN type SET NOT NULL;
        
        ALTER TABLE booster_blue_ledger 
        ALTER COLUMN type SET DEFAULT 'legacy_entry';
    `);

    // 9. Recrear la función SQL record_booster_event para que ahora registre la columna 'type' de forma nativa.
    // Esto asegura que cualquier flujo posterior que use el procedimiento almacenado registre los metadatos correctamente.
    console.log('[MIGRATION 059] DDL: Recreando función SQL record_booster_event con soporte de type...');
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

    console.log('[MIGRATION 059] ✅ Migración y reconciliación retroactiva completadas con éxito.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 059] Revirtiendo migración de Ledger de Impulsores...');

    // 1. Restaurar la función SQL record_booster_event a su versión original sin insertar en la columna 'type'.
    console.log('[MIGRATION 059] DDL: Restaurando función SQL record_booster_event original...');
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
            INSERT INTO booster_blue_ledger (user_id, amount, source_publication_id)
            VALUES (p_user_id, p_amount, p_publication_id);
        END;
        $$;
    `);

    // 2. Eliminar físicamente la columna 'type' de la tabla.
    console.log('[MIGRATION 059] DDL: Eliminando columna \'type\' de booster_blue_ledger...');
    await client.query(`
        ALTER TABLE booster_blue_ledger 
        DROP COLUMN IF EXISTS type;
    `);

    console.log('[MIGRATION 059] ✅ Rollback de migración completado exitosamente.');
};
