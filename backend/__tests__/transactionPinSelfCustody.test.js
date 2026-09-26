/**
 * backend/__tests__/transactionPinSelfCustody.test.js
 * 
 * PRUEBAS UNITARIAS: Protocolo de Autocustodia con PIN de 6 Dígitos
 * 
 * Verifica los estándares FinTech y de Ciberseguridad bancaria:
 * 1. Cifrado AES-256-GCM con salt aleatorio y derivación PBKDF2 (100.000 iteraciones).
 * 2. Hash irreversible bcrypt para verificación rápida de PIN.
 * 3. Protección contra ataques de fuerza bruta (bloqueo exponencial de 15 min tras 5 intentos fallidos).
 * 4. Descifrado seguro de clave privada en memoria RAM efímera (Zero Hardcoded Secrets).
 */

'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const walletService = require('../src/services/walletService');

describe('Self-Custody Transaction PIN & Keystore Security Tests', () => {

    test('1. setupTransactionPin debe cifrar la clave privada en formato web3_keystore y guardar hash bcrypt', async () => {
        const testPrivateKey = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f36088a';
        const legacyEncryptedKey = walletService.encrypt(testPrivateKey);
        const testPin = '839201';

        let capturedUpdateQuery = null;
        let capturedUpdateParams = null;

        const mockClient = {
            query: jest.fn().mockImplementation((queryText, params) => {
                if (queryText.includes('FROM users WHERE id = $1') && queryText.includes('web3_private_key_encrypted')) {
                    return Promise.resolve({
                        rowCount: 1,
                        rows: [{
                            id: 99,
                            username: 'test_user',
                            web3_wallet_address: '0x1234567890123456789012345678901234567890',
                            web3_private_key_encrypted: legacyEncryptedKey
                        }]
                    });
                }
                if (queryText.includes('UPDATE users SET')) {
                    capturedUpdateQuery = queryText;
                    capturedUpdateParams = params;
                    return Promise.resolve({ rowCount: 1, rows: [] });
                }
                return Promise.resolve({ rowCount: 0, rows: [] });
            })
        };

        const result = await walletService.setupTransactionPin(mockClient, 99, testPin);

        expect(result.success).toBe(true);
        expect(capturedUpdateQuery).toContain('has_transaction_pin = TRUE');
        expect(capturedUpdateParams).toBeDefined();

        // params: [pinHash, saltHex, keystoreJson, walletAddress, userId]
        const [pinHash, saltHex, keystoreJson, walletAddress, userId] = capturedUpdateParams;
        expect(userId).toBe(99);
        expect(typeof saltHex).toBe('string');
        expect(saltHex.length).toBe(64); // 32 bytes hex = 64 chars

        // Validar hash bcrypt
        const isBcryptMatch = await bcrypt.compare(testPin, pinHash);
        expect(isBcryptMatch).toBe(true);

        // Validar estructura del keystore
        const keystore = JSON.parse(keystoreJson);
        expect(keystore.version).toBe(1);
        expect(keystore.algorithm).toBe('aes-256-gcm');
        expect(keystore.kdf).toBe('pbkdf2-sha256');
        expect(keystore.iterations).toBe(100000);
        expect(keystore.ciphertext).toBeDefined();
        expect(keystore.authTag).toBeDefined();
    });

    test('2. verifyTransactionPin debe validar correctamente un PIN válido y resetear intentos', async () => {
        const testPin = '654987';
        const salt = crypto.randomBytes(10).toString('hex');
        const hash = await bcrypt.hash(testPin, 10);

        let resetCalled = false;
        const mockClient = {
            query: jest.fn().mockImplementation((queryText, params) => {
                if (queryText.includes('FROM users WHERE id = $1') && queryText.includes('transaction_pin_hash')) {
                    return Promise.resolve({
                        rowCount: 1,
                        rows: [{
                            id: 99,
                            has_transaction_pin: true,
                            transaction_pin_hash: hash,
                            transaction_pin_failed_attempts: 2,
                            transaction_pin_locked_until: null
                        }]
                    });
                }
                if (queryText.includes('transaction_pin_failed_attempts = 0')) {
                    resetCalled = true;
                    return Promise.resolve({ rowCount: 1, rows: [] });
                }
                return Promise.resolve({ rowCount: 0, rows: [] });
            })
        };

        const verification = await walletService.verifyTransactionPin(mockClient, 99, testPin);
        expect(verification.valid).toBe(true);
        expect(resetCalled).toBe(true);
    });

    test('3. verifyTransactionPin debe bloquear la cuenta tras 5 intentos fallidos', async () => {
        const testPin = '654987';
        const wrongPin = '111222';
        const hash = await bcrypt.hash(testPin, 10);

        let capturedLockoutQuery = null;
        const mockClient = {
            query: jest.fn().mockImplementation((queryText, params) => {
                if (queryText.includes('FROM users WHERE id = $1') && queryText.includes('transaction_pin_hash')) {
                    return Promise.resolve({
                        rowCount: 1,
                        rows: [{
                            id: 99,
                            has_transaction_pin: true,
                            transaction_pin_hash: hash,
                            transaction_pin_failed_attempts: 4, // Intento 5 causará bloqueo
                            transaction_pin_locked_until: null
                        }]
                    });
                }
                if (queryText.includes('UPDATE users SET') && queryText.includes('transaction_pin_failed_attempts')) {
                    capturedLockoutQuery = queryText;
                    return Promise.resolve({ rowCount: 1, rows: [] });
                }
                return Promise.resolve({ rowCount: 0, rows: [] });
            })
        };

        try {
            await walletService.verifyTransactionPin(mockClient, 99, wrongPin);
            throw new Error('Debería haber lanzado excepción de bloqueo');
        } catch (err) {
            expect(err.status).toBe(429);
            expect(err.message).toContain('bloqueado temporalmente por 15 minutos');
            expect(capturedLockoutQuery).toContain("NOW() + INTERVAL '15 minutes'");
        }
    });

    test('4. decryptPrivateKeyWithPin debe recuperar la clave privada original en memoria RAM', async () => {
        const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        const legacyEncryptedKey = walletService.encrypt(testPrivateKey);
        const testPin = '928471';

        let savedKeystore = null;
        let savedSalt = null;
        let savedHash = null;

        // Mock para setup
        const setupClient = {
            query: jest.fn().mockImplementation((queryText, params) => {
                if (queryText.includes('FROM users WHERE id = $1') && queryText.includes('web3_private_key_encrypted')) {
                    return Promise.resolve({
                        rowCount: 1,
                        rows: [{
                            id: 1,
                            username: 'test_user',
                            web3_wallet_address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
                            web3_private_key_encrypted: legacyEncryptedKey
                        }]
                    });
                }
                if (queryText.includes('UPDATE users SET')) {
                    savedHash = params[0];
                    savedSalt = params[1];
                    savedKeystore = JSON.parse(params[2]);
                    return Promise.resolve({ rowCount: 1, rows: [] });
                }
                return Promise.resolve({ rowCount: 0, rows: [] });
            })
        };

        await walletService.setupTransactionPin(setupClient, 1, testPin);

        // Mock para decryptPrivateKeyWithPin
        const decryptClient = {
            query: jest.fn().mockImplementation((queryText, params) => {
                if (queryText.includes('FROM users WHERE id = $1') && queryText.includes('transaction_pin_hash')) {
                    return Promise.resolve({
                        rowCount: 1,
                        rows: [{
                            id: 1,
                            has_transaction_pin: true,
                            transaction_pin_hash: savedHash,
                            transaction_pin_failed_attempts: 0,
                            transaction_pin_locked_until: null
                        }]
                    });
                }
                if (queryText.includes('SELECT web3_keystore') || queryText.includes('transaction_pin_salt')) {
                    return Promise.resolve({
                        rowCount: 1,
                        rows: [{
                            web3_keystore: savedKeystore,
                            transaction_pin_salt: savedSalt
                        }]
                    });
                }
                if (queryText.includes('transaction_pin_failed_attempts = 0')) {
                    return Promise.resolve({ rowCount: 1, rows: [] });
                }
                return Promise.resolve({ rowCount: 0, rows: [] });
            })
        };

        const decryptedKey = await walletService.decryptPrivateKeyWithPin(decryptClient, 1, testPin);
        expect(decryptedKey).toBe(testPrivateKey);
    });

    test('5. setupTransactionPin con currentPin debe actualizar el PIN preservando la misma clave privada', async () => {
        const originalPrivateKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        const legacyEncryptedKey = walletService.encrypt(originalPrivateKey);
        const oldPin = '123789';
        const newPin = '987321';

        let currentKeystore = null;
        let currentSalt = null;
        let currentHash = null;

        // 1. Configuración inicial con oldPin
        const initialClient = {
            query: jest.fn().mockImplementation((queryText, params) => {
                if (queryText.includes('FROM users WHERE id = $1') && queryText.includes('web3_private_key_encrypted')) {
                    return Promise.resolve({
                        rowCount: 1,
                        rows: [{
                            id: 7,
                            username: 'test_user',
                            web3_wallet_address: '0xabc1230000000000000000000000000000000000',
                            web3_private_key_encrypted: legacyEncryptedKey,
                            has_transaction_pin: false
                        }]
                    });
                }
                if (queryText.includes('UPDATE users SET')) {
                    currentHash = params[0];
                    currentSalt = params[1];
                    currentKeystore = JSON.parse(params[2]);
                    return Promise.resolve({ rowCount: 1, rows: [] });
                }
                return Promise.resolve({ rowCount: 0, rows: [] });
            })
        };
        await walletService.setupTransactionPin(initialClient, 7, oldPin);

        // 2. Cambio de PIN hacia newPin suministrando oldPin
        const updateClient = {
            query: jest.fn().mockImplementation((queryText, params) => {
                if (queryText.includes('FROM users WHERE id = $1') && queryText.includes('transaction_pin_hash')) {
                    return Promise.resolve({
                        rowCount: 1,
                        rows: [{
                            id: 7,
                            has_transaction_pin: true,
                            transaction_pin_hash: currentHash,
                            transaction_pin_failed_attempts: 0,
                            transaction_pin_locked_until: null
                        }]
                    });
                }
                if (queryText.includes('FROM users WHERE id = $1') && queryText.includes('web3_keystore')) {
                    return Promise.resolve({
                        rowCount: 1,
                        rows: [{
                            id: 7,
                            username: 'test_user',
                            web3_wallet_address: '0xabc1230000000000000000000000000000000000',
                            web3_keystore: currentKeystore,
                            transaction_pin_salt: currentSalt,
                            has_transaction_pin: true
                        }]
                    });
                }
                if (queryText.includes('UPDATE users SET')) {
                    currentHash = params[0];
                    currentSalt = params[1];
                    currentKeystore = JSON.parse(params[2]);
                    return Promise.resolve({ rowCount: 1, rows: [] });
                }
                return Promise.resolve({ rowCount: 0, rows: [] });
            })
        };

        const updateResult = await walletService.setupTransactionPin(updateClient, 7, newPin, oldPin);
        expect(updateResult.success).toBe(true);

        // 3. Verificar que el nuevo PIN descifra exactamente la clave privada original
        const decryptedWithNewPin = await walletService.decryptPrivateKeyWithPin(updateClient, 7, newPin);
        expect(decryptedWithNewPin).toBe(originalPrivateKey);
    });
});
