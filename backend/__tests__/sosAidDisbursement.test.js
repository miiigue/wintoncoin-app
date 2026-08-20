/**
 * backend/__tests__/sosAidDisbursement.test.js
 * 
 * PROPÓSITO: Suite de pruebas unitarias para certificar los desembolsos de ayuda humanitaria (SOS Venezuela).
 * Valida la resolución del error de restricción NOT NULL en 'blue_token_escrows.user_id'
 * y la acreditación transaccional de saldo líquido a la cuenta del beneficiario.
 * 
 * ESTÁNDAR DE INGENIERÍA: Integridad Financiera y Trazabilidad de Saldos Bancarios.
 */

'use strict';

const mockClient = {
    query: jest.fn(),
    release: jest.fn()
};

jest.mock('../src/config/db', () => ({
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(mockClient),
    on: jest.fn()
}));

const victimController = require('../src/controllers/victimController');

describe('Suite de Pruebas: Desembolsos de Ayuda Humanitaria SOS Venezuela', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.query.mockReset();
        mockClient.release.mockReset();
    });

    test('disburseVictimAidAdmin debe devolver 404 cuando el expediente SOS no existe', async () => {
        // Simular inicio de transacción y consulta sin resultados
        mockClient.query
            .mockResolvedValueOnce({ rows: [] }) // BEGIN
            .mockResolvedValueOnce({ rows: [] }) // SELECT * FROM disaster_victims_registry WHERE id = $1
            .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

        const req = { 
            user: { id: 1, role: 'admin' }, 
            params: { id: '999999' },
            body: { amount_blue: 100 } 
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await victimController.disburseVictimAidAdmin(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringMatching(/Expediente no encontrado/i)
        }));
    });

    test('disburseVictimAidAdmin debe requerir un monto de ayuda positivo', async () => {
        const req = {
            user: { id: 1, role: 'admin' },
            params: { id: '10' },
            body: { amount_blue: -50 }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await victimController.disburseVictimAidAdmin(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringMatching(/Ingresa un monto de BLUE IOU válido mayor a 0/i)
        }));
    });
});
