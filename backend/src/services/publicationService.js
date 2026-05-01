// ============================================================================
// src/services/publicationService.js
// ============================================================================

const pool = require('../config/db');
const { sendTransactionEmail } = require('./emailService');
const logAuditEvent = require('./auditService');
const Web3BridgeService = require('./web3BridgeService');

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
async function updateUserBoosterLevel(client, userId) {
    // 1. Calcular el total de BLUE de impulsor que tiene el usuario
    const totalBlueResult = await client.query(
        'SELECT SUM(amount) as total FROM booster_blue_ledger WHERE user_id = $1',
        [userId]
    );
    const totalBoosterBlue = parseFloat(totalBlueResult.rows[0].total) || 0;

    // 2. Encontrar el nivel más alto que el usuario ha alcanzado
    const levelResult = await client.query(
        'SELECT MAX(level) as current_level FROM booster_level_settings WHERE min_blue_required <= $1',
        [totalBoosterBlue]
    );
    const newLevel = levelResult.rows[0].current_level || 0;

    // 3. Actualizar el nivel del usuario en la tabla 'users'
    await client.query('UPDATE users SET booster_level = $1 WHERE id = $2', [newLevel, userId]);
    console.log(`Nivel de impulsor para el usuario ID ${userId} actualizado a ${newLevel}.`);
}

/**
 * Helper para determinar el usuario responsable de la deuda RED
 * Si es menor, la deuda se asigna al tutor; si no, al usuario mismo
 */
async function getDebtResponsibleUser(client, username) {
    const userResult = await client.query(
        `SELECT id, username, is_minor, tutor_user_id FROM users WHERE username = $1`,
        [username]
    );

    if (userResult.rowCount === 0) {
        throw new Error(`Usuario no encontrado: ${username}`);
    }

    const user = userResult.rows[0];

    // Si es menor y tiene tutor, la deuda es del tutor
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
 * Preferido en flujos críticos (evita errores por username).
 */
async function getDebtResponsibleUserById(client, userId, { useTutor = true } = {}) {
    const userResult = await client.query(
        `SELECT id, username, is_minor, tutor_user_id FROM users WHERE id = $1`,
        [userId]
    );

    if (userResult.rowCount === 0) {
        throw new Error(`Usuario no encontrado (id): ${userId}`);
    }

    const user = userResult.rows[0];

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
 */
async function processRequestPayment(client, acceptance, pubId, preLaunchMode, settings) {
    const { blue_cost, title, author_username: author, author_id: authorId, workerUsername, workerId: workerIdFromQuery } = acceptance;
    const cost = parseFloat(blue_cost);

    if (preLaunchMode) {
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
        // --- MODO NORMAL ---
        const debtInterval = `${settings.debt_cycle_days || 30} days ${settings.debt_cycle_hours || 0} hours ${settings.debt_cycle_minutes || 0} minutes`;
        const escrowInterval = `${settings.blue_escrow_days || 1} days ${settings.blue_escrow_hours || 0} hours ${settings.blue_escrow_minutes || 0} minutes`;
        const commissionPercentage = parseFloat(settings.platform_commission_percentage || '0');
        const commissionAmount = cost * (commissionPercentage / 100);
        const redForAuthor = cost + commissionAmount;

        // Determinar quién es responsable de la deuda (tutor si es menor).
        // Los menores de edad no pueden asumir obligaciones financieras legalmente,
        // por lo que su tutor asume la deuda RED (consistente con ventas y venta rápida).
        const debtResponsible = authorId
            ? await getDebtResponsibleUserById(client, authorId, { useTutor: true })
            : await getDebtResponsibleUser(client, author);

        // Guard de seguridad: nunca cargar RED al trabajador de una solicitud.
        if (workerIdFromQuery && debtResponsible.user_id === workerIdFromQuery) {
            await logAuditEvent(client, null, {
                eventType: 'economic_rules_violation.request_debt_on_worker',
                actorUsername: author,
                targetUsername: workerUsername,
                publicationId: pubId,
                category: 'request',
                metadata: {
                    reason: 'Debt responsible matches worker (unexpected).',
                    cost
                }
            });
            throw new Error('Regla económica violada: la deuda RED no puede asignarse al trabajador.');
        }

        // Actualizar saldo RED del responsable (tutor si es menor, autor si no)
        // Usamos 'credit' para AUMENTAR el balance de deuda (RED)
        await client.query(`SELECT record_balance_event($1, 'credit', 'red', $2, NULL)`, [debtResponsible.user_id, redForAuthor]);
        await client.query(`INSERT INTO red_token_debts (user_id, username, amount, due_at) VALUES ($1, $2, $3, NOW() + INTERVAL '${debtInterval}')`, [debtResponsible.user_id, debtResponsible.username, redForAuthor]);

        // Si la deuda es del tutor (menor con tutor), notificar al tutor
        if (debtResponsible.is_tutor) {
            await client.query(
                `INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`,
                [debtResponsible.username, `Se ha generado una deuda RED de ${redForAuthor.toFixed(4)} asociada a la cuenta del menor ${debtResponsible.minor_username} por la tarea "${acceptance.title}". Tú eres responsable de esta deuda como tutor.`]
            );
        }

        // Obtener el user_id del trabajador para insertarlo en blue_token_escrows
        const workerId = workerIdFromQuery
            ? workerIdFromQuery
            : await (async () => {
                const workerResult = await client.query('SELECT id FROM users WHERE username = $1', [workerUsername]);
                if (!workerResult.rows.length) {
                    throw new Error(`Usuario no encontrado: ${workerUsername}`);
                }
                return workerResult.rows[0].id;
            })();

        // Usamos 'payment_received' para AUMENTAR el balance en escrow (BLUE)
        await client.query(`SELECT record_balance_event($1, 'payment_received', 'escrow_blue', $2, NULL)`, [workerId, cost]);
        await client.query(`INSERT INTO blue_token_escrows (user_id, username, amount, unlock_at) VALUES ($1, $2, $3, NOW() + INTERVAL '${escrowInterval}')`, [workerId, workerUsername, cost]);

        // Asignar comisión a la plataforma como tokens BLUE reales (cumple reglas económicas)
        const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
        if (commissionAmount > 0) {
            const platformResult = await client.query('SELECT id FROM users WHERE username = $1', [platformUsername]);
            if (platformResult.rows.length > 0) {
                const platformId = platformResult.rows[0].id;
                // La plataforma recibe la comisión directamente como BLUE líquido (no en escrow)
                // Usamos 'payment_received' para AUMENTAR el balance líquido (BLUE)
                await client.query(`SELECT record_balance_event($1, 'payment_received', 'liquid_blue', $2, NULL)`, [platformId, commissionAmount]);
                await client.query(`INSERT INTO transactions (user_id, type, description, blue_change, red_change, related_publication_id) VALUES ($1, 'commission_received', $2, $3, 0, $4)`, [platformId, `Comisión por: "${title}"`, commissionAmount, pubId]);
            }
        }

        await client.query(`INSERT INTO platform_wallet (id, total_blue_commission_balance) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET total_blue_commission_balance = platform_wallet.total_blue_commission_balance + $1`, [commissionAmount]);

        const authorTxResult = await client.query(`INSERT INTO transactions (user_id, type, description, blue_change, red_change, related_publication_id, platform_fee_blue) VALUES ($1, 'payment_sent', $2, 0, $3, $4, $5) RETURNING id`, [debtResponsible.user_id, `Pagaste por: "${title}"${debtResponsible.is_tutor ? ` (como tutor de ${debtResponsible.minor_username})` : ''}`, redForAuthor, pubId, commissionAmount]);
        const authorTxId = authorTxResult.rows[0].id;
        await client.query(`INSERT INTO transactions (user_id, type, description, blue_change, red_change, related_publication_id) VALUES ($1, 'payment_received', $2, $3, 0, $4)`, [workerId, `Realizaste: "${title}"`, cost, pubId]);

        await client.query(`INSERT INTO platform_commission_log (related_publication_id, related_user_transaction_id, commission_amount_blue) VALUES ($1, $2, $3)`, [pubId, authorTxId, commissionAmount]);

        // --- SINCRONIZACIÓN ON-CHAIN (No Bloqueante) ---
        // Consultar las direcciones Web3 de ambos usuarios para la meta-transacción.
        // Se dispara en segundo plano: si falla, el pago en BD ya está confirmado.
        const walletQuery = await client.query(
            `SELECT username, web3_wallet_address FROM users WHERE username IN ($1, $2)`,
            [author, workerUsername]
        );
        const payerWallet = walletQuery.rows.find(u => u.username === author)?.web3_wallet_address;
        const payeeWallet = walletQuery.rows.find(u => u.username === workerUsername)?.web3_wallet_address;

        // Disparar la escritura on-chain SIN bloquear la respuesta al usuario
        Web3BridgeService.syncPaymentToBlockchain({
            payerWalletAddress: payerWallet,
            payeeWalletAddress: payeeWallet,
            amountBlue: cost,
            dbTransactionId: authorTxId,
            publicationId: pubId,
            payerUsername: author,
            payeeUsername: workerUsername
        }).catch(err => console.error('[WEB3 BRIDGE] Error no bloqueante (request):', err.message));
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
        if (authorEmail) {
            let authMsg = '';
            let authAmount = '';
            let authTitle = '';

            if (preLaunchMode) {
                authTitle = 'Tarea Completada';
                authMsg = `El usuario ${workerUsername} completó tu tarea "${title}". El sistema ha enviado la recompensa.`;
                authAmount = `${cost.toFixed(4)} ${currencyLabel} (Subvencionado)`;
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


    const notificationMessage = preLaunchMode
        ? `¡Has acumulado ${cost.toFixed(4)} BLUE en tu Perfil de Impulsor por la tarea "${title}"!`
        : `¡Has recibido ${cost.toFixed(4)} BLUE (en depósito) por la tarea "${title}"!`;
    await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [workerUsername, notificationMessage]);

    return { success: true, message: "Pago confirmado y tarea finalizada." };
}


/**
 * Procesa la finalización de una publicación de tipo 'sell' o 'donation'.
 * Maneja la lógica económica de pago en un solo paso.
 */
async function processDirectPaymentCompletion(client, acceptance, pubId, preLaunchMode, settings) {
    const { blue_cost, title, author_username: recipient, acceptance_id, category, completerUsername: payer } = acceptance;
    const cost = parseFloat(blue_cost);
    let resultMessage; // Usaremos una variable para el mensaje de retorno

    if (preLaunchMode) {
        // --- MODO PRE-LANZAMIENTO: Transferencia desde el perfil de impulsor ---
        const payerResult = await client.query('SELECT id FROM users WHERE username = $1', [payer]);
        const payerId = payerResult.rows[0].id;
        const recipientResult = await client.query('SELECT id FROM users WHERE username = $1', [recipient]);
        const recipientId = recipientResult.rows[0].id;

        const payerBalanceResult = await client.query('SELECT SUM(amount) as total FROM booster_blue_ledger WHERE user_id = $1', [payerId]);
        const payerBalance = parseFloat(payerBalanceResult.rows[0].total) || 0;

        if (payerBalance < cost) {
            throw { status: 400, message: 'Saldo insuficiente en tu perfil de impulsor para esta acción.' };
        }

        await client.query('SELECT record_booster_event($1, \'payment_sent\', $2, $3)', [payerId, -cost, pubId]);
        await client.query('SELECT record_booster_event($1, \'payment_received\', $2, $3)', [recipientId, cost, pubId]);

        await client.query('INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, $2, $3, $4)', [payerId, `${category}_sent`, -cost, `Envío para: "${title}"`]);
        await client.query('INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, $2, $3, $4)', [recipientId, `${category}_received`, cost, `Recibido de ${payer} para: "${title}"`]);

        await client.query('UPDATE users SET is_booster = TRUE WHERE id IN ($1, $2)', [payerId, recipientId]);
        await updateUserBoosterLevel(client, payerId);
        await updateUserBoosterLevel(client, recipientId);

        const payerNotification = `Has transferido ${cost.toFixed(4)} BLUE de tu perfil de impulsor para "${title}".`;
        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [payer, payerNotification]);
        const recipientNotification = `Has recibido ${cost.toFixed(4)} BLUE en tu perfil de impulsor de ${payer} para "${title}".`;
        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [recipient, recipientNotification]);

        resultMessage = "Transferencia completada exitosamente desde tu perfil de impulsor.";
    } else {
        // --- MODO NORMAL: Creación de tokens RED/BLUE ---
        const debtInterval = `${settings.debt_cycle_days || 30} days ${settings.debt_cycle_hours || 0} hours ${settings.debt_cycle_minutes || 0} minutes`;
        const escrowInterval = `${settings.blue_escrow_days || 1} days ${settings.blue_escrow_hours || 0} hours ${settings.blue_escrow_minutes || 0} minutes`;
        const commissionPercentage = parseFloat(settings.platform_commission_percentage || '0');
        const commissionAmount = cost * (commissionPercentage / 100);
        const redForPayer = cost + commissionAmount;

        // Determinar quién es responsable de la deuda (tutor si es menor)
        const debtResponsible = await getDebtResponsibleUser(client, payer);

        // Actualizar saldo RED del responsable (tutor si es menor, pagador si no)
        // Usamos 'credit' para AUMENTAR el balance de deuda (RED)
        await client.query(`SELECT record_balance_event($1, 'credit', 'red', $2, NULL)`, [debtResponsible.user_id, redForPayer]);
        await client.query(`INSERT INTO red_token_debts (user_id, username, amount, due_at) VALUES ($1, $2, $3, NOW() + INTERVAL '${debtInterval}')`, [debtResponsible.user_id, debtResponsible.username, redForPayer]);

        // Si la deuda es del tutor (menor con tutor), notificar al tutor
        if (debtResponsible.is_tutor) {
            await client.query(
                `INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`,
                [debtResponsible.username, `Se ha generado una deuda RED de ${redForPayer.toFixed(4)} asociada a la cuenta del menor ${debtResponsible.minor_username} por "${acceptance.title}". Tú eres responsable de esta deuda como tutor.`]
            );
        }

        // Obtener el user_id del recipiente para insertarlo en blue_token_escrows
        const recipientResult = await client.query('SELECT id FROM users WHERE username = $1', [recipient]);
        if (!recipientResult.rows.length) {
            throw new Error(`Usuario no encontrado: ${recipient}`);
        }
        const recipientId = recipientResult.rows[0].id;

        // Usamos 'payment_received' para AUMENTAR el balance en escrow (BLUE)
        await client.query(`SELECT record_balance_event($1, 'payment_received', 'escrow_blue', $2, NULL)`, [recipientId, cost]);
        await client.query(`INSERT INTO blue_token_escrows (user_id, username, amount, unlock_at) VALUES ($1, $2, $3, NOW() + INTERVAL '${escrowInterval}')`, [recipientId, recipient, cost]);

        // Asignar comisión a la plataforma como tokens BLUE reales (cumple reglas económicas)
        const platformUsername = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';
        if (commissionAmount > 0) {
            const platformResult = await client.query('SELECT id FROM users WHERE username = $1', [platformUsername]);
            if (platformResult.rows.length > 0) {
                const platformId = platformResult.rows[0].id;
                // La plataforma recibe la comisión directamente como BLUE líquido (no en escrow)
                // Usamos 'payment_received' para AUMENTAR el balance líquido (BLUE)
                await client.query(`SELECT record_balance_event($1, 'payment_received', 'liquid_blue', $2, NULL)`, [platformId, commissionAmount]);
                await client.query(`INSERT INTO transactions (user_id, type, description, blue_change, red_change, related_publication_id) VALUES ($1, 'commission_received', $2, $3, 0, $4)`, [platformId, `Comisión por: "${title}"`, commissionAmount, pubId]);
            }
        }

        await client.query(`INSERT INTO platform_wallet (id, total_blue_commission_balance) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET total_blue_commission_balance = platform_wallet.total_blue_commission_balance + $1`, [commissionAmount]);

        const payerTxResult = await client.query(`INSERT INTO transactions (user_id, type, description, blue_change, red_change, related_publication_id, platform_fee_blue) VALUES ($1, 'payment_sent', $2, 0, $3, $4, $5) RETURNING id`, [debtResponsible.user_id, `Pagaste por: "${title}"${debtResponsible.is_tutor ? ` (como tutor de ${debtResponsible.minor_username})` : ''}`, redForPayer, pubId, commissionAmount]);
        const payerTxId = payerTxResult.rows[0].id;
        await client.query(`INSERT INTO transactions (user_id, type, description, blue_change, red_change, related_publication_id) VALUES ($1, 'payment_received', $2, $3, 0, $4)`, [recipientId, `Recibiste por: "${title}"`, cost, pubId]);

        await client.query(`INSERT INTO platform_commission_log (related_publication_id, related_user_transaction_id, commission_amount_blue) VALUES ($1, $2, $3)`, [pubId, payerTxId, commissionAmount]);

        // --- SINCRONIZACIÓN ON-CHAIN (No Bloqueante) ---
        // Consultar las direcciones Web3 de ambos usuarios para la meta-transacción.
        const walletQuery = await client.query(
            `SELECT username, web3_wallet_address FROM users WHERE username IN ($1, $2)`,
            [payer, recipient]
        );
        const payerWallet = walletQuery.rows.find(u => u.username === payer)?.web3_wallet_address;
        const payeeWallet = walletQuery.rows.find(u => u.username === recipient)?.web3_wallet_address;

        // Disparar la escritura on-chain SIN bloquear la respuesta al usuario
        Web3BridgeService.syncPaymentToBlockchain({
            payerWalletAddress: payerWallet,
            payeeWalletAddress: payeeWallet,
            amountBlue: cost,
            dbTransactionId: payerTxId,
            publicationId: pubId,
            payerUsername: payer,
            payeeUsername: recipient
        }).catch(err => console.error('[WEB3 BRIDGE] Error no bloqueante (direct):', err.message));

        const recipientNotification = `¡Has recibido el pago de ${cost.toFixed(4)} BLUE (en depósito) por "${title}" de parte de ${payer}!`;
        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [recipient, recipientNotification]);

        resultMessage = "¡Compra/Donación completada y pagada! Gracias.";
    }

    // --- NOTIFICACIONES POR CORREO (RECIBOS) ---
    try {
        const emailQuery = await client.query('SELECT username, email FROM users WHERE username IN ($1, $2)', [payer, recipient]);
        const payerEmail = emailQuery.rows.find(u => u.username === payer)?.email;
        const recipientEmail = emailQuery.rows.find(u => u.username === recipient)?.email;
        const dateStr = new Date().toLocaleDateString('es-ES');

        // 1. Recibo para el COMPRADOR/DONANTE (Pagó)
        if (payerEmail) {
            let totalPaid = cost;
            let currency = 'BLUE';
            let status = 'Completado';

            if (!preLaunchMode) {
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
        if (recipientEmail) {
            const receiveStatus = preLaunchMode ? 'Recibido (Booster)' : 'En Depósito (Escrow)';
            await sendTransactionEmail({
                toEmail: recipientEmail,
                subject: `¡Te han pagado por "${title}"!`,
                title: 'Nuevo Pago Recibido',
                message: `${payer} ha pagado por tu publicación "${title}".`,
                amount: `${cost.toFixed(4)} BLUE`,
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

    return { success: true, message: resultMessage };
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
