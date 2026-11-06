'use strict';

const service = require('../src/services/web3BridgeService');
const { summarizeEconomicPauseState, readEconomicPauseState } = service;

const contract = (value) => ({ paused: jest.fn(async () => value) });

describe('estado fail-closed de la suite económica V5', () => {
    test('solo declara contención completa con los cuatro contratos pausados', async () => {
        const result = await readEconomicPauseState({
            CoreProtocol: contract(true),
            CollateralVault: contract(true),
            FifoExchange: contract(true),
            ProtocolTreasury: contract(true)
        });
        expect(result.contractPauses).toEqual({
            CoreProtocol: true,
            CollateralVault: true,
            FifoExchange: true,
            ProtocolTreasury: true
        });
        expect(result.allEconomicContractsPaused).toBe(true);
    });

    test('un contrato activo impide declarar contención completa', () => {
        expect(summarizeEconomicPauseState({
            CoreProtocol: true,
            CollateralVault: true,
            FifoExchange: false,
            ProtocolTreasury: true
        })).toMatchObject({ allEconomicContractsPaused: false });
    });

    test('campo ausente o no booleano falla cerrado', () => {
        expect(() => summarizeEconomicPauseState({
            CoreProtocol: true,
            CollateralVault: true,
            FifoExchange: true
        })).toThrow('Estado de pausa no verificable para ProtocolTreasury');
        expect(() => summarizeEconomicPauseState({
            CoreProtocol: true,
            CollateralVault: true,
            FifoExchange: true,
            ProtocolTreasury: 'true'
        })).toThrow('Estado de pausa no verificable para ProtocolTreasury');
    });

    test('suite incompleta o error RPC falla cerrado', async () => {
        await expect(readEconomicPauseState({
            CoreProtocol: contract(true),
            CollateralVault: contract(true),
            FifoExchange: contract(true)
        })).rejects.toThrow('Suite económica Web3 incompleta: falta ProtocolTreasury');

        await expect(readEconomicPauseState({
            CoreProtocol: contract(true),
            CollateralVault: contract(true),
            FifoExchange: { paused: jest.fn(async () => { throw new Error('RPC unavailable'); }) },
            ProtocolTreasury: contract(true)
        })).rejects.toThrow('RPC unavailable');
    });
});
