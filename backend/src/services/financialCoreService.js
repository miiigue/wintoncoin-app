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
    }
};

module.exports = FinancialCoreService;
