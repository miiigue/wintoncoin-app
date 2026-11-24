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

    test('chainOperationStore.advanceLocked al confirmar proyección kyc=true encola de forma durable al usuario y a su referente', async () => {
        jest.dontMock('../src/services/chainOperationStore');
        const enqueueSpy = jest.fn(async () => ({ versionId: 1 }));
        jest.doMock('../src/services/creditPolicyJobs', () => ({ enqueueUserSync: enqueueSpy }));
        jest.doMock('../src/services/chainConfirmation', () => ({
            confirmedReceipt: jest.fn(async () => ({ status: 1, blockHash: '0xblock' }))
        }));
        const { ChainOperationStore } = require('../src/services/chainOperationStore');
        const db = {
            query: jest.fn(async sql => {
                if (sql.startsWith('UPDATE users SET kyc_verified=')) {
                    return { rowCount: 1, rows: [{ id: 15, referrer_id: 4 }] };
                }
                return { rowCount: 1, rows: [] };
            })
        };
        const provider = {
            getNetwork: jest.fn(async () => ({ chainId: 11155420n })),
            getTransactionReceipt: jest.fn(async () => ({ status: 1, blockHash: '0xblock' }))
        };
        const store = new ChainOperationStore({}, provider);
        const row = {
            id: 'op-kyc-1',
            chain_id: '11155420',
            sender: '0x0000000000000000000000000000000000000001',
            kind: 'owner:kyc',
            state: 'pending',
            payload: { planLength: 1 },
            projection: { type: 'kyc', wallet: '0x0000000000000000000000000000000000000015', value: true },
            steps: [{ hash: '0xtx', confirmed: false, raw: '0x00' }]
        };

        const res = await store.advanceLocked(row, db);
        expect(res.success).toBe(true);
        expect(enqueueSpy).toHaveBeenCalledWith(db, 15, 'KYC_VERIFIED');
        expect(enqueueSpy).toHaveBeenCalledWith(db, 4, 'REFERRAL_KYC_VERIFIED');
    });

    describe('publicationController.createPublication — Validación Real de Cobertura V6 y Reservas', () => {
        function buildControllerFixture({
            category = 'request',
            blueCost = 50,
            slots = 1,
            maxRepeat = 1,
            commissionPct = '5',
            creditCapacity = '100.0',
            blueAvailable = '0.0',
            alreadyLocked = '0',
            authorId = 8,
            responsibleUserId = 8,
            walletAddress = '0x375fccc338df9b0d654449cc7688d763f54f96a8',
            auditSuccess = true
        } = {}) {
            const queries = [];
            const client = {
                query: jest.fn(async (sql, params) => {
                    queries.push({ sql, params });
                    if (sql.includes('FROM app_settings')) {
                        return {
                            rows: [
                                { setting_key: 'allow_new_publications', setting_value: 'true' },
                                { setting_key: 'allow_request_publications', setting_value: 'true' },
                                { setting_key: 'allow_sell_publications', setting_value: 'true' },
                                { setting_key: 'allow_donation_publications', setting_value: 'true' },
                                { setting_key: 'pre_launch_mode_enabled', setting_value: 'false' },
                                { setting_key: 'platform_commission_percentage', setting_value: commissionPct }
                            ]
                        };
                    }
                    if (sql.includes('FROM users WHERE referral_code = $1')) {
                        return { rows: [{ id: 55, username: 'Beneficiario', referral_code: 'BEN55', web3_wallet_address: '0x0000000000000000000000000000000000000055' }], rowCount: 1 };
                    }
                    if (sql.includes('FROM users WHERE username = $1')) {
                        return { rows: [{ id: authorId, is_verified: true, web3_wallet_address: walletAddress }] };
                    }
                    if (sql.includes('SELECT red_balance, liquid_blue_balance, web3_wallet_address FROM users')) {
                        return { rows: [{ red_balance: '0', liquid_blue_balance: '0', web3_wallet_address: walletAddress }] };
                    }
                    if (sql.includes('FROM web3_escrow_holds')) {
                        return { rows: [{ total_locked: alreadyLocked }] };
                    }
                    if (sql.includes('INSERT INTO publications')) {
                        return { rows: [{ id: 999 }] };
                    }
                    return { rows: [], rowCount: 1 };
                }),
                release: jest.fn()
            };
            const pool = { connect: jest.fn(async () => client), query: client.query };

            jest.doMock('../src/config/db', () => pool);
            jest.doMock('../src/services/publicationKyc', () => ({
                requirePublicationKyc: jest.fn(async () => true)
            }));
            jest.doMock('../src/services/publicationService', () => ({
                getDebtResponsibleUserById: jest.fn(async () => ({ user_id: responsibleUserId })),
                resolveRepeatCooldownHours: jest.fn(() => 24)
            }));
            jest.doMock('../src/services/v6ChainBridge', () => ({
                activeV6Config: jest.fn(() => ({ epoch: 'V6_DEMO', chainId: '11155420' }))
            }));
            jest.doMock('../src/services/web3BridgeService', () => ({
                getUserAuditDetailed: jest.fn(async () => auditSuccess
                    ? { success: true, blueAvailable, credit: { availableCapacity: creditCapacity } }
                    : { success: false, error: 'RPC down' })
            }));
            jest.doMock('../src/services/auditService', () => ({
                logAuditEvent: jest.fn(async () => {})
            }));
            jest.doMock('../src/services/notificationService', () => ({
                sendPushNotificationToAll: jest.fn(async () => {}),
                sendNotificationToAll: jest.fn(async () => {})
            }));

            const routes = {};
            const mockRouter = {
                get: jest.fn(),
                put: jest.fn(),
                delete: jest.fn(),
                patch: jest.fn(),
                post: jest.fn((path, ...handlers) => {
                    routes[path] = handlers[handlers.length - 1];
                })
            };
            const registerController = require('../src/controllers/publicationController');
            const noopMw = () => (_req, _res, next) => next();
            registerController(mockRouter, pool, noopMw, noopMw, jest.fn(async () => {}));
            const createPublication = routes['/publish'];

            const req = {
                user: { userId: authorId, username: 'TestUser' },
                body: {
                    title: 'Tarea de prueba',
                    description: 'Descripción válida para prueba',
                    blueCost: category === 'request' ? blueCost : undefined,
                    blueSell: category === 'sell' ? blueCost : undefined,
                    goalAmount: category === 'donation' ? blueCost : undefined,
                    beneficiaryReferralCode: category === 'donation' ? 'BEN55' : undefined,
                    publicationType: category,
                    availableSlots: slots,
                    maxRepeatPerUser: maxRepeat,
                    allowRepeatParticipation: maxRepeat > 1,
                    authorUsername: 'TestUser'
                }
            };
            const res = {
                statusCode: 200,
                body: null,
                status(code) { this.statusCode = code; return this; },
                json(payload) { this.body = payload; return this; }
            };
            return { controller: { createPublication }, req, res, queries };
        }

        test('rechaza con 402 cuando capacidad=0, BLUE=100 y reservas=100 (sin doble conteo de BLUE)', async () => {
            const { controller, req, res } = buildControllerFixture({
                category: 'request',
                blueCost: 10,
                creditCapacity: '0.0',
                blueAvailable: '100.0',
                alreadyLocked: '100.0'
            });
            await controller.createPublication(req, res);
            expect(res.statusCode).toBe(402);
            expect(res.body.message).toMatch(/Fondos Insuficientes/i);
        });

        test('permite publicar request cuando la capacidad V6 confirmada (100) cubre coste + comisión (52.5)', async () => {
            const { controller, req, res } = buildControllerFixture({
                category: 'request',
                blueCost: 50,
                commissionPct: '5',
                creditCapacity: '100.0',
                blueAvailable: '0.0',
                alreadyLocked: '0'
            });
            await controller.createPublication(req, res);
            expect(res.statusCode).toBe(201);
        });

        test('consulta reservas por COALESCE(responsible_user_id, author_id) para tutelados y bloquea al segundo tutelado si el tutor excede capacidad', async () => {
            const { controller, req, res, queries } = buildControllerFixture({
                category: 'request',
                blueCost: 50,
                commissionPct: '5',
                creditCapacity: '100.0',
                blueAvailable: '0.0',
                alreadyLocked: '52.5',
                authorId: 22,
                responsibleUserId: 10
            });
            await controller.createPublication(req, res);
            expect(res.statusCode).toBe(402);
            const escrowQuery = queries.find(q => q.sql.includes('FROM web3_escrow_holds'));
            expect(escrowQuery.sql).toContain('COALESCE(responsible_user_id, author_id) = $1');
            expect(escrowQuery.params).toEqual([10]);
        });

        test('no bloquea publicaciones de venta (sell) aunque el autor tenga límite RED 0', async () => {
            const { controller, req, res } = buildControllerFixture({
                category: 'sell',
                blueCost: 50,
                creditCapacity: '0.0',
                blueAvailable: '0.0',
                alreadyLocked: '0'
            });
            await controller.createPublication(req, res);
            expect(res.statusCode).toBe(201);
        });

        test('falla cerrado con 503 si la auditoría on-chain V6 no responde (nunca cae a SQL)', async () => {
            const { controller, req, res, queries } = buildControllerFixture({
                category: 'request',
                blueCost: 10,
                auditSuccess: false
            });
            await controller.createPublication(req, res);
            expect(res.statusCode).toBe(503);
            expect(queries.some(q => q.sql.includes('INSERT INTO publications'))).toBe(false);
        });

        test('falla cerrado con 412 si el responsable no tiene billetera Web3 activada', async () => {
            const { controller, req, res, queries } = buildControllerFixture({
                category: 'request',
                blueCost: 10,
                walletAddress: null
            });
            await controller.createPublication(req, res);
            expect(res.statusCode).toBe(412);
            expect(queries.some(q => q.sql.includes('INSERT INTO publications'))).toBe(false);
        });

        test('precisión exacta al 6.º decimal con múltiples cupos y repeticiones (3x2x10 + 5% = 63.000000)', async () => {
            const failCase = buildControllerFixture({
                category: 'request',
                blueCost: 10,
                slots: 3,
                maxRepeat: 2,
                commissionPct: '5',
                creditCapacity: '62.999999',
                blueAvailable: '0.0',
                alreadyLocked: '0'
            });
            await failCase.controller.createPublication(failCase.req, failCase.res);
            expect(failCase.res.statusCode).toBe(402);

            jest.resetModules();
            const passCase = buildControllerFixture({
                category: 'request',
                blueCost: 10,
                slots: 3,
                maxRepeat: 2,
                commissionPct: '5',
                creditCapacity: '63.000000',
                blueAvailable: '0.0',
                alreadyLocked: '0'
            });
            await passCase.controller.createPublication(passCase.req, passCase.res);
            expect(passCase.res.statusCode).toBe(201);
            const holdInsert = passCase.queries.find(q => q.sql.includes('INSERT INTO web3_escrow_holds'));
            expect(holdInsert.params[3]).toBe('63.0');
        });

        test('cobertura mixta exacta (40 capacidad + 60 BLUE libre - 47.5 reservas = 52.5 disponible)', async () => {
            const passCase = buildControllerFixture({
                category: 'request',
                blueCost: 50,
                commissionPct: '5',
                creditCapacity: '40.0',
                blueAvailable: '60.0',
                alreadyLocked: '47.5'
            });
            await passCase.controller.createPublication(passCase.req, passCase.res);
            expect(passCase.res.statusCode).toBe(201);

            jest.resetModules();
            const failCase = buildControllerFixture({
                category: 'request',
                blueCost: 50.000001,
                commissionPct: '5',
                creditCapacity: '40.0',
                blueAvailable: '60.0',
                alreadyLocked: '47.5'
            });
            await failCase.controller.createPublication(failCase.req, failCase.res);
            expect(failCase.res.statusCode).toBe(402);
        });

        test('no bloquea campañas de donación (donation) aunque el autor tenga límite RED 0', async () => {
            const { controller, req, res } = buildControllerFixture({
                category: 'donation',
                blueCost: 500,
                creditCapacity: '0.0',
                blueAvailable: '0.0',
                alreadyLocked: '0'
            });
            await controller.createPublication(req, res);
            expect(res.statusCode).toBe(201);
        });
    });
});
