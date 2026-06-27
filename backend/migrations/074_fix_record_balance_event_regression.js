/**
 * backend/migrations/074_fix_record_balance_event_regression.js
 * 
 * PROPÓSITO:
 * Corregir la regresión crítica de signos en la función almacenada 'record_balance_event'.
 * La simplificación realizada en la migración 067 eliminó la lógica de evaluación 
 * de la dirección del flujo de fondos (débitos vs créditos), provocando que los retiros (withdrawals)
 * y cargos incrementaran los saldos en lugar de disminuirlos.
 * 
 * SOLUCIÓN DE INGENIERÍA FINTECH:
 * 1. Restablecer el condicional que evalúa 'p_event_type'.
 * 2. Mapear eventos de incremento (deposit, credit, payment_received, refund) a signo positivo.
 * 3. Mapear eventos de decremento (withdrawal, payment_sent, charge, penalty) a signo negativo.
 * 4. Realizar la actualización en la tabla 'users' utilizando la variable ajustada 'v_adjustment'.
 * 5. Mantener el registro contable original 'p_amount' (monto absoluto) en 'balance_events' para auditoría.
 * 
 * ESTÁNDAR: Idempotente (DROP/CREATE), Transaccional, Comentado línea por línea, 100% Auditable.
 */

'use strict';

exports.up = async (client) => {
    console.log('[MIGRATION 074] Iniciando corrección de regresión en record_balance_event...');

    // 1. Asegurar idempotencia eliminando sobrecargas previas de la función
    // Evita conflictos de firmas incompatibles en PostgreSQL
    await client.query(`
        DROP FUNCTION IF EXISTS public.record_balance_event(INTEGER, TEXT, TEXT, NUMERIC, JSONB);
    `);

    // 2. Crear la función con tipado estricto y lógica de signos
    await client.query(`
        CREATE OR REPLACE FUNCTION record_balance_event(
            p_user_id INTEGER,
            p_event_type TEXT,
            p_balance_type TEXT,
            p_amount NUMERIC,
            p_metadata JSONB DEFAULT NULL
        ) RETURNS VOID AS $$
        DECLARE
            v_adjustment NUMERIC(19, 4); -- Variable para el ajuste neto con precisión de 4 decimales
        BEGIN
            -- Paso A: Validaciones estrictas de dominio de valores (Integridad Referencial)
            IF p_balance_type NOT IN ('liquid_blue', 'escrow_blue', 'red') THEN
                RAISE EXCEPTION 'Tipo de balance inválido: %', p_balance_type;
            END IF;

            -- Paso B: Determinar el signo del ajuste según la naturaleza financiera del evento
            -- Los eventos que incrementan el saldo (créditos/depósitos) se aplican con signo positivo
            IF p_event_type IN ('deposit', 'credit', 'payment_received', 'refund', 'reversal_deposit') THEN
                v_adjustment := p_amount;
            -- Los eventos que disminuyen el saldo (débitos/retiros/cargos) se aplican con signo negativo
            ELSIF p_event_type IN ('withdrawal', 'payment_sent', 'charge', 'penalty', 'reversal_withdrawal') THEN
                v_adjustment := -p_amount;
            ELSE
                -- Por defecto (fallback preventivo): usar el signo original del monto proveído
                v_adjustment := p_amount;
            END IF;

            -- Paso C: Registrar el evento original en la tabla inmutable balance_events (Trazabilidad / Event Sourcing)
            -- Se guarda el p_amount absoluto original junto con el tipo de evento
            INSERT INTO balance_events (user_id, event_type, balance_type, amount, metadata)
            VALUES (p_user_id, p_event_type, p_balance_type, p_amount, p_metadata);

            -- Paso D: Actualizar el saldo materializado del usuario correspondiente en la tabla users
            -- COALESCE previene errores en caso de valores nulos (null fallback a 0.0000)
            IF p_balance_type = 'liquid_blue' THEN
                UPDATE users SET liquid_blue_balance = COALESCE(liquid_blue_balance, 0.0000) + v_adjustment WHERE id = p_user_id;
            ELSIF p_balance_type = 'escrow_blue' THEN
                UPDATE users SET escrow_blue_balance = COALESCE(escrow_blue_balance, 0.0000) + v_adjustment WHERE id = p_user_id;
            ELSIF p_balance_type = 'red' THEN
                UPDATE users SET red_balance = COALESCE(red_balance, 0.0000) + v_adjustment WHERE id = p_user_id;
            END IF;
        END;
        $$ LANGUAGE plpgsql;
    `);

    console.log('[MIGRATION 074] ✅ Función record_balance_event unificada y corregida con ajuste de signos.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 074] Revirtiendo migración 074 (retornando a la versión simplificada de la 067)...');

    // 1. Limpieza de firmas
    await client.query(`
        DROP FUNCTION IF EXISTS public.record_balance_event(INTEGER, TEXT, TEXT, NUMERIC, JSONB);
    `);

    // 2. Re-crear versión simplificada (regresión anterior) para soporte de rollback limpio
    await client.query(`
        CREATE OR REPLACE FUNCTION record_balance_event(
            p_user_id INTEGER,
            p_event_type TEXT,
            p_balance_type TEXT,
            p_amount NUMERIC,
            p_metadata JSONB DEFAULT NULL
        ) RETURNS VOID AS $$
        BEGIN
            IF p_balance_type NOT IN ('liquid_blue', 'escrow_blue', 'red') THEN
                RAISE EXCEPTION 'Tipo de balance inválido: %', p_balance_type;
            END IF;

            INSERT INTO balance_events (user_id, event_type, balance_type, amount, metadata)
            VALUES (p_user_id, p_event_type, p_balance_type, p_amount, p_metadata);

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
    console.log('[MIGRATION 074] ✅ Reversión completada con éxito.');
};
