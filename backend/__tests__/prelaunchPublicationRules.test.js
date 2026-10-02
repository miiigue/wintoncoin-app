/**
 * backend/__tests__/prelaunchPublicationRules.test.js
 * 
 * PROPÓSITO:
 * Pruebas unitarias y de integración para validar las reglas de negocio estrictas
 * del Modo Pre-Lanzamiento aplicadas a las publicaciones de la plataforma y usuarios:
 * 
 * 1. Prohibición estricta de Venta Rápida (/api/quick-sale) en modo pre-lanzamiento.
 * 2. Prohibición universal para usuarios regulares en /publish (solicitud, venta y donación).
 * 3. Cálculo dinámico en tiempo real del multiplicador en processRequestPayment()
 *    (Truth-in-Pricing / FinTech Compliance) sin mantener snapshots congelados obsoletos.
 */

'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../src/services/emailService', () => ({
    sendTransactionEmail: jest.fn().mockResolvedValue(true),
    sendAnnouncementEmail: jest.fn().mockResolvedValue(true),
    processPendingBroadcasts: jest.fn().mockResolvedValue(true),
    normalizeEmail: jest.fn().mockImplementation(email => email.toLowerCase())
}));

let mockActiveMultiplier = 8.0;
jest.mock('../src/services/boosterService', () => ({
    calculateMultipliedAmount: jest.fn().mockImplementation(() => Promise.resolve({
        multiplier: mockActiveMultiplier,
        stageName: 'Etapa Dinámica de Prueba'
    }))
}));

const { processRequestPayment } = require('../src/services/publicationService');
const publicationController = require('../src/controllers/publicationController');

describe('Pre-Launch Publication Security & Truth-in-Pricing Engine', () => {

    describe('1. Dinamismo del Multiplicador en processRequestPayment (Hallazgo 4)', () => {
        test('Debe recalcular inmediatamente con el multiplicador activo si cambia la etapa, sin conservar snapshot obsoleto', async () => {
            mockActiveMultiplier = 8.0;

            const mockClient = {
                query: jest.fn().mockImplementation((queryText, params) => {
                    if (typeof queryText === 'string') {
                        if (queryText.includes('SELECT id FROM users WHERE username = $1')) {
                            return Promise.resolve({ rows: [{ id: 77 }], rowCount: 1 });
                        }
                        if (queryText.includes('record_booster_event')) {
                            return Promise.resolve({ rows: [], rowCount: 1 });
                        }
                        if (queryText.includes('INSERT INTO booster_transactions')) {
                            return Promise.resolve({ rows: [], rowCount: 1 });
                        }
                        if (queryText.includes('UPDATE users SET is_booster = TRUE')) {
                            return Promise.resolve({ rows: [], rowCount: 1 });
                        }
                        if (queryText.includes('SELECT SUM(amount) as total')) {
                            return Promise.resolve({ rows: [{ total: '80' }], rowCount: 1 });
                        }
                        if (queryText.includes('SELECT MAX(level) as current_level')) {
                            return Promise.resolve({ rows: [{ current_level: 1 }], rowCount: 1 });
                        }
                        if (queryText.includes('UPDATE users SET booster_level')) {
                            return Promise.resolve({ rows: [], rowCount: 1 });
                        }
                        if (queryText.includes('INSERT INTO notifications')) {
                            return Promise.resolve({ rows: [], rowCount: 1 });
                        }
                        if (queryText.includes('SELECT username, email FROM users')) {
                            return Promise.resolve({ rows: [{ username: 'Plataforma WintonCoin', email: 'admin@wintoncoin.com' }, { username: 'colaborador_test', email: 'worker@test.com' }], rowCount: 2 });
                        }
                    }
                    return Promise.resolve({ rows: [], rowCount: 0 });
                })
            };

            // Simular publicación que tenía blue_cost congelado previamente en 90 (etapa previa de 9x con base 10)
            const acceptance = {
                blue_cost: '90.0000',
                base_blue_cost: '10.0000', // Costo base nominal
                title: 'Misión de Prueba Multiplicador Dinámico',
                author_username: 'Plataforma WintonCoin',
                author_id: 1,
                workerUsername: 'colaborador_test',
                workerId: 77,
                is_booster_task: true,
                category: 'request'
            };

            const settings = {
                pre_launch_mode_enabled: 'true',
                debt_cycle_days: '30',
                blue_escrow_days: '1'
            };

            const result = await processRequestPayment(mockClient, acceptance, 101, true, settings);

            expect(result.success).toBe(true);
            expect(result.web3IntentId).toBeNull();

            // Verificar que se acreditó con el nuevo multiplicador (10 * 8.0 = 80) y NO con el congelado (90)
            const recordBoosterCall = mockClient.query.mock.calls.find(c => typeof c[0] === 'string' && c[0].includes('record_booster_event'));
            expect(recordBoosterCall).toBeDefined();
            expect(recordBoosterCall[1][1]).toBe(80); // 10 * 8.0
        });
    });

    describe('2. Endpoint /api/quick-sale en Modo Pre-Lanzamiento (Hallazgo 2)', () => {
        let app;
        let mockPool;

        beforeEach(() => {
            app = express();
            app.use(express.json());

            mockPool = {
                connect: jest.fn().mockResolvedValue({
                    query: jest.fn().mockImplementation((queryText) => {
                        if (queryText.includes('pre_launch_mode_enabled')) {
                            return Promise.resolve({
                                rows: [
                                    { setting_key: 'allow_quick_sale_publications', setting_value: 'true' },
                                    { setting_key: 'pre_launch_mode_enabled', setting_value: 'true' }
                                ]
                            });
                        }
                        return Promise.resolve({ rows: [] });
                    }),
                    release: jest.fn()
                })
            };

            const router = express.Router();
            const mockRequireAcceptedLegal = (fields) => (req, res, next) => next();
            const mockVerifyAdminToken = (req, res, next) => next();
            const mockLogAuditEvent = jest.fn().mockResolvedValue(true);

            publicationController(router, mockPool, mockRequireAcceptedLegal, mockVerifyAdminToken, mockLogAuditEvent);
            app.use('/', router);
        });

        test('Debe rechazar con 403 si pre_launch_mode_enabled es true', async () => {
            const res = await request(app)
                .post('/api/quick-sale')
                .send({
                    amount: '25.0',
                    title: 'Venta Express Test',
                    authorUsername: 'usuario_comun'
                });

            expect(res.statusCode).toBe(403);
            expect(res.body.message).toMatch(/La creación de Ventas Rápidas está desactivada durante la fase de pre-lanzamiento/);
        });
    });

    describe('3. Endpoint /publish en Modo Pre-Lanzamiento (Hallazgos 5 y 6)', () => {
        let app;
        let mockPool;

        beforeEach(() => {
            app = express();
            app.use(express.json());

            mockPool = {
                connect: jest.fn().mockResolvedValue({
                    query: jest.fn().mockImplementation((queryText, params) => {
                        if (typeof queryText === 'string') {
                            if (queryText.includes('app_settings WHERE setting_key = ANY')) {
                                return Promise.resolve({
                                    rows: [
                                        { setting_key: 'allow_request_publications', setting_value: 'true' },
                                        { setting_key: 'allow_sell_publications', setting_value: 'true' },
                                        { setting_key: 'allow_donation_publications', setting_value: 'true' },
                                        { setting_key: 'pre_launch_mode_enabled', setting_value: 'true' },
                                        { setting_key: 'platform_username', setting_value: 'Plataforma WintonCoin' }
                                    ]
                                });
                            }
                            if (queryText.includes('BEGIN') || queryText.includes('ROLLBACK')) {
                                return Promise.resolve({ rows: [] });
                            }
                        }
                        return Promise.resolve({ rows: [] });
                    }),
                    release: jest.fn()
                })
            };

            const router = express.Router();
            const mockRequireAcceptedLegal = (fields) => (req, res, next) => next();
            const mockVerifyAdminToken = (req, res, next) => next();
            const mockLogAuditEvent = jest.fn().mockResolvedValue(true);

            publicationController(router, mockPool, mockRequireAcceptedLegal, mockVerifyAdminToken, mockLogAuditEvent);
            app.use('/', router);
        });

        test('Debe rechazar publicaciones de donación de usuarios normales si pre-lanzamiento está activo', async () => {
            const res = await request(app)
                .post('/publish')
                .send({
                    title: 'Causa Solidaria Usuario',
                    description: 'Descripción de prueba',
                    publicationType: 'donation',
                    goalAmount: '500',
                    beneficiaryReferralCode: 'REF123',
                    authorUsername: 'usuario_regular'
                });

            expect(res.statusCode).toBe(403);
            expect(res.body.message).toMatch(/La creación de publicaciones generales está restringida durante la fase de pre-lanzamiento/);
        });
    });

    describe('4. Ocultamiento y Pausa Dinámica al Desactivar Pre-Lanzamiento (Transición Web3)', () => {
        let app;
        let mockPool;

        beforeEach(() => {
            app = express();
            app.use(express.json());

            mockPool = {
                connect: jest.fn().mockResolvedValue({
                    query: jest.fn().mockImplementation((queryText, params) => {
                        if (typeof queryText === 'string') {
                            if (queryText.includes('app_settings WHERE setting_key IN')) {
                                return Promise.resolve({
                                    rows: [
                                        { setting_key: 'pre_launch_mode_enabled', setting_value: 'false' }, // DESACTIVADO
                                        { setting_key: 'platform_username', setting_value: 'Plataforma WintonCoin' }
                                    ]
                                });
                            }
                            if (queryText.includes('users WHERE username = $1')) {
                                return Promise.resolve({
                                    rows: [{ id: 10, is_minor: false, web3_wallet_address: '0x123', kyc_verified: true, account_status: 'active' }],
                                    rowCount: 1
                                });
                            }
                            if (queryText.includes('publications p') && queryText.includes('FOR UPDATE')) {
                                return Promise.resolve({
                                    rows: [{
                                        id: 99,
                                        author_username: 'Plataforma WintonCoin',
                                        is_paused: false,
                                        is_booster_task: false,
                                        category: 'request'
                                    }],
                                    rowCount: 1
                                });
                            }
                            if (queryText.includes('SELECT') && queryText.includes('publications p')) {
                                return Promise.resolve({
                                    rows: [
                                        {
                                            id: 1,
                                            title: 'Tarea General Plataforma (Sin booster)',
                                            author_username: 'Plataforma WintonCoin',
                                            is_booster_task: false,
                                            blue_cost: '50',
                                            base_blue_cost: '50'
                                        },
                                        {
                                            id: 2,
                                            title: 'Tarea Especial de Impulsor',
                                            author_username: 'Plataforma WintonCoin',
                                            is_booster_task: true,
                                            blue_cost: '100',
                                            base_blue_cost: '100'
                                        },
                                        {
                                            id: 3,
                                            title: 'Publicación de Usuario Real Web3',
                                            author_username: 'usuario_comercial',
                                            is_booster_task: false,
                                            blue_cost: '20',
                                            base_blue_cost: '20'
                                        }
                                    ]
                                });
                            }
                            if (queryText.includes('BEGIN') || queryText.includes('ROLLBACK')) {
                                return Promise.resolve({ rows: [] });
                            }
                        }
                        return Promise.resolve({ rows: [] });
                    }),
                    release: jest.fn()
                }),
                query: jest.fn().mockImplementation((queryText, params) => {
                    if (typeof queryText === 'string') {
                        if (queryText.includes('app_settings WHERE setting_key IN')) {
                            return Promise.resolve({
                                rows: [
                                    { setting_key: 'pre_launch_mode_enabled', setting_value: 'false' }, // DESACTIVADO
                                    { setting_key: 'platform_username', setting_value: 'Plataforma WintonCoin' }
                                ]
                            });
                        }
                        if (queryText.includes('SELECT') && queryText.includes('publications p')) {
                            return Promise.resolve({
                                rows: [
                                    {
                                        id: 1,
                                        title: 'Tarea General Plataforma (Sin booster)',
                                        author_username: 'Plataforma WintonCoin',
                                        is_booster_task: false,
                                        blue_cost: '50',
                                        base_blue_cost: '50'
                                    },
                                    {
                                        id: 2,
                                        title: 'Tarea Especial de Impulsor',
                                        author_username: 'Plataforma WintonCoin',
                                        is_booster_task: true,
                                        blue_cost: '100',
                                        base_blue_cost: '100'
                                    },
                                    {
                                        id: 3,
                                        title: 'Publicación de Usuario Real Web3',
                                        author_username: 'usuario_comercial',
                                        is_booster_task: false,
                                        blue_cost: '20',
                                        base_blue_cost: '20'
                                    }
                                ]
                            });
                        }
                    }
                    return Promise.resolve({ rows: [] });
                })
            };

            const router = express.Router();
            const mockRequireAcceptedLegal = (fields) => (req, res, next) => next();
            const mockVerifyAdminToken = (req, res, next) => next();
            const mockLogAuditEvent = jest.fn().mockResolvedValue(true);

            publicationController(router, mockPool, mockRequireAcceptedLegal, mockVerifyAdminToken, mockLogAuditEvent);
            app.use('/', router);
        });

        test('Debe ocultar del feed activo publicaciones de la plataforma sin is_booster_task al desactivar pre-lanzamiento', async () => {
            const res = await request(app)
                .get('/publications/active?user=usuario_comercial');

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);

            // Tarea 1 (plataforma sin booster) DEBE haber sido filtrada/ocultada
            const platformNormalPub = res.body.find(p => p.id === 1);
            expect(platformNormalPub).toBeUndefined();

            // Tarea 2 (plataforma con is_booster_task = true) DEBE permanecer vigente
            const platformBoosterPub = res.body.find(p => p.id === 2);
            expect(platformBoosterPub).toBeDefined();

            // Tarea 3 (usuario comercial ordinario) DEBE permanecer visible
            const userPub = res.body.find(p => p.id === 3);
            expect(userPub).toBeDefined();
        });

        test('Debe rechazar la aceptación de una tarea de plataforma sin is_booster_task si pre-lanzamiento está apagado', async () => {
            const res = await request(app)
                .post('/publications/99/accept')
                .send({
                    acceptorUsername: 'usuario_colaborador'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/se encuentra en pausa temporalmente mientras la plataforma opera en modo blockchain/);
        });
    });

});
