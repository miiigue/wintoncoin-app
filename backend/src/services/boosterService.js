/**
 * backend/src/services/boosterService.js
 * 
 * PROPÓSITO: Servicio modular para el control de la economía de impulsores (Boosters).
 * Encapsula la lógica del ciclo de pagos, con soporte tanto para el cobro mensual clásico
 * como para frecuencias personalizadas basadas en intervalos de tiempo (días, horas, minutos).
 * 
 * METODOLOGÍA DE INGENIERÍA: Transacciones atómicas, Append-Only Ledger, Inmutabilidad,
 * Prevención de Nan, Control AML/KYC y Trazabilidad de Auditoría Bancaria.
 */

'use strict';

const pool = require('../config/db');
const { logAuditEvent } = require('./auditService');

// Límite superior de multiplicador como guardrail económico.
// Previene errores humanos (ej: poner 99999 en vez de 9).
const MAX_MULTIPLIER = 100;

/**
 * Ejecuta el ciclo de distribución de pagos de impulsores.
 * Evalúa los parámetros de configuración y determina si corresponde realizar la distribución.
 */
async function executeBoosterPayments() {
    let client;
    try {
        client = await pool.connect();
        
        // Iniciamos una transacción atómica para asegurar que todo el ciclo se aplique o se revierta por completo
        await client.query('BEGIN');

        // 1. Obtener los settings del sistema relacionados con impulsores
        const settingsResult = await client.query(`
            SELECT setting_key, setting_value FROM app_settings 
            WHERE setting_key IN (
                'booster_system_enabled', 
                'booster_custom_frequency_enabled', 
                'booster_payment_frequency_days', 
                'booster_payment_frequency_hours', 
                'booster_payment_frequency_minutes'
            )
        `);
        
        const settings = {};
        settingsResult.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });

        // Si el sistema general de impulsores está desactivado, detenemos el flujo de inmediato
        if (settings.booster_system_enabled !== 'true') {
            await client.query('ROLLBACK');
            return;
        }

        const customFreqEnabled = settings.booster_custom_frequency_enabled === 'true';
        const today = new Date();
        let paymentMonth;
        let isEligible = false;

        if (customFreqEnabled) {
            // --- CÁCULO DE FRECUENCIA PERSONALIZADA (INTERVALO DE TIEMPO) ---
            const freqDays = parseInt(settings.booster_payment_frequency_days, 10) || 0;
            const freqHours = parseInt(settings.booster_payment_frequency_hours, 10) || 0;
            const freqMinutes = parseInt(settings.booster_payment_frequency_minutes, 10) || 0;
            
            // Convertimos la frecuencia a milisegundos
            const totalFreqMs = ((freqDays * 24 * 60) + (freqHours * 60) + freqMinutes) * 60 * 1000;

            if (totalFreqMs <= 0) {
                console.log('BOOSTER PAYMENTS: Frecuencia personalizada inválida (0 minutos). Saltando ciclo.');
                await client.query('ROLLBACK');
                return;
            }

            // Consultar cuándo fue el último pago de impulsores registrado en base de datos
            const lastPaymentLogResult = await client.query(`
                SELECT created_at FROM booster_payment_log 
                ORDER BY created_at DESC LIMIT 1
            `);

            if (lastPaymentLogResult.rowCount > 0) {
                const lastPaymentTime = new Date(lastPaymentLogResult.rows[0].created_at);
                const timePassedMs = today.getTime() - lastPaymentTime.getTime();
                
                // Si el tiempo transcurrido es menor al intervalo configurado, saltamos el ciclo de pago
                if (timePassedMs < totalFreqMs) {
                    await client.query('ROLLBACK');
                    return;
                }
            }
            
            // Si califica para el pago por frecuencia personalizada, la marca de mes es el día de hoy
            isEligible = true;
            paymentMonth = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            console.log(`BOOSTER PAYMENTS: Iniciando ciclo de pagos personalizado (Frecuencia: ${freqDays}d ${freqHours}h ${freqMinutes}min)...`);
        } else {
            // --- CICLO MENSUAL TRADICIONAL POR DEFECTO ---
            // Solo se ejecuta el primer día de cada mes natural.
            if (today.getDate() !== 1) {
                await client.query('ROLLBACK');
                return;
            }

            // Determinamos el mes de pago (el mes anterior)
            paymentMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const paymentMonthString = `${paymentMonth.getFullYear()}-${(paymentMonth.getMonth() + 1).toString().padStart(2, '0')}`;

            // Verificar si ya se realizó el pago para este mes
            const lastPaymentResult = await client.query(`
                SELECT 1 FROM booster_payment_log 
                WHERE to_char(payment_month, 'YYYY-MM') = $1 LIMIT 1
            `, [paymentMonthString]);

            if (lastPaymentResult.rowCount > 0) {
                console.log(`BOOSTER PAYMENTS: El pago para ${paymentMonthString} ya fue realizado. Saltando ciclo.`);
                await client.query('ROLLBACK');
                return;
            }

            isEligible = true;
            console.log(`BOOSTER PAYMENTS: Iniciando ciclo de pagos mensual para ${paymentMonthString}...`);
        }

        if (!isEligible) {
            await client.query('ROLLBACK');
            return;
        }

        const paymentMonthString = `${paymentMonth.getFullYear()}-${(paymentMonth.getMonth() + 1).toString().padStart(2, '0')}`;

        // 2. Obtener el balance real acumulado de comisiones en la billetera de la plataforma.
        // Se descarta el filtro mensual estricto de platform_commission_log y se consulta el balance real
        // consolidado de la plataforma (platform_wallet) para permitir pagar usando comisiones acumuladas históricas.
        // Se aplica un bloqueo de base de datos 'FOR UPDATE' (bloqueo pesimista) para evitar que procesos
        // concurrentes lee y gasten el mismo balance al mismo tiempo (Double Spend prevention).
        const walletResult = await client.query(
            `SELECT total_blue_commission_balance FROM platform_wallet WHERE id = 1 FOR UPDATE`
        );
        let fundsAvailable = parseFloat(walletResult.rows[0]?.total_blue_commission_balance) || 0;
        const initialFunds = fundsAvailable; // Guardamos el fondo inicial para calcular el gasto exacto al final

        // AUDITORÍA FINTECH: Registrar inicio del proceso de pagos en el libro de auditoría centralizado.
        // Garantiza la trazabilidad y la auditabilidad bancaria del ciclo.
        await logAuditEvent(client, null, {
            eventType: 'booster.monthly_payments_started',
            actorUsername: 'system_cron',
            metadata: {
                paymentMonth: paymentMonthString,
                fundsAvailable,
                customFrequencyActive: customFreqEnabled
            }
        });

        // Verificación de disponibilidad de fondos en billetera.
        // Si no hay saldo acumulado, el ciclo termina limpiamente para evitar deudas no colateralizadas.
        if (fundsAvailable <= 0) {
            console.log(`BOOSTER PAYMENTS: No hay fondos de comisiones disponibles en la billetera de la plataforma.`);
            await client.query('COMMIT'); // Hacemos commit del evento de auditoría
            return;
        }

        console.log(`BOOSTER PAYMENTS: Fondos disponibles para distribución: ${fundsAvailable.toFixed(4)} BLUE.`);

        // 3. Obtener niveles de impulsores y los impulsores activos
        const levelsResult = await client.query('SELECT * FROM booster_level_settings ORDER BY level ASC');
        const boostersResult = await client.query(`
            SELECT u.id, u.username, u.booster_level, u.kyc_verified,
                   COALESCE((SELECT SUM(amount) FROM booster_blue_ledger WHERE user_id = u.id), 0.0000) as total_booster_blue
            FROM users u WHERE u.is_booster = TRUE
        `);

        // 4. Iterar por cada nivel en orden prioritario (niveles inferiores primero)
        for (const level of levelsResult.rows) {
            if (fundsAvailable <= 0) break;

            // Filtrar impulsores calificados en el nivel actual (KYC verificado y saldo > 0)
            const boostersInLevel = boostersResult.rows.filter(b => 
                b.booster_level === level.level && 
                parseFloat(b.total_booster_blue) > 0 &&
                b.kyc_verified === true
            );
            if (boostersInLevel.length === 0) continue;

            const totalDebtForLevel = boostersInLevel.reduce((sum, b) => sum + parseFloat(b.total_booster_blue), 0);
            if (totalDebtForLevel <= 0) continue;

            console.log(`BOOSTER PAYMENTS: Procesando Nivel ${level.level}. Deuda del nivel: ${totalDebtForLevel.toFixed(4)}. Fondos disponibles: ${fundsAvailable.toFixed(4)}.`);

            const paymentPercentage = Math.min(1.0, fundsAvailable / totalDebtForLevel);

            // 5. Liquidar comisiones para cada impulsor calificado
            for (const booster of boostersInLevel) {
                const amountToPay = parseFloat(booster.total_booster_blue) * paymentPercentage;
                if (amountToPay > 0) {
                    // Pagar al saldo en custodia (escrow) del usuario mediante Event Sourcing
                    await client.query("SELECT record_balance_event($1, 'deposit', 'escrow_blue', $2, NULL)", [booster.id, amountToPay]);

                    // Amortizar la deuda en el ledger restando el monto pagado (evita doble pago infinito)
                    await client.query("SELECT record_booster_event($1, 'booster_payout_deduction', $2, NULL)", [booster.id, -amountToPay]);

                    // Registrar la transacción formal de liquidación
                    const paymentDescription = `Recompensa de Impulsor (Nivel ${level.level}) para el periodo ${paymentMonth.toLocaleString('es', { month: 'long', year: 'numeric' })}`;
                    await client.query(`INSERT INTO transactions (user_id, type, description, blue_change) VALUES ($1, 'booster_reward', $2, $3)`, [booster.id, paymentDescription, amountToPay]);

                    // Insertar en la bitácora de control de pagos
                    await client.query(
                        `INSERT INTO booster_payment_log (user_id, amount_paid, payment_month, booster_level_at_payment) VALUES ($1, $2, $3, $4)`,
                        [booster.id, amountToPay, paymentMonth, level.level]
                    );

                    // --- NUEVO: RECONCILIACIÓN DE LA BILLETERA DE LA PLATAFORMA ---
                    // Se descuenta el monto pagado de la billetera central de la plataforma (platform_wallet).
                    // Esto implementa contabilidad de partida doble: cada crédito al booster requiere un débito a la plataforma.
                    // Evita la creación de tokens BLUE sin respaldo ("impresión de dinero") y asegura consistencia con el panel de administración.
                    await client.query(
                        `UPDATE platform_wallet 
                         SET total_blue_commission_balance = total_blue_commission_balance - $1 
                         WHERE id = 1`,
                        [amountToPay]
                    );

                    // --- NUEVO: BITÁCORA DE CONTROL DE CAJA DE LA PLATAFORMA (AUDIT TRAIL) ---
                    // Se inserta un egreso con monto negativo en platform_wallet_log, dejando registro auditable
                    // e inmutable (ledger) de la salida de fondos y el beneficiario (related_username).
                    const walletLogDesc = `Pago de recompensa a impulsor ${booster.username} (Nivel ${level.level}) para el periodo ${paymentMonthString}`;
                    await client.query(
                        `INSERT INTO platform_wallet_log (transaction_type, amount, related_username, description)
                         VALUES ('booster_payout', $1, $2, $3)`,
                        [-amountToPay, booster.username, walletLogDesc]
                    );

                    console.log(`BOOSTER PAYMENTS: Pago procesado exitosamente para ${booster.username}: ${amountToPay.toFixed(4)} BLUE.`);
                }
            }

            // Descontar la cantidad total distribuida del fondo disponible
            fundsAvailable -= totalDebtForLevel * paymentPercentage;
        }

        // Calcular el total pagado comparando el fondo inicial consolidado con el restante
        const totalPaidOut = initialFunds - fundsAvailable;

        // AUDITORÍA FINTECH: Registrar la finalización exitosa del ciclo de pagos
        await logAuditEvent(client, null, {
            eventType: 'booster.monthly_payments_completed',
            actorUsername: 'system_cron',
            metadata: {
                paymentMonth: paymentMonthString,
                totalPaidOut,
                customFrequencyActive: customFreqEnabled
            }
        });

        // Persistimos de forma atómica en base de datos
        await client.query('COMMIT');
        console.log(`BOOSTER PAYMENTS: Ciclo finalizado con éxito. Total pagado: ${totalPaidOut.toFixed(4)} BLUE.`);

    } catch (error) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('BOOSTER PAYMENTS: Error al revertir transacción (ROLLBACK):', rollbackError);
            }
        }
        console.error('BOOSTER PAYMENTS: Error crítico durante el ciclo de pagos de impulsores:', error);
    } finally {
        if (client) {
            client.release();
        }
    }
}

/**
 * Calcula el monto multiplicado basado en una fecha específica.
 * 
 * Busca la etapa activa cuyo intervalo [start_date, end_date] contiene
 * la fecha proporcionada. Si no hay etapa definida, el multiplicador es 1.0.
 *
 * @param {number|string} baseAmount - Monto base de la recompensa.
 * @param {Date|string}   date       - Fecha de la actividad (default: ahora).
 * @returns {Promise<Object>} Resultado con desglose auditable.
 */
async function calculateMultipliedAmount(baseAmount, date = new Date()) {
    // --- Validación defensiva de entrada ---
    const queryDate = new Date(date);
    const amount = parseFloat(baseAmount);

    // Si el monto base no es un número válido o es negativo, rechazar
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`[BoosterService] Monto base inválido: ${baseAmount}`);
    }

    try {
        // Buscamos la etapa activa para la fecha proporcionada
        const result = await pool.query(
            `SELECT name, multiplier
             FROM booster_config_stages
             WHERE start_date <= $1 AND end_date >= $1
             AND is_active = TRUE
             ORDER BY multiplier DESC
             LIMIT 1`,
            [queryDate]
        );

        // Si no hay etapa definida para la fecha, el multiplicador es 1.0 (sin bono)
        if (result.rowCount === 0) {
            return {
                originalAmount:   amount,
                multipliedAmount: amount,
                multiplier:       1.0,
                stageName:        'Sin etapa activa'
            };
        }

        const { name, multiplier } = result.rows[0];
        const parsedMultiplier = parseFloat(multiplier);
        const multipliedAmount = amount * parsedMultiplier;

        return {
            originalAmount:   amount,            // Monto base configurado en app_settings
            multipliedAmount: multipliedAmount,   // Monto final después de aplicar multiplicador
            multiplier:       parsedMultiplier,   // Factor aplicado (ej: 15.00)
            stageName:        name                // Nombre de la etapa (ej: "Etapa 2")
        };
    } catch (error) {
        console.error('[BoosterService] Error al calcular monto multiplicado:', error);
        throw error;
    }
}

/**
 * Obtiene todas las etapas de configuración ordenadas cronológicamente.
 * @returns {Promise<Array>} Lista de etapas con todos sus campos.
 */
async function getAllStages() {
    const result = await pool.query(
        'SELECT * FROM booster_config_stages ORDER BY start_date ASC'
    );
    return result.rows;
}

/**
 * Actualiza o crea una etapa de configuración.
 * 
 * Validaciones de seguridad:
 *   1. start_date < end_date
 *   2. multiplier > 0
 *   3. No solapamiento con otras etapas activas
 *
 * @param {Object} stageData - Datos de la etapa.
 * @returns {Promise<Object>} Etapa guardada con todos sus campos.
 * @throws {Error} Si hay solapamiento de fechas o datos inválidos.
 */
async function saveStage(stageData) {
    const { id, name, start_date, end_date, multiplier, is_active } = stageData;

    // --- Validaciones de entrada ---
    if (!name || !start_date || !end_date || multiplier === undefined) {
        throw new Error('Faltan datos requeridos: name, start_date, end_date, multiplier.');
    }

    const parsedMultiplier = parseFloat(multiplier);
    if (!Number.isFinite(parsedMultiplier) || parsedMultiplier <= 0) {
        throw new Error('El multiplicador debe ser un número positivo.');
    }
    // Guardrail económico: prevenir multiplicadores absurdos por error humano
    if (parsedMultiplier > MAX_MULTIPLIER) {
        throw new Error(`El multiplicador no puede exceder ${MAX_MULTIPLIER}x. Valor recibido: ${parsedMultiplier}.`);
    }

    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    if (startDateObj >= endDateObj) {
        throw new Error('La fecha de inicio debe ser anterior a la fecha de fin.');
    }

    // Sanitizar id a entero para prevenir type coercion inesperada en la query
    const safeId = id ? parseInt(id, 10) : null;
    if (id && (!Number.isFinite(safeId) || safeId <= 0)) {
        throw new Error('ID de etapa inválido.');
    }

    // --- Validación de no solapamiento con etapas activas ---
    const activeFlag = is_active === undefined ? true : is_active;
    if (activeFlag) {
        const overlapQuery = `
            SELECT id, name, start_date, end_date
            FROM booster_config_stages
            WHERE is_active = TRUE
            AND start_date < $2
            AND end_date > $1
            ${safeId ? 'AND id != $3' : ''}
        `;
        const overlapParams = safeId
            ? [startDateObj, endDateObj, safeId]
            : [startDateObj, endDateObj];

        const overlapResult = await pool.query(overlapQuery, overlapParams);

        if (overlapResult.rowCount > 0) {
            const conflicting = overlapResult.rows[0];
            throw new Error(
                `Solapamiento de fechas detectado con "${conflicting.name}" ` +
                `(${new Date(conflicting.start_date).toLocaleDateString()} - ` +
                `${new Date(conflicting.end_date).toLocaleDateString()}). ` +
                `Las etapas activas no pueden tener fechas superpuestas.`
            );
        }
    }

    // --- Persistencia ---
    if (safeId) {
        // Actualización de etapa existente
        const result = await pool.query(
            `UPDATE booster_config_stages
             SET name = $1, start_date = $2, end_date = $3, multiplier = $4,
                 is_active = $5, updated_at = CURRENT_TIMESTAMP
             WHERE id = $6 RETURNING *`,
            [name, startDateObj, endDateObj, parsedMultiplier, activeFlag, safeId]
        );
        if (result.rowCount === 0) {
            throw new Error(`Etapa con id=${safeId} no encontrada.`);
        }
        return result.rows[0];
    } else {
        // Creación de nueva etapa
        const result = await pool.query(
            `INSERT INTO booster_config_stages (name, start_date, end_date, multiplier, is_active)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, startDateObj, endDateObj, parsedMultiplier, activeFlag]
        );
        return result.rows[0];
    }
}

module.exports = {
    calculateMultipliedAmount,
    getAllStages,
    saveStage,
    executeBoosterPayments
};
