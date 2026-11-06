'use strict';

const {
  CONTRACT_KEYS,
  PAUSE_ORDER,
  UNPAUSE_ORDER,
  ABI,
  parseArgs,
  validateManifest,
  operationOrder,
  unsignedTemplate,
  buildPackage,
} = require('../../web3-contracts/scripts/prepare-v5-integral-pause');
const { Interface, keccak256 } = require('ethers');

const contracts = {
  CoreProtocol: '0x103C502611008dAf8B0488E99486e46CCB00F41b',
  FifoExchange: '0xE229ca0F66fA7b56130B81BadcfcB028C85c4917',
  CollateralVault: '0xF970332060f1DB1475Fe2DAF1b5dfd89111c1A2B',
  ProtocolTreasury: '0x0723B1943Cb4EcDFcDD842B517006A076F281238',
  BlueToken: '0x376ee519eFFB06FBF1Bcb31a406507E41A817923',
  RedToken: '0x0C14088080C96204eb24D60Fb852bCd272954865',
  USDT: '0xF9913A351735862dF6AC9a927DE1e3aD871faf6E',
};
const manifest = { chainId: '11155420', deployer: '0x7d2C6c16EDe986a8bea0204A9824b4C264256C77', contracts };
const mockCode = '0x60006000';
const mockCodeHash = keccak256(mockCode);
const expectedCodeHashes = Object.fromEntries(CONTRACT_KEYS.map(key => [key, mockCodeHash]));

describe('preparador integral de pausa V5', () => {
  test('usa orden de contención y rollback inverso', () => {
    expect(operationOrder('pause')).toEqual(PAUSE_ORDER);
    expect(operationOrder('unpause')).toEqual(UNPAUSE_ORDER);
    expect(UNPAUSE_ORDER).toEqual([...PAUSE_ORDER].reverse());
  });

  test('exige cuatro contratos distintos en Optimism Sepolia', () => {
    expect(validateManifest(manifest)).toEqual(contracts);
    expect(() => validateManifest({ ...manifest, chainId: '1' })).toThrow('WRONG_MANIFEST_CHAIN');
    const duplicate = { ...contracts, ProtocolTreasury: contracts.CoreProtocol };
    expect(() => validateManifest({ ...manifest, contracts: duplicate })).toThrow('DUPLICATE_CONTRACT_ADDRESS');
    expect(() => validateManifest({ ...manifest, contracts: { ...contracts, FifoExchange: undefined } }))
      .toThrow('MISSING_CONTRACT');
    expect(() => validateManifest({ ...manifest, deployer: contracts.CoreProtocol })).toThrow('MANIFEST_OWNER_MISMATCH');
  });

  test('genera plantillas sin firma, valor ni datos arbitrarios', () => {
    const plan = unsignedTemplate(contracts, 'pause');
    expect(plan).toHaveLength(CONTRACT_KEYS.length);
    expect(plan.map(item => item.contract)).toEqual(PAUSE_ORDER);
    for (const item of plan) {
      expect(item.value).toBe('0');
      expect(item.method).toBe('pause');
      expect(item.data).toBe(ABI.encodeFunctionData('pause'));
      expect(Object.hasOwn(item, 'signature')).toBe(false);
    }
  });

  test('no acepta argumentos operativos desconocidos', () => {
    expect(parseArgs(['--action', 'pause', '--rpc-secondary', 'https://secondary.invalid']).action).toBe('pause');
    expect(() => parseArgs(['--action', 'pause'])).toThrow('SECONDARY_RPC_REQUIRED');
    expect(() => parseArgs(['--action', 'broadcast'])).toThrow('INVALID_ACTION');
    expect(() => parseArgs(['--private-key', 'x'])).toThrow('UNKNOWN_ARGUMENT');
    expect(() => parseArgs(['--rpc-secondary', 'https://secondary.invalid', '--balance-margin-bps', '9999'])).toThrow('INVALID_BALANCE_MARGIN_BPS');
    expect(() => parseArgs(['--rpc-secondary', 'https://secondary.invalid', '--l1-fee-buffer-wei', '-1'])).toThrow('INVALID_L1_FEE_BUFFER');
    expect(() => parseArgs(['--rpc-secondary', 'https://secondary.invalid', '--rpc-timeout-ms', '999'])).toThrow('INVALID_RPC_TIMEOUT');
  });

  function liveProviderMock({ balance = 10n ** 18n, ownerOverride } = {}) {
    const owner = ownerOverride || '0x7d2C6c16EDe986a8bea0204A9824b4C264256C77';
    const links = new Interface([
      'function blueToken() view returns(address)', 'function redToken() view returns(address)',
      'function vault() view returns(address)', 'function treasury() view returns(address)',
      'function collateralToken() view returns(address)', 'function coreProtocol() view returns(address)',
      'function exchange() view returns(address)', 'function usdtToken() view returns(address)',
      'function decimals() view returns(uint8)',
    ]);
    const addressKey = Object.fromEntries(Object.entries(contracts).map(([key, value]) => [value.toLowerCase(), key]));
    return {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 11155420n }),
      getCode: jest.fn(async address => address.toLowerCase() === owner.toLowerCase() ? '0x' : mockCode),
      call: jest.fn(async request => {
        const selector = request.data.slice(0, 10);
        if (selector === ABI.getFunction('owner').selector) return ABI.encodeFunctionResult('owner', [owner]);
        if (selector === ABI.getFunction('paused').selector) return ABI.encodeFunctionResult('paused', [false]);
        if (selector === ABI.getFunction('pause').selector) return '0x';
        const target = addressKey[request.to.toLowerCase()];
        const values = {
          CoreProtocol: { blueToken: contracts.BlueToken, redToken: contracts.RedToken, vault: contracts.CollateralVault, treasury: contracts.ProtocolTreasury },
          CollateralVault: { collateralToken: contracts.USDT, coreProtocol: contracts.CoreProtocol, exchange: contracts.FifoExchange },
          FifoExchange: { blueToken: contracts.BlueToken, usdtToken: contracts.USDT, coreProtocol: contracts.CoreProtocol, treasury: contracts.ProtocolTreasury },
          ProtocolTreasury: { blueToken: contracts.BlueToken, coreProtocol: contracts.CoreProtocol },
        };
        for (const name of ['blueToken', 'redToken', 'vault', 'treasury', 'collateralToken', 'coreProtocol', 'exchange', 'usdtToken']) {
          if (selector === links.getFunction(name).selector && values[target]?.[name]) {
            return links.encodeFunctionResult(name, [values[target][name]]);
          }
        }
        if (selector === links.getFunction('decimals').selector) return links.encodeFunctionResult('decimals', [6]);
        throw new Error('UNEXPECTED_CALL');
      }),
      getBlock: jest.fn(async tag => ({ number: tag === 'finalized' ? 90 : 100 })),
      getTransactionCount: jest.fn().mockResolvedValue(7),
      getBalance: jest.fn().mockResolvedValue(balance),
      getFeeData: jest.fn().mockResolvedValue({ gasPrice: 10n, maxFeePerGas: 20n, maxPriorityFeePerGas: 1n }),
      estimateGas: jest.fn().mockResolvedValue(40_000n),
    };
  }

  test('construye paquete live simulado, sin firma ni broadcast y con presupuesto suficiente', async () => {
    const provider = liveProviderMock();
    const secondaryProvider = liveProviderMock();
    const result = await buildPackage({
      provider,
      secondaryProvider,
      manifest,
      action: 'pause',
      expectedCodeHashes,
      now: () => new Date('2026-11-04T00:00:00.000Z'),
    });
    expect(result.transactions.map(tx => tx.contract)).toEqual(PAUSE_ORDER);
    expect(result.transactions.map(tx => tx.nonce)).toEqual([7, 8, 9, 10]);
    expect(result.gasBudget.transactionCount).toBe(4);
    expect(result.gasBudget.totalProposedGasLimit).toBe('200000');
    expect(result.gasBudget.sufficient).toBe(true);
    expect(result.rpcConsensus.sources).toBe(2);
    expect(result.fingerprint).toBe('0xa4fbb3c5518e2f8d0a4c2257fcc3f802697ee5c3a3ad2de75f15f1ece98fddb1');
    expect(result.executionProperties.atomic).toBe(false);
    expect(result.authorization).toMatchObject({ signed: false, broadcast: false, approvedForExecution: false });
    expect(provider.call).toHaveBeenCalled();
    expect(provider.sendTransaction).toBeUndefined();
  });

  test('falla cerrado si el owner no cubre gas, margen y reserva L1', async () => {
    const provider = liveProviderMock({ balance: 1n });
    const secondaryProvider = liveProviderMock({ balance: 1n });
    await expect(buildPackage({
      provider,
      secondaryProvider,
      manifest,
      action: 'pause',
      expectedCodeHashes,
    })).rejects.toThrow('OWNER_GAS_BALANCE_INSUFFICIENT');
  });

  test('falla cerrado sin segunda fuente o cuando los RPC discrepan en nonce', async () => {
    const provider = liveProviderMock();
    await expect(buildPackage({ provider, manifest, action: 'pause', expectedCodeHashes })).rejects.toThrow('SECONDARY_RPC_REQUIRED');
    const secondaryProvider = liveProviderMock();
    secondaryProvider.getTransactionCount = jest.fn(async (_owner, tag) => tag === 'pending' ? 8 : 7);
    await expect(buildPackage({ provider, secondaryProvider, manifest, action: 'pause', expectedCodeHashes }))
      .rejects.toThrow('RPC_NONCE_DISAGREEMENT');
  });
});
