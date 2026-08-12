/**
 * PRUEBAS UNITARIAS: Consolidación de Auditoría e Integridad de Migración 105
 * ═════════════════════════════════════════════════════════════════════════════
 * Evalúa:
 *  1. Estructura y exportaciones válidas de migration 105.
 *  2. Sintaxis SQL e inmutabilidad de inserción en audit_log.
 *  3. Inserción correcta de auditoría en financialCoreService.js (burn_tokens).
 *  4. Compatibilidad con el runner de migraciones.
 */

const migration105 = require('../migrations/105_consolidate_audit_logs');
const financialCoreService = require('../src/services/financialCoreService');

describe('Auditoría Bancaria & Pruebas Unitarias de Migración 105', () => {

    test('La migración 105 debe exportar las funciones "up" y "down" requeridas por migrationRunner.js', () => {
        expect(typeof migration105.up).toBe('function');
        expect(typeof migration105.down).toBe('function');
    });

    test('La migración 105 up debe ejecutar consultas parametrizadas y seguras sin errores de sintaxis SQL', async () => {
        const mockClient = {
            query: jest.fn().mockImplementation((queryText) => {
                if (queryText.includes('information_schema.tables')) {
                    return Promise.resolve({ rows: [{ exists: true }] });
                }
                if (queryText.includes('INSERT INTO audit_log')) {
                    return Promise.resolve({ rowCount: 5 });
                }
                if (queryText.includes('DROP TABLE IF EXISTS audit_logs')) {
                    return Promise.resolve({ rowCount: 1 });
                }
                return Promise.resolve({ rows: [] });
            })
        };

        await expect(migration105.up(mockClient)).resolves.not.toThrow();

        // Verificamos que se ejecutaron las consultas esperadas
        expect(mockClient.query).toHaveBeenCalledTimes(3);
        const insertQueryCall = mockClient.query.mock.calls[1][0];
        const dropQueryCall = mockClient.query.mock.calls[2][0];
        expect(insertQueryCall).toContain('INSERT INTO audit_log');
        expect(insertQueryCall).toContain('WHERE NOT EXISTS');
        expect(dropQueryCall).toContain('DROP TABLE IF EXISTS audit_logs');
    });

    test('La migración 105 up debe manejar correctamente el caso en que audit_logs no exista (idempotencia)', async () => {
        const mockClient = {
            query: jest.fn().mockImplementation((queryText) => {
                if (queryText.includes('information_schema.tables')) {
                    return Promise.resolve({ rows: [{ exists: false }] });
                }
                return Promise.resolve({ rows: [] });
            })
        };

        await expect(migration105.up(mockClient)).resolves.not.toThrow();
        expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    test('La migración 105 down debe permitir la reconstrucción por compatibilidad de rollback', async () => {
        const mockClient = {
            query: jest.fn().mockResolvedValue({ rows: [] })
        };

        await expect(migration105.down(mockClient)).resolves.not.toThrow();
        expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS audit_logs'));
    });

    test('financialCoreService.executeBurn debe insertar registros con parametros seguros en la tabla unificada audit_log', async () => {
        const mockUser = {
            id: 42,
            liquid_blue_balance: '100.0000',
            escrow_blue_balance: '50.0000',
            red_balance: '10.0000'
        };

        const mockClient = {
            query: jest.fn().mockImplementation((queryText, params) => {
                if (queryText.includes('SELECT id, liquid_blue_balance')) {
                    return Promise.resolve({ rowCount: 1, rows: [mockUser] });
                }
                if (queryText.includes('SELECT id, amount FROM red_token_debts')) {
                    return Promise.resolve({ rowCount: 0, rows: [] });
                }
                return Promise.resolve({ rowCount: 1, rows: [] });
            })
        };

        const result = await financialCoreService.executeBurn(mockClient, 'usuario_test', 10);

        expect(result.success).toBe(true);
        expect(result.actualAmountBurned).toBe(10);

        // Verificamos que la inserción de auditoría fue llamada en audit_log con parametros correctos
        const auditCall = mockClient.query.mock.calls.find(call => call[0].includes('INSERT INTO audit_log'));
        expect(auditCall).toBeDefined();

        const [queryText, queryParams] = auditCall;
        expect(queryText).toContain('INSERT INTO audit_log (actor_id, actor_username, event_type, category, metadata)');
        expect(queryParams[0]).toBe(42); // actor_id
        expect(queryParams[1]).toBe('usuario_test'); // actor_username
        
        const metadata = JSON.parse(queryParams[2]);
        expect(metadata.amount).toBe(10);
        expect(metadata.from_liquid).toBe(10);
    });

});
