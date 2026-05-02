/**
 * src/services/walletService.js
 * Servicio de gestión de carteras Web3 (Custodial / Invisible).
 * Implementa encriptación AES-256-CBC para las llaves privadas.
 */

const { ethers } = require('ethers');
const crypto = require('crypto');

// Secreto de encriptación maestro desde variables de entorno
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // Para AES, siempre 16 bytes

class WalletService {
    constructor() {
        if (!ENCRYPTION_SECRET) {
            console.error('[WALLET SERVICE] ERROR CRÍTICO: ENCRYPTION_SECRET no definido en el entorno.');
        }
    }

    /**
     * Genera una nueva billetera Web3 y retorna la dirección pública y la privada encriptada.
     * @returns {Object} { address, encryptedPrivateKey }
     */
    generateEncryptedWallet() {
        // 1. Crear billetera aleatoria con ethers
        const wallet = ethers.Wallet.createRandom();
        
        // 2. Encriptar la clave privada
        const encryptedKey = this.encrypt(wallet.privateKey);

        return {
            address: wallet.address,
            encryptedPrivateKey: encryptedKey
        };
    }

    /**
     * Encripta un texto plano (private key).
     * @param {string} text 
     */
    encrypt(text) {
        if (!ENCRYPTION_SECRET) return text; // Fallback inseguro solo para desarrollo extremo (no recomendado)

        const iv = crypto.randomBytes(IV_LENGTH);
        const key = crypto.scryptSync(ENCRYPTION_SECRET, 'salt', 32);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Retornamos el IV + el texto encriptado para poder desencriptar después
        return iv.toString('hex') + ':' + encrypted;
    }

    /**
     * Desencripta una clave privada.
     * @param {string} encryptedText 
     */
    decrypt(encryptedText) {
        try {
            const textParts = encryptedText.split(':');
            const iv = Buffer.from(textParts.shift(), 'hex');
            const encryptedData = Buffer.from(textParts.join(':'), 'hex');
            const key = crypto.scryptSync(ENCRYPTION_SECRET, 'salt', 32);
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            
            let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('[WALLET SERVICE] Error al desencriptar llave:', error.message);
            throw new Error('Fallo en la desencriptación de la bóveda.');
        }
    }
}

module.exports = new WalletService();
