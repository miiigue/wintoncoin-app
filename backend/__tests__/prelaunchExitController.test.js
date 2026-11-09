'use strict';

jest.mock('../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../src/services/auditService', () => ({ logAuditEvent: jest.fn(async () => {}) }));
jest.mock('../src/services/boosterService', () => ({}));
jest.mock('../src/services/prelaunchExitReadiness', () => ({ evaluate: jest.fn() }));

const pool = require('../src/config/db');
const { logAuditEvent } = require('../src/services/auditService');
const preflight = require('../src/services/prelaunchExitReadiness');
const controller = require('../src/controllers/admin/adminSystemSettingsController');

function response() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe('interlock administrativo de salida de Prelanzamiento', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    });

    test('no modifica settings si el preflight técnico no está listo', async () => {
        preflight.evaluate.mockResolvedValue({
            ready: false,
            checks: [{ id: 'contracts_paused', ready: false }]
        });
        const req = { body: { key: 'pre_launch_mode_enabled', value: 'false' }, user: { username: 'admin' } };
        const res = response();

        await controller.updateSetting(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            code: 'PRELAUNCH_EXIT_NOT_READY'
        }));
        expect(pool.query).toHaveBeenCalledTimes(1);
        expect(logAuditEvent).not.toHaveBeenCalled();
    });

    test('si está listo actualiza fase y timestamp en un único statement auditable', async () => {
        preflight.evaluate.mockResolvedValue({ ready: true, checks: [] });
        pool.query.mockResolvedValueOnce({ rows: [
            { setting_key: 'pre_launch_deactivated_at', setting_value: '2026-11-08T00:00:00Z' },
            { setting_key: 'pre_launch_mode_enabled', setting_value: 'false' }
        ] });
        const req = { body: { key: 'pre_launch_mode_enabled', value: 'false' }, user: { username: 'admin' } };
        const res = response();

        await controller.updateSetting(req, res);

        expect(pool.query).toHaveBeenCalledTimes(2);
        expect(pool.query).toHaveBeenLastCalledWith(expect.stringContaining("pre_launch_deactivated_at"),
            ['false', 'pre_launch_mode_enabled']);
        expect(logAuditEvent).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            setting: expect.objectContaining({ setting_key: 'pre_launch_mode_enabled', setting_value: 'false' })
        }));
    });

    test('activar Prelanzamiento no requiere el preflight de salida', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ setting_key: 'pre_launch_mode_enabled', setting_value: 'true' }] });
        const req = { body: { key: 'pre_launch_mode_enabled', value: 'true' }, user: { username: 'admin' } };
        const res = response();

        await controller.updateSetting(req, res);

        expect(preflight.evaluate).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
