'use strict';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * PRUEBAS UNITARIAS: WORKER DE PURGA DE STAGING (stagingCleanupJob)
 * ══════════════════════════════════════════════════════════════════════════════
 * Valida que el worker de mantenimiento purgue de forma segura y controlada los
 * registros en 'pending_verifications' que hayan superado las 48 horas de
 * expiración, manejando transacciones, conexiones y excepciones con tolerancia
 * a fallos.
 * ══════════════════════════════════════════════════════════════════════════════
 */

const stagingCleanupJob = require('../src/workers/stagingCleanupJob');

describe('stagingCleanupJob — Purga Automática de Registros Temporales (48 Horas)', () => {
    let mockClient;
    let mockPool;

    beforeEach(() => {
        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };

        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient)
        };

        jest.clearAllMocks();
    });

    test('1. Debe purgar exitosamente registros de pending_verifications expirados con más de 48 horas', async () => {
        // Simular que se eliminaron 3 registros que tenían más de 48 horas expirados
        mockClient.query.mockResolvedValueOnce({
            rowCount: 3,
            rows: [{ id: 1 }, { id: 2 }, { id: 3 }]
        });

        const result = await stagingCleanupJob(mockPool);

        // Verificaciones
        expect(mockPool.connect).toHaveBeenCalledTimes(1);
        expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining("expires_at < NOW() - INTERVAL '48 hours'"));
        expect(mockClient.release).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            success: true,
            purgedCount: 3
        });
    });

    test('2. Debe retornar purgedCount: 0 cuando no existen registros vencidos hace más de 48 horas', async () => {
        mockClient.query.mockResolvedValueOnce({
            rowCount: 0,
            rows: []
        });

        const result = await stagingCleanupJob(mockPool);

        expect(mockClient.query).toHaveBeenCalledTimes(1);
        expect(mockClient.release).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            success: true,
            purgedCount: 0
        });
    });

    test('3. Debe capturar errores de base de datos de forma segura, liberar conexión y retornar success: false', async () => {
        const dbError = new Error('Connection timeout al conectar con base de datos');
        mockClient.query.mockRejectedValueOnce(dbError);

        const result = await stagingCleanupJob(mockPool);

        expect(mockClient.release).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            success: false,
            error: 'Connection timeout al conectar con base de datos',
            purgedCount: 0
        });
    });

    test('4. Debe prevenir ejecuciones concurrentes simultáneas mediante candado mutex', async () => {
        // Simular una consulta demorada para la primera llamada
        let resolveQuery;
        const delayedQueryPromise = new Promise(resolve => { resolveQuery = resolve; });
        mockClient.query.mockImplementationOnce(() => delayedQueryPromise);

        // Disparar la primera llamada (que queda pendiente)
        const job1Promise = stagingCleanupJob(mockPool);

        // Disparar la segunda llamada inmediatamente en paralelo
        const job2Result = await stagingCleanupJob(mockPool);

        // La segunda llamada debe omitirse de forma segura
        expect(job2Result).toEqual({
            success: true,
            skipped: true,
            purgedCount: 0
        });

        // Completar la primera llamada
        resolveQuery({ rowCount: 1, rows: [{ id: 10 }] });
        const job1Result = await job1Promise;
        expect(job1Result.success).toBe(true);
    });
});
