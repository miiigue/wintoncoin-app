// ============================================================================
// src/services/publicationService.js
// ============================================================================

const { sendTransactionEmail } = require('./emailService');
const logAuditEvent = require('./auditService');

function resolveRepeatCooldownHours(body) {
            const days = parseInt(body.repeatCooldownDays, 10) || 0;
            const hours = parseInt(body.repeatCooldownHours, 10) || 0;
            const minutes = parseInt(body.repeatCooldownMinutes, 10) || 0;
            let totalMinutes = (days * 24 * 60) + (hours * 60) + minutes;
            if (!Number.isFinite(totalMinutes) || totalMinutes < 1) {
                totalMinutes = 12;
            }
            return totalMinutes / 60;
        }

// --- NUEVA FUNCIÓN HELPER PARA ACTUALIZAR EL NIVEL DE UN IMPULSOR ---
// Comentado línea por línea para auditabilidad de grado bancario.
// Optimizada para evaluar las ganancias históricas acumuladas (amount > 0)
// de modo que el nivel del booster nunca descienda al donar a Winton Solidario o gastar.
async function updateUserBoosterLevel(client, userId) {
    // 1. Calcular el total acumulado histórico de BLUE de impulsor (solo créditos/ganancias positivas)
    const totalBlueResult = await client.query(
        'SELECT SUM(amount) as total FROM booster_blue_ledger WHERE user_id = $1 AND amount > 0',
        [userId]
    );
    const totalBoosterBlue = parseFloat(totalBlueResult.rows[0]?.total) || 0;

    // 2. Encontrar el nivel más alto que el usuario ha alcanzado según las configuraciones de nivel
    const levelResult = await client.query(
        'SELECT MAX(level) as current_level FROM booster_level_settings WHERE min_blue_required <= $1',
        [totalBoosterBlue]
    );
    const newLevel = levelResult.rows[0]?.current_level || 0;

    // 3. Actualizar de forma atómica el nivel del usuario en la tabla 'users'
    await client.query('UPDATE users SET booster_level = $1 WHERE id = $2', [newLevel, userId]);
    console.log(`Nivel de impulsor para el usuario ID ${userId} recalculado a ${newLevel} basado en ganancias históricas (${totalBoosterBlue} BLUE).`);
}

/**
 * Helper para determinar el usuario responsable de la deuda RED por username.
 * Valida controles parentales FinTech si el usuario es menor de edad.
 */
async function getDebtResponsibleUser(client, username) {
    const userResult = await client.query(
        `SELECT id, username, is_minor, tutor_user_id, is_suspended_by_tutor, tutor_permissions FROM users WHERE username = $1`,
        [username]
    );

    if (userResult.rowCount === 0) {
        throw new Error(`Usuario no encontrado: ${username}`);
    }

    const user = userResult.rows[0];

    // Validación de controles parentales FinTech si es menor de edad
    if (user.is_minor) {
        // 1. Freno de mano de emergencia: verificar si la cuenta fue congelada por el tutor
        if (user.is_suspended_by_tutor === true) {
            throw { status: 403, message: 'Operación denegada: Tu cuenta ha sido congelada temporalmente por tu tutor legal.' };
        }

        // 2. Permisos granulares JSONB: verificar si el tutor habilitó la contratación
        const perms = typeof user.tutor_permissions === 'string' 
            ? JSON.parse(user.tutor_permissions) 
            : (user.tutor_permissions || {});

        if (perms.allow_contracting === false) {
            throw { status: 403, message: 'Operación denegada: Tu tutor legal no ha habilitado el permiso para contratar tareas.' };
        }
    }

    // Si es menor y tiene tutor legal aprobado, la deuda se asigna al tutor
    if (user.is_minor && user.tutor_user_id) {
        const tutorResult = await client.query(
            `SELECT id, username FROM users WHERE id = $1`,
            [user.tutor_user_id]
        );

        if (tutorResult.rowCount === 0) {
            throw new Error(`Tutor no encontrado para el menor: ${username}`);
        }

        return {
            user_id: tutorResult.rows[0].id,
            username: tutorResult.rows[0].username,
            is_tutor: true,
            minor_username: username
        };
    }

    // Si no es menor o no tiene tutor, la deuda es del usuario mismo
    return {
        user_id: user.id,
        username: user.username,
        is_tutor: false,
        minor_username: null
    };
}

/**
 * Helper para determinar el usuario responsable de la deuda RED por user_id.
 * Valida controles parentales FinTech si el usuario es menor de edad.
 */
async function getDebtResponsibleUserById(client, userId, { useTutor = true } = {}) {
    const userResult = await client.query(
        `SELECT id, username, is_minor, tutor_user_id, is_suspended_by_tutor, tutor_permissions FROM users WHERE id = $1`,
        [userId]
    );

    if (userResult.rowCount === 0) {
        throw new Error(`Usuario no encontrado (id): ${userId}`);
    }

    const user = userResult.rows[0];

    // Validación de controles parentales FinTech si es menor de edad
    if (user.is_minor) {
        // 1. Freno de mano de emergencia: verificar si la cuenta fue congelada por el tutor
        if (user.is_suspended_by_tutor === true) {
            throw { status: 403, message: 'Operación denegada: Tu cuenta ha sido congelada temporalmente por tu tutor legal.' };
        }

        // 2. Permisos granulares JSONB: verificar si el tutor habilitó la contratación
        const perms = typeof user.tutor_permissions === 'string' 
            ? JSON.parse(user.tutor_permissions) 
            : (user.tutor_permissions || {});

        if (perms.allow_contracting === false) {
            throw { status: 403, message: 'Operación denegada: Tu tutor legal no ha habilitado el permiso para contratar tareas.' };
        }
    }

    // Si no usamos tutor (regla económica estricta), la deuda es del autor.
    if (!useTutor) {
        return {
            user_id: user.id,
            username: user.username,
            is_tutor: false,
            minor_username: null
        };
    }

    // Si es menor y tiene tutor, la deuda es del tutor
    if (user.is_minor && user.tutor_user_id) {
        const tutorResult = await client.query(
            `SELECT id, username FROM users WHERE id = $1`,
            [user.tutor_user_id]
        );

        if (tutorResult.rowCount === 0) {
            throw new Error(`Tutor no encontrado para el menor (id): ${userId}`);
        }

        return {
            user_id: tutorResult.rows[0].id,
            username: tutorResult.rows[0].username,
            is_tutor: true,
            minor_username: user.username
        };
    }

    return {
        user_id: user.id,
        username: user.username,
        is_tutor: false,
        minor_username: null
    };
}

/**
 * Procesa la finalización de una publicación de tipo 'solicitud'.
 * Solo actualiza el estado a 'completed' y notifica al autor.
 */
async function processRequestCompletion(client, acceptance) {
    const { title, author_username, acceptance_id, completerUsername } = acceptance;
    await client.query(`UPDATE publication_acceptances SET status = 'completed' WHERE id = $1`, [acceptance_id]);

    const message = `${completerUsername} ha marcado la tarea "${title}" como culminada.`;
    await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [author_username, message]);

    return { success: true, message: "Tarea marcada como culminada. Esperando la confirmación del autor." };
}

/**
 * Procesa el pago final para una publicación de tipo 'solicitud'.
 * Maneja la lógica económica tanto para el modo normal como para el pre-lanzamiento.
 * Soporta autocustodia con PIN de 6 dígitos para autorización de pago Web3.
 */
async function processRequestPayment(client, acceptance, pubId, preLaunchMode, settings, userPin = null) {
    const { blue_cost, base_blue_cost, title, author_username: author, author_id: authorId, workerUsername, workerId: workerIdFromQuery } = acceptance;
    let cost = parseFloat(blue_cost || 0);
    const baseCost = parseFloat(base_blue_cost || 0);

    // ═══════════════════════════════════════════════════════════════════════════
    // AUDITORÍA FINTECH & ZERO-TRUST: Inicialización Segura de Outbox Pattern
    // ═══════════════════════════════════════════════════════════════════════════
    // Se inicializa en null de forma defensiva para asegurar que la función
    // siempre retorne un objeto consistente sin lanzar ReferenceError cuando
    // opera en Modo Pre-Lanzamiento (off-chain virtual en booster_blue_ledger).
    // Si la transacción se procesa en Modo Normal Web3, se le asignará el ID
    // generado en la tabla web3_pending_transactions.
    // ═══════════════════════════════════════════════════════════════════════════
    let web3IntentId = null;

    // MOTOR TRANSACCIONAL HÍBRIDO (OPCIÓN A):
    // Si la plataforma está en pre-lanzamiento o si la tarea en sí es una Tarea de Impulsor (is_booster_task = true),
    // procesamos de forma virtual off-chain mediante el Libro de Impulsores (booster_blue_ledger).
    const isBoosterTx = preLaunchMode || !!acceptance.is_booster_task;

    // AUDITORÍA FINTECH & ZERO-TRUST:
    // Las tareas de impulsor o en pre-lanzamiento (isBoosterTx = true) liquidan dinámicamente según la etapa activa vigente.
    // Si el multiplicador cambia, la liquidación se actualiza de inmediato sin mantener valores congelados anteriores.
    if (isBoosterTx) {
        const effectiveBase = (baseCost > 0) ? baseCost : cost;
        const boosterService = require('./boosterService');
        const currentMultiplierInfo = await boosterService.calculateMultipliedAmount(1);
        const activeMultiplier = parseFloat(currentMultiplierInfo.multiplier || 1.0);
        // Redondeo bancario estricto a 4 decimales para eliminar artefactos de coma flotante binaria
        cost = parseFloat((effectiveBase * activeMultiplier).toFixed(4));
    } else {
        cost = parseFloat(((baseCost > 0) ? baseCost : cost).toFixed(4));
    }

    if (isBoosterTx) {
        // --- MODO PRE-LANZAMIENTO ---
        console.log(`MODO PRE-LANZAMIENTO: Acumulando ${cost} BLUE para ${workerUsername} en perfil de impulsor.`);
        const workerResult = await client.query('SELECT id FROM users WHERE username = $1', [workerUsername]);
        const workerId = workerResult.rows[0].id;
        await client.query('SELECT record_booster_event($1, \'task_reward\', $2, $3)', [workerId, cost, pubId]);
        // ✅ FIX: Registrar también en booster_transactions para que el "Historial de Ganancias" cuadre con el total.
        // Antes: el total subía (ledger) pero el historial solo mostraba bonos/referrals.
        await client.query(
            `INSERT INTO booster_transactions (user_id, type, amount, description, related_publication_id)
             VALUES ($1, 'task_reward', $2, $3, $4)`,
            [workerId, cost, `Tarea de Impulsor: "${title}"`, pubId]
        );
        await client.query('UPDATE users SET is_booster = TRUE WHERE id = $1', [workerId]);
        await updateUserBoosterLevel(client, workerId);
    } else {
        return require('./marketplacePayments').service().begin(client,{
            publicationId:String(pubId),acceptanceId:String(acceptance.acceptance_id),category:'request',
            payer:author,payee:workerUsername,amount:String(blue_cost),expectedFeeBps:acceptance.expectedFeeBps
        },userPin);
    }

    // --- NOTIFICACIONES POR CORREO (RECIBOS) ---
    try {
        const emailQuery = await client.query('SELECT username, email FROM users WHERE username IN ($1, $2)', [author, workerUsername]);
        const authorEmail = emailQuery.rows.find(u => u.username === author)?.email;
        const workerEmail = emailQuery.rows.find(u => u.username === workerUsername)?.email;

        // Determinar la etiqueta de la moneda (BLUE vs BLUE iou)
        // Regla: Si es modo pre-lanzamiento O es tarea de impulsor => "BLUE iou"
        const isBoosterTx = (preLaunchMode || acceptance.is_booster_task);
        const currencyLabel = isBoosterTx ? 'BLUE iou' : 'BLUE';

        // 1. Recibo para el TRABAJADOR (Recibió recompensa)
        if (workerEmail) {
            const workerTitle = 'Tarea Completada';
            const workerMessage = isBoosterTx
                ? `Tu participación ha sido validada y los BLUE iou están en tu Perfil de Impulsor.`
                : `Tu participación ha sido validada y los BLUE están en tu Depósito de Garantía.`;

            await sendTransactionEmail({
                toEmail: workerEmail,
                subject: `¡Tarea completada: "${title}"!`,
                title: workerTitle,
                message: workerMessage,
                amount: `${cost.toFixed(4)} ${currencyLabel}`,
                details: [
                    { label: 'Concepto', value: `Tarea: ${title}` },
                    { label: 'Validado por', value: author },
                    { label: 'Fecha', value: new Date().toLocaleDateString('es-ES') },
                    { label: 'Destino', value: isBoosterTx ? 'Perfil de Impulsor' : 'Escrow (Garantía)' }
                ]
            });
        }

        // 2. Comprobante para el AUTOR (Realizó pago)
        // AUDITORÍA FINTECH: Si es una transacción booster, el monto pagado se marca como Subvencionado en BLUE iou
        // para reflejar que no hay costo real en tokens en esta etapa promocional.
        if (authorEmail) {
            let authMsg = '';
            let authAmount = '';
            let authTitle = '';

            if (isBoosterTx) {
                authTitle = 'Tarea Completada';
                authMsg = `El usuario ${workerUsername} completó tu tarea "${title}". La recompensa ha sido contabilizada en el Perfil de Impulsor de ${workerUsername} como BLUE iou.`;
                authAmount = `${cost.toFixed(4)} ${currencyLabel}`;
            } else {
                const totalPaid = cost * (1 + (parseFloat(settings.platform_commission_percentage || '0') / 100));
                authTitle = 'Pago Enviado';
                authMsg = `Has pagado por la tarea "${title}".`;
                authAmount = `${totalPaid.toFixed(4)} RED`;
            }

            await sendTransactionEmail({
                toEmail: authorEmail,
                subject: `Actualización de tarea: "${title}"`,
                title: authTitle,
                message: authMsg,
                amount: authAmount,
                details: [
                    { label: 'Concepto', value: `Tarea: ${title}` },
                    { label: 'Trabajador', value: workerUsername },
                    { label: 'Fecha', value: new Date().toLocaleDateString('es-ES') }
                ]
            });
        }
    } catch (emailError) {
        console.error('Error al enviar correos de transacción (processRequestPayment):', emailError);
    }


    // AUDITORÍA FINTECH: Grabación de notificación adaptada a booster
    const notificationMessage = isBoosterTx
        ? `¡Has acumulado ${cost.toFixed(4)} BLUE IOU en tu Perfil de Impulsor por la tarea "${title}"!`
        : `¡Has recibido ${cost.toFixed(4)} BLUE (en depósito) por la tarea "${title}"!`;
    await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [workerUsername, notificationMessage]);

    return { success: true, message: "Pago confirmado y tarea finalizada.", web3IntentId };
}


/**
 * Procesa la finalización de una publicación de tipo 'sell' o 'donation'.
 * Maneja la lógica económica de pago en un solo paso.
 * Soporta autocustodia con PIN de 6 dígitos para autorización de pago Web3.
 */
async function processDirectPaymentCompletion(client, acceptance, pubId, preLaunchMode, settings, userPin = null) {
    const { blue_cost, title, author_username: recipient, acceptance_id, category, completerUsername: payer } = acceptance;
    const cost = parseFloat(blue_cost);
    let resultMessage; // Usaremos una variable para el mensaje de retorno
    // AUDITORÍA FINTECH: Inicialización de ID de intención Web3
    let web3IntentId = null;

    // MOTOR TRANSACCIONAL HÍBRIDO (OPCIÓN A):
    // Si la plataforma está en pre-lanzamiento o si la publicación es una Tarea de Impulsor (is_booster_task = true),
    // procesamos de forma virtual off-chain mediante el Libro de Impulsores (booster_blue_ledger).
    const isBoosterTx = preLaunchMode || !!acceptance.is_booster_task;

    if (isBoosterTx) {
        // --- MODO PRE-LANZAMIENTO: Transferencia desde el perfil de impulsor ---
        const payerResult = await client.query('SELECT id FROM users WHERE username = $1', [payer]);
        const payerId = payerResult.rows[0].id;
        const recipientResult = await client.query('SELECT id FROM users WHERE username = $1', [recipient]);
        const recipientId = recipientResult.rows[0].id;

        const FinancialCoreService = require('./financialCoreService');
        const balanceInfo = await FinancialCoreService.getUserEligibleBalance(client, payerId);
        const payerBalance = balanceInfo.totalBalance;
        const eligibleBalance = balanceInfo.eligibleBalance;

        if (eligibleBalance < cost) {
            throw { status: 400, message: `Saldo elegible insuficiente en tu perfil de impulsor. Dispones de ${eligibleBalance.toFixed(4)} BLUE IOU para transaccionar (excluyendo bonos por referidos sin KYC aprobados).` };
        }

        await client.query('SELECT record_booster_event($1, \'payment_sent\', $2, $3)', [payerId, -cost, pubId]);
        await client.query('SELECT record_booster_event($1, \'payment_received\', $2, $3)', [recipientId, cost, pubId]);

        await client.query('INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, $2, $3, $4)', [payerId, `${category}_sent`, -cost, `Envío para: "${title}"`]);
        await client.query('INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, $2, $3, $4)', [recipientId, `${category}_received`, cost, `Recibido de ${payer} para: "${title}"`]);

        await client.query('UPDATE users SET is_booster = TRUE WHERE id IN ($1, $2)', [payerId, recipientId]);
        await updateUserBoosterLevel(client, payerId);
        await updateUserBoosterLevel(client, recipientId);

        const payerNotification = `Has transferido ${cost.toFixed(4)} BLUE IOU de tu perfil de impulsor para "${title}".`;
        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [payer, payerNotification]);
        const recipientNotification = `Has recibido ${cost.toFixed(4)} BLUE IOU en tu perfil de impulsor de ${payer} para "${title}".`;
        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [recipient, recipientNotification]);

        resultMessage = "Transferencia completada exitosamente desde tu perfil de impulsor.";
    } else {
        return require('./marketplacePayments').service().begin(client,{
            publicationId:String(pubId),acceptanceId:acceptance_id?String(acceptance_id):null,category,
            payer,payee:recipient,amount:String(blue_cost),requestId:acceptance.paymentRequestId||null,
            expectedFeeBps:acceptance.expectedFeeBps,completion:acceptance.chainCompletion||null
        },userPin);
    }

    // --- NOTIFICACIONES POR CORREO (RECIBOS) ---
    try {
        const emailQuery = await client.query('SELECT username, email FROM users WHERE username IN ($1, $2)', [payer, recipient]);
        const payerEmail = emailQuery.rows.find(u => u.username === payer)?.email;
        const recipientEmail = emailQuery.rows.find(u => u.username === recipient)?.email;
        const dateStr = new Date().toLocaleDateString('es-ES');

        // 1. Recibo para el COMPRADOR/DONANTE (Pagó)
        // AUDITORÍA FINTECH: Adaptamos el recibo para indicar la moneda (BLUE iou vs RED/BLUE)
        if (payerEmail) {
            let totalPaid = cost;
            let currency = isBoosterTx ? 'BLUE iou' : 'BLUE';
            let status = 'Completado';

            if (!isBoosterTx) {
                totalPaid = cost * (1 + (parseFloat(settings.platform_commission_percentage || '0') / 100));
                currency = 'RED'; // En modo normal genera deuda RED
                status = 'Deuda Generada';
            } else {
                status = 'Transferido (Booster)';
            }

            await sendTransactionEmail({
                toEmail: payerEmail,
                subject: `Recibo de pago: "${title}"`,
                title: 'Pago Realizado',
                message: `Has completado el pago para la publicación "${title}".`,
                amount: `${totalPaid.toFixed(4)} ${currency}`,
                details: [
                    { label: 'Concepto', value: title },
                    { label: 'Beneficiario', value: recipient },
                    { label: 'Fecha', value: dateStr },
                    { label: 'Estado', value: status }
                ]
            });
        }

        // 2. Notificación para el VENDEDOR/RECEPTOR (Recibió)
        // AUDITORÍA FINTECH: Adaptamos el recibo para reflejar el estado del perfil de impulsor
        if (recipientEmail) {
            const receiveStatus = isBoosterTx ? 'Recibido (Booster)' : 'En Depósito (Escrow)';
            const currencyLabel = isBoosterTx ? 'BLUE iou' : 'BLUE';
            await sendTransactionEmail({
                toEmail: recipientEmail,
                subject: `¡Te han pagado por "${title}"!`,
                title: 'Nuevo Pago Recibido',
                message: `${payer} ha pagado por tu publicación "${title}".`,
                amount: `${cost.toFixed(4)} ${currencyLabel}`,
                details: [
                    { label: 'Concepto', value: title },
                    { label: 'Pagador', value: payer },
                    { label: 'Fecha', value: dateStr },
                    { label: 'Estado', value: receiveStatus }
                ]
            });
        }
    } catch (emailError) {
        console.error('Error al enviar correos de transacción (processDirectPaymentCompletion):', emailError);
    }

    // Actualizar el estado de la aceptación a 'confirmed_paid' (solo si existe acceptance_id)
    if (acceptance_id) {
        await client.query(`UPDATE publication_acceptances SET status = 'confirmed_paid' WHERE id = $1`, [acceptance_id]);
    }

    return { success: true, message: resultMessage, web3IntentId };
}

module.exports = {
    resolveRepeatCooldownHours,
    updateUserBoosterLevel,
    getDebtResponsibleUser,
    getDebtResponsibleUserById,
    processRequestCompletion,
    processRequestPayment,
    processDirectPaymentCompletion
};
