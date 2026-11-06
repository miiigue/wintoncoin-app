'use strict';

const fs = require('fs');
const path = require('path');

jest.mock('../src/services/web3BridgeService', () => ({
    pauseProtocol: jest.fn(), unpauseProtocol: jest.fn(), pauseVault: jest.fn(), unpauseVault: jest.fn()
}));
jest.mock('../src/services/chainDeployment', () => ({
    configuration: jest.fn(() => ({ epoch: 'V5_CODEX_163' }))
}));
jest.mock('../src/services/auditService', () => ({ logAuditEvent: jest.fn() }));

const controller = require('../src/controllers/admin/adminWeb3Controller');
const bridge = require('../src/services/web3BridgeService');
const deployment = require('../src/services/chainDeployment');

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

describe('contención de la ruta legacy de pausa en V5', () => {
    beforeEach(() => jest.clearAllMocks());

    test.each(['pause', 'unpause'])('no envía %s mediante el relayer', async action => {
        const res = response();
        await controller.setPause({ body: { target: 'protocol', action }, user: { username: 'admin' } }, res);
        expect(res.statusCode).toBe(409);
        expect(res.body).toMatchObject({ success: false, ownerPreparationRequired: true });
        expect(bridge.pauseProtocol).not.toHaveBeenCalled();
        expect(bridge.unpauseProtocol).not.toHaveBeenCalled();
    });

    test('falla cerrado si no puede seleccionar la época', async () => {
        deployment.configuration.mockImplementationOnce(() => { throw new Error('config'); });
        const res = response();
        await controller.setPause({ body: { target: 'vault', action: 'pause' }, user: { username: 'admin' } }, res);
        expect(res.statusCode).toBe(503);
        expect(bridge.pauseVault).not.toHaveBeenCalled();
    });

    test('la gobernanza heredada también bloquea la pausa parcial de V5', () => {
        const source = fs.readFileSync(path.join(__dirname, '../src/services/governanceService.js'), 'utf8');
        expect(source).toContain("govRequest.target_key === 'web3_protocol_paused'");
        expect(source).toContain("deployment.epoch === 'V5_CODEX_163'");
        expect(source).toContain('pausa integral de Core, Exchange, Treasury y Vault');
    });
});
