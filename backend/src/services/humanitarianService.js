// ============================================================================
// SERVICIO: Donaciones Humanitarias (Winton Solidario)
// ============================================================================
// Responsabilidad: Lógica de negocio pura para crear causas y procesar
//                  donaciones de BLUE IOU con mecanismo de Hold & Release.
//
// Arquitectura:
//   - Todas las operaciones de saldo usan record_booster_event() (Event Sourcing)
//   - Las donaciones de usuarios sin KYC Web3 quedan en estado 'on_hold'
//   - La liberación automática ocurre vía Trigger de PostgreSQL (migración 056)
//     cuando el admin aprueba el KYC Web3 del donante (kyc_verified = true)
//
// Seguridad:
//   - Transacciones SQL con BEGIN/COMMIT/ROLLBACK
//   - Row-level locking (FOR UPDATE) para prevenir race conditions
//   - Validación de saldo antes de cada débito
//   - Auditoría completa de cada operación
//
// Dependencias:
//   - record_booster_event(user_id, type, amount, publication_id) — Función SQL
//   - booster_blue_ledger (tabla) — Libro mayor inmutable
//   - booster_transactions (tabla) — Historial visible al usuario
//   - humanitarian_donations (tabla) — Registro de donaciones con estado
//   - fn_release_humanitarian_donations() — Trigger SQL (migración 039)
// ============================================================================

const pool = require('../config/db');
const { logAuditEvent } = require('./auditService');
const { sendTransactionEmail } = require('./emailService');

// ============================================================================
// submitCause: Permite a un usuario postular una causa humanitaria
// ============================================================================
// Flujo:
//   1. Valida los datos de entrada (título, historia, meta)
//   2. Inserta la causa con estado 'pending' (requiere aprobación admin)
//   3. Registra el evento en audit_log para trazabilidad
//
// Parámetros:
//   - userId: ID del usuario que postula la causa
//   - data: { title, story, goal_amount, evidence_urls }
//   - req: Objeto request para auditoría (IP, User-Agent)
//
// Retorna: { id } — ID de la causa creada
// ============================================================================
const submitCause = async (userId, data, req = null) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { title, story, goal_amount, evidence_urls } = data;

        // Validaciones de seguridad
        if (!title || title.trim().length < 5) {
            throw { status: 400, message: 'El título debe tener al menos 5 caracteres.' };
        }
        if (!story || story.trim().length < 20) {
            throw { status: 400, message: 'La historia debe tener al menos 20 caracteres.' };
        }
        const parsedGoal = parseFloat(goal_amount);
        if (isNaN(parsedGoal) || parsedGoal <= 0) {
            throw { status: 400, message: 'La meta debe ser un número positivo.' };
        }

        // --- NUEVO: Validar que el usuario no tenga otra causa activa ('pending' o 'approved') ---
        const activeCausesCheck = await client.query(`
            SELECT id FROM humanitarian_causes 
            WHERE user_id = $1 AND status IN ('pending', 'approved')
        `, [userId]);

        if (activeCausesCheck.rowCount > 0) {
            throw { status: 400, message: 'Actualmente posees una causa en curso o en revisión. Debes culminarla antes de postular una nueva.' };
        }

        // Insertar la causa con estado 'pending'
        const res = await client.query(`
            INSERT INTO humanitarian_causes (user_id, title, story, goal_amount, evidence_urls)
            VALUES ($1, $2, $3, $4, $5::jsonb)
            RETURNING id
        `, [
            userId,
            title.trim(),
            story.trim(),
            parsedGoal,
            JSON.stringify(evidence_urls || [])
        ]);

        // Auditoría de creación
        await logAuditEvent(client, req, {
            eventType: 'HUMANITARIAN_CAUSE_SUBMITTED',
            actorUsername: null, // Se resolverá por userId en el controller
            targetUsername: null,
            category: 'HUMANITARIAN',
            metadata: {
                cause_id: res.rows[0].id,
                title: title.trim(),
                goal_amount: parsedGoal
            }
        });

        await client.query('COMMIT');
        return res.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// ============================================================================
// donateToCause: Procesa una donación de BLUE IOU a una causa aprobada
// ============================================================================
// Flujo de Hold & Release:
//   1. Valida que la causa esté aprobada y no haya alcanzado su meta
//   2. Verifica que el donante tenga saldo suficiente en booster_blue_ledger
//   3. Debita el saldo del donante inmediatamente (los BLUE salen de su cuenta)
//   4. Si el donante tiene KYC Web3 aprobado (kyc_verified = true):
//      → Acredita inmediatamente al beneficiario (status = 'released')
//   5. Si el donante NO tiene KYC Web3 (kyc_verified = false):
//      → Registra la donación en 'on_hold' (el Trigger de BD la liberará
//        automáticamente cuando el admin apruebe el KYC Web3 del donante)
//   6. Genera auditoría y notificaciones
//
// Parámetros:
//   - donorId: ID del usuario que dona
//   - causeId: ID de la causa humanitaria
//   - amount: Cantidad de BLUE IOU a donar
//   - publicationId: ID de la publicación en el marketplace (si aplica)
//   - req: Objeto request para auditoría
//
// Retorna: { success, status, message, new_amount }
// ============================================================================
const donateToCause = async (donorId, causeId, amount, publicationId = null, acceptedTerms = false, req = null) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // =====================================================================
        // PASO 1: Validar la causa (con bloqueo para prevenir race conditions)
        // =====================================================================
        const causeRes = await client.query(`
            SELECT hc.*, u.id AS owner_id, u.username AS owner_username, u.email AS owner_email
            FROM humanitarian_causes hc
            JOIN users u ON hc.user_id = u.id
            WHERE hc.id = $1
            FOR UPDATE
        `, [causeId]);

        if (causeRes.rows.length === 0) {
            throw { status: 404, message: 'Causa humanitaria no encontrada.' };
        }

        const cause = causeRes.rows[0];

        // =====================================================================
        // VALIDACIÓN: El donante no puede ser beneficiario ni creador de ninguna causa activa
        // =====================================================================
        // Si el donante es el beneficiario (o creador) de una causa con estado 'pending' o 'approved',
        // bloqueamos la donación por motivos de auditoría contable y prevención de fraude.
        const activeBeneficiaryCheck = await client.query(`
            SELECT id FROM humanitarian_causes 
            WHERE (user_id = $1 OR beneficiary_referral_code = (SELECT referral_code FROM users WHERE id = $1))
              AND status IN ('pending', 'approved')
              AND id != $2
        `, [donorId, causeId]);

        if (activeBeneficiaryCheck.rowCount > 0) {
            throw { 
                status: 403, 
                message: 'Los beneficiarios o creadores de causas activas o en revisión en Winton Solidario no pueden realizar donaciones a otras causas.' 
            };
        }

        // =====================================================================
        // RESOLUCIÓN DEL BENEFICIARIO FINAL (Destinatario de los fondos)
        // =====================================================================
        // Por defecto, los fondos se dirigen al creador/dueño de la causa.
        // Si existe un código de referido de beneficiario, consultamos la base de
        // datos para resolver su ID, nombre de usuario y correo electrónico,
        // garantizando el flujo e integridad contable (Event Sourcing / SOC 2).
        let recipientId = cause.owner_id;
        let recipientUsername = cause.owner_username;
        let recipientEmail = cause.owner_email;

        if (cause.beneficiary_referral_code) {
            const beneficiaryRes = await client.query(
                'SELECT id, username, email FROM users WHERE referral_code = $1',
                [cause.beneficiary_referral_code]
            );
            if (beneficiaryRes.rows.length > 0) {
                const beneficiary = beneficiaryRes.rows[0];
                recipientId = beneficiary.id;
                recipientUsername = beneficiary.username;
                recipientEmail = beneficiary.email;
            }
        }

        // Solo se puede donar a causas aprobadas
        if (cause.status !== 'approved') {
            throw { status: 400, message: 'Esta causa no está aprobada para recibir donaciones.' };
        }

        // Verificar que no se exceda la meta (incluyendo donaciones pendientes on_hold)
        // BLINDAJE AML: pending_amount evita que múltiples donantes sin KYC
        // superen la meta de recaudación inyectando capital bajo estado on_hold
        const currentAmount = parseFloat(cause.current_amount) || 0;
        const pendingAmount = parseFloat(cause.pending_amount) || 0;
        const goalAmount = parseFloat(cause.goal_amount) || 0;
        if (goalAmount > 0 && (currentAmount + pendingAmount) >= goalAmount) {
            throw { status: 400, message: 'Esta causa ya alcanzó su meta de recaudación (incluyendo donaciones pendientes de verificación).' };
        }

        // Ajustar monto si excedería la meta (considerando pending_amount)
        // BLINDAJE FINTECH: Asegurar que el monto ingresado se acota estrictamente a 4 decimales
        let rawAmount = parseFloat(amount);
        if (isNaN(rawAmount) || rawAmount < 1) {
            throw { status: 400, message: 'El monto mínimo de donación es de 1 BLUE IOU para prevenir saturación de la red.' };
        }
        let donationAmount = parseFloat(rawAmount.toFixed(4));
        // Capacidad restante = meta - (liberado + pendiente)
        // Esto previene el desborde cuando múltiples donantes sin KYC
        // contribuyen simultáneamente a la misma causa
        if (goalAmount > 0 && (currentAmount + pendingAmount + donationAmount) > goalAmount) {
            donationAmount = goalAmount - currentAmount - pendingAmount;
            // Si la capacidad restante es <= 0, rechazar
            if (donationAmount <= 0) {
                throw { status: 400, message: 'Esta causa ya alcanzó su meta de recaudación (incluyendo donaciones pendientes de verificación).' };
            }
        }

        // Prevenir auto-donación del beneficiario final (seguridad anti-fraude)
        if (parseInt(donorId) === parseInt(recipientId)) {
            throw { status: 403, message: 'No puedes donar a una causa donde eres el beneficiario final.' };
        }

        // =====================================================================
        // PASO 2: Verificar saldo seguro (baseEligibleBalance) del donante
        // ─────────────────────────────────────────────────────────────────────
        // Para transacciones de donación, permitimos usar fondos del usuario
        // que sean seguros (bono de bienvenida + tareas realizadas).
        // Si el usuario no tiene KYC, la donación quedará retenida (on_hold)
        // pero se permite registrarla. Sin embargo, no permitimos comprometer
        // bonos de referidos sin KYC (unverifiedReferralBalance) en ningún caso.
        // =====================================================================
        const FinancialCoreService = require('./financialCoreService');
        const balanceInfo = await FinancialCoreService.getUserEligibleBalance(client, donorId);
        const donorBalance = balanceInfo.totalBalance;
        const baseEligibleBalance = balanceInfo.baseEligibleBalance;

        if (baseEligibleBalance < donationAmount) {
            throw {
                status: 400,
                message: `Saldo elegible para transaccionar insuficiente. Tienes ${baseEligibleBalance.toFixed(4)} BLUE IOU seguros disponibles (excluyendo bonos de referidos sin KYC aprobado).`
            };
        }

        // =====================================================================
        // PASO 3: Obtener datos del donante (username, kyc_verified)
        // =====================================================================
        const donorRes = await client.query(
            'SELECT username, email, kyc_verified FROM users WHERE id = $1',
            [donorId]
        );
        const donor = donorRes.rows[0];
        const isVerified = donor.kyc_verified === true;

        // =====================================================================
        // PASO 4: Debitar saldo del donante (SIEMPRE se resta, es inmediato)
        // Usamos record_booster_event con monto negativo para restar
        // Casting explícito ($1::INTEGER, $2::TEXT, etc.) para prevenir
        // ambigüedades de tipo en PostgreSQL bajo estrés transaccional
        // =====================================================================
        await client.query(
            'SELECT record_booster_event($1::INTEGER, $2::TEXT, $3::NUMERIC, $4::INTEGER)',
            [donorId, 'humanitarian_donation_sent', -donationAmount, publicationId]
        );

        // Registrar en historial del donante
        await client.query(`
            INSERT INTO booster_transactions (user_id, type, amount, description, related_publication_id)
            VALUES ($1, 'donation_sent', $2, $3, $4)
        `, [
            donorId,
            -donationAmount,
            `Donación Solidaria enviada para: "${cause.title}"`,
            publicationId
        ]);

        // =====================================================================
        // PASO 5: Determinar estado según KYC del donante
        // =====================================================================
        let donationStatus;
        let userMessage;

        if (isVerified) {
            // ─── DONANTE VERIFICADO: Liberación inmediata ───
            donationStatus = 'released';

            // Acreditar al beneficiario final (casting explícito para seguridad PostgreSQL)
            await client.query(
                'SELECT record_booster_event($1::INTEGER, $2::TEXT, $3::NUMERIC, $4::INTEGER)',
                [recipientId, 'humanitarian_donation', donationAmount, publicationId]
            );

            // Historial del beneficiario
            await client.query(`
                INSERT INTO booster_transactions (user_id, type, amount, description, related_publication_id)
                VALUES ($1, 'donation_received', $2, $3, $4)
            `, [
                recipientId,
                donationAmount,
                `Donación Solidaria recibida de @${donor.username} para: "${cause.title}"`,
                publicationId
            ]);

            // Actualizar monto acumulado de la causa
            await client.query(
                'UPDATE humanitarian_causes SET current_amount = current_amount + $1 WHERE id = $2',
                [donationAmount, causeId]
            );

            // --- NUEVO: Autocompletar si se alcanza la meta ---
            if (goalAmount > 0 && (currentAmount + donationAmount) >= goalAmount) {
                await client.query(
                    "UPDATE humanitarian_causes SET status = 'completed' WHERE id = $1",
                    [causeId]
                );

                await client.query(`
                    INSERT INTO notifications (recipient_username, message)
                    VALUES ($1, $2)
                `, [
                    cause.owner_username,
                    `🎉 ¡Felicidades! Tu causa "${cause.title}" ha alcanzado su meta de recaudación con la última donación y ha sido culminada exitosamente.`
                ]);
            }

            // Notificación al beneficiario por la donación
            await client.query(`
                INSERT INTO notifications (recipient_username, message)
                VALUES ($1, $2)
            `, [
                recipientUsername,
                `💙 @${donor.username} ha donado ${donationAmount.toFixed(4)} BLUE IOU a tu causa "${cause.title}". ¡Ya está en tu saldo!`
            ]);

            userMessage = `¡Donación de ${donationAmount.toFixed(4)} BLUE IOU enviada y acreditada exitosamente!`;

        } else {
            // ─── DONANTE NO VERIFICADO: Hold (espera) ───
            donationStatus = 'on_hold';

            // Notificación al beneficiario (informar del hold)
            await client.query(`
                INSERT INTO notifications (recipient_username, message)
                VALUES ($1, $2)
            `, [
                recipientUsername,
                `⏳ @${donor.username} ha donado ${donationAmount.toFixed(4)} BLUE IOU a tu causa "${cause.title}". Pendiente: el donante debe verificar su identidad para que sea efectiva.`
            ]);

            // Notificación al donante (informar que debe verificarse)
            await client.query(`
                INSERT INTO notifications (recipient_username, message)
                VALUES ($1, $2)
            `, [
                donor.username,
                `⏳ Tu donación de ${donationAmount.toFixed(4)} BLUE IOU a "${cause.title}" está en espera. Verifica tu identidad para que sea efectiva.`
            ]);

            userMessage = `Donación de ${donationAmount.toFixed(4)} BLUE IOU registrada. Se acreditará al beneficiario cuando completes la verificación de identidad.`;

            // NUEVO: Incrementar pending_amount en la causa para prevenir
            // desborde de meta con donaciones on_hold simultáneas (Blindaje AML)
            await client.query(
                'UPDATE humanitarian_causes SET pending_amount = pending_amount + $1 WHERE id = $2',
                [donationAmount, causeId]
            );
        }

        // =====================================================================
        // PASO 6: Registrar la donación en la tabla de control
        // =====================================================================
        await client.query(`
            INSERT INTO humanitarian_donations 
                (cause_id, donor_id, recipient_id, amount, status, publication_id, released_at, accepted_terms)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            causeId,
            donorId,
            recipientId,
            donationAmount,
            donationStatus,
            publicationId,
            isVerified ? new Date() : null,
            acceptedTerms
        ]);

        // =====================================================================
        // PASO 7: Auditoría bancaria completa
        // =====================================================================
        await logAuditEvent(client, req, {
            eventType: 'HUMANITARIAN_DONATION',
            actorUsername: donor.username,
            targetUsername: recipientUsername,
            category: 'HUMANITARIAN',
            metadata: {
                cause_id: causeId,
                cause_title: cause.title,
                amount: donationAmount,
                donor_verified: isVerified,
                donation_status: donationStatus,
                publication_id: publicationId,
                donor_balance_before: donorBalance,
                donor_balance_after: donorBalance - donationAmount
            }
        });

        await client.query('COMMIT');

        // Disparar envío de correos electrónicos transaccionales de forma asíncrona y segura (no bloqueante)
        if (donor.email) {
            sendDonationSentEmail(donor.email, recipientUsername, cause.title, donationAmount, !isVerified, cause.owner_username, cause.evidence_urls, cause.beneficiary_socials)
                .catch(e => console.error('[SOLIDARIO CORREO] Error al disparar sendDonationSentEmail:', e.message));
        }
        if (recipientEmail) {
            sendDonationReceivedEmail(recipientEmail, donor.username, cause.title, donationAmount, !isVerified)
                .catch(e => console.error('[SOLIDARIO CORREO] Error al disparar sendDonationReceivedEmail:', e.message));
        }

        return {
            success: true,
            status: donationStatus,
            message: userMessage,
            new_amount: currentAmount + (isVerified ? donationAmount : 0),
            on_hold: !isVerified ? donationAmount : 0
        };

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// ============================================================================
// getCauseDonations: Obtiene el historial de donaciones de una causa
// ============================================================================
// Retorna las donaciones agrupadas por estado (released, on_hold)
// para que el beneficiario pueda ver el detalle de cada contribución.
// ============================================================================
const getCauseDonations = async (causeId) => {
    const result = await pool.query(`
        SELECT 
            hd.id,
            hd.amount,
            hd.status,
            hd.created_at,
            hd.released_at,
            hd.donation_type,
            u.username AS donor_username,
            u.kyc_verified AS donor_verified
        FROM humanitarian_donations hd
        JOIN users u ON hd.donor_id = u.id
        WHERE hd.cause_id = $1
        ORDER BY hd.created_at DESC
    `, [causeId]);

    // Calcular resumen
    const donations = result.rows;
    const released = donations.filter(d => d.status === 'released');
    const onHold = donations.filter(d => d.status === 'on_hold');

    return {
        donations,
        summary: {
            total_released: released.reduce((sum, d) => sum + parseFloat(d.amount), 0),
            total_on_hold: onHold.reduce((sum, d) => sum + parseFloat(d.amount), 0),
            count_released: released.length,
            count_on_hold: onHold.length
        }
    };
};

// ============================================================================
// HELPERS DE CORREOS TRANSACCIONALES PARA DONACIONES (SOC 2 & UX)
// ============================================================================

/**
 * Envía un correo al donante informándole del estado de su donación (Hold o Liberada).
 */
const sendDonationSentEmail = async (donorEmail, recipientUsername, causeTitle, amount, isHold, creatorUsername, evidenceUrls = null, beneficiarySocials = null) => {
    try {
        const subject = isHold
            ? '💙 ¡Gracias por tu apoyo! Donación en espera de verificación — Winton Solidario'
            : '💖 ¡Gracias por tu generosidad! Recibo de Donación Acreditada — Winton Solidario';
        const title = isHold
            ? 'Donación Recibida en Custodia'
            : 'Donación Acreditada Exitosamente';
        const message = isHold
            ? `¡Muchísimas gracias por tu generosidad! Tu donación de ${amount.toFixed(4)} BLUE IOU para apoyar la causa "${causeTitle}" de @${recipientUsername} ha sido registrada. Con este gran gesto, estás sumando valor y esperanza.\n\nTu donación está en resguardo seguro temporalmente. Para que sea liberada y se haga efectiva en la causa, solo debes completar tu verificación KYC Web3 en la plataforma.`
            : `¡Queremos agradecerte de todo corazón por tu hermoso gesto de solidaridad! Tu donación de ${amount.toFixed(4)} BLUE IOU para la causa "${causeTitle}" de @${recipientUsername} ha sido procesada y acreditada exitosamente. Tu apoyo es fundamental para lograr esta meta. ¡Gracias por hacer la diferencia!`;

        const creatorSocials = extractCreatorSocials(evidenceUrls);
        const socialsBeneficiary = beneficiarySocials || 'No especificadas';

        await sendTransactionEmail({
            toEmail: donorEmail,
            subject,
            title,
            message,
            amount: `${amount.toFixed(4)} BLUE IOU`,
            details: [
                { label: 'Causa Humanitaria', value: causeTitle },
                { label: 'Creador de la Causa', value: `@${creatorUsername}` },
                { label: 'Beneficiario', value: `@${recipientUsername}` },
                { label: 'Redes del Organizador', value: creatorSocials },
                { label: 'Redes del Beneficiario', value: socialsBeneficiary },
                { label: 'Estado de Custodia', value: isHold ? 'En Resguardo Seguro (Falta KYC)' : 'Acreditado Inmediato' },
                { label: 'Fecha', value: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }) }
            ]
        });
    } catch (err) {
        console.error('[SOLIDARIO CORREO] Error al enviar correo de donación enviada:', err.message);
    }
};

/**
 * Envía un correo al beneficiario notificándole sobre una nueva donación recibida o en espera.
 */
const sendDonationReceivedEmail = async (recipientEmail, donorUsername, causeTitle, amount, isHold) => {
    try {
        const subject = isHold
            ? 'Tienes una donación pendiente de verificación — Winton Solidario'
            : '¡Has recibido una donación! — Winton Solidario';
        const title = isHold
            ? 'Donación Pendiente de KYC'
            : 'Donación Recibida y Disponible';
        const message = isHold
            ? `@${donorUsername} ha donado ${amount.toFixed(4)} BLUE IOU a tu causa "${causeTitle}". Los fondos están retenidos temporalmente en custodia y se liberarán automáticamente a tu saldo tan pronto como el donante verifique su identidad KYC Web3.`
            : `¡Buenas noticias! @${donorUsername} ha donado ${amount.toFixed(4)} BLUE IOU a tu causa "${causeTitle}". Los fondos ya han sido acreditados y están disponibles en tu cuenta.`;

        await sendTransactionEmail({
            toEmail: recipientEmail,
            subject,
            title,
            message,
            amount: `${amount.toFixed(4)} BLUE IOU`,
            details: [
                { label: 'Causa Humanitaria', value: causeTitle },
                { label: 'Donante', value: `@${donorUsername}` },
                { label: 'Estado de Fondos', value: isHold ? 'Pendiente de KYC del Donante' : 'Disponible en Saldo' },
                { label: 'Fecha', value: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }) }
            ]
        });
    } catch (err) {
        console.error('[SOLIDARIO CORREO] Error al enviar correo de donación recibida:', err.message);
    }
};

/**
 * Procesa y envía correos electrónicos para las donaciones liberadas tras el cambio de KYC.
 * Esta función es llamada de forma asíncrona por los controladores al actualizar kyc_verified a true.
 */
const processAndSendEmailsForReleasedDonations = async (donorId) => {
    const client = await pool.connect();
    try {
        // Buscar donaciones liberadas en el último minuto para este donante
        // status = 'released' y released_at reciente (últimos 2 minutos para margen de seguridad)
        const releasedDonations = await client.query(`
            SELECT hd.id, hd.amount, hd.released_at,
                   hc.title AS cause_title,
                   u_donor.username AS donor_username, u_donor.email AS donor_email,
                   u_recipient.username AS recipient_username, u_recipient.email AS recipient_email
            FROM humanitarian_donations hd
            JOIN humanitarian_causes hc ON hd.cause_id = hc.id
            JOIN users u_donor ON hd.donor_id = u_donor.id
            JOIN users u_recipient ON hd.recipient_id = u_recipient.id
            WHERE hd.donor_id = $1 
              AND hd.status = 'released'
              AND hd.released_at >= NOW() - INTERVAL '2 minutes'
        `, [donorId]);

        if (releasedDonations.rowCount === 0) {
            return;
        }

        console.log(`[SOLIDARIO CORREO] Procesando envío de correos para ${releasedDonations.rowCount} donación(es) liberada(s) de usuario #${donorId}...`);

        for (const donation of releasedDonations.rows) {
            const amount = parseFloat(donation.amount);

            // A. Correo al donante (Confirmación de acreditación tras KYC aprobado)
            if (donation.donor_email) {
                try {
                    await sendTransactionEmail({
                        toEmail: donation.donor_email,
                        subject: 'Donación Liberada Exitosamente — Winton Solidario',
                        title: 'Donación Liberada tras KYC',
                        message: `¡Excelente! Dado que has verificado tu identidad con éxito, tu donación retenida de ${amount.toFixed(4)} BLUE IOU ha sido liberada y acreditada al beneficiario @${donation.recipient_username} para la causa "${donation.cause_title}". Gracias por hacer que la plataforma sea más segura.`,
                        amount: `${amount.toFixed(4)} BLUE IOU`,
                        details: [
                            { label: 'Causa Humanitaria', value: donation.cause_title },
                            { label: 'Beneficiario', value: `@${donation.recipient_username}` },
                            { label: 'Estado', value: 'Liberado y Acreditado' },
                            { label: 'Fecha de Liberación', value: donation.released_at.toLocaleString('es-CO', { timeZone: 'America/Bogota' }) }
                        ]
                    });
                } catch (emailErr) {
                    console.error(`[SOLIDARIO CORREO] Error al enviar correo de liberación al donante:`, emailErr.message);
                }
            }

            // B. Correo al beneficiario (Confirmación de fondos disponibles)
            if (donation.recipient_email) {
                try {
                    await sendTransactionEmail({
                        toEmail: donation.recipient_email,
                        subject: '¡Fondos Liberados en tu Causa! — Winton Solidario',
                        title: 'Fondos Disponibles tras KYC',
                        message: `¡Excelentes noticias! El donante @${donation.donor_username} ha completado su verificación KYC Web3. Su donación retenida de ${amount.toFixed(4)} BLUE IOU para tu causa "${donation.cause_title}" ha sido liberada de la custodia y ya está disponible en tu saldo.`,
                        amount: `${amount.toFixed(4)} BLUE IOU`,
                        details: [
                            { label: 'Causa Humanitaria', value: donation.cause_title },
                            { label: 'Donante', value: `@${donation.donor_username}` },
                            { label: 'Estado de Fondos', value: 'Liberado a Saldo Disponible' },
                            { label: 'Fecha de Liberación', value: donation.released_at.toLocaleString('es-CO', { timeZone: 'America/Bogota' }) }
                        ]
                    });
                } catch (emailErr) {
                    console.error(`[SOLIDARIO CORREO] Error al enviar correo de liberación al beneficiario:`, emailErr.message);
                }
            }
        }
    } catch (err) {
        console.error('[SOLIDARIO CORREO] Error en processAndSendEmailsForReleasedDonations:', err.message);
    } finally {
        client.release();
    }
};


/**
 * Edita una causa solidaria (meta o historia) aplicando controles de similitud y límites de reducción.
 */
const editCause = async (userId, causeId, { story, goal_amount }, req) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Obtener la causa y verificar propiedad
        const causeRes = await client.query(`
            SELECT hc.*, u.username AS creator_username
            FROM humanitarian_causes hc
            JOIN users u ON hc.user_id = u.id
            WHERE hc.id = $1
        `, [causeId]);

        if (causeRes.rowCount === 0) {
            throw { status: 404, message: 'Causa no encontrada.' };
        }

        const cause = causeRes.rows[0];
        if (cause.user_id !== userId) {
            throw { status: 403, message: 'No estás autorizado para editar esta causa.' };
        }

        let updatedStory = cause.story;
        let updatedGoal = parseFloat(cause.goal_amount);

        // 2. Si la causa está en revisión ('pending') se permite edición libre
        if (cause.status === 'pending') {
            if (story !== undefined) {
                if (typeof story !== 'string' || story.trim().length < 100) {
                    throw { status: 400, message: 'La historia debe tener al menos 100 caracteres.' };
                }
                updatedStory = story;
            }
            if (goal_amount !== undefined) {
                const parsedGoal = parseFloat(goal_amount);
                if (isNaN(parsedGoal) || parsedGoal <= 0) {
                    throw { status: 400, message: 'La meta debe ser un número positivo.' };
                }
                updatedGoal = parsedGoal;
            }
        } else if (cause.status === 'approved') {
            // 3. Si está activa ('approved'), aplicar controles estrictos
            if (story !== undefined && story !== cause.story) {
                if (typeof story !== 'string' || story.trim().length < 100) {
                    throw { status: 400, message: 'La historia debe tener al menos 100 caracteres.' };
                }

                // Aplicar algoritmo de similitud (Levenshtein)
                const distance = getLevenshteinDistance(cause.story, story);
                const maxLength = Math.max(cause.story.length, story.length);
                const percentChange = maxLength > 0 ? (distance / maxLength) * 100 : 0;

                if (percentChange > 15) {
                    throw { 
                        status: 400, 
                        message: `Has modificado un ${percentChange.toFixed(1)}% del texto. Por motivos de transparencia con tus donantes, no puedes modificar más del 15% de la historia principal de una causa activa. Por favor, publica una Actualización.` 
                    };
                }

                // Guardar la versión anterior en el historial
                await client.query(`
                    INSERT INTO humanitarian_cause_history (cause_id, old_story, new_story, changed_by_user_id)
                    VALUES ($1, $2, $3, $4)
                `, [causeId, cause.story, story, userId]);

                updatedStory = story;
            }

            if (goal_amount !== undefined && parseFloat(goal_amount) !== parseFloat(cause.goal_amount)) {
                const parsedGoal = parseFloat(goal_amount);
                if (isNaN(parsedGoal) || parsedGoal <= 0) {
                    throw { status: 400, message: 'La meta debe ser un número positivo.' };
                }

                // La nueva meta no puede ser menor a lo ya recaudado (released + pending)
                const totalRaised = parseFloat(cause.current_amount) + parseFloat(cause.pending_amount);
                if (parsedGoal < totalRaised) {
                    throw { 
                        status: 400, 
                        message: `La meta no puede ser menor a la cantidad total ya recaudada y en espera (${totalRaised.toFixed(4)} BLUE IOU).` 
                    };
                }
                updatedGoal = parsedGoal;
            }
        } else {
            throw { status: 400, message: 'Solo se pueden editar causas activas o pendientes.' };
        }

        // 4. Actualizar la causa
        await client.query(`
            UPDATE humanitarian_causes
            SET story = $1, goal_amount = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
        `, [updatedStory, updatedGoal, causeId]);

        // Registrar auditoría
        await logAuditEvent(
            userId,
            'EDIT_HUMANITARIAN_CAUSE',
            `Causa ID ${causeId} editada. Nueva meta: ${updatedGoal}, Historia modificada: ${story !== undefined && story !== cause.story}`,
            req
        );

        await client.query('COMMIT');
        return { success: true, message: 'Causa actualizada correctamente.' };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

/**
 * Crea una actualización (novedad) en la causa y notifica por correo a todos los donantes únicos.
 */
const createCauseUpdate = async (userId, causeId, { update_title, update_text }, req) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Obtener la causa y verificar propiedad
        const causeRes = await client.query(`
            SELECT hc.*, u.username AS creator_username
            FROM humanitarian_causes hc
            JOIN users u ON hc.user_id = u.id
            WHERE hc.id = $1
        `, [causeId]);

        if (causeRes.rowCount === 0) {
            throw { status: 404, message: 'Causa no encontrada.' };
        }

        const cause = causeRes.rows[0];
        if (cause.user_id !== userId) {
            throw { status: 403, message: 'No estás autorizado para publicar actualizaciones en esta causa.' };
        }

        if (!update_title || update_title.trim().length < 5) {
            throw { status: 400, message: 'El título de la actualización debe tener al menos 5 caracteres.' };
        }
        if (!update_text || update_text.trim().length < 20) {
            throw { status: 400, message: 'El texto de la actualización debe tener al menos 20 caracteres.' };
        }

        // 2. Insertar la actualización
        await client.query(`
            INSERT INTO humanitarian_cause_updates (cause_id, update_title, update_text)
            VALUES ($1, $2, $3)
        `, [causeId, update_title, update_text]);

        // Registrar auditoría
        await logAuditEvent(
            userId,
            'CREATE_HUMANITARIAN_CAUSE_UPDATE',
            `Actualización publicada en causa ID ${causeId}: "${update_title}"`,
            req
        );

        await client.query('COMMIT');

        // 3. Buscar todos los donantes únicos (DISTINCT) de esta causa (asíncrono, no bloquea la API)
        const donorsRes = await pool.query(`
            SELECT DISTINCT u.email, u.username
            FROM humanitarian_donations hd
            JOIN users u ON hd.donor_id = u.id
            WHERE hd.cause_id = $1 AND u.email IS NOT NULL AND u.id != $2
        `, [causeId, userId]); // Excluimos al creador por si se auto-donó

        // Extraer redes sociales para inyectarlas
        const creatorSocials = extractCreatorSocials(cause.evidence_urls);
        const beneficiarySocials = cause.beneficiary_socials || 'No especificadas';

        // Disparar envío de correos asíncronamente
        donorsRes.rows.forEach(donor => {
            sendCauseUpdateEmail(
                donor.email,
                donor.username,
                cause.title,
                update_title,
                update_text,
                cause.creator_username,
                creatorSocials,
                beneficiarySocials
            ).catch(err => console.error(`[SOLIDARIO UPDATE EMAIL] Error al notificar al donante ${donor.username}:`, err.message));
        });

        return { success: true, message: 'Actualización publicada con éxito y notificaciones enviadas.' };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// Helper de distancia de Levenshtein
function getLevenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // sustitución
                    matrix[i][j - 1] + 1,     // inserción
                    matrix[i - 1][j] + 1      // eliminación
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// Helper para extraer las redes sociales del creador desde evidence_urls
function extractCreatorSocials(evidenceUrls) {
    try {
        if (!evidenceUrls) return 'No especificadas';
        const urls = typeof evidenceUrls === 'string' ? JSON.parse(evidenceUrls) : evidenceUrls;
        if (!Array.isArray(urls) || urls.length <= 1) return 'No especificadas';
        // El primer elemento es el PDF de soporte, los siguientes son redes sociales
        return urls.slice(1).join(', ');
    } catch (e) {
        return 'No especificadas';
    }
}

/**
 * Envía un correo al donante informando sobre una nueva actualización en la causa que apoyó.
 */
const sendCauseUpdateEmail = async (donorEmail, donorUsername, causeTitle, updateTitle, updateText, creatorUsername, creatorSocials, beneficiarySocials) => {
    try {
        await sendTransactionEmail({
            toEmail: donorEmail,
            subject: `📢 Nueva actualización en la causa: "${causeTitle}" — Winton Solidario`,
            title: 'Actualización de Causa Solidaria',
            message: `¡Hola @${donorUsername}!\n\nQueremos mantenerte informado del impacto de tu generosidad. El organizador @${creatorUsername} ha compartido una novedad en la causa "${causeTitle}":\n\n🔹 ${updateTitle}\n\n${updateText}\n\nGracias por seguir apoyando y haciendo posible este logro.`,
            amount: 'Novedades de Campaña',
            details: [
                { label: 'Causa Humanitaria', value: causeTitle },
                { label: 'Organizado por', value: `@${creatorUsername}` },
                { label: 'Redes del Organizador', value: creatorSocials },
                { label: 'Redes del Beneficiario', value: beneficiarySocials },
                { label: 'Fecha de Publicación', value: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }) }
            ]
        });
    } catch (err) {
        console.error('[SOLIDARIO CORREO] Error al enviar correo de actualización de causa:', err.message);
    }
};

module.exports = {
    submitCause,
    donateToCause,
    getCauseDonations,
    processAndSendEmailsForReleasedDonations,
    editCause,
    createCauseUpdate
};
