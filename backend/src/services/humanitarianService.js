// ============================================================================
// SERVICIO: Donaciones Humanitarias (Winton Solidario)
// ============================================================================
// Responsabilidad: Lógica de negocio pura para crear causas y procesar
//                  donaciones de BLUE IOU con mecanismo de Hold & Release.
//
// Arquitectura:
//   - Todas las operaciones de saldo usan record_booster_event() (Event Sourcing)
//   - Las donaciones de usuarios no verificados quedan en estado 'on_hold'
//   - La liberación automática ocurre vía Trigger de PostgreSQL (migración 039)
//     cuando el admin aprueba el KYC del donante (is_verified = true)
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
//   4. Si el donante tiene KYC aprobado (is_verified = true):
//      → Acredita inmediatamente al beneficiario (status = 'released')
//   5. Si el donante NO tiene KYC (is_verified = false):
//      → Registra la donación en 'on_hold' (el Trigger de BD la liberará
//        automáticamente cuando el admin apruebe el KYC del donante)
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
const donateToCause = async (donorId, causeId, amount, publicationId = null, req = null) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // =====================================================================
        // PASO 1: Validar la causa (con bloqueo para prevenir race conditions)
        // =====================================================================
        const causeRes = await client.query(`
            SELECT hc.*, u.id AS owner_id, u.username AS owner_username
            FROM humanitarian_causes hc
            JOIN users u ON hc.user_id = u.id
            WHERE hc.id = $1
            FOR UPDATE
        `, [causeId]);

        if (causeRes.rows.length === 0) {
            throw { status: 404, message: 'Causa humanitaria no encontrada.' };
        }

        const cause = causeRes.rows[0];

        // Solo se puede donar a causas aprobadas
        if (cause.status !== 'approved') {
            throw { status: 400, message: 'Esta causa no está aprobada para recibir donaciones.' };
        }

        // Verificar que no se exceda la meta
        const currentAmount = parseFloat(cause.current_amount) || 0;
        const goalAmount = parseFloat(cause.goal_amount) || 0;
        if (goalAmount > 0 && currentAmount >= goalAmount) {
            throw { status: 400, message: 'Esta causa ya alcanzó su meta de recaudación.' };
        }

        // Ajustar monto si excedería la meta
        let donationAmount = parseFloat(amount);
        if (isNaN(donationAmount) || donationAmount <= 0) {
            throw { status: 400, message: 'El monto de donación debe ser positivo.' };
        }
        if (goalAmount > 0 && (currentAmount + donationAmount) > goalAmount) {
            donationAmount = goalAmount - currentAmount;
        }

        // Prevenir auto-donación (seguridad anti-fraude)
        if (parseInt(donorId) === parseInt(cause.owner_id)) {
            throw { status: 403, message: 'No puedes donar a tu propia causa.' };
        }

        // =====================================================================
        // PASO 2: Verificar saldo del donante (Event Sourcing — SUM del ledger)
        // =====================================================================
        const balanceRes = await client.query(
            'SELECT COALESCE(SUM(amount), 0) AS total FROM booster_blue_ledger WHERE user_id = $1',
            [donorId]
        );
        const donorBalance = parseFloat(balanceRes.rows[0].total);

        if (donorBalance < donationAmount) {
            throw {
                status: 400,
                message: `Saldo insuficiente. Tienes ${donorBalance.toFixed(4)} BLUE IOU disponibles.`
            };
        }

        // =====================================================================
        // PASO 3: Obtener datos del donante (username, is_verified)
        // =====================================================================
        const donorRes = await client.query(
            'SELECT username, is_verified FROM users WHERE id = $1',
            [donorId]
        );
        const donor = donorRes.rows[0];
        const isVerified = donor.is_verified === true;

        // =====================================================================
        // PASO 4: Debitar saldo del donante (SIEMPRE se resta, es inmediato)
        // Usamos record_booster_event con monto negativo para restar
        // =====================================================================
        await client.query(
            'SELECT record_booster_event($1, $2, $3, $4)',
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

            // Acreditar al beneficiario
            await client.query(
                'SELECT record_booster_event($1, $2, $3, $4)',
                [cause.owner_id, 'humanitarian_donation', donationAmount, publicationId]
            );

            // Historial del beneficiario
            await client.query(`
                INSERT INTO booster_transactions (user_id, type, amount, description, related_publication_id)
                VALUES ($1, 'donation_received', $2, $3, $4)
            `, [
                cause.owner_id,
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
                cause.owner_username,
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
                cause.owner_username,
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
        }

        // =====================================================================
        // PASO 6: Registrar la donación en la tabla de control
        // =====================================================================
        await client.query(`
            INSERT INTO humanitarian_donations 
                (cause_id, donor_id, recipient_id, amount, status, publication_id, released_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            causeId,
            donorId,
            cause.owner_id,
            donationAmount,
            donationStatus,
            publicationId,
            isVerified ? new Date() : null
        ]);

        // =====================================================================
        // PASO 7: Auditoría bancaria completa
        // =====================================================================
        await logAuditEvent(client, req, {
            eventType: 'HUMANITARIAN_DONATION',
            actorUsername: donor.username,
            targetUsername: cause.owner_username,
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
            u.username AS donor_username,
            u.is_verified AS donor_verified
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

module.exports = {
    submitCause,
    donateToCause,
    getCauseDonations
};
