/**
 * Suite de Pruebas Unitarias de Expedientes SOS Venezuela y Jerarquía de 4 Dígitos
 * ════════════════════════════════════════════════════════════════════════════════
 * Valida la lógica de negocio, cálculo de urgencia de 4 dígitos (Gravedad, Cargas, Edad, Sexo),
 * normalización de Cédula de Identidad venezolana y formato telefónico +58.
 * ════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

process.env.JWT_SECRET = 'test-secret-key-12345';
process.env.ADMIN_SECRET_KEY = 'admin-secret-key-12345';

jest.mock('../src/config/db', () => {
    const mClient = {
        query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
        release: jest.fn()
    };
    return {
        query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
        connect: jest.fn().mockResolvedValue(mClient),
        on: jest.fn()
    };
});

jest.mock('../src/services/auditService', () => ({
    logAuditEvent: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/services/emailService', () => ({
    generateOtp6: () => '123456',
    hashOtpForEmail: () => 'mockhash',
    sendOtpEmail: jest.fn().mockResolvedValue(true),
    sendCustomEmail: jest.fn().mockResolvedValue(true)
}));

const victimController = require('../src/controllers/victimController');

describe('Pruebas del Sistema SOS Venezuela - Algoritmo de 4 Dígitos y Normalización', () => {

    test('1. Debe calcular el código de urgencia de 4 dígitos correctamente (Gravedad, Cargas, Edad, Sexo)', () => {
        // Gravedad total_loss (4), 3 cargas (3), edad 35 (rango 30-39 => 3), mujer (2)
        const { smartCode, urgencyScore } = victimController.calculateSmartDossierCode('total_loss', 2, 1, 0, 35, 'female', 1);
        expect(smartCode).toBe('SOS-VZLA-4332-00001');
        expect(urgencyScore).toBe(4332);
    });

    test('2. Debe normalizar cédulas venezolanas agregando el prefijo V- por defecto', () => {
        expect(victimController.normalizeIdDocument('12345678')).toBe('V-12345678');
        expect(victimController.normalizeIdDocument('v-87654321')).toBe('V-87654321');
        expect(victimController.normalizeIdDocument('E-99999999')).toBe('E-99999999');
    });

    test('3. Debe normalizar números telefónicos venezolanos agregando el prefijo +58', () => {
        expect(victimController.normalizePhone('04141234567')).toBe('+584141234567');
        expect(victimController.normalizePhone('+584129876543')).toBe('+584129876543');
    });

    test('4. Debe validar la verificación de código de referido en SystemController (Código Existente y No Existente)', async () => {
        const SystemController = require('../src/controllers/systemController');
        const db = require('../src/config/db');

        // Mock para código existente
        db.query.mockResolvedValueOnce({ rows: [{ id: 10, username: 'CadenaSOSVenezuela' }] });
        const reqExist = { query: { code: 'SOSVENEZUELADEMO' }, body: {} };
        const resExist = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        await SystemController.verifyReferralCode(reqExist, resExist);
        expect(resExist.status).toHaveBeenCalledWith(200);
        expect(resExist.json).toHaveBeenCalledWith({ valid: true, username: 'CadenaSOSVenezuela' });

        // Mock para código no existente
        db.query.mockResolvedValueOnce({ rows: [] });
        const reqInvalid = { query: { code: 'CODIGOINEXISTENTE' }, body: {} };
        const resInvalid = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        await SystemController.verifyReferralCode(reqInvalid, resInvalid);
        expect(resInvalid.status).toHaveBeenCalledWith(200);
        expect(resInvalid.json).toHaveBeenCalledWith({ valid: false, message: 'El código de referido no existe' });
    });
});
