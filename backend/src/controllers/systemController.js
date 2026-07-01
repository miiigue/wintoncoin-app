/**
 * systemController.js - Controlador de Utilidades y Configuración de WintonCoin
 */
const pool = require('../config/db');

// Caché para información de contratos Web3 (Estándar Fintech para prevenir DDoS sobre nodos RPC)
let contractsInfoCache = null;
let lastContractsFetch = 0;
const CACHE_TTL_MS = 60000; // 60 segundos de caché

const SystemController = {
    // =========================================================================
    // Obtener información de Smart Contracts (Seguro y Cacheado)
    // =========================================================================
    getContractsInfo: async (req, res) => {
        try {
            // Prevenir ataques de agotamiento de RPC devolviendo desde la memoria caché si es válido
            if (contractsInfoCache && (Date.now() - lastContractsFetch < CACHE_TTL_MS)) {
                return res.status(200).json(contractsInfoCache);
            }

            const { ethers } = require('ethers');
            const RPC_URL = process.env.OPTIMISM_RPC_URL || 'https://sepolia.optimism.io';
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            
            const blueAddress = process.env.BLUE_TOKEN_ADDRESS || '0x000000000000000000000000000000000000BLUE';
            const redAddress = process.env.RED_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000RED';
            
            let blueMinted = '10000000.0000';
            let redMinted = '5000000.0000';

            // Intentar leer de la blockchain real si las direcciones son válidas
            if (blueAddress.startsWith('0x') && blueAddress.length === 42 && !blueAddress.includes('BLUE')) {
                const abi = ["function totalSupply() view returns (uint256)"];
                const blueContract = new ethers.Contract(blueAddress, abi, provider);
                try {
                    const supply = await blueContract.totalSupply();
                    blueMinted = ethers.formatEther(supply);
                } catch (e) {
                    console.error("[WEB3 SEC] Error reading BLUE totalSupply", e.message);
                }
            }
            
            if (redAddress.startsWith('0x') && redAddress.length === 42 && !redAddress.includes('RED')) {
                const abi = ["function totalSupply() view returns (uint256)"];
                const redContract = new ethers.Contract(redAddress, abi, provider);
                try {
                    const supply = await redContract.totalSupply();
                    redMinted = ethers.formatEther(supply);
                } catch (e) {
                    console.error("[WEB3 SEC] Error reading RED totalSupply", e.message);
                }
            }

            contractsInfoCache = {
                blue: {
                    address: blueAddress,
                    minted: parseFloat(blueMinted).toLocaleString('es-ES', {minimumFractionDigits: 4, maximumFractionDigits: 4}) + ' BLUE'
                },
                red: {
                    address: redAddress,
                    minted: parseFloat(redMinted).toLocaleString('es-ES', {minimumFractionDigits: 4, maximumFractionDigits: 4}) + ' RED'
                }
            };
            lastContractsFetch = Date.now();

            res.status(200).json(contractsInfoCache);
        } catch (error) {
            console.error("[WEB3 SEC] Error fetching contract info:", error);
            // Fallback de seguridad para que la UI no se rompa
            if (contractsInfoCache) {
                return res.status(200).json(contractsInfoCache);
            }
            res.status(500).json({ error: "Error de infraestructura Web3" });
        }
    },

    // =========================================================================
    // Obtener configuración de referidos (Público)
    // =========================================================================
    getReferralSettings: async (req, res) => {
        try {
            // 1. Obtenemos las configuraciones relevantes
            const keys = [
                'referral_reward_after_expiry',
                'referral_codes_expiry_date',
                'referral_custom_share_code',
                'referral_custom_share_code_enabled',
                'referral_share_message_template'
            ];
            
            const result = await pool.query(
                'SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1)',
                [keys]
            );
 
            const settings = {};
            result.rows.forEach(row => {
                settings[row.setting_key] = row.setting_value;
            });
 
            // 2. Contar usuarios registrados para determinar el tramo activo
            const countRes = await pool.query('SELECT COUNT(*) as count FROM users');
            const totalUsers = parseInt(countRes.rows[0].count, 10);
 
            // 3. Obtener el monto del tramo activo
            const tierRes = await pool.query(`
                SELECT max_users_limit, reward_amount 
                FROM referral_reward_tiers 
                WHERE max_users_limit >= $1 
                ORDER BY tier_number ASC 
                LIMIT 1
            `, [totalUsers]);
 
            let rewardAmount = '0.00';
            let remainingSlots = 0;
            if (tierRes.rowCount > 0) {
                rewardAmount = parseFloat(tierRes.rows[0].reward_amount).toFixed(2);
                remainingSlots = Math.max(0, parseInt(tierRes.rows[0].max_users_limit, 10) - totalUsers);
            } else {
                rewardAmount = parseFloat(settings['referral_reward_after_expiry'] || '0.00').toFixed(2);
                remainingSlots = 0;
            }
            
            res.status(200).json({
                referral_reward_amount: rewardAmount,
                referral_remaining_slots: remainingSlots,
                referral_reward_after_expiry: settings['referral_reward_after_expiry'] || '0.00',
                referral_codes_expiry_date: settings['referral_codes_expiry_date'] || null,
                referral_custom_share_code: settings['referral_custom_share_code'] || 'WINTON',
                referral_custom_share_code_enabled: settings['referral_custom_share_code_enabled'] === 'true',
                referral_share_message_template: settings['referral_share_message_template'] || ''
            });
        } catch (error) {
            console.error("Error al obtener configuración de referidos:", error);
            res.status(500).json({ message: "Error interno del servidor." });
        }
    },

    // =========================================================================
    // Obtener fecha de vigencia de códigos de referido (Público)
    // =========================================================================
    getReferralExpiryDate: async (req, res) => {
        try {
            const result = await pool.query(`SELECT setting_value FROM app_settings WHERE setting_key = 'referral_codes_expiry_date'`);

            if (result.rows.length > 0 && result.rows[0].setting_value) {
                res.status(200).json({ expiry_date: result.rows[0].setting_value });
            } else {
                res.status(404).json({ message: "Fecha de vigencia no configurada." });
            }
        } catch (error) {
            console.error("Error al obtener fecha de vigencia:", error);
            res.status(500).json({ message: "Error interno del servidor." });
        }
    },

    // =========================================================================
    // Lista de Obligaciones Vencidas (LOVE) (Público)
    // =========================================================================
    getLoveList: async (req, res) => {
        try {
            const sql = `
                SELECT
                    username,
                    SUM(amount) AS total_overdue_amount,
                    MIN(due_at) AS overdue_since,
                    COUNT(*) AS recurrence_count
                FROM
                    red_token_debts
                WHERE
                    is_penalized = TRUE AND is_settled = FALSE
                GROUP BY
                    username
                ORDER BY
                    overdue_since ASC;
            `;
            const result = await pool.query(sql);
            res.status(200).json(result.rows);
        } catch (error) {
            console.error("Error al obtener la Lista de Obligaciones Vencidas (LOVE):", error);
            res.status(500).json({ message: "Error interno del servidor." });
        }
    },

    // =========================================================================
    // Obtener la configuración pública de la app
    // =========================================================================
    getAppSettings: async (req, res) => {
        try {
            // Claves de configuración pública estándar a recuperar
            const settingKeys = [
                'public_profiles_enabled',
                'referral_reward_amount',
                'welcome_bonus_amount'
            ];
            // Ejecutar consulta segura parametrizada contra la tabla de configuraciones
            const result = await pool.query(
                'SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1::text[])',
                [settingKeys]
            );

            // Reducir las filas a un objeto clave-valor para facilitar su consumo por el cliente
            const settingsObject = result.rows.reduce((acc, setting) => {
                acc[setting.setting_key] = setting.setting_value;
                return acc;
            }, {});

            // Retornar código de éxito 200 con el objeto de configuración cargado
            res.status(200).json(settingsObject);
        } catch (error) {
            console.error("Error al obtener la configuración pública de la app:", error);
            res.status(500).json({ message: "Error interno del servidor." });
        }
    },

    // =========================================================================
    // Obtener la configuración general básica (Público)
    // =========================================================================
    getPublicSettings: async (req, res) => {
        try {
            // Consulta para obtener el estado de registro, publicaciones y comisiones
            const sql = `
                SELECT setting_key, setting_value FROM app_settings 
                WHERE setting_key IN (
                    'public_profiles_enabled', 
                    'allow_new_registrations', 
                    'allow_new_publications',
                    'platform_commission_percentage'
                )
            `;
            const result = await pool.query(sql);
            
            // Transformar la respuesta y realizar casting estricto de tipos de datos
            const settings = result.rows.reduce((acc, row) => {
                if (row.setting_key === 'platform_commission_percentage') {
                    // La comisión se trata de forma estricta como un float
                    acc[row.setting_key] = parseFloat(row.setting_value) || 0;
                } else {
                    // Los demás parámetros se evalúan como booleanos limpios
                    acc[row.setting_key] = row.setting_value === 'true';
                }
                return acc;
            }, {});
            
            res.status(200).json(settings);
        } catch (error) {
            console.error("[SystemController] Error al obtener la configuración pública:", error);
            res.status(500).json({ message: "Error interno del servidor." });
        }
    },

    // =========================================================================
    // Obtener la configuración detallada de la plataforma (Público)
    // =========================================================================
    getPlatformSettings: async (req, res) => {
        try {
            // Claves que controlan el estado del lanzamiento y habilitación de publicaciones
            const settingsKeys = [
                'pre_launch_mode_enabled',
                'allow_request_publications',
                'allow_sell_publications',
                'allow_donation_publications',
                'allow_quick_sale_publications'
            ];
            
            // Recuperar valores usando parametrización segura
            const result = await pool.query(`
                SELECT setting_key, setting_value 
                FROM app_settings 
                WHERE setting_key = ANY($1::text[])
            `, [settingsKeys]);

            // Reducir las llaves como booleanos directos
            const settings = result.rows.reduce((acc, row) => {
                acc[row.setting_key] = row.setting_value === 'true';
                return acc;
            }, {});

            // Inyectar el nombre del usuario de la plataforma desde variables de entorno (Zero Hardcoded Secrets)
            settings.platform_username = process.env.PLATFORM_USERNAME || 'Plataforma WintonCoin';

            res.status(200).json(settings);
        } catch (error) {
            console.error("[SystemController] Error al obtener la configuración de la plataforma:", error);
            res.status(500).json({ message: "Error interno del servidor." });
        }
    }
};

module.exports = SystemController;
