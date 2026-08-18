/**
 * Suite de Pruebas Unitarias del Sistema de Voluntariado SOS Venezuela
 * ════════════════════════════════════════════════════════════════════════════════
 * Valida la lógica de negocio, cálculo de código de expediente de 4 dígitos,
 * prioridad de voluntariado, normalización de cédula/teléfono, validaciones de edad,
 * consentimientos legales, reanudación inteligente (Smart Resume) y endpoints de administración.
 * ════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

process.env.JWT_SECRET = 'test-secret-key-12345';
process.env.ADMIN_SECRET_KEY = 'admin-secret-key-12345';

const mockClient = {
    query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    release: jest.fn()
};

jest.mock('../src/config/db', () => ({
    query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    connect: jest.fn().mockResolvedValue(mockClient),
    on: jest.fn()
}));

jest.mock('../src/services/auditService', () => ({
    logAuditEvent: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/services/emailService', () => ({
    generateOtp6: () => '123456',
    hashOtpForEmail: () => 'mockhash',
    safeEqualHex: (a, b) => a === b,
    sendOtpEmail: jest.fn().mockResolvedValue(true),
    sendCustomEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/services/notificationService', () => ({
    sendPushToUser: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/services/referralRewardService', () => ({
    processReferralReward: jest.fn().mockResolvedValue({ rewardProcessed: true, rewardAmount: 200 })
}));

const volunteerController = require('../src/controllers/volunteerController');
const pool = require('../src/config/db');

describe('Pruebas del Módulo de Registro de Voluntarios SOS - Algoritmo y Cobertura Completa', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.query.mockResolvedValue({ rowCount: 0, rows: [] });
    });

    test('1. Debe calcular el código inteligente de voluntario de 4 dígitos (D1, D2, D3, D4) y Score de Prioridad', () => {
        const types = ['Campo / Despliegue en Sitio'];
        const avail = ['Tiempo Completo (Disponibilidad Inmediata 24/7)'];
        const birthDate = '2008-01-01';
        const gender = 'male';
        const seq = 1;

        const { dossierNumber, priorityScore, D1, D2, D3, D4 } = volunteerController.calculateSmartVolunteerCode(
            types, avail, birthDate, gender, seq
        );

        expect(D1).toBe(4);
        expect(D2).toBe(4);
        expect(D4).toBe(1);
        expect(priorityScore).toBe(D1 * 1000 + D2 * 100 + D3 * 10 + D4);
        expect(dossierNumber).toMatch(/^VOL-VZLA-44\d1-00001$/);
    });

    test('2. Debe calcular el rango de edad D3 correctamente (1 = 18-19 años)', () => {
        const calculateAgeRangeD3 = volunteerController.calculateAgeRangeD3;
        expect(calculateAgeRangeD3(18)).toBe(1);
        expect(calculateAgeRangeD3(19)).toBe(1);
        expect(calculateAgeRangeD3(20)).toBe(2);
        expect(calculateAgeRangeD3(25)).toBe(2);
        expect(calculateAgeRangeD3(35)).toBe(3);
        expect(calculateAgeRangeD3(45)).toBe(4);
        expect(calculateAgeRangeD3(55)).toBe(5);
        expect(calculateAgeRangeD3(65)).toBe(6);
        expect(calculateAgeRangeD3(75)).toBe(7);
        expect(calculateAgeRangeD3(85)).toBe(8);
        expect(calculateAgeRangeD3(95)).toBe(9);
    });

    test('3. Debe normalizar cédula y teléfono correctamente (nacional e internacional)', () => {
        expect(volunteerController.normalizeIdDocument('12345678')).toBe('V-12345678');
        expect(volunteerController.normalizeIdDocument('v-87654321')).toBe('V-87654321');
        expect(volunteerController.normalizePhone('04141234567')).toBe('+584141234567');
        expect(volunteerController.normalizePhone('+584129876543')).toBe('+584129876543');
        expect(volunteerController.normalizePhone('+1 305 123 4567')).toBe('+13051234567');
        expect(volunteerController.normalizePhone('+34 612 34 56 78')).toBe('+34612345678');
        expect(volunteerController.normalizePhone('+57 300 123 4567')).toBe('+573001234567');
    });

    test('4. Debe rechazar registro si el aspirante es menor de 18 años', async () => {
        const req = {
            body: {
                full_name: 'Juan Perez',
                id_document: 'V-30123456',
                birth_date: '2010-05-15',
                gender: 'male',
                email: 'menor@ejemplo.com',
                phone_number: '+584121234567',
                state: 'Carabobo',
                municipality: 'Valencia',
                sector_city: 'Centro',
                volunteer_types: ['Campo'],
                availability: ['Tiempo Completo'],
                data_consent_accepted: true,
                legal_disclaimer_accepted: true
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await volunteerController.registerVolunteerPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('Debes ser mayor de edad')
        }));
    });

    test('5. Debe rechazar registro sin aceptación de consentimientos legales', async () => {
        const req = {
            body: {
                full_name: 'Maria Gomez',
                id_document: 'V-20123456',
                birth_date: '1995-05-15',
                gender: 'female',
                email: 'maria@ejemplo.com',
                phone_number: '+584121234567',
                state: 'Miranda',
                municipality: 'Chacao',
                sector_city: 'Altamira',
                volunteer_types: ['Salud'],
                availability: ['Tiempo Parcial'],
                data_consent_accepted: false, // Sin consentimiento
                legal_disclaimer_accepted: true
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await volunteerController.registerVolunteerPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('Debes aceptar la autorización de tratamiento de datos')
        }));
    });

    test('6. Debe obtener la lista de voluntarios desde el panel de administración ordenados por Score de Prioridad', async () => {
        const mockVolunteers = [
            { id: 1, dossier_number: 'VOL-VZLA-4431-00001', full_name: 'Carlos Diaz', priority_score: 4431, status: 'pending_verification' },
            { id: 2, dossier_number: 'VOL-VZLA-1122-00002', full_name: 'Ana Lopez', priority_score: 1122, status: 'active' }
        ];

        pool.query
            .mockResolvedValueOnce({ rows: [{ count: '2' }] })
            .mockResolvedValueOnce({ rows: mockVolunteers });

        const req = { query: {} };
        const res = {
            json: jest.fn()
        };

        await volunteerController.getVolunteersAdmin(req, res);

        expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY v.priority_score DESC'), expect.any(Array));
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            volunteers: mockVolunteers
        }));
    });
});
