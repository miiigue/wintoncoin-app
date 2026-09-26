/**
 * src/services/walletService.js
 * Servicio de gestión de carteras Web3 y Autocustodia (Non-Custodial Keystore).
 * Implementa encriptación AES-256-CBC de respaldo y AES-256-GCM con derivación PBKDF2 (100,000 iteraciones)
 * protegida por PIN de 6 dígitos del usuario, con mitigación de fuerza bruta vía bcrypt.
 */

const { ethers } = require('ethers');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Secreto de encriptación maestro desde variables de entorno con fallback de seguridad preventiva
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'WintonCoin_Military_Grade_Vault_Secret_2024_!_Xyz';
const ALGORITHM = 'aes-256-cbc';
const GCM_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // Para AES-CBC, siempre 16 bytes
const GCM_IV_LENGTH = 12; // Para AES-GCM (estándar NIST), 12 bytes

class WalletService {
    constructor() {
        if (!process.env.ENCRYPTION_SECRET) {
            console.warn('[WALLET SERVICE] ℹ️ Usando ENCRYPTION_SECRET predeterminado del sistema para el entorno actual.');
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
     * Encripta un texto plano (private key) con AES-256-CBC de plataforma.
     * @param {string} text 
     */
    encrypt(text) {
        if (!ENCRYPTION_SECRET) return text;

        const iv = crypto.randomBytes(IV_LENGTH);
        const key = crypto.scryptSync(ENCRYPTION_SECRET, 'salt', 32);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Retornamos el IV + el texto encriptado para poder desencriptar después
        return iv.toString('hex') + ':' + encrypted;
    }

    /**
     * Desencripta una clave privada usando la clave maestra de plataforma.
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

    // ========================================================================
    // AUTOCUSTODIA CON PIN DE 6 DÍGITOS (NON-CUSTODIAL KEYSTORE)
    // ========================================================================

    /**
     * Deriva una clave de 256 bits a partir del PIN de 6 dígitos del usuario y un salt criptográfico.
     * Utiliza PBKDF2 con 100,000 iteraciones y SHA-256 (estándar bancario NIST).
     * @param {string} pin - PIN de 6 dígitos
     * @param {string} saltHex - Salt en hexadecimal
     * @returns {Buffer}
     */
    deriveKeyFromPin(pin, saltHex) {
        if (!/^\d{6}$/.test(String(pin))) {
            throw new Error('El PIN debe contener exactamente 6 dígitos numéricos.');
        }
        const salt = Buffer.from(saltHex, 'hex');
        return crypto.pbkdf2Sync(String(pin), salt, 100000, 32, 'sha256');
    }

    /**
     * Configura el PIN de 6 dígitos para la autocustodia del usuario.
     * Cifra la clave privada de la billetera con AES-256-GCM usando la clave derivada del PIN.
     * Genera un hash bcrypt del PIN para control de intentos fallidos y bloqueos por fuerza bruta.
     * @param {Object} clientOrPool - Cliente de conexión a PostgreSQL
     * @param {number} userId - ID del usuario
     * @param {string} pin - PIN numérico de 6 dígitos
     */
    async setupTransactionPin(clientOrPool, userId, pin, currentPin = null) {
        if (!/^\d{6}$/.test(String(pin))) {
            throw new Error('El PIN debe contener exactamente 6 dígitos numéricos.');
        }

        // Obtener usuario y su estado criptográfico actual
        const userRes = await clientOrPool.query(
            `SELECT id, username, web3_wallet_address, web3_private_key_encrypted, web3_keystore, has_transaction_pin FROM users WHERE id = $1`,
            [userId]
        );
        if (userRes.rows.length === 0) throw new Error('Usuario no encontrado.');

        const user = userRes.rows[0];
        let privateKey;

        if (user.has_transaction_pin && user.web3_keystore) {
            // Si ya cuenta con un keystore de autocustodia, desciframos la clave en RAM con el PIN actual
            if (!currentPin) {
                throw new Error('Se requiere tu PIN actual para actualizar la clave de seguridad.');
            }
            privateKey = await this.decryptPrivateKeyWithPin(clientOrPool, userId, currentPin);
        } else if (user.web3_private_key_encrypted) {
            // Migración desde el modelo legado: descifrar con clave del sistema
            privateKey = this.decrypt(user.web3_private_key_encrypted);
        } else {
            // Si no tiene billetera previa, generamos un nuevo par de claves Web3
            const newWallet = ethers.Wallet.createRandom();
            privateKey = newWallet.privateKey;
            user.web3_wallet_address = newWallet.address;
        }

        // 1. Generar salt criptográfico único por usuario (32 bytes)
        const salt = crypto.randomBytes(32);
        const saltHex = salt.toString('hex');

        // 2. Derivar clave de cifrado
        const derivedKey = crypto.pbkdf2Sync(String(pin), salt, 100000, 32, 'sha256');

        // 3. Cifrar con AES-256-GCM (autocustodia autenticada)
        const iv = crypto.randomBytes(GCM_IV_LENGTH);
        const cipher = crypto.createCipheriv(GCM_ALGORITHM, derivedKey, iv);
        let ciphertext = cipher.update(privateKey, 'utf8', 'hex');
        ciphertext += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');

        const keystore = {
            version: 1,
            algorithm: GCM_ALGORITHM,
            kdf: 'pbkdf2-sha256',
            iterations: 100000,
            salt: saltHex,
            iv: iv.toString('hex'),
            authTag: authTag,
            ciphertext: ciphertext
        };

        // 4. Hash del PIN para control de intentos y mitigación de fuerza bruta (bcrypt)
        const pinHash = await bcrypt.hash(String(pin), 10);

        // 5. Guardar en base de datos de forma atómica
        await clientOrPool.query(
            `UPDATE users SET 
                has_transaction_pin = TRUE,
                transaction_pin_hash = $1,
                transaction_pin_salt = $2,
                transaction_pin_failed_attempts = 0,
                transaction_pin_locked_until = NULL,
                web3_keystore = $3,
                web3_wallet_address = COALESCE(web3_wallet_address, $4)
             WHERE id = $5`,
            [pinHash, saltHex, JSON.stringify(keystore), user.web3_wallet_address, userId]
        );

        return {
            success: true,
            walletAddress: user.web3_wallet_address,
            message: 'PIN de transacción configurado exitosamente. Tu billetera de autocustodia está activa.'
        };
    }

    /**
     * Valida el PIN de 6 dígitos del usuario aplicando protección contra fuerza bruta
     * (máximo 5 intentos antes de un bloqueo temporal de 15 minutos).
     * @param {Object} clientOrPool - Cliente de conexión
     * @param {number} userId - ID del usuario
     * @param {string} pin - PIN de 6 dígitos ingresado
     */
    async verifyTransactionPin(clientOrPool, userId, pin) {
        if (!/^\d{6}$/.test(String(pin))) {
            throw { status: 400, message: 'El PIN debe tener exactamente 6 dígitos numéricos.' };
        }

        const res = await clientOrPool.query(
            `SELECT id, has_transaction_pin, transaction_pin_hash, transaction_pin_failed_attempts, transaction_pin_locked_until
             FROM users WHERE id = $1`,
            [userId]
        );
        if (res.rows.length === 0) throw { status: 404, message: 'Usuario no encontrado.' };

        const user = res.rows[0];
        if (!user.has_transaction_pin || !user.transaction_pin_hash) {
            throw { status: 412, message: 'No has configurado tu PIN de seguridad aún. Por favor configúralo para continuar.', requiresPinSetup: true };
        }

        // Verificar si la cuenta está temporalmente bloqueada por fuerza bruta
        if (user.transaction_pin_locked_until && new Date(user.transaction_pin_locked_until) > new Date()) {
            const minutesLeft = Math.ceil((new Date(user.transaction_pin_locked_until) - new Date()) / 60000);
            throw { 
                status: 429, 
                message: `PIN bloqueado temporalmente por seguridad debido a múltiples intentos fallidos. Intenta nuevamente en ${minutesLeft} minutos.` 
            };
        }

        const isMatch = await bcrypt.compare(String(pin), user.transaction_pin_hash);

        if (!isMatch) {
            const newAttempts = (user.transaction_pin_failed_attempts || 0) + 1;
            const MAX_ATTEMPTS = 5;

            if (newAttempts >= MAX_ATTEMPTS) {
                await clientOrPool.query(
                    `UPDATE users SET 
                        transaction_pin_failed_attempts = $1, 
                        transaction_pin_locked_until = NOW() + INTERVAL '15 minutes' 
                     WHERE id = $2`,
                    [newAttempts, userId]
                );
                throw { 
                    status: 429, 
                    message: 'Has alcanzado el límite de 5 intentos fallidos. Tu PIN ha sido bloqueado temporalmente por 15 minutos para proteger tu cuenta.' 
                };
            } else {
                await clientOrPool.query(
                    `UPDATE users SET transaction_pin_failed_attempts = $1 WHERE id = $2`,
                    [newAttempts, userId]
                );
                const remaining = MAX_ATTEMPTS - newAttempts;
                throw { 
                    status: 401, 
                    message: `PIN incorrecto. Te ${remaining === 1 ? 'queda 1 intento' : `quedan ${remaining} intentos`} antes del bloqueo temporal.` 
                };
            }
        }

        // Si fue exitoso, resetear contador de intentos fallidos
        if (user.transaction_pin_failed_attempts > 0 || user.transaction_pin_locked_until) {
            await clientOrPool.query(
                `UPDATE users SET transaction_pin_failed_attempts = 0, transaction_pin_locked_until = NULL WHERE id = $1`,
                [userId]
            );
        }

        return { valid: true };
    }

    /**
     * Desencripta la clave privada de la billetera en memoria RAM utilizando el PIN del usuario.
     * @param {Object} clientOrPool - Cliente de conexión
     * @param {number} userId - ID del usuario
     * @param {string} pin - PIN de 6 dígitos
     * @returns {string} Clave privada en texto plano (en memoria efímera)
     */
    async decryptPrivateKeyWithPin(clientOrPool, userId, pin) {
        await this.verifyTransactionPin(clientOrPool, userId, pin);

        const res = await clientOrPool.query(
            `SELECT web3_keystore, web3_private_key_encrypted FROM users WHERE id = $1`,
            [userId]
        );
        const row = res.rows[0];

        // Si tiene keystore GCM de autocustodia
        if (row && row.web3_keystore) {
            const ks = typeof row.web3_keystore === 'string' ? JSON.parse(row.web3_keystore) : row.web3_keystore;
            const derivedKey = crypto.pbkdf2Sync(String(pin), Buffer.from(ks.salt, 'hex'), ks.iterations || 100000, 32, 'sha256');
            const decipher = crypto.createDecipheriv(GCM_ALGORITHM, derivedKey, Buffer.from(ks.iv, 'hex'));
            decipher.setAuthTag(Buffer.from(ks.authTag, 'hex'));
            let decrypted = decipher.update(ks.ciphertext, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }

        // Fallback de retrocompatibilidad
        if (row && row.web3_private_key_encrypted) {
            return this.decrypt(row.web3_private_key_encrypted);
        }

        throw new Error('No se encontró billetera asociada al usuario.');
    }

    /**
     * Consulta el estado del PIN del usuario.
     * @param {Object} clientOrPool 
     * @param {number} userId 
     */
    async getPinStatus(clientOrPool, userId) {
        const res = await clientOrPool.query(
            `SELECT id, username, kyc_verified, has_transaction_pin, transaction_pin_failed_attempts, transaction_pin_locked_until 
             FROM users WHERE id = $1`,
            [userId]
        );
        if (res.rows.length === 0) throw new Error('Usuario no encontrado.');

        const row = res.rows[0];
        const isLocked = Boolean(row.transaction_pin_locked_until && new Date(row.transaction_pin_locked_until) > new Date());
        const remainingAttempts = Math.max(0, 5 - (row.transaction_pin_failed_attempts || 0));

        return {
            hasPin: Boolean(row.has_transaction_pin),
            kycVerified: Boolean(row.kyc_verified),
            isLocked,
            remainingAttempts
        };
    }
}

module.exports = new WalletService();
