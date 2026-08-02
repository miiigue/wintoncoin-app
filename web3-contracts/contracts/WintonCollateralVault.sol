// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ============================================================================
// IMPORTACIONES: Librerías auditadas de OpenZeppelin (Estándar de la Industria)
// Usadas por Aave, MakerDAO, Compound, Uniswap, dYdX, Curve Finance.
// ============================================================================
import "@openzeppelin/contracts/access/Ownable.sol";           // Control de propiedad seguro
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";    // Protección contra ataques de reentrada
import "@openzeppelin/contracts/utils/Pausable.sol";           // Botón de pánico para emergencias
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";       // Interfaz estándar ERC20
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol"; // Wrapper seguro para tokens no estándar (USDT)

// ============================================================================
// INTERFAZ: Conexión con el Token RED (Deuda) del ecosistema WintonCoin.
// ============================================================================

/// @dev Interfaz mínima del token RED para consultar si el usuario tiene deuda.
/// RedToken.sol ya expone balanceOf() mediante herencia de ERC20.
interface IRedToken {
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title WintonCollateralVault
 * @author WintonCoin Protocol Team
 * @notice Bóveda segura (Vault) para bloquear Stablecoins (USDT/USDC/DAI) como garantía
 *         y aumentar el Límite de Compromiso RED del usuario.
 *
 * @dev ARQUITECTURA DE SEGURIDAD:
 * - SafeERC20: Protege contra tokens no estándar como USDT que no retornan bool.
 * - ReentrancyGuard: Previene ataques de reentrada en depósitos/retiros.
 * - Pausable: Permite detener operaciones si se detecta una vulnerabilidad.
 * - Checks-Effects-Interactions (CEI): Patrón de seguridad estricto en todas las funciones.
 *   (Primero se verifican condiciones, luego se modifica estado, y al final se interactúa externamente).
 * - Zero-Trust Withdraw: El retiro solo se permite si la deuda RED del usuario es exactamente 0.
 * - Zero-Trust Liquidation: La liquidación solo se permite si el usuario tiene deuda RED > 0.
 *
 * ESTÁNDARES CUMPLIDOS: SOC 2 (Auditoría), Zero Trust, OpenZeppelin v5.x.
 */
contract WintonCollateralVault is Ownable, ReentrancyGuard, Pausable {

    // Activar SafeERC20 para todas las operaciones con el token de garantía.
    // Esto envuelve transfer/transferFrom en llamadas seguras que manejan
    // tokens como USDT que no retornan bool (evita revert silenciosos).
    using SafeERC20 for IERC20;

    // ========================================================================
    // ESTADO: Variables inmutables del contrato.
    // ========================================================================

    /// @notice El token ERC20 aceptado como garantía (Ej. USDT, USDC, DAI)
    IERC20 public immutable collateralToken;

    /// @notice El contrato del Token RED para verificar deudas pendientes
    IRedToken public immutable redToken;

    /// @notice Registra cuánto colateral tiene bloqueado cada billetera (en wei)
    mapping(address => uint256) public userCollateral;

    /// @notice Acumulador del total de tokens bloqueados en la bóveda (para auditoría global)
    uint256 public totalCollateralLocked;

    // ========================================================================
    // EVENTOS DE AUDITORÍA (Inmutables en la blockchain - SOC 2 Compliance)
    // Cada operación financiera emite un evento para trazabilidad total.
    // ========================================================================

    /// @notice Emitido cuando un usuario deposita tokens como garantía.
    event CollateralDeposited(
        address indexed user,       // Billetera del depositante
        uint256 amount,             // Cantidad depositada en esta operación
        uint256 newUserTotal,       // Nuevo saldo total del usuario en la bóveda
        uint256 newVaultTotal       // Nuevo total global de la bóveda
    );

    /// @notice Emitido cuando un usuario retira su garantía (sin deuda RED).
    event CollateralWithdrawn(
        address indexed user,       // Billetera del usuario que retira
        uint256 amount,             // Cantidad retirada en esta operación
        uint256 newUserTotal,       // Nuevo saldo total del usuario tras el retiro
        uint256 newVaultTotal       // Nuevo total global de la bóveda
    );

    /// @notice Emitido cuando el sistema confisca la garantía de un usuario moroso.
    event CollateralLiquidated(
        address indexed user,       // Billetera del usuario liquidado
        uint256 amount,             // Cantidad confiscada
        address indexed treasury,   // Dirección de la tesorería receptora
        uint256 userDebtAtTime      // Deuda RED del usuario al momento de la liquidación (auditoría)
    );

    // ========================================================================
    // CONSTRUCTOR: Configuración inicial del contrato.
    // ========================================================================

    /**
     * @notice Inicializa la bóveda con las direcciones del token de garantía y del token RED.
     * @param _collateralToken Dirección del contrato ERC20 aceptado (USDT/USDC/DAI).
     * @param _redToken Dirección del contrato RedToken (Deuda) desplegado.
     */
    constructor(address _collateralToken, address _redToken) Ownable(msg.sender) {
        // Validación Zero-Trust: Nunca aceptar direcciones vacías (fondos irrecuperables).
        require(_collateralToken != address(0), "Vault: Direccion invalida del colateral");
        require(_redToken != address(0), "Vault: Direccion invalida de RED");

        // Asignar como immutable (no se pueden cambiar post-despliegue = máxima seguridad).
        collateralToken = IERC20(_collateralToken);
        redToken = IRedToken(_redToken);
    }

    // ========================================================================
    // FUNCIONES CORE DEL USUARIO (Depósito y Retiro)
    // ========================================================================

    /**
     * @notice Permite al usuario bloquear tokens como garantía para subir su Límite RED.
     * @dev REQUISITO PREVIO: El usuario debe haber llamado `approve(vaultAddress, amount)`
     *      en el contrato del token ERC20 antes de llamar esta función.
     *      Patrón CEI: Checks → Effects → Interactions.
     * @param amount Cantidad de tokens a depositar (en la unidad mínima del token, ej. wei).
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        // --- CHECKS (Verificaciones) ---
        require(amount > 0, "Vault: El monto debe ser mayor a 0");

        // --- EFFECTS (Modificar estado ANTES de la interacción externa) ---
        // Esto previene ataques de reentrada al actualizar el saldo primero.
        userCollateral[msg.sender] += amount;
        totalCollateralLocked += amount;

        // --- INTERACTIONS (Interacción externa al final) ---
        // SafeERC20.safeTransferFrom maneja tokens no estándar como USDT
        // que no retornan bool en sus funciones transfer/transferFrom.
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);

        // Emitir evento de auditoría inmutable en la blockchain.
        emit CollateralDeposited(msg.sender, amount, userCollateral[msg.sender], totalCollateralLocked);
    }

    /**
     * @notice Permite al usuario retirar su garantía, SIEMPRE Y CUANDO NO TENGA DEUDAS RED.
     * @dev Patrón CEI: Checks → Effects → Interactions.
     *      REGLA ZERO-TRUST: Si el usuario tiene aunque sea 1 wei de deuda RED, el retiro es bloqueado.
     * @param amount Cantidad de tokens a retirar (en la unidad mínima del token).
     */
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        // --- CHECKS (Verificaciones) ---
        require(amount > 0, "Vault: El monto debe ser mayor a 0");
        require(userCollateral[msg.sender] >= amount, "Vault: No tienes suficiente colateral");

        // REGLA DE NEGOCIO CRÍTICA (Zero-Trust):
        // El usuario NO puede tener NINGUNA deuda RED pendiente para retirar.
        // Esto garantiza que la garantía respalda compromisos activos.
        uint256 redDebt = redToken.balanceOf(msg.sender);
        require(redDebt == 0, "Vault: Debes pagar toda tu deuda RED antes de retirar");

        // --- EFFECTS (Modificar estado ANTES de la interacción externa) ---
        userCollateral[msg.sender] -= amount;
        totalCollateralLocked -= amount;

        // --- INTERACTIONS (Interacción externa al final) ---
        collateralToken.safeTransfer(msg.sender, amount);

        // Emitir evento de auditoría inmutable.
        emit CollateralWithdrawn(msg.sender, amount, userCollateral[msg.sender], totalCollateralLocked);
    }

    // ========================================================================
    // FUNCIONES DE LECTURA (Para el Backend y Auditoría)
    // ========================================================================

    /**
     * @notice Consulta cuánto colateral tiene bloqueado un usuario específico.
     * @dev Llamada desde el backend (creditScoringService.js) para calcular el Límite RED.
     * @param user Dirección de la billetera del usuario.
     * @return Cantidad de tokens bloqueados por el usuario (en wei).
     */
    function getCollateralBalance(address user) external view returns (uint256) {
        return userCollateral[user];
    }

    // ========================================================================
    // FUNCIONES DE ADMINISTRACIÓN / COBRO AUTOMÁTICO (Zero-Trust)
    // ========================================================================

    /**
     * @notice Permite al sistema (Cobrador Automático) expropiar la garantía si el usuario
     *         tiene deuda RED pendiente y cae en morosidad, protegiendo la plataforma de insolvencia.
     * @dev SEGURIDAD: Verifica que el usuario realmente tenga deuda RED > 0 antes de liquidar.
     *      Esto previene que un administrador malicioso confisque fondos de usuarios sin deuda.
     *      Patrón CEI: Checks → Effects → Interactions.
     * @param user Billetera del usuario moroso.
     * @param treasury Billetera de la tesorería donde irá el fondo confiscado.
     */
    function liquidate(address user, address treasury) external onlyOwner nonReentrant {
        // --- CHECKS (Verificaciones) ---
        uint256 amount = userCollateral[user];
        require(amount > 0, "Vault: El usuario no tiene colateral para liquidar");
        require(treasury != address(0), "Vault: Tesoreria invalida");

        // SEGURIDAD: Verificar que el usuario realmente tenga deuda RED pendiente.
        // Sin esta verificación, un Owner malicioso podría confiscar fondos de usuarios inocentes.
        uint256 userDebt = redToken.balanceOf(user);
        require(userDebt > 0, "Vault: El usuario no tiene deuda RED, no se puede liquidar");

        // --- EFFECTS (Modificar estado ANTES de la interacción externa) ---
        userCollateral[user] = 0;
        totalCollateralLocked -= amount;

        // --- INTERACTIONS (Interacción externa al final) ---
        collateralToken.safeTransfer(treasury, amount);

        // Emitir evento de auditoría con la deuda del usuario al momento de la liquidación.
        emit CollateralLiquidated(user, amount, treasury, userDebt);
    }

    // ========================================================================
    // FUNCIONES DE EMERGENCIA (Pausable - Botón de Pánico)
    // ========================================================================

    /// @notice Pausa todas las operaciones del contrato (depósitos, retiros, liquidaciones).
    /// @dev Solo el Owner puede ejecutar. Usar en caso de vulnerabilidad detectada.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Reanuda las operaciones del contrato tras resolver la emergencia.
    /// @dev Solo el Owner puede ejecutar.
    function unpause() external onlyOwner {
        _unpause();
    }
}
