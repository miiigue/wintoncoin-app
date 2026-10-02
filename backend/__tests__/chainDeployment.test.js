'use strict';

/**
 * backend/__tests__/chainDeployment.test.js
 * 
 * Suite de Pruebas Unitarias para la Selección Segura y Aislamiento de Red (chainDeployment.js)
 * CIBERSEGURIDAD BANCARIA & ZERO-TRUST:
 * 1. Aislamiento estricto de entornos: Desarrollo Local (31337) vs Optimism Sepolia Demo (11155420)
 * 2. Rechazo riguroso del escenario peligroso: RPC localhost simulado con chainId Demo (11155420)
 * 3. Verificación de enlace cruzado entre contratos de la suite indivisible V4
 * 4. Verificación de decimales bancarios (6 decimales en BLUE, RED y USDT)
 */

const { configuration, validate } = require('../src/services/chainDeployment');

describe('Aislamiento de Red y Selección de Manifiesto (chainDeployment.js)', () => {
    test('1. Entorno de Test / Desarrollo resuelve localmente (chainId 31337)', () => {
        const testEnv = {
            NODE_ENV: 'test',
            OPTIMISM_RPC_URL: 'http://127.0.0.1:8545'
        };

        const config = configuration(testEnv);
        expect(config.chainId).toBe('31337');
        expect(config.contracts).toBeDefined();
        expect(config.contracts.CoreProtocol).toBeDefined();
        expect(config.contracts.FifoExchange).toBeDefined();
    });

    test('2. Entorno Demo (11155420) carga el manifiesto indivisible V4 de Optimism Sepolia', () => {
        const demoEnv = {
            NODE_ENV: 'production',
            WINTON_CHAIN_ID: '11155420',
            OPTIMISM_RPC_URL: 'https://sepolia.optimism.io'
        };

        const config = configuration(demoEnv);
        expect(config.chainId).toBe('11155420');
        // Direcciones verificadas de la suite V4
        expect(config.contracts.BlueToken).toBe('0xb92CF4E5899C6D9622674729d24b34fa60094532');
        expect(config.contracts.RedToken).toBe('0x88C726c1745b7a04b1f597FF985954aA3F995b18');
        expect(config.contracts.FifoExchange).toBe('0xE1d61b500069E84E9ad2963A1c366F1E910A6246');
    });

    test('3. Rechazo de configuración con dirección de contrato no registrada en Demo', () => {
        const corruptedEnv = {
            NODE_ENV: 'production',
            WINTON_CHAIN_ID: '11155420',
            CORE_PROTOCOL_ADDRESS: '0x1111111111111111111111111111111111111111' // Dirección arbitraria no registrada
        };

        expect(() => configuration(corruptedEnv))
            .toThrow(/no pertenece a un despliegue registrado/);
    });

    test('4. Escenario Peligroso: validate() rechaza si el RPC conectado tiene un chainId distinto al configurado', async () => {
        const config = {
            chainId: '11155420', // Configurado para Demo
            contracts: {}
        };

        // Simula un RPC de Hardhat/localhost respondiendo con chainId 31337
        const mockRpc = {
            getNetwork: jest.fn(async () => ({ chainId: 31337n }))
        };

        await expect(validate(mockRpc, config))
            .rejects
            .toThrow('La red no corresponde al despliegue configurado.');
    });

    test('5. validate() verifica enlaces cruzados y 6 decimales en tokens', async () => {
        const { Interface, AbiCoder } = require('ethers');
        const coder = AbiCoder.defaultAbiCoder();
        const iface = new Interface([
            'function blueToken() view returns(address)',
            'function redToken() view returns(address)',
            'function vault() view returns(address)',
            'function treasury() view returns(address)',
            'function collateralToken() view returns(address)',
            'function coreProtocol() view returns(address)',
            'function exchange() view returns(address)',
            'function usdtToken() view returns(address)',
            'function decimals() view returns(uint8)'
        ]);

        const config = {
            chainId: '31337',
            contracts: {
                CoreProtocol: '0x1000000000000000000000000000000000000001',
                CollateralVault: '0x2000000000000000000000000000000000000002',
                FifoExchange: '0x3000000000000000000000000000000000000003',
                BlueToken: '0x4000000000000000000000000000000000000004',
                RedToken: '0x5000000000000000000000000000000000000005',
                USDT: '0x6000000000000000000000000000000000000006',
                ProtocolTreasury: '0x7000000000000000000000000000000000000007'
            }
        };

        const mockRpc = {
            getNetwork: jest.fn(async () => ({ chainId: 31337n })),
            getCode: jest.fn(async () => '0x608060405234801561001057600080fd5b50'),
            call: jest.fn(async ({ to, data }) => {
                const parsed = iface.parseTransaction({ data });
                if (parsed.name === 'decimals') return coder.encode(['uint8'], [6]);
                if (parsed.name === 'blueToken') return coder.encode(['address'], [config.contracts.BlueToken]);
                if (parsed.name === 'redToken') return coder.encode(['address'], [config.contracts.RedToken]);
                if (parsed.name === 'vault') return coder.encode(['address'], [config.contracts.CollateralVault]);
                if (parsed.name === 'treasury') return coder.encode(['address'], [config.contracts.ProtocolTreasury]);
                if (parsed.name === 'collateralToken') return coder.encode(['address'], [config.contracts.USDT]);
                if (parsed.name === 'coreProtocol') return coder.encode(['address'], [config.contracts.CoreProtocol]);
                if (parsed.name === 'exchange') return coder.encode(['address'], [config.contracts.FifoExchange]);
                if (parsed.name === 'usdtToken') return coder.encode(['address'], [config.contracts.USDT]);
                return '0x';
            })
        };

        const validated = await validate(mockRpc, config);
        expect(validated.chainId).toBe('31337');
    });
});
