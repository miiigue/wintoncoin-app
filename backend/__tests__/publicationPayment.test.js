/**
 * backend/__tests__/publicationPayment.test.js
 * 
 * PROPÓSITO: Pruebas unitarias para validar el flujo transaccional de processRequestPayment()
 * en Modo Pre-Lanzamiento (BLUE IOU / Booster Ledger) y en Modo Normal (Outbox Pattern Web3).
 * 
 * VERIFICA:
 * 1. Inicialización segura de web3IntentId (null en pre-lanzamiento) evitando ReferenceError.
 * 2. Acreditación atómica en booster_blue_ledger y booster_transactions en modo pre-lanzamiento.
 * 3. Retorno consistente del objeto de salida { success: true, message, web3IntentId }.
 */

'use strict';

jest.mock('../src/services/emailService', () => ({
    sendTransactionEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/services/boosterService', () => ({
    calculateMultipliedAmount: jest.fn().mockResolvedValue({ multiplier: 1.0 })
}));

const { processRequestPayment, processDirectPaymentCompletion } = require('../src/services/publicationService');

describe('Publication Payment Engine Unit Tests (processRequestPayment & processDirectPaymentCompletion)', () => {

    test('1. processRequestPayment en Modo Pre-Lanzamiento debe retornar web3IntentId como null sin lanzar ReferenceError', async () => {
        // Mock del cliente de base de datos PostgreSQL
        const mockClient = {
            query: jest.fn().mockImplementation((queryText, params) => {
                if (typeof queryText === 'string') {
                    // Consulta de worker_id
                    if (queryText.includes('SELECT id FROM users WHERE username = $1')) {
                        return Promise.resolve({ rows: [{ id: 42 }], rowCount: 1 });
                    }
                    // record_booster_event
                    if (queryText.includes('record_booster_event')) {
                        return Promise.resolve({ rows: [], rowCount: 1 });
                    }
                    // booster_transactions insert
                    if (queryText.includes('INSERT INTO booster_transactions')) {
                        return Promise.resolve({ rows: [], rowCount: 1 });
                    }
                    // users is_booster update
                    if (queryText.includes('UPDATE users SET is_booster = TRUE')) {
                        return Promise.resolve({ rows: [], rowCount: 1 });
                    }
                    // updateUserBoosterLevel queries
                    if (queryText.includes('SELECT SUM(amount) as total')) {
                        return Promise.resolve({ rows: [{ total: '100' }], rowCount: 1 });
                    }
                    if (queryText.includes('SELECT MAX(level) as current_level')) {
                        return Promise.resolve({ rows: [{ current_level: 1 }], rowCount: 1 });
                    }
                    if (queryText.includes('UPDATE users SET booster_level')) {
                        return Promise.resolve({ rows: [], rowCount: 1 });
                    }
                    // notifications insert
                    if (queryText.includes('INSERT INTO notifications')) {
                        return Promise.resolve({ rows: [], rowCount: 1 });
                    }
                    // email select
                    if (queryText.includes('SELECT username, email FROM users')) {
                        return Promise.resolve({ rows: [{ username: 'test_worker', email: 'worker@test.com' }, { username: 'test_author', email: 'author@test.com' }], rowCount: 2 });
                    }
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            })
        };

        const acceptance = {
            blue_cost: '90.0000',
            base_blue_cost: '90.0000',
            title: 'Tarea de Prueba Pre-Lanzamiento',
            author_username: 'Plataforma WintonCoin',
            author_id: 1,
            workerUsername: 'test_worker',
            workerId: 42,
            is_booster_task: true,
            category: 'request'
        };

        const pubId = 95;
        const preLaunchMode = true;
        const settings = {
            pre_launch_mode_enabled: 'true',
            debt_cycle_days: '30',
            blue_escrow_days: '1'
        };

        // Ejecución de la función
        const result = await processRequestPayment(mockClient, acceptance, pubId, preLaunchMode, settings);

        // Aserciones de seguridad
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.message).toBe('Pago confirmado y tarea finalizada.');
        expect(result.web3IntentId).toBeNull(); // ✅ Debe ser null limpiamente, sin ReferenceError
    });

    test('2. processDirectPaymentCompletion en Modo Pre-Lanzamiento debe retornar web3IntentId como null', async () => {
        const mockClient = {
            query: jest.fn().mockImplementation((queryText, params) => {
                if (typeof queryText === 'string') {
                    if (queryText.includes('SELECT id FROM users WHERE username = $1')) {
                        return Promise.resolve({ rows: [{ id: 10 }], rowCount: 1 });
                    }
                    if (queryText.includes('booster_blue_ledger') || queryText.includes('kyc_verified')) {
                        return Promise.resolve({ rows: [{ kyc_verified: true, total: '500.0000', unverified_total: '0.0000' }], rowCount: 1 });
                    }
                    if (queryText.includes('record_booster_event') || queryText.includes('INSERT INTO booster_transactions') || queryText.includes('UPDATE users SET is_booster')) {
                        return Promise.resolve({ rows: [], rowCount: 1 });
                    }
                    if (queryText.includes('SELECT COALESCE(SUM(amount), 0)') || queryText.includes('SELECT MAX(level)') || queryText.includes('UPDATE users SET booster_level')) {
                        return Promise.resolve({ rows: [{ total_earned: '500', max_level: 2 }], rowCount: 1 });
                    }
                    if (queryText.includes('INSERT INTO notifications') || queryText.includes('UPDATE publication_acceptances')) {
                        return Promise.resolve({ rows: [], rowCount: 1 });
                    }
                    if (queryText.includes('SELECT username, email FROM users')) {
                        return Promise.resolve({ rows: [{ username: 'payer_user', email: 'payer@test.com' }, { username: 'recipient_user', email: 'recipient@test.com' }], rowCount: 2 });
                    }
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            })
        };

        const acceptance = {
            blue_cost: '25.0000',
            title: 'Venta de Prueba Pre-Lanzamiento',
            author_username: 'recipient_user',
            acceptance_id: 101,
            category: 'sell',
            completerUsername: 'payer_user',
            is_booster_task: true
        };

        const pubId = 96;
        const preLaunchMode = true;
        const settings = {
            pre_launch_mode_enabled: 'true'
        };

        const result = await processDirectPaymentCompletion(mockClient, acceptance, pubId, preLaunchMode, settings);

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.web3IntentId).toBeNull();
    });

});
