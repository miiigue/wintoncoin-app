'use strict';

/**
 * backend/src/services/v6ChainBridge.js
 * Adaptador modular de lectura y operaciones de soporte para la Suite V6 en Demo.
 *
 * Principios de Ingeniería y Seguridad (Zero-Trust / SOC 2):
 * - Todas las lecturas de auditoría de usuario (`getUserAuditDetailedV6`) se anclan a un único
 *   bloque canónico (`blockHash` con `requireCanonical: true`) y verifican que la cadena no haya
 *   reorganizado dicho bloque durante la consulta.
 * - Comprueba la invariante contable individual `RedTokenV6.balanceOf(user) == CommitmentLedger.outstanding(user)`
 *   en cada lectura de estado.
 * - Mantiene compatibilidad estructural exacta con el contrato de respuesta consumido por
 *   `Wallet.jsx`, `Exchange.jsx`, `userController.getMyBalance` y `AdminWeb3Panel.jsx`.
 */

const { Contract, Interface, ethers, formatUnits, getAddress, parseUnits } = require('ethers');
const marketplaceDeployment = require('./marketplaceDeployment');

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function mint(address,uint256)'
];

const BLUE_V6_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function lockedBalanceOf(address) view returns (uint256)'
];

const LEDGER_V6_ABI = [
  'function outstanding(address) view returns (uint256)',
  'function matured(address) view returns (uint256)',
  'function firstLotId(address) view returns (uint256)',
  'function lot(address,uint256) view returns (uint256 dueAt, uint256 amount, uint256 fee, uint256 margin, bool active)'
];

const VAULT_V6_ABI = [
  'function collateralBalance(address) view returns (uint256)',
  'function freeCollateral(address) view returns (uint256)',
  'function exchangeReserved(address) view returns (uint256)',
  'function automaticExchangeCollateral(address) view returns (bool)',
  'function totalCollateral() view returns (uint256)'
];

const RISK_V6_ABI = [
  'function isKYCVerified(address) view returns (bool)',
  'function profile(address) view returns (tuple(uint128 creditLimit, uint8 level, bool kycVerified))',
  'function setProfile(address account, bool verified, uint128 newCreditLimit, uint8 level)'
];

const ENGINE_V6_ABI = [
  'function requiredCollateral(address) view returns (uint256)'
];

const MODE_V6_ABI = [
  'function mode() view returns (uint8)',
  'function owner() view returns (address)',
  'function setMode(uint8 newMode)'
];

const CONFIG_V6_ABI = [
  'function activeConfig() view returns (tuple(uint128 maxPayment, uint48 commitmentDuration, uint16 commissionBps))'
];

const ROUTER_V6_ABI = [
  'function matchNext(uint256 maximumScanned) returns (uint128)'
];

const MODE_NAMES = ['NORMAL', 'PRELAUNCH_FROZEN', 'EMERGENCY_EXIT_ONLY'];

/**
 * Devuelve la configuración activa de V6 si y solo si el proceso corre en Demo V6.
 */
function activeV6Config(env = process.env) {
  if (env.IS_DEMO_ENV !== 'true' || env.WINTON_ENVIRONMENT_ID !== 'demo') return null;
  const config = marketplaceDeployment.configuration(env);
  return config?.epoch === 'V6_DEMO' ? config : null;
}

/**
 * Mapea los nombres modulares de V6 incluyendo alias compatibles con lectores de interfaz.
 */
function withCompatibilityAliases(contracts) {
  if (!contracts) return contracts;
  return {
    ...contracts,
    CoreProtocol: contracts.PaymentEngine || contracts.CoreProtocol,
    CollateralVault: contracts.CollateralVaultV6 || contracts.CollateralVault,
    FifoExchange: contracts.ExchangeRouter || contracts.FifoExchange,
    ProtocolTreasury: contracts.ProtocolTreasuryV6 || contracts.ProtocolTreasury,
    BlueToken: contracts.BlueTokenV6 || contracts.BlueToken,
    RedToken: contracts.RedTokenV6 || contracts.RedToken
  };
}

/**
 * Consulta atómica y anclada a bloque del estado on-chain de una billetera en V6.
 */
async function getUserAuditDetailedV6({
  provider,
  config,
  walletAddress,
  offset = 0,
  limit = 50,
  finality = 'latest'
}) {
  if (!ethers.isAddress(walletAddress)) return { success: false, error: 'Dirección inválida' };
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return { success: false, error: 'Paginación inválida' };
  }
  try {
    if (!['latest', 'safe', 'finalized'].includes(finality)) throw new Error('Finalidad inválida');
    const wallet = getAddress(walletAddress);
    if (String((await provider.getNetwork()).chainId) !== String(config.chainId)) throw new Error('Red incorrecta');

    const head = await provider.getBlock('latest');
    const age = Math.floor(Date.now() / 1000) - head?.timestamp;
    if (!Number.isSafeInteger(head?.timestamp) || age < -60 || age > 300) throw new Error('Proveedor desactualizado');

    const block = finality === 'latest' ? head : await provider.getBlock(finality);
    if (!block || block.number > head.number || head.timestamp - block.timestamp > 3600) {
      throw new Error('Bloque incoherente o confirmación atrasada');
    }

    // Fija todas las lecturas a un único bloque canónico verificado por hash
    const runner = {
      provider,
      call: tx => provider.send('eth_call', [{ to: tx.to, data: tx.data }, { blockHash: block.hash, requireCanonical: true }])
    };

    const c = config.contracts;
    const usdtContract = new Contract(c.USDT, ERC20_ABI, runner);
    const blueContract = new Contract(c.BlueTokenV6, BLUE_V6_ABI, runner);
    const redContract = new Contract(c.RedTokenV6, ERC20_ABI, runner);
    const ledgerContract = new Contract(c.CommitmentLedger, LEDGER_V6_ABI, runner);
    const vaultContract = new Contract(c.CollateralVaultV6, VAULT_V6_ABI, runner);
    const riskContract = new Contract(c.RiskRegistry, RISK_V6_ABI, runner);
    const engineContract = new Contract(c.PaymentEngine, ENGINE_V6_ABI, runner);

    const [
      usdt,
      blue,
      blueLocked,
      red,
      outstanding,
      matured,
      firstLotId,
      collateral,
      free,
      reserved,
      automatic,
      profile,
      required
    ] = await Promise.all([
      usdtContract.balanceOf(wallet),
      blueContract.balanceOf(wallet),
      blueContract.lockedBalanceOf(wallet),
      redContract.balanceOf(wallet),
      ledgerContract.outstanding(wallet),
      ledgerContract.matured(wallet),
      ledgerContract.firstLotId(wallet),
      vaultContract.collateralBalance(wallet),
      vaultContract.freeCollateral(wallet),
      vaultContract.exchangeReserved(wallet),
      vaultContract.automaticExchangeCollateral(wallet),
      riskContract.profile(wallet),
      engineContract.requiredCollateral(wallet)
    ]);

    if (BigInt(red) !== BigInt(outstanding)) {
      throw new Error('Inconsistencia contable V6 entre token RED y libro de compromisos');
    }

    const debtLots = [];
    let totalLots = 0;
    if (BigInt(firstLotId) > 0n) {
      const firstLot = await ledgerContract.lot(wallet, firstLotId);
      if (firstLot.active) {
        totalLots = 1;
        if (offset === 0 && limit >= 1) {
          debtLots.push({
            index: 0,
            id: firstLotId.toString(),
            originalAmount: formatUnits(firstLot.amount, 6),
            remainingAmount: formatUnits(outstanding, 6),
            dueAt: new Date(Number(firstLot.dueAt) * 1000).toISOString(),
            repaid: false,
            isOverdue: Number(firstLot.dueAt) <= block.timestamp
          });
        }
      }
    }

    if ((await provider.getBlock(block.number))?.hash !== block.hash) {
      throw new Error('El bloque cambió durante la consulta');
    }

    const baseLimit = BigInt(profile.creditLimit);
    const coverage = baseLimit + BigInt(collateral);
    const isDelinquent = BigInt(matured) > 0n;
    // En V6, si queda compromiso vencido tras aplicar el BLUE propio disponible, no se permite originar nuevo compromiso RED
    const blockedByOverdue = BigInt(matured) > BigInt(blue);
    const availableCapacity = blockedByOverdue
      ? 0n
      : (coverage > BigInt(outstanding) ? coverage - BigInt(outstanding) : 0n);

    return {
      success: true,
      epoch: 'V6_DEMO',
      wallet,
      blockNumber: block.number,
      blockHash: block.hash,
      chainId: String(config.chainId),
      finality,
      usdtWalletBalance: formatUnits(usdt, 6),
      blueBalance: formatUnits(blue, 6),
      blueLocked: formatUnits(blueLocked, 6),
      blueAvailable: formatUnits(BigInt(blue) - BigInt(blueLocked), 6),
      redCommitment: formatUnits(red, 6),
      collateralVault: {
        totalLocked: formatUnits(collateral, 6),
        freeForWithdrawal: formatUnits(free, 6),
        reservedInExchange: formatUnits(reserved, 6),
        pendingReserve: '0.0',
        automaticAtMaturity: Boolean(automatic)
      },
      credit: {
        baseLimit: formatUnits(baseLimit, 6),
        availableCapacity: formatUnits(availableCapacity, 6),
        requiredCollateral: formatUnits(required, 6),
        isDelinquent,
        isKYCVerified: Boolean(profile.kycVerified),
        level: Number(profile.level),
        extensionMarginLimit: '0.0',
        extensionMarginUsed: '0.0'
      },
      debtLots,
      pagination: {
        offset,
        limit,
        total: String(totalLots),
        nextOffset: null
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Estado global de la suite V6 para el panel administrativo (`/api/admin/web3/status` y `/api/web3/status`).
 */
async function getProtocolStatusV6({ provider, wallet, config }) {
  try {
    const net = await provider.getNetwork();
    let relayerBalance = '0.0';
    let relayerAddress = null;

    if (wallet) {
      relayerAddress = await wallet.getAddress();
      const bal = await provider.getBalance(relayerAddress);
      relayerBalance = ethers.formatEther(bal);
    }

    const c = config.contracts;
    const modeContract = new Contract(c.ProtocolModeController, MODE_V6_ABI, provider);
    const protocolConfig = new Contract(c.ProtocolConfig, CONFIG_V6_ABI, provider);
    const vaultContract = new Contract(c.CollateralVaultV6, VAULT_V6_ABI, provider);

    const [modeNum, activeCfg, totalLocked] = await Promise.all([
      modeContract.mode(),
      protocolConfig.activeConfig(),
      vaultContract.totalCollateral()
    ]);

    const paused = Number(modeNum) !== 0;
    const contractPauses = {
      CoreProtocol: paused,
      CollateralVault: paused,
      FifoExchange: paused,
      ProtocolTreasury: paused
    };

    return {
      success: true,
      epoch: 'V6_DEMO',
      mode: MODE_NAMES[Number(modeNum)] || 'UNKNOWN',
      network: net.name || 'optimismSepolia',
      chainId: net.chainId.toString(),
      relayer: {
        address: relayerAddress,
        balanceEth: relayerBalance,
        isConfigured: Boolean(wallet)
      },
      contracts: withCompatibilityAliases(c),
      parameters: {
        paused,
        maxTransactionAmount: formatUnits(activeCfg.maxPayment, 6),
        commissionRateBps: activeCfg.commissionBps.toString(),
        totalCollateralLocked: formatUnits(totalLocked, 6),
        vaultPaused: paused,
        exchangePaused: paused,
        treasuryPaused: paused,
        contractPauses,
        allEconomicContractsPaused: paused,
        commitmentDurationSeconds: Number(activeCfg.commitmentDuration),
        extensionFeeRecipient: c.ProtocolTreasuryV6,
        extensionOptions: [],
        minExtensionLevel: 3,
        minExtensionMarginLevel: 5
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      network: 'desconectado'
    };
  }
}

async function checkUserKYCV6(provider, config, walletAddress) {
  if (!walletAddress || !ethers.isAddress(walletAddress)) return false;
  const risk = new Contract(config.contracts.RiskRegistry, RISK_V6_ABI, provider);
  return Boolean(await risk.isKYCVerified(walletAddress));
}

async function executeMatchingV6(bridge, config, _maxMatches = 10, maxOrdersScanned = 20) {
  if (!bridge._isReady() || !config?.contracts?.ExchangeRouter) {
    return { success: false, error: 'Exchange V6 no configurado' };
  }
  try {
    const router = new Contract(config.contracts.ExchangeRouter, ROUTER_V6_ABI, bridge.wallet || bridge.provider);
    return await require('./durableRelayer').execute(bridge, router, 'matchNext', [maxOrdersScanned]);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function mintMockUsdtV6(bridge, config, walletAddress, amountUnits) {
  if (process.env.ENABLE_TEST_TOKEN_MINT !== 'true') {
    return { success: false, error: 'Emisión de prueba deshabilitada' };
  }
  if (!bridge._isReady() || !config?.contracts?.USDT) {
    return { success: false, error: 'Token USDT V6 no configurado' };
  }
  try {
    const { chainId } = await bridge.provider.getNetwork();
    if (![1337n, 31337n, 11155420n].includes(chainId)) {
      throw new Error('Emisión de prueba prohibida en esta red');
    }
    if (!await checkUserKYCV6(bridge.provider, config, walletAddress)) {
      throw new Error('Se requiere KYC aprobado en RiskRegistry V6');
    }
    if (!/^\d+(\.\d{1,6})?$/.test(String(amountUnits)) || parseUnits(String(amountUnits), 6) <= 0n || parseUnits(String(amountUnits), 6) > 5_000_000_000n) {
      throw new Error('Importe de prueba inválido');
    }
    const usdt = new Contract(config.contracts.USDT, ERC20_ABI, bridge.wallet || bridge.provider);
    return await require('./durableRelayer').execute(bridge, usdt, 'mint', [walletAddress, parseUnits(String(amountUnits), 6)]);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Mapa estricto de acciones de contención y recuperación de modo en ProtocolModeController V6.
 * - 0 (NORMAL): Operación regular activa.
 * - 1 (PRELAUNCH_FROZEN): Congelamiento total absoluto (bloquea operaciones Y retiros de USDT).
 * - 2 (EMERGENCY_EXIT_ONLY): Parada económica operativa (permite retiros de emergencia ordenados).
 */
const V6_MODE_ACTIONS = {
  v6_mode_normal: { targetMode: 0, label: 'NORMAL' },
  v6_mode_freeze_all: { targetMode: 1, label: 'PRELAUNCH_FROZEN' },
  v6_mode_emergency_exit: { targetMode: 2, label: 'EMERGENCY_EXIT_ONLY' }
};

/**
 * Construye el plan de administración del propietario para V6:
 * 1) Control de emergencia y modos en ProtocolModeController (`setMode`).
 * 2) Perfiles de cumplimiento/riesgo en RiskRegistry (`setProfile`),
 *    conservando los campos existentes del perfil que no se están editando.
 */
async function buildV6OwnerActionPlan(provider, config, action, input) {
  const { error } = require('./chainOperationStore');

  // --- Rama 1: Control de Modos y Parada de Emergencia en ProtocolModeController V6 ---
  if (Object.prototype.hasOwnProperty.call(V6_MODE_ACTIONS, action)) {
    const { targetMode, label } = V6_MODE_ACTIONS[action];
    const modeIface = new Interface(MODE_V6_ABI);
    const modeAddress = getAddress(config.contracts.ProtocolModeController);
    const modeContract = new Contract(modeAddress, MODE_V6_ABI, provider);

    // Lectura on-chain del modo actual y propietario real (Zero-Trust: nunca confiar en caché)
    const [currentModeRaw, ownerRaw] = await Promise.all([
      modeContract.mode(),
      modeContract.owner()
    ]);
    const currentMode = Number(currentModeRaw);
    const owner = getAddress(ownerRaw);

    // Evita preparar transacciones redundantes si el contrato ya opera en el modo solicitado
    if (currentMode === targetMode) {
      throw error(`El protocolo V6 ya se encuentra en modo ${label}; no se preparó una transacción redundante.`, 409);
    }

    const data = modeIface.encodeFunctionData('setMode', [targetMode]);

    // Simulación estricta (eth_call) desde la billetera propietaria antes de registrar en BD
    try {
      await provider.call({ from: owner, to: modeAddress, data, value: 0n });
    } catch {
      throw error('La simulación on-chain del cambio de modo V6 desde la billetera propietaria revertiría; operación cancelada.', 409);
    }

    return {
      target: modeAddress,
      method: 'setMode',
      data,
      projection: {},
      // Recurso aislado por acción para que cancelar una firma en Nivel 1 nunca bloquee
      // escalar de inmediato a Nivel 2 (Congelamiento Total), manteniendo idempotencia por acción.
      resource: `external-owner:${action}`
    };
  }

  // --- Rama 2: Gestión de Perfiles en RiskRegistry V6 ---
  const riskIface = new Interface(RISK_V6_ABI);
  const riskAddress = getAddress(config.contracts.RiskRegistry);
  const riskContract = new Contract(riskAddress, RISK_V6_ABI, provider);

  if (!['kyc', 'credit_limit', 'user_benefits'].includes(action)) {
    throw error('En V6 los parámetros globales usan timelock en ProtocolConfig/ExtensionManager; usa el control de modos V6 o perfiles de RiskRegistry.', 409);
  }

  const wallet = getAddress(input.walletAddress);
  const current = await riskContract.profile(wallet);
  let verified = Boolean(current.kycVerified);
  let creditLimit = BigInt(current.creditLimit);
  let level = Number(current.level);
  let projection = {};

  if (action === 'kyc') {
    if (typeof input.status !== 'boolean') throw error('Estado KYC inválido.', 400);
    verified = input.status;
    projection = { type: 'kyc', wallet, value: verified };
  } else if (action === 'credit_limit') {
    const raw = String(input.limit ?? '');
    if (!/^\d+(?:\.\d{1,6})?$/.test(raw)) throw error('Importe inválido.', 400);
    const amount = parseUnits(raw, 6);
    if (amount > 100_000_000n * 1_000_000n) throw error('Importe fuera de límite.', 400);
    creditLimit = amount;
    projection = { type: 'credit_manual', wallet, value: raw };
  } else if (action === 'user_benefits') {
    const nextLevel = Number(input.level);
    if (!/^\d+$/.test(String(input.level)) || !Number.isSafeInteger(nextLevel) || nextLevel < 0 || nextLevel > 6) {
      throw error('Nivel fuera de límite para V6 (0 a 6).', 400);
    }
    level = nextLevel;
  }

  return {
    target: riskAddress,
    method: 'setProfile',
    data: riskIface.encodeFunctionData('setProfile', [wallet, verified, creditLimit, level]),
    projection,
    resource: `external-owner:${action}:${wallet.toLowerCase()}`
  };
}

module.exports = {
  activeV6Config,
  withCompatibilityAliases,
  getUserAuditDetailedV6,
  getProtocolStatusV6,
  checkUserKYCV6,
  executeMatchingV6,
  mintMockUsdtV6,
  buildV6OwnerActionPlan
};
