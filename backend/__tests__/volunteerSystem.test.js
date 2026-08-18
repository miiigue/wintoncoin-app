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
    sendPushToUser: jest.fn().mockResolvedValue(true),
    sendNotificationToUser: jest.fn().mockResolvedValue(true)
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
                country: 'Venezuela',
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
                country: 'Venezuela',
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

    test('6. Debe rechazar registro si se omite el país de residencia', async () => {
        const req = {
            body: {
                full_name: 'Carlos Ruiz',
                id_document: 'V-21123456',
                birth_date: '1992-03-20',
                gender: 'male',
                email: 'carlos@ejemplo.com',
                phone_number: '+584141234567',
                country: '', // País vacío
                state: 'Zulia',
                municipality: 'Maracaibo',
                sector_city: 'Bella Vista',
                volunteer_types: ['Tecnico'],
                availability: ['Fines de Semana'],
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
            message: expect.stringContaining('país de residencia')
        }));
    });

    test('7. Debe obtener la lista de voluntarios desde el panel de administración ordenados por Score de Prioridad', async () => {
        const mockVolunteers = [
            { id: 1, dossier_number: 'VOL-VZLA-4431-00001', full_name: 'Carlos Diaz', priority_score: 4431, country: 'Estados Unidos', status: 'pending_verification' },
            { id: 2, dossier_number: 'VOL-VZLA-1122-00002', full_name: 'Ana Lopez', priority_score: 1122, country: 'Costa Rica', status: 'active' }
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

    test('8. Debe permitir el reenvío de OTP para voluntario respetando el rate limit de cooldown', async () => {
        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({   // SELECT pending_verifications
                rows: [{
                    id: 99,
                    email: 'carlos@ejemplo.com',
                    last_sent_at: new Date(Date.now() - 70 * 1000), // Hace 70s (> 60s cooldown)
                    resend_count: 1
                }]
            })
            .mockResolvedValueOnce({}) // UPDATE pending_verifications
            .mockResolvedValueOnce({}); // COMMIT

        const req = {
            body: { email: 'carlos@ejemplo.com' }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await volunteerController.resendVolunteerOtpPublic(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            message: expect.stringContaining('Nuevo código de 6 dígitos enviado')
        }));
    });

    test('9. verifyVolunteerOtpPublic: Debe rechazar si falta el correo o el código OTP', async () => {
        const req = { body: { email: '', otp_code: '' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await volunteerController.verifyVolunteerOtpPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('Ingresa tu correo')
        }));
    });

    test('10. verifyVolunteerOtpPublic: Debe rechazar si la contraseña tiene menos de 8 caracteres o no coincide', async () => {
        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rows: [] }); // existingUserCheck (isExistingVerifiedUser = false)

        const req = {
            body: {
                email: 'carlos@ejemplo.com',
                otp_code: '123456',
                password: '123',
                password_confirm: '123'
            }
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await volunteerController.verifyVolunteerOtpPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('al menos 8 caracteres')
        }));
    });

    test('11. verifyVolunteerOtpPublic: Debe rechazar si el código OTP es incorrecto e incrementar intentos', async () => {
        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rows: [] }) // existingUserCheck
            .mockResolvedValueOnce({ // pending_verifications
                rows: [{
                    id: 10,
                    verification_code_hash: 'correcthash',
                    verification_attempts: 1
                }]
            })
            .mockResolvedValueOnce({}) // UPDATE verification_attempts
            .mockResolvedValueOnce({}); // COMMIT

        const emailService = require('../src/services/emailService');
        const origSafe = emailService.safeEqualHex;
        emailService.safeEqualHex = () => false; // Simular hash incorrecto

        const req = {
            body: {
                email: 'carlos@ejemplo.com',
                otp_code: '999999',
                password: 'password123',
                password_confirm: 'password123'
            }
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await volunteerController.verifyVolunteerOtpPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('Código de verificación de 6 dígitos incorrecto')
        }));

        emailService.safeEqualHex = origSafe;
    });

    test('12. verifyVolunteerOtpPublic: Debe bloquear por fuerza bruta tras 5 intentos fallidos', async () => {
        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rows: [] }) // existingUserCheck
            .mockResolvedValueOnce({ // pending_verifications
                rows: [{
                    id: 10,
                    verification_code_hash: 'mockhash',
                    verification_attempts: 5 // Límite alcanzado
                }]
            })
            .mockResolvedValueOnce({}) // DELETE pending_verifications
            .mockResolvedValueOnce({}); // COMMIT

        const req = {
            body: {
                email: 'carlos@ejemplo.com',
                otp_code: '123456',
                password: 'password123',
                password_confirm: 'password123'
            }
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await volunteerController.verifyVolunteerOtpPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('Demasiados intentos fallidos')
        }));
    });

    test('13. verifyVolunteerOtpPublic: Debe activar la cuenta con éxito, otorgar bono y retornar sesión JWT', async () => {
        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rows: [] }) // existingUserCheck
            .mockResolvedValueOnce({ // pending_verifications
                rows: [{
                    id: 10,
                    verification_code_hash: 'mockhash',
                    verification_attempts: 0,
                    referral_code: 'SOSVENEZUELA'
                }]
            })
            .mockResolvedValueOnce({}) // UPDATE users (password_hash, is_verified)
            .mockResolvedValueOnce({ rows: [{ id: 5, username: 'carlos_vol' }] }) // SELECT users
            .mockResolvedValueOnce({ rows: [{ setting_value: 'SOSVENEZUELA' }] }) // SELECT app_settings
            .mockResolvedValueOnce({ rows: [{ id: 1, dossier_number: 'VOL-VZLA-4431-00001' }] }) // SELECT volunteers_registry
            .mockResolvedValueOnce({}) // INSERT volunteer_activity_history
            .mockResolvedValueOnce({}) // DELETE pending_verifications
            .mockResolvedValueOnce({}); // COMMIT

        const req = {
            body: {
                email: 'carlos@ejemplo.com',
                otp_code: '123456',
                password: 'password123',
                password_confirm: 'password123'
            }
        };
        const res = {
            cookie: jest.fn(),
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await volunteerController.verifyVolunteerOtpPublic(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            dossier_number: 'VOL-VZLA-4431-00001',
            reward_amount: 200,
            token: expect.any(String)
        }));
    });

    test('14. resendVolunteerOtpPublic: Debe rechazar reenvío si no ha cumplido el cooldown de 60 segundos', async () => {
        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({   // SELECT pending_verifications
                rows: [{
                    id: 99,
                    email: 'carlos@ejemplo.com',
                    last_sent_at: new Date(Date.now() - 20 * 1000), // Hace 20s (< 60s cooldown)
                    resend_count: 1
                }]
            })
            .mockResolvedValueOnce({}); // ROLLBACK

        const req = { body: { email: 'carlos@ejemplo.com' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await volunteerController.resendVolunteerOtpPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('segundos antes de solicitar otro código')
        }));
    });

    test('15. resendVolunteerOtpPublic: Debe rechazar reenvío si se alcanza el límite de 5 intentos por sesión', async () => {
        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({   // SELECT pending_verifications
                rows: [{
                    id: 99,
                    email: 'carlos@ejemplo.com',
                    last_sent_at: new Date(Date.now() - 70 * 1000),
                    resend_count: 5 // Máximo alcanzado
                }]
            })
            .mockResolvedValueOnce({}); // ROLLBACK

        const req = { body: { email: 'carlos@ejemplo.com' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await volunteerController.resendVolunteerOtpPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('límite máximo de reenvíos permitidos')
        }));
    });

    test('16. updateVolunteerStatusAdmin: Debe rechazar estatus inválido y procesar estatus activo con auditoría', async () => {
        // Caso inválido
        const invalidReq = {
            params: { id: 1 },
            body: { status: 'estado_invalido' }
        };
        const invalidRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await volunteerController.updateVolunteerStatusAdmin(invalidReq, invalidRes);
        expect(invalidRes.status).toHaveBeenCalledWith(400);

        // Caso válido a 'active'
        pool.query
            .mockResolvedValueOnce({ // SELECT volunteers_registry
                rows: [{ id: 1, full_name: 'Carlos Diaz', dossier_number: 'VOL-VZLA-4431-00001', user_id: 5, email: 'carlos@ejemplo.com' }]
            })
            .mockResolvedValueOnce({}) // UPDATE volunteers_registry
            .mockResolvedValueOnce({}); // INSERT volunteer_activity_history

        const validReq = {
            params: { id: 1 },
            body: { status: 'active', admin_notes: 'Verificado por directiva' },
            admin: { username: 'superadmin' }
        };
        const validRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await volunteerController.updateVolunteerStatusAdmin(validReq, validRes);

        expect(validRes.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            message: expect.stringContaining('Activo / Aprobado')
        }));
    });
});
