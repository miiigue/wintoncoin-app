const pool = require('../config/db');
const { logAuditEvent } = require('../services/auditService');
const eventBus = require('../services/notificationEventBus');

// Función para validar el precio en USD
function calculateUsdPrice({ currency, pricePerBlue, usdReferenceRate }) {
    if (String(currency).toUpperCase() === 'USD') {
        return pricePerBlue;
    }
    if (!usdReferenceRate || usdReferenceRate <= 0) {
        return null;
    }
    return pricePerBlue / usdReferenceRate;
}

// Dependencias adicionales
async function getP2pSettings(client) {
    const keys = [
        'p2p_enabled',
        'p2p_price_min',
        'p2p_price_max',
        'p2p_fee_percentage',
        'p2p_payment_window_minutes',
        'p2p_extension_minutes',
        'p2p_extension_limit',
        'p2p_cash_min_rating'
    ];
    const result = await client.query(
        `SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1::text[])`,
        [keys]
    );
    const map = result.rows.reduce((acc, row) => {
        acc[row.setting_key] = row.setting_value;
        return acc;
    }, {});
    return {
        enabled: map.p2p_enabled === 'true',
        priceMin: parseFloat(map.p2p_price_min || '0.95'),
        priceMax: parseFloat(map.p2p_price_max || '1.05'),
        feePct: parseFloat(map.p2p_fee_percentage || '0'),
        paymentWindowMinutes: parseInt(map.p2p_payment_window_minutes || '15', 10),
        extensionMinutes: parseInt(map.p2p_extension_minutes || '15', 10),
        extensionLimit: parseInt(map.p2p_extension_limit || '1', 10),
        cashMinRating: parseFloat(map.p2p_cash_min_rating || '4.5')
    };
}

function requireP2pEnabled(settings, res) {
    if (!settings.enabled) {
        res.status(403).json({ message: 'El módulo P2P está desactivado temporalmente.' });
        return false;
    }
    return true;
}

// Lista de métodos de pago P2P// Lista de métodos de pago P2P
exports.getPaymentMethods = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, code, label, is_cash
                     FROM p2p_payment_methods
                     WHERE is_active = TRUE
                     ORDER BY label ASC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error al listar métodos P2P:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// Crear oferta P2P
exports.createOffer = async (req, res) => {
    const {
        offerType,
        currency,
        pricePerBlue,
        usdReferenceRate,
        minFiatAmount,
        maxFiatAmount,
        availableBlueAmount,
        allowPartial = true,
        terms,
        paymentMethodIds
    } = req.body;
    const creatorUsername = req.user.username;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const settings = await getP2pSettings(client);
        if (!requireP2pEnabled(settings, res)) {
            await client.query('ROLLBACK');
            return;
        }

        if (!['buy', 'sell'].includes(String(offerType))) {
            throw { status: 400, message: 'Tipo de oferta inválido.' };
        }
        if (!currency) {
            throw { status: 400, message: 'La moneda es obligatoria.' };
        }
        const price = parseFloat(pricePerBlue);
        const minAmount = parseFloat(minFiatAmount);
        const maxAmount = parseFloat(maxFiatAmount);
        const blueAmount = parseFloat(availableBlueAmount);
        const usdRate = usdReferenceRate ? parseFloat(usdReferenceRate) : null;

        if (!Number.isFinite(price) || price <= 0) throw { status: 400, message: 'Precio inválido.' };
        if (!Number.isFinite(minAmount) || minAmount <= 0) throw { status: 400, message: 'Monto mínimo inválido.' };
        if (!Number.isFinite(maxAmount) || maxAmount < minAmount) throw { status: 400, message: 'Monto máximo inválido.' };
        if (!Number.isFinite(blueAmount) || blueAmount <= 0) throw { status: 400, message: 'Cantidad BLUE inválida.' };

        const usdPrice = calculateUsdPrice({ currency, pricePerBlue: price, usdReferenceRate: usdRate });
        if (!usdPrice) {
            throw { status: 400, message: 'Debes indicar el tipo de cambio USD para validar el rango de precio.' };
        }
        if (usdPrice < settings.priceMin || usdPrice > settings.priceMax) {
            throw {
                status: 400,
                message: `El precio debe estar dentro del rango ${settings.priceMin} - ${settings.priceMax} USD por BLUE.`
            };
        }

        if (!Array.isArray(paymentMethodIds) || paymentMethodIds.length === 0) {
            throw { status: 400, message: 'Debes seleccionar al menos un método de pago.' };
        }

        const methodsResult = await client.query(
            `SELECT id, is_cash FROM p2p_payment_methods WHERE id = ANY($1::int[]) AND is_active = TRUE`,
            [paymentMethodIds]
        );
        if (methodsResult.rowCount !== paymentMethodIds.length) {
            throw { status: 400, message: 'Métodos de pago inválidos.' };
        }
        const usesCash = methodsResult.rows.some(m => m.is_cash);
        if (usesCash) {
            const ratingResult = await client.query(
                `SELECT average_rating FROM users WHERE username = $1`,
                [creatorUsername]
            );
            const avgRating = parseFloat(ratingResult.rows[0]?.average_rating || '0');
            if (avgRating < settings.cashMinRating) {
                throw { status: 403, message: `Para usar efectivo necesitas reputación mínima de ${settings.cashMinRating}.` };
            }
        }

        if (offerType === 'sell') {
            const balanceResult = await client.query(
                `SELECT liquid_blue_balance FROM users WHERE username = $1`,
                [creatorUsername]
            );
            const liquidBlue = parseFloat(balanceResult.rows[0]?.liquid_blue_balance || '0');
            if (liquidBlue < blueAmount) {
                throw { status: 400, message: 'Saldo BLUE insuficiente para crear esta oferta.' };
            }
        }

        const insertOffer = await client.query(
            `INSERT INTO p2p_offers
                        (creator_username, offer_type, currency, price_per_blue, usd_reference_rate, min_fiat_amount, max_fiat_amount, available_blue_amount, allow_partial, terms)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                     RETURNING id`,
            [
                creatorUsername,
                offerType,
                String(currency).toUpperCase(),
                price,
                usdRate,
                minAmount,
                maxAmount,
                blueAmount,
                !!allowPartial,
                terms || null
            ]
        );

        const offerId = insertOffer.rows[0].id;
        for (const methodId of paymentMethodIds) {
            await client.query(
                `INSERT INTO p2p_offer_methods (offer_id, method_id) VALUES ($1, $2)`,
                [offerId, methodId]
            );
        }

        await logAuditEvent(client, req, {
            eventType: 'p2p.offer.created',
            actorUsername: creatorUsername,
            metadata: {
                offer_id: offerId,
                offer_type: offerType,
                currency: String(currency).toUpperCase(),
                price_per_blue: price,
                usd_price: usdPrice
            }
        });

        await client.query('COMMIT');
        res.status(201).json({ success: true, offerId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al crear oferta P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

// Listar ofertas P2P
exports.getOffers = async (req, res) => {
    const { type, currency, paymentMethod, paymentMethods, min, max } = req.query;
    const requestingUser = req.user.username;
    try {
        const conditions = ['o.status = \'active\'', 'o.available_blue_amount > 0', 'o.creator_username <> $1'];
        const values = [requestingUser];
        if (type) {
            values.push(type);
            conditions.push(`o.offer_type = $${values.length}`);
        }
        if (currency) {
            values.push(String(currency).toUpperCase());
            conditions.push(`o.currency = $${values.length}`);
        }
        if (min) {
            values.push(parseFloat(min));
            conditions.push(`o.min_fiat_amount <= $${values.length}`);
        }
        if (max) {
            values.push(parseFloat(max));
            conditions.push(`o.max_fiat_amount >= $${values.length}`);
        }
        let methodJoin = '';
        if (paymentMethods) {
            const methodIds = String(paymentMethods)
                .split(',')
                .map(id => parseInt(id, 10))
                .filter(id => Number.isFinite(id));
            if (methodIds.length > 0) {
                values.push(methodIds);
                methodJoin = `AND pom.method_id = ANY($${values.length}::int[])`;
            }
        } else if (paymentMethod) {
            values.push(parseInt(paymentMethod, 10));
            methodJoin = `AND pom.method_id = $${values.length}`;
        }

        const sql = `
                    SELECT
                        o.*,
                        u.average_rating,
                        u.ratings_count,
                        COALESCE(
                            json_agg(json_build_object('id', m.id, 'code', m.code, 'label', m.label, 'is_cash', m.is_cash))
                            FILTER (WHERE m.id IS NOT NULL),
                            '[]'
                        ) AS payment_methods
                    FROM p2p_offers o
                    JOIN users u ON o.creator_username = u.username
                    LEFT JOIN p2p_offer_methods pom ON o.id = pom.offer_id
                    LEFT JOIN p2p_payment_methods m ON pom.method_id = m.id
                    WHERE ${conditions.join(' AND ')} ${methodJoin}
                    GROUP BY o.id, u.average_rating, u.ratings_count
                    ORDER BY o.created_at DESC
                `;
        const result = await pool.query(sql, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al listar ofertas P2P:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// Mis ofertas P2P
exports.getMyOffers = async (req, res) => {
    const username = req.user.username;
    try {
        const result = await pool.query(
            `SELECT * FROM p2p_offers WHERE creator_username = $1 ORDER BY created_at DESC`,
            [username]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error al listar mis ofertas P2P:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// Crear orden P2P
exports.createOrder = async (req, res) => {
    const { offerId, fiatAmount } = req.body;
    const requestingUser = req.user.username;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const settings = await getP2pSettings(client);
        if (!requireP2pEnabled(settings, res)) {
            await client.query('ROLLBACK');
            return;
        }
        const offerResult = await client.query(
            `SELECT * FROM p2p_offers WHERE id = $1 FOR UPDATE`,
            [offerId]
        );
        const offer = offerResult.rows[0];
        if (!offer || offer.status !== 'active') {
            throw { status: 404, message: 'Oferta no disponible.' };
        }
        if (offer.creator_username === requestingUser) {
            throw { status: 400, message: 'No puedes tomar tu propia oferta.' };
        }

        const amountFiat = parseFloat(fiatAmount);
        if (!Number.isFinite(amountFiat) || amountFiat <= 0) {
            throw { status: 400, message: 'Monto inválido.' };
        }
        if (amountFiat < offer.min_fiat_amount || amountFiat > offer.max_fiat_amount) {
            throw { status: 400, message: 'Monto fuera del rango permitido.' };
        }

        const blueAmount = amountFiat / parseFloat(offer.price_per_blue);
        if (blueAmount > parseFloat(offer.available_blue_amount)) {
            throw { status: 400, message: 'La oferta no tiene suficiente BLUE disponible.' };
        }

        const seller = offer.offer_type === 'sell' ? offer.creator_username : requestingUser;
        const buyer = offer.offer_type === 'sell' ? requestingUser : offer.creator_username;

        const sellerBalanceResult = await client.query(
            `SELECT id, liquid_blue_balance, escrow_blue_balance FROM users WHERE username = $1 FOR UPDATE`,
            [seller]
        );
        const sellerBalance = sellerBalanceResult.rows[0];
        const liquidBlue = parseFloat(sellerBalance?.liquid_blue_balance || '0');
        if (liquidBlue < blueAmount) {
            throw { status: 400, message: 'El vendedor no tiene saldo BLUE suficiente.' };
        }

        await client.query(
            `SELECT record_balance_event($1, 'withdrawal', 'liquid_blue', $2, NULL)`,
            [sellerBalance.id, blueAmount]
        );
        await client.query(
            `SELECT record_balance_event($1, 'deposit', 'escrow_blue', $2, NULL)`,
            [sellerBalance.id, blueAmount]
        );
        await logAuditEvent(client, req, {
            eventType: 'p2p.escrow.locked',
            actorUsername: requestingUser,
            targetUsername: seller,
            metadata: {
                offer_id: offer.id,
                order_fiat_amount: amountFiat,
                blue_amount: blueAmount,
                balance_move: 'liquid_blue -> escrow_blue'
            }
        });

        const expiresAt = new Date(Date.now() + settings.paymentWindowMinutes * 60 * 1000);
        const orderResult = await client.query(
            `INSERT INTO p2p_orders
                        (offer_id, buyer_username, seller_username, fiat_amount, blue_amount, price_per_blue, currency, expires_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     RETURNING id`,
            [offer.id, buyer, seller, amountFiat, blueAmount, offer.price_per_blue, offer.currency, expiresAt]
        );

        await client.query(
            `UPDATE p2p_offers
                     SET available_blue_amount = available_blue_amount - $1,
                         status = CASE WHEN (available_blue_amount - $1) <= 0 THEN 'paused' ELSE status END,
                         updated_at = NOW()
                     WHERE id = $2`,
            [blueAmount, offer.id]
        );

        await logAuditEvent(client, req, {
            eventType: 'p2p.order.created',
            actorUsername: requestingUser,
            metadata: {
                order_id: orderResult.rows[0].id,
                offer_id: offer.id,
                buyer,
                seller,
                blue_amount: blueAmount,
                fiat_amount: amountFiat
            }
        });

        await client.query('COMMIT');
        res.status(201).json({ success: true, orderId: orderResult.rows[0].id });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al crear orden P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

// Listar órdenes del usuario
exports.getOrders = async (req, res) => {
    const username = req.user.username;
    const { role = 'all', status } = req.query;
    try {
        const conditions = [];
        const values = [];
        if (role === 'buyer') {
            values.push(username);
            conditions.push(`o.buyer_username = $${values.length}`);
        } else if (role === 'seller') {
            values.push(username);
            conditions.push(`o.seller_username = $${values.length}`);
        } else {
            values.push(username);
            values.push(username);
            conditions.push(`(o.buyer_username = $${values.length - 1} OR o.seller_username = $${values.length})`);
        }
        if (status) {
            values.push(status);
            conditions.push(`o.status = $${values.length}`);
        }

        const sql = `
                    SELECT o.*, off.offer_type, off.creator_username
                    FROM p2p_orders o
                    JOIN p2p_offers off ON o.offer_id = off.id
                    WHERE ${conditions.join(' AND ')}
                    ORDER BY o.created_at DESC
                `;
        const result = await pool.query(sql, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al listar órdenes P2P:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// Marcar como pagado
exports.markOrderPaid = async (req, res) => {
    const orderId = req.params.id;
    const username = req.user.username;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const orderResult = await client.query(
            `SELECT * FROM p2p_orders WHERE id = $1 FOR UPDATE`,
            [orderId]
        );
        const order = orderResult.rows[0];
        if (!order) throw { status: 404, message: 'Orden no encontrada.' };
        if (order.buyer_username !== username) throw { status: 403, message: 'Solo el comprador puede marcar como pagado.' };
        if (order.status !== 'payment_pending') throw { status: 400, message: 'La orden no está pendiente de pago.' };

        await client.query(
            `UPDATE p2p_orders SET status = 'paid', paid_at = NOW() WHERE id = $1`,
            [orderId]
        );

        await logAuditEvent(client, req, {
            eventType: 'p2p.order.paid',
            actorUsername: username,
            metadata: { order_id: orderId }
        });

        await client.query('COMMIT');
        res.json({ success: true, message: 'Pago marcado correctamente.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al marcar pago P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

// Liberar BLUE (vendedor)
exports.releaseOrder = async (req, res) => {
    const orderId = req.params.id;
    const username = req.user.username;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const orderResult = await client.query(
            `SELECT * FROM p2p_orders WHERE id = $1 FOR UPDATE`,
            [orderId]
        );
        const order = orderResult.rows[0];
        if (!order) throw { status: 404, message: 'Orden no encontrada.' };
        if (order.seller_username !== username) throw { status: 403, message: 'Solo el vendedor puede liberar.' };
        if (order.status !== 'paid') throw { status: 400, message: 'La orden no está en estado pagado.' };

        const sellerResult = await client.query(
            `SELECT id FROM users WHERE username = $1 FOR UPDATE`,
            [order.seller_username]
        );
        const buyerResult = await client.query(
            `SELECT id FROM users WHERE username = $1 FOR UPDATE`,
            [order.buyer_username]
        );
        const sellerId = sellerResult.rows[0]?.id;
        const buyerId = buyerResult.rows[0]?.id;
        if (!sellerId || !buyerId) {
            throw { status: 404, message: 'Usuarios de la orden no encontrados.' };
        }

        await client.query(
            `SELECT record_balance_event($1, 'withdrawal', 'escrow_blue', $2, NULL)`,
            [sellerId, order.blue_amount]
        );
        await client.query(
            `SELECT record_balance_event($1, 'deposit', 'liquid_blue', $2, NULL)`,
            [buyerId, order.blue_amount]
        );
        await logAuditEvent(client, req, {
            eventType: 'p2p.escrow.released',
            actorUsername: username,
            targetUsername: order.buyer_username,
            metadata: {
                order_id: orderId,
                blue_amount: order.blue_amount,
                balance_move: 'escrow_blue(seller) -> liquid_blue(buyer)'
            }
        });

        await client.query(
            `UPDATE p2p_orders SET status = 'released', released_at = NOW() WHERE id = $1`,
            [orderId]
        );

        await client.query(
            `INSERT INTO transactions (user_id, type, description, blue_change, red_change)
                     SELECT id, 'p2p_buy', 'Compra P2P BLUE', $1, 0 FROM users WHERE username = $2`,
            [order.blue_amount, order.buyer_username]
        );

        await logAuditEvent(client, req, {
            eventType: 'p2p.order.released',
            actorUsername: username,
            metadata: { order_id: orderId }
        });

        // --- NOTIFICACIÓN PUSH AL COMPRADOR ---
        // Esto se ejecuta de forma asíncrona (no bloquea la respuesta HTTP)
        // pero DEBERÍA estar fuera de la transacción DB crítica si es posible,
        // o manejado con cuidado para no fallar el commit si la notificación falla.
        // Aquí usamos .catch() evitar que un error de push revierta la transacción financiera.
        // --- NOTIFICACIÓN PUSH AUTOMÁTICA (Event-Driven) ---
        // Emitimos el evento y el bus se encarga de la lógica y seguridad.
        // Esto mantiene el controlador limpio.
        eventBus.emit('TASK_PAID', {
            publicationId: orderId, // En P2P orderId es equivalente a publicationId en contexto simple
            publicationTitle: `Orden P2P #${orderId}`,
            participantId: buyerId,
            amount: order.blue_amount
        });




        await client.query('COMMIT');
        res.json({ success: true, message: 'BLUE liberado correctamente.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al liberar P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

// Cancelar orden (solo antes de pagar)
exports.cancelOrder = async (req, res) => {
    const orderId = req.params.id;
    const username = req.user.username;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const orderResult = await client.query(
            `SELECT * FROM p2p_orders WHERE id = $1 FOR UPDATE`,
            [orderId]
        );
        const order = orderResult.rows[0];
        if (!order) throw { status: 404, message: 'Orden no encontrada.' };
        if (order.status !== 'payment_pending') throw { status: 400, message: 'Solo se puede cancelar antes del pago.' };
        if (![order.buyer_username, order.seller_username].includes(username)) {
            throw { status: 403, message: 'No tienes permiso para cancelar esta orden.' };
        }

        const sellerResult = await client.query(
            `SELECT id FROM users WHERE username = $1 FOR UPDATE`,
            [order.seller_username]
        );
        const sellerId = sellerResult.rows[0]?.id;
        if (!sellerId) {
            throw { status: 404, message: 'Vendedor no encontrado.' };
        }

        await client.query(
            `SELECT record_balance_event($1, 'withdrawal', 'escrow_blue', $2, NULL)`,
            [sellerId, order.blue_amount]
        );
        await client.query(
            `SELECT record_balance_event($1, 'deposit', 'liquid_blue', $2, NULL)`,
            [sellerId, order.blue_amount]
        );
        await logAuditEvent(client, req, {
            eventType: 'p2p.escrow.refunded',
            actorUsername: username,
            targetUsername: order.seller_username,
            metadata: {
                order_id: orderId,
                blue_amount: order.blue_amount,
                balance_move: 'escrow_blue -> liquid_blue'
            }
        });
        await client.query(
            `UPDATE p2p_offers
                     SET available_blue_amount = available_blue_amount + $1,
                         status = 'active',
                         updated_at = NOW()
                     WHERE id = $2`,
            [order.blue_amount, order.offer_id]
        );
        await client.query(
            `UPDATE p2p_orders SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
            [orderId]
        );

        await logAuditEvent(client, req, {
            eventType: 'p2p.order.cancelled',
            actorUsername: username,
            metadata: { order_id: orderId }
        });

        await client.query('COMMIT');
        res.json({ success: true, message: 'Orden cancelada.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al cancelar P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

// Solicitar o aprobar extensión
exports.requestExtension = async (req, res) => {
    const orderId = req.params.id;
    const username = req.user.username;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const settings = await getP2pSettings(client);
        const orderResult = await client.query(
            `SELECT * FROM p2p_orders WHERE id = $1 FOR UPDATE`,
            [orderId]
        );
        const order = orderResult.rows[0];
        if (!order) throw { status: 404, message: 'Orden no encontrada.' };
        if (order.status !== 'payment_pending') throw { status: 400, message: 'La orden no es elegible para extensión.' };
        if (![order.buyer_username, order.seller_username].includes(username)) {
            throw { status: 403, message: 'No tienes permiso para solicitar extensión.' };
        }
        if (order.extension_count >= settings.extensionLimit) {
            throw { status: 400, message: 'Se alcanzó el límite de extensiones.' };
        }

        if (!order.extension_requested_by) {
            await client.query(
                `UPDATE p2p_orders
                         SET extension_requested_by = $1, extension_requested_at = NOW()
                         WHERE id = $2`,
                [username, orderId]
            );
            await client.query('COMMIT');
            return res.json({ success: true, message: 'Solicitud de extensión enviada.' });
        }

        if (order.extension_requested_by === username) {
            await client.query('COMMIT');
            return res.json({ success: true, message: 'La extensión ya fue solicitada por ti.' });
        }

        await client.query(
            `UPDATE p2p_orders
                     SET expires_at = expires_at + ($1 || ' minutes')::interval,
                         extension_count = extension_count + 1,
                         extension_requested_by = NULL,
                         extension_requested_at = NULL
                     WHERE id = $2`,
            [settings.extensionMinutes, orderId]
        );

        await logAuditEvent(client, req, {
            eventType: 'p2p.order.extended',
            actorUsername: username,
            metadata: { order_id: orderId }
        });

        await client.query('COMMIT');
        res.json({ success: true, message: 'Extensión aprobada y aplicada.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al extender P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

// Disputa
exports.disputeOrder = async (req, res) => {
    const orderId = req.params.id;
    const { reason } = req.body;
    const username = req.user.username;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const orderResult = await client.query(
            `SELECT * FROM p2p_orders WHERE id = $1 FOR UPDATE`,
            [orderId]
        );
        const order = orderResult.rows[0];
        if (!order) throw { status: 404, message: 'Orden no encontrada.' };
        if (order.status !== 'paid') throw { status: 400, message: 'Solo se puede disputar después de marcar pago.' };
        if (![order.buyer_username, order.seller_username].includes(username)) {
            throw { status: 403, message: 'No tienes permiso para disputar.' };
        }
        if (!reason) throw { status: 400, message: 'Motivo requerido.' };

        const disputeResult = await client.query(
            `INSERT INTO p2p_disputes (order_id, opened_by, reason)
                     VALUES ($1, $2, $3)
                     RETURNING id`,
            [orderId, username, reason]
        );
        await client.query(
            `UPDATE p2p_orders SET status = 'disputed', disputed_at = NOW() WHERE id = $1`,
            [orderId]
        );

        await logAuditEvent(client, req, {
            eventType: 'p2p.order.disputed',
            actorUsername: username,
            metadata: { order_id: orderId, dispute_id: disputeResult.rows[0].id }
        });

        await client.query('COMMIT');
        res.json({ success: true, disputeId: disputeResult.rows[0].id });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al abrir disputa P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

// Calificar reputación P2P (obligatoria después de liberación)
exports.rateOrder = async (req, res) => {
    const orderId = req.params.id;
    const { rating, comment } = req.body;
    const rater = req.user.username;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const orderResult = await client.query(
            `SELECT * FROM p2p_orders WHERE id = $1 FOR UPDATE`,
            [orderId]
        );
        const order = orderResult.rows[0];
        if (!order) throw { status: 404, message: 'Orden no encontrada.' };
        if (order.status !== 'released') throw { status: 400, message: 'Solo se puede calificar una orden liberada.' };
        if (![order.buyer_username, order.seller_username].includes(rater)) {
            throw { status: 403, message: 'No tienes permiso para calificar.' };
        }
        const ratee = rater === order.buyer_username ? order.seller_username : order.buyer_username;
        const score = parseInt(rating, 10);
        if (!Number.isInteger(score) || score < 1 || score > 5) {
            throw { status: 400, message: 'Calificación inválida.' };
        }

        await client.query(
            `INSERT INTO p2p_ratings (order_id, rater_username, ratee_username, rating, comment)
                     VALUES ($1, $2, $3, $4, $5)`,
            [orderId, rater, ratee, score, comment || null]
        );

        const userResult = await client.query(
            `SELECT average_rating, ratings_count FROM users WHERE username = $1 FOR UPDATE`,
            [ratee]
        );
        const currentAvg = parseFloat(userResult.rows[0]?.average_rating || '0');
        const currentCount = parseInt(userResult.rows[0]?.ratings_count || '0', 10);
        const newCount = currentCount + 1;
        const newAvg = ((currentAvg * currentCount) + score) / newCount;
        await client.query(
            `UPDATE users SET average_rating = $1, ratings_count = $2 WHERE username = $3`,
            [newAvg, newCount, ratee]
        );

        await logAuditEvent(client, req, {
            eventType: 'p2p.order.rated',
            actorUsername: rater,
            targetUsername: ratee,
            metadata: { order_id: orderId, rating: score }
        });

        await client.query('COMMIT');
        res.json({ success: true, message: 'Calificación registrada.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al calificar P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

// Resolver disputa (admin)
exports.resolveDisputeAdmin = async (req, res) => {
    const disputeId = req.params.id;
    const { action, resolution } = req.body; // action: release_to_buyer | refund_seller
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const disputeResult = await client.query(
            `SELECT d.*, o.* FROM p2p_disputes d
                     JOIN p2p_orders o ON d.order_id = o.id
                     WHERE d.id = $1 FOR UPDATE`,
            [disputeId]
        );
        const dispute = disputeResult.rows[0];
        if (!dispute) throw { status: 404, message: 'Disputa no encontrada.' };
        if (dispute.status !== 'open') throw { status: 400, message: 'La disputa ya está resuelta.' };

        if (action === 'release_to_buyer') {
            const sellerResult = await client.query(
                `SELECT id FROM users WHERE username = $1 FOR UPDATE`,
                [dispute.seller_username]
            );
            const buyerResult = await client.query(
                `SELECT id FROM users WHERE username = $1 FOR UPDATE`,
                [dispute.buyer_username]
            );
            const sellerId = sellerResult.rows[0]?.id;
            const buyerId = buyerResult.rows[0]?.id;
            if (!sellerId || !buyerId) {
                throw { status: 404, message: 'Usuarios de la orden no encontrados.' };
            }
            await client.query(
                `SELECT record_balance_event($1, 'withdrawal', 'escrow_blue', $2, NULL)`,
                [sellerId, dispute.blue_amount]
            );
            await client.query(
                `SELECT record_balance_event($1, 'deposit', 'liquid_blue', $2, NULL)`,
                [buyerId, dispute.blue_amount]
            );
            await client.query(
                `UPDATE p2p_orders SET status = 'released', released_at = NOW() WHERE id = $1`,
                [dispute.order_id]
            );
        } else if (action === 'refund_seller') {
            const sellerResult = await client.query(
                `SELECT id FROM users WHERE username = $1 FOR UPDATE`,
                [dispute.seller_username]
            );
            const sellerId = sellerResult.rows[0]?.id;
            if (!sellerId) {
                throw { status: 404, message: 'Vendedor no encontrado.' };
            }
            await client.query(
                `SELECT record_balance_event($1, 'withdrawal', 'escrow_blue', $2, NULL)`,
                [sellerId, dispute.blue_amount]
            );
            await client.query(
                `SELECT record_balance_event($1, 'deposit', 'liquid_blue', $2, NULL)`,
                [sellerId, dispute.blue_amount]
            );
            await client.query(
                `UPDATE p2p_orders SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
                [dispute.order_id]
            );
        } else {
            throw { status: 400, message: 'Acción inválida.' };
        }

        await client.query(
            `UPDATE p2p_disputes
                     SET status = 'resolved', resolution = $1, resolved_by = 'admin', resolved_at = NOW()
                     WHERE id = $2`,
            [resolution || null, disputeId]
        );

        await logAuditEvent(client, req, {
            eventType: 'p2p.dispute.resolved',
            actorUsername: 'admin',
            metadata: { dispute_id: disputeId, action }
        });

        await client.query('COMMIT');
        res.json({ success: true, message: 'Disputa resuelta.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al resolver disputa P2P:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};


