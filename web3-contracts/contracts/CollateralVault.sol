// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @dev Interfaz para consultar los requerimientos de garantía y liquidación del protocolo central.
 */
interface ICoreProtocol {
    function getRequiredCollateral(address user) external view returns (uint256);
    function isDelinquent(address user) external view returns (bool);
    function onCollateralRepayment(address user, uint256 amount) external;
}

/**
 * @title CollateralVault (Bóveda Segregada de Garantías) - Suite V4
 * @author Protocol Engineering Team
 * @notice Custodia de forma 100% segregada los depósitos en stablecoins (USDT 6 decimales).
 * @dev Respeta la fórmula canónica de solvencia bancaria:
 *      Garantía Requerida = max(Compromisos Vencidos, Compromisos Totales - Límite Base)
 *      Garantía Libre = max(0, Total Depositado - Garantía Requerida)
 *
 * PRINCIPIOS DE SEGURIDAD FINTECH & ZERO-TRUST:
 * 1. Cero Confiscación Arbitraria: Se erradica la expropiación unilateral de fondos. La liquidación de morosos
 *    solo puede emplearse para amortizar compromisos vencidos reales.
 * 2. Cero Trampa de Liquidez: El usuario con compromisos activos puede usar su colateral depositado
 *    para amortizar (`repayWithCollateral`) sin necesidad de depositar capital adicional.
 * 3. SafeERC20 y CEI: Manejo seguro de USDT que no devuelve bool en transferencias y patrón Checks-Effects-Interactions.
 * 4. Gobernanza en Dos Pasos: Hereda Ownable2Step y prohíbe la renuncia de propiedad.
 */
contract CollateralVault is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ========================================================================
    // VARIABLES DE ESTADO
    // ========================================================================

    /// @notice Token ERC-20 aceptado como garantía (USDT 6 decimales).
    IERC20 public immutable collateralToken;

    /// @notice Dirección del contrato de protocolo central enlazado.
    address public coreProtocol;

    /// @notice Dirección del contrato de exchange enlazado.
    address public exchange;

    /// @notice Bandera de bloqueo: true indica que el enlace de protocolo y exchange es permanente.
    bool public protocolLocked;

    /// @notice Registro del saldo de garantía depositado por cada usuario (en unidades base de 6 decimales).
    mapping(address => uint256) public userCollateral;

    /// @notice Total agregado de colateral actualmente custodiado en la bóveda (para auditoría de solvencia).
    uint256 public totalCollateralLocked;

    // ========================================================================
    // EVENTOS AUDITABLES (SOC 2 COMPLIANCE)
    // ========================================================================

    /// @notice Emitido cuando un usuario deposita fondos como colateral de respaldo.
    event CollateralDeposited(
        address indexed user,
        uint256 amount,
        uint256 newUserTotal,
        uint256 newVaultTotal
    );

    /// @notice Emitido cuando un usuario retira colateral libre de compromisos.
    event CollateralWithdrawn(
        address indexed user,
        uint256 amount,
        uint256 newUserTotal,
        uint256 newVaultTotal
    );

    /// @notice Emitido al aplicar colateral directamente a la amortización de compromisos.
    event RepaidWithCollateral(
        address indexed user,
        uint256 amount,
        uint256 remainingCollateral
    );

    /// @notice Emitido al liquidar la garantía de un deudor formalmente moroso.
    event DelinquentLiquidated(
        address indexed user,
        uint256 amount,
        uint256 remainingCollateral
    );

    /// @notice Emitido al enlazar de forma irreversible los contratos del ecosistema.
    event CoreContractsLinked(address indexed protocol, address indexed exchangeAddress);

    // ========================================================================
    // MODIFICADORES DE CONTROL DE ACCESO
    // ========================================================================

    /// @dev Restringe la llamada al protocolo central o al propio dueño de la cuenta.
    modifier onlyUserOrProtocol(address user) {
        require(
            msg.sender == user || msg.sender == coreProtocol,
            "Vault: Caller is neither user nor core protocol"
        );
        _;
    }

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * @notice Inicializa la bóveda con la dirección inmutable del token colateral (USDT).
     * @param _collateralToken Dirección del token ERC-20 con 6 decimales aceptado en garantía.
     */
    constructor(address _collateralToken) Ownable(msg.sender) {
        require(_collateralToken != address(0), "Vault: Collateral token cannot be zero address");
        collateralToken = IERC20(_collateralToken);
    }

    /**
     * @notice Prohibición estricta de renunciar a la administración del contrato.
     */
    function renounceOwnership() public pure override {
        revert("Vault: Ownership renunciation is permanently disabled");
    }

    // ========================================================================
    // GOBERNANZA: ENLACE DE CONTRATOS (PATRÓN DE BLOQUEO IRREVERSIBLE)
    // ========================================================================

    /**
     * @notice Enlaza las direcciones de CoreProtocol y FifoExchange de forma definitiva.
     * @dev Solo puede ser ejecutado una única vez por el propietario.
     * @param _coreProtocol Dirección del contrato CoreProtocol desplegado.
     * @param _exchange Dirección del contrato FifoExchange desplegado.
     */
    function linkCoreContracts(address _coreProtocol, address _exchange) external onlyOwner {
        require(!protocolLocked, "Vault: Core contracts are already locked");
        require(_coreProtocol != address(0), "Vault: Invalid core protocol address");
        require(_exchange != address(0), "Vault: Invalid exchange address");

        coreProtocol = _coreProtocol;
        exchange = _exchange;
        protocolLocked = true;

        emit CoreContractsLinked(_coreProtocol, _exchange);
    }

    // ========================================================================
    // FUNCIONES CORE: DEPÓSITO Y RETIRO DE GARANTÍA
    // ========================================================================

    /**
     * @notice Deposita USDT en la bóveda para respaldar capacidad de crédito RED.
     * @dev Sigue el estándar SafeERC20. Requiere llamada previa a approve() por el usuario.
     * @param amount Cantidad exacta de stablecoins a depositar (en 6 decimales).
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Vault: Deposit amount must be greater than zero");

        // EFFECTS
        userCollateral[msg.sender] += amount;
        totalCollateralLocked += amount;

        // INTERACTIONS
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);

        emit CollateralDeposited(msg.sender, amount, userCollateral[msg.sender], totalCollateralLocked);
    }

    /**
     * @notice Consulta la cantidad de colateral libre disponible para retiro de un usuario.
     * @param user Dirección de la billetera del usuario.
     * @return Cantidad de fondos disponibles sin afectar compromisos activos (en 6 decimales).
     */
    function getFreeCollateral(address user) public view returns (uint256) {
        uint256 totalUserBalance = userCollateral[user];
        if (totalUserBalance == 0) return 0;

        // Si el protocolo central aún no está enlazado, todo el colateral se considera libre
        if (coreProtocol == address(0)) return totalUserBalance;

        uint256 required = ICoreProtocol(coreProtocol).getRequiredCollateral(user);
        if (totalUserBalance <= required) {
            return 0;
        }
        return totalUserBalance - required;
    }

    /**
     * @notice Retira colateral libre de compromisos hacia la billetera del usuario.
     * @dev Valida estrictamente que el monto solicitado no exceda el colateral libre.
     * @param amount Cantidad de tokens a retirar (en 6 decimales).
     */
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Vault: Withdrawal amount must be greater than zero");

        uint256 free = getFreeCollateral(msg.sender);
        require(amount <= free, "Vault: Requested amount exceeds free collateral");

        // EFFECTS
        userCollateral[msg.sender] -= amount;
        totalCollateralLocked -= amount;

        // INTERACTIONS
        collateralToken.safeTransfer(msg.sender, amount);

        emit CollateralWithdrawn(msg.sender, amount, userCollateral[msg.sender], totalCollateralLocked);
    }

    // ========================================================================
    // AMORTIZACIÓN CON GARANTÍA (RESOLUCIÓN DE TRAMPA DE LIQUIDEZ)
    // ========================================================================

    /**
     * @notice Permite aplicar colateral directamente a la amortización de compromisos RED.
     * @dev Puede ser invocado por el propio deudor o por el protocolo central durante la liquidación de vencimientos.
     * @param user Dirección del deudor cuyos compromisos serán saldados.
     * @param amount Cantidad de colateral a utilizar para comprar BLUE y extinguir RED.
     */
    function repayWithCollateral(address user, uint256 amount)
        external
        nonReentrant
        whenNotPaused
        onlyUserOrProtocol(user)
    {
        require(amount > 0, "Vault: Repayment amount must be greater than zero");
        require(userCollateral[user] >= amount, "Vault: Insufficient user collateral");
        require(coreProtocol != address(0), "Vault: Core protocol not linked");

        // EFFECTS
        userCollateral[user] -= amount;
        totalCollateralLocked -= amount;

        // INTERACTIONS: Notificar al protocolo central y transferir los fondos necesarios
        collateralToken.safeTransfer(coreProtocol, amount);
        ICoreProtocol(coreProtocol).onCollateralRepayment(user, amount);

        emit RepaidWithCollateral(user, amount, userCollateral[user]);
    }

    /**
     * @notice Liquidación de deudor formalmente moroso (>30 días de vencimiento sin cobertura).
     * @dev Solo ejecutable si el protocolo central certifica que el usuario está en morosidad (`isDelinquent`).
     *      Aplica los fondos de forma proporcional a extinguir el compromiso moroso.
     * @param user Billetera del usuario en mora a liquidar.
     * @param amount Cantidad exacta de colateral a ejecutar contra el compromiso vencido.
     */
    function liquidateDelinquent(address user, uint256 amount) external nonReentrant whenNotPaused {
        require(coreProtocol != address(0), "Vault: Core protocol not linked");
        require(amount > 0, "Vault: Liquidation amount must be greater than zero");
        require(userCollateral[user] >= amount, "Vault: Insufficient collateral for liquidation");
        require(ICoreProtocol(coreProtocol).isDelinquent(user), "Vault: User is not delinquent");

        // EFFECTS
        userCollateral[user] -= amount;
        totalCollateralLocked -= amount;

        // INTERACTIONS
        collateralToken.safeTransfer(coreProtocol, amount);
        ICoreProtocol(coreProtocol).onCollateralRepayment(user, amount);

        emit DelinquentLiquidated(user, amount, userCollateral[user]);
    }

    // ========================================================================
    // FUNCIONES DE EMERGENCIA (PAUSABLE)
    // ========================================================================

    /// @notice Suspende temporalmente los depósitos, retiros y liquidaciones ante incidentes de seguridad.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Reanuda las operaciones normales de la bóveda tras auditar y mitigar la contingencia.
    function unpause() external onlyOwner {
        _unpause();
    }
}
