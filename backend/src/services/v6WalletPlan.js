'use strict';
const { Contract, Interface, getAddress } = require('ethers');
const { error } = require('./chainOperationStore');

const tokenAbi = [
  'function balanceOf(address) view returns(uint256)',
  'function allowance(address,address) view returns(uint256)',
  'function approve(address,uint256) returns(bool)',
  'function transfer(address,uint256) returns(bool)'
];
const vaultAbi = [
  'function deposit(uint256)',
  'function withdraw(uint256)',
  'function freeCollateral(address) view returns(uint256)',
  'function createAmortizationOrder(uint128)',
  'function depositAndCreateAmortizationOrder(uint128)',
  'function collateralizeExisting(uint64,uint128)',
  'function setAutomaticExchangeCollateral(bool)',
  'function exchangeReserved(address) view returns(uint256)'
];
const exchangeConfigAbi = ['function feeBps() view returns(uint16)'];
const coreAbi = ['function amortizeWithBlue(uint256)'];
const routerAbi = [
  'function createOrder(uint8,uint128)',
  'function cancelOrder(uint64)',
  'function resumeOrder(uint64)',
  'function claimPending(uint8)'
];
const custodyAbi = ['function pendingRefund(address,uint8) view returns(uint128)'];

const capabilities = Object.freeze({
  deposit: true,
  withdraw: true,
  transfer: true,
  amortize: true,
  sell: true,
  buy: true,
  repayCollateral: true,
  cancel: true,
  resume: true,
  claim: true,
  secureOrder: true,
  autoCollateral: true
});

const call = (to, abi, method, args, label) => ({
  to: getAddress(to),
  data: new Interface(abi).encodeFunctionData(method, args),
  value: '0',
  label
});

/**
 * Splits an incoming USDT buy amount between collateralized RED amortization
 * and an ordinary FIFO buy order so users never over-collateralize beyond RED.
 */
function splitCollateralizedBuy(amount, redDebt, feeBps, reserved = 0n, pending = 0n) {
  for (const value of [amount, redDebt, feeBps, reserved, pending]) {
    if (typeof value !== 'bigint' || value < 0n) throw error('Datos de cobertura inválidos.', 400);
  }
  if (feeBps >= 10000n) throw error('Comisión de exchange inválida.', 503);
  if (redDebt === 0n) return { secured: 0n, ordinary: amount, budget: 0n };
  const budget = redDebt * 10000n / (10000n - feeBps);
  const assigned = reserved + pending;
  const missing = budget > assigned ? budget - assigned : 0n;
  const secured = amount < missing ? amount : missing;
  return { secured, ordinary: amount - secured, budget };
}

function parseOrderId(orderId) {
  const raw = String(orderId ?? '');
  if (!/^\d{1,20}$/.test(raw) || BigInt(raw) < 1n || BigInt(raw) > (1n << 64n) - 1n) {
    throw error('Orden inválida.', 400);
  }
  return BigInt(raw);
}

// Produces unsigned calls only. User authorization and runtime isolation must be
// enforced by the caller. Amounts are raw six-decimal token units.
async function buildV6WalletPlan({ action, amount, orderId, destination, enabled, user, contracts, rpc, ContractClass = Contract }) {
  if (!Object.prototype.hasOwnProperty.call(capabilities, action) || !capabilities[action]) {
    throw error('Operación no admitida.', 400);
  }
  const who = getAddress(user);
  const plan = [];
  const c = Object.fromEntries(Object.entries(contracts).map(([k, v]) => [k, getAddress(v)]));
  const at = (address, abi) => new ContractClass(address, abi, rpc);
  const positive = () => {
    if (typeof amount !== 'bigint' || amount <= 0n) throw error('Importe inválido.', 400);
  };
  const approve = async (token, spender, requiredAmount = amount) => {
    if (typeof requiredAmount !== 'bigint' || requiredAmount <= 0n) throw error('Importe inválido.', 400);
    const t = at(token, tokenAbi);
    if (await t.balanceOf(who) < requiredAmount) throw error('Saldo insuficiente.', 409);
    const current = await t.allowance(who, spender);
    if (current < requiredAmount) {
      if (current > 0n) plan.push(call(token, tokenAbi, 'approve', [spender, 0n], 'Restablecer autorización'));
      plan.push(call(token, tokenAbi, 'approve', [spender, requiredAmount], 'Autorizar importe exacto'));
    }
  };

  switch (action) {
    case 'deposit':
      await approve(c.USDT, c.CollateralVaultV6);
      plan.push(call(c.CollateralVaultV6, vaultAbi, 'deposit', [amount], 'Depositar garantía'));
      break;
    case 'withdraw':
      positive();
      if (await at(c.CollateralVaultV6, vaultAbi).freeCollateral(who) < amount) throw error('Garantía no disponible.', 409);
      plan.push(call(c.CollateralVaultV6, vaultAbi, 'withdraw', [amount], 'Retirar garantía'));
      break;
    case 'transfer':
      positive();
      if (await at(c.USDT, tokenAbi).balanceOf(who) < amount) throw error('Saldo insuficiente.', 409);
      if (getAddress(destination) === '0x0000000000000000000000000000000000000000') throw error('Destino inválido.', 400);
      plan.push(call(c.USDT, tokenAbi, 'transfer', [destination, amount], 'Transferir USDT'));
      break;
    case 'amortize':
      positive();
      plan.push(call(c.PaymentEngine, coreAbi, 'amortizeWithBlue', [amount], 'Amortizar con BLUE'));
      break;
    case 'repayCollateral':
      positive();
      plan.push(call(c.CollateralVaultV6, vaultAbi, 'createAmortizationOrder', [amount], 'Crear orden con garantía depositada'));
      break;
    case 'secureOrder':
      positive();
      plan.push(call(
        c.CollateralVaultV6,
        vaultAbi,
        'collateralizeExisting',
        [parseOrderId(orderId), amount],
        'Bloquear USDT de una orden como garantía RED'
      ));
      break;
    case 'autoCollateral':
      if (typeof enabled !== 'boolean') throw error('Valor inválido para garantía automática.', 400);
      plan.push(call(
        c.CollateralVaultV6,
        vaultAbi,
        'setAutomaticExchangeCollateral',
        [enabled],
        'Configurar garantía automática al vencimiento'
      ));
      break;
    case 'sell':
      await approve(c.BlueTokenV6, c.ExchangeCustody);
      plan.push(call(c.ExchangeRouter, routerAbi, 'createOrder', [0, amount], 'Vender BLUE'));
      break;
    case 'buy': {
      positive();
      if (await at(c.USDT, tokenAbi).balanceOf(who) < amount) throw error('Saldo insuficiente.', 409);
      const redDebt = await at(c.RedTokenV6, tokenAbi).balanceOf(who);
      if (redDebt > 0n) {
        if (!c.ExchangeConfig) throw error('Configuración de Exchange no disponible.', 503);
        const [fee, reserved] = await Promise.all([
          at(c.ExchangeConfig, exchangeConfigAbi).feeBps(),
          at(c.CollateralVaultV6, vaultAbi).exchangeReserved(who)
        ]);
        const { secured, ordinary } = splitCollateralizedBuy(amount, redDebt, BigInt(fee), reserved, 0n);
        // Evita que cualquiera de los tramos (createCollateralOrder o createOrder) revierta on-chain por MIN_ORDER_AMOUNT (1.000000 USDT).
        if (amount >= 1_000_000n && ((secured > 0n && secured < 1_000_000n) || (ordinary > 0n && ordinary < 1_000_000n))) {
          throw error('Cada tramo de orden en el Exchange V6 requiere al menos 1.000000 USDT. Ajusta el importe o usa una orden existente como garantía RED.', 400);
        }
        if (secured > 0n) {
          await approve(c.USDT, c.CollateralVaultV6, secured);
          plan.push(call(
            c.CollateralVaultV6,
            vaultAbi,
            'depositAndCreateAmortizationOrder',
            [secured],
            'Bloquear USDT como garantía y amortizar RED'
          ));
        }
        if (ordinary > 0n) {
          await approve(c.USDT, c.ExchangeCustody, ordinary);
          plan.push(call(
            c.ExchangeRouter,
            routerAbi,
            'createOrder',
            [1, ordinary],
            'Comprar BLUE adicional en FIFO'
          ));
        }
      } else {
        await approve(c.USDT, c.ExchangeCustody, amount);
        plan.push(call(c.ExchangeRouter, routerAbi, 'createOrder', [1, amount], 'Comprar BLUE'));
      }
      break;
    }
    case 'cancel':
    case 'resume': {
      const validOrderId = parseOrderId(orderId);
      plan.push(call(
        c.ExchangeRouter,
        routerAbi,
        action === 'cancel' ? 'cancelOrder' : 'resumeOrder',
        [validOrderId],
        action === 'cancel' ? 'Cancelar orden' : 'Reactivar orden'
      ));
      break;
    }
    case 'claim': {
      const custody = at(c.ExchangeCustody, custodyAbi);
      for (const asset of [0, 1]) {
        if (await custody.pendingRefund(who, asset) > 0n) {
          plan.push(call(c.ExchangeRouter, routerAbi, 'claimPending', [asset], asset === 0 ? 'Reclamar BLUE' : 'Reclamar USDT'));
        }
      }
      if (!plan.length) throw error('No hay devoluciones pendientes.', 409);
      break;
    }
  }
  return plan;
}

module.exports = { buildV6WalletPlan, capabilities, splitCollateralizedBuy };
