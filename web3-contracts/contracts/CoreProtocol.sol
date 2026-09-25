// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// ============================================================================
// INTERFACES MÍNIMAS
// ============================================================================

interface IBlueToken {
    function mint(address to, uint256 amount) external;
    function mintWithParking(address to, uint256 amount, uint256 releaseAt) external;
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
 *    Capacidad Total = Límite Base + Colateral USDT (contado una sola vez)
 *    Capacidad Disponible = max(0, Límite Base + Colateral - Compromiso RED Total)
 * 5. Orden por vencimiento real mediante heap; el coste depende de posiciones consumidas.
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
    uint256 public COMMITMENT_DURATION = 30 days;

    /// @notice Sin período de gracia adicional: mora desde el vencimiento.
    uint256 public constant GRACE_PERIOD = 0;

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

    // Extension policy. No monetary margin is granted by default.
    uint8 public constant MIN_EXTENSION_LEVEL = 3;
    uint8 public constant MIN_EXTENSION_MARGIN_LEVEL = 5;
    uint8 public constant MAX_EXTENSIONS = 2;
    uint256 public constant EXTENSION_COOLDOWN = 15 days;
    mapping(address => uint8) public userLevels;
    mapping(address => uint256) public extensionMarginLimits;
    mapping(address => uint256) public extensionMarginUsed;
    struct ExtensionOption { uint16 feeBps; bool enabled; }
    struct ExtensionRecord {
        uint8 count;
        uint256 firstExtendedAt;
        uint256 outstandingFee;
        uint256 marginUsed;
    }
    mapping(uint256 => ExtensionOption) public extensionOptions;
    mapping(uint256 => ExtensionRecord) public lotExtensions;
    address public extensionFeeRecipient;
    uint256[] private _extensionDurations;
    mapping(uint256 => bool) private _knownExtensionDuration;
    event UserLevelUpdated(address indexed user, uint8 level);
    event ExtensionMarginUpdated(address indexed user, uint256 limit);
    event ExtensionOptionUpdated(uint256 durationDays, uint16 feeBps, bool enabled);
    event ExtensionRecipientUpdated(address indexed recipient);
    event CommitmentDurationUpdated(uint256 duration);
    event CommitmentExtended(address indexed user, uint256 indexed lotId,
        uint256 oldDueAt, uint256 newDueAt, uint256 fee, uint256 marginAdded, uint8 count);

    function getExtensionDurations() external view returns (uint256[] memory) { return _extensionDurations; }
    function setUserBenefits(address user, uint8 level, uint256 margin) external onlyOwner {
        require(user != address(0) && margin >= extensionMarginUsed[user], "Protocol: Invalid benefit update");
        userLevels[user] = level;
        extensionMarginLimits[user] = margin;
        emit UserLevelUpdated(user, level);
        emit ExtensionMarginUpdated(user, margin);
    }
    function setUserLevel(address user, uint8 level) external onlyOwner {
        require(user != address(0), "Protocol: Invalid zero address");
        userLevels[user] = level;
        emit UserLevelUpdated(user, level);
    }

    function setExtensionMargin(address user, uint256 limit) external onlyOwner {
        require(user != address(0), "Protocol: Invalid zero address");
        require(limit >= extensionMarginUsed[user], "Protocol: Margin already committed");
        extensionMarginLimits[user] = limit;
        emit ExtensionMarginUpdated(user, limit);
    }

    function setExtensionOption(uint256 durationDays, uint16 feeBps, bool enabled) external onlyOwner {
        require(durationDays > 0 && durationDays <= 365, "Protocol: Invalid extension duration");
        require(feeBps <= BPS_DENOMINATOR, "Protocol: Invalid extension fee");
        if (!_knownExtensionDuration[durationDays]) {
            _extensionDurations.push(durationDays);
            _knownExtensionDuration[durationDays] = true;
        }
        extensionOptions[durationDays] = ExtensionOption(feeBps, enabled);
        emit ExtensionOptionUpdated(durationDays, feeBps, enabled);
    }

    // The fund's investment/coverage mechanics are not defined here. There is no
    // automatic diversion of collateral or authority to repay on a user's behalf.
    function setExtensionFeeRecipient(address recipient) external onlyOwner {
        require(recipient.code.length > 0 && recipient != address(this)
            && recipient != address(blueToken) && recipient != address(redToken)
            && recipient != vault, "Protocol: Invalid extension recipient");
        extensionFeeRecipient = recipient;
        emit ExtensionRecipientUpdated(recipient);
    }

    function setCommitmentDuration(uint256 duration) external onlyOwner {
        require(duration > 0 && duration <= 365 days, "Protocol: Invalid duration");
        COMMITMENT_DURATION = duration;
        emit CommitmentDurationUpdated(duration);
    }

    function quoteExtension(address user, uint256 lotIndex, uint256 durationDays)
        public view returns (uint256 fee, uint256 dueAt, uint256 marginNeeded)
    {
        require(lotIndex < userDebtLots[user].length, "Protocol: Unknown commitment");
        ExtensionOption memory option = extensionOptions[durationDays];
        require(option.enabled, "Protocol: Extension option disabled");
        DebtLot storage lot = userDebtLots[user][lotIndex];
        // No interest on previous extension fees. Repayments settle fees first.
        fee = (lot.remainingAmount - lotExtensions[lot.id].outstandingFee) * option.feeBps / BPS_DENOMINATOR;
        dueAt = lot.dueAt + durationDays * 1 days;
        uint256 available = getAvailableCreditCapacity(user);
        marginNeeded = fee > available ? fee - available : 0;
    }

    // Direct account authorization: a relayer/owner cannot extend somebody else's lot.
    // Smart accounts can call this function as the user; no unsolicited RED is issued.
    function requestCommitmentExtension(uint256 lotIndex, uint256 durationDays,
        uint256 expectedFee, uint256 expectedDueAt, address expectedRecipient, uint256 deadline)
        external nonReentrant whenNotPaused
    {
        require(isKYCVerified[msg.sender], "Protocol: KYC not verified");
        require(userLevels[msg.sender] >= MIN_EXTENSION_LEVEL, "Protocol: Extension requires level 3");
        require(block.timestamp <= deadline, "Protocol: Extension authorization expired");
        require(extensionFeeRecipient != address(0) && extensionFeeRecipient == expectedRecipient,
            "Protocol: Extension recipient changed or missing");
        require(!isDelinquent(msg.sender), "Protocol: Overdue commitments");
        (uint256 fee, uint256 newDueAt, uint256 margin) = quoteExtension(msg.sender, lotIndex, durationDays);
        DebtLot storage lot = userDebtLots[msg.sender][lotIndex];
        require(lot.remainingAmount > 0 && !lot.repaid, "Protocol: Commitment already repaid");
        require(lot.dueAt > block.timestamp, "Protocol: Commitment already due");
        require(fee == expectedFee && lot.dueAt == expectedDueAt, "Protocol: Extension quote changed");
        ExtensionRecord storage record = lotExtensions[lot.id];
        require(record.count < MAX_EXTENSIONS, "Protocol: Extension limit reached");
        require(record.count == 0 || block.timestamp >= record.firstExtendedAt + EXTENSION_COOLDOWN,
            "Protocol: Extension cooldown active");
        uint256 collateral = ICollateralVault(vault).userCollateral(msg.sender);
        require(redToken.balanceOf(msg.sender) <= creditLimits[msg.sender] + collateral + extensionMarginUsed[msg.sender],
            "Protocol: Existing commitments exceed coverage");
        if (margin > 0) {
            require(userLevels[msg.sender] >= MIN_EXTENSION_MARGIN_LEVEL, "Protocol: Insufficient fee capacity");
            require(extensionMarginUsed[msg.sender] + margin <= extensionMarginLimits[msg.sender],
                "Protocol: Extension margin exhausted");
        }
        uint256 oldDueAt = lot.dueAt;
        if (record.count == 0) record.firstExtendedAt = block.timestamp;
        record.count++;
        record.outstandingFee += fee;
        record.marginUsed += margin;
        extensionMarginUsed[msg.sender] += margin;
        lot.amount += fee;
        lot.remainingAmount += fee;
        lot.dueAt = newDueAt;
        _siftDown(msg.sender, _debtPositions[lot.id]);
        if (fee > 0) {
            require(isKYCVerified[extensionFeeRecipient], "Protocol: Extension recipient KYC not verified");
            redToken.mintCommitment(msg.sender, fee);
            blueToken.mintWithParking(extensionFeeRecipient, fee, block.timestamp + COMMITMENT_DURATION);
        }
        emit CommitmentExtended(msg.sender, lot.id, oldDueAt, newDueAt, fee, margin, record.count);
    }

    function _repayExtensionFees(address user, uint256 lotId, uint256 amount) internal {
        ExtensionRecord storage record = lotExtensions[lotId];
        uint256 paidFee = amount < record.outstandingFee ? amount : record.outstandingFee;
        uint256 paidMargin = paidFee < record.marginUsed ? paidFee : record.marginUsed;
        record.outstandingFee -= paidFee;
        record.marginUsed -= paidMargin;
        extensionMarginUsed[user] -= paidMargin;
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
    function setCreditLimit(address account, uint256 limit) external onlyOwner {
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
     *      Capacidad Disponible = max(0, Límite Base + Colateral - Compromiso RED Total)
     * @param user Dirección de la billetera del usuario.
     * @return Capacidad disponible para emitir nuevos compromisos.
     */
    function getAvailableCreditCapacity(address user) public view returns (uint256) {
        uint256 totalDebt = redToken.balanceOf(user);
        uint256 collateral = vault != address(0) ? ICollateralVault(vault).userCollateral(user) : 0;

        uint256 capacity = creditLimits[user] + collateral;
        return capacity > totalDebt ? capacity - totalDebt : 0;
    }

    function getCoverageShortfall(address user) external view returns (uint256) {
        uint256 debt = redToken.balanceOf(user);
        uint256 coverage = creditLimits[user] + extensionMarginUsed[user]
            + (vault != address(0) ? ICollateralVault(vault).userCollateral(user) : 0);
        return debt > coverage ? debt - coverage : 0;
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

        uint256 overdueCommitments = getMaturedDebt(user);

        // Already granted fee-only margin is not spendable credit or withdrawable collateral.
        uint256 baseLimit = creditLimits[user] + extensionMarginUsed[user];
        uint256 uncoveredExcess = totalDebt > baseLimit ? totalDebt - baseLimit : 0;

        return overdueCommitments > uncoveredExcess ? overdueCommitments : uncoveredExcess;
    }

    /**
     * @notice Determina si existe un compromiso pendiente cuyo vencimiento ya llegó.
     * @param user Dirección del deudor.
     * @return true si existe al menos un lote con fecha vencida mayor al período de gracia.
     */
    function isDelinquent(address user) public view returns (bool) {
        return _debtHeap[user].length > 0 && userDebtLots[user][_debtHeap[user][0]].dueAt <= block.timestamp;
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
    struct PaymentAuthorization {
        address payer;
        address payee;
        uint256 amount;
        uint256 feeBps;
        uint256 nonce;
        uint256 deadline;
        bytes32 agreementHash;
    }
    bytes32 public constant PAYMENT_TYPEHASH = keccak256(
        "Payment(address payer,address payee,uint256 amount,uint256 feeBps,uint256 nonce,uint256 deadline,bytes32 agreementHash)"
    );
    mapping(address => uint256) public paymentNonces;

    function processPayment(address payer, address payee, uint256 amount)
        external nonReentrant whenNotPaused
    {
        require(msg.sender == payer, "Protocol: Payer authorization required");
        _processPayment(payer, payee, amount);
    }

    function processAuthorizedPayment(PaymentAuthorization calldata auth, bytes calldata signature)
        external nonReentrant whenNotPaused
    {
        require(block.timestamp <= auth.deadline, "Protocol: Payment authorization expired");
        require(auth.feeBps == commissionBps, "Protocol: Commission changed");
        require(auth.nonce == paymentNonces[auth.payer], "Protocol: Invalid payment nonce");
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(PAYMENT_TYPEHASH,
            auth.payer, auth.payee, auth.amount, auth.feeBps, auth.nonce, auth.deadline, auth.agreementHash)));
        require(_validSignature(auth.payer, digest, signature), "Protocol: Invalid payer signature");
        paymentNonces[auth.payer]++;
        _processPayment(auth.payer, auth.payee, auth.amount);
    }

    function _hashTypedDataV4(bytes32 structHash) private view returns (bytes32) {
        bytes32 domain = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("WintonCore"), keccak256("4"), block.chainid, address(this)
        ));
        return keccak256(abi.encodePacked(hex"1901", domain, structHash));
    }
    function _validSignature(address signer, bytes32 digest, bytes calldata signature) private view returns (bool) {
        if (signer.code.length == 0) {
            (address recovered, ECDSA.RecoverError error,) = ECDSA.tryRecover(digest, signature);
            return error == ECDSA.RecoverError.NoError && recovered == signer;
        }
        (bool ok, bytes memory result) = signer.staticcall(abi.encodeWithSelector(bytes4(0x1626ba7e), digest, signature));
        return ok && result.length >= 32 && abi.decode(result, (bytes32)) == bytes32(bytes4(0x1626ba7e));
    }
    function _processPayment(address payer, address payee, uint256 grossAmount) internal {
        require(isKYCVerified[payer], "Protocol: Payer KYC not verified");
        require(isKYCVerified[payee], "Protocol: Payee KYC not verified");
        _settleMatured(payer);
        require(!isDelinquent(payer), "Protocol: Payer has overdue commitments");
        require(payer != payee, "Protocol: Self payment not permitted");
        require(grossAmount > 0, "Protocol: Gross amount must be greater than zero");
        require(grossAmount <= maxTransactionAmount, "Protocol: Exceeds max transaction limit");
        require(treasury != address(0), "Protocol: Treasury contract not configured");

        // Validación de Capacidad Canónica
        uint256 fee = (grossAmount * commissionBps) / BPS_DENOMINATOR;
        if (fee > 0) require(isKYCVerified[treasury], "Protocol: Treasury KYC not verified");
        uint256 totalCommitment = grossAmount + fee;
        uint256 availableCapacity = getAvailableCreditCapacity(payer);
        require(totalCommitment <= availableCapacity, "Protocol: Insufficient credit capacity");

        // Cálculo de Comisión y Monto Neto
        uint256 netAmount = grossAmount;

        // Registro del Lote de Compromiso con Vencimiento Determinista (Agenda)
        uint256 currentLotId = nextLotId++;
        uint256 dueAt = block.timestamp + COMMITMENT_DURATION;

        userDebtLots[payer].push(DebtLot({
            id: currentLotId,
            amount: totalCommitment,
            remainingAmount: totalCommitment,
            dueAt: dueAt,
            repaid: false
        }));

        _insertDebt(payer, userDebtLots[payer].length - 1);

        // Emisión Dual (Materia-Antimateria)
        redToken.mintCommitment(payer, totalCommitment);
        blueToken.mintWithParking(payee, netAmount, dueAt);
        if (fee > 0) {
            blueToken.mintWithParking(treasury, fee, dueAt);
        }

        _settleMatured(payee);
        emit PaymentProcessed(payer, payee, netAmount, fee, currentLotId, dueAt);
    }

    // ========================================================================
    // AMORTIZACIÓN Y EXTINCIÓN DE COMPROMISOS (FIFO DETERMINISTA)
    // ========================================================================

    /**
     * @notice Permite al usuario amortizar compromisos pendientes utilizando sus tokens BLUE líquidos.
     * @dev Quema atómicamente el BLUE del usuario y su saldo RED correspondiente, amortizando lotes en orden FIFO.
     * @param user Cuenta cuyo BLUE disponible se aplica a compromisos vencidos.
     */
    function settleMatured(address user) external nonReentrant whenNotPaused {
        require(isKYCVerified[user], "Protocol: KYC not verified");
        _settleMatured(user);
    }

    function _settleMatured(address user) internal {
        uint256 available = blueToken.balanceOf(user);
        if (available == 0 || !isDelinquent(user)) return;
        uint256 matured = getMaturedDebtUpTo(user, available);
        uint256 value = matured < available ? matured : available;
        if (value == 0) return;
        blueToken.burn(user, value);
        redToken.burnCommitment(user, value);
        _amortizeLotsFifo(user, value);
        emit DebtAmortized(user, value, redToken.balanceOf(user));
    }
    function amortizeWithBlue(uint256 amount) external nonReentrant whenNotPaused {
        require(isKYCVerified[msg.sender], "Protocol: KYC not verified");
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

        // Burn only BLUE actually received from FIFO.
        blueToken.burn(user, amount);
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
        uint256 remaining = amountToDeduct;
        uint256[] storage heap = _debtHeap[user];
        while (remaining > 0) {
            require(heap.length > 0, "Protocol: Commitment accounting mismatch");
            DebtLot storage lot = userDebtLots[user][heap[0]];
            uint256 applied = remaining < lot.remainingAmount ? remaining : lot.remainingAmount;
            _repayExtensionFees(user, lot.id, applied);
            lot.remainingAmount -= applied;
            remaining -= applied;
            if (lot.remainingAmount == 0) {
                lot.repaid = true;
                delete _debtPositions[lot.id];
                uint256 last = heap[heap.length - 1];
                heap.pop();
                if (heap.length > 0) {
                    heap[0] = last;
                    _debtPositions[userDebtLots[user][last].id] = 0;
                    _siftDown(user, 0);
                }
            }
        }
        uint256 head = userActiveLotHead[user];
        while (head < userDebtLots[user].length && userDebtLots[user][head].repaid) head++;
        userActiveLotHead[user] = head;
    }

    // Active positions only, ordered by actual due date then immutable lot id.
    // Extensions move an existing entry; no stale duplicate entries accumulate.
    mapping(address => uint256[]) private _debtHeap;
    mapping(uint256 => uint256) private _debtPositions;

    function getMaturedDebtUpTo(address user, uint256 maxNeeded) public view returns (uint256 matured) {
        if (maxNeeded == 0) return 0;
        uint256[] storage heap = _debtHeap[user];
        uint256 len = heap.length;
        if (len == 0) return 0;

        DebtLot[] storage lots = userDebtLots[user];
        if (lots[heap[0]].dueAt > block.timestamp) return 0;

        uint256 totalDebt = redToken.balanceOf(user);
        if (totalDebt == 0) return 0;

        uint256 target = maxNeeded < totalDebt ? maxNeeded : totalDebt;

        // DFS retains at most one sibling per level; uint256 indices have at most 256 levels.
        uint256[] memory stack = new uint256[](256);
        uint256 top = 0;
        stack[top++] = 0;

        while (top > 0) {
            uint256 pos = stack[--top];
            DebtLot storage lot = lots[heap[pos]];
            if (lot.dueAt <= block.timestamp) {
                matured += lot.remainingAmount;
                if (matured >= target) {
                    return target;
                }
                uint256 left = pos * 2 + 1;
                if (left < len) {
                    stack[top++] = left;
                }
                uint256 right = left + 1;
                if (right < len) {
                    stack[top++] = right;
                }
            }
        }
    }

    function getMaturedDebt(address user) public view returns (uint256 matured) {
        return getMaturedDebtUpTo(user, type(uint256).max);
    }

    function _earlier(address user, uint256 a, uint256 b) private view returns (bool) {
        DebtLot storage x = userDebtLots[user][a];
        DebtLot storage y = userDebtLots[user][b];
        return x.dueAt < y.dueAt || (x.dueAt == y.dueAt && x.id < y.id);
    }

    function _swapDebt(address user, uint256 a, uint256 b) private {
        uint256[] storage heap = _debtHeap[user];
        (heap[a], heap[b]) = (heap[b], heap[a]);
        _debtPositions[userDebtLots[user][heap[a]].id] = a;
        _debtPositions[userDebtLots[user][heap[b]].id] = b;
    }

    function _insertDebt(address user, uint256 index) private {
        uint256[] storage heap = _debtHeap[user];
        heap.push(index);
        uint256 pos = heap.length - 1;
        _debtPositions[userDebtLots[user][index].id] = pos;
        while (pos > 0) {
            uint256 parent = (pos - 1) / 2;
            if (!_earlier(user, heap[pos], heap[parent])) break;
            _swapDebt(user, pos, parent);
            pos = parent;
        }
    }

    function _siftDown(address user, uint256 pos) private {
        uint256[] storage heap = _debtHeap[user];
        while (pos * 2 + 1 < heap.length) {
            uint256 child = pos * 2 + 1;
            if (child + 1 < heap.length && _earlier(user, heap[child + 1], heap[child])) child++;
            if (!_earlier(user, heap[child], heap[pos])) break;
            _swapDebt(user, child, pos);
            pos = child;
        }
    }

    /**
     * @notice Devuelve el total de lotes registrados para un usuario.
     */
    function getUserDebtLotsCount(address user) external view returns (uint256) {
        return userDebtLots[user].length;
    }
}
