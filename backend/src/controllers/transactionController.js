// ============================================================================
// WintonCoin - Transaction Controller (Controlador de Transacciones)
// ============================================================================
// Este módulo encapsula las consultas a la base de datos relacionadas con el
// historial de transacciones. Está diseñado bajo los principios de Segregación
// de Responsabilidades de Consulta (proyecciones de lectura) para separar
// la actividad on-chain (Web3) de los bonos promocionales off-chain.
//
// PROTECCIONES DE SEGURIDAD IMPLEMENTADAS:
// 1. Consultas Parametrizadas (SQL Injection Protection): Se utiliza la
//    librería 'pg' pasando argumentos mediante placeholders ($1, $2),
//    previniendo cualquier manipulación maliciosa de inputs.
// 2. Control de Acceso Riguroso (BOLA/IDOR Protection): Se verifica que el
//    usuario autenticado por JWT coincida con los datos solicitados en
//    las consultas.
// 3. Trazabilidad de Auditoría Bancaria: No se alteran ni eliminan registros,
//    manteniendo el Ledger General íntegro.
// ============================================================================

'use strict';

// Importamos el pool de conexiones configurado a nivel global en la base de datos
const pool = require('../config/db');

/**
 * Endpoint Profesional: Obtiene el historial de transacciones Web3 filtrado para el usuario autenticado.
 * 
 * @param {import('express').Request} req - Request de Express conteniendo req.user.userId desde JWT
 * @param {import('express').Response} res - Response de Express
 */
const getMyTransactions = async (req, res) => {
    // 1. Obtener la identidad del usuario autenticado (fuente de verdad: JWT validado)
    const userId = req.user?.userId;
    if (!userId) {
        return res.status(401).json({ message: 'No autenticado. Sesión inválida.' });
    }

    // 2. Definición del query SQL parametrizado según el filtro.
    const filterType = req.query.type || 'web3'; // Por defecto Web3 para mantener seguridad
    
    let sql = '';
    
    if (filterType === 'marketing') {
        // [Aislamiento de Datos / CQRS] - El perfil Impulsor lee exclusivamente de booster_transactions
        // Garantizamos Conciliación Bancaria mostrando todos los eventos del ledger BLUE IOU
        sql = `
            SELECT 
                bt.id,
                bt.type,
                bt.amount AS blue_change,
                0 AS red_change,
                bt.description,
                bt.created_at,
                u.username
            FROM booster_transactions bt
            JOIN users u ON bt.user_id = u.id
            WHERE bt.user_id = $1
            ORDER BY bt.created_at DESC
        `;
    } else {
        // web3 - Aislamiento de Ecosistema: Web3 lee exclusivamente de transactions
        const typeCondition = "t.type IN ('payment_sent', 'payment_received', 'commission_received', 'burn', 'escrow_release', 'booster_reward')";
        sql = `
            SELECT t.*, u.username
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            WHERE t.user_id = $1
              AND ${typeCondition}
            ORDER BY t.created_at DESC
        `;
    }

    try {
        // 3. Ejecución de la consulta utilizando preparación de sentencias seguras
        const result = await pool.query(sql, [userId]);
        
        // 4. Retornar los registros filtrados en formato JSON con estatus 200 (OK)
        return res.status(200).json(result.rows);
    } catch (err) {
        // Logueo del error en el servidor para depuración técnica (sin exponer detalles al cliente)
        console.error("Error al obtener las transacciones (/api/me/transactions):", err.message);
        return res.status(500).json({ message: "Error interno del servidor." });
    }
};

/**
 * Endpoint Legacy: Obtiene el historial de transacciones basado en el parámetro username.
 * Se implementan los mismos filtros Web3 para mantener consistencia de datos entre interfaces.
 * 
 * @param {import('express').Request} req - Request de Express
 * @param {import('express').Response} res - Response de Express
 */
const getUserTransactionsLegacy = async (req, res) => {
    const { username } = req.params;

    // 1. Control de acceso cruzado (Fintech Policy):
    // Un usuario normal no puede consultar la billetera ni transacciones de otro usuario.
    if (!req.user?.username || req.user.username !== username) {
        return res.status(403).json({ message: 'No autorizado para consultar transacciones de otro usuario.' });
    }

    // 2. Consulta parametrizada unificando los criterios de filtrado
    const filterType = req.query.type || 'web3';
    
    let sql = '';
    
    if (filterType === 'marketing') {
        // [Aislamiento de Datos / CQRS] - El perfil Impulsor lee exclusivamente de booster_transactions
        sql = `
            SELECT 
                bt.id,
                bt.type,
                bt.amount AS blue_change,
                0 AS red_change,
                bt.description,
                bt.created_at,
                u.username
            FROM booster_transactions bt
            JOIN users u ON bt.user_id = u.id
            WHERE u.username = $1
            ORDER BY bt.created_at DESC
        `;
    } else {
        const typeCondition = "t.type IN ('payment_sent', 'payment_received', 'commission_received', 'burn', 'escrow_release', 'booster_reward')";
        sql = `
            SELECT t.*, u.username 
            FROM transactions t 
            JOIN users u ON t.user_id = u.id 
            WHERE u.username = $1 
              AND ${typeCondition}
            ORDER BY t.created_at DESC
        `;
    }

    try {
        const result = await pool.query(sql, [username]);
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error(`Error al obtener las transacciones legacy para ${username}:`, err.message);
        return res.status(500).json({ message: "Error interno del servidor." });
    }
};

module.exports = {
    getMyTransactions,
    getUserTransactionsLegacy
};
