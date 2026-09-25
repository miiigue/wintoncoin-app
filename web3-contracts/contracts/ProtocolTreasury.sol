// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ProtocolTreasury (Bóveda y Tesorería Institucional) - Suite V4
 * @notice Administra y custodia las comisiones y fondos de incentivos en tokens BLUE (6 decimales).
 * @dev Diseñado con gobernanza en dos pasos, timelocks inmutables de 48 horas para retiros de excedentes
 * y verificación criptográfica de reclamos de bonos para impulsores (Boosters).
 *
 * ESTÁNDARES DE SEGURIDAD BANCARIA IMPLEMENTADOS:
 * 1. Precisión de 6 Decimales: Integración directa con BlueToken V4 y USDT.
 * 2. Timelock Obligatorio de 48 Horas: Todo retiro de excedentes hacia la tesorería corporativa debe anunciarse
 *    públicamente on-chain con 48 horas de anticipación antes de poder ejecutarse.
 * 3. Ventana de Caducidad de 7 Días: Si una propuesta de retiro no se ejecuta dentro de su ventana válida, expira.
 * 4. Merkle Proofs Criptográficos: Reclamos de recompensas de impulsores protegidos contra colisiones mediante doble hash.
 * 5. SafeERC20 y ReentrancyGuard en todas las transferencias de fondos.
 */
interface ITreasuryCore {
    function blueToken() external view returns (address);
    function treasury() external view returns (address);
    function commissionBps() external view returns (uint256);
    function processPayment(address payer, address payee, uint256 amount) external;
    function amortizeWithBlue(uint256 amount) external;
}

contract ProtocolTreasury is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ========================================================================
    // CONSTANTES DE GOBERNANZA Y TIMELOCK
    // ========================================================================

    /// @notice Período de timelock obligatorio: 48 horas (172,800 segundos).
    uint256 public constant TIMELOCK_DELAY = 48 hours;

    /// @notice Ventana de validez para ejecutar una propuesta aprobada: 7 días.
    uint256 public constant PROPOSAL_VALIDITY_WINDOW = 7 days;

    // ========================================================================
    // VARIABLES DE ESTADO
    // ========================================================================

    /// @notice Contrato oficial del token BLUE (6 decimales).
    IERC20 public immutable blueToken;

    /// @notice Billetera designada de la entidad fundadora / tesorería corporativa.
    address public corporateTreasuryWallet;

    /// @notice Raíz de Merkle activa del ciclo corriente de recompensas.
    bytes32 public currentMerkleRoot;

    /// @notice Registro de usuarios que ya cobraron en el ciclo de Merkle actual (evita doble reclamo).
    uint256 public rewardEpoch;
    mapping(address => uint256) private lastClaimEpoch;
    ITreasuryCore public coreProtocol;
    event CoreProtocolLinked(address indexed core);
    event RewardEpochStarted(uint256 indexed epoch, bytes32 root);

    function hasClaimed(address user) public view returns (bool) {
        return rewardEpoch > 0 && lastClaimEpoch[user] == rewardEpoch;
    }
    function setCoreProtocol(address core) external onlyOwner {
        require(address(coreProtocol) == address(0) && core.code.length > 0, "Treasury: Invalid core");
        require(ITreasuryCore(core).blueToken() == address(blueToken) && ITreasuryCore(core).treasury() == address(this), "Treasury: Wrong core links");
        coreProtocol = ITreasuryCore(core);
        emit CoreProtocolLinked(core);
    }
    function _payAndAmortize(address recipient, uint256 amount) private {
        require(address(coreProtocol) != address(0), "Treasury: Core not configured");
        uint256 fee = amount * coreProtocol.commissionBps() / 10_000;
        // Ordinary payer rules, including KYC, credit capacity, fee and parking.
        // Both operations revert together if either fails; no privileged BLUE transfer.
        coreProtocol.processPayment(address(this), recipient, amount);
        coreProtocol.amortizeWithBlue(amount + fee);
    }

    /// @notice Estructura de propuesta de retiro de excedentes sujeta a timelock.
    struct SurplusWithdrawalProposal {
        address recipient;
        uint256 amount;
        uint256 eta;
        bool executed;
        bool cancelled;
    }

    /// @notice Propuesta activa de retiro de excedentes.
    SurplusWithdrawalProposal public activeSurplusProposal;

    // ========================================================================
    // EVENTOS AUDITABLES
    // ========================================================================

    /// @notice Emitido cuando un impulsor reclama exitosamente su bono BLUE.
    event BoosterRewardClaimed(address indexed user, uint256 amount);

    /// @notice Emitido al actualizar la raíz de Merkle del ciclo.
    event MerkleRootUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot);

    /// @notice Emitido al actualizar la dirección de la billetera de tesorería corporativa.
    event CorporateTreasuryWalletUpdated(address indexed oldWallet, address indexed newWallet);

    /// @notice Emitido al proponer un retiro de excedentes sujeto a timelock.
    event SurplusWithdrawalProposed(address indexed recipient, uint256 amount, uint256 eta);

    /// @notice Emitido al cancelar una propuesta de retiro de excedentes.
    event SurplusWithdrawalCancelled(address indexed recipient, uint256 amount);

    /// @notice Emitido al ejecutar exitosamente un retiro de excedentes tras madurar el timelock.
    event SurplusWithdrawalExecuted(address indexed recipient, uint256 amount);

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * @notice Inicializa la tesorería enlazando el token BLUE.
     * @param _blueToken Dirección verificada del contrato BlueToken V4.
     */
    constructor(address _blueToken) Ownable(msg.sender) {
        require(_blueToken != address(0), "Treasury: Cannot set BlueToken to zero address");
        blueToken = IERC20(_blueToken);
    }

    /**
     * @notice Prohibición estricta de renuncia a la propiedad.
     */
    function renounceOwnership() public pure override {
        revert("Treasury: Ownership renunciation is permanently disabled");
    }

    // ========================================================================
    // GOBERNANZA: CONFIGURACIÓN DE PARÁMETROS
    // ========================================================================

    /**
     * @notice Asigna o actualiza la billetera de tesorería corporativa autorizada para recibir excedentes.
     * @param _corporateWallet Nueva dirección de tesorería corporativa.
     */
    function setCorporateTreasuryWallet(address _corporateWallet) external onlyOwner {
        require(_corporateWallet != address(0), "Treasury: Cannot set corporate wallet to zero address");
        address old = corporateTreasuryWallet;
        corporateTreasuryWallet = _corporateWallet;
        emit CorporateTreasuryWalletUpdated(old, _corporateWallet);
    }

    /**
     * @notice Establece la nueva raíz de Merkle para la distribución de recompensas del mes.
     * @param _newRoot Hash raíz del árbol de Merkle generado off-chain y auditado.
     */
    function setMerkleRoot(bytes32 _newRoot) external onlyOwner {
        require(_newRoot != bytes32(0), "Treasury: Invalid zero Merkle root");
        bytes32 old = currentMerkleRoot;
        currentMerkleRoot = _newRoot;
        rewardEpoch++;
        emit RewardEpochStarted(rewardEpoch, _newRoot);
        emit MerkleRootUpdated(old, _newRoot);
    }

    /**
     * @notice Pausa de emergencia para suspender reclamos durante contingencias.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Reanudación de operaciones normales tras verificar contingencia.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Operación antigua deshabilitada: publicar una raíz ligada al nuevo rewardEpoch.
     * @dev Mantiene el selector para rechazar explícitamente clientes antiguos.
     */
    function resetClaims(address[] calldata) external view onlyOwner {
        revert("Treasury: Publish a new epoch root");
    }

    // ========================================================================
    // DISTRIBUCIÓN DE RECOMPENSAS MERKLE (BOOSTERS)
    // ========================================================================

    /**
     * @notice Permite a un impulsor o usuario autorizado reclamar sus tokens BLUE acumulados.
     * @dev Utiliza el patrón Check-Effects-Interactions (CEI) y verificación estricta de Merkle Proof.
     * @param amount Cantidad exacta de BLUE a reclamar (6 decimales).
     * @param merkleProof Prueba criptográfica de pertenencia al árbol de Merkle activo.
     */
    function claimBoosterReward(uint256 amount, bytes32[] calldata merkleProof)
        external
        nonReentrant
        whenNotPaused
    {
        address user = msg.sender;

        // 1. CHECKS
        require(!hasClaimed(user), "Treasury: Reward already claimed for this period");
        require(currentMerkleRoot != bytes32(0), "Treasury: Active Merkle root is not set");
        require(amount > 0, "Treasury: Amount must be greater than zero");

        // Construcción de la hoja con doble hashing para neutralizar colisiones de longitud
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(block.chainid, address(this), rewardEpoch, user, amount))));
        require(MerkleProof.verify(merkleProof, currentMerkleRoot, leaf), "Treasury: Invalid Merkle proof");

        uint256 vaultBalance = blueToken.balanceOf(address(this));
        require(vaultBalance >= amount, "Treasury: Insufficient BLUE liquidity in treasury");

        // 2. EFFECTS
        lastClaimEpoch[user] = rewardEpoch;

        // 3. INTERACTIONS
        _payAndAmortize(user, amount);

        emit BoosterRewardClaimed(user, amount);
    }

    // ========================================================================
    // RETIRO DE EXCEDENTES CON TIMELOCK DE 48 HORAS
    // ========================================================================

    /**
     * @notice Inicia una propuesta de retiro de excedentes hacia la tesorería corporativa sujeta a timelock de 48h.
     * @param amount Cantidad de BLUE a retirar (6 decimales).
     */
    function proposeSurplusWithdrawal(uint256 amount) external onlyOwner {
        require(corporateTreasuryWallet != address(0), "Treasury: Corporate treasury wallet not configured");
        require(amount > 0, "Treasury: Amount must be greater than zero");
        require(blueToken.balanceOf(address(this)) >= amount, "Treasury: Insufficient funds in treasury");

        uint256 eta = block.timestamp + TIMELOCK_DELAY;
        activeSurplusProposal = SurplusWithdrawalProposal({
            recipient: corporateTreasuryWallet,
            amount: amount,
            eta: eta,
            executed: false,
            cancelled: false
        });

        emit SurplusWithdrawalProposed(corporateTreasuryWallet, amount, eta);
    }

    /**
     * @notice Cancela una propuesta de retiro de excedentes activa antes o durante el timelock.
     */
    function cancelSurplusProposal() external onlyOwner {
        require(activeSurplusProposal.eta > 0, "Treasury: No active proposal");
        require(!activeSurplusProposal.executed, "Treasury: Proposal already executed");
        require(!activeSurplusProposal.cancelled, "Treasury: Proposal already cancelled");

        activeSurplusProposal.cancelled = true;
        emit SurplusWithdrawalCancelled(activeSurplusProposal.recipient, activeSurplusProposal.amount);
    }

    /**
     * @notice Ejecuta un retiro de excedentes una vez transcurridas las 48 horas de timelock y dentro de la ventana de 7 días.
     */
    function executeSurplusWithdrawal() external onlyOwner nonReentrant whenNotPaused {
        SurplusWithdrawalProposal storage prop = activeSurplusProposal;

        require(prop.eta > 0, "Treasury: No proposal exists");
        require(!prop.executed, "Treasury: Proposal already executed");
        require(!prop.cancelled, "Treasury: Proposal was cancelled");
        require(block.timestamp >= prop.eta, "Treasury: Timelock period has not elapsed yet (48h)");
        require(block.timestamp <= prop.eta + PROPOSAL_VALIDITY_WINDOW, "Treasury: Proposal has expired (7 days)");
        require(blueToken.balanceOf(address(this)) >= prop.amount, "Treasury: Insufficient funds at execution");

        prop.executed = true;

        _payAndAmortize(prop.recipient, prop.amount);

        emit SurplusWithdrawalExecuted(prop.recipient, prop.amount);
    }
}
