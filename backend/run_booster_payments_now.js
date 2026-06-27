// run_booster_payments_now.js
// Script de prueba manual optimizado para pruebas UAT (User Acceptance Testing)
// Genera un usuario de prueba dinámico único para evitar conflictos con los triggers de inmutabilidad.
// Permite iniciar sesión en la interfaz web real (Frontend) con la contraseña configurada.
'use strict';

const path = require('path');
const bcrypt = require('bcrypt'); // Importamos bcrypt para hashear de forma segura la contraseña de login
// Cargar dotenv desde la carpeta raíz local
require('dotenv').config({ path: path.join(__dirname, '../.env.development') });

const pool = require('./src/config/db');
const { logAuditEvent } = require('./src/services/auditService');

async function executeManualBoosterPayments() {
    console.log('--- MÓDULO DE PRUEBA MANUAL: INICIANDO CICLO DE PAGOS ---');
    let client;
    try {
        client = await pool.connect();
        
        // Iniciamos la transacción SQL para asegurar atomicidad
        await client.query('BEGIN');

        // 1. Verificar si el sistema de impulsores está habilitado en app_settings
        const settingsResult = await client.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'booster_system_enabled'`);
        if (settingsResult.rows[0]?.setting_value !== 'true') {
            console.log('⚠️ El sistema de impulsores está desactivado en app_settings. Activándolo para la prueba...');
            await client.query(`
                INSERT INTO app_settings (setting_key, setting_value, description) 
                VALUES ('booster_system_enabled', 'true', 'Control del sistema de impulsores')
                ON CONFLICT (setting_key) DO UPDATE SET setting_value = 'true'
            `);
        }

        // 2. Crear una configuración de nivel de prueba 1 si no existe
        await client.query(`
            INSERT INTO booster_level_settings (level, name, min_blue_required, description) 
            VALUES (1, 'Nivel 1', 0, 'Nivel de prueba') 
            ON CONFLICT (level) DO UPDATE SET min_blue_required = 0
        `);

        // 3. Generar comisiones simuladas en platform_commission_log para el mes de pago anterior
        const today = new Date();
        const paymentMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const paymentMonthString = `${paymentMonth.getFullYear()}-${(paymentMonth.getMonth() + 1).toString().padStart(2, '0')}`;

        console.log(`Borrando comisiones de prueba anteriores para el mes ${paymentMonthString}...`);
        await client.query(`DELETE FROM platform_commission_log WHERE to_char(created_at, 'YYYY-MM') = $1`, [paymentMonthString]);

        console.log(`Insertando comisión de prueba de 150.0000 BLUE en platform_commission_log para el mes ${paymentMonthString}...`);
        await client.query(`
            INSERT INTO platform_commission_log (related_publication_id, commission_amount_blue, created_at)
            VALUES (1, 150.0000, $1)
        `, [paymentMonth]);

        // 4. Generar nombres únicos para los usuarios usando el timestamp actual
        // Esto evita correr DELETE en usuarios antiguos y violar la regla de inmutabilidad de balance_events
        const timestamp = Date.now();
        const usernameKYC = `booster_kyc_${timestamp}`;
        const usernameNoKYC = `booster_nokyc_${timestamp}`;
        const usernameZero = `booster_zero_${timestamp}`;
        
        // Hasheamos la contraseña "WintonPass123!" usando 10 rounds de sal de bcrypt
        const rawPassword = 'WintonPass123!';
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(rawPassword, saltRounds);

        console.log(`Creando usuarios de prueba únicos con contraseña: "${rawPassword}"...`);
        console.log(`- Usuario verificado (KYC): ${usernameKYC}`);
        console.log(`- Usuario no verificado (No-KYC): ${usernameNoKYC}`);
        console.log(`- Usuario con balance cero: ${usernameZero}`);

        // A) Insertar usuario con KYC verificado
        const userARes = await client.query(
            `INSERT INTO users (username, password_hash, email, phone_number, is_booster, booster_level, kyc_verified, escrow_blue_balance) 
             VALUES ($1, $2, $3, '12345', true, 1, true, 0.0000) RETURNING id`,
            [usernameKYC, passwordHash, `${usernameKYC}@test.com`]
        );
        const userAId = userARes.rows[0].id;

        // B) Insertar usuario sin KYC verificado
        const userBRes = await client.query(
            `INSERT INTO users (username, password_hash, email, phone_number, is_booster, booster_level, kyc_verified, escrow_blue_balance) 
             VALUES ($1, $2, $3, '67890', true, 1, false, 0.0000) RETURNING id`,
            [usernameNoKYC, passwordHash, `${usernameNoKYC}@test.com`]
        );
        const userBId = userBRes.rows[0].id;

        // C) Insertar usuario verificado con KYC pero sin saldo acumulado
        const userCRes = await client.query(
            `INSERT INTO users (username, password_hash, email, phone_number, is_booster, booster_level, kyc_verified, escrow_blue_balance) 
             VALUES ($1, $2, $3, '54321', true, 1, true, 0.0000) RETURNING id`,
            [usernameZero, passwordHash, `${usernameZero}@test.com`]
        );
        const userCId = userCRes.rows[0].id;

        console.log('Fondeando saldos iniciales (BLUE iou) en booster_blue_ledger...');
        // Fondeamos 100 BLUE iou a los usuarios A y B mediante la tabla del libro contable de impulsores
        await client.query('INSERT INTO booster_blue_ledger (user_id, amount, type) VALUES ($1, 100.0000, \'task_reward\')', [userAId]);
        await client.query('INSERT INTO booster_blue_ledger (user_id, amount, type) VALUES ($1, 100.0000, \'task_reward\')', [userBId]);

        // --- LÓGICA DE DISTRIBUCIÓN (Similitud 1:1 con server.js, restringido a nuestros usuarios de prueba) ---
        
        // 1. Obtener la suma total de comisiones disponibles
        const commissionResult = await client.query(
            `SELECT SUM(commission_amount_blue) as total FROM platform_commission_log WHERE to_char(created_at, 'YYYY-MM') = $1`,
            [paymentMonthString]
        );
        let fundsAvailable = parseFloat(commissionResult.rows[0].total) || 0;

        // AUDITORÍA FINTECH: Loguear inicio del proceso
        await logAuditEvent(client, null, {
            eventType: 'booster.monthly_payments_started',
            actorUsername: 'system_cron',
            metadata: { paymentMonth: paymentMonthString, fundsAvailable }
        });

        console.log(`Fondos de comisiones disponibles: ${fundsAvailable} BLUE.`);

        // 2. Obtener la información de saldos y configuración de niveles de los usuarios generados
        const levelsResult = await client.query('SELECT * FROM booster_level_settings ORDER BY level ASC');
        const boostersResult = await client.query(`
            SELECT u.id, u.username, u.booster_level, u.kyc_verified,
                   COALESCE((SELECT SUM(amount) FROM booster_blue_ledger WHERE user_id = u.id), 0.0000) as total_booster_blue
            FROM users u WHERE u.username IN ($1, $2, $3)
        `, [usernameKYC, usernameNoKYC, usernameZero]);

        // 3. Iterar por cada nivel de impulsores
        for (const level of levelsResult.rows) {
            if (fundsAvailable <= 0) break;

            // Filtrar impulsores calificados: mismo nivel, saldo acumulado > 0 y KYC verificado
            const boostersInLevel = boostersResult.rows.filter(b => 
                b.booster_level === level.level && 
                parseFloat(b.total_booster_blue) > 0 &&
                b.kyc_verified === true
            );
            if (boostersInLevel.length === 0) continue;

            // Sumamos la deuda total del nivel
            const totalDebtForLevel = boostersInLevel.reduce((sum, b) => sum + parseFloat(b.total_booster_blue), 0);
            if (totalDebtForLevel <= 0) continue;

            // Determinar la proporción de pago según los fondos disponibles
            const paymentPercentage = Math.min(1.0, fundsAvailable / totalDebtForLevel);

            // 4. Pagar a cada impulsor calificado en este nivel
            for (const booster of boostersInLevel) {
                const amountToPay = parseFloat(booster.total_booster_blue) * paymentPercentage;
                if (amountToPay > 0) {
                    console.log(`👉 Aplicando pago a ${booster.username}: ${amountToPay.toFixed(4)} BLUE.`);
                    
                    // Acreditar saldo en escrow (custodia) de manera inmutable
                    await client.query("SELECT record_balance_event($1::INTEGER, 'deposit'::TEXT, 'escrow_blue'::TEXT, $2::NUMERIC, NULL::JSONB)", [booster.id, amountToPay]);

                    // Registrar débito en el ledger para amortizar la deuda acumulada
                    await client.query("SELECT record_booster_event($1, 'booster_payout_deduction', $2, NULL)", [booster.id, -amountToPay]);

                    // Insertar en la tabla de transacciones del usuario
                    const paymentDescription = `Recompensa de Impulsor (Nivel ${level.level}) para el mes de ${paymentMonth.toLocaleString('es', { month: 'long', year: 'numeric' })}`;
                    await client.query(`INSERT INTO transactions (user_id, type, description, blue_change) VALUES ($1, 'booster_reward', $2, $3)`, [booster.id, paymentDescription, amountToPay]);
                }
            }

            fundsAvailable -= totalDebtForLevel * paymentPercentage;
        }

        const totalPaidOut = (parseFloat(commissionResult.rows[0].total) || 0) - fundsAvailable;

        // AUDITORÍA FINTECH: Loguear conclusión del proceso
        await logAuditEvent(client, null, {
            eventType: 'booster.monthly_payments_completed',
            actorUsername: 'system_cron',
            metadata: { paymentMonth: paymentMonthString, totalPaidOut }
        });

        // Persistimos todos los cambios en la base de datos de manera atómica
        await client.query('COMMIT');
        
        console.log('\n==================================================================');
        console.log('🎉 PROCESAMIENTO COMPLETADO Y GUARDADO EN LA BASE DE DATOS.');
        console.log('==================================================================');
        console.log('\nSigue estos pasos para verificar manualmente desde el Frontend:\n');
        console.log('1. Abre tu navegador web en la aplicación (ej. http://localhost:5173).');
        console.log('2. Inicia sesión en el formulario con las siguientes credenciales:');
        console.log(`   👉 Nombre de usuario: ${usernameKYC}`);
        console.log(`   👉 Contraseña:        ${rawPassword}`);
        console.log('3. Ve a la sección "Estado de Cuenta" (estado-cuenta.html) desde el menú.');
        console.log('4. Comprueba los siguientes puntos:');
        console.log('   ✅ El saldo "En Custodia (Escrow)" debe mostrar "100.0000 BLUE".');
        console.log('   ✅ En el listado de actividades debe haber una transacción:');
        console.log(`      "Recompensa de Impulsor (Nivel 1)..." con un monto de "+100.0000 BLUE" en verde.`);
        console.log('   ✅ El panel estadístico de "Recibidos" debe marcar al menos "1".');
        console.log('\n5. Opcional: Inicia sesión con el usuario que no tenía KYC verificado:');
        console.log(`   👉 Nombre de usuario: ${usernameNoKYC}`);
        console.log(`   👉 Contraseña:        ${rawPassword}`);
        console.log('   ✅ Comprueba que su saldo "En Custodia" siga siendo "0.0000 BLUE"');
        console.log('      (sus fondos no se liberaron por falta de verificación de identidad).');
        console.log('==================================================================\n');

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('❌ ERROR DURANTE LA PRUEBA MANUAL:', error);
    } finally {
        if (client) {
            client.release();
        }
        pool.end();
    }
}

executeManualBoosterPayments();
