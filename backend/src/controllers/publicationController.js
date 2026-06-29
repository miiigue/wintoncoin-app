// ============================================================================
// src/controllers/publicationController.js
// ============================================================================

const {
    resolveRepeatCooldownHours,
    updateUserBoosterLevel,
    processRequestPayment,
    processDirectPaymentCompletion,
    processRequestCompletion
} = require('../services/publicationService');

const notificationService = require('../services/notificationService');

module.exports = function (router, pool, requireAcceptedLegalByUsernameField, verifyAdminToken, logAuditEvent) {
    /**
     * Resuelve el actor canónico para auditoría/autorización.
     * - Usuario final: req.user.username (JWT) es la fuente de verdad.
     * - Admin: usamos fallback explícito para compatibilidad con flujos legacy.
     */
    function resolveActorUsername(req, fallbackUsername) {
        const isAdmin = req.user && req.user.role === 'admin';
        if (!isAdmin) {
            return (req.user?.username || fallbackUsername || '').trim();
        }
        return (fallbackUsername || process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin').trim();
    }

    // Ruta para crear una nueva Publicación
    router.post('/publish', requireAcceptedLegalByUsernameField(['authorUsername']), async (req, res) => {
        const {
            title, description, blueCost, blueSell, authorUsername,
            availableSlots, autoApprove, publicationType,
            duration_days, duration_hours, duration_minutes,
            allowRepeatParticipation, maxRepeatPerUser, repeatCooldownHours,
            repeatCooldownDays, repeatCooldownMinutes,
            goalAmount, // Nuevo campo recogido del frontend
            beneficiaryReferralCode // CÓDIGO DE REFERIDO: Recibido en campañas de donación
        } = req.body;

        if (!title || !description || !authorUsername || (!blueCost && !blueSell && !goalAmount) || !publicationType) {
            return res.status(400).json({ message: "Faltan datos requeridos para la publicación." });
        }

        const client = await pool.connect();
        try {
            // --- INICIO DE LA TRANSACCIÓN ---
            await client.query('BEGIN');

            // --- VALIDACIÓN DE REFERIDO DE BENEFICIARIO PARA DONACIONES ---
            // Asegurar que el código ingresado por el influencer pertenezca a un usuario registrado
            // y activo antes de proceder con el guardado de la publicación.
            let beneficiaryUser = null;
            if (publicationType === 'donation') {
                if (!beneficiaryReferralCode || !beneficiaryReferralCode.trim()) {
                    throw { status: 400, message: "El código de referido del beneficiario es requerido para campañas de donación." };
                }
                const cleanRefCode = beneficiaryReferralCode.trim().toUpperCase();
                const beneficiaryRes = await client.query('SELECT id, username FROM users WHERE referral_code = $1', [cleanRefCode]);
                if (beneficiaryRes.rowCount === 0) {
                    throw { status: 400, message: "El código de referido del beneficiario no es válido o no está registrado." };
                }
                beneficiaryUser = beneficiaryRes.rows[0];
            }

            // 1. VERIFICAR PERMISOS DE PUBLICACIÓN Y CARGAR CONFIGURACIÓN ECONÓMICA
            // Se cargan tanto los permisos de tipo de publicación como los parámetros
            // económicos necesarios para el cálculo de solvencia y Escrow Web3.
            const settingsKeys = [
                'allow_request_publications',
                'allow_sell_publications',
                'allow_donation_publications',
                'platform_commission_percentage',
                'pre_launch_mode_enabled'
            ];
            const settingsResult = await client.query(`SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1::text[])`, [settingsKeys]);
            // Almacenar valores crudos (string) para poder convertir a boolean o número según contexto.
            const settings = settingsResult.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

            const typePermissionMap = {
                'request': settings.allow_request_publications === 'true',
                'sell': settings.allow_sell_publications === 'true',
                'donation': settings.allow_donation_publications === 'true'
            };

            if (!typePermissionMap[publicationType]) {
                throw { status: 403, message: `La creación de publicaciones de tipo "${publicationType}" está desactivada temporalmente.` };
            }

            const isSellPost = publicationType === 'sell' || publicationType === 'donation';

            // Lógica de costo: 
            // - Si es donación, usamos goalAmount (la meta).
            // - Si es venta o solicitud, usamos blueSell o blueCost.
            let cost = 0;
            let goal = null;

            if (publicationType === 'donation') {
                goal = parseFloat(goalAmount.toString().replace(',', '.'));
                if (isNaN(goal) || goal <= 0) {
                    throw { status: 400, message: "La meta de recaudación debe ser un número positivo." };
                }
                // Para donaciones, el blue_cost de la tabla lo usamos como el "monto sugerido" o 0
                // Pero para mantener compatibilidad con el sistema de slots, podemos poner un número simbólico
                cost = 0;
            } else {
                const costString = (blueSell || blueCost).toString().replace(',', '.');
                cost = parseFloat(costString);
                if (isNaN(cost) || cost <= 0) {
                    throw { status: 400, message: "El costo o recompensa debe ser un número positivo." };
                }
            }

            // Para donaciones profesionales, permitimos "infinitos" cupos (slots) 
            // porque la limitación será el goal_amount, no las personas.
            let slots = availableSlots ? parseInt(availableSlots, 10) : 1;
            if (publicationType === 'donation') {
                slots = 999999; // Prácticamente infinito
            } else if (isNaN(slots) || slots < 1) {
                throw { status: 400, message: "La cantidad de cupos disponibles debe ser mayor a 0." };
            }

            const allowRepeat = !!allowRepeatParticipation;
            let maxRepeat = null;
            let repeatCooldown = 24;
            if (allowRepeat) {
                maxRepeat = parseInt(maxRepeatPerUser, 10);
                if (!Number.isFinite(maxRepeat) || maxRepeat < 2) {
                    throw { status: 400, message: "Indica el máximo de repeticiones por usuario (mínimo 2)." };
                }
                repeatCooldown = resolveRepeatCooldownHours({
                    repeatCooldownDays,
                    repeatCooldownHours,
                    repeatCooldownMinutes
                });
            } else {
                maxRepeat = 1;
                repeatCooldown = 24;
            }

            const userResult = await client.query(`SELECT id, is_minor, tutor_user_id, account_status, web3_wallet_address, kyc_verified FROM users WHERE username = $1`, [authorUsername]);
            if (userResult.rowCount === 0) {
                throw { status: 404, message: "El autor de la publicación no existe." };
            }
            const author = userResult.rows[0];
            const authorId = author.id;

            let kycWallet = author.web3_wallet_address;

            // Verificar si es menor sin tutor
            if (author.is_minor) {
                if (!author.tutor_user_id || author.account_status === 'pending_tutor') {
                    await client.query('ROLLBACK');
                    return res.status(403).json({
                        message: "Por ser menor de edad, necesitas la autorización de un tutor para crear publicaciones. Por favor, agrega un tutor a tu cuenta primero.",
                        requires_tutor: true,
                        is_minor: true
                    });
                }
                const tutorResult = await client.query(`SELECT web3_wallet_address FROM users WHERE id = $1`, [author.tutor_user_id]);
                if (tutorResult.rowCount > 0) {
                    kycWallet = tutorResult.rows[0].web3_wallet_address;
                }
            }

            // === FRENO KYC FINTECH (Web3 Single Source of Truth) ===
            // Validar KYC en la Blockchain antes de permitir publicaciones de gasto.
            // En Modo Pre-lanzamiento (pre_launch_mode_enabled == 'true'), se exime esta validación para permitir la actividad off-chain en el Libro de Impulsores.
            if (!isSellPost && settings.pre_launch_mode_enabled !== 'true') { 
                const Web3BridgeService = require('../services/web3BridgeService');
                let isKycVerified = await Web3BridgeService.checkUserKYC(kycWallet);
                if (!isKycVerified && author.kyc_verified) {
                    console.log(`[PUB CREATION] Fallback activado: KYC on-chain falló o dio false para ${authorUsername}, pero usuario está verificado en la base de datos.`);
                    isKycVerified = true;
                }
                if (!isKycVerified) {
                    await client.query('ROLLBACK');
                    return res.status(403).json({
                        message: "Seguridad Financiera: Para publicar tareas y emitir pagos en token BLUE, debes completar tu verificación de identidad (KYC) en tu Billetera Web3.",
                        requires_kyc: true
                    });
                }
            }

            // --- NUEVO: Lógica para calcular la fecha de expiración ---
            let expiresAt = null;
            const days = parseInt(duration_days, 10) || 0;
            const hours = parseInt(duration_hours, 10) || 0;
            const minutes = parseInt(duration_minutes, 10) || 0;

            if (days > 0 || hours > 0 || minutes > 0) {
                expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + days);
                expiresAt.setHours(expiresAt.getHours() + hours);
                expiresAt.setMinutes(expiresAt.getMinutes() + minutes);
            }

            // --- Freno de Solvencia (Pre-autorización) ---
            // Solo aplica a publicaciones tipo 'request' (solicitud de trabajo).
            // Calcula el riesgo total que asume el autor al crear la publicación
            // y verifica que tenga suficiente crédito disponible.
            if (publicationType === 'request') {
                const commissionPercentage = parseFloat(settings.platform_commission_percentage || '0');
                const costPerTask = cost * (1 + commissionPercentage / 100);
                const totalRisk = costPerTask * slots * maxRepeat;

                const { getDebtResponsibleUserById } = require('../services/publicationService');
                const creditScoringService = require('../services/creditScoringService');

                const debtResponsible = await getDebtResponsibleUserById(client, authorId, { useTutor: true });
                // FOR UPDATE: Bloqueo pesimista para prevenir doble gasto concurrente.
                // Si dos solicitudes llegan al mismo tiempo, la segunda ESPERA a que
                // la primera termine antes de leer el saldo. Estándar bancario (ISO 27001).
                const currentRedRes = await client.query(
                    'SELECT red_balance, liquid_blue_balance FROM users WHERE id = $1 FOR UPDATE',
                    [debtResponsible.user_id]
                );
                const currentRed = parseFloat(currentRedRes.rows[0].red_balance) || 0;
                const liquidBlue = parseFloat(currentRedRes.rows[0].liquid_blue_balance) || 0;
                
                // ═══════════════════════════════════════════════════════════════
                // CÁLCULO DE PODER ADQUISITIVO:
                // Restar los fondos ya bloqueados en Escrow Web3 activos.
                // Esto previene el ataque de doble gasto: si el usuario ya tiene
                // publicaciones activas, su poder adquisitivo real es MENOR.
                // ═══════════════════════════════════════════════════════════════
                const escrowLockedRes = await client.query(
                    `SELECT COALESCE(SUM(amount_locked), 0) as total_locked
                     FROM web3_escrow_holds
                     WHERE author_id = $1 AND status = 'locked'`,
                    [debtResponsible.user_id]
                );
                const alreadyLocked = parseFloat(escrowLockedRes.rows[0].total_locked) || 0;

                const scoreLimit = await creditScoringService.calculateUserScore(debtResponsible.user_id);
                const availableCredit = Math.max(0, scoreLimit - currentRed - alreadyLocked);

                // El usuario puede publicar si tiene suficiente crédito disponible
                // (descontando lo que ya tiene bloqueado en otras publicaciones activas).
                if (totalRisk > (availableCredit + liquidBlue)) {
                    throw { status: 402, message: `Fondos Insuficientes para publicar. Esta tarea requiere garantizar ${totalRisk.toFixed(4)} BLUE/RED. Tu límite disponible es ${(availableCredit + liquidBlue).toFixed(2)} (ya tienes ${alreadyLocked.toFixed(2)} bloqueados en otras publicaciones).` };
                }
            }
            // ----------------------------------------------------

            const sql = `
                        INSERT INTO publications
                            (title, description, blue_cost, is_sell_post, author_id, available_slots, auto_approve, category, expires_at, allow_repeat_participation, max_repeat_per_user, repeat_cooldown_hours, show_preflight_modal, goal_amount, beneficiary_referral_code)
                        VALUES
                            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                        RETURNING id
                    `;
            const result = await client.query(sql, [
                title,
                description,
                cost,
                isSellPost,
                authorId,
                slots,
                !!autoApprove,
                publicationType,
                expiresAt,
                allowRepeat,
                maxRepeat,
                repeatCooldown,
                !!req.body.show_preflight_modal,
                goal,
                beneficiaryUser ? beneficiaryUser.referral_code : null
            ]);

            await logAuditEvent(client, req, {
                eventType: 'publication.created',
                actorUsername: authorUsername,
                publicationId: result.rows[0].id,
                category: publicationType,
                metadata: {
                    blue_cost: cost,
                    available_slots: slots,
                    auto_approve: !!autoApprove,
                    allow_repeat_participation: allowRepeat,
                    max_repeat_per_user: maxRepeat,
                    repeat_cooldown_hours: repeatCooldown,
                    expires_at: expiresAt ? expiresAt.toISOString() : null
                }
            });

            // ═══════════════════════════════════════════════════════════════
            // ESCROW WEB3: Bloquear fondos al momento de crear la publicación.
            // Se ejecuta DENTRO de la transacción principal (antes del COMMIT)
            // para eliminar la ventana de race condition donde un segundo
            // request podría leer escrow = 0 entre el COMMIT y el INSERT.
            // La FK a publications(id) funciona porque la publicación ya fue
            // insertada en esta misma transacción (aún no commiteada).
            // Solo aplica en modo Web3 real (NO en pre-lanzamiento).
            // ═══════════════════════════════════════════════════════════════
            const isPreLaunch = settings.pre_launch_mode_enabled === 'true';
            if (publicationType === 'request' && !isPreLaunch && cost > 0) {
                const commissionPct = parseFloat(settings.platform_commission_percentage || '0');
                const costPerTask = cost * (1 + commissionPct / 100);
                const totalToLock = costPerTask * slots * maxRepeat;

                // Determinar responsable de la deuda (tutor si es menor).
                const { getDebtResponsibleUserById } = require('../services/publicationService');
                const debtResponsible = await getDebtResponsibleUserById(client, authorId, { useTutor: true });

                // Insertar el bloqueo de fondos en la tabla web3_escrow_holds.
                // Usa el mismo 'client' de la transacción para garantizar atomicidad.
                await client.query(
                    `INSERT INTO web3_escrow_holds
                        (publication_id, author_id, responsible_user_id, amount_locked, commission_rate_locked, status)
                     VALUES ($1, $2, $3, $4, $5, 'locked')`,
                    [result.rows[0].id, authorId, debtResponsible.user_id, totalToLock, commissionPct]
                );
                console.log(`[ESCROW WEB3] ✅ Bloqueados ${totalToLock.toFixed(4)} BLUE/RED para publicación #${result.rows[0].id}`);
            }

            await client.query('COMMIT');
            console.log(`[ROUTE DIAGNOSTIC] ✅ Transacción de publicación confirmada. ID: ${result.rows[0].id}`);

            res.status(201).json({ message: "Publicación creada exitosamente.", publicationId: result.rows[0].id });

            // Enviamos la notificación DESPUÉS de responder al cliente (Non-blocking)
            // para que si falla el push, el usuario no reciba error de "Failed to fetch"
            try {
                console.log(`[ROUTE DIAGNOSTIC] 🔔 Disparando notificación push para: ${title}`);
                await notificationService.sendNotificationToAll({
                    title: '🚀 Nueva Tarea Disponible',
                    body: `${title}. ¡Participa ahora y gana BLUE IOU en tu perfil de impulsor!`,
                    icon: '/assets/icons/icon-192x192.png',
                    data: { url: '/momentum-dashboard.html' }
                }, 'SOCIAL');
            } catch (pushErr) {
                console.error("[PUSH DIAGNOSTIC] Error al disparar broadcast:", pushErr.message);
            }

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error al guardar la publicación:", error);
            res.status(error.status || 500).json({ message: error.message || "Error interno del servidor." });
        } finally {
            client.release();
        }
    });

    // Ruta para obtener publicaciones activas (y opcionalmente las que el usuario ha ocultado)
    router.get('/publications/active', async (req, res) => {
        // Extraemos 'user' (usuario que consulta), 'search' (criterio de búsqueda por texto),
        // y el nuevo parámetro 'filter' que nos indica si se solicitan las publicaciones ocultas.
        const { user: requestingUser, search, filter } = req.query; 
        
        // Validación estricta del parámetro requerido para la consulta.
        if (!requestingUser) return res.status(400).json({ message: "Es necesario especificar un usuario." });

        // Evaluamos si el filtro solicitado es específicamente para publicaciones ocultas.
        const isHiddenFilter = filter === 'hidden';

        // Estándar de Ciberseguridad: La consulta SQL se arma dinámicamente seleccionando 
        // una de dos opciones estáticas pre-codificadas en Javascript.
        // Esto elimina cualquier posibilidad de inyección SQL (SQL Injection Vulnerability) 
        // ya que no se interpola directamente texto ingresado por el usuario en la estructura SQL.
        const hiddenSubquery = isHiddenFilter
            ? `p.id IN (SELECT hp.publication_id FROM hidden_publications hp WHERE hp.hider_username = $1)`
            : `p.id NOT IN (SELECT hp.publication_id FROM hidden_publications hp WHERE hp.hider_username = $1)`;

        // Parámetros seguros para la consulta SQL parametrizada.
        const queryParams = [requestingUser];
        let searchCondition = "";
        
        // Sanitización y armado dinámico de la búsqueda si el usuario ingresó texto.
        if (search) {
            // Se utiliza el placeholder correspondiente al índice de parámetro sanitizado.
            searchCondition = ` AND (p.title ILIKE $${queryParams.length + 1} OR p.description ILIKE $${queryParams.length + 1})`;
            queryParams.push(`%${search}%`);
        }

        // Estructura de consulta SQL optimizada con índices y subqueries.
        const sql = `
                SELECT
            p.id, p.title, p.description, p.blue_cost, p.created_at, p.status, p.category,
            p.is_booster_task, p.is_sell_post, p.available_slots, p.expires_at, p.allow_repeat_participation, p.max_repeat_per_user, p.repeat_cooldown_hours,
            p.goal_amount, p.current_amount,
                    u.username as author_username,
            u.average_rating as author_average_rating,
            u.ratings_count as author_ratings_count,
                    (
                        SELECT pa.status 
                        FROM publication_acceptances pa 
                        WHERE pa.publication_id = p.id AND pa.acceptor_username = $1
                        ORDER BY created_at DESC LIMIT 1
                    ) as user_acceptance_status,
                    (
                        SELECT COUNT(*)
                        FROM publication_acceptances pa
                        WHERE pa.publication_id = p.id 
                        AND pa.acceptor_username = $1 
                        AND pa.status = 'confirmed_paid'
                    ) as successful_participations,
                    (CASE
                        WHEN u.username = $1 THEN (
                            SELECT json_agg(json_build_object(
                                'username', participant_user.username,
                                'status', pa.status,
                                'accepted_at', pa.created_at,
                                'blue_cost', pa.blue_cost,
                                'average_rating', participant_user.average_rating,
                                'ratings_count', participant_user.ratings_count
                            ) ORDER BY pa.created_at)
                            FROM publication_acceptances pa
                            JOIN users participant_user ON pa.acceptor_username = participant_user.username
                            WHERE pa.publication_id = p.id
                        )
                        ELSE NULL
                    END) as participants
                FROM
                    publications p
                JOIN
                    users u on p.author_id = u.id
                WHERE
                    ${hiddenSubquery}
                    AND p.deleted_at IS NULL
                    AND COALESCE(p.is_paused, FALSE) = FALSE
                    -- (UX + seguridad de negocio): Si la publicación NO es repetible y el usuario ya la completó/pagó,
                    -- entonces NO debe aparecer como "disponible" para ese usuario.
                    AND NOT (
                        -- Caso A: Publicación NO repetible y el usuario ya la completó
                        (
                            COALESCE(p.allow_repeat_participation, FALSE) = FALSE
                            AND EXISTS (
                                SELECT 1
                                FROM publication_acceptances pa_done
                                WHERE pa_done.publication_id = p.id
                                  AND pa_done.acceptor_username = $1
                                  AND pa_done.status = 'confirmed_paid'
                            )
                        )
                        OR
                        -- Caso B: Publicación repetible pero el usuario ya alcanzó el máximo de repeticiones
                        (
                            COALESCE(p.allow_repeat_participation, FALSE) = TRUE
                            AND p.max_repeat_per_user IS NOT NULL
                            AND (
                                SELECT COUNT(*)
                                FROM publication_acceptances pa_done
                                WHERE pa_done.publication_id = p.id
                                  AND pa_done.acceptor_username = $1
                                  AND pa_done.status = 'confirmed_paid'
                            ) >= p.max_repeat_per_user
                        )
                        OR
                        -- Caso C: COOLDOWN ACTIVO — Publicación repetible pero el usuario completó una
                        -- participación dentro del período de espera (repeat_cooldown_hours).
                        -- Mientras el cooldown esté activo, la publicación se oculta del feed para
                        -- evitar que el usuario intente aceptarla antes de tiempo.
                        -- Ejemplo: si cooldown = 24h y completó hace 6h → oculta las próximas 18h.
                        (
                            COALESCE(p.allow_repeat_participation, FALSE) = TRUE
                            AND p.repeat_cooldown_hours IS NOT NULL
                            AND p.repeat_cooldown_hours > 0
                            AND EXISTS (
                                SELECT 1
                                FROM publication_acceptances pa_cool
                                WHERE pa_cool.publication_id = p.id
                                  AND pa_cool.acceptor_username = $1
                                  AND pa_cool.status = 'confirmed_paid'
                                  AND pa_cool.created_at > NOW() - (p.repeat_cooldown_hours * INTERVAL '1 hour')
                            )
                            -- Solo aplicar cooldown si NO ha alcanzado el máximo (ese caso ya se cubre arriba)
                            AND (
                                p.max_repeat_per_user IS NULL
                                OR (
                                    SELECT COUNT(*)
                                    FROM publication_acceptances pa_max
                                    WHERE pa_max.publication_id = p.id
                                      AND pa_max.acceptor_username = $1
                                      AND pa_max.status = 'confirmed_paid'
                                ) < p.max_repeat_per_user
                            )
                        )
                    )
                    -- NUEVO (Hard Reject): Si el usuario fue rechazado alguna vez en esta publicación, ocultarla del feed.
                    AND NOT EXISTS (
                        SELECT 1
                        FROM publication_acceptances pa_rej
                        WHERE pa_rej.publication_id = p.id
                          AND pa_rej.acceptor_username = $1
                          AND pa_rej.status = 'rejected'
                    )
                    AND (
            -- Caso 1: Publicaciones normales que están activas o en las que el usuario participa
            -- NUEVO: Si target_username está definido, solo ese usuario puede verla
            (
                p.is_quick_sale = false 
                AND (p.target_username IS NULL OR p.target_username = $1)
                AND (
                    (p.available_slots > 0 AND (p.expires_at IS NULL OR p.expires_at > NOW()))
                    OR 
                    (u.username = $1 AND EXISTS (SELECT 1 FROM publication_acceptances pa WHERE pa.publication_id = p.id AND pa.status != 'confirmed_paid'))
                    OR 
                    (p.id IN (SELECT pa.publication_id FROM publication_acceptances pa WHERE pa.acceptor_username = $1 AND pa.status != 'confirmed_paid'))
                )
            )
            OR
            -- Caso 2: Ventas Rápidas que están activas Y son para el usuario o del usuario
            (
                p.is_quick_sale = true 
                AND (p.target_username = $1 OR u.username = $1)
                AND p.available_slots > 0 
                AND p.expires_at IS NOT NULL AND p.expires_at > NOW()
            )
        )
            ${searchCondition}
                ORDER BY
                    p.created_at DESC
            `;

        try {
            const result = await pool.query(sql, queryParams);
            const publications = result.rows.map(p => ({
                ...p,
                participants: p.participants || [],
            }));
            res.status(200).json(publications);
        } catch (error) {
            console.error("Error al obtener las publicaciones activas:", error);
            return res.status(500).json({ message: "Error interno del servidor." });
        }
    });

    // NUEVO: Endpoint para crear una Venta Rápida
    router.post('/api/quick-sale', requireAcceptedLegalByUsernameField(['authorUsername']), async (req, res) => {
        let { title, amount, authorUsername, targetUsername } = req.body;

        const client = await pool.connect();
        try {
            // 0. VERIFICAR PERMISO GLOBAL
            const settingsResult = await client.query("SELECT setting_value FROM app_settings WHERE setting_key = 'allow_quick_sale_publications'");
            const allowQuickSale = settingsResult.rows.length > 0 && settingsResult.rows[0].setting_value === 'true';

            if (!allowQuickSale) {
                return res.status(403).json({ message: "La creación de Ventas Rápidas está desactivada temporalmente." });
            }

            // 1. Validaciones de entrada básicas
            if (!amount || !authorUsername) {
                return res.status(400).json({ message: "Faltan datos requeridos: el monto y el autor son obligatorios." });
            }

            // Si el título viene vacío, se le asigna un valor por defecto.
            if (!title || title.trim() === '') {
                title = 'Venta Rápida';
            }

            const cost = parseFloat(String(amount).replace(',', '.'));
            if (isNaN(cost) || cost <= 0) {
                return res.status(400).json({ message: "El monto debe ser un número positivo." });
            }

            // Sanitización simple del título para prevenir XSS básico.
            const sanitizedTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");

            // const client = await pool.connect(); // ELIMINADO
            // try { // ELIMINADO
            await client.query('BEGIN');

            // 2. Verificar que el autor existe y obtener su ID
            const authorResult = await client.query('SELECT id FROM users WHERE username = $1', [authorUsername]);
            if (authorResult.rowCount === 0) {
                throw { status: 404, message: 'El usuario autor no existe.' };
            }
            const authorId = authorResult.rows[0].id;

            // 3. (OPCIONAL) Verificar que el comprador objetivo existe, si se especificó
            if (targetUsername && targetUsername.trim() !== '') {
                if (targetUsername === authorUsername) {
                    throw { status: 400, message: 'No puedes crearte una venta rápida a ti mismo.' };
                }
                const targetUserResult = await client.query('SELECT id FROM users WHERE username = $1', [targetUsername]);
                if (targetUserResult.rowCount === 0) {
                    throw { status: 404, message: 'El usuario comprador especificado no existe.' };
                }
            }

            // 4. Crear la publicación de Venta Rápida
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos desde ahora

            const insertQuery = `
            INSERT INTO publications 
            (author_id, title, description, blue_cost, status, is_sell_post, is_quick_sale, target_username, expires_at, category) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
            RETURNING id;
        `;
            const values = [
                authorId,
                sanitizedTitle,
                'Venta Rápida', // Descripción genérica
                cost,
                'open',       // Estado inicial
                true,         // Es un post de venta
                true,         // Es una Venta Rápida
                targetUsername && targetUsername.trim() !== '' ? targetUsername.trim() : null,
                expiresAt,
                'sell'        // Categoría
            ];

            const publicationResult = await client.query(insertQuery, values);
            const newPublicationId = publicationResult.rows[0].id;

            await logAuditEvent(client, req, {
                eventType: 'quick_sale.created',
                actorUsername: authorUsername,
                targetUsername: targetUsername && targetUsername.trim() !== '' ? targetUsername.trim() : null,
                publicationId: newPublicationId,
                category: 'quick_sale',
                metadata: {
                    amount: cost,
                    expires_at: expiresAt.toISOString()
                }
            });

            await client.query('COMMIT');

            // 5. Devolver el ID de la nueva publicación para generar el QR
            res.status(201).json({
                message: 'Venta Rápida creada con éxito.',
                publicationId: newPublicationId
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error al crear la Venta Rápida:', error);
            res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
        } finally {
            client.release();
        }
    });

    // NUEVO: Endpoint para PAGAR una Venta Rápida
    router.post('/api/quick-sale/:id/pay', requireAcceptedLegalByUsernameField(['buyerUsername']), async (req, res) => {
        const { id } = req.params;
        const { buyerUsername } = req.body;

        if (!buyerUsername) {
            return res.status(400).json({ message: "Se requiere el nombre de usuario del comprador." });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Obtener los datos de la publicación y bloquear la fila
            const pubResult = await client.query(
                `SELECT p.*, u.username as author_username 
             FROM publications p
             JOIN users u ON p.author_id = u.id
             WHERE p.id = $1 FOR UPDATE`,
                [id]
            );

            if (pubResult.rowCount === 0) {
                throw { status: 404, message: "Venta Rápida no encontrada." };
            }
            const publication = pubResult.rows[0];

            // Verificar si el comprador es menor sin tutor
            const buyerResult = await client.query(
                `SELECT id, is_minor, tutor_user_id, account_status FROM users WHERE username = $1`,
                [buyerUsername]
            );

            if (buyerResult.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: "Usuario comprador no encontrado." });
            }

            const buyer = buyerResult.rows[0];

            // Verificar si es menor sin tutor (las ventas rápidas generan deuda RED)
            if (buyer.is_minor && (!buyer.tutor_user_id || buyer.account_status === 'pending_tutor')) {
                await client.query('ROLLBACK');
                return res.status(403).json({
                    message: "Por ser menor de edad, necesitas la autorización de un tutor para realizar pagos que generen compromisos RED. Por favor, agrega un tutor a tu cuenta primero.",
                    requires_tutor: true,
                    is_minor: true
                });
            }

            // --- INICIO DE LAS VALIDACIONES DE PAGO CRÍTICAS ---

            // a. ¿Es realmente una Venta Rápida?
            if (!publication.is_quick_sale) {
                throw { status: 400, message: "Esta acción solo es válida para Ventas Rápidas." };
            }

            // b. ¿Ya ha sido pagada o está cerrada?
            if (publication.status !== 'open') {
                throw { status: 400, message: "Esta venta ya no está disponible para pago." };
            }

            // c. ¿Ha expirado?
            const hasExpired = publication.expires_at && new Date(publication.expires_at) < new Date();
            if (hasExpired) {
                throw { status: 400, message: "Esta Venta Rápida ha expirado." };
            }

            // d. ¿El comprador es el vendedor?
            if (publication.author_username === buyerUsername) {
                throw { status: 400, message: "No puedes comprar tu propia venta." };
            }

            // e. Si es una venta dirigida, ¿es el comprador correcto?
            if (publication.target_username && publication.target_username !== buyerUsername) {
                throw { status: 403, message: "No tienes permiso para comprar esta venta." };
            }

            // --- FIN DE VALIDACIONES ---

            // 2. Obtener configuración del sistema (pre-lanzamiento, comisiones, etc.)
            const settingsResult = await client.query(`
            SELECT setting_key, setting_value 
            FROM app_settings 
            WHERE setting_key IN ('pre_launch_mode_enabled', 'debt_cycle_days', 'debt_cycle_hours', 'debt_cycle_minutes', 'blue_escrow_days', 'blue_escrow_hours', 'blue_escrow_minutes', 'platform_commission_percentage')
        `);
            const settings = {};
            settingsResult.rows.forEach(row => {
                settings[row.setting_key] = row.setting_value;
            });
            const preLaunchMode = settings.pre_launch_mode_enabled === 'true';

            // 3. Procesar el pago usando la misma lógica que las otras publicaciones (cumple reglas económicas)
            // Esto crea tokens RED/BLUE según las reglas, no transfiere tokens existentes
            const cost = parseFloat(publication.blue_cost);
            const sellerUsername = publication.author_username;

            // Crear un objeto acceptance similar al que usa processDirectPaymentCompletion
            // AUDITORÍA FINTECH: Se incluye 'is_booster_task' para propagar correctamente el flag al motor de pagos.
            const acceptance = {
                blue_cost: cost,
                title: publication.title,
                author_username: sellerUsername,
                acceptance_id: null, // No hay acceptance para venta rápida
                category: 'sell',
                completerUsername: buyerUsername,
                is_booster_task: !!publication.is_booster_task
            };

            // Procesar el pago según las reglas económicas
            const result = await processDirectPaymentCompletion(client, acceptance, id, preLaunchMode, settings);

            // 4. Actualizar el estado de la publicación a 'completed'
            await client.query(`UPDATE publications SET status = 'completed', available_slots = 0 WHERE id = $1`, [id]);

            // 5. Crear notificación para el vendedor
            const notificationMessage = `¡Venta Rápida completada! ${buyerUsername} ha pagado por tu publicación: "${publication.title}".`;
            await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [sellerUsername, notificationMessage]);

            await logAuditEvent(client, req, {
                eventType: 'quick_sale.paid',
                actorUsername: buyerUsername,
                targetUsername: sellerUsername,
                publicationId: parseInt(id, 10),
                category: 'quick_sale',
                metadata: {
                    amount: cost,
                    publication_title: publication.title
                }
            });

            await client.query('COMMIT');

            // ═══════════════════════════════════════════════════════════════
            // OUTBOX PATTERN: DB Confirmada Exitosamente.
            // ═══════════════════════════════════════════════════════════════
            if (result && result.web3IntentId) {
                await pool.query(
                    `UPDATE web3_pending_transactions SET status = 'fully_resolved', resolved_at = NOW() WHERE id = $1`,
                    [result.web3IntentId]
                );
            }

            res.status(200).json({ message: result.message || "Pago realizado con éxito." });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`Error al procesar el pago de la Venta Rápida ${id}:`, error);
            res.status(error.status || 500).json({ message: error.message || "Error crítico en la transacción." });
        } finally {
            client.release();
        }
    });

    // Ruta para Aceptar una publicación
    router.post('/publications/:id/accept', requireAcceptedLegalByUsernameField(['acceptorUsername']), async (req, res) => {
        const { id } = req.params;
        const { acceptorUsername, donationAmount } = req.body;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Verificar existencia del aceptador
            const acceptorResult = await client.query(
                `SELECT id, is_minor, tutor_user_id, account_status, web3_wallet_address, kyc_verified FROM users WHERE username = $1`,
                [acceptorUsername]
            );

            if (acceptorResult.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: "Usuario no encontrado." });
            }
            const acceptor = acceptorResult.rows[0];

            // 2. Verificar existencia y estado de la publicación
            const pubResult = await client.query(
                `SELECT p.*, u.username as author_username
                             FROM publications p
                             JOIN users u ON p.author_id = u.id
                             WHERE p.id = $1 AND p.deleted_at IS NULL
                             FOR UPDATE`,
                [id]
            );
            const pub = pubResult.rows[0];

            if (!pub) {
                throw { status: 404, message: "La publicación ya no existe o ha sido eliminada." };
            }
            if (pub.author_username === acceptorUsername) {
                throw { status: 400, message: "No puedes aceptar o donar a tu propia publicación." };
            }
            if (pub.is_paused) {
                throw { status: 400, message: "Esta publicación está pausada temporalmente." };
            }

            // Cargar configuraciones para el procesamiento de tokens y modo operativo
            const settingsResult = await client.query(`
                SELECT setting_key, setting_value 
                FROM app_settings 
                WHERE setting_key IN ('pre_launch_mode_enabled', 'debt_cycle_days', 'debt_cycle_hours', 'debt_cycle_minutes', 'blue_escrow_days', 'blue_escrow_hours', 'blue_escrow_minutes', 'platform_commission_percentage')
            `);
            const settings = settingsResult.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
            const preLaunchMode = settings.pre_launch_mode_enabled === 'true';

            // === FRENO KYC FINTECH PARA EL TRABAJADOR (Web3 Single Source of Truth) ===
            // El Smart Contract exige que el beneficiario (Payee) tenga KYC verificado on-chain.
            // En Modo Pre-lanzamiento (preLaunchMode == true) o si la publicación es una Tarea de Impulsor (is_booster_task == true),
            // se exime esta validación para permitir la actividad off-chain en el Libro de Impulsores.
            // AUDITABILIDAD: Se define la variable 'isBoosterTx' para bifurcar la verificación KYC de forma segura.
            const isBoosterTx = preLaunchMode || !!pub.is_booster_task;
            if (pub.category === 'request' && !isBoosterTx) {
                let workerKycWallet = acceptor.web3_wallet_address;

                // Si el trabajador es menor de edad, verificamos si usa la wallet de su tutor
                if (acceptor.is_minor) {
                    if (!acceptor.tutor_user_id || acceptor.account_status === 'pending_tutor') {
                        await client.query('ROLLBACK');
                        return res.status(403).json({
                            message: "Por ser menor de edad, necesitas la autorización de un tutor para aceptar trabajos remunerados. Por favor, agrega un tutor a tu cuenta primero.",
                            requires_tutor: true,
                            is_minor: true
                        });
                    }
                    const tutorWalletRes = await client.query(`SELECT web3_wallet_address FROM users WHERE id = $1`, [acceptor.tutor_user_id]);
                    if (tutorWalletRes.rowCount > 0 && tutorWalletRes.rows[0].web3_wallet_address) {
                        workerKycWallet = tutorWalletRes.rows[0].web3_wallet_address;
                    }
                }

                if (!workerKycWallet) {
                    await client.query('ROLLBACK');
                    return res.status(403).json({
                        message: "Seguridad Financiera: Para aceptar tareas remuneradas, debes conectar una Billetera Web3 a tu cuenta.",
                        requires_wallet: true
                    });
                }

                const Web3BridgeService = require('../services/web3BridgeService');
                let isWorkerKycVerified = await Web3BridgeService.checkUserKYC(workerKycWallet);
                if (!isWorkerKycVerified && acceptor.kyc_verified) {
                    console.log(`[PUB ACCEPT] Fallback activado: KYC on-chain falló o dio false para ${acceptorUsername}, pero trabajador está verificado en la base de datos.`);
                    isWorkerKycVerified = true;
                }
                if (!isWorkerKycVerified) {
                    await client.query('ROLLBACK');
                    return res.status(403).json({
                        message: "Seguridad Financiera: Para aceptar tareas remuneradas y recibir pagos en token BLUE, debes completar tu verificación de identidad (KYC) en tu Billetera Web3.",
                        requires_kyc: true
                    });
                }
            }

            // --- CASO A: DONACIÓN PROFESIONAL ---
            if (pub.category === 'donation') {
                const amount = parseFloat(donationAmount);
                if (isNaN(amount) || amount <= 0) {
                    throw { status: 400, message: "Por favor, indica un monto válido para donar." };
                }

                // AUDITORÍA FINTECH: Agregamos el flag 'is_booster_task' para propagar el modo de cobro off-chain.
                const virtualAcceptance = {
                    blue_cost: amount,
                    title: pub.title,
                    author_username: pub.author_username,
                    category: 'donation',
                    completerUsername: acceptorUsername,
                    is_booster_task: !!pub.is_booster_task
                };

                // Procesar pago instantáneo
                const result = await processDirectPaymentCompletion(client, virtualAcceptance, id, preLaunchMode, settings);

                // Registrar la donación confirmada
                await client.query(
                    `INSERT INTO publication_acceptances (publication_id, acceptor_username, status, blue_cost) 
                                 VALUES ($1, $2, 'confirmed_paid', $3)`,
                    [id, acceptorUsername, amount]
                );

                // Actualizar progreso de la campaña
                await client.query(
                    `UPDATE publications SET current_amount = COALESCE(current_amount, 0) + $1 WHERE id = $2`,
                    [amount, id]
                );

                // Notificación al autor (BD)
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`,
                    [pub.author_username, `¡${acceptorUsername} ha donado ${amount} BLUE a "${pub.title}"!`]
                );

                // PUSH NOTIFICATION (Donación Recibida)
                await notificationService.sendNotificationToUser(pub.author_id, {
                    title: '¡Donación Recibida! 🎁',
                    body: `${acceptorUsername} ha aportado ${amount.toFixed(2)} BLUE IOU a tu campaña: ${pub.title}`,
                    icon: '/assets/icons/icon-192x192.png',
                    data: { url: '/history.html' }
                }, 'TRANSACTIONAL');

                await logAuditEvent(client, req, {
                    eventType: 'publication.donation_received',
                    actorUsername: acceptorUsername,
                    targetUsername: pub.author_username,
                    publicationId: parseInt(id, 10),
                    category: 'donation',
                    metadata: { amount, new_total: parseFloat(pub.current_amount || 0) + amount }
                });

                await client.query('COMMIT');

                // ═══════════════════════════════════════════════════════════════
                // OUTBOX PATTERN: DB Confirmada Exitosamente.
                // ═══════════════════════════════════════════════════════════════
                if (result && result.web3IntentId) {
                    await pool.query(
                        `UPDATE web3_pending_transactions SET status = 'fully_resolved', resolved_at = NOW() WHERE id = $1`,
                        [result.web3IntentId]
                    );
                }

                return res.status(200).json({ message: `¡Donación de ${amount} BLUE recibida! Gracias por tu apoyo.` });
            }

            // --- CASO B: FLUJO ESTÁNDAR (SOLICITUDES / VENTAS) ---
            if (pub.available_slots <= 0) {
                throw { status: 400, message: "Lo sentimos, ya no quedan cupos disponibles." };
            }

            // Restricción: No aceptar tareas del menor si eres su tutor (Conflict of Interest)
            if (pub.category === 'request') {
                const authorResult = await client.query(`SELECT tutor_user_id FROM users WHERE id = $1`, [pub.author_id]);
                if (authorResult.rows[0].tutor_user_id === acceptor.id) {
                    throw { status: 403, message: "No puedes aceptar solicitudes de tu menor representado por conflicto de intereses financieros." };
                }
            }

            // Validación de Repetición Profesional
            // Se obtiene el historial completo de aceptaciones del usuario para esta publicación,
            // incluyendo created_at para poder validar el período de cooldown entre repeticiones.
            const prevAcceptances = await client.query(
                `SELECT status, created_at FROM publication_acceptances WHERE publication_id = $1 AND acceptor_username = $2 ORDER BY created_at DESC`,
                [id, acceptorUsername]
            );

            if (prevAcceptances.rows.length > 0) {
                const statuses = prevAcceptances.rows.map(r => r.status);

                // 1. Hard Reject: Si fue rechazado, no puede volver a intentar.
                if (statuses.includes('rejected')) {
                    throw { status: 403, message: "Tu solicitud fue rechazada anteriormente y no puedes volver a intentarlo." };
                }

                // 2. Active Check: Si tiene una solicitud en proceso, no puede crear otra.
                const activeStatuses = ['pending_approval', 'approved', 'completed'];
                if (statuses.some(s => activeStatuses.includes(s))) {
                    throw { status: 409, message: "Ya tienes una solicitud activa para esta publicación." };
                }

                // 3. Max Repeat Check: Si la publicación no permite repetición, bloquear.
                const confirmedCount = statuses.filter(s => s === 'confirmed_paid').length;
                if (!pub.allow_repeat_participation && confirmedCount >= 1) {
                    throw { status: 409, message: "Esta publicación no permite participaciones repetidas." };
                }

                // 4. Max Repeat Limit: Si alcanzó el máximo de repeticiones, bloquear.
                if (pub.allow_repeat_participation && confirmedCount >= pub.max_repeat_per_user) {
                    throw { status: 409, message: `Has alcanzado el límite de ${pub.max_repeat_per_user} participaciones para esta tarea.` };
                }

                // 5. COOLDOWN CHECK: Verificar que ha pasado suficiente tiempo desde
                //    la última participación completada antes de permitir otra repetición.
                //    Esto previene abuso de tareas repetibles con un intervalo mínimo obligatorio.
                //    Ej: Si cooldown = 24h, el usuario no puede volver a aceptar hasta 24h después
                //    de haber completado la tarea anterior.
                if (pub.allow_repeat_participation && confirmedCount > 0 && pub.repeat_cooldown_hours > 0) {
                    // Obtener la fecha de la última participación completada (confirmed_paid)
                    const lastConfirmedRow = prevAcceptances.rows.find(r => r.status === 'confirmed_paid');
                    if (lastConfirmedRow) {
                        const lastCompletedAt = new Date(lastConfirmedRow.created_at);
                        const cooldownMs = pub.repeat_cooldown_hours * 60 * 60 * 1000; // Convertir horas a milisegundos
                        const timeSinceLastMs = Date.now() - lastCompletedAt.getTime();

                        if (timeSinceLastMs < cooldownMs) {
                            // Calcular tiempo restante para mostrar mensaje informativo al usuario
                            const remainingMs = cooldownMs - timeSinceLastMs;
                            const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
                            const remainingMinutes = Math.ceil((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

                            // Formatear el tiempo restante de forma legible
                            let timeStr = '';
                            if (remainingHours > 0) timeStr += `${remainingHours}h `;
                            timeStr += `${remainingMinutes}min`;

                            throw {
                                status: 429,
                                message: `Debes esperar ${timeStr} antes de volver a participar en esta tarea.`
                            };
                        }
                    }
                }
            }

            // Restricción para menores en ventas (Generación de deuda)
            if (pub.category === 'sell' && acceptor.is_minor && (!acceptor.tutor_user_id || acceptor.account_status === 'pending_tutor')) {
                throw { status: 403, message: "Como menor sin tutor asignado, no puedes aceptar publicaciones que generen compromisos RED." };
            }

            // Descontar cupo
            await client.query(`UPDATE publications SET available_slots = available_slots - 1 WHERE id = $1`, [id]);

            if (pub.auto_approve) {
                await client.query(`INSERT INTO publication_acceptances (publication_id, acceptor_username, status, blue_cost) VALUES ($1, $2, 'approved', $3)`, [id, acceptorUsername, pub.blue_cost]);
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [acceptorUsername, `¡Has sido aprobado automáticamente para 🎉 "${pub.title}"!`]);

                // PUSH NOTIFICATION (Auto-Aprobación)
                await notificationService.sendNotificationToUser(acceptor.id, {
                    title: '¡Tarea Aprobada! ✅',
                    body: `Has sido aprobado automáticamente para: ${pub.title}. ¡Empieza ahora!`,
                    icon: '/assets/icons/icon-192x192.png',
                    data: { url: '/momentum-dashboard.html' }
                }, 'SOCIAL');

                await logAuditEvent(client, req, {
                    eventType: 'publication.accepted',
                    actorUsername: acceptorUsername,
                    publicationId: parseInt(id, 10),
                    category: pub.category,
                    metadata: { initial_status: 'approved', auto_approve: true }
                });

                await client.query('COMMIT');
                res.status(200).json({ message: "¡Aceptaste y fuiste aprobado automáticamente!" });
            } else {
                await client.query(`INSERT INTO publication_acceptances (publication_id, acceptor_username, status, blue_cost) VALUES ($1, $2, 'pending_approval', $3)`, [id, acceptorUsername, pub.blue_cost]);
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [pub.author_username, `El usuario ${acceptorUsername} quiere realizar la tarea 📩 "${pub.title}".`]);

                // PUSH NOTIFICATION (Solicitud de Tarea)
                await notificationService.sendNotificationToUser(pub.author_id, {
                    title: 'Nueva Solicitud 📩',
                    body: `${acceptorUsername} quiere participar en: ${pub.title}`,
                    icon: '/assets/icons/icon-192x192.png',
                    data: { url: '/momentum-dashboard.html' }
                }, 'SOCIAL');

                await logAuditEvent(client, req, {
                    eventType: 'publication.accepted',
                    actorUsername: acceptorUsername,
                    publicationId: parseInt(id, 10),
                    category: pub.category,
                    metadata: { initial_status: 'pending_approval', auto_approve: false }
                });

                await client.query('COMMIT');
                res.status(200).json({ message: "Solicitud enviada. Esperando aprobación del autor." });
            }
        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error en /accept:", error);
            res.status(error.status || 500).json({ message: error.message || "Error interno al procesar la solicitud." });
        } finally {
            client.release();
        }
    });

    // Ruta para Descartar/Rechazar a un usuario (Admin o Autor)
    router.post('/publications/:id/discard', verifyAdminToken, requireAcceptedLegalByUsernameField(['discarderUsername']), async (req, res) => {
        const { id } = req.params;
        const { discarderUsername, userToDiscard } = req.body;
        const actorUsername = resolveActorUsername(req, discarderUsername);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Verificar existencia de la publicación
            const pubResult = await client.query(
                `SELECT p.*, u.username as author_username
                     FROM publications p
                     JOIN users u ON p.author_id = u.id
                     WHERE p.id = $1 AND p.deleted_at IS NULL
                     FOR UPDATE`,
                [id]
            );

            const pub = pubResult.rows[0];
            if (!pub) {
                throw { status: 404, message: "La tarea no existe o ha sido eliminada." };
            }

            // 2. Verificar permisos: Debe ser el autor O un administrador
            // En este contexto, verifyAdminToken asegura que es un admin o el autor autenticado.
            // Pero para ser doblemente seguros en el monolito:
            const isAdmin = req.user && req.user.role === 'admin';
            if (pub.author_username !== actorUsername && !isAdmin) {
                throw { status: 403, message: "No tienes permisos de administración sobre esta tarea." };
            }

            // 3. Ejecutar el rechazo profesional
            // Estados válidos para rechazar: pending (solicitud básica), pending_approval (en espera de autor), completed (culminada pero mal hecha)
            const updateResult = await client.query(
                `UPDATE publication_acceptances
                     SET status = 'rejected'
                     WHERE publication_id = $1
                       AND acceptor_username = $2
                       AND status IN ('pending', 'pending_approval', 'completed')
                     RETURNING *`,
                [id, userToDiscard]
            );

            if (updateResult.rowCount === 0) {
                throw { status: 404, message: "No se encontró una solicitud activa para este usuario en esta tarea." };
            }

            const acceptance = updateResult.rows[0];

            // 4. Devolver el cupo (la solicitud ya no ocupa un slot)
            await client.query(`UPDATE publications SET available_slots = available_slots + 1 WHERE id = $1`, [id]);

            // 5. Notificación Interna (DB)
            const internalMsg = `Tu solicitud/entrega para la tarea "${pub.title}" fue rechazada ❌ por la administración. Revisa los requisitos.`;
            await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [userToDiscard, internalMsg]);

            // 6. NOTIFICACIÓN PUSH (Real-time)
            try {
                // Buscamos el ID del usuario destino para el push
                const targetUserRes = await client.query('SELECT id FROM users WHERE username = $1', [userToDiscard]);
                if (targetUserRes.rowCount > 0) {
                    await notificationService.sendNotificationToUser(targetUserRes.rows[0].id, {
                        title: 'Tarea Rechazada ❌',
                        body: `Tu participación en "${pub.title}" ha sido rechazada. Revisa los detalles en tu perfil.`,
                        icon: '/assets/icons/icon-192x192.png',
                        data: { url: '/momentum-dashboard.html' }
                    }, 'TRANSACTIONAL');
                }
            } catch (pushErr) {
                console.error("[PUSH ERROR] Fallo al notificar rechazo:", pushErr.message);
            }

            // 7. Auditoría Bancaria
            await logAuditEvent(client, req, {
                eventType: 'publication.rejected',
                actorUsername,
                targetUsername: userToDiscard,
                publicationId: parseInt(id, 10),
                category: pub.category,
                metadata: {
                    from_status: acceptance.status,
                    to_status: 'rejected',
                    admin_override: isAdmin && pub.author_username !== discarderUsername
                }
            });

            await client.query('COMMIT');
            res.status(200).json({ message: `Has rechazado la solicitud de ${userToDiscard}.` });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error al descartar solicitud:", error);
            res.status(error.status || 500).json({ message: error.message || "Error interno." });
        } finally {
            client.release();
        }
    });

    // Ruta para Aprobar a un usuario
    router.post('/publications/:id/approve', verifyAdminToken, requireAcceptedLegalByUsernameField(['approverUsername']), async (req, res) => {
        const { id } = req.params;
        const { approverUsername, userToApprove } = req.body;
        const actorUsername = resolveActorUsername(req, approverUsername);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const pubResult = await client.query(
                `SELECT p.*, u.username as author_username
                     FROM publications p
                     JOIN users u ON p.author_id = u.id
                     WHERE p.id = $1 AND u.username = $2 AND p.deleted_at IS NULL`,
                [id, actorUsername]
            );
            const pub = pubResult.rows[0];
            if (!pub) throw { status: 403, message: "No tienes permiso para aprobar solicitudes." };

            const updateResult = await client.query(
                `UPDATE publication_acceptances SET status = 'approved' WHERE publication_id = $1 AND acceptor_username = $2 AND status = 'pending_approval' RETURNING *`,
                [id, userToApprove]
            );

            if (updateResult.rowCount === 0) {
                throw { status: 404, message: "No se encontró una solicitud pendiente válida para este usuario." };
            }

            const message = `¡Has sido aprobado para la tarea "${pub.title}"!`;
            await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [userToApprove, message]);

            // PUSH NOTIFICATION (Aprobación Manual)
            // Necesitamos el ID del usuario aprobado, lo buscamos rápido
            const userToApproveRes = await client.query('SELECT id FROM users WHERE username = $1', [userToApprove]);
            if (userToApproveRes.rowCount > 0) {
                await notificationService.sendNotificationToUser(userToApproveRes.rows[0].id, {
                    title: 'Solicitud Aprobada ✅',
                    body: `El autor ha aprobado tu participación en: ${pub.title}`,
                    icon: '/assets/icons/icon-192x192.png',
                    data: { url: '/momentum-dashboard.html' }
                }, 'SOCIAL');
            }

            await logAuditEvent(client, req, {
                eventType: 'publication.approved',
                actorUsername,
                targetUsername: userToApprove,
                publicationId: parseInt(id, 10),
                category: pub.category,
                metadata: {
                    from_status: 'pending_approval',
                    to_status: 'approved'
                }
            });

            await client.query('COMMIT');
            res.status(200).json({ message: `Has aprobado a ${userToApprove}.` });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error al aprobar:", error);
            res.status(error.status || 500).json({ message: error.message || "Error interno." });
        } finally {
            client.release();
        }
    });

    // Ruta para Marcar como Culminada
    router.post('/publications/:id/complete', requireAcceptedLegalByUsernameField(['completerUsername']), async (req, res) => {
        const pubId = req.params.id;
        const { completerUsername, formResponses } = req.body;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. OBTENER CONFIGURACIONES DE LA PLATAFORMA (incluyendo comisiones)
            const settingsResult = await client.query(`
                    SELECT setting_key, setting_value 
                    FROM app_settings 
                    WHERE setting_key IN ('pre_launch_mode_enabled', 'debt_cycle_days', 'debt_cycle_hours', 'debt_cycle_minutes', 'blue_escrow_days', 'blue_escrow_hours', 'blue_escrow_minutes', 'platform_commission_percentage')
                `);
            const settings = settingsResult.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
            const preLaunchMode = settings.pre_launch_mode_enabled === 'true';

            // 2. FETCH ACCEPTANCE DATA
            // AUDITORÍA FINTECH: Agregamos 'p.is_booster_task' a la consulta SQL para recuperar el tipo de tarea y modularizar el comportamiento transaccional de pagos.
            const acceptanceResult = await client.query(
                `SELECT p.blue_cost, p.is_sell_post, p.title, p.category, p.form_fields, p.is_booster_task,
                            u.username as author_username,
                            pa.id as acceptance_id,
                            pa.form_responses_submitted_at
                     FROM publications p
                     JOIN users u ON p.author_id = u.id
                     JOIN publication_acceptances pa ON p.id = pa.publication_id
                     WHERE p.id = $1 AND pa.acceptor_username = $2 AND pa.status = 'approved'
                     FOR UPDATE`,
                [pubId, completerUsername]
            );

            const acceptance = acceptanceResult.rows[0];
            if (!acceptance) {
                throw { status: 404, message: "No se encontró una tarea o compra aprobada para procesar." };
            }

            // ──────────────────────────────────────────────────────────
            // SANITIZACIÓN DE form_responses (NIVEL FINTECH)
            // ──────────────────────────────────────────────────────────
            // Valida las respuestas enviadas por el usuario antes de almacenarlas.
            // Reglas de seguridad:
            //   1. Solo se aceptan claves numéricas de paso (previene inyección de claves JSONB)
            //   2. Máximo 20 pasos, 10 campos por paso (DoS prevention)
            //   3. Valores truncados a 5000 caracteres (previene payload oversize pero permite textareas largos)
            //   4. Solo se guardan valores string (previene inyección de objetos/arrays)
            // ──────────────────────────────────────────────────────────
            const MAX_RESPONSE_STEPS = 20;           // Máximo de pasos en las respuestas
            const MAX_RESPONSE_FIELDS = 10;          // Máximo de campos por paso en las respuestas
            const MAX_RESPONSE_VALUE_LENGTH = 5000;  // Longitud máxima de cada respuesta (textarea)

            let sanitizedFormResponses = null;
            if (formResponses && acceptance.form_fields && typeof formResponses === 'object') {
                const sanitized = {};
                const stepKeys = Object.keys(formResponses).slice(0, MAX_RESPONSE_STEPS);

                for (const stepKey of stepKeys) {
                    // Solo aceptar claves numéricas (previene inyección de claves JSONB)
                    const stepNum = parseInt(stepKey, 10);
                    if (!Number.isFinite(stepNum) || stepNum < 1 || stepNum > MAX_RESPONSE_STEPS) continue;

                    const stepResponses = formResponses[stepKey];
                    if (!stepResponses || typeof stepResponses !== 'object' || Array.isArray(stepResponses)) continue;

                    const sanitizedStep = {};
                    const fieldKeys = Object.keys(stepResponses).slice(0, MAX_RESPONSE_FIELDS);

                    for (const fieldKey of fieldKeys) {
                        const value = stepResponses[fieldKey];
                        // Solo aceptar valores string (previene inyección de objetos/arrays)
                        if (typeof value === 'string') {
                            // Truncar a longitud máxima segura y eliminar caracteres nulos
                            sanitizedStep[fieldKey.substring(0, 200)] = value
                                .replace(/\0/g, '')  // Eliminar caracteres nulos (seguridad PostgreSQL)
                                .substring(0, MAX_RESPONSE_VALUE_LENGTH);
                        }
                    }

                    if (Object.keys(sanitizedStep).length > 0) {
                        sanitized[String(stepNum)] = sanitizedStep;
                    }
                }

                if (Object.keys(sanitized).length > 0) {
                    sanitizedFormResponses = sanitized;
                }
            }

            const shouldSaveResponses = !!sanitizedFormResponses;

            if (shouldSaveResponses) {
                const updateResponsesResult = await client.query(
                    `UPDATE publication_acceptances
                         SET form_responses = $1,
                             form_responses_submitted_at = COALESCE(form_responses_submitted_at, NOW())
                         WHERE id = $2
                         RETURNING form_responses_submitted_at`,
                    [sanitizedFormResponses, acceptance.acceptance_id]
                );

                if (!acceptance.form_responses_submitted_at) {
                    await logAuditEvent(client, req, {
                        eventType: 'publication.form_responses_submitted',
                        actorUsername: completerUsername,
                        targetUsername: acceptance.author_username,
                        publicationId: parseInt(pubId, 10),
                        category: acceptance.category,
                        metadata: {
                            acceptance_id: acceptance.acceptance_id,
                            submitted_at: updateResponsesResult.rows[0]?.form_responses_submitted_at
                        }
                    });
                }
            }

            // Añadir completerUsername al objeto acceptance para pasarlo a los helpers
            acceptance.completerUsername = completerUsername;
            let result;
            switch (acceptance.category) {
                case 'sell':
                case 'donation':
                    result = await processDirectPaymentCompletion(client, acceptance, pubId, preLaunchMode, settings);
                    break;
                case 'request':
                    result = await processRequestCompletion(client, acceptance);
                    break;
                default:
                    throw { status: 400, message: "Categoría de publicación no válida." };
            }

            // PUSH NOTIFICATION (Tarea Culminada - Aviso al Autor)
            const authorData = await client.query('SELECT id FROM users WHERE username = $1', [acceptance.author_username]);
            if (authorData.rowCount > 0) {
                await notificationService.sendNotificationToUser(authorData.rows[0].id, {
                    title: '¡Tarea Terminada! 🚨',
                    body: `${completerUsername} ha culminado: ${acceptance.title}. Revísala ahora.`,
                    icon: '/assets/icons/icon-192x192.png',
                    data: { url: '/momentum-dashboard.html' }
                }, 'SOCIAL');
            }

            await logAuditEvent(client, req, {
                eventType: 'publication.completed',
                actorUsername: completerUsername,
                publicationId: parseInt(pubId, 10),
                category: acceptance.category,
                metadata: {
                    acceptance_id: acceptance.acceptance_id
                }
            });

            await client.query('COMMIT');

            // ═══════════════════════════════════════════════════════════════
            // OUTBOX PATTERN: DB Confirmada Exitosamente.
            // ═══════════════════════════════════════════════════════════════
            if (result && result.web3IntentId) {
                await pool.query(
                    `UPDATE web3_pending_transactions SET status = 'fully_resolved', resolved_at = NOW() WHERE id = $1`,
                    [result.web3IntentId]
                );
            }

            res.status(200).json({ message: result.message });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error al completar tarea/venta:", error);
            res.status(error.status || 500).json({ message: error.message || "Error interno." });
        } finally {
            client.release();
        }
    });

    // Ruta para Confirmar y Pagar (REFACTORIZADA PARA MÁXIMA SEGURIDAD)
    router.post('/publications/:id/confirm-payment', verifyAdminToken, requireAcceptedLegalByUsernameField(['confirmerUsername']), async (req, res) => {
        const pubId = req.params.id;
        const { confirmerUsername, workerUsername } = req.body;
        console.log(`[DEBUG] Recibida petición confirm-payment: pubId=${pubId}, confirmer=${confirmerUsername}, worker=${workerUsername}`);
        const actorUsername = resolveActorUsername(req, confirmerUsername);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            console.log(`[DEBUG] Transacción BEGIN iniciada para pubId=${pubId}`);

            const acceptanceResult = await client.query(
                `SELECT p.blue_cost, p.title, p.category, p.is_booster_task,
                    u.id as author_id,
                    u.username as author_username,
                    w.id as worker_id,
                    pa.id as acceptance_id,
                    pa.acceptor_username
                     FROM publications p
                     JOIN users u ON p.author_id = u.id
                     JOIN publication_acceptances pa ON p.id = pa.publication_id
                     JOIN users w ON pa.acceptor_username = w.username
             WHERE p.id = $1 AND pa.acceptor_username = $2 AND pa.status = 'completed'
             FOR UPDATE`,
                [pubId, workerUsername]
            );
            console.log(`[DEBUG] FOR UPDATE finalizado. Filas encontradas: ${acceptanceResult.rowCount}`);

            const acceptance = acceptanceResult.rows[0];
            if (!acceptance) {
                throw { status: 404, message: "No se encontró una tarea completada válida para este trabajador." };
            }

            if (acceptance.author_username !== actorUsername) {
                throw { status: 403, message: "No tienes permiso para confirmar el pago de esta tarea." };
            }

            if (workerUsername && acceptance.acceptor_username !== workerUsername) {
                await logAuditEvent(client, req, {
                    eventType: 'publication.confirm_payment.mismatch',
                    actorUsername,
                    targetUsername: workerUsername,
                    publicationId: parseInt(pubId, 10),
                    category: 'request',
                    metadata: {
                        acceptance_id: acceptance.acceptance_id,
                        db_acceptor: acceptance.acceptor_username
                    }
                });
                throw { status: 400, message: "El trabajador indicado no coincide con el registrado en la solicitud." };
            }

            if (acceptance.category !== 'request') {
                throw { status: 400, message: "Esta acción solo es válida para publicaciones de tipo 'solicitud'." };
            }

            const settingsResult = await client.query(`
            SELECT setting_key, setting_value FROM app_settings 
            WHERE setting_key IN ('pre_launch_mode_enabled', 'debt_cycle_days', 'debt_cycle_hours', 'debt_cycle_minutes', 'blue_escrow_days', 'blue_escrow_hours', 'blue_escrow_minutes', 'platform_commission_percentage')
        `);
            const settings = settingsResult.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
            const preLaunchMode = settings.pre_launch_mode_enabled === 'true';
            console.log(`[DEBUG] Settings cargados. preLaunchMode=${preLaunchMode}`);

            acceptance.workerUsername = acceptance.acceptor_username;
            acceptance.workerId = acceptance.worker_id;
            
            console.log(`[DEBUG] Llamando a processRequestPayment...`);
            const result = await processRequestPayment(client, acceptance, pubId, preLaunchMode, settings);
            console.log(`[DEBUG] processRequestPayment finalizado exitosamente.`);

            await client.query(`UPDATE publication_acceptances SET status = 'confirmed_paid' WHERE id = $1`, [acceptance.acceptance_id]);
            console.log(`[DEBUG] UPDATE publication_acceptances finalizado.`);

            console.log(`[DEBUG] Enviando push notification...`);
            await notificationService.sendNotificationToUser(acceptance.worker_id, {
                title: '¡Pago Recibido! 🏆',
                body: `Tu trabajo en "${acceptance.title}" ha sido pagado. +${parseFloat(acceptance.blue_cost).toFixed(2)} BLUE IOU acreditados.`,
                icon: '/assets/icons/icon-192x192.png',
                data: { url: '/history.html' }
            }, 'TRANSACTIONAL');
            console.log(`[DEBUG] Push notification enviada.`);

            await logAuditEvent(client, req, {
                eventType: 'publication.confirmed_paid',
                actorUsername,
                targetUsername: acceptance.acceptor_username,
                publicationId: parseInt(pubId, 10),
                category: 'request',
                metadata: {
                    acceptance_id: acceptance.acceptance_id,
                    blue_cost: acceptance.blue_cost,
                    is_booster_task: !!acceptance.is_booster_task
                }
            });
            console.log(`[DEBUG] logAuditEvent finalizado.`);

            await client.query('COMMIT');
            console.log(`[DEBUG] Transacción COMMIT finalizada.`);

            // ═══════════════════════════════════════════════════════════════
            // OUTBOX PATTERN: DB Confirmada Exitosamente.
            // Si hubo interacción con blockchain, marcamos la intención como
            // 'fully_resolved'. El cron de reconciliación ignorará este registro.
            // ═══════════════════════════════════════════════════════════════
            if (result.web3IntentId) {
                await pool.query(
                    `UPDATE web3_pending_transactions SET status = 'fully_resolved', resolved_at = NOW() WHERE id = $1`,
                    [result.web3IntentId]
                );
            }

            res.status(200).json({ message: result.message });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error en confirm-payment:", error);
            res.status(error.status || 500).json({ message: error.message || "Error crítico en la transacción." });
        } finally {
            if (client) client.release();
        }
    });

    // --- NUEVO: Endpoint para obtener los detalles completos de UNA SOLA publicación ---
    router.get('/api/publications/:id', async (req, res) => {
        const { id } = req.params;
        // COMPATIBILIDAD DE INVITADOS: El usuario solicitante es opcional para permitir consultas públicas ( crawlers / SEO / onboarding )
        const requestingUser = req.query.user || null;

        const client = await pool.connect();
        try {
            // Una única consulta más compleja que reúne toda la información necesaria.
            // Esto es más eficiente que hacer múltiples consultas a la base de datos.
            const query = `
            SELECT
                p.id, p.title, p.description, p.blue_cost, p.status, p.created_at, p.is_paused,
                p.is_sell_post, p.available_slots, p.category, p.expires_at,
                p.is_quick_sale, p.target_username, p.form_fields, p.show_preflight_modal,
                p.goal_amount, p.current_amount, p.beneficiary_referral_code,
                u.username as author_username,
                u.average_rating as author_average_rating,
                u.ratings_count as author_ratings_count,
                b.username as beneficiary_username,
                -- Obtenemos el estado de aceptación del usuario que está solicitando la página
                (
                    SELECT pa_user.status 
                    FROM publication_acceptances pa_user
                    WHERE pa_user.publication_id = p.id AND pa_user.acceptor_username = $2
                    ORDER BY pa_user.created_at DESC
                    LIMIT 1
                ) as user_acceptance_status,
                -- Obtenemos un array de objetos JSON con todos los participantes y sus detalles
                (
                    SELECT jsonb_agg(jsonb_build_object(
                        'username', pa_all.acceptor_username,
                        'status', pa_all.status,
                        'accepted_at', pa_all.created_at,
                        'blue_cost', pa_all.blue_cost,
                        'average_rating', p_user.average_rating,
                        'ratings_count', p_user.ratings_count,
                        'phone_number', CASE WHEN pa_all.status = 'approved' THEN p_user.phone_number ELSE NULL END,
                        'form_responses', pa_all.form_responses
                    ) ORDER BY pa_all.created_at)
                    FROM publication_acceptances pa_all
                    JOIN users p_user ON pa_all.acceptor_username = p_user.username
                    WHERE pa_all.publication_id = p.id
                ) as participants
            FROM
                publications p
            JOIN
                users u ON p.author_id = u.id
            LEFT JOIN
                users b ON p.beneficiary_referral_code = b.referral_code
            WHERE
                p.id = $1;
        `;

            const result = await client.query(query, [id, requestingUser]);

            if (result.rowCount === 0) {
                return res.status(404).json({ message: "Publicación no encontrada." });
            }

            const publication = result.rows[0];
            publication.participants = publication.participants || []; // Asegurarse de que sea un array

            // --- NUEVO: Lógica de Modal Intersticial (Pre-flight) ---
            if (publication.show_preflight_modal) {
                const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                const currentDay = days[new Date().getDay()];
                const settingsKeys = ['daily_modal_title', `daily_modal_${currentDay}`];

                const settingsResult = await client.query(
                    `SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1::text[])`,
                    [settingsKeys]
                );

                const settings = settingsResult.rows.reduce((acc, row) => {
                    acc[row.setting_key] = row.setting_value;
                    return acc;
                }, {});

                publication.preflight_modal = {
                    title: settings.daily_modal_title || 'Aviso Importante',
                    message: settings[`daily_modal_${currentDay}`] || 'Mensaje no configurado para hoy.'
                };
            }

            // --- INICIO DE LA LÓGICA DE SEGURIDAD PARA VENTA RÁPIDA ---
            if (publication.is_quick_sale) {
                const isAuthor = publication.author_username === requestingUser;
                const isTargetedUser = publication.target_username === requestingUser;
                const isPublicQuickSale = !publication.target_username;
                const hasExpired = publication.expires_at && new Date(publication.expires_at) < new Date();

                // Si ha expirado, nadie puede verla, ni siquiera el autor, para mantener la consistencia.
                if (hasExpired) {
                    return res.status(404).json({ message: "Esta venta rápida ha expirado." });
                }

                // Reglas de acceso:
                // 1. El autor siempre puede verla (mientras no haya expirado).
                // 2. Si tiene un comprador específico, solo él puede verla.
                // 3. Si es pública (sin comprador específico), cualquier usuario logueado que no sea el autor puede verla.
                if (!isAuthor && !isTargetedUser && !(isPublicQuickSale && !isAuthor)) {
                    // Devolvemos 404 para no revelar la existencia de la venta.
                    return res.status(404).json({ message: "Publicación no encontrada." });
                }
            }
            // --- FIN DE LA LÓGICA DE SEGURIDAD ---

            res.status(200).json(publication);

        } catch (error) {
            console.error(`Error fetching publication details for ID ${id}:`, error);
            res.status(500).json({ message: "Error interno del servidor al obtener los detalles de la publicación." });
        } finally {
            client.release();
        }
    });

    // Ruta para obtener todos los participantes de una publicación
    router.get('/publications/:id/participants', async (req, res) => {
        const { id } = req.params;
        const sql = `
            SELECT pa.acceptor_username, pa.status, pa.created_at as accepted_at, u.average_rating, u.ratings_count
            FROM publication_acceptances pa JOIN users u ON pa.acceptor_username = u.username
            WHERE pa.publication_id = $1 ORDER BY pa.created_at
        `;
        try {
            const result = await pool.query(sql, [id]);
            res.status(200).json(result.rows);
        } catch (error) {
            console.error('Error al obtener participantes:', error);
            res.status(500).json({ message: "Error interno del servidor." });
        }
    });

    // Ruta para ELIMINAR una publicación
    router.delete('/publications/:id', requireAcceptedLegalByUsernameField(['deleterUsername']), async (req, res) => {
        const { id } = req.params;
        const { deleterUsername } = req.body;
        if (!deleterUsername) return res.status(400).json({ message: "Se requiere nombre de usuario." });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const pubResult = await client.query(
                `SELECT p.*, u.username as author_username
                 FROM publications p
                 JOIN users u ON p.author_id = u.id
                 WHERE p.id = $1
                 FOR UPDATE`,
                [id]
            );
            const pub = pubResult.rows[0];

            if (!pub) throw { status: 404, message: "La publicación no existe." };
            if (pub.deleted_at) throw { status: 400, message: "La publicación ya fue eliminada." };
            if (pub.author_username !== deleterUsername) throw { status: 403, message: "No tienes permiso para eliminar esto." };

            const participantsCheck = await client.query(
                `SELECT 1 FROM publication_acceptances WHERE publication_id = $1 AND status IN ('approved', 'completed') LIMIT 1`,
                [id]
            );
            if (participantsCheck.rowCount > 0) {
                throw { status: 403, message: "No se puede eliminar una tarea con participantes activos." };
            }

            // ✅ Soft delete (no rompe FKs y mantiene historial/auditoría)
            await client.query(
                `UPDATE publications
                 SET deleted_at = NOW(), deleted_by_username = $2
                 WHERE id = $1`,
                [id, deleterUsername]
            );

            await logAuditEvent(client, req, {
                eventType: 'publication.deleted',
                actorUsername: deleterUsername,
                publicationId: parseInt(id, 10),
                category: pub.category,
                metadata: { soft_delete: true }
            });

            await client.query('COMMIT');
            res.status(200).json({ message: "Publicación eliminada (soft delete) correctamente." });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Error al eliminar publicación:", err.message);
            res.status(err.status || 500).json({ message: err.message || "Error interno." });
        } finally {
            client.release();
        }
    });

    // Ruta para PAUSAR/REANUDAR una publicación (REFACTORIZADA PARA MÁXIMA SEGURIDAD)
    router.post('/publications/:id/toggle-pause', requireAcceptedLegalByUsernameField(['username']), async (req, res) => {
        const { id } = req.params;
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ message: "Se requiere nombre de usuario." });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. OBTENER la publicación y VERIFICAR permisos explícitamente.
            const pubResult = await client.query(
                `SELECT p.is_paused, u.username as author_username FROM publications p JOIN users u ON p.author_id = u.id WHERE p.id = $1 FOR UPDATE`,
                [id]
            );

            if (pubResult.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: "La publicación no existe." });
            }

            const publication = pubResult.rows[0];

            // 2. Fallar rápido si el usuario no es el autor.
            if (publication.author_username !== username) {
                await client.query('ROLLBACK');
                return res.status(403).json({ message: "No tienes permiso para modificar esta publicación." });
            }

            // 3. Si los permisos son correctos, proceder con la actualización.
            const newPausedState = !publication.is_paused;
            await client.query(
                `UPDATE publications SET is_paused = $1 WHERE id = $2`,
                [newPausedState, id]
            );

            await client.query('COMMIT');

            const message = newPausedState ? "Publicación pausada." : "Publicación reanudada.";
            res.status(200).json({ message, isPaused: newPausedState });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error en toggle-pause:", error);
            res.status(500).json({ message: "Error interno del servidor." });
        } finally {
            if (client) client.release();
        }
    });

    // Ruta para OCULTAR una publicación
    router.post('/publications/:id/hide', requireAcceptedLegalByUsernameField(['username']), async (req, res) => {
        const { id } = req.params;
        const { username } = req.body;

        try {
            const sql = `INSERT INTO hidden_publications (publication_id, hider_username) VALUES ($1, $2) ON CONFLICT DO NOTHING`;
            await pool.query(sql, [id, username]);
            res.status(200).json({ message: "Publicación ocultada de tu vista." });
        } catch (error) {
            console.error("Error en /hide:", error);
            res.status(500).json({ message: "Error interno del servidor." });
        }
    });

    // Ruta para DESHACER OCULTAR (Unhide)
    router.post('/publications/:id/unhide', requireAcceptedLegalByUsernameField(['username']), async (req, res) => {
        const { id } = req.params;
        const { username } = req.body;

        try {
            const sql = `DELETE FROM hidden_publications WHERE publication_id = $1 AND hider_username = $2`;
            await pool.query(sql, [id, username]);
            res.status(200).json({ message: "Publicación restaurada." });
        } catch (error) {
            console.error("Error en /unhide:", error);
            res.status(500).json({ message: "Error interno del servidor." });
        }
    });

};
