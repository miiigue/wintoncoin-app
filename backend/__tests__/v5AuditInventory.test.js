'use strict';

const { buildInventory } = require('../scripts/build_v5_audit_inventory');
const { validateConfig } = require('../src/services/v5MigrationReadiness');

const address = (digit) => `0x${digit.repeat(40)}`;
const contracts = {
  CoreProtocol: address('1'), BlueToken: address('2'), RedToken: address('3'),
  CollateralVault: address('4'), FifoExchange: address('5'), USDT: address('6'),
};

function baseConfig() {
  return {
    schemaVersion: 1,
    chainId: '11155420',
    operationalWallets: [address('a')],
    sourceSuite: { epoch: 'V4_ACTIVE', contracts, capabilities: { automaticExchangeCollateral: false, exchangeCollateralized: false } },
    destinationSuite: { epoch: 'V5_CODEX_163', contracts, capabilities: { automaticExchangeCollateral: true, exchangeCollateralized: true } },
  };
}

function clientFor(rows, totalUsers = rows.length, observed = rows.map((wallet_address) => ({ source: 'users', wallet_address }))) {
  return {
    query: jest.fn(async (sql) => {
      if (sql.startsWith('SELECT COUNT')) return { rows: [{ total_users: totalUsers, rows_with_wallet: rows.length }] };
      if (sql.startsWith('SELECT web3_wallet_address')) return { rows: rows.map((web3_wallet_address) => ({ web3_wallet_address })) };
      if (sql.startsWith('SELECT source, wallet_address')) return { rows: observed };
      return { rows: [] };
    }),
  };
}

describe('inventario V5 desde PostgreSQL sin PII', () => {
  test('construye conteos y huella reproducible que pasan validación fail-closed', async () => {
    const client = clientFor([address('b'), address('c')], 3);
    const result = await buildInventory({ client, config: baseConfig(), now: new Date('2026-10-28T12:00:00.000Z') });
    expect(result.wallets).toHaveLength(3);
    expect(result.walletInventory).toMatchObject({
      complete: true,
      databaseTotalUsers: 3,
      databaseRowsWithWallet: 2,
      databaseRowsWithoutWallet: 1,
      databaseUniqueWallets: 2,
      databaseObservedWalletRows: 2,
      databaseUniqueObservedWallets: 2,
      databaseSourceCounts: { users: 2 },
      operationalWalletCount: 1,
      recordCount: 3,
    });
    expect(result.walletInventory.addressSetSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(validateConfig(result)).toEqual([]);
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual(expect.arrayContaining([
      expect.stringContaining('REPEATABLE READ READ ONLY'), 'COMMIT',
    ]));
  });

  test('falla cerrado y revierte si la DB contiene una billetera inválida', async () => {
    const client = clientFor(['no-es-direccion']);
    await expect(buildInventory({ client, config: baseConfig() })).rejects.toThrow('dirección inválida');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('falla cerrado ante una billetera compartida por dos usuarios', async () => {
    const client = clientFor([address('b'), address('b')]);
    await expect(buildInventory({ client, config: baseConfig() })).rejects.toThrow('duplicada');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('incorpora billeteras observadas por el indexador aunque no estén ya en users', async () => {
    const indexed = address('d');
    const client = clientFor([address('b')], 1, [
      { source: 'users', wallet_address: address('b') },
      { source: 'exchange_orders', wallet_address: indexed },
    ]);
    const result = await buildInventory({ client, config: baseConfig() });
    expect(result.wallets.map((value) => value.toLowerCase())).toContain(indexed.toLowerCase());
    expect(result.walletInventory).toMatchObject({
      databaseObservedWalletRows: 2,
      databaseUniqueObservedWallets: 2,
      databaseSourceCounts: { users: 1, exchange_orders: 1 },
    });
    expect(validateConfig(result)).toEqual([]);
  });
});
