/**
 * backend/migrations/062_reconcile_historical_commissions.js
 * 
 * PROPÓSITO: Conciliación histórica de datos contables de comisiones.
 * 
 * DETALLE:
 * 1. Lee todas las comisiones previas en 'platform_commission_log'.
 * 2. Reconstruye el Libro Mayor 'platform_wallet_log' insertando un registro
 *    de ingreso ('commission_income') por cada comisión histórica.
 * 3. Actualiza el balance neto consolidado en 'platform_wallet' para que coincida
 *    exactamente con la suma de la bitácora contable.
 * 
 * ESTÁNDAR DE INGENIERÍA: Reconciliación de Saldos Históricos y Trazabilidad Retroactiva.
 */

'use strict';

exports.up = async (client) => {
    console.log('[MIGRATION 062] Iniciando reconciliación de comisiones históricas...');

    // 1. Reconstruir los ingresos en platform_wallet_log a partir de platform_commission_log
    await client.query(`
        INSERT INTO platform_wallet_log (transaction_type, amount, related_username, description, created_at)
        SELECT 
            'commission_income' AS transaction_type,
            pcl.commission_amount_blue AS amount,
            COALESCE(u.username, 'Sistema/Publicación') AS related_username,
            'Reconstrucción contable: Comisión histórica de publicación "' || COALESCE(p.title, 'Título no disponible') || '"' AS description,
            pcl.created_at AS created_at
        FROM platform_commission_log pcl
        LEFT JOIN publications p ON pcl.related_publication_id = p.id
        LEFT JOIN transactions t ON pcl.related_user_transaction_id = t.id
        LEFT JOIN users u ON t.user_id = u.id
        WHERE NOT EXISTS (
            -- Evita duplicar si la migración se corre múltiples veces o si ya hay registros de comisiones antiguas en el log
            SELECT 1 FROM platform_wallet_log pwl
            WHERE pwl.transaction_type = 'commission_income'
              AND pwl.created_at = pcl.created_at
              AND pwl.amount = pcl.commission_amount_blue
        )
    `);
    console.log('[MIGRATION 062] ✅ Ingresos históricos insertados en platform_wallet_log.');

    // 2. Actualizar el saldo de la plataforma (platform_wallet) con la suma total del log (Ingresos - Egresos)
    await client.query(`
        UPDATE platform_wallet
        SET total_blue_commission_balance = COALESCE((
            SELECT SUM(amount) FROM platform_wallet_log
        ), 0.0000)
        WHERE id = 1;
    `);
    
    // Si no existiera la fila 1 en platform_wallet, la insertamos
    const checkRes = await client.query('SELECT 1 FROM platform_wallet WHERE id = 1');
    if (checkRes.rowCount === 0) {
        await client.query(`
            INSERT INTO platform_wallet (id, total_blue_commission_balance)
            VALUES (1, COALESCE((SELECT SUM(amount) FROM platform_wallet_log), 0.0000))
        `);
    }
    
    console.log('[MIGRATION 062] ✅ Balance de platform_wallet reconciliado con el Libro Mayor.');
};

exports.down = async (client) => {
    console.log('[MIGRATION 062] Revirtiendo reconciliación histórica...');
    // Eliminamos solo los registros de reconstrucción contable histórica de comisiones
    await client.query("DELETE FROM platform_wallet_log WHERE transaction_type = 'commission_income';");
    
    // Recalcular balance sin esos registros
    await client.query(`
        UPDATE platform_wallet
        SET total_blue_commission_balance = COALESCE((
            SELECT SUM(amount) FROM platform_wallet_log
        ), 0.0000)
        WHERE id = 1;
    `);
    console.log('[MIGRATION 062] Reversión de reconciliación histórica completada.');
};
