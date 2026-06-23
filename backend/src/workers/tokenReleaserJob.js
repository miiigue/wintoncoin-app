/**
 * Módulo aislado para el proceso de Token Releaser
 */
async function tokenReleaserJob(pool) {
    console.log('TOKEN RELEASER: Iniciando ciclo de liberación de tokens BLUE...');
    // Declaramos la variable del cliente de base de datos en el ámbito exterior para que sea accesible en try/catch/finally
    let client;
    try {
        // Obtenemos la conexión del pool. Si falla la red (EHOSTUNREACH), se captura de forma segura en el catch
        client = await pool.connect();

        // Iniciamos la transacción SQL de manera segura
        await client.query('BEGIN');

        // GO-LIVE GATE
        const preLaunchResult = await client.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'pre_launch_mode_enabled'`);
        if (preLaunchResult.rows[0]?.setting_value === 'true') {
            console.log('TOKEN RELEASER: Sistema en modo pre-lanzamiento. Liberación de escrows en pausa económica.');
            await client.query('ROLLBACK');
            return;
        }

        // 1. Obtener todos los depósitos vencidos y no liberados, agrupados por usuario
        const overdueEscrowsResult = await client.query(`
            SELECT 
                user_id,
                username, 
                SUM(amount) as total_to_release,
                array_agg(id) as escrow_ids
            FROM blue_token_escrows
            WHERE unlock_at <= NOW() AND is_released = FALSE
            GROUP BY user_id, username
        `);

        if (overdueEscrowsResult.rowCount === 0) {
            console.log('TOKEN RELEASER: No se encontraron tokens para liberar.');
            await client.query('ROLLBACK'); // No need to keep transaction open
            return;
        }

        console.log(`TOKEN RELEASER: Se encontraron depósitos para liberar para ${overdueEscrowsResult.rowCount} usuario(s).`);

        // 2. Procesar cada usuario con depósitos a liberar
        for (const userEscrow of overdueEscrowsResult.rows) {
            const { user_id, username, total_to_release, escrow_ids } = userEscrow;
            const amountToRelease = parseFloat(total_to_release);

            if (amountToRelease <= 0) continue;

            console.log(`TOKEN RELEASER: Liberando ${amountToRelease.toFixed(4)} BLUE para el usuario ${username}.`);

            // 3. Actualizar saldos del usuario (Event Sourcing)
            // Restar de Escrow (usamos 'withdrawal' que resta)
            await client.query(`SELECT record_balance_event($1::INTEGER, 'withdrawal'::TEXT, 'escrow_blue'::TEXT, $2::NUMERIC, NULL::JSONB)`, [user_id, amountToRelease]);
            // Sumar a Líquido (usamos 'deposit' que suma)
            await client.query(`SELECT record_balance_event($1::INTEGER, 'deposit'::TEXT, 'liquid_blue'::TEXT, $2::NUMERIC, NULL::JSONB)`, [user_id, amountToRelease]);

            // 4. Marcar los depósitos como liberados
            await client.query(
                `UPDATE blue_token_escrows SET is_released = TRUE WHERE id = ANY($1::int[])`,
                [escrow_ids]
            );

            // 5. Crear una transacción para el historial
            const releaseDesc = `Se han liberado ${amountToRelease.toFixed(4)} BLUE que estaban en depósito.`;
            await client.query(
                `INSERT INTO transactions (user_id, type, description, blue_change, red_change) VALUES ($1, 'escrow_release', $2, $3, 0)`,
                [user_id, releaseDesc, amountToRelease]
            );

            // 6. Enviar notificación al usuario
            const notificationMessage = `¡Buenas noticias! ${amountToRelease.toFixed(4)} BLUE de tu saldo pendiente ya están disponibles.`;
            await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [username, notificationMessage]);
        }

        // Confirmamos la transacción tras procesar correctamente
        await client.query('COMMIT');
        console.log('TOKEN RELEASER: Ciclo de liberación finalizado exitosamente.');

    } catch (error) {
        // Solo ejecutamos ROLLBACK si el cliente logró conectarse e iniciar la transacción
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('TOKEN RELEASER: Error al ejecutar ROLLBACK:', rollbackError.message);
            }
        }
        // Registramos el error de forma auditable sin tumbar la aplicación
        console.error('TOKEN RELEASER: Error crítico durante el ciclo de liberación de tokens.', error.message || error);
    } finally {
        // Liberamos el cliente de vuelta al pool si fue instanciado para prevenir fugas de conexiones
        if (client) {
            client.release();
        }
    }
}

module.exports = tokenReleaserJob;
