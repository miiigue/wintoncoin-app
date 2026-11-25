'use strict';

/**
 * ============================================================================
 * PRUEBAS UNITARIAS DETERMINISTAS: DEMO READ-ONLY SMOKE (AG-07 / D06)
 * ============================================================================
 * Todas las pruebas se ejecutan 100% offline inyectando `fetchImpl` mockeado,
 * sin llamadas reales de red, sin secretos y sin escrituras mutantes.
 * ============================================================================
 */

const path = require('node:path');
const {
    ALLOWED_DEMO_HOSTS,
    EXPECTED_DEMO_CHAIN_ID,
    EXPECTED_DEMO_EPOCH,
    redactUrlCredentials,
    validateDemoSmokeTarget,
    resolveSafeScratchOutPath,
    parseCliArgs,
    runDemoReadonlySmoke
} = require('../../scripts/demo-readonly-smoke.cjs');

/**
 * Crea una respuesta HTTP mock compatible con la interfaz Fetch consumida por el script.
 */
function buildMockResponse({ status = 200, body = '', headers = {} }) {
    const normalizedHeaders = new Map(
        Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)])
    );
    return {
        status,
        headers: {
            get: (name) => normalizedHeaders.get(String(name).toLowerCase()) ?? null
        },
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
    };
}

/**
 * Fixtures válidos de respuestas Demo V6 para escenarios nominales y de mutación puntual.
 */
function buildValidDemoResponses(overrides = {}) {
    return {
        'https://demo.wintoncoin.com/': buildMockResponse({
            status: 200,
            body: '<!DOCTYPE html><html data-winton-environment="demo" lang="es"><head><title>[DEMO] WintonCoin</title></head><body>Demo OK</body></html>'
        }),
        'https://demo.wintoncoin.com/estado-cuenta.html': buildMockResponse({
            status: 200,
            body: '<!DOCTYPE html><html data-winton-environment="demo"><head><title>[DEMO] Estado de Cuenta Web3</title><script type="module" src="/assets/estadoCuenta.BoPWzzwi.js"></script></head><body></body></html>'
        }),
        'https://wintoncoin-backend-demo.onrender.com/api/web3/deployment': buildMockResponse({
            status: 200,
            body: {
                success: true,
                chainId: EXPECTED_DEMO_CHAIN_ID,
                epoch: EXPECTED_DEMO_EPOCH,
                mode: 'NORMAL',
                blockNumber: 51880155,
                operations: { indexerReady: true }
            }
        }),
        'https://wintoncoin-backend-demo.onrender.com/api/web3/exchange-queue': buildMockResponse({
            status: 200,
            body: {
                success: true,
                chainId: EXPECTED_DEMO_CHAIN_ID,
                usable: true,
                status: 'ready',
                verifiedThroughBlock: '51880155',
                data: { queue: [] }
            }
        }),
        ...overrides
    };
}

describe('demo-readonly-smoke (AG-07 / D06)', () => {
    describe('Allowlist estricta de Demo ANTES de conectar', () => {
        test('acepta únicamente los hosts Demo canónicos por HTTPS', () => {
            expect(ALLOWED_DEMO_HOSTS).toEqual([
                'demo.wintoncoin.com',
                'wintoncoin-backend-demo.onrender.com'
            ]);

            expect(validateDemoSmokeTarget('https://demo.wintoncoin.com/')).toMatchObject({
                valid: true,
                host: 'demo.wintoncoin.com'
            });
            expect(
                validateDemoSmokeTarget('https://wintoncoin-backend-demo.onrender.com/api/web3/deployment')
            ).toMatchObject({
                valid: true,
                host: 'wintoncoin-backend-demo.onrender.com'
            });
        });

        test.each([
            ['Producción web raíz', 'https://wintoncoin.com/'],
            ['Producción www', 'https://www.wintoncoin.com/estado-cuenta.html'],
            ['Producción API', 'https://api.wintoncoin.com/api/web3/deployment'],
            ['Producción Render backend', 'https://wintoncoin-backend.onrender.com/api/web3/deployment'],
            ['Downgrade HTTP en Demo', 'http://demo.wintoncoin.com/'],
            ['Credenciales embebidas', 'https://user:pass@demo.wintoncoin.com/'],
            ['Subdominio engañoso', 'https://demo.wintoncoin.com.attacker.test/'],
            ['Puerto no estándar', 'https://demo.wintoncoin.com:8443/'],
            ['Localhost arbitrario', 'https://localhost/api/web3/deployment'],
            ['URL vacía', '']
        ])('rechaza objetivo no permitido (%s): %s', (_label, forbiddenUrl) => {
            const result = validateDemoSmokeTarget(forbiddenUrl);
            expect(result.valid).toBe(false);
            expect(result.reason).toBeTruthy();
        });

        test('aborta ANTES de invocar fetch si cualquier target apunta a Producción', async () => {
            const mockFetch = jest.fn();

            const report = await runDemoReadonlySmoke({
                targets: {
                    backendDeployment: 'https://wintoncoin-backend.onrender.com/api/web3/deployment'
                },
                fetchImpl: mockFetch
            });

            // Garantía Zero-Trust: 0 llamadas de red cuando falla la allowlist
            expect(mockFetch).not.toHaveBeenCalled();
            expect(report.overallStatus).toBe('fail');
            expect(report.exitCode).toBe(1);
            expect(report.alerts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        checkId: 'backend_web3_deployment',
                        priority: 'P1',
                        code: 'ALLOWLIST_VIOLATION'
                    })
                ])
            );
        });
    });

    describe('Escenario nominal Demo válido', () => {
        test('retorna overallStatus ok y exitCode 0 con respuestas Demo V6 válidas (11155420 / V6_DEMO)', async () => {
            const responses = buildValidDemoResponses();
            const mockFetch = jest.fn(async (url, init) => {
                expect(init.method).toBe('GET');
                expect(init.redirect).toBe('manual');
                return responses[url];
            });

            const report = await runDemoReadonlySmoke({
                fetchImpl: mockFetch,
                timeoutMs: 5000
            });

            expect(mockFetch).toHaveBeenCalledTimes(4);
            expect(report.readOnly).toBe(true);
            expect(report.environment).toBe('demo');
            expect(report.overallStatus).toBe('ok');
            expect(report.exitCode).toBe(0);
            expect(report.summary).toEqual({ total: 4, ok: 4, degraded: 0, failed: 0 });
            expect(report.alerts).toEqual([]);

            const estadoCheck = report.checks.find((c) => c.id === 'frontend_estado_cuenta');
            expect(estadoCheck.details.bundleAsset).toBe('estadoCuenta.BoPWzzwi.js');

            const deploymentCheck = report.checks.find((c) => c.id === 'backend_web3_deployment');
            expect(deploymentCheck.details.chainId).toBe('11155420');
            expect(deploymentCheck.details.epoch).toBe('V6_DEMO');
        });
    });

    describe('Detección de deriva de red y contaminación con Producción', () => {
        test('falla críticamente (exitCode 1) si deployment devuelve chainId distinto de 11155420', async () => {
            const responses = buildValidDemoResponses({
                'https://wintoncoin-backend-demo.onrender.com/api/web3/deployment': buildMockResponse({
                    status: 200,
                    body: {
                        success: true,
                        chainId: '10',
                        epoch: 'V6_DEMO'
                    }
                })
            });

            const report = await runDemoReadonlySmoke({
                fetchImpl: jest.fn(async (url) => responses[url])
            });

            expect(report.overallStatus).toBe('fail');
            expect(report.exitCode).toBe(1);
            expect(report.alerts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        checkId: 'backend_web3_deployment',
                        priority: 'P1',
                        code: 'CHAIN_ID_DRIFT'
                    })
                ])
            );
        });

        test('falla críticamente (exitCode 1) si HTML Demo contiene referencia al backend productivo', async () => {
            const responses = buildValidDemoResponses({
                'https://demo.wintoncoin.com/': buildMockResponse({
                    status: 200,
                    body: '<!DOCTYPE html><html data-winton-environment="demo"><head><title>[DEMO] WintonCoin</title></head><body><script>const API="https://wintoncoin-backend.onrender.com";</script></body></html>'
                })
            });

            const report = await runDemoReadonlySmoke({
                fetchImpl: jest.fn(async (url) => responses[url])
            });

            expect(report.overallStatus).toBe('fail');
            expect(report.exitCode).toBe(1);
            expect(report.alerts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        checkId: 'frontend_home',
                        priority: 'P1',
                        code: 'PRODUCTION_REFERENCE_LEAK'
                    })
                ])
            );
        });

        test('falla críticamente si estado-cuenta.html no referencia bundle estadoCuenta.*.js', async () => {
            const responses = buildValidDemoResponses({
                'https://demo.wintoncoin.com/estado-cuenta.html': buildMockResponse({
                    status: 200,
                    body: '<!DOCTYPE html><html data-winton-environment="demo"><head><title>[DEMO] Estado de Cuenta</title></head><body>Sin bundle</body></html>'
                })
            });

            const report = await runDemoReadonlySmoke({
                fetchImpl: jest.fn(async (url) => responses[url])
            });

            expect(report.overallStatus).toBe('fail');
            expect(report.exitCode).toBe(1);
            expect(report.alerts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        checkId: 'frontend_estado_cuenta',
                        priority: 'P1',
                        code: 'MISSING_ESTADO_CUENTA_BUNDLE'
                    })
                ])
            );
        });
    });

    describe('Manejo de timeout y estado 503 controlado en exchange-queue', () => {
        test('aborta por timeout estricto sin reintentos y falla con exitCode 1', async () => {
            const responses = buildValidDemoResponses();
            const mockFetch = jest.fn((url, init) => {
                if (url.endsWith('/api/web3/deployment')) {
                    return new Promise((_resolve, reject) => {
                        init.signal.addEventListener('abort', () => {
                            const err = new Error('The operation was aborted');
                            err.name = 'AbortError';
                            reject(err);
                        });
                    });
                }
                return Promise.resolve(responses[url]);
            });

            const report = await runDemoReadonlySmoke({
                fetchImpl: mockFetch,
                timeoutMs: 30
            });

            // 1 llamada por endpoint = 0 reintentos
            expect(mockFetch).toHaveBeenCalledTimes(4);
            expect(report.overallStatus).toBe('fail');
            expect(report.exitCode).toBe(1);
            expect(report.alerts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        checkId: 'backend_web3_deployment',
                        priority: 'P1',
                        code: 'REQUEST_TIMEOUT'
                    })
                ])
            );
        });

        test('trata HTTP 503 controlado (stale/syncing con chainId 11155420) en exchange-queue como degraded + alerta P2 sin fallo falso', async () => {
            const responses = buildValidDemoResponses({
                'https://wintoncoin-backend-demo.onrender.com/api/web3/exchange-queue': buildMockResponse({
                    status: 503,
                    body: {
                        success: false,
                        chainId: '11155420',
                        usable: false,
                        status: 'stale',
                        verifiedThroughBlock: '51877845',
                        data: null
                    }
                })
            });

            const report = await runDemoReadonlySmoke({
                fetchImpl: jest.fn(async (url) => responses[url])
            });

            expect(report.overallStatus).toBe('degraded');
            expect(report.exitCode).toBe(0);
            expect(report.summary).toEqual({ total: 4, ok: 3, degraded: 1, failed: 0 });
            expect(report.alerts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        checkId: 'backend_web3_exchange_queue',
                        priority: 'P2',
                        severity: 'warning',
                        code: 'EXCHANGE_QUEUE_CONTROLLED_503'
                    })
                ])
            );

            const queueCheck = report.checks.find((c) => c.id === 'backend_web3_exchange_queue');
            expect(queueCheck.status).toBe('degraded');
            expect(queueCheck.httpStatus).toBe(503);
            expect(queueCheck.details.controlledFailClosed).toBe(true);
            expect(queueCheck.details.verifiedThroughBlock).toBe('51877845');
        });

        test('falla críticamente (exitCode 1) si exchange-queue responde 503 con chainId distinto de 11155420', async () => {
            const responses = buildValidDemoResponses({
                'https://wintoncoin-backend-demo.onrender.com/api/web3/exchange-queue': buildMockResponse({
                    status: 503,
                    body: {
                        success: false,
                        chainId: '10',
                        usable: false,
                        status: 'stale'
                    }
                })
            });

            const report = await runDemoReadonlySmoke({
                fetchImpl: jest.fn(async (url) => responses[url])
            });

            expect(report.overallStatus).toBe('fail');
            expect(report.exitCode).toBe(1);
            expect(report.alerts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        checkId: 'backend_web3_exchange_queue',
                        priority: 'P1',
                        code: 'CHAIN_ID_MISSING_OR_DRIFT'
                    })
                ])
            );
        });

        test('con --fail-on-degraded (failOnDegraded: true) un 503 controlado en exchange-queue devuelve exitCode 1', async () => {
            const responses = buildValidDemoResponses({
                'https://wintoncoin-backend-demo.onrender.com/api/web3/exchange-queue': buildMockResponse({
                    status: 503,
                    body: {
                        success: false,
                        chainId: '11155420',
                        usable: false,
                        status: 'syncing',
                        verifiedThroughBlock: '51877845',
                        data: null
                    }
                })
            });

            const report = await runDemoReadonlySmoke({
                fetchImpl: jest.fn(async (url) => responses[url]),
                failOnDegraded: true
            });

            expect(report.overallStatus).toBe('degraded');
            expect(report.exitCode).toBe(1);
            expect(report.policy.failOnDegraded).toBe(true);
            expect(report.alerts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        checkId: 'backend_web3_exchange_queue',
                        priority: 'P2',
                        code: 'EXCHANGE_QUEUE_CONTROLLED_503'
                    })
                ])
            );
        });
    });

    describe('Prevención de falsos OK en exchange-queue HTTP 200 y deployment indexerReady (CODEX-206)', () => {
        test('HTTP 200 success:true con usable:false NO devuelve ok', async () => {
            const responses = buildValidDemoResponses({
                'https://wintoncoin-backend-demo.onrender.com/api/web3/exchange-queue': buildMockResponse({
                    status: 200,
                    body: {
                        success: true,
                        chainId: '11155420',
                        status: 'ready',
                        usable: false,
                        verifiedThroughBlock: '51880155'
                    }
                })
            });

            const report = await runDemoReadonlySmoke({
                fetchImpl: jest.fn(async (url) => responses[url])
            });

            expect(report.overallStatus).toBe('fail');
            expect(report.exitCode).toBe(1);
            expect(report.alerts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        checkId: 'backend_web3_exchange_queue',
                        priority: 'P1',
                        code: 'EXCHANGE_QUEUE_NOT_READY_ON_200'
                    })
                ])
            );
        });

        test('HTTP 200 success:true con status:"syncing" NO devuelve ok', async () => {
            const responses = buildValidDemoResponses({
                'https://wintoncoin-backend-demo.onrender.com/api/web3/exchange-queue': buildMockResponse({
                    status: 200,
                    body: {
                        success: true,
                        chainId: '11155420',
                        status: 'syncing',
                        usable: false,
                        verifiedThroughBlock: null
                    }
                })
            });

            const report = await runDemoReadonlySmoke({
                fetchImpl: jest.fn(async (url) => responses[url])
            });

            expect(report.overallStatus).toBe('fail');
            expect(report.exitCode).toBe(1);
            const queueCheck = report.checks.find((c) => c.id === 'backend_web3_exchange_queue');
            expect(queueCheck.status).toBe('fail');
            expect(queueCheck.details.failedReadinessChecks).toEqual(
                expect.arrayContaining([
                    expect.stringMatching(/status="syncing"/),
                    expect.stringMatching(/usable=false/),
                    expect.stringMatching(/verifiedThroughBlock=null/)
                ])
            );
        });

        test('HTTP 200 success:true con campo usable ausente NO devuelve ok', async () => {
            const responses = buildValidDemoResponses({
                'https://wintoncoin-backend-demo.onrender.com/api/web3/exchange-queue': buildMockResponse({
                    status: 200,
                    body: {
                        success: true,
                        chainId: '11155420',
                        status: 'ready',
                        verifiedThroughBlock: '51880155'
                    }
                })
            });

            const report = await runDemoReadonlySmoke({
                fetchImpl: jest.fn(async (url) => responses[url])
            });

            expect(report.overallStatus).toBe('fail');
            expect(report.exitCode).toBe(1);
            expect(report.alerts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        checkId: 'backend_web3_exchange_queue',
                        code: 'EXCHANGE_QUEUE_NOT_READY_ON_200'
                    })
                ])
            );
        });

        test.each([
            ['ausente (undefined)', {}],
            ['null', { verifiedThroughBlock: null }],
            ['cero ("0")', { verifiedThroughBlock: '0' }]
        ])('HTTP 200 success:true con verifiedThroughBlock %s NO devuelve ok', async (_label, extra) => {
            const responses = buildValidDemoResponses({
                'https://wintoncoin-backend-demo.onrender.com/api/web3/exchange-queue': buildMockResponse({
                    status: 200,
                    body: {
                        success: true,
                        chainId: '11155420',
                        status: 'ready',
                        usable: true,
                        ...extra
                    }
                })
            });

            const report = await runDemoReadonlySmoke({
                fetchImpl: jest.fn(async (url) => responses[url])
            });

            expect(report.overallStatus).toBe('fail');
            expect(report.exitCode).toBe(1);
            expect(report.alerts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        checkId: 'backend_web3_exchange_queue',
                        code: 'EXCHANGE_QUEUE_NOT_READY_ON_200'
                    })
                ])
            );
        });

        test('HTTP 200 success:true con chainId ausente falla por CHAIN_ID_MISSING_OR_DRIFT', async () => {
            const responses = buildValidDemoResponses({
                'https://wintoncoin-backend-demo.onrender.com/api/web3/exchange-queue': buildMockResponse({
                    status: 200,
                    body: {
                        success: true,
                        status: 'ready',
                        usable: true,
                        verifiedThroughBlock: '51880155'
                    }
                })
            });

            const report = await runDemoReadonlySmoke({
                fetchImpl: jest.fn(async (url) => responses[url])
            });

            expect(report.overallStatus).toBe('fail');
            expect(report.exitCode).toBe(1);
            expect(report.alerts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        checkId: 'backend_web3_exchange_queue',
                        priority: 'P1',
                        code: 'CHAIN_ID_MISSING_OR_DRIFT'
                    })
                ])
            );
        });

        test.each([
            ['payload.indexerReady=false', { indexerReady: false }],
            ['payload.indexer.ready=false', { indexer: { ready: false } }],
            ['payload.operations.indexerReady=false', { operations: { indexerReady: false } }]
        ])('deployment con %s degrada y alerta; con --fail-on-degraded devuelve exitCode 1', async (_label, extra) => {
            const responses = buildValidDemoResponses({
                'https://wintoncoin-backend-demo.onrender.com/api/web3/deployment': buildMockResponse({
                    status: 200,
                    body: {
                        success: true,
                        chainId: '11155420',
                        epoch: 'V6_DEMO',
                        mode: 'NORMAL',
                        blockNumber: 51880155,
                        ...extra
                    }
                })
            });

            const diagnosticReport = await runDemoReadonlySmoke({
                fetchImpl: jest.fn(async (url) => responses[url]),
                failOnDegraded: false
            });

            expect(diagnosticReport.overallStatus).toBe('degraded');
            expect(diagnosticReport.exitCode).toBe(0);
            expect(diagnosticReport.alerts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        checkId: 'backend_web3_deployment',
                        priority: 'P2',
                        code: 'DEPLOYMENT_INDEXER_NOT_READY'
                    })
                ])
            );

            const strictReport = await runDemoReadonlySmoke({
                fetchImpl: jest.fn(async (url) => responses[url]),
                failOnDegraded: true
            });

            expect(strictReport.overallStatus).toBe('degraded');
            expect(strictReport.exitCode).toBe(1);
        });
    });

    describe('Redacción de credenciales en URLs rechazadas y argumentos CLI', () => {
        test('redacta credenciales embebidas antes de emitir checks[].url en el reporte JSON', async () => {
            const secretUrl = 'https://secretUser:superSecretPass@demo.wintoncoin.com/';
            expect(redactUrlCredentials(secretUrl)).toBe('https://[REDACTED]@demo.wintoncoin.com/');

            const mockFetch = jest.fn();
            const report = await runDemoReadonlySmoke({
                targets: { frontendHome: secretUrl },
                fetchImpl: mockFetch
            });

            expect(mockFetch).not.toHaveBeenCalled();
            expect(report.exitCode).toBe(1);
            const serialized = JSON.stringify(report);
            expect(serialized).not.toContain('secretUser');
            expect(serialized).not.toContain('superSecretPass');
            expect(report.checks[0].url).toBe('https://[REDACTED]@demo.wintoncoin.com/');
        });

        test('parseCliArgs reconoce --fail-on-degraded y --strict-readiness', () => {
            expect(parseCliArgs(['--fail-on-degraded'])).toMatchObject({ failOnDegraded: true });
            expect(parseCliArgs(['--strict-readiness', '--timeout-ms=10000'])).toMatchObject({
                failOnDegraded: true,
                timeoutMs: 10000
            });
            expect(parseCliArgs([])).toMatchObject({ failOnDegraded: false });
        });
    });

    describe('Confinamiento seguro de --out en backend/scratch/', () => {
        test('acepta rutas dentro de backend/scratch/ y rechaza escapes por path traversal', () => {
            const repoRoot = path.resolve(__dirname, '..', '..');
            const validPath = resolveSafeScratchOutPath('backend/scratch/demo-report.json', repoRoot);
            expect(validPath).toBe(path.join(repoRoot, 'backend', 'scratch', 'demo-report.json'));

            expect(() =>
                resolveSafeScratchOutPath('backend/scratch/../../root-escape.json', repoRoot)
            ).toThrow(/backend\/scratch/);
            expect(() => resolveSafeScratchOutPath('report.json', repoRoot)).toThrow(/backend\/scratch/);
        });
    });
});
