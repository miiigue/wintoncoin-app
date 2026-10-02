'use strict';

/**
 * backend/__tests__/creditPolicyJobs.test.js
 * 
 * Suite de Pruebas Unitarias para el Motor de Políticas y Reintentos Exponenciales (Migración 119)
 * Estándar FinTech & Auditoría SOC 2:
 * 1. Retroceso exponencial con jitter (Exponential Backoff)
 * 2. Transición a Dead Letter Queue (DLQ / status 'dead_letter') tras agotar max_retries
 * 3. Recuperación manual por administrador con reset de intentos (retryIssue)
 * 4. Integridad transaccional y rollback safety en savePolicy
 */

const { recordIssue, retryIssue, savePolicy } = require('../src/services/creditPolicyJobs');

describe('Motor de Reintentos Exponenciales y DLQ (Migración 119)', () => {
    test('1. recordIssue registra primer fallo con status "open" y retroceso base de ~15 segundos', async () => {
        let insertedValues = null;
        const mockClient = {
            query: jest.fn(async (sql, params) => {
                if (sql.includes('SELECT retry_count, max_retries FROM credit_policy_issues')) {
                    return { rows: [] }; // No existía previo
                }
                if (sql.includes('INSERT INTO credit_policy_issues')) {
                    insertedValues = params;
                    return { rowCount: 1 };
                }
                return { rows: [] };
            })
        };

        await recordIssue(mockClient, 1, 101, null, 'RPC_TIMEOUT', 'Optimism Sepolia no respondió');

        // params: [version, user, operation, reason, status, currentCount, delaySeconds, maxRetries, last_error]
        expect(insertedValues).toBeDefined();
        expect(insertedValues[0]).toBe(1); // version_id
        expect(insertedValues[1]).toBe(101); // user_id
        expect(insertedValues[4]).toBe('open'); // status: open
        expect(insertedValues[5]).toBe(1); // retry_count: 1
        expect(insertedValues[6]).toBeGreaterThanOrEqual(15); // delaySeconds >= 15s
        expect(insertedValues[6]).toBeLessThan(25); // 15 + jitter
        expect(insertedValues[7]).toBe(5); // max_retries por defecto: 5
    });

    test('2. recordIssue escala exponencialmente el tiempo de espera en el intento 3', async () => {
        let insertedValues = null;
        const mockClient = {
            query: jest.fn(async (sql, params) => {
                if (sql.includes('SELECT retry_count, max_retries FROM credit_policy_issues')) {
                    return { rows: [{ retry_count: 2, max_retries: 5 }] }; // Ya van 2 intentos
                }
                if (sql.includes('INSERT INTO credit_policy_issues')) {
                    insertedValues = params;
                    return { rowCount: 1 };
                }
                return { rows: [] };
            })
        };

        await recordIssue(mockClient, 1, 102, null, 'RPC_RATE_LIMIT', 'Too many requests');

        expect(insertedValues[5]).toBe(3); // currentCount: 3
        expect(insertedValues[4]).toBe('open'); // aún no agota 5
        // delay para intento 3: 2^(3-1) * 15 = 4 * 15 = 60s (+ jitter 0-4s)
        expect(insertedValues[6]).toBeGreaterThanOrEqual(60);
        expect(insertedValues[6]).toBeLessThanOrEqual(65);
    });

    test('3. recordIssue transiciona a "dead_letter" cuando se alcanza el límite máximo de reintentos (max_retries = 5)', async () => {
        let insertedValues = null;
        const mockClient = {
            query: jest.fn(async (sql, params) => {
                if (sql.includes('SELECT retry_count, max_retries FROM credit_policy_issues')) {
                    return { rows: [{ retry_count: 4, max_retries: 5 }] }; // Ya van 4 intentos
                }
                if (sql.includes('INSERT INTO credit_policy_issues')) {
                    insertedValues = params;
                    return { rowCount: 1 };
                }
                return { rows: [] };
            })
        };

        await recordIssue(mockClient, 1, 103, null, 'INVALID_CHAIN_STATE', 'Permanent failure');

        // Intento 5: se agotan los reintentos
        expect(insertedValues[5]).toBe(5); // currentCount: 5
        expect(insertedValues[4]).toBe('dead_letter'); // DLQ activada
    });

    test('4. retryIssue restablece la incidencia desde DLQ a "open" con contador en 0 y ejecución inmediata', async () => {
        const mockClient = {
            query: jest.fn(async (sql, params) => {
                if (sql.includes('pg_try_advisory_lock')) {
                    return { rows: [{ acquired: true }] };
                }
                if (sql.includes('SELECT id FROM credit_policy_versions')) {
                    return { rows: [{ id: 1 }] }; // Versión vigente coincide
                }
                if (sql.includes('UPDATE credit_policy_issues')) {
                    return { rowCount: 1, rows: [{ user_id: 103 }] };
                }
                return { rows: [] };
            }),
            release: jest.fn()
        };
        const mockPool = {
            connect: jest.fn(async () => mockClient)
        };

        const result = await retryIssue(mockPool, 1, 103);
        expect(result.success).toBe(true);
        expect(result.message).toContain('No se repetirá una transacción pendiente');
        expect(mockClient.release).toHaveBeenCalled();
    });

    test('5. savePolicy ejecuta ROLLBACK seguro si falla la inserción de versión de política', async () => {
        let rollbackCalled = false;
        const mockClient = {
            query: jest.fn(async (sql) => {
                if (sql.includes('pg_try_advisory_lock')) {
                    return { rows: [{ acquired: true }] };
                }
                if (sql === 'BEGIN') return {};
                if (sql.includes('INSERT INTO app_settings')) return { rows: [{ setting_key: 'red_credit_base_limit', setting_value: '100' }] };
                if (sql.includes('SELECT setting_key')) return { rows: [] };
                if (sql.includes('INSERT INTO credit_policy_versions')) {
                    throw new Error('DB_DISK_FULL: Simulación de fallo');
                }
                if (sql === 'ROLLBACK') {
                    rollbackCalled = true;
                    return {};
                }
                return { rows: [] };
            }),
            release: jest.fn()
        };
        const mockPool = {
            connect: jest.fn(async () => mockClient)
        };

        await expect(savePolicy(mockPool, 'red_credit_base_limit', '100', 1))
            .rejects
            .toThrow('DB_DISK_FULL: Simulación de fallo');

        expect(rollbackCalled).toBe(true);
        expect(mockClient.release).toHaveBeenCalled();
    });
});
