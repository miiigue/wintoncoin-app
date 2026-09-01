/**
 * Suite de Pruebas Unitarias e Integración Directa — Submódulos Administrativos
 * ════════════════════════════════════════════════════════════════════════════════════════
 * Vía de Verificación Estandarizada SOC 2 / ISO 27001
 * Valida la carga estática, resolución de firmas, tipos de función y compatibilidad del 100%
 * de cada uno de los 5 submódulos de administración aislados y su re-exportación por la Fachada.
 * ════════════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

process.env.JWT_SECRET = 'test-secret-key-12345';
process.env.ADMIN_SECRET_KEY = 'admin-secret-key-12345';
process.env.PLATFORM_USERNAME = 'Plataforma WintonCoin';

// Mockear el pool de PostgreSQL
jest.mock('../src/config/db', () => {
    const mClient = {
        query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
        release: jest.fn()
    };
    const mPool = {
        query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
        connect: jest.fn().mockResolvedValue(mClient),
        release: jest.fn(),
        on: jest.fn()
    };
    return mPool;
});

// Importación de la Fachada y los 5 Submódulos
const adminFacade = require('../src/controllers/adminController');
const adminAuthSecurityController = require('../src/controllers/admin/adminAuthSecurityController');
const adminUserController = require('../src/controllers/admin/adminUserController');
const adminPublicationsController = require('../src/controllers/admin/adminPublicationsController');
const adminSystemSettingsController = require('../src/controllers/admin/adminSystemSettingsController');
const adminAuditStatsController = require('../src/controllers/admin/adminAuditStatsController');
const adminMetricsController = require('../src/controllers/admin/adminMetricsController');

describe('Pruebas de Integridad de Submódulos Administrativos', () => {

    it('1. Submódulo Auth & Seguridad — Debe exportar 12 funciones válidas', () => {
        const keys = Object.keys(adminAuthSecurityController);
        expect(keys.length).toBe(12);
        keys.forEach(key => {
            expect(typeof adminAuthSecurityController[key]).toBe('function');
        });
    });

    it('2. Submódulo Usuarios & KYC — Debe exportar 7 funciones válidas (incluyendo getUserDossier360)', () => {
        const keys = Object.keys(adminUserController);
        expect(keys.length).toBe(7);
        keys.forEach(key => {
            expect(typeof adminUserController[key]).toBe('function');
        });
    });

    it('3. Submódulo Publicaciones & Moderación — Debe exportar 6 funciones válidas', () => {
        const keys = Object.keys(adminPublicationsController);
        expect(keys.length).toBe(6);
        keys.forEach(key => {
            expect(typeof adminPublicationsController[key]).toBe('function');
        });
    });

    it('4. Submódulo Parámetros & Gobernanza — Debe exportar 8 funciones válidas', () => {
        const keys = Object.keys(adminSystemSettingsController);
        expect(keys.length).toBe(8);
        keys.forEach(key => {
            expect(typeof adminSystemSettingsController[key]).toBe('function');
        });
    });

    it('5. Submódulo Auditoría & Métricas — Debe exportar 24 funciones válidas', () => {
        const keys = Object.keys(adminAuditStatsController);
        expect(keys.length).toBe(24);
        keys.forEach(key => {
            expect(typeof adminAuditStatsController[key]).toBe('function');
        });
    });

    it('5.1. Submódulo Métricas Badges — Debe exportar 1 función válida', () => {
        const keys = Object.keys(adminMetricsController);
        expect(keys.length).toBe(1);
        keys.forEach(key => {
            expect(typeof adminMetricsController[key]).toBe('function');
        });
    });

    it('6. Fachada adminController — Debe consolidar exactamente 58 funciones (12+7+6+8+24+1)', () => {
        const facadeKeys = Object.keys(adminFacade);
        expect(facadeKeys.length).toBe(58);
        facadeKeys.forEach(key => {
            expect(typeof adminFacade[key]).toBe('function');
        });
    });

    it('7. adminAuthSecurityController.login — Debe rechazar peticiones sin credenciales (400)', async () => {
        const req = { body: {} };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        await adminAuthSecurityController.login(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: "Se requiere usuario y contraseña." });
    });

    it('8. adminUserController.updateUserStatus — Debe rechazar IDs no numéricos (400)', async () => {
        const req = { params: { userId: 'abc' }, body: { status: 'active' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        await adminUserController.updateUserStatus(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'ID de usuario inválido.' });
    });

    it('9. adminPublicationsController.restorePublication — Debe rechazar IDs inválidos (400)', async () => {
        const req = { params: { id: '-5' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        await adminPublicationsController.restorePublication(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'ID de publicación inválido.' });
    });

    it('10. adminSystemSettingsController.updateSetting — Debe validar parámetros vacíos (400)', async () => {
        const req = { body: { key: '', value: 'test' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        await adminSystemSettingsController.updateSetting(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('11. adminAuditStatsController.getBroadcastRecipients — Debe sanitizar ID de difusión (400)', async () => {
        const req = { params: { id: 'invalid_id' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        await adminAuditStatsController.getBroadcastRecipients(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'ID de difusión inválido.' });
    });

});
