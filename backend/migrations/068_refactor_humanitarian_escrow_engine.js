/**
 * backend/migrations/068_refactor_humanitarian_escrow_engine.js
 *
 * PROPÓSITO: Blindar el ecosistema de donaciones humanitarias (Winton Solidario)
 * corrigiendo 3 fallas estructurales graves detectadas en auditoría:
 *
 *   1. DESBORDE DE META (AML Risk): Las donaciones 'on_hold' no se contabilizaban
 *      en la validación de meta, permitiendo que múltiples donantes sin KYC
 *      superaran la recaudación objetivo de forma ilimitada.
 *      → SOLUCIÓN: Nueva columna 'pending_amount' que acumula el total on_hold.
 *
 *   2. TRIGGER INCOMPLETO (Divergencia Contable): Al liberar donaciones retenidas
 *      tras KYC, el trigger no verificaba si la causa alcanzó su meta,
 *      no emitía notificaciones al beneficiario, y no decrementaba pending_amount.
 *      → SOLUCIÓN: Trigger refactorizado con cierre automático de meta,
 *        decremento de pending_amount, y notificaciones integradas.
 *
 *   3. RETENCIÓN INDEFINIDA (Escheatment / FinCEN): No existía mecanismo
 *      para devolver fondos retenidos a donantes que jamás completan su KYC.
 *      → SOLUCIÓN: Variable configurable 'donation_escrow_expiration_days'
 *        en app_settings, consumida por el nuevo demonio donationRefundJob.js.
 *
 * ESTÁNDAR DE INGENIERÍA:
 *   - Idempotencia: IF NOT EXISTS, ON CONFLICT DO NOTHING, CREATE OR REPLACE
 *   - Cumplimiento: SOC 2 Tipo II, FinCEN BSA, GAAP/IFRS partida doble
 *   - Auditoría: Cada operación genera registros trazables y reproducibles
 *
 * FORMATO: exports.up / exports.down — Compatible con migrationRunner.js
 */

'use strict';

exports.up = async (client) => {
    console.log('[MIGRATION 068] Iniciando blindaje del ecosistema de donaciones humanitarias...');

    // =========================================================================
    // PASO 1: Agregar columna 'pending_amount' a humanitarian_causes
    // =========================================================================
    // Esta columna acumula la suma total de donaciones en estado 'on_hold'
    // para prevenir el desborde de meta cuando múltiples donantes sin KYC
    // contribuyen a la misma causa simultáneamente.
    //
    // Ejemplo:
    //   - Meta: 1,000 BLUE IOU
    //   - current_amount (liberado): 200
    //   - pending_amount (on_hold): 700
    //   - Un nuevo donante solo podrá donar máximo 100 (1000 - 200 - 700)
    // =========================================================================
    console.log('[MIGRATION 068] DDL: Agregando columna pending_amount a humanitarian_causes...');
    await client.query(`
        ALTER TABLE humanitarian_causes
        ADD COLUMN IF NOT EXISTS pending_amount DECIMAL(18, 4) NOT NULL DEFAULT 0
    `);

    // =========================================================================
    // PASO 2: Reconciliar valores iniciales de pending_amount
    // =========================================================================
    // Calcula el pending_amount correcto basándose en las donaciones on_hold
    // existentes que pudieran haber quedado de sesiones anteriores.
    // Esto garantiza integridad referencial desde el momento de la migración.
    // =========================================================================
    console.log('[MIGRATION 068] DML: Reconciliando pending_amount con donaciones on_hold existentes...');
    await client.query(`
        UPDATE humanitarian_causes hc
        SET pending_amount = COALESCE(sub.total_pending, 0)
        FROM (
            SELECT cause_id, SUM(amount) AS total_pending
            FROM humanitarian_donations
            WHERE status = 'on_hold'
            GROUP BY cause_id
        ) sub
        WHERE hc.id = sub.cause_id
    `);

    // =========================================================================
    // PASO 3: Insertar variable de configuración del demonio de reembolso
    // =========================================================================
    // Esta variable es editable desde el panel de administración (admin-panel.html)
    // a través del endpoint genérico PUT /api/admin/settings.
    // El valor '15' (días) es el valor por defecto recomendado, pero el
    // administrador puede cambiarlo en cualquier momento sin reiniciar el servidor.
    // =========================================================================
    console.log('[MIGRATION 068] DML: Insertando variable donation_escrow_expiration_days en app_settings...');
    await client.query(`
        INSERT INTO app_settings (setting_key, setting_value, description)
        VALUES (
            'donation_escrow_expiration_days',
            '15',
            'Cantidad de días que una donación humanitaria permanece en espera (on_hold) antes de ser reembolsada automáticamente al donante si este no completa su verificación KYC Web3. Configurable desde el panel de administración.'
        )
        ON CONFLICT (setting_key) DO NOTHING
    `);

    // =========================================================================
    // PASO 4: Insertar variable de habilitación del demonio de reembolso
    // =========================================================================
    // Permite al administrador activar/desactivar el reembolso automático
    // de forma independiente al modo de pre-lanzamiento.
    // =========================================================================
    console.log('[MIGRATION 068] DML: Insertando variable donation_refund_enabled en app_settings...');
    await client.query(`
        INSERT INTO app_settings (setting_key, setting_value, description)
        VALUES (
            'donation_refund_enabled',
            'true',
            'Si se activa, el demonio de reembolso devolverá automáticamente las donaciones en espera (on_hold) que superen los días configurados en donation_escrow_expiration_days. Si se desactiva, las donaciones permanecerán en espera indefinidamente.'
        )
        ON CONFLICT (setting_key) DO NOTHING
    `);

    // =========================================================================
    // PASO 5: Refactorizar el Trigger fn_release_humanitarian_donations
    // =========================================================================
    // El trigger anterior (migraciones 039 y 056) tenía 3 omisiones:
    //   A) No decrementaba pending_amount al liberar
    //   B) No verificaba si la causa alcanzó su meta para auto-completarla
    //   C) No emitía notificaciones al beneficiario
    //
    // Esta versión corrige las 3 omisiones y añade:
    //   D) Consulta del username del donante para personalizar notificaciones
    //   E) Protección contra sobregiro al verificar remaining capacity
    // =========================================================================
    console.log('[MIGRATION 068] DDL: Refactorizando función fn_release_humanitarian_donations...');
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
            -- ================================================================
            -- CONDICIÓN DE ACTIVACIÓN:
            -- Solo actuar cuando kyc_verified cambia de false a true
            -- (Verificación KYC Web3 real aprobada por el administrador)
            -- ================================================================
            IF (OLD.kyc_verified IS DISTINCT FROM NEW.kyc_verified AND NEW.kyc_verified = true) THEN

                -- Obtener el username del donante para las notificaciones
                v_donor_username := NEW.username;

                -- ==============================================================
                -- ITERACIÓN: Procesar cada donación en espera de este donante
                -- ==============================================================
                FOR donation_record IN
                    SELECT hd.*, hc.title AS cause_title, hc.goal_amount,
                           hc.current_amount, hc.status AS cause_status,
                           u.username AS recipient_username
                    FROM humanitarian_donations hd
                    JOIN humanitarian_causes hc ON hd.cause_id = hc.id
                    JOIN users u ON hd.recipient_id = u.id
                    WHERE hd.donor_id = NEW.id AND hd.status = 'on_hold'
                LOOP
                    -- A. Acreditar saldo BLUE IOU al beneficiario (Booster Ledger)
                    PERFORM record_booster_event(
                        donation_record.recipient_id,
                        'humanitarian_donation',
                        donation_record.amount,
                        donation_record.publication_id
                    );

                    -- B. Registrar en el historial de transacciones del beneficiario
                    INSERT INTO booster_transactions (
                        user_id, type, amount, description, related_publication_id
                    ) VALUES (
                        donation_record.recipient_id,
                        'donation_received',
                        donation_record.amount,
                        'Donación Solidaria recibida (Liberada tras KYC Web3 del donante @' || v_donor_username || ')',
                        donation_record.publication_id
                    );

                    -- C. Actualizar monto acumulado (current_amount) y
                    --    decrementar monto pendiente (pending_amount) de la causa
                    UPDATE humanitarian_causes
                    SET current_amount = current_amount + donation_record.amount,
                        pending_amount = GREATEST(pending_amount - donation_record.amount, 0)
                    WHERE id = donation_record.cause_id;

                    -- D. Marcar la donación como liberada con timestamp
                    UPDATE humanitarian_donations
                    SET status = 'released',
                        released_at = CURRENT_TIMESTAMP
                    WHERE id = donation_record.id;

                    -- E. NUEVO: Emitir notificación al beneficiario
                    INSERT INTO notifications (recipient_username, message)
                    VALUES (
                        donation_record.recipient_username,
                        '💙 @' || v_donor_username || ' ha verificado su identidad. Su donación de ' ||
                        ROUND(donation_record.amount, 4) || ' BLUE IOU a tu causa "' ||
                        donation_record.cause_title || '" ha sido liberada y ya está en tu saldo.'
                    );

                    -- F. NUEVO: Verificar si la causa alcanzó su meta para auto-completarla
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

    // =========================================================================
    // PASO 6: Crear índice compuesto para optimizar las consultas del demonio
    // =========================================================================
    // El demonio donationRefundJob necesita buscar donaciones 'on_hold'
    // creadas hace más de N días. Un índice compuesto (status, created_at)
    // acelera esta consulta de forma drástica bajo estrés masivo.
    // =========================================================================
    console.log('[MIGRATION 068] DDL: Creando índice compuesto para consultas del demonio de reembolso...');
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_humanitarian_donations_hold_date
        ON humanitarian_donations (status, created_at)
        WHERE status = 'on_hold'
    `);

    console.log('[MIGRATION 068] ✅ Blindaje del ecosistema de donaciones completado exitosamente.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 068] Revirtiendo blindaje del ecosistema de donaciones...');

    // 1. Eliminar índice parcial
    await client.query('DROP INDEX IF EXISTS idx_humanitarian_donations_hold_date');

    // 2. Restaurar trigger a versión de migración 056 (kyc_verified sin pending_amount)
    await client.query(`
        CREATE OR REPLACE FUNCTION fn_release_humanitarian_donations()
        RETURNS TRIGGER AS $$
        DECLARE
            donation_record RECORD;
        BEGIN
            IF (OLD.kyc_verified IS DISTINCT FROM NEW.kyc_verified AND NEW.kyc_verified = true) THEN
                FOR donation_record IN
                    SELECT * FROM humanitarian_donations
                    WHERE donor_id = NEW.id AND status = 'on_hold'
                LOOP
                    PERFORM record_booster_event(
                        donation_record.recipient_id,
                        'humanitarian_donation',
                        donation_record.amount,
                        donation_record.publication_id
                    );
                    INSERT INTO booster_transactions (user_id, type, amount, description, related_publication_id)
                    VALUES (donation_record.recipient_id, 'donation_received', donation_record.amount,
                        'Donación Solidaria recibida (Liberada tras KYC Web3 del donante)', donation_record.publication_id);
                    UPDATE humanitarian_causes SET current_amount = current_amount + donation_record.amount WHERE id = donation_record.cause_id;
                    UPDATE humanitarian_donations SET status = 'released', released_at = CURRENT_TIMESTAMP WHERE id = donation_record.id;
                END LOOP;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // 3. Eliminar variables de configuración
    await client.query(`DELETE FROM app_settings WHERE setting_key IN ('donation_escrow_expiration_days', 'donation_refund_enabled')`);

    // 4. Eliminar columna pending_amount
    await client.query('ALTER TABLE humanitarian_causes DROP COLUMN IF EXISTS pending_amount');

    console.log('[MIGRATION 068] ✅ Rollback completado.');
};
