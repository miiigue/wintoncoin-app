'use strict';

const {
  INVENTORY_SOURCE_KIND,
  reconcileSnapshots,
  validateConfig,
  walletSetDigest,
} = require('../src/services/v5MigrationReadiness');

const addresses = {
  CoreProtocol: '0x0000000000000000000000000000000000000011',
  BlueToken: '0x0000000000000000000000000000000000000012',
  RedToken: '0x0000000000000000000000000000000000000013',
  CollateralVault: '0x0000000000000000000000000000000000000014',
  FifoExchange: '0x0000000000000000000000000000000000000015',
  USDT: '0x0000000000000000000000000000000000000016',
};

function user(overrides = {}) {
  return {
    address: '0x0000000000000000000000000000000000000001',
    kyc: false,
    creditLimit: '0',
    level: '0',
    extensionMarginLimit: '0',
    extensionMarginUsed: '0',
    paymentNonce: '0',
    blueBalance: '0',
    blueLocked: '0',
    redBalance: '0',
    usdtBalance: '0',
    collateral: '0',
    exchangeReserved: '0',
    pendingReserve: '0',
    activeAmortizationOrder: '0',
    pendingMaturedOnly: false,
    automaticExchangeCollateral: false,
    pendingRefundBlue: '0',
    pendingRefundUsdt: '0',
    parkingLots: [],
    debtLots: [],
    ...overrides,
  };
}

function snapshot(label, userOverrides = {}, globalOverrides = {}, orderOverrides = []) {
  return {
    label,
    readErrors: [],
    globals: {
      blueSupply: '0', redSupply: '0', blueDecimals: '6', redDecimals: '6', usdtDecimals: '6',
      vaultCollateralTokenBalance: '0', totalCollateralLocked: '0', totalExchangeReserved: '0',
      exchangeBlueTokenBalance: '0', exchangeUsdtTokenBalance: '0', totalReservedBlue: '0', totalReservedUsdt: '0',
      accumulatedFeesBlue: '0', accumulatedFeesUsdt: '0', totalPendingRefundBlue: '0', totalPendingRefundUsdt: '0',
      nextOrderId: '1', ...globalOverrides,
    },
    users: [user(userOverrides)],
    orders: orderOverrides,
  };
}

function validConfig() {
  const wallets = ['0x0000000000000000000000000000000000000001'];
  return {
    schemaVersion: 1,
    chainId: '11155420',
    walletInventory: {
      complete: true,
      sourceKind: INVENTORY_SOURCE_KIND,
      exportedAt: '2026-10-28T00:00:00.000Z',
      recordCount: 1,
      databaseTotalUsers: 1,
      databaseRowsWithWallet: 1,
      databaseRowsWithoutWallet: 0,
      databaseUniqueWallets: 1,
      databaseObservedWalletRows: 1,
      databaseUniqueObservedWallets: 1,
      databaseSourceCounts: { users: 1 },
      operationalWalletCount: 0,
      querySha256: 'a'.repeat(64),
      addressSetSha256: walletSetDigest(wallets),
    },
    wallets,
    sourceSuite: { epoch: 'V4_ACTIVE', contracts: addresses, capabilities: { automaticExchangeCollateral: false, exchangeCollateralized: false } },
    destinationSuite: { epoch: 'V5_CODEX_163', contracts: addresses, capabilities: { automaticExchangeCollateral: true, exchangeCollateralized: true } },
  };
}

describe('conciliación V5 de solo lectura', () => {
  test('falla cerrado si el inventario de billeteras no está atestado como completo', () => {
    const config = {
      schemaVersion: 1,
      chainId: '11155420',
      walletInventory: { complete: false },
      wallets: ['0x0000000000000000000000000000000000000001'],
      sourceSuite: { contracts: addresses },
      destinationSuite: { contracts: addresses },
    };
    expect(validateConfig(config)).toContainEqual(expect.stringContaining('walletInventory.complete'));
  });

  test('no acepta complete=true autodeclarado sin procedencia, conteos ni huellas', () => {
    const config = validConfig();
    config.walletInventory = { complete: true };
    expect(validateConfig(config)).toEqual(expect.arrayContaining([
      expect.stringContaining('sourceKind'),
      expect.stringContaining('recordCount'),
      expect.stringContaining('querySha256'),
      expect.stringContaining('addressSetSha256'),
    ]));
  });

  test('acepta un inventario PostgreSQL conciliado y capacidades explícitas por suite', () => {
    expect(validateConfig(validConfig())).toEqual([]);
  });

  test('rechaza una huella de billeteras alterada o capacidades implícitas', () => {
    const config = validConfig();
    config.walletInventory.addressSetSha256 = 'b'.repeat(64);
    delete config.sourceSuite.capabilities.exchangeCollateralized;
    expect(validateConfig(config)).toEqual(expect.arrayContaining([
      expect.stringContaining('addressSetSha256 no coincide'),
      expect.stringContaining('sourceSuite.capabilities.exchangeCollateralized'),
    ]));
  });

  test('no permite declarar como ausente una capacidad registrada para la época V5', () => {
    const config = validConfig();
    config.destinationSuite.capabilities.automaticExchangeCollateral = false;
    expect(validateConfig(config)).toContainEqual(expect.stringContaining('no coincide con V5_CODEX_163'));
  });

  test('considera listo solamente el estado vacío, pareado, solvente y completamente legible', () => {
    const inventory = { complete: true, addressSetSha256: 'a'.repeat(64) };
    const result = reconcileSnapshots(snapshot('source'), snapshot('destination'), { chainId: '11155420', blockNumber: 1, walletInventory: inventory });
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.walletInventory).toBe(inventory);
  });

  test('bloquea una fuente con supply BLUE/RED desigual', () => {
    const result = reconcileSnapshots(snapshot('source', {}, { blueSupply: '2', redSupply: '1' }), snapshot('destination'));
    expect(result.ready).toBe(false);
    expect(result.blockers).toContainEqual(expect.objectContaining({ code: 'PAIRED_SUPPLY_VIOLATION' }));
  });

  test('no confunde paridad global con migrabilidad de lotes y parking', () => {
    const old = snapshot('source', {
      blueBalance: '10',
      redBalance: '10',
      blueLocked: '4',
      parkingLots: [{ index: 0, remaining: '4', releaseAt: '200' }],
      debtLots: [{ index: 0, id: '9', amount: '10', remainingAmount: '10', dueAt: '300', repaid: false }],
    }, { blueSupply: '10', redSupply: '10' });
    const result = reconcileSnapshots(old, snapshot('destination'));
    expect(result.ready).toBe(false);
    expect(result.blockers.map((item) => item.code)).toEqual(expect.arrayContaining([
      'TOKEN_BALANCES_NOT_IMPORTABLE', 'PARKING_SCHEDULE_NOT_IMPORTABLE', 'DEBT_FIFO_NOT_IMPORTABLE',
    ]));
  });

  test('bloquea nonces, bóveda, refunds y órdenes activas que no tienen importador', () => {
    const old = snapshot('source', {
      paymentNonce: '7', collateral: '20', exchangeReserved: '5', pendingRefundUsdt: '3',
    }, { vaultCollateralTokenBalance: '20', totalCollateralLocked: '20', exchangeUsdtTokenBalance: '8', totalReservedUsdt: '5', totalPendingRefundUsdt: '3' }, [
      { id: '1', status: '2', remainingAmount: '5' },
    ]);
    const result = reconcileSnapshots(old, snapshot('destination'));
    expect(result.blockers.map((item) => item.code)).toEqual(expect.arrayContaining([
      'PAYMENT_NONCE_NOT_IMPORTABLE', 'VAULT_STATE_NOT_IMPORTABLE', 'REFUNDS_MUST_SETTLE_ON_SOURCE',
      'ORDERBOOK_NOT_IMPORTABLE', 'UNCLAIMED_GLOBAL_REFUNDS',
    ]));
  });

  test('detecta insolvencia aun cuando BLUE y RED estén pareados', () => {
    const old = snapshot('source', {}, {
      exchangeBlueTokenBalance: '9', totalReservedBlue: '7', accumulatedFeesBlue: '2', totalPendingRefundBlue: '1',
    });
    const result = reconcileSnapshots(old, snapshot('destination'));
    expect(result.blockers).toContainEqual(expect.objectContaining({ code: 'EXCHANGE_BLUE_INSOLVENT' }));
  });

  test('una lectura crítica fallida siempre bloquea la salida', () => {
    const old = snapshot('source');
    old.readErrors.push({ path: 'source.users.wallet.paymentNonce', error: 'selector no disponible' });
    const result = reconcileSnapshots(old, snapshot('destination'));
    expect(result.ready).toBe(false);
    expect(result.blockers).toContainEqual(expect.objectContaining({ code: 'INCOMPLETE_READ' }));
  });
});
