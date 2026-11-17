'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Interface, Wallet, AbiCoder } = require('ethers');
const {
  withCompatibilityAliases,
  getUserAuditDetailedV6,
  buildV6OwnerActionPlan
} = require('../src/services/v6ChainBridge');
const { settle, collateralizeMatured, collateralOrderIds } = require('../src/services/chainMaintenance');
const gate = require('../src/services/economicWriteGate');

const contracts = Object.fromEntries([
  'USDT', 'BlueTokenV6', 'RedTokenV6', 'CommitmentLedger', 'CollateralVaultV6',
  'RiskRegistry', 'PaymentEngine', 'ProtocolModeController', 'ProtocolConfig',
  'ExchangeRouter', 'ProtocolTreasuryV6'
].map((name, idx) => [name, '0x' + String(idx + 1).padStart(40, '0')]));

const user = '0x' + '9'.repeat(40);
const coder = AbiCoder.defaultAbiCoder();

test('withCompatibilityAliases expone tanto contratos V6 como llaves estándar de interfaz', () => {
  const mapped = withCompatibilityAliases(contracts);
  assert.equal(mapped.CoreProtocol, contracts.PaymentEngine);
  assert.equal(mapped.CollateralVault, contracts.CollateralVaultV6);
  assert.equal(mapped.FifoExchange, contracts.ExchangeRouter);
  assert.equal(mapped.BlueToken, contracts.BlueTokenV6);
  assert.equal(mapped.RedToken, contracts.RedTokenV6);
  assert.equal(mapped.ProtocolTreasury, contracts.ProtocolTreasuryV6);
});

test('getUserAuditDetailedV6 lee estado V6 anclado a bloque y valida invariante RED == outstanding', async () => {
  const now = Math.floor(Date.now() / 1000);
  const state = {
    red: 40_000_000n,
    outstanding: 40_000_000n,
    matured: 0n,
    blue: 25_000_000n,
    blueLocked: 10_000_000n,
    usdt: 100_000_000n,
    collateral: 50_000_000n,
    free: 10_000_000n,
    reserved: 40_000_000n,
    automatic: true,
    creditLimit: 100_000_000n,
    level: 3,
    kyc: true,
    required: 0n,
    firstLotId: 7n,
    lotDueAt: BigInt(now + 86400),
    lotAmount: 60_000_000n,
    blockHashAfter: '0x' + 'a'.repeat(64)
  };

  const provider = {
    getNetwork: async () => ({ chainId: 11155420n }),
    getBlock: async () => ({ number: 100, timestamp: now - 5, hash: state.blockHashAfter }),
    send: async (method, [tx, blockSpec]) => {
      assert.equal(method, 'eth_call');
      assert.equal(blockSpec.requireCanonical, true);
      const to = tx.to.toLowerCase();
      const selector = tx.data.slice(0, 10);
      if (to === contracts.USDT.toLowerCase()) return coder.encode(['uint256'], [state.usdt]);
      if (to === contracts.BlueTokenV6.toLowerCase()) {
        // balanceOf vs lockedBalanceOf
        if (selector === new Interface(['function balanceOf(address)']).getFunction('balanceOf').selector) {
          return coder.encode(['uint256'], [state.blue]);
        }
        return coder.encode(['uint256'], [state.blueLocked]);
      }
      if (to === contracts.RedTokenV6.toLowerCase()) return coder.encode(['uint256'], [state.red]);
      if (to === contracts.CommitmentLedger.toLowerCase()) {
        const iface = new Interface([
          'function outstanding(address) view returns (uint256)',
          'function matured(address) view returns (uint256)',
          'function firstLotId(address) view returns (uint256)',
          'function lot(address,uint256) view returns (uint256,uint256,uint256,uint256,bool)'
        ]);
        if (selector === iface.getFunction('outstanding').selector) return coder.encode(['uint256'], [state.outstanding]);
        if (selector === iface.getFunction('matured').selector) return coder.encode(['uint256'], [state.matured]);
        if (selector === iface.getFunction('firstLotId').selector) return coder.encode(['uint256'], [state.firstLotId]);
        return coder.encode(['uint256', 'uint256', 'uint256', 'uint256', 'bool'], [state.lotDueAt, state.lotAmount, 0n, 0n, true]);
      }
      if (to === contracts.CollateralVaultV6.toLowerCase()) {
        const iface = new Interface([
          'function collateralBalance(address) view returns (uint256)',
          'function freeCollateral(address) view returns (uint256)',
          'function exchangeReserved(address) view returns (uint256)',
          'function automaticExchangeCollateral(address) view returns (bool)'
        ]);
        if (selector === iface.getFunction('collateralBalance').selector) return coder.encode(['uint256'], [state.collateral]);
        if (selector === iface.getFunction('freeCollateral').selector) return coder.encode(['uint256'], [state.free]);
        if (selector === iface.getFunction('exchangeReserved').selector) return coder.encode(['uint256'], [state.reserved]);
        return coder.encode(['bool'], [state.automatic]);
      }
      if (to === contracts.RiskRegistry.toLowerCase()) {
        return coder.encode(['tuple(uint128,uint8,bool)'], [[state.creditLimit, state.level, state.kyc]]);
      }
      if (to === contracts.PaymentEngine.toLowerCase()) {
        return coder.encode(['uint256'], [state.required]);
      }
      throw new Error('Contrato inesperado: ' + to);
    }
  };

  const audit = await getUserAuditDetailedV6({
    provider,
    config: { chainId: '11155420', contracts },
    walletAddress: user
  });

  assert.equal(audit.success, true);
  assert.equal(audit.epoch, 'V6_DEMO');
  assert.equal(audit.blueBalance, '25.0');
  assert.equal(audit.blueLocked, '10.0');
  assert.equal(audit.blueAvailable, '15.0');
  assert.equal(audit.redCommitment, '40.0');
  assert.equal(audit.collateralVault.totalLocked, '50.0');
  assert.equal(audit.collateralVault.freeForWithdrawal, '10.0');
  assert.equal(audit.collateralVault.reservedInExchange, '40.0');
  assert.equal(audit.collateralVault.automaticAtMaturity, true);
  assert.equal(audit.credit.baseLimit, '100.0');
  // coverage = 100 + 50 = 150; outstanding = 40 => availableCapacity = 110
  assert.equal(audit.credit.availableCapacity, '110.0');
  assert.equal(audit.credit.isKYCVerified, true);
  assert.equal(audit.debtLots.length, 1);
  assert.equal(audit.debtLots[0].id, '7');
  assert.equal(audit.debtLots[0].remainingAmount, '40.0');

  // Si hay desbalance entre RedTokenV6 y CommitmentLedger falla cerrado
  state.red = 41_000_000n;
  const corrupted = await getUserAuditDetailedV6({
    provider,
    config: { chainId: '11155420', contracts },
    walletAddress: user
  });
  assert.equal(corrupted.success, false);
  assert.match(corrupted.error, /Inconsistencia contable V6/);
});

test('buildV6OwnerActionPlan codifica RiskRegistry.setProfile preservando campos existentes', async () => {
  const provider = {
    call: async () => coder.encode(['tuple(uint128,uint8,bool)'], [[75_000_000n, 4, true]])
  };
  const config = { contracts };
  const iface = new Interface(['function setProfile(address,bool,uint128,uint8)']);

  const kycPlan = await buildV6OwnerActionPlan(provider, config, 'kyc', { walletAddress: user, status: false });
  assert.equal(kycPlan.target.toLowerCase(), contracts.RiskRegistry.toLowerCase());
  assert.deepEqual([...iface.parseTransaction({ data: kycPlan.data }).args], [user, false, 75_000_000n, 4n]);

  const limitPlan = await buildV6OwnerActionPlan(provider, config, 'credit_limit', { walletAddress: user, limit: '250.5' });
  assert.deepEqual([...iface.parseTransaction({ data: limitPlan.data }).args], [user, true, 250_500_000n, 4n]);

  await assert.rejects(
    buildV6OwnerActionPlan(provider, config, 'user_benefits', { walletAddress: user, level: '7' }),
    /Nivel fuera de límite/
  );
});

test('chainMaintenance en V6_DEMO consulta órdenes V6 y codifica settleMatured y protectOverdue', async () => {
  const config = { chainId: '11155420', epoch: 'V6_DEMO', fingerprint: 'fp-v6', contracts };
  const poolOrders = {
    query: async sql => sql.includes('web3_exchange_v6_sync')
      ? { rowCount: 1, rows: [{}] }
      : { rows: [{ order_id: '11' }, { order_id: '15' }] }
  };
  const ids = await collateralOrderIds(poolOrders, config, user);
  assert.deepEqual(ids, ['11', '15']);

  const originalStatus = gate.operationalStatus;
  gate.operationalStatus = async () => ({ enabled: true });
  try {
    const rpc = {
      call: async tx => {
        const to = tx.to.toLowerCase();
        if (to === contracts.ProtocolModeController.toLowerCase()) return coder.encode(['uint8'], [0]);
        if (to === contracts.RiskRegistry.toLowerCase()) return coder.encode(['bool'], [true]);
        if (to === contracts.CommitmentLedger.toLowerCase()) return coder.encode(['uint256'], [10_000_000n]);
        if (to === contracts.CollateralVaultV6.toLowerCase()) return coder.encode(['bool'], [true]);
        throw new Error('Unexpected target ' + to);
      }
    };
    const settingsRows = [
      { setting_key: 'gas_sponsor_enabled', setting_value: 'true' },
      { setting_key: 'gas_sponsor_daily_budget_wei', setting_value: '100' },
      { setting_key: 'gas_sponsor_maintenance_max_step_wei', setting_value: '10' },
      { setting_key: 'gas_sponsor_maintenance_daily_budget_wei', setting_value: '50' }
    ];
    const client = {
      query: async sql => sql.includes('pg_try')
        ? { rows: [{ acquired: true }] }
        : sql.includes('setting_key LIKE')
        ? { rows: settingsRows }
        : sql.includes('AS total')
        ? { rows: [{ total: '0', user_count: 0 }] }
        : sql.includes('SUM(')
        ? { rows: [{ used: '0' }] }
        : { rows: [] },
      release: () => {}
    };
    const pool = { connect: async () => client, query: async () => ({ rows: settingsRows }) };
    const preparedPlans = [];
    const store = {
      prepare: async input => { preparedPlans.push(input); return { id: 'op-1', ...input }; },
      authorize: async () => ({ success: true })
    };
    const env = { RELAYER_PRIVATE_KEY: Wallet.createRandom().privateKey };

    await settle({ pool, rpc, config, wallet: user, env, store });
    await collateralizeMatured({ pool, rpc, config, wallet: user, orderIds: ['11', '15'], env, store });

    assert.equal(preparedPlans[0].payload.to, contracts.PaymentEngine);
    assert.equal(
      new Interface(['function settleMatured(address)']).parseTransaction({ data: preparedPlans[0].payload.data }).name,
      'settleMatured'
    );
    assert.equal(preparedPlans[1].payload.to, contracts.CollateralVaultV6);
    const parsedProtect = new Interface(['function protectOverdue(address,uint64)']).parseTransaction({ data: preparedPlans[1].payload.data });
    assert.equal(parsedProtect.name, 'protectOverdue');
    assert.deepEqual([...parsedProtect.args], [user, 11n]);
  } finally {
    gate.operationalStatus = originalStatus;
  }
});
