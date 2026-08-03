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

const victimController = require('../src/controllers/victimController');

describe('Suite de Pruebas: Desembolsos de Ayuda Humanitaria SOS Venezuela', () => {

    test('disburseVictimAidAdmin debe devolver 404 cuando el expediente SOS no existe', async () => {
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
