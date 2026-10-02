'use strict';

/**
 * backend/__tests__/creditScoringRatchetHalving.test.js
 * 
 * Verificación Matemática y de Seguridad FinTech para el Trinquete (High-Water Mark)
 * y el Halving de Mora en el Motor de Scoring de Compromisos RED (SOC 2 / ISO 20022).
 * 
 * CASOS AUDITADOS CONFORME A CODEX-090, CODEX-091, CODEX-092 Y DIRECTIVAS DE MIGUEL:
 * 1. Base general reducida administrativamente (100 -> 80): el usuario que ya tenía 100 conserva su límite histórico por trinquete.
 * 2. Usuario con límite 100 cae en mora: 100 -> 50 -> 25 por halving sucesivo, aunque la política general no haya cambiado.
 * 3. Cambio general de base durante una mora: las reglas se combinan sin permitir que el trinquete anule el halving.
 * 4. Mérito ganado superior al histórico: el límite se actualiza al alza sin restricciones.
 * 5. Protección de límites no numéricos o negativos (Zero-Trust Fail-Closed).
 * 6. Prueba de Integración Fail-Closed ante Caída de RPC: Si el RPC falla al consultar isDelinquent o lotes,
 *    la operación aborta con CHAIN_READ_FAILED y NUNCA altera el límite on-chain ni llama a setCreditLimit.
 */

const creditScoringService = require('../src/services/creditScoringService');
const pool = require('../src/config/db');
const bridge = require('../src/services/web3BridgeService');
const { ethers } = require('ethers');

describe('Gobernanza de Compromisos RED: Trinquete Financiero y Halving por Mora', () => {

    test('1. Trinquete Financiero: reducción administrativa de base general (100 -> 80) preserva el límite adquirido de 100', () => {
        const result = creditScoringService.computeEffectiveCreditLimit({
            earnedScore: 80,          // Nueva base administrativa general reducida
            onChainLimit: 100,        // Límite histórico ganado previamente en blockchain
            isDelinquent: false,      // Usuario al día con sus compromisos
            delinquentCycles: 0
        });

        // El trinquete protege los derechos adquiridos
        expect(result).toBe(100);
    });

    test('2. Halving Inmediato por Mora: compromiso vencido reduce el límite de 100 a 50 (50% de recorte)', () => {
        const result = creditScoringService.computeEffectiveCreditLimit({
            earnedScore: 100,
            onChainLimit: 100,
            isDelinquent: true,       // Compromiso RED vencido impago
            delinquentCycles: 1       // Primer ciclo de mora (inmediato al vencimiento)
        });

        // Halving del 50%: 100 / 2 = 50
        expect(result).toBe(50);
    });

    test('3. Halvings Mensuales Sucesivos por Mora Continua: tras 30 días adicionales de mora el límite pasa de 50 a 25', () => {
        const result = creditScoringService.computeEffectiveCreditLimit({
            earnedScore: 100,
            onChainLimit: 100,
            isDelinquent: true,       // Mora continuada
            delinquentCycles: 2       // Segundo ciclo de mora (60 días totales de incumplimiento)
        });

        // Halving sucesivo: 100 / 4 = 25
        expect(result).toBe(25);
    });

    test('4. Combinación de Reglas: recorte administrativo de base durante una mora no anula el halving', () => {
        const result = creditScoringService.computeEffectiveCreditLimit({
            earnedScore: 80,          // Política general bajó a 80
            onChainLimit: 100,        // Límite histórico original
            isDelinquent: true,       // En mora activa
            delinquentCycles: 1       // Ciclo 1
        });

        // La base protegida (100) sufre el halving del 50% = 50, el trinquete no anula la penalización
        expect(result).toBe(50);
    });

    test('5. Mérito Genuino al Alza: aumento por referidos verificados KYC y actividad eleva el límite (100 -> 120)', () => {
        const result = creditScoringService.computeEffectiveCreditLimit({
            earnedScore: 120,         // Mayor actividad y referidos verificados
            onChainLimit: 100,        // Límite anterior
            isDelinquent: false
        });

        // Crece orgánicamente por mérito
        expect(result).toBe(120);
    });

    test('6. Inmunidad ante valores inválidos o nulos (Fail-Closed)', () => {
        const result = creditScoringService.computeEffectiveCreditLimit({
            earnedScore: null,
            onChainLimit: undefined,
            isDelinquent: false
        });

        expect(result).toBe(0);
    });
});

describe('Integración On-Chain: Fail-Closed ante fallos de RPC y red (CODEX-091 / CODEX-092)', () => {
    let originalQuery;
    let originalGetProtocol;
    let originalSetCreditLimit;

    beforeEach(() => {
        originalQuery = pool.query;
        originalGetProtocol = bridge._getProtocol;
        originalSetCreditLimit = bridge.setCreditLimit;
    });

    afterEach(() => {
        pool.query = originalQuery;
        bridge._getProtocol = originalGetProtocol;
        bridge.setCreditLimit = originalSetCreditLimit;
    });

    test('7. Fail-Closed Estricto: Si RPC falla en isDelinquent(), rechaza con CHAIN_READ_FAILED y NUNCA llama a setCreditLimit', async () => {
        const mockWallet = '0x1111111111111111111111111111111111111111';
        let setCreditLimitCalled = false;

        // Mock base de datos para usuario 999
        pool.query = jest.fn(async (sql) => {
            if (sql.includes('web3_wallet_address') && sql.includes('FROM users')) {
                return { rows: [{ web3_wallet_address: mockWallet }] };
            }
            if (sql.includes('SELECT id FROM chain_operations')) {
                return { rowCount: 0, rows: [] };
            }
            if (sql.includes('SELECT red_credit_limit_override FROM users')) {
                return { rows: [{ red_credit_limit_override: null }] };
            }
            return { rows: [] };
        });

        // Mock calculateUserScore para devolver 100 RED
        jest.spyOn(creditScoringService, 'calculateUserScore').mockResolvedValue(100);

        // Mock contrato con fallo de RPC en isDelinquent
        bridge._getProtocol = jest.fn(() => ({
            creditLimits: jest.fn().mockResolvedValue(ethers.parseUnits('100', 6)),
            isDelinquent: jest.fn().mockRejectedValue(new Error('RPC_TIMEOUT: Connection lost to Optimism Sepolia'))
        }));

        bridge.setCreditLimit = jest.fn(async () => {
            setCreditLimitCalled = true;
            return { success: true };
        });

        // Debe fallar cerrado lanzando CHAIN_READ_FAILED
        await expect(creditScoringService.syncCreditLimitOnChain(999))
            .rejects
            .toThrow(/CHAIN_READ_FAILED: No se pudo verificar el estado on-chain del protocolo/);

        // Garantía absoluta de que el contrato inteligente no fue mutado
        expect(setCreditLimitCalled).toBe(false);
        expect(bridge.setCreditLimit).not.toHaveBeenCalled();
    });

    test('8. Fail-Closed en Lotes: Si usuario está en mora pero falla la lectura de lotes on-chain, aborta sin mutar límites', async () => {
        const mockWallet = '0x2222222222222222222222222222222222222222';

        pool.query = jest.fn(async (sql) => {
            if (sql.includes('web3_wallet_address') && sql.includes('FROM users')) {
                return { rows: [{ web3_wallet_address: mockWallet }] };
            }
            if (sql.includes('SELECT id FROM chain_operations')) {
                return { rowCount: 0, rows: [] };
            }
            if (sql.includes('SELECT red_credit_limit_override FROM users')) {
                return { rows: [{ red_credit_limit_override: null }] };
            }
            return { rows: [] };
        });

        jest.spyOn(creditScoringService, 'calculateUserScore').mockResolvedValue(100);

        bridge._getProtocol = jest.fn(() => ({
            creditLimits: jest.fn().mockResolvedValue(ethers.parseUnits('100', 6)),
            isDelinquent: jest.fn().mockResolvedValue(true),
            userActiveLotHead: jest.fn().mockRejectedValue(new Error('EXECUTION_REVERTED_ON_RPC')),
            getUserDebtLotsCount: jest.fn().mockResolvedValue(1)
        }));

        bridge.setCreditLimit = jest.fn();

        await expect(creditScoringService.syncCreditLimitOnChain(888))
            .rejects
            .toThrow(/CHAIN_READ_FAILED: Error al consultar lotes vencidos on-chain/);

        expect(bridge.setCreditLimit).not.toHaveBeenCalled();
    });

    test('9. Sincronización Exitosa de Halving: En mora confirmada con 1 ciclo, llama a setCreditLimit con límite al 50%', async () => {
        const mockWallet = '0x3333333333333333333333333333333333333333';

        pool.query = jest.fn(async (sql) => {
            if (sql.includes('web3_wallet_address') && sql.includes('FROM users')) {
                return { rows: [{ web3_wallet_address: mockWallet }] };
            }
            if (sql.includes('SELECT id FROM chain_operations')) {
                return { rowCount: 0, rows: [] };
            }
            if (sql.includes('SELECT red_credit_limit_override FROM users')) {
                return { rows: [{ red_credit_limit_override: null }] };
            }
            return { rows: [] };
        });

        jest.spyOn(creditScoringService, 'calculateUserScore').mockResolvedValue(100);

        const nowSec = Math.floor(Date.now() / 1000);
        bridge._getProtocol = jest.fn(() => ({
            creditLimits: jest.fn().mockResolvedValue(ethers.parseUnits('100', 6)),
            isDelinquent: jest.fn().mockResolvedValue(true),
            userActiveLotHead: jest.fn().mockResolvedValue(0),
            getUserDebtLotsCount: jest.fn().mockResolvedValue(1),
            userDebtLots: jest.fn().mockResolvedValue({
                id: 1,
                amount: ethers.parseUnits('50', 6),
                remainingAmount: ethers.parseUnits('50', 6),
                dueAt: BigInt(nowSec - 86400), // 1 día vencido
                repaid: false
            })
        }));

        bridge.setCreditLimit = jest.fn().mockResolvedValue({ success: true, operationId: 'test-halving-op' });

        const result = await creditScoringService.syncCreditLimitOnChain(777);

        // Se sincroniza on-chain con 50 RED (halving del 50% de 100)
        expect(bridge.setCreditLimit).toHaveBeenCalledWith(mockWallet, 50, { manual: false, alreadyLocked: true });
        expect(result.operationId).toBe('test-halving-op');
    });

    test('10. Trinquete en Sincronización: Si usuario está al día y base general baja (100 -> 80), omite setCreditLimit', async () => {
        const mockWallet = '0x4444444444444444444444444444444444444444';

        pool.query = jest.fn(async (sql) => {
            if (sql.includes('web3_wallet_address') && sql.includes('FROM users')) {
                return { rows: [{ web3_wallet_address: mockWallet }] };
            }
            if (sql.includes('SELECT id FROM chain_operations')) {
                return { rowCount: 0, rows: [] };
            }
            if (sql.includes('SELECT red_credit_limit_override FROM users')) {
                return { rows: [{ red_credit_limit_override: null }] };
            }
            return { rows: [] };
        });

        // Score nuevo calculado por política general baja: 80 RED
        jest.spyOn(creditScoringService, 'calculateUserScore').mockResolvedValue(80);

        // En blockchain ya tiene 100 RED ganados y NO está en mora
        bridge._getProtocol = jest.fn(() => ({
            creditLimits: jest.fn().mockResolvedValue(ethers.parseUnits('100', 6)),
            isDelinquent: jest.fn().mockResolvedValue(false)
        }));

        bridge.setCreditLimit = jest.fn();

        const result = await creditScoringService.syncCreditLimitOnChain(666);

        // Se omite la llamada Web3 preservando el límite histórico adquirido (trinquete)
        expect(result).toEqual({ skipped: true, reason: 'already_current' });
        expect(bridge.setCreditLimit).not.toHaveBeenCalled();
    });

    describe('Recuperación Gradual Post-Mora (10% Mensual - Punto A / Whitepaper Canónico)', () => {
        test('11. Curación Inmediata (Mes 0): Al saldar la mora, el límite NO salta de golpe a 100; se mantiene en 50 RED', () => {
            const limit = creditScoringService.computeEffectiveCreditLimit({
                earnedScore: 100,
                onChainLimit: 50,
                isDelinquent: false,
                cureMonths: 0,
                penaltyLimit: 50,
                targetLimit: 100,
                monthlyRecoveryRate: 0.10
            });
            expect(limit).toBe(50);
        });

        test('12. Recuperación al Mes 1 (+30 días al día): Recupera 10% del límite objetivo (50 + 10 = 60 RED)', () => {
            const limit = creditScoringService.computeEffectiveCreditLimit({
                earnedScore: 100,
                onChainLimit: 50,
                isDelinquent: false,
                cureMonths: 1,
                penaltyLimit: 50,
                targetLimit: 100,
                monthlyRecoveryRate: 0.10
            });
            expect(limit).toBe(60);
        });

        test('13. Recuperación al Mes 2 (+60 días al día): Recupera 20% del límite objetivo (50 + 20 = 70 RED)', () => {
            const limit = creditScoringService.computeEffectiveCreditLimit({
                earnedScore: 100,
                onChainLimit: 60,
                isDelinquent: false,
                cureMonths: 2,
                penaltyLimit: 50,
                targetLimit: 100,
                monthlyRecoveryRate: 0.10
            });
            expect(limit).toBe(70);
        });

        test('14. Culminación de la Curación (Mes 5 = +150 días): Alcanza el 100% (100 RED) y queda topado en targetLimit', () => {
            const limit = creditScoringService.computeEffectiveCreditLimit({
                earnedScore: 100,
                onChainLimit: 90,
                isDelinquent: false,
                cureMonths: 5,
                penaltyLimit: 50,
                targetLimit: 100,
                monthlyRecoveryRate: 0.10
            });
            expect(limit).toBe(100);

            // Si transcurren 8 meses, jamás debe exceder el targetLimit ni el mérito
            const limitOvercured = creditScoringService.computeEffectiveCreditLimit({
                earnedScore: 100,
                onChainLimit: 100,
                isDelinquent: false,
                cureMonths: 8,
                penaltyLimit: 50,
                targetLimit: 100,
                monthlyRecoveryRate: 0.10
            });
            expect(limitOvercured).toBe(100);
        });

        test('15. Recaída en Mora durante la Curación: En Mes 2 (70 RED), nueva mora ejecuta halving desde 70 -> 35 RED', () => {
            // El usuario estaba recuperándose en 70 RED pero vuelve a vencer un compromiso impago (mora ciclo 1)
            const limit = creditScoringService.computeEffectiveCreditLimit({
                earnedScore: 100,
                onChainLimit: 70,
                isDelinquent: true,
                delinquentCycles: 1,
                cureMonths: 2,
                penaltyLimit: 50,
                targetLimit: 100,
                monthlyRecoveryRate: 0.10
            });
            // 70 / 2 = 35 RED (el halving por mora domina sobre cualquier curación previa)
            expect(limit).toBe(35);
        });
    });
});

