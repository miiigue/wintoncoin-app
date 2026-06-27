/**
 * backend/migrations/067_fix_db_inconsistencies_and_golive.js
 * 
 * PROPÓSITO: Solucionar inconsistencias estructurales en la base de datos 
 * que bloquean el motor financiero.
 * 
 * DETALLE:
 * 1. Elimina múltiples firmas (overloads) conflictivas de la función 'record_balance_event'
 *    y establece una única versión con tipos estrictos.
 * 2. Añade la columna 'settled_at' a 'red_token_debts' requerida por el Debt Collector.
 * 3. Prepara 'app_settings' para el "Go-Live Gate", si el sistema no está en pre-lanzamiento
 *    se inserta el timestamp de desactivación como punto génesis para los pagos a impulsores.
 * 
 * ESTÁNDAR DE INGENIERÍA: Idempotencia (IF NOT EXISTS), Trazabilidad, y Defensa en Profundidad.
 */

'use strict';

exports.up = async (client) => {
    console.log('[MIGRATION 067] Iniciando corrección de inconsistencias y esquema...');

    // 1. Limpieza de sobrecargas conflictivas de record_balance_event
    // Elimina TODAS las versiones existentes para evitar ambigüedades tipo 42725
    await client.query(`
        DO $$
        DECLARE
            func_oid OID;
        BEGIN
            FOR func_oid IN
                SELECT p.oid FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE p.proname = 'record_balance_event' AND n.nspname = 'public'
            LOOP
                EXECUTE format('DROP FUNCTION IF EXISTS %s(%s)',
                    'public.record_balance_event',
                    pg_get_function_identity_arguments(func_oid));
            END LOOP;
        END $$;
    `);

    // Crear la función única y estrictamente tipada
    await client.query(`
        CREATE OR REPLACE FUNCTION record_balance_event(
            p_user_id INTEGER,
            p_event_type TEXT,
            p_balance_type TEXT,
            p_amount NUMERIC,
            p_metadata JSONB DEFAULT NULL
        ) RETURNS VOID AS $$
        BEGIN
            -- Validaciones estrictas de dominio de valores
            IF p_balance_type NOT IN ('liquid_blue', 'escrow_blue', 'red') THEN
                RAISE EXCEPTION 'Tipo de balance inválido: %', p_balance_type;
            END IF;

            -- Registrar el evento en el ledger inmutable
            INSERT INTO balance_events (user_id, event_type, balance_type, amount, metadata)
            VALUES (p_user_id, p_event_type, p_balance_type, p_amount, p_metadata);

            -- Actualizar el estado de la cuenta (Materialized View style)
            IF p_balance_type = 'liquid_blue' THEN
                UPDATE users SET liquid_blue_balance = liquid_blue_balance + p_amount WHERE id = p_user_id;
            ELSIF p_balance_type = 'escrow_blue' THEN
                UPDATE users SET escrow_blue_balance = escrow_blue_balance + p_amount WHERE id = p_user_id;
            ELSIF p_balance_type = 'red' THEN
                UPDATE users SET red_balance = red_balance + p_amount WHERE id = p_user_id;
            END IF;
        END;
        $$ LANGUAGE plpgsql;
    `);
    console.log('[MIGRATION 067] ✅ Función record_balance_event unificada y asegurada.');

    // 2. Resolver columna faltante en red_token_debts
    await client.query(`
        ALTER TABLE red_token_debts
        ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ DEFAULT NULL;
    `);
    console.log('[MIGRATION 067] ✅ Columna settled_at añadida a red_token_debts.');

    // 3. Preparar el "Go-Live Gate" si el modo pre_launch está desactivado (para sistemas en ejecución)
    // Si pre_launch_mode_enabled es 'false' y pre_launch_deactivated_at no existe, asumimos 
    // que el génesis es el inicio de la platform_wallet (retrocompatibilidad de cold start).
    await client.query(`
        DO $$
        DECLARE
            v_pre_launch TEXT;
        BEGIN
            SELECT setting_value INTO v_pre_launch FROM app_settings WHERE setting_key = 'pre_launch_mode_enabled';
            
            IF v_pre_launch = 'false' THEN
                -- Verificamos si ya existe el timestamp
                IF NOT EXISTS (SELECT 1 FROM app_settings WHERE setting_key = 'pre_launch_deactivated_at') THEN
                    -- Como no hay registro previo, usamos NOW() como punto de partida seguro
                    INSERT INTO app_settings (setting_key, setting_value)
                    VALUES ('pre_launch_deactivated_at', NOW()::text);
                END IF;
            END IF;
        END $$;
    `);
    console.log('[MIGRATION 067] ✅ Configuración Go-Live Gate inicializada (si aplicaba).');
};

exports.down = async (client) => {
    console.log('[MIGRATION 067] Revirtiendo cambios...');
    
    // No revertimos el drop de la función, dejamos la versión arreglada porque la versión
    // anterior estaba corrupta (múltiples overloads). 
    
    // Eliminamos la columna settled_at
    await client.query(`
        ALTER TABLE red_token_debts DROP COLUMN IF EXISTS settled_at;
    `);

    // Opcional: Eliminar configuración Go-Live
    await client.query(`
        DELETE FROM app_settings WHERE setting_key = 'pre_launch_deactivated_at';
    `);

    console.log('[MIGRATION 067] Reversión completada (función record_balance_event mantenida por seguridad).');
};
