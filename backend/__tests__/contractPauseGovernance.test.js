'use strict';

jest.mock('../src/config/db', () => ({ query: jest.fn() }));

const pool = require('../src/config/db');
const { guard } = require('../src/middleware/contractAdministration');

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

describe('gobernanza de pausas de la suite económica', () => {
    beforeEach(() => jest.clearAllMocks());

    test.each(['pause_protocol', 'pause_vault', 'pause_exchange', 'pause_treasury'])(
        '%s puede prepararse como contención sin omitir la firma owner', async action => {
            const next = jest.fn();
            await guard({ method: 'POST', path: '/owner/prepare', body: { action }, user: { role: 'admin' } }, response(), next);
            expect(next).toHaveBeenCalledTimes(1);
            expect(pool.query).not.toHaveBeenCalled();
        }
    );

    test.each(['unpause_protocol', 'unpause_vault', 'unpause_exchange', 'unpause_treasury'])(
        '%s no recibe el bypass de emergencia', async action => {
            pool.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
            const res = response(), next = jest.fn();
            await guard({ method: 'POST', path: '/owner/prepare', body: { action }, user: { role: 'admin' } }, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.statusCode).toBe(403);
            expect(res.body).toMatchObject({ governance_required: true });
        }
    );
});
