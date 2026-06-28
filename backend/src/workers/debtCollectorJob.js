/**
 * Módulo aislado para el proceso de Debt Collector
 */
async function debtCollectorJob(pool) {
    console.log('DEBT COLLECTOR: Iniciando ciclo de recolección de deudas vencidas...');
    // Declaramos la variable del cliente de base de datos en el ámbito exterior para que sea accesible en try/catch/finally
    let client;
    try {
        // Obtenemos la conexión del pool. Si falla la red (EHOSTUNREACH), se captura de forma segura en el catch
        client = await pool.connect();

        // Iniciamos la transacción SQL de manera segura
        await client.query('BEGIN');

        // Consultamos si el sistema de deudas está activado Y si NO estamos en pre-lanzamiento
        const settingsResult = await client.query(`SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('debt_system_enabled', 'pre_launch_mode_enabled')`);
        
        const isDebtSystemEnabled = settingsResult.rows.find(r => r.setting_key === 'debt_system_enabled')?.setting_value === 'true';
        const isPreLaunchMode = settingsResult.rows.find(r => r.setting_key === 'pre_launch_mode_enabled')?.setting_value === 'true';

        if (isPreLaunchMode) {
            console.log('DEBT COLLECTOR: Sistema en modo pre-lanzamiento. Recolección de deudas en pausa económica.');
            await client.query('ROLLBACK');
            return;
        }

        if (!isDebtSystemEnabled) {
            console.log('DEBT COLLECTOR: El sistema de deudas está desactivado. Saltando ciclo.');
            await client.query('ROLLBACK');
            return;
        }

        // 1. Obtener todas las deudas vencidas, no saldadas y no penalizadas, agrupadas por usuario
        const overdueDebtsResult = await client.query(`
            SELECT username, SUM(amount) as total_due
            FROM red_token_debts
            WHERE due_at <= NOW() AND is_settled = FALSE AND is_penalized = FALSE
            GROUP BY username
        `);

        if (overdueDebtsResult.rowCount === 0) {
            console.log('DEBT COLLECTOR: No se encontraron deudas vencidas para procesar.');
            await client.query('ROLLBACK');
            return;
        }

        console.log(`DEBT COLLECTOR: Se encontraron deudas vencidas para ${overdueDebtsResult.rowCount} usuario(s).`);

        // 2. Procesar cada usuario con deudas vencidas
        for (const userDebt of overdueDebtsResult.rows) {
            const { username, total_due } = userDebt;
            const amountToSettle = parseFloat(total_due);

            // La función executeBurn ya determina el máximo posible a quemar.
            // Le pasamos el total de la deuda y ella hará el resto.
            console.log(`DEBT COLLECTOR: Intentando saldar ${amountToSettle.toFixed(4)} RED para el usuario ${username}.`);
            const burnResult = await require('../services/financialCoreService').executeBurn(client, username, amountToSettle);

            if (burnResult.success && burnResult.actualAmountBurned > 0) {
                const notificationMessage = `Se realizó una quema automática de ${burnResult.actualAmountBurned.toFixed(4)} tokens para cubrir tu compromiso vencido.`;
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [username, notificationMessage]);
                console.log(`DEBT COLLECTOR: Quema automática exitosa para ${username}. Cantidad: ${burnResult.actualAmountBurned.toFixed(4)}`);
            } else {
                console.log(`DEBT COLLECTOR: No se pudo realizar la quema automática para ${username}. Mensaje: ${burnResult.message}`);
            }

            // 3. Marcar las deudas restantes (si las hay) como penalizadas
            await client.query(
                `UPDATE red_token_debts SET is_penalized = TRUE WHERE username = $1 AND due_at <= NOW() AND is_settled = FALSE`,
                [username]
            );
        }

        // Confirmamos la transacción tras procesar correctamente
        await client.query('COMMIT');
        console.log('DEBT COLLECTOR: Ciclo de recolección finalizado exitosamente.');

    } catch (error) {
        // Solo ejecutamos ROLLBACK si el cliente logró conectarse e iniciar la transacción
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('DEBT COLLECTOR: Error al ejecutar ROLLBACK:', rollbackError.message);
            }
        }
        // Registramos el error de forma auditable sin tumbar la aplicación
        console.error('DEBT COLLECTOR: Error crítico durante el ciclo de recolección de deudas.', error.message || error);
    } finally {
        // Liberamos el cliente de vuelta al pool si fue instanciado para prevenir fugas de conexiones
        if (client) {
            client.release();
        }
    }
}

module.exports = debtCollectorJob;
