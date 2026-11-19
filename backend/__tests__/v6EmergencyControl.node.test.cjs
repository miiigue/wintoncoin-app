'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Interface, AbiCoder } = require('ethers');

const { buildV6OwnerActionPlan } = require('../src/services/v6ChainBridge');
const economicWriteGate = require('../src/services/economicWriteGate');

const MODE_CONTROLLER = '0xF6fE94cDa3843Db306f08acE47c591540dE154d2';
const OWNER = '0x7d2C6c16EDe986a8bea0204A9824b4C264256C77';
const RISK_REGISTRY = '0x56216Cc0AfA248e6Bf3377bb4bFF5Bd4B2A4b898';

const modeIface = new Interface([
  'function mode() view returns (uint8)',
  'function owner() view returns (address)',
  'function setMode(uint8 newMode)'
]);

const coder = AbiCoder.defaultAbiCoder();

function createMockProvider({ currentMode, owner = OWNER, revertOnSetMode = false }) {
  const calls = [];
  return {
    calls,
    async call(tx) {
      calls.push(tx);
      const data = String(tx.data || '').toLowerCase();
      if (data === modeIface.encodeFunctionData('mode').toLowerCase()) {
        return coder.encode(['uint8'], [currentMode]);
      }
      if (data === modeIface.encodeFunctionData('owner').toLowerCase()) {
        return coder.encode(['address'], [owner]);
      }
      if (data.startsWith(modeIface.getFunction('setMode').selector.toLowerCase())) {
        if (revertOnSetMode) throw new Error('execution reverted');
        return '0x';
      }
      throw new Error(`Unexpected call: ${data}`);
    }
  };
}

const mockConfig = {
  contracts: {
    ProtocolModeController: MODE_CONTROLLER,
    RiskRegistry: RISK_REGISTRY
  }
};

test('v6_mode_emergency_exit prepara setMode(2) simulando desde owner real', async () => {
  const provider = createMockProvider({ currentMode: 0 });
  const plan = await buildV6OwnerActionPlan(provider, mockConfig, 'v6_mode_emergency_exit', {});

  assert.equal(plan.target, MODE_CONTROLLER);
  assert.equal(plan.method, 'setMode');
  assert.equal(plan.data, modeIface.encodeFunctionData('setMode', [2]));
  assert.equal(plan.resource, 'external-owner:v6_mode_emergency_exit');

  const simCall = provider.calls.find((c) => c.data === plan.data);
  assert.ok(simCall, 'Debe simular la llamada setMode(2) antes de preparar');
  assert.equal(simCall.from, OWNER);
  assert.equal(simCall.to, MODE_CONTROLLER);
  assert.equal(simCall.value, 0n);
});

test('v6_mode_freeze_all prepara setMode(1) para congelamiento total incluyendo USDT', async () => {
  const provider = createMockProvider({ currentMode: 0 });
  const plan = await buildV6OwnerActionPlan(provider, mockConfig, 'v6_mode_freeze_all', {});

  assert.equal(plan.target, MODE_CONTROLLER);
  assert.equal(plan.method, 'setMode');
  assert.equal(plan.data, modeIface.encodeFunctionData('setMode', [1]));
  assert.equal(plan.resource, 'external-owner:v6_mode_freeze_all');
});

test('v6_mode_normal prepara setMode(0) desde PRELAUNCH_FROZEN o EMERGENCY_EXIT_ONLY', async () => {
  const provider = createMockProvider({ currentMode: 1 });
  const plan = await buildV6OwnerActionPlan(provider, mockConfig, 'v6_mode_normal', {});

  assert.equal(plan.target, MODE_CONTROLLER);
  assert.equal(plan.method, 'setMode');
  assert.equal(plan.data, modeIface.encodeFunctionData('setMode', [0]));
  assert.equal(plan.resource, 'external-owner:v6_mode_normal');
});

test('rechaza con 409 cualquier transición redundante al modo ya activo', async () => {
  const provider = createMockProvider({ currentMode: 1 });
  await assert.rejects(
    () => buildV6OwnerActionPlan(provider, mockConfig, 'v6_mode_freeze_all', {}),
    (err) => err.status === 409 && /PRELAUNCH_FROZEN/.test(err.message)
  );
});

test('rechaza con 409 (fail-closed) si la simulación on-chain revierte', async () => {
  const provider = createMockProvider({ currentMode: 0, revertOnSetMode: true });
  await assert.rejects(
    () => buildV6OwnerActionPlan(provider, mockConfig, 'v6_mode_freeze_all', {}),
    (err) => err.status === 409 && /revertiría/.test(err.message)
  );
});

test('economicWriteGate exime las acciones de emergencia V6 como acciones de contención', () => {
  for (const op of [
    'v6_mode_emergency_exit',
    'v6_mode_freeze_all',
    'v6_mode_normal',
    'owner:v6_mode_emergency_exit',
    'owner:v6_mode_freeze_all',
    'owner:v6_mode_normal'
  ]) {
    assert.equal(economicWriteGate.isContainmentAction(op), true, `Falta exención de contención para ${op}`);
  }
});

test('V6EmergencyControl.jsx aplica frases de confirmación fuertes y sin secretos', () => {
  const uiPath = path.resolve(__dirname, '../../frontend/src/components/V6EmergencyControl.jsx');
  const panelPath = path.resolve(__dirname, '../../frontend/src/pages/AdminWeb3Panel.jsx');
  const uiSource = fs.readFileSync(uiPath, 'utf8');
  const panelSource = fs.readFileSync(panelPath, 'utf8');

  assert.ok(uiSource.includes('PAUSAR OPERACIONES V6'));
  assert.ok(uiSource.includes('CONGELAR TODO V6'));
  assert.ok(uiSource.includes('REACTIVAR V6 NORMAL'));
  assert.ok(uiSource.includes('administerContract(selectedAction.key'));
  assert.ok(!uiSource.includes('PRIVATE_KEY'));
  assert.ok(!uiSource.includes('privateKey'));
  assert.ok(!uiSource.includes('mnemonic'));
  assert.ok(panelSource.includes("statusData?.epoch === 'V6_DEMO'") || panelSource.includes('/^V6(?:_|$)/'));
  assert.ok(panelSource.includes('<V6EmergencyControl'));
});

test('economicWriteGate.assertStatic admite V6 solo con huella SHA-256 válida y rechaza huellas inválidas', () => {
  const valid = economicWriteGate.assertStatic({
    config: { epoch: 'V6_DEMO', fingerprint: '0x' + 'ab'.repeat(32) },
    operation: 'Pago autorizado'
  });
  assert.equal(valid.epoch, 'V6_DEMO');

  assert.throws(
    () => economicWriteGate.assertStatic({
      config: { epoch: 'V6_MAINNET', fingerprint: '0xbad' },
      operation: 'Pago autorizado'
    }),
    (err) => err.status === 503 && err.code === 'V6_RELEASE_MISMATCH'
  );
});
