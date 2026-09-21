/**
 * src/services/web3BridgeService.js
 * Puente profesional para la sincronización entre DB y Blockchain (Optimism Sepolia / Local).
 * 
 * ARQUITECTURA SUITE V4 (Zero-Trust & 6 Decimales):
 * Este servicio actúa como el Relayer institucional del ecosistema. Firma y paga las transacciones
 * que los usuarios y la gobernanza ejecutan en la blockchain con patrocinio de gas.
 * 
 * INTEGRACIÓN V4:
 * - Soporte nativo para CoreProtocol, CollateralVault, FifoExchange, ProtocolTreasury, BlueToken y RedToken.
 * - Carga dinámica de direcciones desde deployment-manifest-v4.json o variables de entorno.
 * - Conversión uniforme a 6 decimales para paridad nativa con USDT.
 * - Auditoría bancaria SOC 2 con retornos de txHash para trazabilidad inmutable.
 */

const { ethers, NonceManager } = require('ethers');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

// Carga automática del manifiesto de despliegue si existe
let manifest = null;
try {
    const manifestPath = path.resolve(__dirname, '../../../web3-contracts/deployment-manifest-v4.json');
    if (fs.existsSync(manifestPath)) {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }
} catch (e) {
    // Si no se encuentra el manifiesto, se depende de las variables de entorno
}

// Variables de entorno con fallback al manifiesto V4
const RPC_URL = process.env.OPTIMISM_RPC_URL || 'http://127.0.0.1:8545';
const RELAYER_PK = process.env.RELAYER_PRIVATE_KEY;

const PROTOCOL_ADDRESS = process.env.CORE_PROTOCOL_ADDRESS || process.env.WINTON_PROTOCOL_ADDRESS || manifest?.contracts?.CoreProtocol;
const TREASURY_ADDRESS = process.env.PROTOCOL_TREASURY_ADDRESS || process.env.WINTON_TREASURY_ADDRESS || manifest?.contracts?.ProtocolTreasury;
const VAULT_ADDRESS = process.env.COLLATERAL_VAULT_ADDRESS || manifest?.contracts?.CollateralVault;
const EXCHANGE_ADDRESS = process.env.FIFO_EXCHANGE_ADDRESS || manifest?.contracts?.FifoExchange;
const BLUE_ADDRESS = process.env.BLUE_TOKEN_ADDRESS || manifest?.contracts?.BlueToken;
const RED_ADDRESS = process.env.RED_TOKEN_ADDRESS || manifest?.contracts?.RedToken;
const USDT_ADDRESS = process.env.USDT_TOKEN_ADDRESS || manifest?.contracts?.USDT;

class Web3BridgeService {
    constructor() {
        if (!RELAYER_PK || !PROTOCOL_ADDRESS) {
            console.warn('[WEB3 BRIDGE] ⚠️ RELAYER_PRIVATE_KEY o CORE_PROTOCOL_ADDRESS no configurados completamente. Operaciones on-chain operarán en modo simulado si no hay red.');
        }

        this.provider = new ethers.JsonRpcProvider(RPC_URL);
        this.wallet = RELAYER_PK ? new NonceManager(new ethers.Wallet(RELAYER_PK, this.provider)) : null;

        // ABIs de la Suite V4
        this.protocolAbi = [
            "function processPayment(address payer, address payee, uint256 grossAmount) external",
            "function amortizeWithBlue(uint256 amount) external",
            "function setCreditLimit(address user, uint256 limit) external",
            "function setKYCStatus(address wallet, bool status) external",
            "function setMaxTransactionAmount(uint256 newAmount) external",
            "function setCommissionRate(uint256 newRate) external",
            "function pause() external",
            "function unpause() external",
            "function paused() external view returns (bool)",
            "function maxTransactionAmount() external view returns (uint256)",
            "function commissionRate() external view returns (uint256)",
            "function isKYCVerified(address) external view returns (bool)",
            "function creditLimits(address) external view returns (uint256)",
            "function getAvailableCreditCapacity(address) external view returns (uint256)",
            "function getRequiredCollateral(address) external view returns (uint256)",
            "function isDelinquent(address) external view returns (bool)",
            "function blueToken() external view returns (address)",
            "function redToken() external view returns (address)",
            "function collateralVault() external view returns (address)",
            "function treasury() external view returns (address)",
            "function getUserDebtLots(address user) external view returns (tuple(uint256 id, uint256 originalAmount, uint256 remainingAmount, uint256 createdAt, uint256 dueAt, bool repaid)[])",
            "event PaymentProcessed(address indexed payer, address indexed payee, uint256 netAmount, uint256 fee, uint256 lotId, uint256 dueAt)",
            "event DebtAmortized(address indexed user, uint256 amount, uint256 remainingDebt)"
        ];

        this.vaultAbi = [
            "function deposit(uint256 amount) external",
            "function withdraw(uint256 amount) external",
            "function repayWithCollateral(address user, uint256 amount) external",
            "function liquidateDelinquent(address user, uint256 amount) external",
            "function userCollateral(address) external view returns (uint256)",
            "function totalCollateralLocked() external view returns (uint256)",
            "function getFreeCollateral(address) external view returns (uint256)",
            "function paused() external view returns (bool)",
            "function pause() external",
            "function unpause() external",
            "event CollateralDeposited(address indexed user, uint256 amount, uint256 totalUserBalance, uint256 totalVaultLocked)",
            "event CollateralWithdrawn(address indexed user, uint256 amount, uint256 totalUserBalance, uint256 totalVaultLocked)",
            "event RepaidWithCollateral(address indexed user, uint256 amount, uint256 remainingCollateral)",
            "event DelinquentLiquidated(address indexed user, uint256 amount, uint256 remainingCollateral)"
        ];

        this.exchangeAbi = [
            "function createBlueOrder(uint128 amount) external returns (uint64)",
            "function createUsdtOrder(uint128 amount) external returns (uint64)",
            "function matchOrders(uint256 maxMatches, uint256 maxOrdersScanned) external",
            "function cancelOrder(uint64 orderId) external",
            "function totalReservedBlue() external view returns (uint128)",
            "function totalReservedUsdt() external view returns (uint128)",
            "function totalDepositedBlue() external view returns (uint128)",
            "function totalDepositedUsdt() external view returns (uint128)",
            "function blueHeadIndex() external view returns (uint64)",
            "function usdtHeadIndex() external view returns (uint64)",
            "function paused() external view returns (bool)",
            "function getBlueOrderIdsLength() external view returns (uint256)",
            "function getUsdtOrderIdsLength() external view returns (uint256)",
            "function orders(uint64) external view returns (uint64 id, uint64 sequenceId, uint128 remainingAmount, address user, uint8 status, uint8 side, uint48 createdAt, uint128 originalAmount, uint128 refundedAmount)"
        ];

        this.treasuryAbi = [
            "function pause() external",
            "function unpause() external",
            "function claimSurplus(address to, uint256 amount) external",
            "function paused() external view returns (bool)",
            "function blueToken() external view returns (address)"
        ];

        this.erc20Abi = [
            "function balanceOf(address) external view returns (uint256)",
            "function decimals() external view returns (uint8)",
            "function symbol() external view returns (string)",
            "function name() external view returns (string)",
            "function allowance(address owner, address spender) external view returns (uint256)",
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function transfer(address to, uint256 amount) external returns (bool)",
            "function mint(address to, uint256 amount) external"
        ];
    }

    _isReady() {
        return Boolean(this.wallet && PROTOCOL_ADDRESS);
    }

    _getProtocol() {
        if (!PROTOCOL_ADDRESS) throw new Error("CORE_PROTOCOL_ADDRESS no configurado");
        return new ethers.Contract(PROTOCOL_ADDRESS, this.protocolAbi, this.wallet || this.provider);
    }

    _getVault() {
        if (!VAULT_ADDRESS) throw new Error("COLLATERAL_VAULT_ADDRESS no configurado");
        return new ethers.Contract(VAULT_ADDRESS, this.vaultAbi, this.wallet || this.provider);
    }

    _getExchange() {
        if (!EXCHANGE_ADDRESS) throw new Error("FIFO_EXCHANGE_ADDRESS no configurado");
        return new ethers.Contract(EXCHANGE_ADDRESS, this.exchangeAbi, this.wallet || this.provider);
    }

    _getERC20(address) {
        if (!address) throw new Error("Dirección de token requerida");
        return new ethers.Contract(address, this.erc20Abi, this.wallet || this.provider);
    }

    async _waitForConfirmation(tx, operationName) {
        console.log(`[WEB3 BRIDGE] Tx enviada (${operationName}): ${tx.hash}. Esperando confirmación...`);
        const receipt = await tx.wait(1);
        if (receipt.status === 1) {
            console.log(`[WEB3 BRIDGE] ✅ ${operationName} EXITOSO. Tx: ${tx.hash}`);
            return tx.hash;
        } else {
            throw new Error(`Transacción revertida en la blockchain para ${operationName}`);
        }
    }

    // ========================================================================
    // INFORMACIÓN Y ESTADO DEL PROTOCOLO (ADMIN & DASHBOARD)
    // ========================================================================

    async getProtocolStatus() {
        try {
            const net = await this.provider.getNetwork();
            let relayerBalance = "0.0";
            let relayerAddress = null;

            if (this.wallet) {
                relayerAddress = await this.wallet.getAddress();
                const bal = await this.provider.getBalance(relayerAddress);
                relayerBalance = ethers.formatEther(bal);
            }

            let paused = false;
            let maxTx = "5000";
            let commissionRate = "500";
            let totalVaultLocked = "0.0";

            if (PROTOCOL_ADDRESS) {
                const protocol = this._getProtocol();
                const [p, m, c] = await Promise.all([
                    protocol.paused().catch(() => false),
                    protocol.maxTransactionAmount().catch(() => 5000000000n),
                    protocol.commissionRate().catch(() => 500n)
                ]);
                paused = p;
                maxTx = ethers.formatUnits(m, 6);
                commissionRate = c.toString();
            }

            if (VAULT_ADDRESS) {
                const vault = this._getVault();
                const locked = await vault.totalCollateralLocked().catch(() => 0n);
                totalVaultLocked = ethers.formatUnits(locked, 6);
            }

            return {
                success: true,
                network: net.name || "optimismSepolia",
                chainId: net.chainId.toString(),
                relayer: {
                    address: relayerAddress,
                    balanceEth: relayerBalance,
                    isConfigured: Boolean(this.wallet)
                },
                contracts: {
                    CoreProtocol: PROTOCOL_ADDRESS || "No configurado",
                    CollateralVault: VAULT_ADDRESS || "No configurado",
                    FifoExchange: EXCHANGE_ADDRESS || "No configurado",
                    ProtocolTreasury: TREASURY_ADDRESS || "No configurado",
                    BlueToken: BLUE_ADDRESS || "No configurado",
                    RedToken: RED_ADDRESS || "No configurado",
                    USDT: USDT_ADDRESS || "No configurado"
                },
                parameters: {
                    paused,
                    maxTransactionAmount: maxTx,
                    commissionRateBps: commissionRate,
                    totalCollateralLocked: totalVaultLocked
                }
            };
        } catch (error) {
            console.error('[WEB3 BRIDGE] Error en getProtocolStatus:', error.message);
            return {
                success: false,
                error: error.message,
                network: "desconectado"
            };
        }
    }

    async isProtocolPaused() {
        if (!PROTOCOL_ADDRESS) return false;
        try {
            const protocol = this._getProtocol();
            return await protocol.paused();
        } catch (e) {
            return false;
        }
    }

    // ========================================================================
    // GOBERNANZA & PARÁMETROS ON-CHAIN (ADMIN)
    // ========================================================================

    async setCreditLimit(walletAddress, limitUnits) {
        if (!this._isReady()) return { success: false, error: 'Relayer no configurado' };
        try {
            const protocol = this._getProtocol();
            const limitUnitsParsed = ethers.parseUnits(limitUnits.toString(), 6);
            const tx = await protocol.setCreditLimit(walletAddress, limitUnitsParsed);
            const txHash = await this._waitForConfirmation(tx, 'setCreditLimit');
            return { success: true, txHash };
        } catch (error) {
            console.error('[WEB3 BRIDGE] Error en setCreditLimit:', error.message);
            return { success: false, error: error.message };
        }
    }

    async setKYCStatus(walletAddress, status) {
        if (!this._isReady()) return { success: false, error: 'Relayer no configurado' };
        try {
            const protocol = this._getProtocol();
            const tx = await protocol.setKYCStatus(walletAddress, Boolean(status));
            const txHash = await this._waitForConfirmation(tx, 'setKYCStatus');
            return { success: true, txHash };
        } catch (error) {
            console.error('[WEB3 BRIDGE] Error en setKYCStatus:', error.message);
            return { success: false, error: error.message };
        }
    }

    async setMaxTransactionAmount(amountUnits) {
        if (!this._isReady()) return { success: false, error: 'Relayer no configurado' };
        try {
            const protocol = this._getProtocol();
            const tx = await protocol.setMaxTransactionAmount(ethers.parseUnits(amountUnits.toString(), 6));
            const txHash = await this._waitForConfirmation(tx, 'setMaxTransactionAmount');
            return { success: true, txHash };
        } catch (error) {
            console.error('[WEB3 BRIDGE] Error en setMaxTransactionAmount:', error.message);
            return { success: false, error: error.message };
        }
    }

    async setCommissionRate(rateBps) {
        if (!this._isReady()) return { success: false, error: 'Relayer no configurado' };
        try {
            const protocol = this._getProtocol();
            const tx = await protocol.setCommissionRate(parseInt(rateBps, 10));
            const txHash = await this._waitForConfirmation(tx, 'setCommissionRate');
            return { success: true, txHash };
        } catch (error) {
            console.error('[WEB3 BRIDGE] Error en setCommissionRate:', error.message);
            return { success: false, error: error.message };
        }
    }

    async pauseProtocol() {
        if (!this._isReady()) return { success: false, error: 'Relayer no configurado' };
        try {
            const protocol = this._getProtocol();
            const tx = await protocol.pause();
            const txHash = await this._waitForConfirmation(tx, 'pauseProtocol');
            return { success: true, txHash };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async unpauseProtocol() {
        if (!this._isReady()) return { success: false, error: 'Relayer no configurado' };
        try {
            const protocol = this._getProtocol();
            const tx = await protocol.unpause();
            const txHash = await this._waitForConfirmation(tx, 'unpauseProtocol');
            return { success: true, txHash };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async pauseVault() {
        if (!this._isReady() || !VAULT_ADDRESS) return { success: false, error: 'Vault no configurado' };
        try {
            const vault = this._getVault();
            const tx = await vault.pause();
            const txHash = await this._waitForConfirmation(tx, 'pauseVault');
            return { success: true, txHash };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async unpauseVault() {
        if (!this._isReady() || !VAULT_ADDRESS) return { success: false, error: 'Vault no configurado' };
        try {
            const vault = this._getVault();
            const tx = await vault.unpause();
            const txHash = await this._waitForConfirmation(tx, 'unpauseVault');
            return { success: true, txHash };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // OPERACIONES DE USUARIO Y AUDITORÍA 360°
    // ========================================================================

    async getUserAuditDetailed(walletAddress) {
        if (!walletAddress) return { success: false, error: 'Dirección requerida' };
        try {
            const blueContract = this._getERC20(BLUE_ADDRESS);
            const redContract = this._getERC20(RED_ADDRESS);
            const protocol = this._getProtocol();
            const vault = this._getVault();

            const [
                blueBalRaw,
                redBalRaw,
                vaultBalRaw,
                freeVaultRaw,
                capRaw,
                reqCollateralRaw,
                isDelinquent,
                isKyc,
                limitRaw,
                debtLotsRaw
            ] = await Promise.all([
                blueContract.balanceOf(walletAddress).catch(() => 0n),
                redContract.balanceOf(walletAddress).catch(() => 0n),
                vault.userCollateral(walletAddress).catch(() => 0n),
                vault.getFreeCollateral(walletAddress).catch(() => 0n),
                protocol.getAvailableCreditCapacity(walletAddress).catch(() => 0n),
                protocol.getRequiredCollateral(walletAddress).catch(() => 0n),
                protocol.isDelinquent(walletAddress).catch(() => false),
                protocol.isKYCVerified(walletAddress).catch(() => false),
                protocol.creditLimits(walletAddress).catch(() => 0n),
                protocol.getUserDebtLots(walletAddress).catch(() => [])
            ]);

            const formattedLots = debtLotsRaw.map(lot => ({
                id: lot.id.toString(),
                originalAmount: ethers.formatUnits(lot.originalAmount, 6),
                remainingAmount: ethers.formatUnits(lot.remainingAmount, 6),
                createdAt: new Date(Number(lot.createdAt) * 1000).toISOString(),
                dueAt: new Date(Number(lot.dueAt) * 1000).toISOString(),
                repaid: lot.repaid,
                isOverdue: (!lot.repaid && Date.now() >= Number(lot.dueAt) * 1000)
            }));

            return {
                success: true,
                wallet: walletAddress,
                blueBalance: ethers.formatUnits(blueBalRaw, 6),
                redCommitment: ethers.formatUnits(redBalRaw, 6),
                collateralVault: {
                    totalLocked: ethers.formatUnits(vaultBalRaw, 6),
                    freeForWithdrawal: ethers.formatUnits(freeVaultRaw, 6)
                },
                credit: {
                    baseLimit: ethers.formatUnits(limitRaw, 6),
                    availableCapacity: ethers.formatUnits(capRaw, 6),
                    requiredCollateral: ethers.formatUnits(reqCollateralRaw, 6),
                    isDelinquent,
                    isKYCVerified: isKyc
                },
                debtLots: formattedLots
            };
        } catch (error) {
            console.error('[WEB3 BRIDGE] Error en getUserAuditDetailed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async checkUserKYC(walletAddress) {
        if (!PROTOCOL_ADDRESS || !walletAddress) return false;
        try {
            const protocol = this._getProtocol();
            return await protocol.isKYCVerified(walletAddress);
        } catch (e) {
            return false;
        }
    }

    async checkUserKYCDetailed(walletAddress) {
        const isVerified = await this.checkUserKYC(walletAddress);
        return { isVerified, walletAddress };
    }

    // ========================================================================
    // PAGOS & SIMULACIONES (MARKETPLACE & TESTS)
    // ========================================================================

    async syncPaymentToBlockchain({ payerWalletAddress, payeeWalletAddress, amountBlue, dbTransactionId, payerUsername, payeeUsername }) {
        if (!this._isReady()) return null;

        try {
            console.log(`[WEB3 BRIDGE] Sincronizando pago V4: ${payerUsername} → ${payeeUsername} (${amountBlue} BLUE)`);
            const protocol = this._getProtocol();
            const grossUnits = ethers.parseUnits(amountBlue.toString(), 6);

            const tx = await protocol.processPayment(payerWalletAddress, payeeWalletAddress, grossUnits);
            const txHash = await this._waitForConfirmation(tx, 'syncPayment');

            if (dbTransactionId && txHash) {
                await pool.query(
                    `UPDATE transactions SET tx_hash = $1 WHERE id = $2`,
                    [txHash, dbTransactionId]
                ).catch(err => console.error('[WEB3 BRIDGE] Error guardando tx_hash:', err.message));
            }

            return txHash;
        } catch (error) {
            console.error('[WEB3 BRIDGE] ❌ Error al sincronizar pago:', error.message);
            return null;
        }
    }

    async executeMatching(maxMatches = 10, maxOrdersScanned = 20) {
        if (!this._isReady() || !EXCHANGE_ADDRESS) return { success: false, error: 'Exchange no configurado' };
        try {
            const exchange = this._getExchange();
            const tx = await exchange.matchOrders(maxMatches, maxOrdersScanned);
            const txHash = await this._waitForConfirmation(tx, 'matchOrders');
            return { success: true, txHash };
        } catch (error) {
            console.error('[WEB3 BRIDGE] Error en matchOrders:', error.message);
            return { success: false, error: error.message };
        }
    }

    async mintMockUsdt(walletAddress, amountUnits) {
        if (!this._isReady() || !USDT_ADDRESS) return { success: false, error: 'Token USDT no configurado' };
        try {
            const usdt = this._getERC20(USDT_ADDRESS);
            const tx = await usdt.mint(walletAddress, ethers.parseUnits(amountUnits.toString(), 6));
            const txHash = await this._waitForConfirmation(tx, 'mintMockUsdt');
            return { success: true, txHash };
        } catch (error) {
            console.error('[WEB3 BRIDGE] Error en mintMockUsdt:', error.message);
            return { success: false, error: error.message };
        }
    }

    async resyncUserWallet(walletAddress, userId) {
        if (!PROTOCOL_ADDRESS || !walletAddress) return null;
        try {
            const blueContract = this._getERC20(BLUE_ADDRESS);
            const redContract = this._getERC20(RED_ADDRESS);

            const [blueRaw, redRaw] = await Promise.all([
                blueContract.balanceOf(walletAddress),
                redContract.balanceOf(walletAddress)
            ]);

            const blueBalance = ethers.formatUnits(blueRaw, 6);
            const redDebt = ethers.formatUnits(redRaw, 6);

            await pool.query(`
                INSERT INTO web3_wallets_sync (user_id, onchain_blue_balance, onchain_red_debt, last_synced_at, sync_status)
                VALUES ($1, $2, $3, NOW(), 'synced')
                ON CONFLICT (user_id) DO UPDATE SET
                    onchain_blue_balance = $2,
                    onchain_red_debt = $3,
                    last_synced_at = NOW(),
                    sync_status = 'synced'
            `, [userId, parseFloat(blueBalance), parseFloat(redDebt)]);

            return { blueBalance, redDebt };
        } catch (error) {
            console.error(`[WEB3 RESYNC] Error user #${userId}:`, error.message);
            return null;
        }
    }
}

module.exports = new Web3BridgeService();
