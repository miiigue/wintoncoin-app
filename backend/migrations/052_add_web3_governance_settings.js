/**
 * backend/migrations/052_add_web3_governance_settings.js
 * 
 * PROPÓSITO: Registrar las variables de configuración Web3 en app_settings
 * para que el sistema de gobernanza Winton-Consensus pueda gestionar los
 * parámetros on-chain del protocolo (pausar, circuit breaker, treasury).
 * 
 * CONTEXTO: Los Smart Contracts (WintonProtocol, WintonTreasury) están
 * desplegados en Optimism Sepolia. Cuando un guardián aprueba un cambio
 * en estas variables, el backend sincroniza automáticamente con la blockchain
 * vía web3BridgeService.js.
 * 
 * ESTÁNDAR DE INGENIERÍA: Idempotencia (ON CONFLICT DO NOTHING).
 */

exports.up = async (client) => {
    // Registro de inicio para trazabilidad y auditoría técnica.
    console.log('[MIGRATION 052] Iniciando registro de variables Web3 en configuración maestra...');

    // Definición de las 4 variables de gobernanza Web3.
    // Cada registro sigue el formato: [setting_key, setting_value, description].
    // Estos valores iniciales coinciden con los configurados en los Smart Contracts desplegados.
    const web3Settings = [
        [
            'web3_protocol_paused',
            'false',
            'Estado de pausa del protocolo WintonProtocol on-chain. true = pausado (emergencia), false = activo.'
        ],
        [
            'web3_max_transaction_amount',
            '1000000',
            'Límite máximo de BLUE por transacción individual (Circuit Breaker). Valor en BLUE sin decimales.'
        ],
        [
            'web3_founders_wallet',
            '',
            'Dirección Ethereum de la billetera fundadora en WintonTreasury. Recibe los excedentes de ganancias.'
        ],
        [
            'web3_treasury_withdrawal',
            '0',
            'Monto de BLUE a retirar del Treasury como excedente. Se resetea a 0 después de cada retiro ejecutado.'
        ],
    ];

    // Inserción idempotente: ON CONFLICT DO NOTHING previene errores si la variable
    // ya fue insertada por un script previo o por una ejecución repetida de migraciones.
    for (const [key, value, desc] of web3Settings) {
        await client.query(`
            INSERT INTO app_settings (setting_key, setting_value, description)
            VALUES ($1, $2, $3)
            ON CONFLICT (setting_key) DO NOTHING
        `, [key, value, desc]);
    }

    console.log('[MIGRATION 052] 4 variables Web3 registradas en app_settings (gobernanza habilitada).');
    console.log('[MIGRATION 052] Proceso finalizado exitosamente.');
};

exports.down = async (client) => {
    // Función de reversión: elimina las 4 variables Web3 de la configuración.
    console.log('[MIGRATION 052] Revirtiendo: eliminando variables Web3 de app_settings...');

    await client.query(`
        DELETE FROM app_settings 
        WHERE setting_key IN (
            'web3_protocol_paused',
            'web3_max_transaction_amount',
            'web3_founders_wallet',
            'web3_treasury_withdrawal'
        )
    `);

    console.log('[MIGRATION 052] Variables Web3 eliminadas.');
};
