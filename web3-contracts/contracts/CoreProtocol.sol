// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

// ============================================================================
// INTERFACES MÍNIMAS
// ============================================================================

interface IBlueToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

interface IRedToken {
    function mintCommitment(address to, uint256 amount) external;
    function burnCommitment(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

interface ICollateralVault {
    function userCollateral(address user) external view returns (uint256);
}

/**
 * @title CoreProtocol (Motor Central del Ecosistema) - Suite V4
 * @author Protocol Engineering Team
 * @notice Implementa las leyes económicas de emisión simultánea de activo y compromiso,
 *         gestión de lotes de compromisos (DebtLot) con vencimiento determinista,
 *         cálculo canónico de capacidad de crédito y muro KYC on-chain.
 *
 * PRINCIPIOS DE SEGURIDAD FINTECH & ZERO-TRUST:
 * 1. Precisión Unificada en 6 Decimales: Alineado con BLUE, RED y USDT.
 * 2. Emisión Dual Respaldada: Todo BLUE emitido a beneficiarios y tesorería está respaldado
 *    por el compromiso RED correspondiente del pagador (Regla de Balance Cero).
 * 3. Agenda Determinista de Vencimientos: Registro estructurado de compromisos por lotes
 *    con marcas de tiempo inmutables (`block.timestamp`), permitiendo auditar morosidad.
 * 4. Capacidad Canónica de Crédito:
 *    Deuda Descubierta = max(0, Compromiso RED Total - Colateral USDT en Bóveda)
 *    Capacidad Disponible = max(0, Límite Base - Deuda Descubierta)
 * 5. Poda FIFO O(1) Amortizado: Rastreo del cabezal activo de lotes para optimizar consumo de gas.
 * 6. Gobernanza en Dos Pasos (Ownable2Step) y prohibición de renuncia a la administración.
 */
contract CoreProtocol is Ownable2Step, ReentrancyGuard, Pausable {

    // ========================================================================
    // ESTRUCTURAS DE DATOS
    // ========================================================================

    /// @notice Representa un lote individual de compromiso originado en una transacción.
    struct DebtLot {
        uint256 id;
        uint256 amount;
        uint256 remainingAmount;
        uint256 dueAt;
        bool repaid;
    }

    // ========================================================================
    // CONSTANTES DE PROTOCOLO
    // ========================================================================

    /// @notice Plazo estándar de vencimiento de un compromiso ordinario: 30 días.
    uint256 public constant COMMITMENT_DURATION = 30 days;

    /// @notice Período de gracia adicional antes de certificar morosidad ejecutiva: 30 días.
    uint256 public constant GRACE_PERIOD = 30 days;

    /// @notice Base de cálculo de puntos básicos (10,000 BPS = 100%).
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Límite máximo de comisión permitido por gobernanza: 10.00% (1,000 BPS).
    uint256 public constant MAX_COMMISSION_BPS = 1_000;

    // ========================================================================
    // VARIABLES DE ESTADO
    // ========================================================================

    /// @notice Referencia al contrato del token BLUE (activo circulante, 6 decimales).
    IBlueToken public blueToken;

    /// @notice Referencia al contrato del token RED (compromiso formal, 6 decimales).
    IRedToken public redToken;

    /// @notice Dirección de la tesorería receptora de comisiones de plataforma.
    address public treasury;

    /// @notice Dirección de la bóveda segregada de garantías (CollateralVault).
    address public vault;

    /// @notice Dirección del Relayer autorizado para enviar transacciones patrocinadas.
    address public relayer;

    /// @notice Bandera de bloqueo irreversible de contratos base.
    bool public contractsLocked;

    /// @notice Tasa de comisión operativa en puntos básicos (por defecto 500 = 5.00%).
    uint256 public commissionBps = 500;

    /// @notice Disyuntor (circuit breaker): monto máximo por transacción individual (6 decimales).
    uint256 public maxTransactionAmount = 100_000 * 1e6;

    /// @notice Contador correlativo de identificadores de lotes de compromisos.
    uint256 public nextLotId = 1;

    /// @notice Muro KYC On-Chain: registro de billeteras habilitadas para operar.
    mapping(address => bool) public isKYCVerified;

    /// @notice Límite de crédito base asignado a cada usuario en función de su nivel o scoring.
    mapping(address => uint256) public creditLimits;

    /// @notice Historial completo de lotes de compromisos registrados por usuario.
    mapping(address => DebtLot[]) public userDebtLots;

    /// @notice Puntero al primer lote pendiente de amortización (optimización FIFO O(1)).
    mapping(address => uint256) public userActiveLotHead;

    // ========================================================================
    // EVENTOS AUDITABLES (SOC 2 COMPLIANCE)
    // ========================================================================

    event PaymentProcessed(
        address indexed payer,
        address indexed payee,
        uint256 netAmount,
        uint256 fee,
        uint256 lotId,
        uint256 dueAt
    );

    event DebtAmortized(
        address indexed user,
        uint256 amountAmortized,
        uint256 remainingTotalDebt
    );

    event KYCStatusUpdated(address indexed account, bool isVerified);
    event CreditLimitUpdated(address indexed account, uint256 newLimit);
    event CommissionBpsUpdated(uint256 oldBps, uint256 newBps);
    event MaxTransactionAmountUpdated(uint256 oldMax, uint256 newMax);
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
    event CoreContractsConfigured(address blue, address red, address treasury, address vault);

    // ========================================================================
    // MODIFICADORES DE CONTROL DE ACCESO
    // ========================================================================

    /// @dev Restringe la invocación al relayer autorizado o al propietario del protocolo.
    modifier onlyRelayerOrOwner() {
        require(msg.sender == relayer || msg.sender == owner(), "Protocol: Unauthorized caller");
        _;
    }

    /// @dev Restringe la invocación exclusivamente a la bóveda de garantías enlazada.
    modifier onlyVault() {
        require(msg.sender == vault && vault != address(0), "Protocol: Caller is not vault");
        _;
    }

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Prohíbe de forma irrevocable la renuncia a la titularidad del contrato.
     */
    function renounceOwnership() public pure override {
        revert("Protocol: Ownership renunciation is permanently disabled");
    }

    // ========================================================================
    // GOBERNANZA: ENLACE DE CONTRATOS
    // ========================================================================

    /**
     * @notice Enlaza permanentemente los contratos del ecosistema (BlueToken, RedToken, Tesorería, Bóveda).
     * @dev Solo puede ejecutarse una única vez.
     */
    function setContracts(
        address _blue,
        address _red,
        address _treasury,
        address _vault
    ) external onlyOwner {
        require(!contractsLocked, "Protocol: Core contracts are already locked");
        require(
            _blue != address(0) && _red != address(0) && _treasury != address(0) && _vault != address(0),
            "Protocol: Invalid zero address"
        );

        blueToken = IBlueToken(_blue);
        redToken = IRedToken(_red);
        treasury = _treasury;
        vault = _vault;
        contractsLocked = true;

        emit CoreContractsConfigured(_blue, _red, _treasury, _vault);
    }

    /**
     * @notice Actualiza la dirección del relayer backend que patrocina transacciones de gas.
     */
    function setRelayer(address _relayer) external onlyOwner {
        require(_relayer != address(0), "Protocol: Invalid zero address");
        address old = relayer;
        relayer = _relayer;
        emit RelayerUpdated(old, _relayer);
    }

    /**
     * @notice Modifica el estado de verificación KYC de una cuenta.
     */
    function setKYCStatus(address account, bool status) external onlyOwner {
        require(account != address(0), "Protocol: Invalid zero address");
        isKYCVerified[account] = status;
        emit KYCStatusUpdated(account, status);
    }

    /**
     * @notice Establece el límite de crédito base de un usuario.
     */
    function setCreditLimit(address account, uint256 limit) external onlyRelayerOrOwner {
        require(account != address(0), "Protocol: Invalid zero address");
        creditLimits[account] = limit;
        emit CreditLimitUpdated(account, limit);
    }

    /**
     * @notice Ajusta la comisión operativa de la plataforma en puntos básicos.
     */
    function setCommissionBps(uint256 _bps) external onlyOwner {
        require(_bps <= MAX_COMMISSION_BPS, "Protocol: Exceeds max commission cap");
        uint256 old = commissionBps;
        commissionBps = _bps;
        emit CommissionBpsUpdated(old, _bps);
    }

    /**
     * @notice Configura el monto máximo procesable por transacción.
     */
    function setMaxTransactionAmount(uint256 _max) external onlyOwner {
        require(_max > 0, "Protocol: Max amount must be greater than zero");
        uint256 old = maxTransactionAmount;
        maxTransactionAmount = _max;
        emit MaxTransactionAmountUpdated(old, _max);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ========================================================================
    // CÁLCULO DE CAPACIDAD Y SOLVENCIA
    // ========================================================================

    /**
     * @notice Calcula la capacidad de crédito disponible de un usuario en 6 decimales.
     * @dev Fórmula:
     *      Deuda Descubierta = max(0, Compromiso RED Total - Colateral USDT en Bóveda)
     *      Capacidad Disponible = max(0, Límite Base - Deuda Descubierta)
     * @param user Dirección de la billetera del usuario.
     * @return Capacidad disponible para emitir nuevos compromisos.
     */
    function getAvailableCreditCapacity(address user) public view returns (uint256) {
        uint256 totalDebt = redToken.balanceOf(user);
        uint256 collateral = vault != address(0) ? ICollateralVault(vault).userCollateral(user) : 0;

        uint256 uncoveredDebt = totalDebt > collateral ? totalDebt - collateral : 0;
        uint256 baseLimit = creditLimits[user];

        if (baseLimit <= uncoveredDebt) {
            return 0;
        }
        return baseLimit - uncoveredDebt;
    }

    /**
     * @notice Calcula la garantía en USDT requerida que debe permanecer bloqueada en la bóveda.
     * @dev Fórmula Canónica:
     *      Garantía Requerida = max(Compromisos Vencidos, Compromisos Totales - Límite Base)
     * @param user Dirección de la billetera del deudor.
     * @return Monto exacto de colateral no disponible para retiro.
     */
    function getRequiredCollateral(address user) external view returns (uint256) {
        uint256 totalDebt = redToken.balanceOf(user);
        if (totalDebt == 0) return 0;

        // Calcular la suma de compromisos vencidos inspeccionando lotes activos
        uint256 overdueCommitments = 0;
        DebtLot[] storage lots = userDebtLots[user];
        uint256 head = userActiveLotHead[user];
        uint256 len = lots.length;

        for (uint256 i = head; i < len; i++) {
            if (!lots[i].repaid && block.timestamp >= lots[i].dueAt) {
                overdueCommitments += lots[i].remainingAmount;
            }
        }

        uint256 baseLimit = creditLimits[user];
        uint256 uncoveredExcess = totalDebt > baseLimit ? totalDebt - baseLimit : 0;

        return overdueCommitments > uncoveredExcess ? overdueCommitments : uncoveredExcess;
    }

    /**
     * @notice Determina si un usuario ha entrado en mora formal (>30 días transcurridos desde el vencimiento).
     * @param user Dirección del deudor.
     * @return true si existe al menos un lote con fecha vencida mayor al período de gracia.
     */
    function isDelinquent(address user) external view returns (bool) {
        DebtLot[] storage lots = userDebtLots[user];
        uint256 head = userActiveLotHead[user];
        uint256 len = lots.length;

        for (uint256 i = head; i < len; i++) {
            if (!lots[i].repaid && block.timestamp >= (lots[i].dueAt + GRACE_PERIOD)) {
                return true;
            }
        }
        return false;
    }

    // ========================================================================
    // PROCESAMIENTO DE PAGOS (EMISIÓN DUAL EQUILIBRADA)
    // ========================================================================

    /**
     * @notice Procesa un pago originado en el marketplace entre dos partes verificadas.
     * @dev Ejecuta atómicamente la creación del activo BLUE y el compromiso RED.
     * @param payer Billetera del pagador (quien adquiere el compromiso RED).
     * @param payee Billetera del receptor del bien/servicio (quien recibe BLUE líquido).
     * @param grossAmount Monto bruto de la operación en 6 decimales.
     */
    function processPayment(
        address payer,
        address payee,
        uint256 grossAmount
    ) external onlyRelayerOrOwner nonReentrant whenNotPaused {
        require(isKYCVerified[payer], "Protocol: Payer KYC not verified");
        require(isKYCVerified[payee], "Protocol: Payee KYC not verified");
        require(payer != payee, "Protocol: Self payment not permitted");
        require(grossAmount > 0, "Protocol: Gross amount must be greater than zero");
        require(grossAmount <= maxTransactionAmount, "Protocol: Exceeds max transaction limit");
        require(treasury != address(0), "Protocol: Treasury contract not configured");

        // Validación de Capacidad Canónica
        uint256 availableCapacity = getAvailableCreditCapacity(payer);
        require(grossAmount <= availableCapacity, "Protocol: Insufficient credit capacity");

        // Cálculo de Comisión y Monto Neto
        uint256 fee = (grossAmount * commissionBps) / BPS_DENOMINATOR;
        uint256 netAmount = grossAmount - fee;

        // Registro del Lote de Compromiso con Vencimiento Determinista (Agenda)
        uint256 currentLotId = nextLotId++;
        uint256 dueAt = block.timestamp + COMMITMENT_DURATION;

        userDebtLots[payer].push(DebtLot({
            id: currentLotId,
            amount: grossAmount,
            remainingAmount: grossAmount,
            dueAt: dueAt,
            repaid: false
        }));

        // Emisión Dual (Materia-Antimateria)
        redToken.mintCommitment(payer, grossAmount);
        blueToken.mint(payee, netAmount);
        if (fee > 0) {
            blueToken.mint(treasury, fee);
        }

        emit PaymentProcessed(payer, payee, netAmount, fee, currentLotId, dueAt);
    }

    // ========================================================================
    // AMORTIZACIÓN Y EXTINCIÓN DE COMPROMISOS (FIFO DETERMINISTA)
    // ========================================================================

    /**
     * @notice Permite al usuario amortizar compromisos pendientes utilizando sus tokens BLUE líquidos.
     * @dev Quema atómicamente el BLUE del usuario y su saldo RED correspondiente, amortizando lotes en orden FIFO.
     * @param amount Cantidad exacta de compromisos a amortizar (en 6 decimales).
     */
    function amortizeWithBlue(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Protocol: Amortization amount must be greater than zero");
        require(blueToken.balanceOf(msg.sender) >= amount, "Protocol: Insufficient BLUE balance");
        require(redToken.balanceOf(msg.sender) >= amount, "Protocol: Amortization exceeds RED debt");

        // 1. Quema simultánea de tokens
        blueToken.burn(msg.sender, amount);
        redToken.burnCommitment(msg.sender, amount);

        // 2. Liquidación contable en lotes FIFO
        _amortizeLotsFifo(msg.sender, amount);

        emit DebtAmortized(msg.sender, amount, redToken.balanceOf(msg.sender));
    }

    /**
     * @notice Notificación de amortización ejecutada desde CollateralVault mediante colateral en USDT.
     * @dev Extingue los compromisos RED del deudor y deduce los lotes correspondientes en orden FIFO.
     * @param user Dirección del deudor cuyo colateral fue ejecutado.
     * @param amount Monto de compromiso amortizado.
     */
    function onCollateralRepayment(address user, uint256 amount) external onlyVault nonReentrant whenNotPaused {
        require(amount > 0, "Protocol: Repayment amount must be greater than zero");
        require(redToken.balanceOf(user) >= amount, "Protocol: Amount exceeds user debt");

        // Destruir el compromiso formal
        redToken.burnCommitment(user, amount);

        // Amortizar en lotes FIFO
        _amortizeLotsFifo(user, amount);

        emit DebtAmortized(user, amount, redToken.balanceOf(user));
    }

    /**
     * @dev Descuenta el monto amortizado de los lotes activos del usuario en estricto orden de prelación FIFO.
     *      Avanza el puntero userActiveLotHead para mantener complejidad temporal O(1) amortizada.
     */
    function _amortizeLotsFifo(address user, uint256 amountToDeduct) internal {
        DebtLot[] storage lots = userDebtLots[user];
        uint256 head = userActiveLotHead[user];
        uint256 len = lots.length;
        uint256 rem = amountToDeduct;

        while (head < len && rem > 0) {
            if (lots[head].remainingAmount <= rem) {
                rem -= lots[head].remainingAmount;
                lots[head].remainingAmount = 0;
                lots[head].repaid = true;
                head++;
            } else {
                lots[head].remainingAmount -= rem;
                rem = 0;
            }
        }

        userActiveLotHead[user] = head;
    }

    /**
     * @notice Devuelve el total de lotes registrados para un usuario.
     */
    function getUserDebtLotsCount(address user) external view returns (uint256) {
        return userDebtLots[user].length;
    }
}
