// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @dev Interfaz mínima del token BLUE para transferencias y consulta de saldo.
interface IBlueToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title WintonTreasury (La Bóveda del Ecosistema)
 * @author WintonCoin Protocol Team
 * @notice Bóveda programable que custodia las comisiones en BLUE real.
 * Permite a los Impulsores (Boosters) reclamar sus pagos (IOU -> BLUE)
 * mediante Árboles de Merkle.
 *
 * @dev ARQUITECTURA EIP-7702 (Pectra / Isthmus):
 * A diferencia de la versión ERC-2771, este contrato NO necesita un Trusted Forwarder.
 * Con EIP-7702, el Relayer patrocina la transacción y msg.sender es la
 * dirección real del usuario que reclama sus tokens.
 *
 * SEGURIDAD IMPLEMENTADA:
 * - Doble hashing en Merkle Leaf (previene colisiones con abi.encodePacked).
 * - Límite de 200 direcciones por resetClaims (previene DoS por exceso de gas).
 * - ReentrancyGuard en claim() y withdrawSurplus().
 * - Pausable en claim() para emergencias.
 * - Validación de saldo suficiente antes de cada transferencia.
 * - Patrón Check-Effects-Interactions (estado se actualiza ANTES de transferir).
 */
contract WintonTreasury is Ownable, ReentrancyGuard, Pausable {

    // ========================================================================
    // ESTADO
    // ========================================================================

    /// @notice Referencia al contrato del token BLUE para transferencias.
    IBlueToken public blueToken;

    /// @notice Billetera de los fundadores/empresa para recibir excedentes.
    address public foundersWallet;

    /// @notice Raíz de Merkle del ciclo actual (define quién puede cobrar y cuánto).
    bytes32 public currentMerkleRoot;

    /// @notice Límite máximo de direcciones por llamada a resetClaims.
    uint256 public constant MAX_RESET_BATCH = 200;

    /// @notice Registro de quién ya cobró en este ciclo (previene doble cobro).
    mapping(address => bool) public hasClaimed;

    // ========================================================================
    // EVENTOS
    // ========================================================================

    /// @notice Emitido cuando un Impulsor reclama exitosamente sus BLUE.
    event ClaimSuccessful(address indexed user, uint256 amount);

    /// @notice Emitido cuando el Owner actualiza la raíz de Merkle mensual.
    event MerkleRootUpdated(bytes32 newRoot);

    /// @notice Emitido cuando se configura o cambia la billetera fundadora.
    event FoundersWalletUpdated(address indexed newWallet);

    /// @notice Emitido cuando el Owner retira excedentes a la billetera fundadora.
    event SurplusWithdrawn(address indexed to, uint256 amount);

    /// @notice Emitido cuando el Owner resetea los estados de cobro.
    event ClaimsReset(uint256 count);

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * @notice Inicializa la Tesorería con el token BLUE.
     * @dev Con EIP-7702, no se necesita Trusted Forwarder.
     * @param _blueToken Dirección del contrato BlueToken desplegado.
     */
    constructor(address _blueToken) Ownable(msg.sender) {
        // SEGURIDAD: El token BLUE debe ser una dirección válida.
        require(_blueToken != address(0), "Treasury: Invalid BlueToken address");
        blueToken = IBlueToken(_blueToken);
    }

    /**
     * @notice BLOQUEADO. No se permite renunciar a la propiedad del contrato.
     * @dev Sobreescribe Ownable.renounceOwnership() para prevenir que el protocolo
     * quede permanentemente sin administrador. En su lugar, usar transferOwnership()
     * para migrar el control a un Gnosis Safe (multisig) en producción.
     */
    function renounceOwnership() public pure override {
        revert("Treasury: Ownership renunciation is disabled");
    }

    // ========================================================================
    // FUNCIONES DE CONFIGURACIÓN (Solo Owner)
    // ========================================================================

    /**
     * @notice Configura o actualiza la billetera de los fundadores.
     * @dev Solo el Owner puede ejecutar. Flexible para cambios futuros
     * (ej: migrar de hot wallet a cold wallet o multisig).
     * @param _newWallet Dirección de la nueva billetera fundadora.
     */
    function setFoundersWallet(address _newWallet) external onlyOwner {
        // SEGURIDAD: Prevenir configuración a dirección vacía.
        require(_newWallet != address(0), "Treasury: Invalid zero address");
        foundersWallet = _newWallet;
        emit FoundersWalletUpdated(_newWallet);
    }

    /**
     * @notice Actualiza la raíz de Merkle para el ciclo de pagos actual.
     * @dev Solo el Owner puede ejecutar. El backend calcula la Cascada de Pagos
     * (Prioridad Humanitaria -> Visionarios -> Pioneros -> Guardianes),
     * genera el árbol de Merkle y sube la raíz aquí.
     * @param _merkleRoot Nueva raíz criptográfica del árbol de derechos de cobro.
     */
    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        currentMerkleRoot = _merkleRoot;
        emit MerkleRootUpdated(_merkleRoot);
    }

    /**
     * @notice Reinicia el estado de cobro para un lote de usuarios (nuevo ciclo mensual).
     * @dev Solo el Owner puede ejecutar. Limitado a MAX_RESET_BATCH (200) por llamada
     * para prevenir ataques de DoS por exceso de gas en el bloque.
     * @param users Array de direcciones cuyos estados de cobro serán reiniciados.
     */
    function resetClaims(address[] calldata users) external onlyOwner {
        // SEGURIDAD: Limitar tamaño del array para prevenir DoS por gas.
        require(users.length <= MAX_RESET_BATCH, "Treasury: Batch too large (max 200)");
        
        // Reiniciar el estado de cobro de cada dirección.
        for (uint256 i = 0; i < users.length; i++) {
            hasClaimed[users[i]] = false;
        }
        
        // Registro auditable de la cantidad de resets ejecutados.
        emit ClaimsReset(users.length);
    }

    /**
     * @notice Pausa los reclamos de la Tesorería en caso de emergencia.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Reanuda los reclamos de la Tesorería tras resolver la emergencia.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ========================================================================
    // FUNCIÓN PRINCIPAL: RECLAMO DE IOU -> BLUE (Merkle Claim)
    // ========================================================================

    /**
     * @notice Permite a un Impulsor reclamar sus BLUE.
     * @dev Con EIP-7702, msg.sender ES el usuario real (la transacción
     * es patrocinada por el Relayer, pero msg.sender apunta al EOA del usuario).
     *
     * Ejecuta el patrón Check-Effects-Interactions:
     * 1. CHECK: Verifica que no haya cobrado, que la raíz exista y la prueba sea válida.
     * 2. EFFECTS: Marca al usuario como "ya cobró" ANTES de transferir.
     * 3. INTERACTIONS: Transfiere los tokens BLUE al usuario.
     *
     * SEGURIDAD: Usa doble hashing (keccak256(bytes.concat(keccak256(abi.encode(...)))))
     * para prevenir colisiones de segundo preimagen en el árbol de Merkle.
     *
     * @param amount Cantidad de BLUE que el usuario tiene derecho a reclamar.
     * @param merkleProof Prueba criptográfica de inclusión en el árbol de Merkle.
     */
    function claim(uint256 amount, bytes32[] calldata merkleProof) external nonReentrant whenNotPaused {
        // Con EIP-7702, msg.sender ES la dirección real del usuario.
        address user = msg.sender;
        
        // --- BLOQUE CHECK ---

        // SEGURIDAD: No permitir doble cobro en el mismo ciclo.
        require(!hasClaimed[user], "Treasury: Already claimed this month");

        // SEGURIDAD: La raíz de Merkle debe estar activa.
        require(currentMerkleRoot != bytes32(0), "Treasury: Merkle root not set");

        // SEGURIDAD: El monto debe ser positivo.
        require(amount > 0, "Treasury: Amount must be greater than 0");

        // Construir la "hoja" del árbol de Merkle con doble hashing (estándar OpenZeppelin).
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(user, amount))));

        // Verificar criptográficamente que esta hoja pertenece al árbol autorizado.
        require(MerkleProof.verify(merkleProof, currentMerkleRoot, leaf), 
            "Treasury: Invalid Merkle Proof");

        // SEGURIDAD: Verificar que la bóveda tiene suficiente liquidez.
        require(blueToken.balanceOf(address(this)) >= amount, 
            "Treasury: Insufficient liquidity");

        // --- BLOQUE EFFECTS (Estado se actualiza ANTES de la transferencia) ---

        // Marcar como cobrado ANTES de transferir (Patrón CEI: previene reentrada).
        hasClaimed[user] = true;

        // --- BLOQUE INTERACTIONS (Interacción externa DESPUÉS de actualizar estado) ---

        // Transferir los tokens BLUE reales a la billetera del Impulsor.
        require(blueToken.transfer(user, amount), "Treasury: Transfer failed");

        // Registro auditable del reclamo exitoso.
        emit ClaimSuccessful(user, amount);
    }

    // ========================================================================
    // FUNCIÓN DE RETIRO DE EXCEDENTES (Solo Owner)
    // ========================================================================

    /**
     * @notice Retira excedentes de ganancias a la billetera de los fundadores.
     * @dev Solo el Owner puede ejecutar. Solo debe usarse DESPUÉS de que todos
     * los Impulsores del ciclo hayan tenido oportunidad de reclamar.
     * @param amount Cantidad de BLUE a retirar como ganancia neta.
     */
    function withdrawSurplus(uint256 amount) external onlyOwner nonReentrant {
        // SEGURIDAD: La billetera fundadora debe estar configurada.
        require(foundersWallet != address(0), "Treasury: Founders wallet not set");

        // SEGURIDAD: Debe haber fondos suficientes para el retiro.
        require(blueToken.balanceOf(address(this)) >= amount, "Treasury: Insufficient funds");
        
        // Transferir los excedentes a la billetera fundadora.
        require(blueToken.transfer(foundersWallet, amount), "Treasury: Transfer failed");

        // Registro auditable del retiro ejecutado.
        emit SurplusWithdrawn(foundersWallet, amount);
    }
}
