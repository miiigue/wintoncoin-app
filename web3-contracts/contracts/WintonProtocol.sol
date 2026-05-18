// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

// ============================================================================
// INTERFACES: Contratos externos con los que interactúa el Motor Central.
// ============================================================================

/// @dev Interfaz mínima del token BLUE para mintear, quemar y consultar saldo.
interface IBlueToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

/// @dev Interfaz mínima del token RED para mintear deuda, quemar deuda y consultar saldo.
interface IRedToken {
    function mintDebt(address to, uint256 amount) external;
    function burnDebt(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title WintonProtocol (El Motor Central del Ecosistema)
 * @author WintonCoin Protocol Team
 * @notice Implementa las Leyes Económicas de Creación y Destrucción Simultánea
 * (Materia-Antimateria), el Muro KYC On-Chain y el sistema de pausa de emergencia.
 *
 * @dev ARQUITECTURA EIP-7702 (Pectra / Isthmus):
 * Este contrato está diseñado para funcionar con EIP-7702 en Optimism.
 * A diferencia de ERC-2771, NO necesita un Trusted Forwarder ni overrides
 * de _msgSender(). Con EIP-7702, el Relayer (backend) envía transacciones
 * patrocinadas donde msg.sender ya es la identidad real del usuario.
 *
 * El Relayer es una dirección autorizada que actúa como intermediario:
 * - Valida los límites de crédito (WTS Score) en el backend.
 * - Verifica la firma del usuario mediante EIP-7702.
 * - Envía la transacción a la blockchain pagando el gas.
 * - Pasa la dirección del pagador como parámetro verificado.
 *
 * SEGURIDAD IMPLEMENTADA:
 * - ReentrancyGuard en processPayment (previene ataques de bucle infinito).
 * - Pausable (permite detener el protocolo si se detecta una vulnerabilidad).
 * - onlyRelayerOrOwner (impide que usuarios salten las validaciones del backend).
 * - Validación de dirección cero en toda configuración.
 * - Validación payer != payee (previene auto-pagos inflacionarios).
 * - Validación de treasury configurado antes de procesar pagos.
 * - Cap de comisión máxima al 50% (previene errores de configuración destructivos).
 * - Circuit Breaker: límite máximo por transacción individual.
 * - Eventos en todas las funciones de estado para trazabilidad completa.
 */
contract WintonProtocol is Ownable, ReentrancyGuard, Pausable {

    // ========================================================================
    // ESTADO: Variables que definen el estado del protocolo.
    // ========================================================================

    /// @notice Referencia al contrato del token BLUE (activo líquido).
    IBlueToken public blueToken;

    /// @notice Referencia al contrato del token RED (registro de deuda).
    IRedToken public redToken;

    /// @notice Dirección del contrato WintonTreasury (bóveda de comisiones).
    address public treasury;

    /// @notice Dirección del Relayer autorizado (backend que paga gas vía EIP-7702).
    address public relayer;

    /// @notice Tasa de comisión actual en porcentaje (ej: 5 = 5%).
    uint256 public commissionRate = 5;

    /// @notice Límite máximo de tokens por transacción individual (previene errores catastróficos).
    /// @dev Valor inicial: 1,000,000 BLUE (en wei = 1e24). Ajustable por el Owner.
    uint256 public maxTransactionAmount = 1_000_000 * 1e18;

    /// @notice Muro KYC On-Chain: solo billeteras verificadas pueden operar.
    mapping(address => bool) public isKYCVerified;

    // ========================================================================
    // EVENTOS: Registro inmutable en la blockchain para auditoría total.
    // ========================================================================

    /// @notice Emitido cuando se procesa un pago exitosamente.
    event PaymentProcessed(
        address indexed payer,    // Quien paga (recibe deuda RED).
        address indexed payee,    // Quien recibe (recibe BLUE líquido).
        uint256 amountBlue,       // Monto neto pagado al beneficiario.
        uint256 fee               // Monto de comisión enviado a la Tesorería.
    );

    /// @notice Emitido cuando se ejecuta la auto-amortización (Materia-Antimateria).
    event AutoAmortization(
        address indexed user,     // El usuario cuyo BLUE y RED fueron quemados.
        uint256 amountBurned      // Cantidad simultánea destruida de cada token.
    );

    /// @notice Emitido cuando el Owner actualiza las direcciones de los contratos.
    event ContractsUpdated(address blue, address red, address treasuryAddr);

    /// @notice Emitido cuando el Owner actualiza el estado KYC de una billetera.
    event KYCStatusUpdated(address indexed wallet, bool status);

    /// @notice Emitido cuando el Owner modifica la tasa de comisión.
    event CommissionRateUpdated(uint256 oldRate, uint256 newRate);

    /// @notice Emitido cuando el Owner modifica el límite máximo por transacción.
    event MaxTransactionAmountUpdated(uint256 oldAmount, uint256 newAmount);

    /// @notice Emitido cuando el Owner cambia la dirección del Relayer.
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * @notice Inicializa el protocolo. El deployer es Owner y Relayer inicial.
     * @dev Con EIP-7702, no se necesita Trusted Forwarder. El Relayer es la
     * billetera del backend que patrocina las transacciones de los usuarios.
     * @param _relayer Dirección del Relayer (backend) que pagará el gas.
     */
    constructor(address _relayer) Ownable(msg.sender) {
        // SEGURIDAD: El Relayer debe ser una dirección válida.
        require(_relayer != address(0), "WintonProtocol: Invalid relayer address");
        relayer = _relayer;
        emit RelayerUpdated(address(0), _relayer);
    }

    /**
     * @notice BLOQUEADO. No se permite renunciar a la propiedad del contrato.
     * @dev Sobreescribe Ownable.renounceOwnership() para prevenir que el protocolo
     * quede permanentemente sin administrador. En su lugar, usar transferOwnership()
     * para migrar el control a un Gnosis Safe (multisig) en producción.
     */
    function renounceOwnership() public pure override {
        revert("WintonProtocol: Ownership renunciation is disabled");
    }

    // ========================================================================
    // MODIFICADOR DE SEGURIDAD: Solo Relayer o Owner
    // ========================================================================

    /**
     * @dev Restringe la ejecución a llamadas del Relayer (backend) o del Owner.
     * Esto impide que un usuario KYC verificado llame processPayment directamente
     * desde MetaMask, saltando las validaciones de crédito del backend (WTS Score).
     */
    modifier onlyRelayerOrOwner() {
        require(
            msg.sender == relayer || msg.sender == owner(),
            "WintonProtocol: Only Relayer or Owner"
        );
        _;
    }

    // ========================================================================
    // FUNCIONES DE CONFIGURACIÓN (Solo Owner)
    // ========================================================================

    /**
     * @notice Configura las direcciones de los contratos del ecosistema.
     * @dev Solo el Owner puede ejecutar. Todas las direcciones deben ser válidas.
     * @param _blue Dirección del contrato BlueToken desplegado.
     * @param _red Dirección del contrato RedToken desplegado.
     * @param _treasury Dirección del contrato WintonTreasury desplegado.
     */
    function setContracts(address _blue, address _red, address _treasury) external onlyOwner {
        // SEGURIDAD: Ninguna dirección puede ser cero (fondos irrecuperables).
        require(_blue != address(0) && _red != address(0) && _treasury != address(0), 
            "WintonProtocol: Invalid zero address");
        
        blueToken = IBlueToken(_blue);
        redToken = IRedToken(_red);
        treasury = _treasury;
        
        // Registro auditable de la configuración.
        emit ContractsUpdated(_blue, _red, _treasury);
    }

    /**
     * @notice Cambia la dirección del Relayer (backend que paga gas).
     * @dev Solo el Owner puede ejecutar. Útil si se rota la billetera del backend.
     * @param _newRelayer Nueva dirección del Relayer.
     */
    function setRelayer(address _newRelayer) external onlyOwner {
        require(_newRelayer != address(0), "WintonProtocol: Invalid zero address");
        emit RelayerUpdated(relayer, _newRelayer);
        relayer = _newRelayer;
    }

    /**
     * @notice Actualiza el estado KYC de una billetera en el Muro On-Chain.
     * @dev Solo el Owner puede ejecutar. Activa o desactiva la capacidad de
     * una billetera para participar en transacciones financieras.
     * @param _wallet Dirección de la billetera del usuario.
     * @param _status true = verificado (puede operar), false = bloqueado.
     */
    function setKYCStatus(address _wallet, bool _status) external onlyOwner {
        // SEGURIDAD: No permitir verificar la dirección cero.
        require(_wallet != address(0), "WintonProtocol: Invalid zero address");
        
        isKYCVerified[_wallet] = _status;
        
        // Registro auditable del cambio de estado KYC.
        emit KYCStatusUpdated(_wallet, _status);
    }

    /**
     * @notice Modifica la tasa de comisión porcentual de la plataforma.
     * @dev Solo el Owner puede ejecutar. Tiene un tope de seguridad del 50%.
     * Emite el evento ANTES de cambiar el valor para registrar el estado anterior.
     * @param _newRate Nueva tasa de comisión (ej: 5 = 5%, 10 = 10%).
     */
    function setCommissionRate(uint256 _newRate) external onlyOwner {
        // SEGURIDAD: Tope máximo para prevenir errores de configuración destructivos.
        require(_newRate <= 50, "WintonProtocol: Commission rate exceeds 50% safety cap");
        
        // Emitir evento con valor anterior y nuevo para auditoría comparativa.
        emit CommissionRateUpdated(commissionRate, _newRate);
        commissionRate = _newRate;
    }

    /**
     * @notice Modifica el límite máximo de tokens por transacción individual.
     * @dev Solo el Owner puede ejecutar. Actúa como un disyuntor (circuit breaker)
     * que previene que un error o un ataque pueda drenar cantidades catastróficas.
     * @param _newAmount Nuevo límite máximo (en wei, 18 decimales).
     */
    function setMaxTransactionAmount(uint256 _newAmount) external onlyOwner {
        require(_newAmount > 0, "WintonProtocol: Max amount must be greater than 0");
        emit MaxTransactionAmountUpdated(maxTransactionAmount, _newAmount);
        maxTransactionAmount = _newAmount;
    }

    /**
     * @notice Pausa todas las operaciones financieras del protocolo.
     * @dev Solo el Owner puede ejecutar. Usar en caso de emergencia de seguridad.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Reanuda las operaciones financieras del protocolo.
     * @dev Solo el Owner puede ejecutar después de resolver la emergencia.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ========================================================================
    // FUNCIÓN PRINCIPAL: PROCESAMIENTO DE PAGOS
    // ========================================================================

    /**
     * @notice Procesa un pago entre dos usuarios verificados (KYC).
     * @dev Esta es la función más crítica del ecosistema. Ejecuta atómicamente:
     * 1. Validaciones de seguridad (KYC, dirección, monto).
     * 2. Minteo simultáneo de BLUE (activo) y RED (deuda) - Regla Balance Cero.
     * 3. Envío de comisión a la Tesorería.
     * 4. Auto-Amortización automática vía el Vigilante de BlueToken._update().
     *
     * FLUJO EIP-7702:
     * El backend verifica la firma del usuario, valida sus límites de crédito,
     * y luego llama a esta función como Relayer. El payer se pasa como parámetro
     * porque con EIP-7702 el backend patrocina la transacción.
     *
     * PROTECCIONES ACTIVAS:
     * - onlyRelayerOrOwner: Solo el backend o el Owner pueden llamar.
     * - nonReentrant: Bloquea ataques de reentrada.
     * - whenNotPaused: Respeta el estado de pausa de emergencia.
     * - KYC verificado para ambas partes.
     * - payer != payee (previene auto-pagos inflacionarios).
     * - treasury debe estar configurado.
     * - Circuit Breaker: límite máximo por transacción.
     *
     * @param payer Dirección de la billetera del pagador (verificada por el backend).
     * @param payee Dirección de la billetera que recibirá el pago en BLUE.
     * @param amountBlue Monto neto a pagar (en wei, 18 decimales).
     */
    function processPayment(
        address payer, 
        address payee, 
        uint256 amountBlue
    ) external onlyRelayerOrOwner nonReentrant whenNotPaused {

        // --- BLOQUE DE VALIDACIONES DE SEGURIDAD ---

        // SEGURIDAD: Ambos participantes deben estar verificados en el Muro KYC.
        require(isKYCVerified[payer], "WintonProtocol: Payer KYC not verified");
        require(isKYCVerified[payee], "WintonProtocol: Payee KYC not verified");

        // SEGURIDAD: El monto debe ser mayor a cero (previene transacciones vacías).
        require(amountBlue > 0, "WintonProtocol: Amount must be greater than 0");

        // SEGURIDAD: No se permite pagarse a sí mismo (previene inflación artificial).
        require(payer != payee, "WintonProtocol: Cannot pay yourself");

        // SEGURIDAD: La Tesorería debe estar configurada antes de procesar pagos.
        require(treasury != address(0), "WintonProtocol: Treasury not configured");

        // SEGURIDAD: Circuit Breaker - limitar monto máximo por transacción.
        require(amountBlue <= maxTransactionAmount, "WintonProtocol: Amount exceeds max per transaction");

        // --- BLOQUE DE CÁLCULO ECONÓMICO ---

        // Calcular la comisión de la plataforma sobre el monto del pago.
        uint256 fee = (amountBlue * commissionRate) / 100;
        // La deuda total del pagador incluye el pago neto + la comisión.
        uint256 totalDebt = amountBlue + fee;

        // --- BLOQUE DE MINTEO SIMULTÁNEO (REGLA DE BALANCE CERO) ---

        // PASO 1: Se crea la deuda RED para el pagador (totalDebt = pago + comisión).
        redToken.mintDebt(payer, totalDebt);
        // PASO 2: Se crea BLUE líquido para el beneficiario (solo el monto neto).
        // NOTA: El Vigilante de BlueToken._update() ejecuta la auto-amortización
        // automáticamente si el beneficiario tiene deuda RED previa.
        blueToken.mint(payee, amountBlue);
        // PASO 3: Se crea BLUE líquido para la Tesorería (solo la comisión).
        blueToken.mint(treasury, fee);

        // Registro auditable del pago procesado.
        emit PaymentProcessed(payer, payee, amountBlue, fee);
    }

    // ========================================================================
    // FUNCIÓN PÚBLICA: PUERTA DE SERVICIO PARA EL VIGILANTE
    // ========================================================================

    /**
     * @notice Punto de entrada público para activar la auto-amortización.
     * @dev Esta función es llamada automáticamente por el Vigilante de BlueToken
     * cada vez que alguien recibe BLUE. También puede ser llamada manualmente
     * por cualquier persona (es inofensiva: solo destruye, nunca crea).
     *
     * NO tiene nonReentrant porque debe poder ejecutarse dentro de processPayment
     * (que ya tiene nonReentrant). Es segura porque _autoAmortize solo llama
     * a burn/burnDebt, que son funciones controladas sin callbacks peligrosos.
     *
     * @param user Dirección del usuario cuyo balance será verificado.
     */
    function triggerAutoAmortize(address user) external {
        _autoAmortize(user);
    }

    // ========================================================================
    // FUNCIÓN INTERNA: AUTO-AMORTIZACIÓN (Materia-Antimateria)
    // ========================================================================

    /**
     * @notice Destruye simultáneamente saldo BLUE y deuda RED si coexisten.
     * @dev Implementa la Regla 2 de las Leyes Económicas:
     * "Es algorítmicamente imposible que un usuario posea BLUE líquido y
     * deuda RED al mismo tiempo". Si ambos existen, se aniquilan mutuamente
     * en la cantidad del menor de los dos (min(BLUE, RED)).
     * @param user Dirección del usuario cuyo balance será verificado.
     */
    function _autoAmortize(address user) internal {
        // Consultar los saldos actuales del usuario en ambos tokens.
        uint256 blueBalance = blueToken.balanceOf(user);
        uint256 redBalance = redToken.balanceOf(user);

        // Solo ejecutar si ambos saldos son positivos (la materia toca la antimateria).
        if (blueBalance > 0 && redBalance > 0) {
            // Calcular el menor de los dos para la aniquilación proporcional.
            uint256 amountToBurn = blueBalance < redBalance ? blueBalance : redBalance;
            
            // Destruir simultáneamente el BLUE y el RED del usuario.
            blueToken.burn(user, amountToBurn);
            redToken.burnDebt(user, amountToBurn);

            // Registro auditable de la auto-amortización ejecutada.
            emit AutoAmortization(user, amountToBurn);
        }
    }
}
