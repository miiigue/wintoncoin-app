// ============================================================================
// MIGRACIÓN 039: Motor de Hold & Release - Winton Solidario
// ============================================================================
// Implementa la lógica de donaciones en espera hasta verificación KYC.
// Incluye: Tabla de donaciones, Función de liberación y Trigger automático.
// ============================================================================

module.exports = {
    up: async (client) => {
        console.log('[MIGRATION 039] Iniciando implementación del motor Hold & Release...');

        // 1. Tabla de donaciones humanitarias (Libro auxiliar)
        await client.query(`
            CREATE TABLE IF NOT EXISTS humanitarian_donations (
                id SERIAL PRIMARY KEY,
                cause_id INTEGER NOT NULL REFERENCES humanitarian_causes(id),
                donor_id INTEGER NOT NULL REFERENCES users(id),
                recipient_id INTEGER NOT NULL REFERENCES users(id),
                amount DECIMAL(18, 4) NOT NULL,
                status VARCHAR(50) DEFAULT 'on_hold', -- on_hold, released, cancelled
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                released_at TIMESTAMP WITH TIME ZONE,
                publication_id INTEGER -- ID de la publicación en el mercado
            )
        `);

        // Índices para búsquedas rápidas por estado y donante
        await client.query('CREATE INDEX IF NOT EXISTS idx_solidario_donor ON humanitarian_donations(donor_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_solidario_status ON humanitarian_donations(status)');

        // 2. Función de liberación automática (PL/pgSQL)
        // Esta función procesa las donaciones cuando un usuario se verifica.
        await client.query(`
            CREATE OR REPLACE FUNCTION fn_release_humanitarian_donations()
            RETURNS TRIGGER AS $$
            DECLARE
                donation_record RECORD;
            BEGIN
                -- Solo actuar si is_verified cambia de false a true
                IF (OLD.is_verified IS DISTINCT FROM NEW.is_verified AND NEW.is_verified = true) THEN
                    
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
                            'Donación Solidaria recibida (Liberada tras KYC del donante)',
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

                        -- E. Notificar al beneficiario (Opcional: Si tienes tabla de notificaciones)
                        -- INSERT INTO notifications (recipient_username, message) ...
                        
                    END LOOP;
                END IF;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // 3. El Disparador (Trigger)
        // Se ejecuta después de cada actualización en la tabla de usuarios.
        await client.query(`
            DROP TRIGGER IF EXISTS trg_user_verification_release ON users;
            CREATE TRIGGER trg_user_verification_release
            AFTER UPDATE ON users
            FOR EACH ROW
            EXECUTE FUNCTION fn_release_humanitarian_donations();
        `);

        console.log('[MIGRATION 039] ✅ Motor Hold & Release implementado correctamente.');
    },

    down: async (client) => {
        console.log('[MIGRATION 039] Revirtiendo motor Hold & Release...');
        await client.query('DROP TRIGGER IF EXISTS trg_user_verification_release ON users;');
        await client.query('DROP FUNCTION IF EXISTS fn_release_humanitarian_donations();');
        await client.query('DROP TABLE IF EXISTS humanitarian_donations CASCADE;');
        console.log('[MIGRATION 039] ✅ Motor eliminado.');
    }
};
