/**
 * backend/migrations/065_database_schema_integrity_fixes.js
 * 
 * PROPÓSITO: Implementación de la Opción B.1 para estabilizar y corregir la integridad
 * física de la base de datos, resolviendo inconsistencias de restricciones y rescatando
 * migraciones de datos huérfanas en producción de manera segura e idempotente.
 * 
 * OPERACIONES:
 * 1. Alterar "referral_log" para que "referrer_user_id" permita NULL, permitiendo
 *    que funcione correctamente la regla de integridad referencial ON DELETE SET NULL.
 * 2. Blindar "platform_wallet" con una restricción CHECK (id = 1) para obligar a que
 *    únicamente exista un registro (billetera consolidada de la plataforma).
 * 3. Ejecutar de forma segura e idempotente el backfill de códigos de referidos en usuarios.
 * 4. Migrar saldos y relaciones del usuario legacy obsoleta "plataforma" a la cuenta
 *    oficial "Plataforma WintonCoin" (solo si aún existe en la base de datos).
 * 
 * COMPLIANCE: SOC 2, Auditoría Bancaria y Trazabilidad FinTech.
 */

'use strict';

exports.up = async (client) => {
    console.log('[MIGRATION 065] ⚙️ Iniciando correcciones de integridad física del esquema...');

    // 1. Corregir contradicción en referral_log (NOT NULL vs ON DELETE SET NULL)
    console.log('[MIGRATION 065] Eliminando restricción NOT NULL en "referral_log.referrer_user_id"...');
    await client.query(`
        ALTER TABLE referral_log 
        ALTER COLUMN referrer_user_id DROP NOT NULL;
    `);

    // 2. Blindar platform_wallet para garantizar fila única
    console.log('[MIGRATION 065] Eliminando registros duplicados no deseados en "platform_wallet" (si los hubiere)...');
    await client.query(`
        DELETE FROM platform_wallet 
        WHERE id != 1;
    `);

    console.log('[MIGRATION 065] Aplicando CHECK CONSTRAINT en "platform_wallet" para asegurar id = 1...');
    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_single_row') THEN
                ALTER TABLE platform_wallet ADD CONSTRAINT check_single_row CHECK (id = 1);
            END IF;
        END $$;
    `);

    // 3. Backfill seguro de códigos de referidos en la base de datos (idempotente)
    console.log('[MIGRATION 065] Ejecutando backfill atómico de códigos de referido faltantes...');
    await client.query(`
        DO $$
        DECLARE
            r RECORD;
            v_code VARCHAR(50);
            v_exists BOOLEAN;
            v_random TEXT;
        BEGIN
            FOR r IN SELECT id, username FROM users WHERE referral_code IS NULL OR referral_code = '' LOOP
                LOOP
                    -- Generación de hash aleatorio alfanumérico único para el marketing
                    v_random := upper(substring(md5(random()::text), 1, 8));
                    v_code := upper(substring(r.username, 1, 4)) || '-' || v_random;
                    
                    SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = v_code) INTO v_exists;
                    IF NOT v_exists THEN
                        EXIT;
                    END IF;
                END LOOP;
                
                UPDATE users SET referral_code = v_code WHERE id = r.id;
            END LOOP;
        END $$;
    `);

    // 4. Rescate de la migración de datos huérfana de la cuenta "plataforma" (idempotente)
    console.log('[MIGRATION 065] Verificando y migrando saldos históricos del usuario obsoleto "plataforma"...');
    await client.query(`
        DO $$
        DECLARE
            v_old_id INTEGER;
            v_new_id INTEGER;
            v_new_username VARCHAR(255) := 'Plataforma WintonCoin';
            v_old_username VARCHAR(255) := 'plataforma';
            v_old_liquid NUMERIC(19,4);
            v_old_escrow NUMERIC(19,4);
            v_old_red NUMERIC(19,4);
        BEGIN
            -- Obtener detalles del usuario antiguo si existe
            SELECT id, liquid_blue_balance, escrow_blue_balance, red_balance 
            INTO v_old_id, v_old_liquid, v_old_escrow, v_old_red
            FROM users WHERE username = v_old_username;
            
            -- Obtener detalles de la cuenta oficial de plataforma
            SELECT id INTO v_new_id FROM users WHERE username = v_new_username;
            
            -- Si la cuenta obsoleta y la nueva existen, realizar transferencia contable consolidada
            IF v_old_id IS NOT NULL AND v_new_id IS NOT NULL THEN
                -- Desbloquear temporalmente si hay restricciones lógicas a nivel de software (si existieran)
                PERFORM set_config('app.allow_balance_update', 'true', true);

                -- Transferir saldos consolidados
                UPDATE users 
                SET liquid_blue_balance = liquid_blue_balance + COALESCE(v_old_liquid, 0),
                    escrow_blue_balance = escrow_blue_balance + COALESCE(v_old_escrow, 0),
                    red_balance = red_balance + COALESCE(v_old_red, 0)
                WHERE id = v_new_id;
                
                -- Reasignar relaciones históricas de auditoría
                UPDATE publications SET author_id = v_new_id WHERE author_id = v_old_id;
                UPDATE publication_acceptances SET acceptor_username = v_new_username WHERE acceptor_username = v_old_username;
                UPDATE notifications SET recipient_username = v_new_username WHERE recipient_username = v_old_username;
                UPDATE transactions SET user_id = v_new_id WHERE user_id = v_old_id;
                UPDATE ratings SET rater_username = v_new_username WHERE rater_username = v_old_username;
                UPDATE ratings SET ratee_username = v_new_username WHERE ratee_username = v_old_username;
                UPDATE red_token_debts SET username = v_new_username WHERE username = v_old_username;
                UPDATE blue_token_escrows SET username = v_new_username WHERE username = v_old_username;
                
                -- Eliminar definitivamente la cuenta obsoleta del sistema
                DELETE FROM users WHERE id = v_old_id;
                
                RAISE NOTICE 'Migración histórica de datos de plataforma completada con éxito.';
            END IF;
        END $$;
    `);

    console.log('[MIGRATION 065] ✅ Correcciones de integridad del esquema finalizadas exitosamente.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 065] Revirtiendo correcciones de integridad física...');

    // 1. Quitar la restricción CHECK de platform_wallet
    console.log('[MIGRATION 065] Removiendo CHECK CONSTRAINT "check_single_row" en "platform_wallet"...');
    await client.query(`
        ALTER TABLE platform_wallet 
        DROP CONSTRAINT IF EXISTS check_single_row;
    `);

    // 2. Intentar volver a poner NOT NULL en referral_log (solo si no hay registros con nulos para no fallar)
    console.log('[MIGRATION 065] Intentando reestablecer restricción NOT NULL en "referral_log.referrer_user_id"...');
    await client.query(`
        DO $$
        BEGIN
            -- Solo se reestablece si no hay filas con valor nulo en el referrer_user_id
            IF NOT EXISTS (SELECT 1 FROM referral_log WHERE referrer_user_id IS NULL) THEN
                ALTER TABLE referral_log ALTER COLUMN referrer_user_id SET NOT NULL;
            END IF;
        END $$;
    `);

    console.log('[MIGRATION 065] Reversión de esquema finalizada.');
};
