// backend/migrations/085_drop_ambiguous_record_booster_event.js

exports.up = async (client) => {
    console.log('[MIGRATION 085] Iniciando resolución de ambigüedad de sobrecarga (Overload Ambiguity) en record_booster_event...');

    // 1. Limpiar TODAS las versiones previas de la función (explícitamente por sus tipos de datos)
    // Esto es vital porque en PostgreSQL 10+, si la función está sobrecargada, no permite hacer un DROP sin especificar los argumentos.
    console.log('[MIGRATION 085] DDL: Eliminando firmas ambiguas y antiguas de record_booster_event...');
    
    // Eliminamos la versión de 4 argumentos (la que causaba el conflicto con el backend)
    await client.query('DROP FUNCTION IF EXISTS record_booster_event(INTEGER, TEXT, NUMERIC, INTEGER);');
    await client.query('DROP FUNCTION IF EXISTS record_booster_event(INTEGER, VARCHAR, NUMERIC, INTEGER);');
    
    // Eliminamos la versión de 5 argumentos para evitar conflictos al recrearla limpia
    await client.query('DROP FUNCTION IF EXISTS record_booster_event(INTEGER, TEXT, NUMERIC, INTEGER, INTEGER);');
    await client.query('DROP FUNCTION IF EXISTS record_booster_event(INTEGER, VARCHAR, NUMERIC, INTEGER, INTEGER);');

    // Eliminamos la versión de 3 argumentos (por si existió históricamente)
    await client.query('DROP FUNCTION IF EXISTS record_booster_event(INTEGER, TEXT, NUMERIC);');
    await client.query('DROP FUNCTION IF EXISTS record_booster_event(INTEGER, VARCHAR, NUMERIC);');

    // 2. Recrear LA ÚNICA versión definitiva de 5 parámetros con valores por defecto
    console.log('[MIGRATION 085] DDL: Recreando la única fuente de la verdad para record_booster_event...');
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

    console.log('[MIGRATION 085] ✅ Ambigüedad resuelta y función única establecida correctamente.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 085] Deshaciendo resolución de ambigüedad (Rollback)...');
    
    // Al deshacer, eliminamos la de 5 y restauramos la de 4 para volver al estado ambiguo original (retrocompatibilidad del rollback)
    await client.query('DROP FUNCTION IF EXISTS record_booster_event(INTEGER, TEXT, NUMERIC, INTEGER, INTEGER);');
    
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
    
    console.log('[MIGRATION 085] ✅ Rollback de la migración completado.');
};
