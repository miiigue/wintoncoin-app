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

        test('parseCliArgs reconoce --fail-on-degraded, --strict-readiness, defaults de cold-start y piso mínimo de intervalo >= 1000ms', () => {
            expect(parseCliArgs(['--fail-on-degraded'])).toMatchObject({
                failOnDegraded: true,
                coldStartBudgetMs: 90000,
                coldStartIntervalMs: 15000
            });
            expect(
                parseCliArgs(['--strict-readiness', '--timeout-ms=10000', '--cold-start-budget-ms=120000'])
            ).toMatchObject({
                failOnDegraded: true,
                timeoutMs: 10000,
                coldStartBudgetMs: 120000
            });
            expect(parseCliArgs(['--cold-start-budget-ms', '0'])).toMatchObject({
                failOnDegraded: false,
                coldStartBudgetMs: 0
            });
            expect(parseCliArgs(['--cold-start-interval-ms=50'])).toMatchObject({
                coldStartIntervalMs: 1000
            });
            expect(parseCliArgs(['--cold-start-interval-ms', '250'])).toMatchObject({
                coldStartIntervalMs: 1000
            });
        });
    });

    describe('Espera acotada y transparente de cold-start de Render Demo', () => {
        test('despierta tras 2 respuestas 503 HTML -> 200 válido con sleepImpl mockeado y documenta coldStart.observed=true y budgetScope', async () => {
            const validResponses = buildValidDemoResponses();
            let deploymentCalls = 0;
            const sleepImpl = jest.fn(async () => {});

            const mockFetch = jest.fn(async (url) => {
                if (url.endsWith('/api/web3/deployment')) {
                    deploymentCalls += 1;
                    if (deploymentCalls <= 2) {
                        return buildMockResponse({
                            status: 503,
                            body: '<!doctype html><html><body>Render service waking up</body></html>'
                        });
                    }
                }
                return validResponses[url];
            });

            const report = await runDemoReadonlySmoke({
                fetchImpl: mockFetch,
                sleepImpl,
                coldStartBudgetMs: 90000,
                coldStartIntervalMs: 15000,
                failOnDegraded: true
            });

            expect(deploymentCalls).toBe(3);
            expect(sleepImpl).toHaveBeenCalledTimes(2);
            expect(report.overallStatus).toBe('ok');
            expect(report.exitCode).toBe(0);
            expect(report.coldStart).toMatchObject({
                budgetMs: 90000,
                budgetScope: 'post_detection_warmup_and_retries',
                observed: true,
                warmupAttempts: 2
            });
            expect(report.coldStart.warmupDurationMs).toBeGreaterThanOrEqual(30000);

            const deploymentCheck = report.checks.find((c) => c.id === 'backend_web3_deployment');
            expect(deploymentCheck.status).toBe('ok');
            expect(deploymentCheck.coldStartRetries).toBe(2);
        });

        test('falla cerrado (P1 / exitCode 1) si 503 HTML persiste hasta agotar coldStartBudgetMs sin lanzar petición extra tras agotar presupuesto', async () => {
            const validResponses = buildValidDemoResponses();
            const sleepImpl = jest.fn(async () => {});
            let deploymentCalls = 0;

            const mockFetch = jest.fn(async (url) => {
                if (url.endsWith('/api/web3/deployment')) {
                    deploymentCalls += 1;
                    return buildMockResponse({
                        status: 503,
                        body: '<!doctype html><html><body>Service Unavailable</body></html>'
                    });
                }
                return validResponses[url];
            });

            const report = await runDemoReadonlySmoke({
                fetchImpl: mockFetch,
                sleepImpl,
                coldStartBudgetMs: 30000,
                coldStartIntervalMs: 15000
            });

            // 1 intento inicial -> sleep 15s (quedan 15s) -> 1 reintento -> sleep 15s (quedan 0s -> NO lanza 3ra petición HTTP)
            expect(deploymentCalls).toBe(2);
            expect(sleepImpl).toHaveBeenCalledTimes(2);
            expect(report.overallStatus).toBe('fail');
            expect(report.exitCode).toBe(1);
            expect(report.coldStart).toMatchObject({
                budgetMs: 30000,
                budgetScope: 'post_detection_warmup_and_retries',
                observed: true,
                warmupAttempts: 1
            });

            const deploymentCheck = report.checks.find((c) => c.id === 'backend_web3_deployment');
            expect(deploymentCheck.status).toBe('fail');
            expect(deploymentCheck.coldStartRetries).toBe(1);
        });

        test('límite exacto del presupuesto: si el primer sleep agota remaining <= 0, NO se lanza ninguna petición extra', async () => {
            const validResponses = buildValidDemoResponses();
            const sleepImpl = jest.fn(async () => {});
            let deploymentCalls = 0;

            const mockFetch = jest.fn(async (url) => {
                if (url.endsWith('/api/web3/deployment')) {
                    deploymentCalls += 1;
                    return buildMockResponse({
                        status: 503,
                        body: '<!doctype html><html><body>Waking up</body></html>'
                    });
                }
                return validResponses[url];
            });

            const report = await runDemoReadonlySmoke({
                fetchImpl: mockFetch,
                sleepImpl,
                coldStartBudgetMs: 15000,
                coldStartIntervalMs: 15000
            });

            // Intento inicial -> sleep(15000) agota los 15000 ms -> remainingAfterSleep === 0 -> 0 peticiones extra
            expect(deploymentCalls).toBe(1);
            expect(sleepImpl).toHaveBeenCalledTimes(1);
            expect(sleepImpl).toHaveBeenCalledWith(15000);
            expect(report.overallStatus).toBe('fail');
            expect(report.exitCode).toBe(1);
            expect(report.coldStart).toMatchObject({
                budgetMs: 15000,
                budgetScope: 'post_detection_warmup_and_retries',
                observed: true,
                warmupAttempts: 0
            });
        });

        test('timeout lento acotado al tiempo restante: el reintento usa Math.min(timeoutMs, remainingAfterSleep) sin exceder coldStartBudgetMs', async () => {
            const validResponses = buildValidDemoResponses();
            const sleepImpl = jest.fn(async () => {});
            let deploymentCalls = 0;

            const mockFetch = jest.fn((url, init) => {
                if (url.endsWith('/api/web3/deployment')) {
                    deploymentCalls += 1;
                    if (deploymentCalls === 1) {
                        return Promise.resolve(
                            buildMockResponse({
                                status: 503,
                                body: '<!doctype html><html><body>Waking up</body></html>'
                            })
                        );
                    }
                    // El 2do intento simula un servidor colgado; debe abortarse en ~60ms (remaining), NO en 10000ms (timeoutMs)
                    return new Promise((_resolve, reject) => {
                        init.signal.addEventListener('abort', () => {
                            const err = new Error('The operation was aborted');
                            err.name = 'AbortError';
                            reject(err);
                        });
                    });
                }
                return Promise.resolve(validResponses[url]);
            });

            const started = Date.now();
            const report = await runDemoReadonlySmoke({
                fetchImpl: mockFetch,
                sleepImpl,
                timeoutMs: 10000,
                coldStartBudgetMs: 1060,
                coldStartIntervalMs: 1000
            });
            const elapsedWallMs = Date.now() - started;

            expect(deploymentCalls).toBe(2);
            expect(sleepImpl).toHaveBeenCalledTimes(1);
            expect(sleepImpl).toHaveBeenCalledWith(1000);
            // Si no hubiese acotado a remainingAfterSleep (60ms), habría tardado ~10000ms
            expect(elapsedWallMs).toBeLessThan(1500);
            expect(report.overallStatus).toBe('fail');
            expect(report.exitCode).toBe(1);

            const deploymentCheck = report.checks.find((c) => c.id === 'backend_web3_deployment');
            expect(deploymentCheck.details.errorCode).toBe('REQUEST_TIMEOUT');
            expect(deploymentCheck.details.errorMessage).toMatch(/60 ms/);
            expect(deploymentCheck.coldStartRetries).toBe(1);
        });

        test('dos checks (deployment y exchange-queue) comparten el mismo presupuesto coldStartState y el segundo respeta lo ya consumido', async () => {
            const validResponses = buildValidDemoResponses();
            const sleepCalls = [];
            const sleepImpl = jest.fn(async (ms) => {
                sleepCalls.push(ms);
            });
            let deploymentCalls = 0;
            let queueCalls = 0;

            const mockFetch = jest.fn(async (url) => {
                if (url.endsWith('/api/web3/deployment')) {
                    deploymentCalls += 1;
                    if (deploymentCalls === 1) {
                        return buildMockResponse({
                            status: 503,
                            body: '<!doctype html><html><body>Waking up</body></html>'
                        });
                    }
                    return validResponses[url];
                }
                if (url.endsWith('/api/web3/exchange-queue')) {
                    queueCalls += 1;
                    return buildMockResponse({
                        status: 503,
                        body: '<!doctype html><html><body>Still warming</body></html>'
                    });
                }
                return validResponses[url];
            });

            const report = await runDemoReadonlySmoke({
                fetchImpl: mockFetch,
                sleepImpl,
                coldStartBudgetMs: 20000,
                coldStartIntervalMs: 15000
            });

            // deployment consume 15000ms en sleep y recupera en su 2do intento (warmupAttempts = 1).
            // exchange-queue solo recibe los <= 5000ms restantes del presupuesto compartido y tras agotarlo NO lanza petición extra.
            expect(deploymentCalls).toBe(2);
            expect(queueCalls).toBe(1);
            expect(sleepCalls).toHaveLength(2);
            expect(sleepCalls[0]).toBe(15000);
            expect(sleepCalls[1]).toBeLessThanOrEqual(5000);
            expect(sleepCalls[1]).toBeGreaterThan(0);
            expect(report.overallStatus).toBe('fail');
            expect(report.exitCode).toBe(1);
            expect(report.coldStart).toMatchObject({
                budgetMs: 20000,
                budgetScope: 'post_detection_warmup_and_retries',
                observed: true,
                warmupAttempts: 1
            });

            const deploymentCheck = report.checks.find((c) => c.id === 'backend_web3_deployment');
            const queueCheck = report.checks.find((c) => c.id === 'backend_web3_exchange_queue');
            expect(deploymentCheck.status).toBe('ok');
            expect(deploymentCheck.coldStartRetries).toBe(1);
            expect(queueCheck.status).toBe('fail');
            expect(queueCheck.coldStartRetries).toBe(0);
        });

        test.each([
            [
                'HTTP 500 en deployment',
                'https://wintoncoin-backend-demo.onrender.com/api/web3/deployment',
                buildMockResponse({ status: 500, body: { success: false, error: 'INTERNAL_ERROR' } }),
                1
            ],
            [
                'HTTP 200 con usable:false en exchange-queue',
                'https://wintoncoin-backend-demo.onrender.com/api/web3/exchange-queue',
                buildMockResponse({
                    status: 200,
                    body: {
                        success: true,
                        chainId: '11155420',
                        status: 'ready',
                        usable: false,
                        verifiedThroughBlock: '51880155'
                    }
                }),
                1
            ],
            [
                'CHAIN_ID_DRIFT en deployment',
                'https://wintoncoin-backend-demo.onrender.com/api/web3/deployment',
                buildMockResponse({
                    status: 200,
                    body: {
                        success: true,
                        chainId: '10',
                        epoch: 'V6_DEMO'
                    }
                }),
                1
            ],
            [
                'HTTP 503 JSON controlado de la app en exchange-queue',
                'https://wintoncoin-backend-demo.onrender.com/api/web3/exchange-queue',
                buildMockResponse({
                    status: 503,
                    body: {
                        success: false,
                        chainId: '11155420',
                        usable: false,
                        status: 'syncing',
                        verifiedThroughBlock: '51877845',
                        data: null
                    }
                }),
                0
            ]
        ])(
            'NO dispara reintentos de cold-start ante %s (fetchCalls exacto = 1)',
            async (_label, targetUrl, responseObj, expectedExitCode) => {
                const responses = buildValidDemoResponses({ [targetUrl]: responseObj });
                const sleepImpl = jest.fn(async () => {});
                const callsByUrl = new Map();

                const mockFetch = jest.fn(async (url) => {
                    callsByUrl.set(url, (callsByUrl.get(url) || 0) + 1);
                    return responses[url];
                });

                const report = await runDemoReadonlySmoke({
                    fetchImpl: mockFetch,
                    sleepImpl,
                    coldStartBudgetMs: 90000,
                    coldStartIntervalMs: 15000
                });

                expect(callsByUrl.get(targetUrl)).toBe(1);
                expect(sleepImpl).not.toHaveBeenCalled();
                expect(report.coldStart).toMatchObject({
                    budgetMs: 90000,
                    observed: false,
                    warmupAttempts: 0,
                    warmupDurationMs: 0
                });
                expect(report.exitCode).toBe(expectedExitCode);
            }
        );
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
