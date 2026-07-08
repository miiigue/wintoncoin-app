const pool = require('../config/db');

// ==============================================================
// FINANCIAL CORE SERVICE (MOTOR FINANCIERO CRÍTICO)
// ==============================================================
// ADVERTENCIA DE SEGURIDAD (NIVEL 5)
// Este módulo manipula saldos, deudas y ejecuta quemas (burns).
// Toda operación debe ejecutarse con el pool transaction (client)
// inyectado, utilizando FOR UPDATE para evitar Race Conditions
// y Double-Spending.
// ==============================================================

const FinancialCoreService = {

    /**
     * Motor Central de Quema de Tokens y Liquidación de Deudas
     * @param {Object} client - Conexión de base de datos activa (transacción)
     * @param {String} username - Nombre del usuario a quemar tokens
     * @param {Number} amountToBurn - Cantidad total solicitada para quemar
     * @returns {Object} { success, message, actualAmountBurned }
     */
    executeBurn: async (client, username, amountToBurn) => {
        if (amountToBurn <= 0) {
            return { success: false, message: 'La cantidad a quemar debe ser positiva.', actualAmountBurned: 0 };
        }

        // 1. Obtener saldos y deudas del usuario dentro de una transacción con LOCK (FOR UPDATE)
        // Esto evita que dos peticiones simultáneas lean el mismo saldo (Double-Spending)
        const userResult = await client.query(
            `SELECT id, liquid_blue_balance, escrow_blue_balance, red_balance FROM users WHERE username = $1 FOR UPDATE`,
            [username]
        );

        if (userResult.rowCount === 0) {
            return { success: false, message: 'Usuario no encontrado.', actualAmountBurned: 0 };
        }

        const user = userResult.rows[0];
        const userId = user.id;
        const liquidBlue = parseFloat(user.liquid_blue_balance);
        const escrowBlue = parseFloat(user.escrow_blue_balance);
        const totalBlueAvailable = liquidBlue + escrowBlue;
        const totalRed = parseFloat(user.red_balance);

        // Determinar la cantidad real que se puede quemar (la más pequeña entre BLUE disponible, RED disponible y la cantidad solicitada)
        const actualAmountToBurn = Math.min(amountToBurn, totalBlueAvailable, totalRed);

        if (actualAmountToBurn < 0.0001) { // Umbral de seguridad para flotantes
            return { success: true, message: 'No hay saldo suficiente para quemar.', actualAmountBurned: 0 };
        }

        // 2. Determinar cuánto se quema de cada tipo de saldo BLUE (Prioridad: Liquid, luego Escrow)
        const burnedFromLiquid = Math.min(actualAmountToBurn, liquidBlue);
        const burnedFromEscrow = actualAmountToBurn - burnedFromLiquid;

        // 3. Saldar deudas RED (las más antiguas primero, aplicando LOCK)
        const debtsResult = await client.query(
            `SELECT id, amount FROM red_token_debts WHERE username = $1 AND is_settled = FALSE ORDER BY due_at ASC FOR UPDATE`,
            [username]
        );

        let remainingToSettle = actualAmountToBurn;
        for (const debt of debtsResult.rows) {
            if (remainingToSettle <= 0) break;

            const amountFromThisDebt = Math.min(remainingToSettle, parseFloat(debt.amount));
            const newDebtAmount = parseFloat(debt.amount) - amountFromThisDebt;

            if (newDebtAmount < 0.0001) {
                // Si la deuda se paga por completo, la marcamos como saldada
                await client.query(
                    `UPDATE red_token_debts SET amount = 0, is_settled = TRUE, settled_at = NOW() WHERE id = $1`,
                    [debt.id]
                );
            } else {
                // Si se paga parcialmente
                await client.query(
                    `UPDATE red_token_debts SET amount = $1 WHERE id = $2`,
                    [newDebtAmount, debt.id]
                );
            }
            remainingToSettle -= amountFromThisDebt;
        }

        // Si aún sobra "remainingToSettle", significa que había RED balance disponible que NO estaba en forma de deuda específica
        // La lógica original simplemente descuenta el balance global.

        // 4. Actualizar saldos en la tabla users
        await client.query(
            `UPDATE users 
             SET liquid_blue_balance = liquid_blue_balance - $1,
                 escrow_blue_balance = escrow_blue_balance - $2,
                 red_balance = red_balance - $3
             WHERE id = $4`,
            [burnedFromLiquid, burnedFromEscrow, actualAmountToBurn, userId]
        );

        // 5. Registrar el evento en el historial de transacciones (Ledger de la Plataforma y Auditoría)
        await client.query(
            `INSERT INTO platform_wallet_log (transaction_type, amount, related_username, description)
             VALUES ('burn', $1, $2, 'Tokens quemados para saldar deuda RED')`,
            [actualAmountToBurn, username]
        );

        // Registro de Auditoría Bancaria
        await client.query(
            `INSERT INTO audit_logs (user_id, action, details)
             VALUES ($1, 'burn_tokens', $2)`,
            [userId, JSON.stringify({
                amount: actualAmountToBurn,
                from_liquid: burnedFromLiquid,
                from_escrow: burnedFromEscrow,
                remaining_debt_settled: remainingToSettle
            })]
        );

        return { 
            success: true, 
            message: `Quema de tokens ejecutada con éxito. Total quemado: ${actualAmountToBurn.toFixed(2)} BLUE/RED.`,
            actualAmountBurned: actualAmountToBurn 
        };
    },

    /**
     * Calcula el saldo elegible (disponible) de un usuario impulsor,
     * restando de su saldo total los bonos de referidos cuyos invitados
     * no posean KYC aprobado (kyc_verified = true).
     * @param {Object} client - Conexión de base de datos activa (transacción)
     * @param {Number} userId - ID del usuario impulsor
     * @returns {Object} { totalBalance, unverifiedReferralBalance, eligibleBalance }
     */
    getUserEligibleBalance: async (client, userId) => {
        const dbClient = client || pool;

        // =====================================================================
        // GATE 1 (TITULAR): Verificar KYC del propio usuario PRIMERO.
        // ─────────────────────────────────────────────────────────────────────
        // FUNDAMENTO REGULATORIO:
        //   - FATF Recommendation 10 / AMLD5 (UE) / FinCEN (US)
        //   - Un usuario sin identidad verificada (KYC) NO puede tener saldo
        //     "disponible". Sus fondos deben permanecer en estado "pending"
        //     hasta que complete la verificación.
        //   - Este es el patrón estándar de Binance, Coinbase, Stripe Connect
        //     y cualquier plataforma FinTech regulada: freeze-on-unverified.
        //   - Principio de Menor Privilegio (ISO 27001): sin KYC, sin liquidez.
        // ─────────────────────────────────────────────────────────────────────
        // AUDITORÍA: Se lee directamente desde la DB (sincronizada con la
        // blockchain en cada llamada a /api/me/balance vía userController).
        // =====================================================================
        const ownerKycResult = await dbClient.query(
            // Se usa SELECT con columna específica (no SELECT *) para minimizar
            // la superficie de ataque y optimizar el plan de ejecución de la BD.
            'SELECT COALESCE(kyc_verified, false) AS kyc_verified FROM users WHERE id = $1',
            [userId]
        );

        // Obtener el saldo total del ledger para poder retornarlo como "pendiente"
        // incluso cuando el KYC no está aprobado (el frontend lo muestra en la
        // tarjeta "Saldo Pendiente (KYC)" para que el usuario sepa que existe).
        const totalResult = await dbClient.query(
            // COALESCE garantiza que nunca retornemos NULL — defensivo ante
            // casos de usuario nuevo sin entradas en el ledger.
            'SELECT COALESCE(SUM(amount), 0) AS total FROM booster_blue_ledger WHERE user_id = $1',
            [userId]
        );
        const totalBalance = parseFloat(totalResult.rows[0].total) || 0;

        // Evaluar resultado del Gate 1 (KYC del dueño)
        const ownerHasKyc = ownerKycResult.rows[0]?.kyc_verified === true;

        // =====================================================================
        // GATE 2 (REFERIDOS): Obtener montos bloqueados por falta de KYC
        // de los referidos (Gate 2).
        // ─────────────────────────────────────────────────────────────────────
        // FUNDAMENTO: Un bono de referido solo se "libera" si tanto el referidor
        // (Gate 1) como el referido (Gate 2) tienen identidad verificada.
        // Esto previene que se usen referidos ficticios para lavar fondos (AML).
        // ─────────────────────────────────────────────────────────────────────
        // TÉCNICA: Data Lineage (Fase AML). Se une el ledger directamente con el
        // usuario referido a través de reference_user_id, garantizando trazabilidad
        // perfecta e infalible, sin heurísticas temporales.
        // =====================================================================
        const unverifiedResult = await dbClient.query(`
            SELECT COALESCE(SUM(bbl.amount), 0) AS unverified_total
            FROM booster_blue_ledger bbl
            JOIN users u ON bbl.reference_user_id = u.id
            WHERE bbl.user_id = $1
              AND bbl.type IN ('referral_reward', 'referral_bonus_sent') -- Solo bonos de tipo referido
              AND bbl.amount > 0                        -- Solo entradas positivas (ganancias)
              -- BLINDAJE ASIMÉTRICO (AML/UX): Solo descontar si el usuario actual ($1) es el referente de esta relación.
              -- Si el usuario actual es el referido (invitado), su bono no se ve afectado por el KYC de quien lo invitó.
              AND EXISTS (
                  SELECT 1 FROM referral_log rl 
                  WHERE rl.referrer_user_id = $1 
                    AND rl.referred_user_id = bbl.reference_user_id
              )
              -- GATE 2: Sólo descontar los referidos que AÚN NO tienen KYC.
              AND COALESCE(u.kyc_verified, false) = false
        `, [userId]);

        // Monto de bonos de referidos bloqueados por falta de KYC del referido
        const unverifiedReferralBalance = parseFloat(unverifiedResult.rows[0].unverified_total) || 0;

        // ─────────────────────────────────────────────────────────────────────
        // CÁLCULO DE SALDOS (FINTECH & BANCARIO)
        // ─────────────────────────────────────────────────────────────────────
        // 1. baseEligibleBalance: Saldo seguro acumulado por el propio usuario 
        //    (bono de bienvenida, tareas realizadas y referidos verificados).
        //    Excluye estrictamente los referidos pendientes de KYC.
        //    Math.max(0, ...) actúa como salvaguarda contra saldos negativos.
        // ─────────────────────────────────────────────────────────────────────
        const baseEligibleBalance = Math.max(0, totalBalance - unverifiedReferralBalance);

        // ─────────────────────────────────────────────────────────────────────
        // 2. eligibleBalance: Saldo líquido/retirable de inmediato en el sistema.
        //    Si el propio titular (ownerHasKyc) no tiene KYC, su liquidez es 0.
        //    Esto cumple con la restricción de retiro AML (no outbound transfers).
        // ─────────────────────────────────────────────────────────────────────
        const eligibleBalance = ownerHasKyc ? baseEligibleBalance : 0;

        return {
            totalBalance,
            unverifiedReferralBalance,
            eligibleBalance,
            baseEligibleBalance,
            ownerHasKyc
        };
    }
};

module.exports = FinancialCoreService;
