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
    try {
        // 1. Obtener los settings del sistema relacionados con impulsores sin transacciones largas.
        // Esto mantiene el pool libre y previene bloqueos innecesarios en lecturas iniciales.
        const settingsResult = await pool.query(`
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

        // Si el sistema general de impulsores está desactivado, salimos de inmediato
        if (settings.booster_system_enabled !== 'true') {
            return;
        }

        const customFreqEnabled = settings.booster_custom_frequency_enabled === 'true';
        const today = new Date();
        let paymentMonth;
        let isEligible = false;
        let totalFreqMs = 0;

        if (customFreqEnabled) {
            // --- CÁCULO DE FRECUENCIA PERSONALIZADA (INTERVALO DE TIEMPO) ---
            const freqDays = parseInt(settings.booster_payment_frequency_days, 10) || 0;
            const freqHours = parseInt(settings.booster_payment_frequency_hours, 10) || 0;
            const freqMinutes = parseInt(settings.booster_payment_frequency_minutes, 10) || 0;
            
            // Convertimos la frecuencia a milisegundos
            totalFreqMs = ((freqDays * 24 * 60) + (freqHours * 60) + freqMinutes) * 60 * 1000;

            if (totalFreqMs <= 0) {
                console.log('BOOSTER PAYMENTS: Frecuencia personalizada inválida (0 minutos). Saltando ciclo.');
                return;
            }

            // Consultar cuándo fue el último pago de impulsores registrado en base de datos.
            // Operación de lectura rápida sobre el pool.
            const lastPaymentLogResult = await pool.query(`
                SELECT created_at FROM booster_payment_log 
                ORDER BY created_at DESC LIMIT 1
            `);

            if (lastPaymentLogResult.rowCount > 0) {
                const lastPaymentTime = new Date(lastPaymentLogResult.rows[0].created_at);
                const timePassedMs = today.getTime() - lastPaymentTime.getTime();
                
                // Si el tiempo transcurrido es menor al intervalo configurado, saltamos el ciclo de pago
                if (timePassedMs < totalFreqMs) {
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
                return;
            }

            // Determinamos el mes de pago (el mes anterior)
            paymentMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const paymentMonthString = `${paymentMonth.getFullYear()}-${(paymentMonth.getMonth() + 1).toString().padStart(2, '0')}`;

            // Verificar si ya se realizó el pago para este mes.
            // Operación rápida de sólo lectura.
            const lastPaymentResult = await pool.query(`
                SELECT 1 FROM booster_payment_log 
                WHERE to_char(payment_month, 'YYYY-MM') = $1 LIMIT 1
            `, [paymentMonthString]);

            if (lastPaymentResult.rowCount > 0) {
                console.log(`BOOSTER PAYMENTS: El pago para ${paymentMonthString} ya fue realizado. Saltando ciclo.`);
                return;
            }

            isEligible = true;
            console.log(`BOOSTER PAYMENTS: Iniciando ciclo de pagos mensual para ${paymentMonthString}...`);
        }

        if (!isEligible) {
            return;
        }

        const paymentMonthString = `${paymentMonth.getFullYear()}-${(paymentMonth.getMonth() + 1).toString().padStart(2, '0')}`;

        // Obtener el balance inicial acumulado de la plataforma para fines de auditoría.
        const initialWalletRes = await pool.query('SELECT total_blue_commission_balance FROM platform_wallet WHERE id = 1');
        const initialWalletBalance = parseFloat(initialWalletRes.rows[0]?.total_blue_commission_balance) || 0;

        // AUDITORÍA FINTECH: Registrar inicio del proceso de pagos en el libro de auditoría centralizado.
        await logAuditEvent(pool, null, {
            eventType: 'booster.monthly_payments_started',
            actorUsername: 'system_cron',
            metadata: {
                paymentMonth: paymentMonthString,
                fundsAvailable: initialWalletBalance,
                customFrequencyActive: customFreqEnabled
            }
        });

        if (initialWalletBalance <= 0) {
            console.log(`BOOSTER PAYMENTS: No hay fondos de comisiones disponibles en la billetera de la plataforma.`);
            return;
        }

        console.log(`BOOSTER PAYMENTS: Fondos disponibles para distribución: ${initialWalletBalance.toFixed(4)} BLUE.`);

        // 3. Obtener niveles de impulsores ordenados por prioridad (niveles inferiores primero).
        const levelsResult = await pool.query('SELECT * FROM booster_level_settings ORDER BY level ASC');

        // Configuración de procesamiento por lotes (Batching) para evitar OOM y bloqueos prolongados de BD.
        const BATCH_SIZE = 500;

        for (const level of levelsResult.rows) {
            let initialFundsForLevel = 0;
            let totalDebtForLevel = 0;

            // A. INICIAR TRANSACCIÓN DE PRESUPUESTO DEL NIVEL
            // Consultamos los fondos líquidos reales y calculamos la deuda acumulada del nivel
            // aplicando una ventana de exclusión temporal dinámica (idempotencia) según la frecuencia.
            let client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Bloqueo pesimista FOR UPDATE en platform_wallet
                const walletRes = await client.query('SELECT total_blue_commission_balance FROM platform_wallet WHERE id = 1 FOR UPDATE');
                initialFundsForLevel = parseFloat(walletRes.rows[0]?.total_blue_commission_balance) || 0;

                if (initialFundsForLevel <= 0) {
                    await client.query('COMMIT');
                    continue; // Se agotó el saldo, saltar el resto de los niveles
                }

                // Calcular deuda agregada del nivel con ventana de exclusión temporal dinámica.
                // Si la frecuencia es personalizada, excluimos a los usuarios pagados en el último intervalo de tiempo.
                // Si es mensual, los excluimos del mes de pago calendario.
                let debtRes;
                if (customFreqEnabled) {
                    const lookbackInterval = `${totalFreqMs / 1000} seconds`;
                    debtRes = await client.query(`
                        SELECT COALESCE(SUM(amount), 0.0000) as total_debt
                        FROM booster_blue_ledger bbl
                        JOIN users u ON bbl.user_id = u.id
                        WHERE u.is_booster = TRUE
                          AND u.booster_level = $1
                          AND u.kyc_verified = TRUE
                          AND NOT EXISTS (
                              SELECT 1 FROM booster_payment_log bpl
                              WHERE bpl.user_id = u.id
                                AND bpl.created_at >= NOW() - $2::INTERVAL
                          )
                    `, [level.level, lookbackInterval]);
                } else {
                    debtRes = await client.query(`
                        SELECT COALESCE(SUM(amount), 0.0000) as total_debt
                        FROM booster_blue_ledger bbl
                        JOIN users u ON bbl.user_id = u.id
                        WHERE u.is_booster = TRUE
                          AND u.booster_level = $1
                          AND u.kyc_verified = TRUE
                          AND NOT EXISTS (
                              SELECT 1 FROM booster_payment_log bpl
                              WHERE bpl.user_id = u.id
                                AND to_char(bpl.payment_month, 'YYYY-MM') = $2
                          )
                    `, [level.level, paymentMonthString]);
                }

                totalDebtForLevel = parseFloat(debtRes.rows[0]?.total_debt) || 0;
                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`BOOSTER PAYMENTS: Error al calcular presupuesto de Nivel ${level.level}:`, err);
                continue;
            } finally {
                client.release();
            }

            // Si el nivel no tiene deudas elegibles que pagar, saltamos al siguiente
            if (totalDebtForLevel <= 0) {
                console.log(`BOOSTER PAYMENTS: Nivel ${level.level} no tiene deudas de comisiones elegibles.`);
                continue;
            }

            // Calcular porcentaje de cobertura equitativo del nivel (Standard Bancario).
            // Todos los usuarios en un mismo nivel cobrarán exactamente el mismo porcentaje de su deuda en este ciclo.
            const levelPaymentPercentage = Math.min(1.0, initialFundsForLevel / totalDebtForLevel);
            console.log(`BOOSTER PAYMENTS: Nivel ${level.level} - Deuda: ${totalDebtForLevel.toFixed(4)}. Cobertura: ${(levelPaymentPercentage * 100).toFixed(2)}%`);

            // B. PROCESAMIENTO DE USUARIOS POR LOTES (CURSOR PAGINATION)
            let lastProcessedId = 0;
            let hasMoreBoosters = true;

            while (hasMoreBoosters) {
                client = await pool.connect();
                try {
                    await client.query('BEGIN');

                    // 1. Lock de balance para asegurar integridad concurrente
                    const walletRes = await client.query('SELECT total_blue_commission_balance FROM platform_wallet WHERE id = 1 FOR UPDATE');
                    let fundsAvailable = parseFloat(walletRes.rows[0]?.total_blue_commission_balance) || 0;

                    if (fundsAvailable <= 0) {
                        console.log(`BOOSTER PAYMENTS: Se agotó el saldo líquido de la plataforma. Deteniendo distribución.`);
                        await client.query('COMMIT');
                        hasMoreBoosters = false;
                        break;
                    }

                    // 2. Query del lote actual usando paginación de ID (Cursor) y exclusión dinámica
                    let boostersResult;
                    if (customFreqEnabled) {
                        const lookbackInterval = `${totalFreqMs / 1000} seconds`;
                        boostersResult = await client.query(`
                            SELECT u.id, u.username,
                                   COALESCE((SELECT SUM(amount) FROM booster_blue_ledger WHERE user_id = u.id), 0.0000) as total_booster_blue
                            FROM users u
                            WHERE u.is_booster = TRUE
                              AND u.booster_level = $1
                              AND u.kyc_verified = TRUE
                              AND u.id > $2
                              AND NOT EXISTS (
                                  SELECT 1 FROM booster_payment_log bpl
                                  WHERE bpl.user_id = u.id
                                    AND bpl.created_at >= NOW() - $3::INTERVAL
                              )
                            ORDER BY u.id ASC
                            LIMIT $4
                        `, [level.level, lastProcessedId, lookbackInterval, BATCH_SIZE]);
                    } else {
                        boostersResult = await client.query(`
                            SELECT u.id, u.username,
                                   COALESCE((SELECT SUM(amount) FROM booster_blue_ledger WHERE user_id = u.id), 0.0000) as total_booster_blue
                            FROM users u
                            WHERE u.is_booster = TRUE
                              AND u.booster_level = $1
                              AND u.kyc_verified = TRUE
                              AND u.id > $2
                              AND NOT EXISTS (
                                  SELECT 1 FROM booster_payment_log bpl
                                  WHERE bpl.user_id = u.id
                                    AND to_char(bpl.payment_month, 'YYYY-MM') = $3
                              )
                            ORDER BY u.id ASC
                            LIMIT $4
                        `, [level.level, lastProcessedId, paymentMonthString, BATCH_SIZE]);
                    }

                    // Si el lote está vacío, terminamos este nivel
                    if (boostersResult.rowCount === 0) {
                        await client.query('COMMIT');
                        hasMoreBoosters = false;
                        break;
                    }

                    // 3. Procesar individualmente a los impulsores en el lote actual
                    for (const booster of boostersResult.rows) {
                        const userDebt = parseFloat(booster.total_booster_blue) || 0;
                        if (userDebt <= 0) continue;

                        let amountToPay = userDebt * levelPaymentPercentage;

                        // Guardrail Contable Financiero: Nunca pagar más de lo que queda de saldo en la caja de comisiones
                        amountToPay = Math.min(amountToPay, fundsAvailable);

                        if (amountToPay > 0) {
                            // Acreditar al saldo en custodia (escrow) del usuario mediante Event Sourcing
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

                            // --- RECONCILIACIÓN Y PARTIDA DOBLE DE LA BILLETERA DE LA PLATAFORMA ---
                            // Se descuenta el monto pagado de la billetera central de la plataforma
                            await client.query(
                                `UPDATE platform_wallet 
                                 SET total_blue_commission_balance = total_blue_commission_balance - $1 
                                 WHERE id = 1`,
                                [amountToPay]
                            );

                            // --- BITÁCORA DE CONTROL DE CAJA DE LA PLATAFORMA (AUDIT TRAIL) ---
                            // Se inserta un egreso negativo en platform_wallet_log, dejando registro inmutable
                            const walletLogDesc = `Pago de recompensa a impulsor ${booster.username} (Nivel ${level.level}) para el periodo ${paymentMonthString}`;
                            await client.query(
                                `INSERT INTO platform_wallet_log (transaction_type, amount, related_username, description)
                                 VALUES ('booster_payout', $1, $2, $3)`,
                                [-amountToPay, booster.username, walletLogDesc]
                            );

                            // Descontar del balance local del lote actual
                            fundsAvailable -= amountToPay;

                            console.log(`BOOSTER PAYMENTS: Lote procesó pago para ${booster.username}: ${amountToPay.toFixed(4)} BLUE.`);
                        }
                    }

                    // 4. Actualizar el cursor de ID con el valor máximo procesado en el lote
                    const maxIdInBatch = Math.max(...boostersResult.rows.map(b => b.id));
                    lastProcessedId = maxIdInBatch;

                    await client.query('COMMIT');
                } catch (batchErr) {
                    await client.query('ROLLBACK');
                    console.error(`BOOSTER PAYMENTS: Error crítico al procesar lote en Nivel ${level.level} (lastProcessedId: ${lastProcessedId}):`, batchErr);
                    hasMoreBoosters = false; // Detener flujo para evitar bucle infinito en fallos físicos
                } finally {
                    client.release();
                }
            }
        }

        // 4. Registrar la culminación del ciclo contable general leyendo el balance neto final de caja
        const finalWalletRes = await pool.query('SELECT total_blue_commission_balance FROM platform_wallet WHERE id = 1');
        const finalWalletBalance = parseFloat(finalWalletRes.rows[0]?.total_blue_commission_balance) || 0;
        const totalPaidOut = initialWalletBalance - finalWalletBalance;

        await logAuditEvent(pool, null, {
            eventType: 'booster.monthly_payments_completed',
            actorUsername: 'system_cron',
            metadata: {
                paymentMonth: paymentMonthString,
                totalPaidOut,
                customFrequencyActive: customFreqEnabled
            }
        });
        console.log(`BOOSTER PAYMENTS: Ciclo finalizado con éxito. Total pagado: ${totalPaidOut.toFixed(4)} BLUE.`);

    } catch (error) {
        console.error('BOOSTER PAYMENTS: Error crítico general en el ciclo de pagos:', error);
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
