/**
 * src/services/web3BridgeService.js
 * Puente profesional para la sincronización de transacciones entre DB y Blockchain.
 * Implementa el estándar de 'Zero Hardcoded Secrets' y manejo de errores asíncronos.
 */

const { ethers } = require('ethers');
const pool = require('../config/db');

// Configuración cargada desde variables de entorno para máxima seguridad
const RPC_URL = process.env.OPTIMISM_RPC_URL || 'http://127.0.0.1:8545';
const RELAYER_PK = process.env.RELAYER_PRIVATE_KEY;
const PROTOCOL_ADDRESS = process.env.WINTON_PROTOCOL_ADDRESS;

class Web3BridgeService {
    constructor() {
        if (!RELAYER_PK || !PROTOCOL_ADDRESS) {
            console.warn('[WEB3 BRIDGE] Advertencia: RELAYER_PRIVATE_KEY o WINTON_PROTOCOL_ADDRESS no definidos.');
        }
        this.provider = new ethers.JsonRpcProvider(RPC_URL);
        this.wallet = RELAYER_PK ? new ethers.Wallet(RELAYER_PK, this.provider) : null;
        
        // ABI mínima necesaria para interactuar con el protocolo
        this.abi = [
            "function syncPayment(address payer, address payee, uint256 amountBlue, uint256 dbTxId) external",
            "event PaymentSynced(address indexed payer, address indexed payee, uint256 amount, uint256 dbTxId)"
        ];
    }

    /**
     * Sincroniza un pago BLUE realizado en la plataforma con el Smart Contract en la Blockchain.
     * @param {Object} params Datos de la transacción
     */
    async syncPaymentToBlockchain({ payerWalletAddress, payeeWalletAddress, amountBlue, dbTransactionId, payerUsername, payeeUsername }) {
        if (!this.wallet) {
            console.error('[WEB3 BRIDGE] Relayer no configurado. Saltando sincronización on-chain.');
            return;
        }

        try {
            console.log(`[WEB3 BRIDGE] Iniciando sincronización de pago: ${payerUsername} -> ${payeeUsername} (${amountBlue} BLUE)`);
            
            const protocolContract = new ethers.Contract(PROTOCOL_ADDRESS, this.abi, this.wallet);
            
            // Convertir monto a formato Blockchain (18 decimales estándar)
            const amountWei = ethers.parseEther(amountBlue.toString());

            // Ejecutar la transacción en el Smart Contract
            const tx = await protocolContract.syncPayment(
                payerWalletAddress,
                payeeWalletAddress,
                amountWei,
                dbTransactionId
            );

            console.log(`[WEB3 BRIDGE] Tx enviada: ${tx.hash}. Esperando confirmación...`);
            
            // Esperar 1 confirmación (estándar de seguridad para red local/L2)
            const receipt = await tx.wait(1);

            if (receipt.status === 1) {
                console.log(`[WEB3 BRIDGE] Sincronización EXITOSA. Tx: ${tx.hash}`);
                
                // GUARDAR EL HASH EN LA BASE DE DATOS
                if (dbTransactionId) {
                    await pool.query('UPDATE transactions SET tx_hash = $1 WHERE id = $2', [tx.hash, dbTransactionId]);
                    console.log(`[WEB3 BRIDGE] Hash ${tx.hash} guardado en la DB para la transacción ${dbTransactionId}`);
                }
            } else {
                throw new Error('Transacción fallida en la Blockchain (Reverted)');
            }

        } catch (error) {
            console.error(`[WEB3 BRIDGE] Error crítico de sincronización:`, error.message);
            // Aquí se podría implementar una cola de reintentos en una arquitectura más compleja
        }
    }
}

module.exports = new Web3BridgeService();
