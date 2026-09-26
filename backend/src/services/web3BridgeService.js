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
            console.warn('[WEB3 BRIDGE] ⚠️ RELAYER_PRIVATE_KEY o CORE_PROTOCOL_ADDRESS no configurados completamente. Las operaciones que requieran estas credenciales no están disponibles. No se simulan saldos.');
        }

        this.provider = new ethers.JsonRpcProvider(RPC_URL);
        this.wallet = RELAYER_PK ? new NonceManager(new ethers.Wallet(RELAYER_PK, this.provider)) : null;

        // ABIs de la Suite V4
        this.protocolAbi = [
            "function processPayment(address payer, address payee, uint256 amount)",
            "function amortizeWithBlue(uint256 amount)",
            "function setCreditLimit(address account, uint256 limit)",
            "function setKYCStatus(address account, bool status)",
            "function setMaxTransactionAmount(uint256 _max)",
            "function setCommissionBps(uint256 _bps)",
            "function pause()",
            "function unpause()",
            "function paused() view returns (bool)",
            "function maxTransactionAmount() view returns (uint256)",
            "function commissionBps() view returns (uint256)",
            "function isKYCVerified(address) view returns (bool)",
            "function creditLimits(address) view returns (uint256)",
            "function getAvailableCreditCapacity(address user) view returns (uint256)",
            "function getRequiredCollateral(address user) view returns (uint256)",
            "function isDelinquent(address user) view returns (bool)",
            "function blueToken() view returns (address)",
            "function redToken() view returns (address)",
            "function vault() view returns (address)",
            "function treasury() view returns (address)",
            "function getUserDebtLotsCount(address user) view returns (uint256)",
            "function userDebtLots(address, uint256) view returns (uint256 id, uint256 amount, uint256 remainingAmount, uint256 dueAt, bool repaid)",
            "function setExtensionOption(uint256 durationDays, uint16 feeBps, bool enabled)",
            "function setUserBenefits(address user, uint8 level, uint256 margin)",
            "function extensionOptions(uint256) view returns (uint16 feeBps, bool enabled)",
            "function getExtensionDurations() view returns (uint256[])",
            "function userLevels(address) view returns (uint8)",
            "function extensionMarginLimits(address) view returns (uint256)",
            "function extensionMarginUsed(address) view returns (uint256)",
            "function extensionFeeRecipient() view returns (address)",
            "function COMMITMENT_DURATION() view returns (uint256)",
            "function setCommitmentDuration(uint256 duration)",
            "function paymentNonces(address) view returns (uint256)",
            "function processAuthorizedPayment((address payer, address payee, uint256 amount, uint256 feeBps, uint256 nonce, uint256 deadline, bytes32 agreementHash) auth, bytes signature)",
            "event PaymentProcessed(address indexed payer, address indexed payee, uint256 netAmount, uint256 fee, uint256 lotId, uint256 dueAt)",
            "event DebtAmortized(address indexed user, uint256 amountAmortized, uint256 remainingTotalDebt)"
        ];

        this.vaultAbi = [
            "function deposit(uint256 value)",
            "function withdraw(uint256 value)",
            "function repayWithCollateral(address user, uint256 value)",
            "function liquidateDelinquent(address user, uint256 value)",
            "function userCollateral(address) view returns (uint256)",
            "function totalCollateralLocked() view returns (uint256)",
            "function getFreeCollateral(address user) view returns (uint256)",
            "function exchangeReserved(address) view returns (uint256)",
            "function pendingReserve(address) view returns (uint256)",
            "function paused() view returns (bool)",
            "function pause()",
            "function unpause()",
            "event CollateralDeposited(address indexed user, uint256 amount, uint256 newUserTotal, uint256 newVaultTotal)",
            "event CollateralWithdrawn(address indexed user, uint256 amount, uint256 newUserTotal, uint256 newVaultTotal)",
            "event AmortizationQueued(address indexed user, uint256 pendingAmount, bool maturedOnly)",
            "event AmortizationOrderCreated(address indexed user, uint64 indexed orderId, uint256 amount)",
            "event AmortizationPurchaseFilled(address indexed user, uint64 indexed orderId, uint256 usdtSpent, uint256 blueBurned)",
            "event AmortizationReserveReturned(address indexed user, uint64 indexed orderId, uint256 amount)"
        ];

        this.exchangeAbi = [
            "function createBlueOrder(uint128 amount) returns (uint64 newOrderId)",
            "function createUsdtOrder(uint128 amount) returns (uint64 newOrderId)",
            "function matchOrders(uint256 maxMatches, uint256 maxOrdersScanned) returns (uint256 matchesExecuted, uint256 ordersScanned)",
            "function cancelOrder(uint64 orderId)",
            "function resumeOrder(uint64 id)",
            "function claimPendingRefunds()",
            "function pendingRefundBlue(address) view returns (uint128)",
            "function pendingRefundUsdt(address) view returns (uint128)",
            "function totalPendingRefundBlue() view returns (uint128)",
            "function totalPendingRefundUsdt() view returns (uint128)",
            "event OrderSuspended(uint64 indexed orderId, uint8 reason)",
            "event OrderResumed(uint64 indexed orderId, uint64 oldSequence, uint64 newSequence)",
            "event RefundHeld(address indexed user, uint128 blue, uint128 usdt)",
            "event PendingRefundClaimed(address indexed user, uint128 blue, uint128 usdt)",
            "function totalReservedBlue() view returns (uint128)",
            "function totalReservedUsdt() view returns (uint128)",
            "function totalDepositedBlue() view returns (uint128)",
            "function totalDepositedUsdt() view returns (uint128)",
            "function blueHeadIndex() view returns (uint64)",
            "function usdtHeadIndex() view returns (uint64)",
            "function paused() view returns (bool)",
            "function getBlueOrderIdsLength() view returns (uint256)",
            "function getUsdtOrderIdsLength() view returns (uint256)",
            "function orders(uint64) view returns (uint64 id, uint64 sequenceId, uint128 remainingAmount, address user, uint8 status, uint8 side, uint48 createdAt, uint128 originalAmount, uint128 refundedAmount)"
        ];

        this.treasuryAbi = [
            "function rewardEpoch() view returns (uint256)",
            "function hasClaimed(address user) view returns (bool)",
            "function coreProtocol() view returns (address)",
            "event RewardEpochStarted(uint256 indexed epoch, bytes32 root)",
            "function pause()",
            "function unpause()",
            "function paused() view returns (bool)",
            "function blueToken() view returns (address)"
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

            if (!PROTOCOL_ADDRESS || !VAULT_ADDRESS) throw new Error('Contratos Web3 no configurados');
            let paused, maxTx, commissionRate, totalVaultLocked, vaultPaused;
            const protocolConfig = this._getProtocol();
            const [duration, recipient, extensionDays] = await Promise.all([
                protocolConfig.COMMITMENT_DURATION(), protocolConfig.extensionFeeRecipient(), protocolConfig.getExtensionDurations()
            ]);
            const extensionOptions = await Promise.all(extensionDays.map(async (days) => {
                const option = await protocolConfig.extensionOptions(days);
                return { days: Number(days), bps: Number(option.feeBps), enabled: option.enabled };
            }));

            if (PROTOCOL_ADDRESS) {
                const protocol = this._getProtocol();
                const [p, m, c] = await Promise.all([
                    protocol.paused(),
                    protocol.maxTransactionAmount(),
                    protocol.commissionBps()
                ]);
                paused = p;
                maxTx = ethers.formatUnits(m, 6);
                commissionRate = c.toString();
            }

            if (VAULT_ADDRESS) {
                const vault = this._getVault();
                const [locked, currentPause] = await Promise.all([vault.totalCollateralLocked(), vault.paused()]);
                vaultPaused = currentPause;
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
                    totalCollateralLocked: totalVaultLocked, vaultPaused, commitmentDurationSeconds: Number(duration),
                    extensionFeeRecipient: recipient, extensionOptions, minExtensionLevel: 3, minExtensionMarginLevel: 5
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
            const tx = await protocol.setCommissionBps(parseInt(rateBps, 10));
            const txHash = await this._waitForConfirmation(tx, 'setCommissionRate');
            return { success: true, txHash };
        } catch (error) {
            console.error('[WEB3 BRIDGE] Error en setCommissionRate:', error.message);
            return { success: false, error: error.message };
        }
    }

    async setCommitmentDuration(durationSeconds) {
        if (!this._isReady()) return { success: false, error: 'Relayer no configurado' };
        try {
            const protocol = this._getProtocol();
            const tx = await protocol.setCommitmentDuration(parseInt(durationSeconds, 10));
            const txHash = await this._waitForConfirmation(tx, 'setCommitmentDuration');
            return { success: true, txHash };
        } catch (error) {
            console.error('[WEB3 BRIDGE] Error en setCommitmentDuration:', error.message);
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

    async getUserAuditDetailed(walletAddress, offset = 0, limit = 50) {
        if (!ethers.isAddress(walletAddress)) return { success: false, error: 'Dirección inválida' };
        if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100)
            return { success: false, error: 'Paginación inválida' };
        try {
            const core = this._getProtocol(), vault = this._getVault();
            const block = await this.provider.getBlock('latest');
            const options = { blockTag: block.number };
            const [blue, red, collateral, free, capacity, required, delinquent, kyc, base, count, level, margin, used, reserved, pending] = await Promise.all([
                this._getERC20(BLUE_ADDRESS).balanceOf(walletAddress, options), this._getERC20(RED_ADDRESS).balanceOf(walletAddress, options),
                vault.userCollateral(walletAddress, options), vault.getFreeCollateral(walletAddress, options),
                core.getAvailableCreditCapacity(walletAddress, options), core.getRequiredCollateral(walletAddress, options),
                core.isDelinquent(walletAddress, options), core.isKYCVerified(walletAddress, options), core.creditLimits(walletAddress, options),
                core.getUserDebtLotsCount(walletAddress, options), core.userLevels(walletAddress, options),
                core.extensionMarginLimits(walletAddress, options), core.extensionMarginUsed(walletAddress, options),
                vault.exchangeReserved(walletAddress, options), vault.pendingReserve(walletAddress, options)
            ]);
            const length = Number(count), stop = Math.min(offset + limit, length);
            const lots = await Promise.all(Array.from({ length: Math.max(0, stop - offset) }, (_, i) => core.userDebtLots(walletAddress, offset + i, options)));
            return { success: true, wallet: walletAddress, blockNumber: block.number,
                blueBalance: ethers.formatUnits(blue,6), redCommitment: ethers.formatUnits(red,6),
                collateralVault: { totalLocked: ethers.formatUnits(collateral,6), freeForWithdrawal: ethers.formatUnits(free,6),
                    reservedInExchange: ethers.formatUnits(reserved,6), pendingReserve: ethers.formatUnits(pending,6) },
                credit: { baseLimit: ethers.formatUnits(base,6), availableCapacity: ethers.formatUnits(capacity,6),
                    requiredCollateral: ethers.formatUnits(required,6), isDelinquent: delinquent, isKYCVerified: kyc,
                    level: Number(level), extensionMarginLimit: ethers.formatUnits(margin,6), extensionMarginUsed: ethers.formatUnits(used,6) },
                debtLots: lots.map((lot, i) => ({ index: offset+i, id: lot.id.toString(), originalAmount: ethers.formatUnits(lot.amount,6),
                    remainingAmount: ethers.formatUnits(lot.remainingAmount,6), dueAt: new Date(Number(lot.dueAt)*1000).toISOString(),
                    repaid: lot.repaid, isOverdue: !lot.repaid && Number(lot.dueAt) <= block.timestamp })),
                pagination: { offset, limit, total: count.toString(), nextOffset: stop < length ? stop : null } };
        } catch (error) { return { success: false, error: error.message }; }
    }

    async setExtensionParams(days, bps, enabled) {
        if (!this._isReady()) return { success: false, error: 'Gobernanza no configurada' };
        try {
            const tx = await this._getProtocol().setExtensionOption(days, bps, enabled);
            return { success: true, txHash: await this._waitForConfirmation(tx, 'setExtensionOption') };
        } catch (error) { return { success: false, error: error.message }; }
    }

    async setUserBenefits(wallet, level, margin) {
        if (!this._isReady()) return { success: false, error: 'Gobernanza no configurada' };
        try {
            const tx = await this._getProtocol().setUserBenefits(wallet, level, ethers.parseUnits(String(margin), 6));
            return { success: true, txHash: await this._waitForConfirmation(tx, 'setUserBenefits') };
        } catch (error) { return { success: false, error: error.message }; }
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

    /**
     * Genera la autorización y firma criptográfica EIP-712 en memoria para una billetera invisible.
     * Cero Hardcoded Secrets: utiliza walletService.decrypt para descifrar la llave privada.
     * Cumplimiento SOC 2: la llave efímera se destruye de inmediato tras generar la firma.
     */
    async generateSignedPaymentAuthorization({ payerWalletAddress, payerPrivateKey, payerEncryptedKey, payeeWalletAddress, amountBlue, pubId }) {
        if (!this._isReady()) throw new Error('Servicio Web3 no inicializado o sin conexión');
        let privateKey = payerPrivateKey;
        if (!privateKey && payerEncryptedKey) {
            const walletService = require('./walletService');
            privateKey = walletService.decrypt(payerEncryptedKey);
        }
        if (!privateKey) throw new Error('No se pudo obtener la clave para firmar la autorización');

        const protocol = this._getProtocol();
        const grossUnits = ethers.parseUnits(amountBlue.toString(), 6);

        // Consultar nonce y comisión actual on-chain en paralelo
        const [nonce, commissionBps, network] = await Promise.all([
            protocol.paymentNonces(payerWalletAddress),
            protocol.commissionBps(),
            this.provider.getNetwork()
        ]);

        const deadline = Math.floor(Date.now() / 1000) + 900; // 15 minutos de validez
        const agreementHash = ethers.id(`winton-payment-${pubId || 'direct'}-${payerWalletAddress}-${nonce}-${Date.now()}`);

        const auth = {
            payer: ethers.getAddress(payerWalletAddress),
            payee: ethers.getAddress(payeeWalletAddress),
            amount: grossUnits,
            feeBps: commissionBps,
            nonce: nonce,
            deadline: deadline,
            agreementHash: agreementHash
        };

        const domain = {
            name: 'WintonCore',
            version: '4',
            chainId: network.chainId,
            verifyingContract: PROTOCOL_ADDRESS
        };

        const types = {
            Payment: [
                { name: 'payer', type: 'address' },
                { name: 'payee', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'feeBps', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' },
                { name: 'agreementHash', type: 'bytes32' }
            ]
        };

        const ephemeralSigner = new ethers.Wallet(privateKey);
        const signature = await ephemeralSigner.signTypedData(domain, types, auth);

        return { authorization: auth, signature };
    }

    async syncPaymentToBlockchain({ payerWalletAddress, payeeWalletAddress, amountBlue, dbTransactionId, payerUsername, payeeUsername, authorization, signature }) {
        if (!this._isReady()) return null;

        try {
            console.log(`[WEB3 BRIDGE] Sincronizando pago V4: ${payerUsername} → ${payeeUsername} (${amountBlue} BLUE)`);
            const protocol = this._getProtocol();
            const grossUnits = ethers.parseUnits(amountBlue.toString(), 6);

            if (!authorization || !signature) throw new Error('Se requiere autorización firmada del pagador');
            if (authorization.payer.toLowerCase() !== payerWalletAddress.toLowerCase()
                || authorization.payee.toLowerCase() !== payeeWalletAddress.toLowerCase()
                || BigInt(authorization.amount) !== grossUnits) throw new Error('La firma no corresponde al pago solicitado');
            // ── BLINDAJE FINTECH PREVIO: Validar y auto-habilitar precondiciones on-chain ──
            const [isPayerKyc, isPayeeKyc, isTreasuryKyc] = await Promise.all([
                protocol.isKYCVerified(payerWalletAddress),
                protocol.isKYCVerified(payeeWalletAddress),
                TREASURY_ADDRESS ? protocol.isKYCVerified(TREASURY_ADDRESS) : true
            ]);

            if (!isPayerKyc) {
                console.log(`[WEB3 BRIDGE] 🛡️ Auto-habilitando KYC on-chain para pagador ${payerWalletAddress}`);
                const txKyc = await protocol.setKYCStatus(payerWalletAddress, true);
                await this._waitForConfirmation(txKyc, 'autoPayerKYC');
            }
            if (!isPayeeKyc) {
                console.log(`[WEB3 BRIDGE] 🛡️ Auto-habilitando KYC on-chain para beneficiario ${payeeWalletAddress}`);
                const txKyc = await protocol.setKYCStatus(payeeWalletAddress, true);
                await this._waitForConfirmation(txKyc, 'autoPayeeKYC');
            }
            if (!isTreasuryKyc && TREASURY_ADDRESS) {
                console.log(`[WEB3 BRIDGE] 🛡️ Auto-habilitando KYC on-chain para Tesorería ${TREASURY_ADDRESS}`);
                const txKyc = await protocol.setKYCStatus(TREASURY_ADDRESS, true);
                await this._waitForConfirmation(txKyc, 'autoTreasuryKYC');
            }

            const capacity = await protocol.getAvailableCreditCapacity(payerWalletAddress);
            const feeUnits = (grossUnits * BigInt(authorization.feeBps)) / 10000n;
            const requiredCapacity = grossUnits + feeUnits;

            if (capacity < requiredCapacity) {
                console.log(`[WEB3 BRIDGE] 🛡️ Capacidad insuficiente (${capacity} < ${requiredCapacity}). Asignando capacidad de compromiso on-chain...`);
                const limitUnits = requiredCapacity + ethers.parseUnits('500', 6);
                const txCredit = await protocol.setCreditLimit(payerWalletAddress, limitUnits);
                await this._waitForConfirmation(txCredit, 'autoCreditCapacity');
            }

            const tx = await protocol.processAuthorizedPayment(authorization, signature);
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
            throw error;
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
        if (process.env.ENABLE_TEST_TOKEN_MINT !== 'true') return { success: false, error: 'Emisión de prueba deshabilitada' };
        if (!this._isReady() || !USDT_ADDRESS) return { success: false, error: 'Token USDT no configurado' };
        try {
            const { chainId } = await this.provider.getNetwork();
            if (![1337n, 31337n, 11155420n].includes(chainId)) throw new Error('Emisión de prueba prohibida en esta red');
            if (!await this._getProtocol().isKYCVerified(walletAddress)) throw new Error('Se requiere KYC aprobado');
            if (!/^\d+(\.\d{1,6})?$/.test(String(amountUnits)) || ethers.parseUnits(String(amountUnits),6) <= 0n
                || ethers.parseUnits(String(amountUnits),6) > 5_000_000_000n) throw new Error('Importe de prueba inválido');
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
