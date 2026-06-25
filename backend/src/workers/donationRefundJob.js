/**
 * backend/src/workers/donationRefundJob.js
 *
 * DEMONIO DE REEMBOLSO AUTOMÁTICO DE DONACIONES VENCIDAS (Winton Solidario)
 * =========================================================================
 *
 * PROPÓSITO:
 *   Identificar y reembolsar automáticamente las donaciones humanitarias
 *   que permanezcan en estado 'on_hold' durante más días de los configurados
 *   en la variable 'donation_escrow_expiration_days' de app_settings.
 *
 * FRECUENCIA DE EJECUCIÓN:
 *   Cada 5 minutos (300,000 ms), configurado en cronManager.js.
 *   Esta frecuencia es suficiente porque evalúa donaciones con días de
 *   antigüedad, no segundos. Un intervalo más corto no aporta beneficio.
 *
 * MECANISMO DE REEMBOLSO:
 *   1. Consulta la variable configurable de días de vencimiento desde app_settings
 *   2. Busca donaciones on_hold cuyo created_at supere esos días
 *   3. Usa FOR UPDATE SKIP LOCKED para evitar race conditions con el Trigger
 *   4. Devuelve los BLUE IOU al donante vía record_booster_event (+amount)
 *   5. Decrementa pending_amount en la causa correspondiente
 *   6. Marca la donación como 'refunded' con timestamp
 *   7. Emite notificaciones al donante y al beneficiario
 *   8. Genera registro en audit_log para trazabilidad completa
 *
 * CUMPLIMIENTO NORMATIVO:
 *   - SOC 2 Tipo II (CC7.1): Transaccionalidad atómica con BEGIN/COMMIT/ROLLBACK
 *   - FinCEN BSA: Previene retención indefinida de fondos (Escheatment Laws)
 *   - GAAP/IFRS: Partida doble — el reembolso restaura el débito original
 *   - CFPB Regulation E: Notificación obligatoria al titular de los fondos
 *
 * GUARDAS DE SEGURIDAD:
 *   - pre_launch_mode_enabled: Pausa económica total en pre-lanzamiento
 *   - donation_refund_enabled: Switch independiente para activar/desactivar
 *   - FOR UPDATE SKIP LOCKED: Evita deadlocks con el Trigger de KYC
 *
 * DEPENDENCIAS:
 *   - app_settings: donation_escrow_expiration_days, donation_refund_enabled
 *   - record_booster_event(user_id, type, amount, publication_id) — Función SQL
 *   - humanitarian_donations: Tabla de donaciones con estados
 *   - humanitarian_causes: Tabla de causas con pending_amount
 *   - booster_transactions: Historial visible al usuario
 *   - notifications: Sistema de alertas in-app
 *   - audit_log: Registro inmutable de auditoría bancaria
 */

'use strict';

const { sendTransactionEmail } = require('../services/emailService');

// ============================================================================
// FUNCIÓN PRINCIPAL DEL DEMONIO
// ============================================================================
// Recibe el pool de conexiones de PostgreSQL inyectado por cronManager.js.
// No arroja excepciones al exterior; todos los errores se capturan y registran
// en la consola de forma auditable sin tumbar el servidor.
// ============================================================================
async function donationRefundJob(pool) {
    console.log('[DONATION REFUND] Iniciando ciclo de verificación de donaciones vencidas...');

    // Declaramos el cliente fuera del try para acceso en finally
    let client;

    try {
        // Obtenemos una conexión dedicada del pool
        client = await pool.connect();

        // Iniciamos transacción atómica (SOC 2 Control CC7.1)
        await client.query('BEGIN');

        // =================================================================
        // GUARDA 1: Verificar modo pre-lanzamiento y habilitación del demonio
        // =================================================================
        // Consultamos ambas variables en una sola query para eficiencia.
        // Si el sistema está en pre-lanzamiento o el reembolso está desactivado,
        // el demonio se detiene de forma segura sin procesar nada.
        // =================================================================
        const settingsResult = await client.query(`
            SELECT setting_key, setting_value
            FROM app_settings
            WHERE setting_key IN (
                'pre_launch_mode_enabled',
                'donation_refund_enabled',
                'donation_escrow_expiration_days'
            )
        `);

        // Extraer valores de configuración con defaults seguros
        const isPreLaunchMode = settingsResult.rows
            .find(r => r.setting_key === 'pre_launch_mode_enabled')?.setting_value === 'true';
        const isRefundEnabled = settingsResult.rows
            .find(r => r.setting_key === 'donation_refund_enabled')?.setting_value === 'true';
        const expirationDays = parseInt(
            settingsResult.rows
                .find(r => r.setting_key === 'donation_escrow_expiration_days')?.setting_value || '15',
            10
        );

        // GUARDA: Pausa económica en pre-lanzamiento
        if (isPreLaunchMode) {
            console.log('[DONATION REFUND] Sistema en modo pre-lanzamiento. Reembolso de donaciones en pausa económica.');
            await client.query('ROLLBACK');
            return;
        }

        // GUARDA: Switch de habilitación del demonio
        if (!isRefundEnabled) {
            console.log('[DONATION REFUND] Reembolso automático desactivado por configuración del administrador. Saltando ciclo.');
            await client.query('ROLLBACK');
            return;
        }

        // Validar que la cantidad de días sea un número positivo razonable
        if (isNaN(expirationDays) || expirationDays < 1) {
            console.error('[DONATION REFUND] ⚠️ Valor inválido para donation_escrow_expiration_days. Debe ser >= 1. Saltando ciclo.');
            await client.query('ROLLBACK');
            return;
        }

        // =================================================================
        // PASO 1: Buscar donaciones vencidas con bloqueo anti-race-condition
        // =================================================================
        // FOR UPDATE SKIP LOCKED garantiza que si el Trigger de KYC está
        // procesando la misma donación en otro hilo, este demonio la salta
        // en lugar de esperar (evita deadlocks).
        //
        // La cláusula WHERE created_at < NOW() - INTERVAL '$1 days' filtra
        // solo las donaciones que han superado el período de custodia
        // configurado por el administrador.
        // =================================================================
        const expiredDonations = await client.query(`
            SELECT
                hd.id,
                hd.cause_id,
                hd.donor_id,
                hd.recipient_id,
                hd.amount,
                hd.publication_id,
                hd.created_at,
                u_donor.username AS donor_username,
                u_donor.email AS donor_email,
                u_recipient.username AS recipient_username,
                u_recipient.email AS recipient_email,
                hc.title AS cause_title
            FROM humanitarian_donations hd
            JOIN users u_donor ON hd.donor_id = u_donor.id
            JOIN users u_recipient ON hd.recipient_id = u_recipient.id
            JOIN humanitarian_causes hc ON hd.cause_id = hc.id
            WHERE hd.status = 'on_hold'
              AND hd.created_at < NOW() - INTERVAL '1 day' * $1::INTEGER
            FOR UPDATE OF hd SKIP LOCKED
        `, [expirationDays]);

        // Si no hay donaciones vencidas, cerramos limpiamente
        if (expiredDonations.rowCount === 0) {
            console.log(`[DONATION REFUND] No se encontraron donaciones vencidas (umbral: ${expirationDays} días). Sistema limpio.`);
            await client.query('ROLLBACK');
            return;
        }

        console.log(`[DONATION REFUND] Se encontraron ${expiredDonations.rowCount} donación(es) vencida(s) para reembolsar.`);

        // =================================================================
        // PASO 2: Procesar cada donación vencida
        // =================================================================
        let totalRefunded = 0;

        for (const donation of expiredDonations.rows) {
            const refundAmount = parseFloat(donation.amount);

            // A. Restaurar los BLUE IOU al saldo del donante (partida doble: +amount)
            // Esto revierte el débito original registrado como 'humanitarian_donation_sent'
            await client.query(
                'SELECT record_booster_event($1::INTEGER, $2::TEXT, $3::NUMERIC, $4::INTEGER)',
                [donation.donor_id, 'donation_refunded', refundAmount, donation.publication_id]
            );

            // B. Registrar en el historial de transacciones del donante
            await client.query(`
                INSERT INTO booster_transactions (user_id, type, amount, description, related_publication_id)
                VALUES ($1, 'donation_refunded', $2, $3, $4)
            `, [
                donation.donor_id,
                refundAmount,
                `Reembolso automático: Tu donación de ${refundAmount.toFixed(4)} BLUE IOU a la causa "${donation.cause_title}" fue devuelta porque no completaste la verificación KYC Web3 dentro del plazo de ${expirationDays} días.`,
                donation.publication_id
            ]);

            // C. Decrementar el pending_amount de la causa
            // GREATEST previene valores negativos por anomalías aritméticas
            await client.query(`
                UPDATE humanitarian_causes
                SET pending_amount = GREATEST(pending_amount - $1, 0)
                WHERE id = $2
            `, [refundAmount, donation.cause_id]);

            // D. Marcar la donación como reembolsada con timestamp
            await client.query(`
                UPDATE humanitarian_donations
                SET status = 'refunded',
                    released_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [donation.id]);

            // E. Notificación al donante (CFPB Regulation E: aviso obligatorio)
            await client.query(`
                INSERT INTO notifications (recipient_username, message)
                VALUES ($1, $2)
            `, [
                donation.donor_username,
                `🔄 Tu donación de ${refundAmount.toFixed(4)} BLUE IOU a la causa "${donation.cause_title}" ha sido reembolsada automáticamente porque no completaste la verificación KYC Web3 dentro del plazo de ${expirationDays} días. Los fondos han sido restaurados a tu saldo.`
            ]);

            // F. Notificación al beneficiario (transparencia institucional)
            await client.query(`
                INSERT INTO notifications (recipient_username, message)
                VALUES ($1, $2)
            `, [
                donation.recipient_username,
                `⏳ La donación de ${refundAmount.toFixed(4)} BLUE IOU de @${donation.donor_username} a tu causa "${donation.cause_title}" fue reembolsada al donante porque no completó su verificación KYC Web3 dentro del plazo establecido.`
            ]);

            // G. Registro de auditoría bancaria inmutable
            await client.query(`
                INSERT INTO audit_log (event_type, actor_username, target_username, category, metadata, ip_address)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6)
            `, [
                'DONATION_ESCROW_REFUNDED',
                'SYSTEM_DAEMON',
                donation.donor_username,
                'HUMANITARIAN',
                JSON.stringify({
                    donation_id: donation.id,
                    cause_id: donation.cause_id,
                    cause_title: donation.cause_title,
                    amount_refunded: refundAmount,
                    donor_id: donation.donor_id,
                    recipient_id: donation.recipient_id,
                    recipient_username: donation.recipient_username,
                    escrow_expiration_days: expirationDays,
                    donation_created_at: donation.created_at,
                    refunded_at: new Date().toISOString(),
                    reason: 'KYC_VERIFICATION_TIMEOUT'
                }),
                '127.0.0.1'
            ]);

            // H. [NUEVO] Envío de correos transaccionales de reembolso de forma asíncrona (CFPB Regulation E)
            if (donation.donor_email) {
                sendTransactionEmail({
                    toEmail: donation.donor_email,
                    subject: 'Reembolso por Expiración de KYC — Winton Solidario',
                    title: 'Donación Reembolsada',
                    message: `Tu donación de ${refundAmount.toFixed(4)} BLUE IOU para la causa "${donation.cause_title}" ha sido reembolsada automáticamente porque no completaste la verificación KYC Web3 en el plazo establecido de ${expirationDays} días. Los fondos ya se encuentran de vuelta en tu saldo.`,
                    amount: `${refundAmount.toFixed(4)} BLUE IOU`,
                    details: [
                        { label: 'Causa Humanitaria', value: donation.cause_title },
                        { label: 'Beneficiario', value: `@${donation.recipient_username}` },
                        { label: 'Plazo Máximo Custodia', value: `${expirationDays} días` },
                        { label: 'Estado', value: 'Reembolsado (Devuelto)' },
                        { label: 'Fecha de Reembolso', value: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }) }
                    ]
                }).catch(err => console.error(`[DONATION REFUND CORREO] Error al enviar email de reembolso al donante @${donation.donor_username}:`, err.message));
            }

            if (donation.recipient_email) {
                sendTransactionEmail({
                    toEmail: donation.recipient_email,
                    subject: 'Donación Expirada y Reembolsada — Winton Solidario',
                    title: 'Donación Expirada',
                    message: `La donación pendiente de ${refundAmount.toFixed(4)} BLUE IOU realizada por @${donation.donor_username} para tu causa "${donation.cause_title}" ha expirado y ha sido devuelta al donante, ya que este no completó la verificación KYC Web3 en el plazo de ${expirationDays} días.`,
                    amount: `${refundAmount.toFixed(4)} BLUE IOU`,
                    details: [
                        { label: 'Causa Humanitaria', value: donation.cause_title },
                        { label: 'Donante', value: `@${donation.donor_username}` },
                        { label: 'Estado de Fondos', value: 'Expirado / Reembolsado al Donante' },
                        { label: 'Fecha de Expiración', value: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }) }
                    ]
                }).catch(err => console.error(`[DONATION REFUND CORREO] Error al enviar email de expiración al beneficiario @${donation.recipient_username}:`, err.message));
            }

            totalRefunded += refundAmount;

            console.log(`[DONATION REFUND] ✅ Reembolsada donación #${donation.id} → ${refundAmount.toFixed(4)} BLUE IOU devueltos a @${donation.donor_username}`);
        }

        // =================================================================
        // PASO 3: Confirmar la transacción atómica
        // =================================================================
        await client.query('COMMIT');
        console.log(`[DONATION REFUND] Ciclo finalizado. Total reembolsado: ${totalRefunded.toFixed(4)} BLUE IOU en ${expiredDonations.rowCount} donación(es).`);

    } catch (error) {
        // =================================================================
        // MANEJO DE ERRORES: ROLLBACK seguro y registro sin tumbar el servidor
        // =================================================================
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('[DONATION REFUND] Error al ejecutar ROLLBACK:', rollbackError.message);
            }
        }
        console.error('[DONATION REFUND] Error crítico durante el ciclo de reembolso:', error.message || error);
    } finally {
        // =================================================================
        // LIBERACIÓN: Devolver el cliente al pool para prevenir fugas de conexiones
        // =================================================================
        if (client) {
            client.release();
        }
    }
}

module.exports = donationRefundJob;
