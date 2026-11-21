'use strict';

const { Wallet, Interface, parseUnits } = require('ethers');

describe('V6 Credit Write Path, Durable Policy Recovery & Publication Capacity', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        jest.resetModules();
    });

    test('durableAdministration.credit en V6 escribe en RiskRegistry.setProfile conservando kycVerified y level', async () => {
        const adminWallet = Wallet.createRandom();
        const userWallet = Wallet.createRandom().address;
        const riskAddress = Wallet.createRandom().address;
        process.env.ADMIN_CHAIN_PRIVATE_KEY = adminWallet.privateKey;
        delete process.env.RELAYER_PRIVATE_KEY;
        delete process.env.GAS_SPONSOR_PRIVATE_KEY;

        const riskIface = new Interface([
            'function profile(address) view returns (tuple(uint128 creditLimit, uint8 level, bool kycVerified))',
            'function setProfile(address account, bool verified, uint128 newCreditLimit, uint8 level)',
            'function owner() view returns (address)'
        ]);

        const mockPool = {
            query: jest.fn(async () => ({ rows: [], rowCount: 0 }))
        };
        const mockDeployment = {
            validate: jest.fn(async () => ({
                chainId: '11155420',
                epoch: 'V6_DEMO',
                fingerprint: '0x' + 'ab'.repeat(32),
                contracts: { RiskRegistry: riskAddress }
            })),
            isV6Epoch: jest.fn(epoch => /^V6(?:_|$)/.test(String(epoch || '')))
        };
        const mockGate = {
            assertOperational: jest.fn(async () => ({ enabled: true }))
        };
        const prepareSpy = jest.fn(async payload => ({ id: 'op-1', ...payload }));
        const authorizeSpy = jest.fn(async () => ({ success: true, pending: true, operationId: 'op-1' }));

        jest.doMock('../src/config/db', () => mockPool);
        jest.doMock('../src/services/marketplaceDeployment', () => mockDeployment);
        jest.doMock('../src/services/economicWriteGate', () => mockGate);
        jest.doMock('../src/services/chainOperationStore', () => ({
            ChainOperationStore: jest.fn().mockImplementation(() => ({
                prepare: prepareSpy,
                authorize: authorizeSpy
            })),
            locked: jest.fn(async (_pool, _key, fn) => fn()),
            publicResult: jest.fn(x => x)
        }));
        jest.doMock('../src/services/chainSigning', () => ({
            signStep: jest.fn(async () => ({ raw: '0x00', hash: '0x11', label: 'setProfile', nonce: 1 }))
        }));

        const provider = {
            call: jest.fn(async ({ data }) => {
                if (data.startsWith(riskIface.getFunction('profile').selector)) {
                    return riskIface.encodeFunctionResult('profile', [{ creditLimit: 0n, level: 2, kycVerified: true }]);
                }
                if (data.startsWith(riskIface.getFunction('owner').selector)) {
                    return riskIface.encodeFunctionResult('owner', [adminWallet.address]);
                }
                throw new Error('Unexpected eth_call: ' + data);
            })
        };

        const durableAdmin = require('../src/services/durableAdministration');
        const res = await durableAdmin.credit({ provider }, userWallet, 100, { manual: false, alreadyLocked: true });

        expect(res.success).toBe(true);
        expect(prepareSpy).toHaveBeenCalledTimes(1);
        const prepArg = prepareSpy.mock.calls[0][0];
        expect(prepArg.kind).toBe('setProfile');
        expect(prepArg.resource).toBe('credit:' + userWallet.toLowerCase());
        expect(prepArg.payload.to.toLowerCase()).toBe(riskAddress.toLowerCase());
        const decoded = riskIface.decodeFunctionData('setProfile', prepArg.payload.data);
        expect(decoded[0].toLowerCase()).toBe(userWallet.toLowerCase());
        expect(decoded[1]).toBe(true); // kycVerified conservado
        expect(decoded[2]).toBe(parseUnits('100', 6)); // nuevo límite 100
        expect(Number(decoded[3])).toBe(2); // level conservado
    });

    test('creditPolicyJobs.enqueueUserSync registra de forma durable el usuario recién activado', async () => {
        const queries = [];
        const client = {
            query: jest.fn(async (sql, params) => {
                queries.push({ sql, params });
                if (sql.includes('SELECT id FROM credit_policy_versions')) {
                    return { rows: [{ id: 1 }], rowCount: 1 };
                }
                return { rows: [], rowCount: 1 };
            })
        };
        const { enqueueUserSync } = require('../src/services/creditPolicyJobs');
        const out = await enqueueUserSync(client, 7, 'WALLET_ACTIVATED');

        expect(out).toEqual({ versionId: 1, userId: 7 });
        expect(queries.some(q => q.sql.includes('INSERT INTO credit_policy_issues') && q.params[1] === 7 && q.params[2] === 'WALLET_ACTIVATED')).toBe(true);
        expect(queries.some(q => q.sql.includes("SET state = 'complete_with_issues'"))).toBe(true);
    });

    test('creditPolicyJobs.tick detecta y encola cuentas activas sin perfil crediticio confirmado', async () => {
        const queries = [];
        const client = {
            query: jest.fn(async (sql, params) => {
                queries.push({ sql, params });
                if (sql.includes('SELECT * FROM credit_policy_jobs')) {
                    return { rows: [{ version_id: 1, state: 'complete', cursor_id: 0 }], rowCount: 1 };
                }
                if (sql.includes('JOIN smart_accounts sa')) {
                    return { rows: [{ id: 7 }], rowCount: 1 };
                }
                if (sql.includes('FROM credit_policy_issues')) {
                    return { rows: [], rowCount: 0 };
                }
                if (sql.includes('SELECT id FROM credit_policy_versions')) {
                    return { rows: [{ id: 1 }], rowCount: 1 };
                }
                return { rows: [], rowCount: 0 };
            })
        };
        jest.doMock('../src/services/chainOperationStore', () => ({
            locked: jest.fn(async (_pool, _key, fn) => fn(client))
        }));
        const { tick } = require('../src/services/creditPolicyJobs');
        await tick({}, { syncCreditLimitOnChain: jest.fn() });

        expect(queries.some(q => q.sql.includes('INSERT INTO credit_policy_issues') && q.params[1] === 7 && q.params[2] === 'ACTIVE_WALLET_POLICY_RECOVERY')).toBe(true);
    });
});
