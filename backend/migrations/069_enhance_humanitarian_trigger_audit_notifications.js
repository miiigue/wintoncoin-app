/**
 * backend/migrations/069_enhance_humanitarian_trigger_audit_notifications.js
 *
 * PROPÓSITO:
 *   Cerrar el círculo de seguridad, trazabilidad y experiencia de usuario en la
 *   liberación automática de donaciones humanitarias retenidas.
 *
 * DETALLE DE MEJORAS:
 *   1. LOG DE AUDITORÍA AUTOMÁTICA (SOC 2 Tipo II / Compliance):
 *      Toda liberación de fondos retenidos que ocurra a nivel base de datos por
 *      el trigger PL/pgSQL insertará un registro formal en la tabla 'audit_log'
 *      con el tipo de evento 'HUMANITARIAN_DONATION_RELEASED' y metadatos JSON
 *      completos, garantizando trazabilidad absoluta y auditabilidad bancaria.
 *
 *   2. NOTIFICACIÓN IN-APP AL DONANTE (CFPB Regulation E / UX):
 *      Al activarse el trigger e inyectarse los fondos al beneficiario,
 *      se le notificará de inmediato al donante que su donación ha sido entregada
 *      y liberada con éxito tras su aprobación de KYC Web3.
 *
 * IDEMPOTENCIA Y SEGURIDAD:
 *   - Utiliza 'CREATE OR REPLACE FUNCTION' para sobreescribir la función anterior de forma atómica.
 *   - Estrictamente tipado y comentado línea por línea.
 */

'use strict';

exports.up = async (client) => {
    console.log('[MIGRATION 069] Iniciando fortalecimiento de auditoría y notificaciones en trigger humanitario...');

    await client.query(`
        CREATE OR REPLACE FUNCTION fn_release_humanitarian_donations()
        RETURNS TRIGGER AS $$
        DECLARE
            donation_record RECORD;
            v_donor_username TEXT;
            v_cause_title TEXT;
            v_recipient_username TEXT;
            v_new_current NUMERIC;
            v_goal NUMERIC;
        BEGIN
            -- =========================================================================
            -- CONDICIÓN DE ACTIVACIÓN:
            -- Solo actuar cuando kyc_verified cambia de false a true.
            -- =========================================================================
            IF (OLD.kyc_verified IS DISTINCT FROM NEW.kyc_verified AND NEW.kyc_verified = true) THEN

                -- Resolver el username del donante para las alertas y auditorías
                v_donor_username := NEW.username;

                -- =====================================================================
                -- ITERACIÓN: Procesar cada donación en espera (on_hold) del donante
                -- =====================================================================
                FOR donation_record IN
                    SELECT hd.*, hc.title AS cause_title, hc.goal_amount,
                           hc.current_amount, hc.status AS cause_status,
                           u.username AS recipient_username
                    FROM humanitarian_donations hd
                    JOIN humanitarian_causes hc ON hd.cause_id = hc.id
                    JOIN users u ON hd.recipient_id = u.id
                    WHERE hd.donor_id = NEW.id AND hd.status = 'on_hold'
                LOOP
                    -- 1. Acreditar saldo BLUE IOU al beneficiario (Booster Ledger)
                    PERFORM record_booster_event(
                        donation_record.recipient_id,
                        'humanitarian_donation',
                        donation_record.amount,
                        donation_record.publication_id
                    );

                    -- 2. Registrar en el historial de transacciones del beneficiario
                    INSERT INTO booster_transactions (
                        user_id, type, amount, description, related_publication_id
                    ) VALUES (
                        donation_record.recipient_id,
                        'donation_received',
                        donation_record.amount,
                        'Donación Solidaria recibida (Liberada tras KYC Web3 del donante @' || v_donor_username || ')',
                        donation_record.publication_id
                    );

                    -- 3. Actualizar monto acumulado (current_amount) y decrementar pending_amount
                    UPDATE humanitarian_causes
                    SET current_amount = current_amount + donation_record.amount,
                        pending_amount = GREATEST(pending_amount - donation_record.amount, 0)
                    WHERE id = donation_record.cause_id;

                    -- 4. Marcar la donación como liberada con timestamp
                    UPDATE humanitarian_donations
                    SET status = 'released',
                        released_at = CURRENT_TIMESTAMP
                    WHERE id = donation_record.id;

                    -- 5. Notificación in-app al beneficiario (alerta de recepción)
                    INSERT INTO notifications (recipient_username, message)
                    VALUES (
                        donation_record.recipient_username,
                        '💙 @' || v_donor_username || ' ha verificado su identidad. Su donación de ' ||
                        ROUND(donation_record.amount, 4) || ' BLUE IOU a tu causa "' ||
                        donation_record.cause_title || '" ha sido liberada y ya está en tu saldo.'
                    );

                    -- 6. [NUEVO] Notificación in-app al donante (alerta de éxito y custodia completada)
                    INSERT INTO notifications (recipient_username, message)
                    VALUES (
                        v_donor_username,
                        '✅ ¡Gracias! Tu donación de ' || ROUND(donation_record.amount, 4) || ' BLUE IOU a la causa "' ||
                        donation_record.cause_title || '" ha sido liberada y acreditada exitosamente tras tu aprobación de KYC Web3.'
                    );

                    -- 7. [NUEVO] Registro de auditoría bancaria inmutable en audit_log (SOC 2 cc7.1)
                    INSERT INTO audit_log (event_type, actor_username, target_username, category, metadata, ip_address)
                    VALUES (
                        'HUMANITARIAN_DONATION_RELEASED',
                        'SYSTEM_TRIGGER',
                        donation_record.recipient_username,
                        'HUMANITARIAN',
                        json_build_object(
                            'donation_id', donation_record.id,
                            'cause_id', donation_record.cause_id,
                            'cause_title', donation_record.cause_title,
                            'amount', donation_record.amount,
                            'donor_username', v_donor_username,
                            'donor_id', NEW.id
                        ),
                        '127.0.0.1'
                    );

                    -- 8. Verificar si la causa alcanzó su meta para auto-completarla
                    SELECT current_amount, goal_amount
                    INTO v_new_current, v_goal
                    FROM humanitarian_causes
                    WHERE id = donation_record.cause_id;

                    IF v_goal > 0 AND v_new_current >= v_goal AND donation_record.cause_status = 'approved' THEN
                        UPDATE humanitarian_causes
                        SET status = 'completed'
                        WHERE id = donation_record.cause_id;

                        -- Notificar al beneficiario de la meta alcanzada
                        INSERT INTO notifications (recipient_username, message)
                        VALUES (
                            donation_record.recipient_username,
                            '🎉 ¡Felicidades! Tu causa "' || donation_record.cause_title ||
                            '" ha alcanzado su meta de recaudación y ha sido culminada exitosamente.'
                        );
                    END IF;

                END LOOP;
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

    console.log('[MIGRATION 069] ✅ Trigger robustecido con logs de auditoría y notificaciones del donante.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 069] Revirtiendo trigger a la versión anterior de la migración 068...');

    await client.query(`
        CREATE OR REPLACE FUNCTION fn_release_humanitarian_donations()
        RETURNS TRIGGER AS $$
        DECLARE
            donation_record RECORD;
            v_donor_username TEXT;
            v_cause_title TEXT;
            v_recipient_username TEXT;
            v_new_current NUMERIC;
            v_goal NUMERIC;
        BEGIN
            IF (OLD.kyc_verified IS DISTINCT FROM NEW.kyc_verified AND NEW.kyc_verified = true) THEN
                v_donor_username := NEW.username;
                FOR donation_record IN
                    SELECT hd.*, hc.title AS cause_title, hc.goal_amount,
                           hc.current_amount, hc.status AS cause_status,
                           u.username AS recipient_username
                    FROM humanitarian_donations hd
                    JOIN humanitarian_causes hc ON hd.cause_id = hc.id
                    JOIN users u ON hd.recipient_id = u.id
                    WHERE hd.donor_id = NEW.id AND hd.status = 'on_hold'
                LOOP
                    PERFORM record_booster_event(
                        donation_record.recipient_id,
                        'humanitarian_donation',
                        donation_record.amount,
                        donation_record.publication_id
                    );

                    INSERT INTO booster_transactions (
                        user_id, type, amount, description, related_publication_id
                    ) VALUES (
                        donation_record.recipient_id,
                        'donation_received',
                        donation_record.amount,
                        'Donación Solidaria recibida (Liberada tras KYC Web3 del donante @' || v_donor_username || ')',
                        donation_record.publication_id
                    );

                    UPDATE humanitarian_causes
                    SET current_amount = current_amount + donation_record.amount,
                        pending_amount = GREATEST(pending_amount - donation_record.amount, 0)
                    WHERE id = donation_record.cause_id;

                    UPDATE humanitarian_donations
                    SET status = 'released',
                        released_at = CURRENT_TIMESTAMP
                    WHERE id = donation_record.id;

                    INSERT INTO notifications (recipient_username, message)
                    VALUES (
                        donation_record.recipient_username,
                        '💙 @' || v_donor_username || ' ha verificado su identidad. Su donación de ' ||
                        ROUND(donation_record.amount, 4) || ' BLUE IOU a tu causa "' ||
                        donation_record.cause_title || '" ha sido liberada y ya está en tu saldo.'
                    );

                    SELECT current_amount, goal_amount
                    INTO v_new_current, v_goal
                    FROM humanitarian_causes
                    WHERE id = donation_record.cause_id;

                    IF v_goal > 0 AND v_new_current >= v_goal AND donation_record.cause_status = 'approved' THEN
                        UPDATE humanitarian_causes
                        SET status = 'completed'
                        WHERE id = donation_record.cause_id;

                        INSERT INTO notifications (recipient_username, message)
                        VALUES (
                            donation_record.recipient_username,
                            '🎉 ¡Felicidades! Tu causa "' || donation_record.cause_title ||
                            '" ha alcanzado su meta de recaudación y ha sido culminada exitosamente.'
                        );
                    END IF;
                END LOOP;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

    console.log('[MIGRATION 069] ✅ Trigger restaurado exitosamente.');
};
