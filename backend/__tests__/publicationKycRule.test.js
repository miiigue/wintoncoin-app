/**
 * backend/__tests__/publicationKycRule.test.js
 *
 * PROPÓSITO:
 * Pruebas unitarias para validar la regla regulatoria de KYC y pagos blockchain:
 * - Si prelanzamiento está DESACTIVADO y el pago es en blockchain:
 *   Un usuario sin KYC aprobado NO puede aceptar la tarea (HTTP 403 KYC_REQUIRED_FOR_ONCHAIN_TASKS).
 * - Excepción única: Tareas de la plataforma que pagan en BLUE IOU off-chain (is_booster_task = true).
 * - Si el usuario tiene KYC aprobado, puede aceptar la tarea on-chain.
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

jest.mock('../src/services/boosterService', () => ({
    calculateMultipliedAmount: jest.fn().mockImplementation(() => Promise.resolve({
        multiplier: 1.0,
        stageName: 'Prueba KYC'
    }))
}));

jest.mock('../src/services/web3BridgeService', () => ({
    checkUserKYC: jest.fn().mockImplementation((wallet) => {
        if (wallet === '0xKYC_VERIFIED_WALLET') return Promise.resolve(true);
        return Promise.resolve(false);
    })
}));

const publicationController = require('../src/controllers/publicationController');

describe('Regla Regulatoria KYC para Aceptación de Tareas On-Chain', () => {
    let app;
    let mockPool;
    let mockClient;
    let mockLogAuditEvent;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };

        mockPool = {
            query: jest.fn(),
            connect: jest.fn().mockResolvedValue(mockClient)
        };

        const mockRequireLegal = () => (req, res, next) => next();
        const mockVerifyAdmin = (req, res, next) => next();
        mockLogAuditEvent = jest.fn().mockResolvedValue(true);

        const router = express.Router();
        publicationController(router, mockPool, mockRequireLegal, mockVerifyAdmin, mockLogAuditEvent);
        app.use('/', router);
    });

    test('1. Bloqueo 403: Usuario sin KYC no puede aceptar tarea on-chain cuando prelanzamiento está desactivado', async () => {
        // Simular configuraciones con pre_launch_mode_enabled = 'false'
        mockClient.query.mockImplementation((sql, params) => {
            if (typeof sql === 'string' && sql.includes('FOR UPDATE')) {
                return Promise.resolve({
                    rows: [{
                        id: 10,
                        author_username: 'usuario_particular',
                        author_id: 2,
                        available_slots: 5,
                        is_paused: false,
                        category: 'request',
                        is_booster_task: false,
                        blue_cost: 50
                    }],
                    rowCount: 1
                });
            }
            if (typeof sql === 'string' && sql.includes('SELECT id, is_minor, tutor_user_id, account_status, web3_wallet_address, kyc_verified FROM users WHERE username = $1')) {
                return Promise.resolve({
                    rows: [{
                        id: 5,
                        is_minor: false,
                        web3_wallet_address: '0xUNVERIFIED_WALLET',
                        kyc_verified: false
                    }],
                    rowCount: 1
                });
            }
            if (typeof sql === 'string' && sql.includes('FROM app_settings')) {
                return Promise.resolve({
                    rows: [
                        { setting_key: 'pre_launch_mode_enabled', setting_value: 'false' },
                        { setting_key: 'platform_username', setting_value: 'Plataforma WintonCoin' }
                    ],
                    rowCount: 2
                });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const res = await request(app)
            .post('/publications/10/accept')
            .send({ acceptorUsername: 'usuario_sin_kyc' });

        expect(res.statusCode).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('KYC_REQUIRED_FOR_ONCHAIN_TASKS');
        expect(res.body.requires_kyc).toBe(true);
        // Auditoría: el rechazo debe quedar registrado (fuera de la transacción revertida)
        expect(mockLogAuditEvent).toHaveBeenCalledWith(
            mockPool,
            expect.anything(),
            expect.objectContaining({ eventType: 'publication.accept_blocked_kyc_required', actorUsername: 'usuario_sin_kyc' })
        );
    });

    test('2. Éxito: Usuario sin KYC SÍ puede aceptar tarea de la plataforma con pago BLUE IOU off-chain', async () => {
        mockClient.query.mockImplementation((sql, params) => {
            if (typeof sql === 'string' && sql.includes('FOR UPDATE')) {
                return Promise.resolve({
                    rows: [{
                        id: 20,
                        author_username: 'Plataforma WintonCoin',
                        author_id: 1,
                        available_slots: 10,
                        is_paused: false,
                        category: 'request',
                        is_booster_task: true, // Tarea de la plataforma off-chain
                        blue_cost: 100
                    }],
                    rowCount: 1
                });
            }
            if (typeof sql === 'string' && sql.includes('SELECT id, is_minor, tutor_user_id, account_status, web3_wallet_address, kyc_verified FROM users WHERE username = $1')) {
                return Promise.resolve({
                    rows: [{
                        id: 5,
                        is_minor: false,
                        web3_wallet_address: '0xUNVERIFIED_WALLET',
                        kyc_verified: false
                    }],
                    rowCount: 1
                });
            }
            if (typeof sql === 'string' && sql.includes('FROM app_settings')) {
                return Promise.resolve({
                    rows: [
                        { setting_key: 'pre_launch_mode_enabled', setting_value: 'false' },
                        { setting_key: 'platform_username', setting_value: 'Plataforma WintonCoin' }
                    ],
                    rowCount: 2
                });
            }
            if (typeof sql === 'string' && sql.includes('SELECT status, created_at FROM publication_acceptances')) {
                return Promise.resolve({ rows: [], rowCount: 0 });
            }
            if (typeof sql === 'string' && sql.includes('INSERT INTO publication_acceptances')) {
                return Promise.resolve({ rows: [{ id: 99 }], rowCount: 1 });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const res = await request(app)
            .post('/publications/20/accept')
            .send({ acceptorUsername: 'usuario_sin_kyc' });

        // No debe ser bloqueado por KYC; debe proceder
        expect(res.statusCode).not.toBe(403);
    });

    test('3. Éxito: Usuario con KYC aprobado puede aceptar tarea on-chain', async () => {
        mockClient.query.mockImplementation((sql, params) => {
            if (typeof sql === 'string' && sql.includes('FOR UPDATE')) {
                return Promise.resolve({
                    rows: [{
                        id: 30,
                        author_username: 'usuario_particular',
                        author_id: 2,
                        available_slots: 5,
                        is_paused: false,
                        category: 'request',
                        is_booster_task: false,
                        blue_cost: 50
                    }],
                    rowCount: 1
                });
            }
            if (typeof sql === 'string' && sql.includes('SELECT id, is_minor, tutor_user_id, account_status, web3_wallet_address, kyc_verified FROM users WHERE username = $1')) {
                return Promise.resolve({
                    rows: [{
                        id: 8,
                        is_minor: false,
                        web3_wallet_address: '0xKYC_VERIFIED_WALLET',
                        kyc_verified: true
                    }],
                    rowCount: 1
                });
            }
            if (typeof sql === 'string' && sql.includes('FROM app_settings')) {
                return Promise.resolve({
                    rows: [
                        { setting_key: 'pre_launch_mode_enabled', setting_value: 'false' },
                        { setting_key: 'platform_username', setting_value: 'Plataforma WintonCoin' }
                    ],
                    rowCount: 2
                });
            }
            if (typeof sql === 'string' && sql.includes('SELECT status, created_at FROM publication_acceptances')) {
                return Promise.resolve({ rows: [], rowCount: 0 });
            }
            if (typeof sql === 'string' && sql.includes('INSERT INTO publication_acceptances')) {
                return Promise.resolve({ rows: [{ id: 101 }], rowCount: 1 });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const res = await request(app)
            .post('/publications/30/accept')
            .send({ acceptorUsername: 'usuario_con_kyc' });

        expect(res.statusCode).not.toBe(403);
    });
});
