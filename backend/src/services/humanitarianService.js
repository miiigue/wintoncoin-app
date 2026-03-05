/**
 * Servicio de Causas Humanitarias (Winton Solidario)
 * Lógica pura de negocio: Creación, Donación y Verificación de Referidos.
 */

const humanitarianService = async (pool, logger) => {

    const submitCause = async (userId, data) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const { title, story, goal_amount, evidence_urls } = data;

            const res = await client.query(`
                INSERT INTO humanitarian_causes (user_id, title, story, goal_amount, evidence_urls)
                VALUES ($1, $2, $3, $4, $5::jsonb)
                RETURNING id
            `, [userId, title, story, goal_amount, JSON.stringify(evidence_urls)]);

            await client.query('COMMIT');
            return res.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    };

    const donateToCause = async (donorId, causeId, amount) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Obtener la causa y el propietario
            const causeRes = await client.query(`
                SELECT c.*, u.id as owner_id 
                FROM humanitarian_causes c
                JOIN users u ON c.user_id = u.id
                WHERE c.id = $1 AND c.status = 'approved'
            `, [causeId]);

            if (causeRes.rows.length === 0) throw new Error('Causa no encontrada o no aprobada.');
            const cause = causeRes.rows[0];

            // 2. VERIFICACIÓN DE SEGURIDAD: ¿Es el donante un referido del solicitante?
            const donorRes = await client.query(`
                SELECT referred_by FROM users WHERE id = $1
            `, [donorId]);

            const donor = donorRes.rows[0];
            if (donor.referred_by !== cause.owner_id) {
                throw new Error('Solo los referidos directos pueden donar a esta causa.');
            }

            // 3. Verificar saldo BLUE IOU del donante (en el booster_blue_ledger)
            const balanceRes = await client.query(`
                SELECT booster_blue_ledger FROM users WHERE id = $1
            `, [donorId]);

            if (balanceRes.rows[0].booster_blue_ledger < amount) {
                throw new Error('Saldo BLUE IOU insuficiente.');
            }

            // 4. Ejecutar la donación (Transferencia Interna)
            // Restar del donante
            await client.query(`
                UPDATE users SET booster_blue_ledger = booster_blue_ledger - $1 WHERE id = $2
            `, [amount, donorId]);

            // Sumar al receptor (Booster Ledger por etapa pre-lanzamiento)
            await client.query(`
                UPDATE users SET booster_blue_ledger = booster_blue_ledger + $1 WHERE id = $2
            `, [amount, cause.owner_id]);

            // Actualizar la meta de la causa
            await client.query(`
                UPDATE humanitarian_causes SET current_amount = current_amount + $1 WHERE id = $2
            `, [amount, causeId]);

            // Registrar Auditoría
            await logger.logAuditEvent(client, donorId, 'HUMANITARIAN_DONATION', {
                cause_id: causeId,
                recipient_id: cause.owner_id,
                amount: amount,
                standard: 'Winton Solidario v1'
            });

            await client.query('COMMIT');
            return { success: true, new_amount: cause.current_amount + amount };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    };

    return { submitCause, donateToCause };
};

module.exports = humanitarianService;
