/**
 * Servicio de Gestión de Boosters y Multiplicadores
 * ══════════════════════════════════════════════════════════════════════════
 * Centraliza la lógica económica del protocolo de compensación de
 * pre-lanzamiento de WintonCoin.
 *
 * Responsabilidades:
 *   1. Calcular el monto multiplicado para una fecha dada
 *   2. Gestionar las etapas de configuración (CRUD)
 *   3. Validar la integridad temporal (no solapamiento de fechas)
 *
 * Diseño:
 *   - Módulo Singleton: exporta una instancia única
 *   - Queries parametrizadas: prevención de SQL Injection
 *   - Fallback seguro: si no hay etapa activa, multiplier = 1.0
 *   - Reutilizable: diseñado para ser invocado desde cualquier servicio
 *     que necesite aplicar multiplicadores (gobernanza, referidos, etc.)
 * ══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const pool = require('../config/db');

// ─── Constantes de seguridad ─────────────────────────────────────────────
// Límite superior de multiplicador como guardrail económico.
// Previene errores humanos (ej: poner 99999 en vez de 9).
// Ajustable según decisión de gobernanza del proyecto.
const MAX_MULTIPLIER = 100;

/**
 * Calcula el monto multiplicado basado en una fecha específica.
 *
 * Busca la etapa activa cuyo intervalo [start_date, end_date] contiene
 * la fecha proporcionada. Si múltiples etapas cubrieran la misma fecha
 * (situación que la validación de saveStage debe prevenir), se utiliza
 * la de mayor multiplicador (ORDER BY multiplier DESC) para garantizar
 * un resultado determinístico y favorable al impulsor.
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
        // ORDER BY multiplier DESC: si hay solapamiento (no debería), se usa el mayor
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
 *   1. start_date < end_date (también validado por CHECK en DB)
 *   2. multiplier > 0 (también validado por CHECK en DB)
 *   3. No solapamiento con otras etapas activas (validación de negocio)
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
    // Busca cualquier etapa activa cuyo rango [start, end] se intersecte
    // con el nuevo rango [start_date, end_date], excluyendo la etapa actual si es edición.
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
};
