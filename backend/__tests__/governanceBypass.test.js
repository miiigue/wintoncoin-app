/**
 * Test de Integración: Bypass de Gobernanza para Mensajería y Notificaciones No Críticas
 * ══════════════════════════════════════════════════════════════════════════════════════
 * Valida que el Governance Guard bloquee de manera efectiva la edición de parámetros
 * financieros críticos cuando la gobernanza está activa, pero permita la edición directa
 * de variables operativas no críticas como los mensajes diarios y el estado de interstitials.
 *
 * Grado de ingeniería: Pruebas unitarias de cobertura 100% deterministas usando Spies en Jest.
 * ══════════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

const request = require('supertest');
const express = require('express');
const pool = require('../src/config/db');
const adminController = require('../src/controllers/adminController');

// Crear una app de Express aislada para probar las rutas y controladores administrativos
const app = express();
app.use(express.json());

// Mockear el middleware de autenticación de administrador para simular un superadmin autenticado
const mockAuthenticateAdmin = (req, res, next) => {
    req.user = { id: 1, username: 'admin_tester', role: 'superadmin' };
    next();
};

// Montar la ruta a probar de forma aislada
app.post('/api/admin/settings', mockAuthenticateAdmin, adminController.updateSetting);

// Mockear servicios externos que interactúan con el controlador para evitar llamadas reales
jest.mock('../src/services/auditService', () => ({
    logAuditEvent: jest.fn().mockResolvedValue(true)
}));

describe('Governance Bypass Test Suite', () => {
    let poolQuerySpy;

    beforeEach(() => {
        // Espiar las llamadas a la base de datos
        poolQuerySpy = jest.spyOn(pool, 'query');
    });

    afterEach(() => {
        // Restaurar el comportamiento original de la base de datos después de cada prueba
        poolQuerySpy.mockRestore();
    });

    it('1. Debe BLOQUEAR la actualización de un parámetro económico crítico si la gobernanza está activa', async () => {
        // Simular que hay guardianes activos (gobernanza activa = true)
        poolQuerySpy.mockImplementation((sql, params) => {
            if (sql.includes('governance_guardians')) {
                return Promise.resolve({ rows: [{ count: '3' }] });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const res = await request(app)
            .post('/api/admin/settings')
            .send({ key: 'platform_commission_percentage', value: '5.5' });

        // Debe retornar 403 Forbidden
        expect(res.statusCode).toEqual(403);
        expect(res.body.governance_required).toBe(true);
        expect(res.body.message).toContain('El sistema de gobernanza está activo');
    });

    it('2. Debe PERMITIR la actualización de un parámetro económico crítico si la gobernanza está INACTIVA', async () => {
        // Simular que no hay guardianes activos (gobernanza activa = false)
        poolQuerySpy.mockImplementation((sql, params) => {
            if (sql.includes('governance_guardians')) {
                return Promise.resolve({ rows: [{ count: '0' }] });
            }
            if (sql.includes('app_settings')) {
                return Promise.resolve({
                    rowCount: 1,
                    rows: [{ setting_key: 'platform_commission_percentage', setting_value: '5.5' }]
                });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const res = await request(app)
            .post('/api/admin/settings')
            .send({ key: 'platform_commission_percentage', value: '5.5' });

        // Debe retornar 200 OK
        expect(res.statusCode).toEqual(200);
        expect(res.body.setting.setting_value).toEqual('5.5');
    });

    it('3. Debe PERMITIR la actualización de mensajes diarios (daily_modal_mon) incluso si la gobernanza está ACTIVA', async () => {
        // Simular gobernanza activa (count = 3) y retorno exitoso del UPDATE en la base de datos
        poolQuerySpy.mockImplementation((sql, params) => {
            if (sql.includes('governance_guardians')) {
                return Promise.resolve({ rows: [{ count: '3' }] });
            }
            if (sql.includes('app_settings')) {
                return Promise.resolve({
                    rowCount: 1,
                    rows: [{ setting_key: 'daily_modal_mon', setting_value: '¡Nuevo mensaje de Lunes!' }]
                });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const res = await request(app)
            .post('/api/admin/settings')
            .send({ key: 'daily_modal_mon', value: '¡Nuevo mensaje de Lunes!' });

        // Debe retornar 200 OK gracias al bypass condicional
        expect(res.statusCode).toEqual(200);
        expect(res.body.setting.setting_value).toEqual('¡Nuevo mensaje de Lunes!');
    });

    it('4. Debe PERMITIR activar el modal global (global_app_interstitial_enabled) incluso si la gobernanza está ACTIVA', async () => {
        // Simular gobernanza activa (count = 1) y retorno exitoso de la base de datos
        poolQuerySpy.mockImplementation((sql, params) => {
            if (sql.includes('governance_guardians')) {
                return Promise.resolve({ rows: [{ count: '1' }] });
            }
            if (sql.includes('app_settings')) {
                return Promise.resolve({
                    rowCount: 1,
                    rows: [{ setting_key: 'global_app_interstitial_enabled', setting_value: 'true' }]
                });
            }
            return Promise.resolve({ rows: [], rowCount: 0 });
        });

        const res = await request(app)
            .post('/api/admin/settings')
            .send({ key: 'global_app_interstitial_enabled', value: 'true' });

        // Debe retornar 200 OK
        expect(res.statusCode).toEqual(200);
        expect(res.body.setting.setting_value).toEqual('true');
    });

    it('5. [SEGURIDAD] Debe RECHAZAR mensajes diarios que excedan los 5000 caracteres (Prevención DoS)', async () => {
        // Generar un payload excesivo de 5001 caracteres
        const excessivePayload = 'A'.repeat(5001);

        const res = await request(app)
            .post('/api/admin/settings')
            .send({ key: 'daily_modal_mon', value: excessivePayload });

        // Debe retornar 400 Bad Request
        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toContain('excede el límite máximo de seguridad');
    });

    it('6. [SEGURIDAD] Debe RECHAZAR valores no booleanos en global_app_interstitial_enabled (Integridad de Datos)', async () => {
        const res = await request(app)
            .post('/api/admin/settings')
            .send({ key: 'global_app_interstitial_enabled', value: 'not_a_boolean_value' });

        // Debe retornar 400 Bad Request
        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toContain('debe ser exactamente \'true\' o \'false\'');
    });

    it('7. [SEGURIDAD] Debe RECHAZAR otros parámetros que excedan el límite preventivo de 1000 caracteres', async () => {
        const excessivePayload = '1'.repeat(1001);

        const res = await request(app)
            .post('/api/admin/settings')
            .send({ key: 'platform_commission_percentage', value: excessivePayload });

        // Debe retornar 400 Bad Request
        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toContain('excede el límite preventivo general');
    });
});
