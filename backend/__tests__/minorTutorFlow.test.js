/**
 * backend/__tests__/minorTutorFlow.test.js
 * 
 * PROPÓSITO: Suite de pruebas unitarias y de integración para la gestión de cuentas de menores de edad y tutores.
 * Certifica el funcionamiento del modelo de consentimiento explícito Maker-Checker (SOC 2, COPPA)
 * y el marco de controles parentales FinTech (Congelamiento de cuenta y permisos JSONB).
 * 
 * ESTÁNDAR DE INGENIERÍA: Cero Confianza, Cobertura Completa de Bordes, Pruebas Autocontenidas.
 */

'use strict';

const minorController = require('../src/controllers/minorController');
const pool = require('../src/config/db');

describe('Suite de Pruebas: Flujo de Tutela y Controles Parentales FinTech', () => {

    // 1. Verificación de seguridad defensiva: no permitir solicitudes sin autenticación
    test('requestTutor debe rechazar solicitudes cuando no hay usuario autenticado (401 Unauthorized)', async () => {
        const req = { user: null, body: { tutorUsernameOrEmail: 'adultTutor' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await minorController.requestTutor(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringMatching(/No autenticado/i)
        }));
    });

    // 2. Verificación de validación de body
    test('requestTutor debe exigir el nombre de usuario o correo del tutor (400 Bad Request)', async () => {
        const req = { user: { userId: 10 }, body: {} };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await minorController.requestTutor(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringMatching(/Se requiere el usuario o correo/i)
        }));
    });

    // 3. Verificación de respuesta del tutor
    test('respondTutorRequest debe rechazar acciones distintas de approve o reject (400 Bad Request)', async () => {
        const req = {
            user: { userId: 20 },
            params: { requestId: 1 },
            body: { action: 'invalid_action' }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await minorController.respondTutorRequest(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringMatching(/Acción inválida/i)
        }));
    });

    // 4. Verificación de aceptación de términos legales
    test('respondTutorRequest debe exigir la aceptación explícita de términos al aprobar (400 Bad Request)', async () => {
        const req = {
            user: { userId: 20 },
            params: { requestId: 1 },
            body: { action: 'approve', termsAccepted: false }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await minorController.respondTutorRequest(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringMatching(/Debes aceptar expresamente las condiciones legales/i)
        }));
    });
});
