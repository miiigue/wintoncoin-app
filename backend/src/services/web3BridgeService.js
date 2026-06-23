/**
 * src/services/web3BridgeService.js
 * Puente profesional para la sincronización entre DB y Blockchain (Optimism Sepolia).
 * 
 * ARQUITECTURA EIP-7702 (Pectra / Isthmus):
 * Este servicio actúa como el Relayer del ecosistema. Firma y paga las transacciones
 * que los usuarios y la gobernanza necesitan ejecutar en la blockchain.
 * 
 * FUNCIONES DISPONIBLES:
 * - syncPaymentToBlockchain: Sincroniza un pago procesado (processPayment).
 * - pauseProtocol / unpauseProtocol: Pausa/reanuda el protocolo (emergencia).
 * - setMaxTransactionAmount: Ajusta el Circuit Breaker on-chain.
 * - setFoundersWallet: Configura la billetera fundadora en el Treasury.
 * - withdrawSurplus: Retira excedentes del Treasury a la billetera fundadora.
 * - getProtocolStatus: Lee el estado actual del protocolo desde la blockchain.
 * 
 * SEGURIDAD:
 * - Zero Hardcoded Secrets: Todo viene de variables de entorno.
 * - Verificación de recibos: Cada transacción espera confirmación antes de retornar.
 * - Auditoría: Cada operación retorna el tx_hash para registro en audit_log.
 * - Manejo de errores: Captura y loguea sin detener el servidor.
 */

const { ethers } = require('ethers');
const pool = require('../config/db');

// ============================================================================
// CONFIGURACIÓN: Variables de entorno para máxima seguridad
// ============================================================================

// URL del nodo RPC (Alchemy/Infura) para Optimism Sepolia.
const RPC_URL = process.env.OPTIMISM_RPC_URL || 'http://127.0.0.1:8545';
// Llave privada del Relayer (la billetera que paga el gas).
const RELAYER_PK = process.env.RELAYER_PRIVATE_KEY;
// Dirección del contrato WintonProtocol desplegado.
const PROTOCOL_ADDRESS = process.env.WINTON_PROTOCOL_ADDRESS;
// Dirección del contrato WintonTreasury desplegado.
const TREASURY_ADDRESS = process.env.WINTON_TREASURY_ADDRESS;

class Web3BridgeService {
    constructor() {
        // Verificar que las variables de entorno estén configuradas.
        if (!RELAYER_PK || !PROTOCOL_ADDRESS) {
            console.warn('[WEB3 BRIDGE] ⚠️  RELAYER_PRIVATE_KEY o WINTON_PROTOCOL_ADDRESS no definidos. ' +
                'Las operaciones on-chain estarán deshabilitadas.');
        }

        // Crear el proveedor de conexión a la red Optimism Sepolia.
        this.provider = new ethers.JsonRpcProvider(RPC_URL);

        // Crear la billetera del Relayer con la llave privada del .env.
        this.wallet = RELAYER_PK ? new ethers.Wallet(RELAYER_PK, this.provider) : null;

        // ABI mínima del WintonProtocol: solo las funciones que necesitamos llamar.
        this.protocolAbi = [
            // Función principal de pagos (payer como parámetro con EIP-7702).
            "function processPayment(address payer, address payee, uint256 amountBlue) external",
            // Funciones de configuración (onlyOwner).
            "function pause() external",
            "function unpause() external",
            "function setMaxTransactionAmount(uint256 _newAmount) external",
            "function setCommissionRate(uint256 _newRate) external",
            "function setKYCStatus(address _wallet, bool _status) external",
            // Funciones de lectura (públicas, sin gas).
            "function paused() external view returns (bool)",
            "function maxTransactionAmount() external view returns (uint256)",
            "function commissionRate() external view returns (uint256)",
            "function isKYCVerified(address) external view returns (bool)",
            // Eventos para auditoría.
            "event PaymentProcessed(address indexed payer, address indexed payee, uint256 amountBlue, uint256 fee)",
            "event MaxTransactionAmountUpdated(uint256 oldAmount, uint256 newAmount)",
        ];

        // ABI mínima del WintonTreasury: funciones de configuración y retiro.
        this.treasuryAbi = [
            // Funciones de configuración (onlyOwner).
            "function setFoundersWallet(address _newWallet) external",
            "function withdrawSurplus(uint256 amount) external",
            "function pause() external",
            "function unpause() external",
            // Funciones de lectura (públicas, sin gas).
            "function foundersWallet() external view returns (address)",
            "function blueToken() external view returns (address)",
            // Eventos para auditoría.
            "event FoundersWalletUpdated(address indexed newWallet)",
            "event SurplusWithdrawn(address indexed to, uint256 amount)",
        ];
    }

    // ========================================================================
    // HELPERS INTERNOS
    // ========================================================================

    /**
     * Verifica que el Relayer esté configurado antes de ejecutar una operación.
     * @private
     * @returns {boolean} true si está listo, false si no.
     */
    _isReady() {
        if (!this.wallet) {
            console.error('[WEB3 BRIDGE] ❌ Relayer no configurado. Operación on-chain omitida.');
            return false;
        }
        return true;
    }

    /**
     * Crea una instancia del contrato WintonProtocol con el Relayer como firmante.
     * @private
     * @returns {ethers.Contract} Instancia del contrato conectada al Relayer.
     */
    _getProtocol() {
        return new ethers.Contract(PROTOCOL_ADDRESS, this.protocolAbi, this.wallet);
    }

    /**
     * Crea una instancia del contrato WintonTreasury con el Relayer como firmante.
     * @private
     * @returns {ethers.Contract|null} Instancia del contrato o null si no está configurado.
     */
    _getTreasury() {
        if (!TREASURY_ADDRESS) {
            console.error('[WEB3 BRIDGE] ❌ WINTON_TREASURY_ADDRESS no configurado.');
            return null;
        }
        return new ethers.Contract(TREASURY_ADDRESS, this.treasuryAbi, this.wallet);
    }

    /**
     * Espera la confirmación de una transacción y retorna el hash.
     * @private
     * @param {ethers.TransactionResponse} tx - La transacción enviada.
     * @param {string} operationName - Nombre de la operación para el log.
     * @returns {Promise<string|null>} El hash de la transacción confirmada o null si falló.
     */
    async _waitForConfirmation(tx, operationName) {
        console.log(`[WEB3 BRIDGE] Tx enviada (${operationName}): ${tx.hash}. Esperando confirmación...`);
        // Esperar 1 confirmación (estándar de seguridad para L2).
        const receipt = await tx.wait(1);
        if (receipt.status === 1) {
            console.log(`[WEB3 BRIDGE] ✅ ${operationName} EXITOSO. Tx: ${tx.hash}`);
            return tx.hash;
        } else {
            throw new Error(`Transacción revertida en la blockchain para ${operationName}`);
        }
    }

    // ========================================================================
    // FUNCIÓN 1: SINCRONIZAR PAGO (processPayment)
    // ========================================================================

    /**
     * Sincroniza un pago BLUE realizado en la plataforma con el Smart Contract.
     * Llamado automáticamente por el backend después de confirmar un pago.
     * 
     * @param {Object} params Datos de la transacción.
     * @param {string} params.payerWalletAddress Dirección del pagador.
     * @param {string} params.payeeWalletAddress Dirección del beneficiario.
     * @param {number} params.amountBlue Monto neto del pago.
     * @param {number} params.dbTransactionId ID de la transacción en la DB.
     * @param {string} params.payerUsername Username del pagador (para logs).
     * @param {string} params.payeeUsername Username del beneficiario (para logs).
     * @returns {Promise<string|null>} Hash de la transacción o null si falló.
     */
    async syncPaymentToBlockchain({ payerWalletAddress, payeeWalletAddress, amountBlue, dbTransactionId, payerUsername, payeeUsername }) {
        if (!this._isReady()) return null;

        try {
            console.log(`[WEB3 BRIDGE] Sincronizando pago: ${payerUsername} → ${payeeUsername} (${amountBlue} BLUE)`);

            const protocol = this._getProtocol();
            // Convertir monto a formato Blockchain (18 decimales estándar ERC-20).
            const amountWei = ethers.parseEther(amountBlue.toString());

            // Ejecutar processPayment con el payer como parámetro (arquitectura EIP-7702).
            const tx = await protocol.processPayment(payerWalletAddress, payeeWalletAddress, amountWei);
            const txHash = await this._waitForConfirmation(tx, 'syncPayment');

            // Guardar el hash en la base de datos para auditoría.
            if (dbTransactionId && txHash) {
                await pool.query(
                    'UPDATE transactions SET tx_hash = $1 WHERE id = $2',
                    [txHash, dbTransactionId]
                );
                console.log(`[WEB3 BRIDGE] Hash ${txHash} guardado para transacción #${dbTransactionId}`);
            }

            return txHash;

        } catch (error) {
            console.error(`[WEB3 BRIDGE] ❌ Error en sincronización de pago:`, error.message);
            throw error;
        }
    }

    // ========================================================================
    // FUNCIÓN 2: PAUSAR / REANUDAR PROTOCOLO (Emergencia)
    // ========================================================================

    /**
     * Pausa todas las operaciones financieras del protocolo on-chain.
     * Se llama cuando la gobernanza aprueba web3_protocol_paused = 'true'.
     * 
     * @returns {Promise<{success: boolean, txHash: string|null, error: string|null}>}
     */
    async pauseProtocol() {
        if (!this._isReady()) return { success: false, txHash: null, error: 'Relayer no configurado' };

        try {
            const protocol = this._getProtocol();

            // PREVENCIÓN DE REVERT: Verificar estado on-chain antes de gastar gas.
            // Si ya está pausado, Solidity revertirá con "Pausable: paused".
            // Verificamos primero para evitar el error y reportar éxito (idempotencia).
            const alreadyPaused = await protocol.paused();
            if (alreadyPaused) {
                console.log('[WEB3 BRIDGE] ℹ️  Protocolo ya estaba pausado. Sin acción necesaria.');
                return { success: true, txHash: null, error: null };
            }

            console.log('[WEB3 BRIDGE] 🛑 Pausando WintonProtocol...');
            const tx = await protocol.pause();
            const txHash = await this._waitForConfirmation(tx, 'pauseProtocol');
            return { success: true, txHash, error: null };
        } catch (error) {
            console.error('[WEB3 BRIDGE] ❌ Error al pausar protocolo:', error.message);
            return { success: false, txHash: null, error: error.message };
        }
    }

    /**
     * Reanuda las operaciones financieras del protocolo on-chain.
     * Se llama cuando la gobernanza aprueba web3_protocol_paused = 'false'.
     * 
     * @returns {Promise<{success: boolean, txHash: string|null, error: string|null}>}
     */
    async unpauseProtocol() {
        if (!this._isReady()) return { success: false, txHash: null, error: 'Relayer no configurado' };

        try {
            const protocol = this._getProtocol();

            // PREVENCIÓN DE REVERT: Verificar estado on-chain antes de gastar gas.
            // Si ya está activo, Solidity revertirá con "Pausable: not paused".
            const alreadyPaused = await protocol.paused();
            if (!alreadyPaused) {
                console.log('[WEB3 BRIDGE] ℹ️  Protocolo ya estaba activo. Sin acción necesaria.');
                return { success: true, txHash: null, error: null };
            }

            console.log('[WEB3 BRIDGE] ▶️  Reanudando WintonProtocol...');
            const tx = await protocol.unpause();
            const txHash = await this._waitForConfirmation(tx, 'unpauseProtocol');
            return { success: true, txHash, error: null };
        } catch (error) {
            console.error('[WEB3 BRIDGE] ❌ Error al reanudar protocolo:', error.message);
            return { success: false, txHash: null, error: error.message };
        }
    }

    // ========================================================================
    // VERIFICACIÓN KYC (Know Your Customer)
    // ========================================================================

    /**
     * Consulta directamente en la blockchain si una billetera tiene KYC aprobado.
     * Esta es la fuente de verdad absoluta (Single Source of Truth) para la plataforma.
     * 
     * @param {string} walletAddress La dirección de la billetera a verificar.
     * @returns {Promise<boolean>} true si tiene KYC, false de lo contrario.
     */
    async checkUserKYC(walletAddress) {
        if (!this._isReady() || !walletAddress) {
            console.warn(`[WEB3 BRIDGE] KYC Check Omitido: Relayer no listo o wallet indefinida (${walletAddress})`);
            return false;
        }

        try {
            const protocol = this._getProtocol();
            
            // TIMEOUT ENFORCER: No bloquear el servidor si el RPC está caído.
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error('RPC Timeout al verificar KYC')), 3000);
            });
            
            const isVerified = await Promise.race([
                protocol.isKYCVerified(walletAddress),
                timeoutPromise
            ]);

            clearTimeout(timeoutId);
            return isVerified;
            
        } catch (error) {
            console.error(`[WEB3 BRIDGE] ❌ Error verificando KYC on-chain para ${walletAddress}:`, error.message);
            // Por seguridad Fintech estricta (Fail-Safe), si no podemos verificar, asumimos falso para evitar blanqueo de capitales.
            return false;
        }
    }

    /**
     * Consulta el estado KYC on-chain con información detallada del resultado.
     * 
     * DIFERENCIA CON checkUserKYC():
     * - checkUserKYC() retorna solo `boolean` → no se puede distinguir entre
     *   "blockchain dijo false" y "blockchain no respondió".
     * - checkUserKYCDetailed() retorna `{ success, verified }` → el caller puede
     *   tomar decisiones informadas (sincronizar DB si blockchain respondió, o
     *   usar fallback si blockchain no respondió).
     * 
     * ESTÁNDAR: Este patrón (Result Object) es usado por Stripe, Coinbase y
     * servicios financieros que necesitan distinguir entre "dato real" y "fallo
     * de infraestructura" para mantener consistencia en sus cachés.
     * 
     * @param {string} walletAddress - La dirección de la billetera a verificar.
     * @returns {Promise<{ success: boolean, verified: boolean }>}
     *   - success=true, verified=true  → Blockchain respondió: usuario SÍ tiene KYC.
     *   - success=true, verified=false → Blockchain respondió: usuario NO tiene KYC.
     *   - success=false, verified=false → Blockchain no respondió (error/timeout).
     */
    async checkUserKYCDetailed(walletAddress) {
        // Validación de precondiciones: el Relayer debe estar configurado y
        // la dirección de wallet debe existir.
        if (!this._isReady() || !walletAddress) {
            console.warn(`[WEB3 BRIDGE] KYC Detailed Check Omitido: Relayer no listo o wallet indefinida (${walletAddress})`);
            // Retornamos success=false para indicar que NO pudimos consultar la blockchain.
            return { success: false, verified: false };
        }

        let timeoutId;
        try {
            // Obtener instancia del contrato WintonProtocol.
            const protocol = this._getProtocol();

            // TIMEOUT ENFORCER: Evitar que un nodo RPC caído bloquee al servidor.
            // 3 segundos es el estándar fintech para lecturas on-chain en L2.
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error('RPC Timeout al verificar KYC (detailed)')), 3000);
            });

            // Competir la llamada real contra el timeout.
            const isVerified = await Promise.race([
                protocol.isKYCVerified(walletAddress),
                timeoutPromise
            ]);

            // success=true porque la blockchain respondió exitosamente.
            // verified contiene la respuesta real del Smart Contract.
            return { success: true, verified: isVerified };

        } catch (error) {
            // La blockchain no respondió (timeout, nodo caído, contrato inválido, etc.).
            // Logueamos el error para trazabilidad pero NO lanzamos excepción.
            console.error(`[WEB3 BRIDGE] ❌ Error verificando KYC on-chain (detailed) para ${walletAddress}:`, error.message);
            // success=false: el caller debe usar fallback (caché DB).
            return { success: false, verified: false };
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }

    /**
     * Escribe el estado KYC de una billetera en el Smart Contract (on-chain).
     * Solo el Owner del contrato (Relayer) puede ejecutar esta función.
     * 
     * IMPORTANTE: Esta función SÍ gasta gas (es una escritura on-chain).
     * En testnet (Optimism Sepolia) el gas es gratis.
     * En mainnet, el costo es mínimo (~0.001 USD por transacción en Optimism).
     * 
     * @param {string} walletAddress La dirección de la billetera a verificar/desverificar.
     * @param {boolean} status true para aprobar KYC, false para revocar.
     * @returns {Promise<{success: boolean, txHash: string|null, error: string|null}>}
     */
    async setUserKYC(walletAddress, status) {
        // Validación de precondiciones: Relayer debe estar configurado.
        if (!this._isReady()) {
            return { success: false, txHash: null, error: 'Relayer no configurado' };
        }

        // Validación de integridad: wallet debe ser una dirección Ethereum válida.
        if (!walletAddress || !ethers.isAddress(walletAddress)) {
            return { success: false, txHash: null, error: `Dirección de wallet inválida: ${walletAddress}` };
        }

        // Validación de tipo: status debe ser explícitamente booleano.
        if (typeof status !== 'boolean') {
            return { success: false, txHash: null, error: 'El estado KYC debe ser true o false' };
        }

        try {
            const protocol = this._getProtocol();

            // PREVENCIÓN DE REVERT: Verificar estado actual on-chain antes de gastar gas.
            // Si el estado ya es el deseado, no ejecutamos la transacción (ahorra gas).
            const currentStatus = await protocol.isKYCVerified(walletAddress);
            if (currentStatus === status) {
                console.log(`[WEB3 BRIDGE] ℹ️  KYC de ${walletAddress} ya es ${status}. Sin acción necesaria.`);
                return { success: true, txHash: null, error: null };
            }

            // Ejecutar la transacción on-chain: setKYCStatus(address, bool).
            console.log(`[WEB3 BRIDGE] 🔐 ${status ? 'Aprobando' : 'Revocando'} KYC para ${walletAddress}...`);
            // Hardcoded gasLimit to bypass Ethers v6 estimateGas bug on OP Sepolia public RPC
            const tx = await protocol.setKYCStatus(walletAddress, status, { gasLimit: 100000 });

            // Esperar confirmación en la blockchain (1 bloque mínimo).
            const txHash = await this._waitForConfirmation(tx, 'setKYCStatus');

            console.log(`[WEB3 BRIDGE] ✅ KYC ${status ? 'aprobado' : 'revocado'} para ${walletAddress}. TX: ${txHash}`);
            return { success: true, txHash, error: null };

        } catch (error) {
            console.error(`[WEB3 BRIDGE] ❌ Error al ${status ? 'aprobar' : 'revocar'} KYC para ${walletAddress}:`, error.message);
            return { success: false, txHash: null, error: error.message };
        }
    }

    // ========================================================================
    // FUNCIÓN 3: AJUSTAR CIRCUIT BREAKER (maxTransactionAmount)
    // ========================================================================

    /**
     * Actualiza el límite máximo por transacción en el Smart Contract.
     * Se llama cuando la gobernanza aprueba un cambio en web3_max_transaction_amount.
     * 
     * @param {string|number} newAmount Nuevo límite máximo en BLUE (ej: "1000000").
     * @returns {Promise<{success: boolean, txHash: string|null, error: string|null}>}
     */
    async setMaxTransactionAmount(newAmount) {
        if (!this._isReady()) return { success: false, txHash: null, error: 'Relayer no configurado' };

        try {
            // SEGURIDAD: Validar que el valor sea un número positivo.
            const parsed = parseFloat(newAmount);
            if (isNaN(parsed) || parsed <= 0) {
                return { success: false, txHash: null, error: `Valor inválido para maxTransactionAmount: ${newAmount}. Debe ser un número positivo.` };
            }

            console.log(`[WEB3 BRIDGE] ⚡ Actualizando maxTransactionAmount a ${newAmount} BLUE...`);
            const protocol = this._getProtocol();
            // Convertir el monto a wei (18 decimales).
            const amountWei = ethers.parseEther(newAmount.toString());
            const tx = await protocol.setMaxTransactionAmount(amountWei);
            const txHash = await this._waitForConfirmation(tx, 'setMaxTransactionAmount');
            return { success: true, txHash, error: null };
        } catch (error) {
            console.error('[WEB3 BRIDGE] ❌ Error al actualizar maxTransactionAmount:', error.message);
            return { success: false, txHash: null, error: error.message };
        }
    }

    // ========================================================================
    // FUNCIÓN 4: CONFIGURAR BILLETERA FUNDADORA (Treasury)
    // ========================================================================

    /**
     * Configura la billetera de los fundadores en el contrato WintonTreasury.
     * Se llama cuando la gobernanza aprueba un cambio en web3_founders_wallet.
     * 
     * @param {string} walletAddress Dirección de la nueva billetera fundadora.
     * @returns {Promise<{success: boolean, txHash: string|null, error: string|null}>}
     */
    async setFoundersWallet(walletAddress) {
        if (!this._isReady()) return { success: false, txHash: null, error: 'Relayer no configurado' };

        try {
            // SEGURIDAD: Validar que sea una dirección Ethereum válida.
            if (!ethers.isAddress(walletAddress)) {
                return { success: false, txHash: null, error: `Dirección inválida: ${walletAddress}` };
            }

            console.log(`[WEB3 BRIDGE] 🏦 Configurando billetera fundadora: ${walletAddress}...`);
            const treasury = this._getTreasury();
            if (!treasury) return { success: false, txHash: null, error: 'Treasury no configurado' };

            const tx = await treasury.setFoundersWallet(walletAddress);
            const txHash = await this._waitForConfirmation(tx, 'setFoundersWallet');
            return { success: true, txHash, error: null };
        } catch (error) {
            console.error('[WEB3 BRIDGE] ❌ Error al configurar billetera fundadora:', error.message);
            return { success: false, txHash: null, error: error.message };
        }
    }

    // ========================================================================
    // FUNCIÓN 5: RETIRO DE EXCEDENTES (Treasury)
    // ========================================================================

    /**
     * Retira excedentes de ganancias del Treasury a la billetera fundadora.
     * Se llama cuando la gobernanza aprueba un retiro (web3_treasury_withdrawal).
     * 
     * @param {string|number} amount Cantidad de BLUE a retirar.
     * @returns {Promise<{success: boolean, txHash: string|null, error: string|null}>}
     */
    async withdrawSurplus(amount) {
        if (!this._isReady()) return { success: false, txHash: null, error: 'Relayer no configurado' };

        try {
            // SEGURIDAD: Validar que el monto sea un número positivo (no tiene sentido retirar 0).
            const parsed = parseFloat(amount);
            if (isNaN(parsed) || parsed <= 0) {
                return { success: false, txHash: null, error: `Monto inválido para retiro: ${amount}. Debe ser un número mayor a 0.` };
            }

            console.log(`[WEB3 BRIDGE] 💸 Retirando ${amount} BLUE del Treasury...`);
            const treasury = this._getTreasury();
            if (!treasury) return { success: false, txHash: null, error: 'Treasury no configurado' };

            // Convertir a wei (18 decimales).
            const amountWei = ethers.parseEther(amount.toString());
            const tx = await treasury.withdrawSurplus(amountWei);
            const txHash = await this._waitForConfirmation(tx, 'withdrawSurplus');
            return { success: true, txHash, error: null };
        } catch (error) {
            console.error('[WEB3 BRIDGE] ❌ Error al retirar excedentes del Treasury:', error.message);
            return { success: false, txHash: null, error: error.message };
        }
    }

    // ========================================================================
    // FUNCIONES DE LECTURA (Sin gas — gratuitas)
    // ========================================================================

    /**
     * Lee el estado actual del protocolo desde la blockchain.
     * Útil para mostrar en el panel de administración y verificar sincronización.
     * 
     * @returns {Promise<Object|null>} Estado del protocolo o null si falla.
     */
    async getProtocolStatus() {
        // SEGURIDAD: Verificar que la dirección del protocolo esté configurada.
        if (!PROTOCOL_ADDRESS) {
            console.error('[WEB3 BRIDGE] ❌ WINTON_PROTOCOL_ADDRESS no configurado. No se puede leer estado.');
            return null;
        }

        try {
            // Para lectura no necesitamos el wallet/Relayer, solo el proveedor.
            const protocol = new ethers.Contract(PROTOCOL_ADDRESS, this.protocolAbi, this.provider);

            // Ejecutar las 3 consultas en paralelo (optimización de latencia).
            const [isPaused, maxAmount, commission] = await Promise.all([
                protocol.paused(),
                protocol.maxTransactionAmount(),
                protocol.commissionRate(),
            ]);

            return {
                paused: isPaused,
                maxTransactionAmount: ethers.formatEther(maxAmount),
                commissionRate: commission.toString(),
            };
        } catch (error) {
            console.error('[WEB3 BRIDGE] ❌ Error al leer estado del protocolo:', error.message);
            return null;
        }
    }

    // ========================================================================
    // FUNCIÓN 7: VERIFICAR PAUSA CON CACHÉ (Web3 Enforcer)
    // ========================================================================

    /**
     * Verifica si el protocolo está pausado usando un caché de 30 segundos.
     * Evita bombardear el nodo RPC con consultas repetitivas en cada request.
     * Este es el "Circuit Breaker" del backend: si retorna true, NINGUNA
     * operación financiera real debe ejecutarse.
     * 
     * ESTÁNDAR: CeFi Híbrido (Coinbase/Binance) — caché local + verificación on-chain.
     * 
     * @returns {Promise<boolean>} true si pausado, false si activo, true por defecto si falla (fail-safe).
     */
    async isProtocolPaused() {
        // Si el bridge no está configurado, permitir operaciones (modo desarrollo).
        if (!PROTOCOL_ADDRESS || !RELAYER_PK) {
            console.warn('[WEB3 ENFORCER] Bridge no configurado. Operaciones permitidas por defecto.');
            return false;
        }

        const now = Date.now();
        // CACHÉ: Reutilizar resultado si tiene menos de 30 segundos (Estándar Fintech).
        if (this._pauseCache && (now - this._pauseCacheTimestamp) < 30000) {
            return this._pauseCache;
        }

        try {
            // Consulta directa al Smart Contract (lectura gratuita, sin gas).
            const protocol = new ethers.Contract(PROTOCOL_ADDRESS, this.protocolAbi, this.provider);
            
            // TIMEOUT ENFORCER: No permitir que la llamada RPC se quede colgada infinitamente.
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error('RPC Timeout: El nodo blockchain no respondió en 3 segundos.')), 3000);
            });
            
            // Competimos la llamada real contra el timeout
            const isPaused = await Promise.race([
                protocol.paused(),
                timeoutPromise
            ]);

            // Limpiar el timeout si la llamada a la blockchain fue exitosa antes de los 3 segundos
            clearTimeout(timeoutId);

            // Guardar en caché para evitar consultas repetitivas.
            this._pauseCache = isPaused;
            this._pauseCacheTimestamp = now;
            return isPaused;
        } catch (error) {
            // FAIL-SAFE: Si no podemos leer la blockchain, asumimos que está pausado
            // para proteger los fondos. Esto evita que un fallo de red permita
            // transacciones no autorizadas.
            console.error('[WEB3 ENFORCER] ❌ No se pudo verificar el estado on-chain. BLOQUEANDO por seguridad:', error.message);
            return true;
        }
    }

    // ========================================================================
    // FUNCIÓN 8: RESYNC DE BILLETERA (Espejo Blockchain → DB)
    // ========================================================================

    /**
     * Lee los saldos reales on-chain (BLUE balance y RED debt) de un usuario
     * y actualiza la tabla web3_wallets_sync en PostgreSQL.
     * 
     * ARQUITECTURA: La DB nunca calcula saldos. Solo copia lo que dice Optimism.
     * Esto garantiza que la "fuente de verdad" siempre sea la blockchain.
     * 
     * @param {string} walletAddress Dirección Ethereum del usuario.
     * @param {number} userId ID del usuario en PostgreSQL.
     * @returns {Promise<{blueBalance: string, redDebt: string}|null>} Saldos actualizados o null si falla.
     */
    async resyncUserWallet(walletAddress, userId) {
        // SEGURIDAD: No intentar resync sin configuración válida.
        if (!PROTOCOL_ADDRESS || !walletAddress) {
            console.warn('[WEB3 RESYNC] Dirección de protocolo o wallet no configurada. Resync omitido.');
            return null;
        }

        try {
            // ABI mínima para leer balances ERC-20 (lectura gratuita, sin gas).
            const erc20Abi = ["function balanceOf(address) view returns (uint256)"];

            // Obtener las direcciones de los contratos BlueToken y RedToken desde el protocolo.
            const protocol = new ethers.Contract(PROTOCOL_ADDRESS, [
                ...this.protocolAbi,
                "function blueToken() view returns (address)",
                "function redToken() view returns (address)"
            ], this.provider);

            // Consultar direcciones de los tokens en paralelo.
            const [blueAddr, redAddr] = await Promise.all([
                protocol.blueToken(),
                protocol.redToken()
            ]);

            // Crear instancias de lectura de los contratos de tokens.
            const blueContract = new ethers.Contract(blueAddr, erc20Abi, this.provider);
            const redContract = new ethers.Contract(redAddr, erc20Abi, this.provider);

            // Leer saldos reales on-chain en paralelo (optimización de latencia).
            const [blueRaw, redRaw] = await Promise.all([
                blueContract.balanceOf(walletAddress),
                redContract.balanceOf(walletAddress)
            ]);

            // Convertir de wei (18 decimales) a formato legible.
            const blueBalance = ethers.formatEther(blueRaw);
            const redDebt = ethers.formatEther(redRaw);

            // UPSERT: Crear o actualizar el registro en web3_wallets_sync.
            // ON CONFLICT asegura idempotencia (no duplicados).
            await pool.query(`
                INSERT INTO web3_wallets_sync (user_id, onchain_blue_balance, onchain_red_debt, last_synced_at, sync_status)
                VALUES ($1, $2, $3, NOW(), 'synced')
                ON CONFLICT (user_id) DO UPDATE SET
                    onchain_blue_balance = $2,
                    onchain_red_debt = $3,
                    last_synced_at = NOW(),
                    sync_status = 'synced'
            `, [userId, parseFloat(blueBalance), parseFloat(redDebt)]);

            console.log(`[WEB3 RESYNC] ✅ Wallet sincronizada para user #${userId}: ${blueBalance} BLUE, ${redDebt} RED`);
            return { blueBalance, redDebt };
        } catch (error) {
            console.error(`[WEB3 RESYNC] ❌ Error al resincronizar wallet del user #${userId}:`, error.message);
            // Marcar como error en la tabla para auditoría.
            try {
                await pool.query(`
                    INSERT INTO web3_wallets_sync (user_id, sync_status)
                    VALUES ($1, 'error')
                    ON CONFLICT (user_id) DO UPDATE SET sync_status = 'error'
                `, [userId]);
            } catch (dbErr) {
                console.error('[WEB3 RESYNC] Error al marcar sync_status:', dbErr.message);
            }
            return null;
        }
    }
}

module.exports = new Web3BridgeService();
