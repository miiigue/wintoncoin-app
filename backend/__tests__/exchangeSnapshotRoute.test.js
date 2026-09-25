'use strict';
jest.mock('../src/config/db', () => ({}));
jest.mock('../src/services/web3BridgeService', () => ({}));
jest.mock('../src/services/exchangeSnapshotService', () => ({ readExchangeSnapshot: jest.fn() }));
const express = require('express');
const request = require('supertest');
const { readExchangeSnapshot } = require('../src/services/exchangeSnapshotService');
const router = require('../src/routes/web3Routes');
const app = express(); app.use('/api/web3', router);
const wallet = '0x' + '2'.repeat(40), exchange = '0x' + '1'.repeat(40);
const savedChain = process.env.EXCHANGE_INDEXER_CHAIN_ID, savedAddress = process.env.EXCHANGE_INDEXER_ADDRESS;
beforeEach(() => {
    jest.clearAllMocks(); process.env.EXCHANGE_INDEXER_CHAIN_ID = '10'; process.env.EXCHANGE_INDEXER_ADDRESS = exchange;
});
afterAll(() => {
    if (savedChain === undefined) delete process.env.EXCHANGE_INDEXER_CHAIN_ID; else process.env.EXCHANGE_INDEXER_CHAIN_ID = savedChain;
    if (savedAddress === undefined) delete process.env.EXCHANGE_INDEXER_ADDRESS; else process.env.EXCHANGE_INDEXER_ADDRESS = savedAddress;
});
test('Expone procedencia y estado sin caché, manteniendo cantidades como texto', async () => {
    readExchangeSnapshot.mockResolvedValue({ usable: true, status: 'ready', data: { pendingRefunds: { BLUE: '0.000001', USDT: '3.0' } } });
    const result = await request(app).get(`/api/web3/exchange/${wallet}?limit=20&after=7`);
    expect(result.status).toBe(200); expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body.data.pendingRefunds.BLUE).toBe('0.000001');
    expect(readExchangeSnapshot).toHaveBeenCalledWith({}, { chainId: '10', exchange }, wallet, { limit: 20, after: '7' });
});
test('Estado desactualizado responde 503 y no promete saldo retirable', async () => {
    readExchangeSnapshot.mockResolvedValue({ usable: false, status: 'stale', data: null });
    const result = await request(app).get(`/api/web3/exchange/${wallet}`);
    expect(result.status).toBe(503); expect(result.body.data).toBeNull();
});
test.each(['limit=0', 'limit=101', 'after=-1', 'after=18446744073709551616', 'limit=2&limit=3'])('Rechaza paginación inválida %s', async query => {
    expect((await request(app).get(`/api/web3/exchange/${wallet}?${query}`)).status).toBe(400);
    expect(readExchangeSnapshot).not.toHaveBeenCalled();
});
test('Sin configuración no selecciona red o contrato por su cuenta', async () => {
    delete process.env.EXCHANGE_INDEXER_CHAIN_ID;
    const result = await request(app).get(`/api/web3/exchange/${wallet}`);
    expect(result.status).toBe(503); expect(result.body.status).toBe('not_configured');
    expect(readExchangeSnapshot).not.toHaveBeenCalled();
});
test('Fallo de DB no divulga detalles de conexión', async () => {
    readExchangeSnapshot.mockRejectedValue(Error('private database URL'));
    const result = await request(app).get(`/api/web3/exchange/${wallet}`);
    expect(result.status).toBe(503); expect(JSON.stringify(result.body)).not.toContain('private');
});
