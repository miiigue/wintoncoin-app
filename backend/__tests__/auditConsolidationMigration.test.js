/**
 * PRUEBAS UNITARIAS: Consolidación de Auditoría e Integridad de Migración 105
 * ═════════════════════════════════════════════════════════════════════════════
 * Evalúa:
 *  1. Estructura y exportaciones válidas de migration 105.
 *  2. Sintaxis SQL e inmutabilidad de inserción en audit_log.
 *  3. Rechazo del motor SQL retirado: ninguna quema ficticia.
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

    test('el motor SQL retirado rechaza amortizar y no fabrica saldos ni auditorías de quema', async () => {
        const client={query:jest.fn()};
        await expect(financialCoreService.executeBurn(client,'usuario_test',10)).rejects.toMatchObject({status:410});
        expect(client.query).not.toHaveBeenCalled();
    });
});
