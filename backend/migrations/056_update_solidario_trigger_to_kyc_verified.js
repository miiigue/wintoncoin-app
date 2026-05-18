/**
 * backend/migrations/056_update_solidario_trigger_to_kyc_verified.js
 * 
 * PROPÓSITO: Actualizar la función de disparador (Trigger) 'fn_release_humanitarian_donations'
 * para que evalúe la columna 'kyc_verified' (introducida en la migración 055) en lugar de 'is_verified'.
 * Esto resuelve de forma definitiva la colisión semántica donde 'is_verified' (usado para email OTP)
 * liberaba prematuramente las donaciones humanitarias sin requerir KYC Web3.
 * 
 * ESTÁNDAR DE INGENIERÍA: Idempotencia de Migración, Cumplimiento Normativo y Auditoría Fintech.
 */

exports.up = async (client) => {
    console.log('[MIGRATION 056] Iniciando actualización de Trigger Solidario a kyc_verified...');

    // Reemplazar la función de liberación automática para apuntar a kyc_verified
    await client.query(`
        CREATE OR REPLACE FUNCTION fn_release_humanitarian_donations()
        RETURNS TRIGGER AS $$
        DECLARE
            donation_record RECORD;
        BEGIN
            -- Solo actuar si kyc_verified cambia de false a true (Verificación KYC Web3 real)
            IF (OLD.kyc_verified IS DISTINCT FROM NEW.kyc_verified AND NEW.kyc_verified = true) THEN
                
                -- Iterar sobre todas las donaciones en espera de este usuario
                FOR donation_record IN 
                    SELECT * FROM humanitarian_donations 
                    WHERE donor_id = NEW.id AND status = 'on_hold'
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
                        user_id, 
                        type, 
                        amount, 
                        description, 
                        related_publication_id
                    ) VALUES (
                        donation_record.recipient_id,
                        'donation_received',
                        donation_record.amount,
                        'Donación Solidaria recibida (Liberada tras KYC Web3 del donante)',
                        donation_record.publication_id
                    );

                    -- C. Actualizar el monto acumulado en la causa
                    UPDATE humanitarian_causes 
                    SET current_amount = current_amount + donation_record.amount 
                    WHERE id = donation_record.cause_id;

                    -- D. Marcar la donación como liberada
                    UPDATE humanitarian_donations 
                    SET status = 'released', 
                        released_at = CURRENT_TIMESTAMP 
                    WHERE id = donation_record.id;
                    
                END LOOP;
            END IF;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

    console.log('[MIGRATION 056] ✅ Función fn_release_humanitarian_donations actualizada exitosamente para usar kyc_verified.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 056] Revirtiendo Trigger Solidario a is_verified...');
    await client.query(`
        CREATE OR REPLACE FUNCTION fn_release_humanitarian_donations()
        RETURNS TRIGGER AS $$
        DECLARE
            donation_record RECORD;
        BEGIN
            -- Revertir a is_verified
            IF (OLD.is_verified IS DISTINCT FROM NEW.is_verified AND NEW.is_verified = true) THEN
                FOR donation_record IN 
                    SELECT * FROM humanitarian_donations 
                    WHERE donor_id = NEW.id AND status = 'on_hold'
                LOOP
                    PERFORM record_booster_event(donation_record.recipient_id, 'humanitarian_donation', donation_record.amount, donation_record.publication_id);
                    INSERT INTO booster_transactions (user_id, type, amount, description, related_publication_id)
                    VALUES (donation_record.recipient_id, 'donation_received', donation_record.amount, 'Donación Solidaria recibida (Liberada tras KYC del donante)', donation_record.publication_id);
                    UPDATE humanitarian_causes SET current_amount = current_amount + donation_record.amount WHERE id = donation_record.cause_id;
                    UPDATE humanitarian_donations SET status = 'released', released_at = CURRENT_TIMESTAMP WHERE id = donation_record.id;
                END LOOP;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);
    console.log('[MIGRATION 056] ✅ Rollback completado.');
};
