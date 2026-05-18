/**
 * backend/migrations/050_add_web3_wallet_and_scoring_settings.js
 * 
 * PROPÓSITO: Implementar la infraestructura de base de datos necesaria para la 
 * Fase Web3 y el Motor de Scoring Conductual (WTS).
 * 
 * ESTÁNDAR DE INGENIERÍA: Zero Hardcoded Secrets & Idempotencia de Migración.
 */

exports.up = async (client) => {
    // Registro de inicio para trazabilidad y auditoría técnica.
    console.log('[MIGRATION 050] Iniciando actualización de esquema: Web3 & Scoring RED...');

    // 1. MODIFICACIÓN DE ESQUEMA (TABLA USERS)
    // Se utiliza ALTER TABLE con IF NOT EXISTS para prevenir errores de "columna duplicada".
    // web3_wallet_address: VARCHAR(42) es el estándar exacto para direcciones Ethereum (0x... + 40 chars).
    // web3_private_key_encrypted: TEXT permite almacenar el payload cifrado (IV + Ciphertext) sin límites de longitud.
    await client.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS web3_wallet_address VARCHAR(42),
        ADD COLUMN IF NOT EXISTS web3_private_key_encrypted TEXT
    `);
    console.log('[MIGRATION 050] Infraestructura de Bóvedas Web3 inyectada en tabla "users".');

    // 2. CONFIGURACIÓN DE PARÁMETROS ECONÓMICOS (TABLA APP_SETTINGS)
    // Definimos las variables que alimentan el motor de Scoring dinámico.
    // Almacenamos estos valores en DB para permitir ajustes de gobernanza sin redesplegar código.
    const scoringSettings = [
        ['red_credit_base_limit', '100', 'Límite base inicial de crédito RED para nuevos usuarios'],
        ['red_credit_culture_quiz', '1', 'Bono de crédito RED por cada quiz de cultura Winton aprobado'],
        ['red_credit_referral', '5', 'Bono de crédito RED por cada referido activo que se registre'],
        ['red_credit_monthly_activity', '1', 'Bono mensual por actividad continua (>20 tareas)'],
        ['red_credit_early_payment', '2', 'Bono de crédito RED por pago de deuda antes de 5 días']
    ];

    // Iteración segura con manejo de conflictos.
    // ON CONFLICT (setting_key) DO NOTHING: Evita errores si la variable ya fue insertada por un script previo.
    for (const [key, value, desc] of scoringSettings) {
        await client.query(`
            INSERT INTO app_settings (setting_key, setting_value, description)
            VALUES ($1, $2, $3)
            ON CONFLICT (setting_key) DO NOTHING
        `, [key, value, desc]);
    }
    
    console.log('[MIGRATION 050] Variables de Scoring WTS registradas en configuración maestra.');
    console.log('[MIGRATION 050] Proceso finalizado exitosamente. Sistema 100% auditable.');
};

exports.down = async (client) => {
    // Función de reversión para rollback controlado en caso de emergencia.
    await client.query(`
        ALTER TABLE users 
        DROP COLUMN IF EXISTS web3_wallet_address,
        DROP COLUMN IF EXISTS web3_private_key_encrypted
    `);
};
