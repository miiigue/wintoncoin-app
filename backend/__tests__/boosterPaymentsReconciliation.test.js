/**
 * backend/__tests__/boosterPaymentsReconciliation.test.js
 * 
 * PROPÓSITO: Pruebas de integración de extremo a extremo para validar la consistencia contable
 * en el ciclo de distribución de pagos de impulsores (Booster Payments).
 * Verifica que el presupuesto se tome del balance real acumulado en 'platform_wallet',
 * que los pagos se debiten de dicho balance central y se registren en 'platform_wallet_log'.
 * 
 * METODOLOGÍA: Test de caja gris que utiliza usuarios de prueba con nombres dinámicos
 * para evitar colisiones y respeta la inmutabilidad de la base de datos (evitando DELETEs en ledgers).
 */

'use strict';

const pool = require('../src/config/db');
const { executeBoosterPayments } = require('../src/services/boosterService');

describe('Booster Payments Budget Reconciliation Integration Tests', () => {
    let originalSettings = {};
    let originalWalletBalance = 0.0000;
    let originalBoosters = [];
    let testUserId = null;

    // Nombre de usuario único para evitar colisiones y no violar la inmutabilidad de la base de datos
    const testUsername = `recon_booster_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const testEmail = `recon_${Date.now()}@wintoncoin.io`;

    beforeAll(async () => {
        // Inicializar de forma autónoma la base de datos de pruebas (sandbox wintoncoin_test)
        const { initializeDatabase } = require('../src/config/databaseInit');
        const { runPendingMigrations } = require('../scripts/migrationRunner');
        
        console.log('[TEST SETUP] Inicializando tablas base y aplicando migraciones en wintoncoin_test...');
        await initializeDatabase();
        await runPendingMigrations();

        // 0. Asegurar la existencia de la tabla platform_wallet_log para el entorno de pruebas
        await pool.query(`
            CREATE TABLE IF NOT EXISTS platform_wallet_log (
                id SERIAL PRIMARY KEY,
                transaction_type VARCHAR(50) NOT NULL,
                amount NUMERIC(19, 4) NOT NULL,
                related_username VARCHAR(255),
                description TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // 1. Guardar configuraciones originales para restaurar después de las pruebas
        const settingsRes = await pool.query(`
            SELECT setting_key, setting_value FROM app_settings 
            WHERE setting_key IN (
                'booster_system_enabled', 
                'booster_custom_frequency_enabled', 
                'booster_payment_frequency_days', 
                'booster_payment_frequency_hours', 
                'booster_payment_frequency_minutes'
            )
        `);
        settingsRes.rows.forEach(row => {
            originalSettings[row.setting_key] = row.setting_value;
        });

        // 2. Guardar balance original de la billetera de la plataforma
        const walletRes = await pool.query('SELECT total_blue_commission_balance FROM platform_wallet WHERE id = 1');
        if (walletRes.rowCount > 0) {
            originalWalletBalance = parseFloat(walletRes.rows[0].total_blue_commission_balance) || 0;
        }

        // 3. Guardar la lista de otros boosters activos para poder aislarlos temporalmente
        const boostersRes = await pool.query("SELECT username FROM users WHERE is_booster = true");
        originalBoosters = boostersRes.rows.map(r => r.username);

        // Desactivar temporalmente otros boosters para que no interfieran en el presupuesto de la prueba
        if (originalBoosters.length > 0) {
            await pool.query("UPDATE users SET is_booster = false WHERE is_booster = true");
        }

        // 4. Crear usuario impulsor de prueba con KYC verificado
        const userInsertRes = await pool.query(`
            INSERT INTO users (username, password_hash, email, phone_number, is_booster, booster_level, kyc_verified)
            VALUES ($1, 'mock_hash', $2, $3, true, 1, true)
            RETURNING id
        `, [testUsername, testEmail, `phone_${Date.now()}`]);
        testUserId = userInsertRes.rows[0].id;
    });

    afterAll(async () => {
        // Desactivar nuestro booster de pruebas para no interferir en futuras ejecuciones
        if (testUserId) {
            await pool.query('UPDATE users SET is_booster = false, kyc_verified = false WHERE id = $1', [testUserId]);
        }

        // Restaurar todos los boosters originales
        if (originalBoosters.length > 0) {
            await pool.query("UPDATE users SET is_booster = true WHERE username = ANY($1)", [originalBoosters]);
        }

        // Restaurar configuraciones originales
        for (const [key, val] of Object.entries(originalSettings)) {
            await pool.query('UPDATE app_settings SET setting_value = $1 WHERE setting_key = $2', [val, key]);
        }

        // Restaurar balance original de la plataforma
        await pool.query('UPDATE platform_wallet SET total_blue_commission_balance = $1 WHERE id = 1', [originalWalletBalance]);

        // Cerrar el pool para que Jest salga limpiamente
        await pool.end();
    });

    it('Debe distribuir pagos leyendo el saldo acumulado de platform_wallet, debitar dicho balance y registrar el egreso en platform_wallet_log', async () => {
        // A. Configurar las variables para forzar la ejecución del pago por intervalo personalizado
        await pool.query("UPDATE app_settings SET setting_value = 'true' WHERE setting_key = 'booster_system_enabled'");
        await pool.query("UPDATE app_settings SET setting_value = 'true' WHERE setting_key = 'booster_custom_frequency_enabled'");
        await pool.query("UPDATE app_settings SET setting_value = '0' WHERE setting_key = 'booster_payment_frequency_days'");
        await pool.query("UPDATE app_settings SET setting_value = '0' WHERE setting_key = 'booster_payment_frequency_hours'");
        await pool.query("UPDATE app_settings SET setting_value = '5' WHERE setting_key = 'booster_payment_frequency_minutes'");

        // Simular desactivación del pre-lanzamiento para superar las guardas económicas del Go-Live
        await pool.query("UPDATE app_settings SET setting_value = 'false' WHERE setting_key = 'pre_launch_mode_enabled'");
        await pool.query("UPDATE app_settings SET setting_value = $1 WHERE setting_key = 'pre_launch_deactivated_at'", [new Date(Date.now() - 3600000).toISOString()]);

        // Desactivar temporalmente el trigger de inmutabilidad física para permitir la limpieza del test
        await pool.query('ALTER TABLE booster_payment_log DISABLE TRIGGER ALL;');
        // Asegurar que no haya logs de pago recientes que bloqueen la frecuencia personalizada
        await pool.query('DELETE FROM booster_payment_log');
        // Reactivar el trigger de inmutabilidad física inmediatamente para la ejecución real
        await pool.query('ALTER TABLE booster_payment_log ENABLE TRIGGER ALL;');

        // B. Establecer el balance inicial de comisiones de la plataforma a un valor conocido
        const initialWalletTestBalance = 500.0000;
        await pool.query('UPDATE platform_wallet SET total_blue_commission_balance = $1 WHERE id = 1', [initialWalletTestBalance]);

        // C. Cargar una deuda de recompensa de prueba para el impulsor
        const rewardDebtAmount = 150.0000;
        await pool.query(`
            INSERT INTO booster_blue_ledger (user_id, amount, type) 
            VALUES ($1, $2, 'publication_reward')
        `, [testUserId, rewardDebtAmount]);

        // D. Ejecutar el ciclo de distribución de pagos de impulsores
        await executeBoosterPayments();

        // E. VALIDACIONES DE INTEGRIDAD FINANCIERA (PARTIDA DOBLE Y LEDGER)

        // 1. Verificar que la deuda de la plataforma con el booster fue amortizada (debe bajar a 0)
        const ledgerSumRes = await pool.query('SELECT SUM(amount) AS balance FROM booster_blue_ledger WHERE user_id = $1', [testUserId]);
        const finalLedgerDebt = parseFloat(ledgerSumRes.rows[0].balance) || 0;
        expect(finalLedgerDebt).toBeCloseTo(0.0000, 4);

        // 2. Verificar que se depositó el monto líquido en la cuenta en custodia (escrow) del booster
        const userBalanceRes = await pool.query('SELECT escrow_blue_balance FROM users WHERE id = $1', [testUserId]);
        const finalEscrowBalance = parseFloat(userBalanceRes.rows[0].escrow_blue_balance) || 0;
        expect(finalEscrowBalance).toBeCloseTo(rewardDebtAmount, 4);

        // 3. Verificar que el saldo de la plataforma disminuyó exactamente por el monto pagado
        const walletVerifyRes = await pool.query('SELECT total_blue_commission_balance FROM platform_wallet WHERE id = 1');
        const finalWalletBalance = parseFloat(walletVerifyRes.rows[0].total_blue_commission_balance) || 0;
        const expectedWalletBalance = initialWalletTestBalance - rewardDebtAmount;
        expect(finalWalletBalance).toBeCloseTo(expectedWalletBalance, 4);

        // 4. Verificar que se grabó la salida en la bitácora contable 'platform_wallet_log'
        const walletLogRes = await pool.query(`
            SELECT * FROM platform_wallet_log 
            WHERE related_username = $1 AND transaction_type = 'booster_payout'
            ORDER BY created_at DESC LIMIT 1
        `, [testUsername]);

        expect(walletLogRes.rowCount).toBe(1);
        expect(parseFloat(walletLogRes.rows[0].amount)).toBeCloseTo(-rewardDebtAmount, 4);
        expect(walletLogRes.rows[0].description).toContain('Pago de recompensa a impulsor');
        expect(walletLogRes.rows[0].description).toContain(testUsername);

        // 5. Verificar que se grabó el registro en la bitácora del ciclo de pagos de impulsores
        const paymentLogRes = await pool.query(`
            SELECT * FROM booster_payment_log 
            WHERE user_id = $1
            ORDER BY created_at DESC LIMIT 1
        `, [testUserId]);
        expect(paymentLogRes.rowCount).toBe(1);
        expect(parseFloat(paymentLogRes.rows[0].amount_paid)).toBeCloseTo(rewardDebtAmount, 4);

        // F. COMPROBACIÓN DE IDEMPOTENCIA POR VENTANA TEMPORAL (LOOKBACK WINDOW)
        // 1. Añadimos nueva deuda de recompensa de prueba
        const newRewardDebt = 100.0000;
        await pool.query(`
            INSERT INTO booster_blue_ledger (user_id, amount, type) 
            VALUES ($1, $2, 'publication_reward')
        `, [testUserId, newRewardDebt]);

        // 2. Ejecutar de nuevo el ciclo de pagos de impulsores inmediatamente.
        // Como el usuario ya cobró hace un momento (lo cual entra dentro de la ventana de exclusión temporal de 5 minutos),
        // este nuevo ciclo debe excluirlo e ignorar esta nueva deuda temporalmente, protegiendo contra doble pago.
        await executeBoosterPayments();

        // 3. Verificar que la deuda de 100 BLUE sigue intacta en el ledger de este usuario (no fue amortizada)
        const secondLedgerSumRes = await pool.query('SELECT SUM(amount) AS balance FROM booster_blue_ledger WHERE user_id = $1', [testUserId]);
        const secondLedgerDebt = parseFloat(secondLedgerSumRes.rows[0].balance) || 0;
        expect(secondLedgerDebt).toBeCloseTo(newRewardDebt, 4);

        // 4. Verificar que no se incrementó su balance de custodia (escrow)
        const secondUserBalanceRes = await pool.query('SELECT escrow_blue_balance FROM users WHERE id = $1', [testUserId]);
        const secondEscrowBalance = parseFloat(secondUserBalanceRes.rows[0].escrow_blue_balance) || 0;
        expect(secondEscrowBalance).toBeCloseTo(rewardDebtAmount, 4); // Debe seguir siendo el monto del primer pago

        // 5. Verificar que el saldo de platform_wallet sigue siendo el mismo que tras el primer pago
        const secondWalletVerifyRes = await pool.query('SELECT total_blue_commission_balance FROM platform_wallet WHERE id = 1');
        const secondWalletBalance = parseFloat(secondWalletVerifyRes.rows[0].total_blue_commission_balance) || 0;
        expect(secondWalletBalance).toBeCloseTo(expectedWalletBalance, 4);
    });
});
