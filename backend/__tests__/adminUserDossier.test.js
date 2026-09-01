/**
 * Pruebas Unitarias para el Expediente de Usuario 360° (adminUserDossier.test.js)
 * ════════════════════════════════════════════════════════════════════════════════════════
 * Valida la seguridad, segregación de datos, auditoría SOC 2 ("Auditar al Auditor")
 * y la estructura de la Ficha 360° en adminUserController.
 * ════════════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

// 1. Mock de dependencias
const mockQuery = jest.fn();
jest.mock('../src/config/db', () => ({
    query: (...args) => mockQuery(...args),
    connect: jest.fn(),
    on: jest.fn()
}));

const mockLogAuditEvent = jest.fn().mockResolvedValue(true);
jest.mock('../src/services/auditService', () => ({
    logAuditEvent: (...args) => mockLogAuditEvent(...args)
}));

const { getUserDossier360 } = require('../src/controllers/admin/adminUserController');

describe('getUserDossier360 — Ficha de Auditoría de Usuario 360°', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('1. Debe responder 404 si el usuario no existe en la base de datos', async () => {
        mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

        const req = { params: { userId: '99999' }, user: { username: 'superadmin' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await getUserDossier360(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Usuario no encontrado')
        }));
    });

    it('2. Debe retornar 200 con la estructura 360° completa y registrar evento en audit_log', async () => {
        // Mock de usuario base encontrado
        mockQuery.mockResolvedValueOnce({
            rowCount: 1,
            rows: [{
                id: 42,
                username: 'carolaydia_641',
                email: 'carolay@example.com',
                phone_number: '+584120001122',
                account_status: 'active',
                liquid_blue_balance: '150.5000',
                escrow_blue_balance: '10.0000',
                red_balance: '0.0000',
                average_rating: '4.8',
                ratings_count: 12,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                referral_code: 'CAROL2026',
                referrer_id: 1,
                referrer_username: 'sponsor_user',
                web3_wallet_address: '0x19a28b030f895cba89736c0a0c4fec8e5454fecf',
                kyc_verified: true,
                is_minor: false,
                tutor_id: null,
                tutor_username: null,
                trust_score: 85,
                trust_score_level: 'Gold',
                sos_dossier: 'SOS-VZLA-2532-00008',
                vol_dossier: null
            }]
        });

        // Mocks de las consultas concurrentes
        mockQuery.mockResolvedValueOnce({ rows: [{ booster_blue_balance: '200.0000' }] }); // booster balance
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, type: 'payment_received', amount: 50 }] }); // web3 txs
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, type: 'referral_bonus', amount: 20 }] }); // booster txs
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 10, title: 'Tarea de Prueba', blue_cost: 15 }] }); // publications created
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 20, publication_title: 'Trabajo Realizado', status: 'completed' }] }); // tasks accepted
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, referred_username: 'invitado_1', kyc_verified: true }] }); // referrals
        mockQuery.mockResolvedValueOnce({ rows: [] }); // debts
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 5, dossier_number: 'SOS-VZLA-2532-00008', full_name: 'Carolay D' }] }); // sos victim
        mockQuery.mockResolvedValueOnce({ rows: [] }); // sos disbursements
        mockQuery.mockResolvedValueOnce({ rows: [] }); // volunteer
        mockQuery.mockResolvedValueOnce({ rows: [] }); // causes
        mockQuery.mockResolvedValueOnce({ rows: [] }); // donations
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, event_type: 'user.login', created_at: new Date() }] }); // audit events
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, document_type: 'terms_of_service', document_version: 'v1.0' }] }); // legal acceptances

        const req = { 
            params: { userId: '42' }, 
            user: { username: 'admin_auditor' },
            ip: '192.168.1.50'
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await getUserDossier360(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const responseData = res.json.mock.calls[0][0];

        expect(responseData.success).toBe(true);
        expect(responseData.dossier).toBeDefined();
        expect(responseData.dossier.profile.username).toBe('carolaydia_641');
        expect(responseData.dossier.balances.liquid_blue_balance).toBe(150.5);
        expect(responseData.dossier.balances.booster_blue_balance).toBe(200);
        expect(responseData.dossier.web3_transactions.length).toBe(1);
        expect(responseData.dossier.publications_created.length).toBe(1);
        expect(responseData.dossier.tasks_accepted.length).toBe(1);
        expect(responseData.dossier.referrals.length).toBe(1);
        expect(responseData.dossier.sos_case).toBeDefined();
        expect(responseData.dossier.sos_case.dossier_number).toBe('SOS-VZLA-2532-00008');

        // Verificar el cumplimiento de "Auditar al Auditor" (SOC 2 Type II)
        expect(mockLogAuditEvent).toHaveBeenCalledWith(
            expect.anything(),
            req,
            expect.objectContaining({
                eventType: 'admin.user.view_dossier',
                actorUsername: 'admin_auditor',
                targetUsername: 'carolaydia_641',
                category: 'compliance'
            })
        );
    });

    it('3. Garantía Zero Hardcoded Secrets: Nunca debe retornar hashes de contraseña', async () => {
        mockQuery.mockResolvedValueOnce({
            rowCount: 1,
            rows: [{
                id: 10,
                username: 'security_test_user',
                email: 'test@wintoncoin.com',
                account_status: 'active',
                password_hash: '$2b$10$supersecretneverleakthis1234567890',
                liquid_blue_balance: 0,
                escrow_blue_balance: 0,
                red_balance: 0,
                created_at: new Date()
            }]
        });

        // Completar mocks de consultas secundarias vacías
        for (let i = 0; i < 14; i++) {
            mockQuery.mockResolvedValueOnce({ rows: [] });
        }

        const req = { params: { userId: '10' }, user: { username: 'admin' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await getUserDossier360(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const jsonOutput = JSON.stringify(res.json.mock.calls[0][0]);
        expect(jsonOutput).not.toContain('supersecretneverleakthis');
        expect(jsonOutput).not.toContain('password_hash');
    });

});
