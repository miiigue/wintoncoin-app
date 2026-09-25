// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./interfaces/IAmortizationVault.sol";

/**
 * @title FifoExchange
 * @notice Fixed-Rate 1:1 FIFO Matching Exchange entre BLUE y USDT (ambos a 6 decimales).
 * @dev Implementación conforme a la especificación formal V3.3.6 con contabilidad de doble entrada,
 * almacenamiento compacto de 3 slots por orden, guardas explícitas de desbordamiento,
 * timelock estricto de 48 horas sin concurrencia. FifoExchange no posee dependencia directa
 * de RED ni de CoreProtocol. El comportamiento interno de los ERC-20 utilizados constituye una
 * dependencia externa de integración y debe respetar las hipótesis de custodia del Exchange.
 *
 * HIPÓTESIS Y SUPUESTOS DE INTEGRACIÓN ERC-20:
 * 1. Tokens Estándar: Se asume que BLUE y USDT se comportan estrictamente como ERC-20 estándar:
 *    - Transferencias y custodia verificada: Para depósitos, balanceOf(exchange)_posterior - balanceOf(exchange)_previo == amount,
 *      comprobado on-chain en cada creación de orden. Para salidas, el Exchange transfiere exactamente el monto neto derivado.
 *    - Cero fee-on-transfer / cero quema deflacionaria en transferencia.
 *    - Saldos no rebasables (inmutabilidad de saldo almacenado).
 *    - Ambas direcciones deben validarse con decimals() == 6 y code.length > 0 antes de deployment.
 * 2. Dominio de Colas y Head Indexes:
 *    - El dominio físico de las órdenes está acotado por type(uint64).max. Cada orden creada
 *      incrementa nextOrderId, impidiendo desbordamiento en blueOrderIds o usdtOrderIds.
 */
interface IExchangeCoreKYC {
    function isKYCVerified(address user) external view returns (bool);
    function settleMatured(address user) external;
    function paused() external view returns (bool);
}
interface ILinkedVault { function coreProtocol() external view returns (address); }

contract FifoExchange is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // =========================================================================
    // TIPOS Y ESTRUCTURAS DE DATOS
    // =========================================================================

    enum OrderStatus {
        NONE,             // 0: Orden inexistente / clave vacía en storage (o.id == 0)
        OPEN,             // 1: Orden activa sin cruces
        PARTIALLY_FILLED, // 2: Orden activa con ejecuciones parciales y saldo remanente
        FILLED,           // 3: Orden ejecutada al 100% (Estado terminal)
        CANCELLED,        // 4: Cancelled; may have a refund held in custody
        SUSPENDED         // 5: Cannot execute; user may cancel or rejoin FIFO
    }

    enum OrderSide {
        BLUE_FOR_USDT,    // 0: Usuario deposita BLUE y solicita USDT
        USDT_FOR_BLUE     // 1: Usuario deposita USDT y solicita BLUE
    }

    /**
     * @dev Estructura de almacenamiento empaquetada estrictamente en 3 slots de 32 bytes (96 bytes en total).
     *
     * Fórmula de derivación de executedAmount (on-the-fly):
     * - Para órdenes activas o finalizadas (OPEN, PARTIALLY_FILLED, FILLED):
     *     executedAmount = originalAmount - remainingAmount
     * - Para órdenes canceladas (CANCELLED):
     *     executedAmount = originalAmount - refundedAmount
     *
     * originalAmount es inmutable tras su creación. refundedAmount solo se escribe al cancelar,
     * garantizando cero impacto de gas en el motor de matching.
     */
    struct Order {
        // SLOT 0: 64 + 64 + 128 = 256 bits (32 bytes exactos)
        uint64 id;               // Identificador único secuencial de la orden (> 0)
        uint64 sequenceId;       // Posición global FIFO monótona en la cola
        uint128 remainingAmount; // Saldo pendiente de ejecución en unidades base (6 decimales)

        // SLOT 1: 160 + 8 + 8 + 48 = 224 bits (32 bytes con 32 bits de padding reservado)
        address user;            // Dirección del usuario creador de la orden
        OrderStatus status;      // Estado operativo (OPEN, PARTIALLY_FILLED, FILLED, CANCELLED)
        OrderSide side;          // Lado de la orden (BLUE_FOR_USDT o USDT_FOR_BLUE)
        uint48 createdAt;        // Timestamp block.timestamp de creación

        // SLOT 2: 128 + 128 = 256 bits (32 bytes exactos)
        uint128 originalAmount;  // Monto base depositado originalmente (inmutable tras creación)
        uint128 refundedAmount;  // Monto reembolsado en caso de cancelación (0 si no fue cancelada)
    }

    // =========================================================================
    // CONSTANTES INMUTABLES
    // =========================================================================

    address public amortizationVault;
    address public coreProtocol;
    mapping(uint64 => bool) public isAmortizationOrder;
    event AmortizationVaultSet(address indexed vault, address indexed core);
    event OrderReduced(uint64 indexed orderId, uint128 refunded, uint128 remaining);

    event OrderSuspended(uint64 indexed orderId, uint8 reason);
    event OrderResumed(uint64 indexed orderId, uint64 oldSequence, uint64 newSequence);
    event RefundHeld(address indexed user, uint128 blue, uint128 usdt);
    event PendingRefundClaimed(address indexed user, uint128 blue, uint128 usdt);
    mapping(address => uint128) public pendingRefundBlue;
    mapping(address => uint128) public pendingRefundUsdt;
    uint128 public totalPendingRefundBlue;
    uint128 public totalPendingRefundUsdt;

    function _suspend(Order storage order, uint8 reason) private {
        order.status = OrderStatus.SUSPENDED;
        emit OrderSuspended(order.id, reason);
    }
    function resumeOrder(uint64 id) external nonReentrant whenNotPaused {
        Order storage order = orders[id];
        require(order.user == msg.sender, "Exchange: Only order user");
        require(order.status == OrderStatus.SUSPENDED, "Exchange: Order not suspended");
        _requireKYC(msg.sender);
        if (nextSequenceId == type(uint64).max) revert SequenceIdOverflow();
        uint64 previous = order.sequenceId;
        order.sequenceId = nextSequenceId++;
        order.status = order.originalAmount == order.remainingAmount ? OrderStatus.OPEN : OrderStatus.PARTIALLY_FILLED;
        if (order.side == OrderSide.BLUE_FOR_USDT) blueOrderIds.push(id);
        else usdtOrderIds.push(id);
        emit OrderResumed(id, previous, order.sequenceId);
    }
    function claimPendingRefunds() external nonReentrant {
        _requireKYC(msg.sender);
        uint128 blue = pendingRefundBlue[msg.sender];
        uint128 usdt = pendingRefundUsdt[msg.sender];
        require(blue > 0 || usdt > 0, "Exchange: No pending refund");
        // A Core pause must not hold an independently withdrawable USDT refund.
        if (blue > 0 && !_canReturnBlue(msg.sender)) blue = 0;
        require(blue > 0 || usdt > 0, "Exchange: BLUE refund awaits Core");
        pendingRefundBlue[msg.sender] -= blue; pendingRefundUsdt[msg.sender] = 0;
        totalPendingRefundBlue -= blue; totalPendingRefundUsdt -= usdt;
        if (blue > 0) _returnBlue(msg.sender, blue);
        if (usdt > 0) usdtToken.safeTransfer(msg.sender, usdt);
        emit PendingRefundClaimed(msg.sender, blue, usdt);
    }
    function _returnBlue(address user, uint128 amount) private {
        blueToken.safeTransfer(user, amount);
        // Returned custody is once again available for overdue commitments.
        if (coreProtocol != address(0)) IExchangeCoreKYC(coreProtocol).settleMatured(user);
    }
    function _canReturnBlue(address user) private view returns (bool) {
        return _isKYCVerified(user) && (coreProtocol == address(0) || !IExchangeCoreKYC(coreProtocol).paused());
    }
    function setAmortizationVault(address vault) external onlyOwner {
        require(amortizationVault == address(0) && vault.code.length > 0, "Exchange: Invalid vault");
        address core = ILinkedVault(vault).coreProtocol();
        require(core.code.length > 0, "Exchange: Invalid core");
        amortizationVault = vault;
        coreProtocol = core;
        emit AmortizationVaultSet(vault, core);
    }

    function createAmortizationOrder(address user, uint128 amount) external nonReentrant whenNotPaused returns (uint64 id) {
        require(msg.sender == amortizationVault, "Exchange: Only vault");
        id = _createOrderFor(OrderSide.USDT_FOR_BLUE, amount, user, msg.sender);
        isAmortizationOrder[id] = true;
    }

    function _requireKYC(address user) private view {
        // Standalone V3.3.6 tests may run without the V4 link. The V4 deployment
        // must configure the immutable integration before accepting users.
        if (coreProtocol != address(0)) require(IExchangeCoreKYC(coreProtocol).isKYCVerified(user), "Exchange: KYC not verified");
    }

    function _isKYCVerified(address user) private view returns (bool) {
        if (coreProtocol == address(0)) return true;
        return IExchangeCoreKYC(coreProtocol).isKYCVerified(user);
    }

    IERC20 public immutable blueToken;
    IERC20 public immutable usdtToken;

    uint16 public constant MAX_FEE_BPS = 500;                // 500 BPS = 5.00% tope absoluto
    uint128 public constant MIN_ORDER_AMOUNT = 1_000_000;    // 1 token completo (6 decimales)
    uint48 public constant TIMELOCK_DELAY = 48 hours;       // 48 horas exactas
    uint48 public constant TIMELOCK_GRACE_PERIOD = 7 days;  // 7 días de ventana tras desbloqueo

    // =========================================================================
    // VARIABLES DE ESTADO Y CONTABILIDAD DE DOBLE ENTRADA
    // =========================================================================

    // Contadores de identificación y punteros de cola FIFO
    uint64 public nextOrderId = 1;      // Comienza en 1 para que id > 0 identifique órdenes creadas
    uint64 public nextSequenceId = 1;   // Secuencia global monotónica de prelación FIFO
    uint64 public matchId = 1;          // Identificador correlativo global de cruces bilaterales
    uint64 public blueHeadIndex;        // Índice de cabeza de cola BLUE_FOR_USDT
    uint64 public usdtHeadIndex;        // Índice de cabeza de cola USDT_FOR_BLUE

    // Colas dinámicas de identificadores de órdenes
    uint64[] public blueOrderIds;
    uint64[] public usdtOrderIds;

    // Repositorio principal de órdenes
    mapping(uint64 => Order) public orders;

    // Contabilidad de Doble Entrada (Packed Slots uint128 + uint128)
    // Slot 1: Reservas y Comisiones Acumuladas BLUE
    uint128 public totalReservedBlue;
    uint128 public accumulatedFeesBlue;

    // Slot 2: Reservas y Comisiones Acumuladas USDT
    uint128 public totalReservedUsdt;
    uint128 public accumulatedFeesUsdt;

    // Slot 3: Depósitos Históricos Acumulados
    uint128 public totalDepositedBlue;
    uint128 public totalDepositedUsdt;

    // Slot 4: Volumen Bruto Emparejado
    uint128 public totalMatchedGrossBlue;
    uint128 public totalMatchedGrossUsdt;

    // Slot 5: Reembolsos por Cancelación
    uint128 public totalRefundedBlue;
    uint128 public totalRefundedUsdt;

    // Slot 6: Comisiones Totales Generadas Históricamente
    uint128 public totalFeesGeneratedBlue;
    uint128 public totalFeesGeneratedUsdt;

    // Slot 7: Comisiones Totales Reclamadas Históricamente
    uint128 public totalFeesClaimedBlue;
    uint128 public totalFeesClaimedUsdt;

    // Gobernanza y Comisiones Activas
    uint16 public feeBps;             // Comisión activa (0 a 500 BPS)
    address public treasury;           // Dirección receptora institucional de comisiones

    // Slots Dedicados de Timelock (Máximo 1 propuesta pendiente por parámetro)
    uint16 public pendingFeeBps;
    uint48 public feeUnlockTimestamp;

    address public pendingTreasury;
    uint48 public treasuryUnlockTimestamp;

    // =========================================================================
    // EVENTOS AUDITABLES
    // =========================================================================

    event OrderCreated(
        uint64 indexed orderId,
        address indexed user,
        OrderSide indexed side,
        uint128 originalAmount,
        uint64 sequenceId,
        uint48 createdAt,
        uint256 createdBlock
    );

    event OrderMatched(
        uint64 indexed matchId,
        uint64 indexed blueOrderId,
        uint64 indexed usdtOrderId,
        uint128 grossAmount,
        uint128 feeBlue,
        uint128 feeUsdt,
        uint128 netBlueTransferredByExchange,
        uint128 netUsdtTransferredByExchange
    );

    event OrderCancelled(
        uint64 indexed orderId,
        address indexed user,
        uint128 refundedAmount
    );

    event FeeProposalCreated(uint16 proposedFeeBps, uint48 unlockTimestamp);
    event FeeProposalExecuted(uint16 oldFeeBps, uint16 newFeeBps);
    event FeeProposalCancelled(uint16 cancelledFeeBps);

    event TreasuryProposalCreated(address proposedTreasury, uint48 unlockTimestamp);
    event TreasuryProposalExecuted(address oldTreasury, address newTreasury);
    event TreasuryProposalCancelled(address cancelledTreasury);

    event FeesClaimed(address indexed treasury, uint128 blueFees, uint128 usdtFees);
    event ForeignTokenRescued(address indexed token, address indexed to, uint256 amount);

    // =========================================================================
    // ERRORES PERSONALIZADOS (CUSTOM ERRORS)
    // =========================================================================

    error ZeroAddress();
    error IdenticalTokens();
    error InvalidDecimals();
    error FeeExceedsMax();
    error InvalidContractCode();
    error OrderAmountTooLow();
    error OrderNotFound();
    error Unauthorized();
    error OrderNotCancellable();
    error FeeProposalAlreadyPending();
    error NoPendingFeeProposal();
    error TimelockNotExpired();
    error ProposalExpired();
    error TreasuryProposalAlreadyPending();
    error NoPendingTreasuryProposal();
    error InvalidTreasuryAddress();
    error CannotRescuePairToken();
    error InsufficientContractReserve();
    error InsufficientContractFees();
    error DepositAmountMismatch(uint256 expected, uint256 received);
    error InvalidMatchAmount();
    error RenounceOwnershipDisabled();
    error OrderIdOverflow();
    error SequenceIdOverflow();
    error MatchIdOverflow();
    error HeadIndexOverflow();
    error TimestampOverflow();
    error CounterOverflow(bytes32 counterName);

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    /**
     * @notice Inicializa el contrato Exchange con paridad 1:1 entre BLUE y USDT.
     * @param _blue Dirección del token BLUE con 6 decimales.
     * @param _usdt Dirección del token USDT con 6 decimales.
     * @param _treasury Dirección institucional receptora de comisiones.
     * @param _initialFeeBps Comisión inicial en puntos básicos (<= 500).
     */
    constructor(
        address _blue,
        address _usdt,
        address _treasury,
        uint16 _initialFeeBps
    ) Ownable(msg.sender) {
        if (_blue == address(0) || _usdt == address(0) || _treasury == address(0)) revert ZeroAddress();
        if (_blue == _usdt) revert IdenticalTokens();
        if (
            _treasury == address(this) ||
            _treasury == _blue ||
            _treasury == _usdt
        ) revert InvalidTreasuryAddress();
        if (_blue.code.length == 0 || _usdt.code.length == 0) revert InvalidContractCode();
        if (IERC20Metadata(_blue).decimals() != 6 || IERC20Metadata(_usdt).decimals() != 6) revert InvalidDecimals();
        if (_initialFeeBps > MAX_FEE_BPS) revert FeeExceedsMax();

        blueToken = IERC20(_blue);
        usdtToken = IERC20(_usdt);
        treasury = _treasury;
        feeBps = _initialFeeBps;
    }

    // =========================================================================
    // FUNCIONES PRINCIPALES DE CREACIÓN DE ÓRDENES
    // =========================================================================

    /**
     * @notice Crea una orden de venta de BLUE a cambio de USDT a tasa fija 1:1.
     * @param amount Cantidad de BLUE a depositar (mínimo 1e6 micro-unidades = 1.0 BLUE).
     * @return newOrderId Identificador único asignado a la orden.
     */
    function createBlueOrder(uint128 amount) external nonReentrant whenNotPaused returns (uint64 newOrderId) {
        if (coreProtocol != address(0)) IExchangeCoreKYC(coreProtocol).settleMatured(msg.sender);
        newOrderId = _createOrder(OrderSide.BLUE_FOR_USDT, amount);
    }

    /**
     * @notice Crea una orden de venta de USDT a cambio de BLUE a tasa fija 1:1.
     * @param amount Cantidad de USDT a depositar (mínimo 1e6 micro-unidades = 1.0 USDT).
     * @return newOrderId Identificador único asignado a la orden.
     */
    function createUsdtOrder(uint128 amount) external nonReentrant whenNotPaused returns (uint64 newOrderId) {
        newOrderId = _createOrder(OrderSide.USDT_FOR_BLUE, amount);
    }

    /**
     * @dev Lógica interna compartida de creación de órdenes y actualización contable.
     *
     * PRELACIÓN FIFO Y METADATA:
     * - La prioridad de ejecución está determinada única e irreversiblemente por el orden
     *   de registro on-chain manifestado en `sequenceId`.
     * - El campo `createdAt` es únicamente metadata informativa del timestamp del bloque.
     *
     * PATRÓN DE INTERACCIÓN Y CUSTODIA EXACTA:
     * - Para verificar que el Exchange recibe exactamente la cantidad requerida sin fee-on-transfer ni desvíos,
     *   se mide `balanceBefore` previo a `safeTransferFrom` y `balanceAfter` posterior a la transferencia.
     * - Este flujo requiere realizar la interacción externa de depósito antes de validar y consolidar
     *   definitivamente los efectos contables en storage.
     * - No constituye un patrón CEI estricto, pero la seguridad operativa está garantizada por el modificador
     *   `nonReentrant` en las funciones públicas llamantes (`createBlueOrder`/`createUsdtOrder`) y la atomicidad
     *   del EVM (reversión total del estado si el monto recibido no es exactamente igual a `amount`).
     */
    function _createOrder(OrderSide side, uint128 amount) internal returns (uint64) {
        return _createOrderFor(side, amount, msg.sender, msg.sender);
    }

    function _createOrderFor(OrderSide side, uint128 amount, address user, address depositor) internal returns (uint64 newOrderId) {
        _requireKYC(user);
        if (amount < MIN_ORDER_AMOUNT) revert OrderAmountTooLow();

        // 1. Guardas explícitas de overflow ANTES de incrementar identificadores
        if (nextOrderId == type(uint64).max) revert OrderIdOverflow();
        if (nextSequenceId == type(uint64).max) revert SequenceIdOverflow();

        newOrderId = nextOrderId;
        uint64 seqId = nextSequenceId;

        unchecked {
            nextOrderId++;
            nextSequenceId++;
        }

        if (block.timestamp > type(uint48).max) revert TimestampOverflow();
        uint48 currentTimestamp = uint48(block.timestamp);

        // 2. Registro de la orden en storage
        orders[newOrderId] = Order({
            id: newOrderId,
            sequenceId: seqId,
            remainingAmount: amount,
            user: user,
            status: OrderStatus.OPEN,
            side: side,
            createdAt: currentTimestamp,
            originalAmount: amount,
            refundedAmount: 0
        });

        // 3. Actualización de colas e invariantes contables con verificación estricta de saldo recibido
        if (side == OrderSide.BLUE_FOR_USDT) {
            blueOrderIds.push(newOrderId);
            totalDepositedBlue = _safeAdd128(totalDepositedBlue, amount, "DEPOSITED_BLUE");
            totalReservedBlue = _safeAdd128(totalReservedBlue, amount, "RESERVED_BLUE");

            uint256 balanceBefore = blueToken.balanceOf(address(this));
            blueToken.safeTransferFrom(depositor, address(this), amount);
            uint256 balanceAfter = blueToken.balanceOf(address(this));

            // Guarda defensiva contra underflow y verificación estricta de cantidad neta recibida
            if (balanceAfter < balanceBefore) {
                revert DepositAmountMismatch(amount, 0);
            } else if (balanceAfter - balanceBefore != amount) {
                revert DepositAmountMismatch(amount, balanceAfter - balanceBefore);
            }
        } else {
            usdtOrderIds.push(newOrderId);
            totalDepositedUsdt = _safeAdd128(totalDepositedUsdt, amount, "DEPOSITED_USDT");
            totalReservedUsdt = _safeAdd128(totalReservedUsdt, amount, "RESERVED_USDT");

            uint256 balanceBefore = usdtToken.balanceOf(address(this));
            usdtToken.safeTransferFrom(depositor, address(this), amount);
            uint256 balanceAfter = usdtToken.balanceOf(address(this));

            // Guarda defensiva contra underflow y verificación estricta de cantidad neta recibida
            if (balanceAfter < balanceBefore) {
                revert DepositAmountMismatch(amount, 0);
            } else if (balanceAfter - balanceBefore != amount) {
                revert DepositAmountMismatch(amount, balanceAfter - balanceBefore);
            }
        }

        emit OrderCreated(newOrderId, user, side, amount, seqId, currentTimestamp, block.number);
    }

    // =========================================================================
    // CANCELACIÓN DE ÓRDENES
    // =========================================================================

    /**
     * @notice Cancela una orden activa y devuelve el monto remanente intacto al creador.
     * @dev Operativa incluso bajo estado pausado. Solo el owner de la orden puede ejecutarla.
     * @param orderId Identificador de la orden a cancelar.
     */
    function cancelOrder(uint64 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.status == OrderStatus.NONE) revert OrderNotFound();
        if (order.user != msg.sender) revert Unauthorized();
        if (order.status != OrderStatus.OPEN && order.status != OrderStatus.PARTIALLY_FILLED && order.status != OrderStatus.SUSPENDED) {
            revert OrderNotCancellable();
        }

        uint128 refundAmount = order.remainingAmount;

        // Guardar el monto reembolsado para trazabilidad en getExecutedAmount
        order.refundedAmount += refundAmount;
        // Cerrar remanente a 0 para prevenir reentradas o dobles cancelaciones
        order.remainingAmount = 0;
        order.status = OrderStatus.CANCELLED;

        // 2. Actualización de contabilidad interna garantizando invariante de no-underflow
        if (order.side == OrderSide.BLUE_FOR_USDT) {
            if (totalReservedBlue < refundAmount) revert InsufficientContractReserve();
            unchecked {
                totalReservedBlue -= refundAmount;
            }
            totalRefundedBlue = _safeAdd128(totalRefundedBlue, refundAmount, "REFUNDED_BLUE");
            if (_canReturnBlue(msg.sender)) _returnBlue(msg.sender, refundAmount);
            else {
                pendingRefundBlue[msg.sender] = _safeAdd128(pendingRefundBlue[msg.sender], refundAmount, "PENDING_BLUE");
                totalPendingRefundBlue = _safeAdd128(totalPendingRefundBlue, refundAmount, "TOTAL_PENDING_BLUE");
                emit RefundHeld(msg.sender, refundAmount, 0);
            }
        } else {
            if (totalReservedUsdt < refundAmount) revert InsufficientContractReserve();
            unchecked {
                totalReservedUsdt -= refundAmount;
            }
            totalRefundedUsdt = _safeAdd128(totalRefundedUsdt, refundAmount, "REFUNDED_USDT");
            if (isAmortizationOrder[orderId]) {
                usdtToken.safeTransfer(amortizationVault, refundAmount);
                IAmortizationVault(amortizationVault).onAmortizationRefund(orderId, refundAmount);
            } else if (_isKYCVerified(msg.sender)) usdtToken.safeTransfer(msg.sender, refundAmount);
            else {
                pendingRefundUsdt[msg.sender] = _safeAdd128(pendingRefundUsdt[msg.sender], refundAmount, "PENDING_USDT");
                totalPendingRefundUsdt = _safeAdd128(totalPendingRefundUsdt, refundAmount, "TOTAL_PENDING_USDT");
                emit RefundHeld(msg.sender, 0, refundAmount);
            }
        }

        emit OrderCancelled(orderId, msg.sender, refundAmount);
    }

    // =========================================================================
    // MOTOR DE LIQUIDACIÓN Y EMPAREJAMIENTO (MATCHING ENGINE)
    // =========================================================================

    /**
     * @notice Ejecuta liquidaciones bilaterales 1:1 entre cabezas de cola efectivas.
     * @dev Permissionless. Acotado estrictamente por maxMatches y maxOrdersScanned.
     *
     * SEMÁNTICA FORMAL DE maxOrdersScanned (PRESUPUESTO DE INSPECCIONES):
     * - Cada inspección de una cabeza de cola consume exactamente 1 unidad del presupuesto.
     * - 1 inspección de cabeza BLUE = 1 scan consumido.
     * - 1 inspección de cabeza USDT = 1 scan consumido.
     * - Consecuencia: Un match bilateral exitoso consume como mínimo 2 inspecciones (BLUE + USDT).
     * - Poda Perezosa (Lazy Pruning): Si una orden de cabeza está FILLED o CANCELLED, su poda consume
     *   exactamente 1 scan y avanza el índice. Si se alcanza el límite (ordersScanned >= maxOrdersScanned),
     *   la ejecución se detiene de inmediato preservando el estado para la siguiente transacción.
     * - maxOrdersScanned NO representa cantidad de matches ni órdenes liquidadas, sino el límite estricto
     *   de lecturas y cómputo que la transacción está autorizada a consumir.
     *
     * TASA BRUTA VS COMISIÓN VS NETO:
     * - La tasa de cruce 1:1 es estrictamente BRUTA (Gross Amount).
     * - Si feeBps > 0, cada receptor recibe el monto neto: net = gross - fee.
     * - La tesorería acumula el fee retenido de cada lado de la operación.
     *
     * @param maxMatches Número máximo de matches bilaterales exitosos a ejecutar.
     * @param maxOrdersScanned Presupuesto máximo total de inspecciones de órdenes.
     * @return matchesExecuted Cantidad de matches efectivamente ejecutados.
     * @return ordersScanned Cantidad de cabezas de cola inspeccionadas.
     */
    function matchOrders(
        uint256 maxMatches,
        uint256 maxOrdersScanned
    ) external nonReentrant whenNotPaused returns (uint256 matchesExecuted, uint256 ordersScanned) {
        uint256 bLen = blueOrderIds.length;
        uint256 uLen = usdtOrderIds.length;

        uint64 bHead = blueHeadIndex;
        uint64 uHead = usdtHeadIndex;

        while (matchesExecuted < maxMatches && ordersScanned < maxOrdersScanned) {
            if (bHead >= bLen || uHead >= uLen) {
                break; // Una de las colas está agotada físicamente
            }

            // 1. Inspeccionar cabeza BLUE (consume exactamente 1 unidad)
            ordersScanned++;
            uint64 bId = blueOrderIds[bHead];
            Order storage bOrder = orders[bId];
            if (bOrder.status == OrderStatus.FILLED || bOrder.status == OrderStatus.CANCELLED) {
                if (bHead == type(uint64).max) revert HeadIndexOverflow();
                unchecked { bHead++; }
                continue; // Poda perezosa de orden terminal
            }

            // Si se consumió el presupuesto de inspección, no inspeccionar USDT
            if (ordersScanned >= maxOrdersScanned) {
                break;
            }

            // 2. Inspeccionar cabeza USDT (consume exactamente 1 unidad)
            ordersScanned++;
            uint64 uId = usdtOrderIds[uHead];
            Order storage uOrder = orders[uId];
            if (uOrder.status == OrderStatus.FILLED || uOrder.status == OrderStatus.CANCELLED) {
                if (uHead == type(uint64).max) revert HeadIndexOverflow();
                unchecked { uHead++; }
                continue; // Poda perezosa de orden terminal
            }

            if (isAmortizationOrder[uId]) {
                uint128 allowed = IAmortizationVault(amortizationVault).maxAmortizationGross(uId);
                if (uOrder.remainingAmount > allowed) _reduceAmortizationOrder(uOrder, allowed);
                if (allowed == 0) { unchecked { uHead++; } continue; }
            }
            if (!_isKYCVerified(bOrder.user)) {
                _suspend(bOrder, 1);
                if (bHead == type(uint64).max) revert HeadIndexOverflow();
                unchecked { bHead++; }
                continue;
            }
            if (!_isKYCVerified(uOrder.user)) {
                _suspend(uOrder, 1);
                if (uHead == type(uint64).max) revert HeadIndexOverflow();
                unchecked { uHead++; }
                continue;
            }

            // 3. Ambas cabezas están activas: determinar grossAmount y ejecutar cruce
            uint128 bRem = bOrder.remainingAmount;
            uint128 uRem = uOrder.remainingAmount;
            uint128 gross = bRem < uRem ? bRem : uRem;

            // Guarda de invariante formal: una orden activa nunca debe tener remainingAmount == 0
            if (gross == 0) {
                revert InvalidMatchAmount();
            }

            // Roll back this match only for the explicitly recognized coverage error.
            // Unknown token/protocol failures still revert, rather than hiding corruption.
            try this.executeMatch(bId, uId, gross) {} catch Error(string memory reason) {
                if (isAmortizationOrder[uId] && keccak256(bytes(reason)) == keccak256("Vault: Additional fee coverage required")) {
                    _suspend(uOrder, 2);
                    unchecked { uHead++; }
                    continue;
                }
                revert(reason);
            }
            matchesExecuted++;

            // 4. Actualización de cabezas de cola
            if (bOrder.remainingAmount == 0) {
                bOrder.status = OrderStatus.FILLED;
                if (bHead == type(uint64).max) revert HeadIndexOverflow();
                unchecked { bHead++; }
            } else {
                bOrder.status = OrderStatus.PARTIALLY_FILLED;
            }

            if (uOrder.remainingAmount == 0) {
                uOrder.status = OrderStatus.FILLED;
                if (uHead == type(uint64).max) revert HeadIndexOverflow();
                unchecked { uHead++; }
            } else {
                uOrder.status = OrderStatus.PARTIALLY_FILLED;
            }
        }

        // Persistir avance de cabezas de cola en storage
        blueHeadIndex = bHead;
        usdtHeadIndex = uHead;
    }

    /**
     * @dev Ejecuta la liquidación de un match específico.
     *
     * GARANTÍA CONTABLE Y PATRÓN CEI:
     * Los saldos remanentes (remainingAmount), reservas (totalReserved) y contadores acumulados
     * se actualizan antes de cualquier transferencia externa. La actualización posterior del campo status
     * (FILLED / PARTIALLY_FILLED) en el bucle principal se encuentra protegida de reentrancia mediante
     * el modificador nonReentrant, previniendo dobles ejecuciones o inconsistencias de estado.
     *
     * NOTA SOBRE COMISIÓN:
     * La comisión aplicable a cada ejecución es el `feeBps` vigente al momento de realizar el match,
     * no necesariamente el vigente cuando fue creada la orden.
     */
    function _reduceAmortizationOrder(Order storage order, uint128 keep) private {
        uint128 refund = order.remainingAmount - keep;
        order.remainingAmount = keep;
        order.refundedAmount += refund;
        totalReservedUsdt -= refund;
        totalRefundedUsdt = _safeAdd128(totalRefundedUsdt, refund, "REFUNDED_USDT");
        if (keep == 0) order.status = OrderStatus.CANCELLED;
        usdtToken.safeTransfer(amortizationVault, refund);
        IAmortizationVault(amortizationVault).onAmortizationRefund(order.id, refund);
        emit OrderReduced(order.id, refund, keep);
    }

    // matchOrders holds nonReentrant throughout this self-call. Public callers
    // cannot bypass FIFO or select a pair: only this contract may invoke it.
    function executeMatch(uint64 blueId, uint64 usdtId, uint128 gross) external {
        require(msg.sender == address(this), "Exchange: Only self");
        _settleMatch(orders[blueId], orders[usdtId], gross);
    }
    function _settleMatch(Order storage bOrder, Order storage uOrder, uint128 gross) internal {
        // Cálculo de comisiones y montos netos
        uint128 fee = uint128((uint256(gross) * feeBps) / 10_000);
        uint128 net = gross - fee;

        // Guarda de overflow en matchId antes del incremento
        if (matchId == type(uint64).max) revert MatchIdOverflow();
        uint64 currentMatchId = matchId;
        unchecked { matchId++; }

        // Actualización de balances remanentes en órdenes
        bOrder.remainingAmount -= gross;
        uOrder.remainingAmount -= gross;

        // Actualización de reservas garantizando que gross <= totalReserved
        if (totalReservedBlue < gross || totalReservedUsdt < gross) revert InsufficientContractReserve();
        unchecked {
            totalReservedBlue -= gross;
            totalReservedUsdt -= gross;
        }

        // Actualización aditiva protegida contra desbordamiento
        totalMatchedGrossBlue = _safeAdd128(totalMatchedGrossBlue, gross, "MATCHED_BLUE");
        totalMatchedGrossUsdt = _safeAdd128(totalMatchedGrossUsdt, gross, "MATCHED_USDT");

        accumulatedFeesBlue = _safeAdd128(accumulatedFeesBlue, fee, "FEES_ACC_BLUE");
        accumulatedFeesUsdt = _safeAdd128(accumulatedFeesUsdt, fee, "FEES_ACC_USDT");

        totalFeesGeneratedBlue = _safeAdd128(totalFeesGeneratedBlue, fee, "FEES_GEN_BLUE");
        totalFeesGeneratedUsdt = _safeAdd128(totalFeesGeneratedUsdt, fee, "FEES_GEN_USDT");

        // Transferencias externas (Interacciones finales conforme a CEI)
        // El vendedor de BLUE recibe net USDT; el vendedor de USDT recibe net BLUE
        usdtToken.safeTransfer(bOrder.user, net);
        blueToken.safeTransfer(uOrder.user, net);
        if (isAmortizationOrder[uOrder.id]) {
            IAmortizationVault(amortizationVault).onAmortizationFill(uOrder.id, gross, net);
        } else if (coreProtocol != address(0)) {
            IExchangeCoreKYC(coreProtocol).settleMatured(uOrder.user);
        }

        emit OrderMatched(
            currentMatchId,
            bOrder.id,
            uOrder.id,
            gross,
            fee, // feeBlue pagado por receptor de BLUE
            fee, // feeUsdt pagado por receptor de USDT
            net, // netBlueTransferredByExchange
            net  // netUsdtTransferredByExchange
        );
    }

    // =========================================================================
    // RECLAMO DE COMISIONES (CLAIM FEES)
    // =========================================================================

    /**
     * @notice Transfiere las comisiones devengadas exclusivamente hacia la tesorería vigente.
     * @dev Permissionless. Puede llamarse incluso durante pausa de emergencia.
     * Aplica verificación estricta de solvencia antes de Effects e Interactions:
     * Los fondos reservados para órdenes activas (totalReserved) tienen prioridad absoluta
     * de custodia y jamás pueden utilizarse para satisfacer pagos a tesorería.
     */
    function claimFees() external nonReentrant {
        _requireKYC(treasury);
        // 1. Lectura de comisiones devengadas
        uint128 blueFees = accumulatedFeesBlue;
        uint128 usdtFees = accumulatedFeesUsdt;

        // 2. Verificación estricta de solvencia de AMBOS activos ANTES de modificar estado
        if (
            blueToken.balanceOf(address(this)) < uint256(totalReservedBlue) + uint256(blueFees) + totalPendingRefundBlue ||
            usdtToken.balanceOf(address(this)) < uint256(totalReservedUsdt) + uint256(usdtFees) + totalPendingRefundUsdt
        ) {
            revert InsufficientContractFees();
        }

        // 3. Effects (Actualización de estado contable)
        accumulatedFeesBlue = 0;
        accumulatedFeesUsdt = 0;

        totalFeesClaimedBlue = _safeAdd128(totalFeesClaimedBlue, blueFees, "FEES_CLAIM_BLUE");
        totalFeesClaimedUsdt = _safeAdd128(totalFeesClaimedUsdt, usdtFees, "FEES_CLAIM_USDT");

        address currentTreasury = treasury;

        // 4. Interactions (Transferencias externas finales a la tesorería)
        if (blueFees > 0) {
            blueToken.safeTransfer(currentTreasury, blueFees);
        }
        if (usdtFees > 0) {
            usdtToken.safeTransfer(currentTreasury, usdtFees);
        }

        emit FeesClaimed(currentTreasury, blueFees, usdtFees);
    }

    // =========================================================================
    // TIMELOCK DE COMISIONES (FEE BPS)
    // =========================================================================

    /**
     * @notice Propone un nuevo valor de comisión. Sujeto a timelock de 48 horas.
     * @param newFeeBps Nuevo valor de comisión (máximo 500 BPS = 5.00%).
     */
    function proposeFeeUpdate(uint16 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeExceedsMax();
        if (feeUnlockTimestamp != 0) revert FeeProposalAlreadyPending();

        if (block.timestamp > type(uint48).max - TIMELOCK_DELAY) revert TimestampOverflow();
        uint48 unlockTime = uint48(block.timestamp + TIMELOCK_DELAY);

        pendingFeeBps = newFeeBps;
        feeUnlockTimestamp = unlockTime;

        emit FeeProposalCreated(newFeeBps, unlockTime);
    }

    /**
     * @notice Ejecuta la actualización de comisión una vez cumplido el plazo de 48 horas.
     * @dev Permissionless. Puede ejecutarse durante pausa.
     */
    function executeFeeUpdate() external nonReentrant {
        uint48 unlockTime = feeUnlockTimestamp;
        if (unlockTime == 0) revert NoPendingFeeProposal();
        if (block.timestamp < unlockTime) revert TimelockNotExpired();
        if (unlockTime > type(uint48).max - TIMELOCK_GRACE_PERIOD) revert TimestampOverflow();
        if (block.timestamp > unlockTime + TIMELOCK_GRACE_PERIOD) revert ProposalExpired();

        uint16 oldFee = feeBps;
        uint16 newFee = pendingFeeBps;

        feeBps = newFee;
        feeUnlockTimestamp = 0;
        pendingFeeBps = 0;

        emit FeeProposalExecuted(oldFee, newFee);
    }

    /**
     * @notice Cancela la propuesta pendiente de comisión, liberando el slot.
     */
    function cancelFeeProposal() external onlyOwner {
        uint48 unlockTime = feeUnlockTimestamp;
        if (unlockTime == 0) revert NoPendingFeeProposal();

        uint16 cancelledFee = pendingFeeBps;
        feeUnlockTimestamp = 0;
        pendingFeeBps = 0;

        emit FeeProposalCancelled(cancelledFee);
    }

    // =========================================================================
    // TIMELOCK DE TESORERÍA (TREASURY)
    // =========================================================================

    /**
     * @notice Propone una nueva dirección de tesorería. Sujeto a timelock de 48 horas.
     * @param newTreasury Nueva dirección receptora institucional de comisiones.
     */
    function proposeTreasuryUpdate(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        if (
            newTreasury == address(this) ||
            newTreasury == address(blueToken) ||
            newTreasury == address(usdtToken)
        ) revert InvalidTreasuryAddress();
        if (treasuryUnlockTimestamp != 0) revert TreasuryProposalAlreadyPending();

        if (block.timestamp > type(uint48).max - TIMELOCK_DELAY) revert TimestampOverflow();
        uint48 unlockTime = uint48(block.timestamp + TIMELOCK_DELAY);

        pendingTreasury = newTreasury;
        treasuryUnlockTimestamp = unlockTime;

        emit TreasuryProposalCreated(newTreasury, unlockTime);
    }

    /**
     * @notice Ejecuta la actualización de tesorería una vez cumplido el plazo de 48 horas.
     * @dev Restringida exclusivamente al Owner por sensibilidad institucional del destino de fondos.
     * Incluye nonReentrant como defensa en profundidad. Puede ejecutarse durante pausa.
     */
    function executeTreasuryUpdate() external onlyOwner nonReentrant {
        uint48 unlockTime = treasuryUnlockTimestamp;
        if (unlockTime == 0) revert NoPendingTreasuryProposal();
        if (block.timestamp < unlockTime) revert TimelockNotExpired();
        if (unlockTime > type(uint48).max - TIMELOCK_GRACE_PERIOD) revert TimestampOverflow();
        if (block.timestamp > unlockTime + TIMELOCK_GRACE_PERIOD) revert ProposalExpired();

        address oldTreasury = treasury;
        address newTreasury = pendingTreasury;

        treasury = newTreasury;
        treasuryUnlockTimestamp = 0;
        pendingTreasury = address(0);

        emit TreasuryProposalExecuted(oldTreasury, newTreasury);
    }

    /**
     * @notice Cancela la propuesta pendiente de tesorería, liberando el slot.
     */
    function cancelTreasuryProposal() external onlyOwner {
        uint48 unlockTime = treasuryUnlockTimestamp;
        if (unlockTime == 0) revert NoPendingTreasuryProposal();

        address cancelled = pendingTreasury;
        treasuryUnlockTimestamp = 0;
        pendingTreasury = address(0);

        emit TreasuryProposalCancelled(cancelled);
    }

    // =========================================================================
    // ADMINISTRACIÓN Y CONTINGENCIA
    // =========================================================================

    /**
     * @notice Activa la pausa de emergencia bloqueando nuevos depósitos y matches.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Reanuda las operaciones normales del Exchange tras resolución de contingencias.
     * @dev Autónomo e independiente de contratos externos.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Rescata tokens ERC-20 ajenos enviados accidentalmente al contrato.
     * @dev Prohibido terminantemente para BLUE y USDT bajo cualquier circunstancia.
     */
    function rescueForeignToken(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (token == address(blueToken) || token == address(usdtToken)) revert CannotRescuePairToken();
        if (token == address(0) || to == address(0)) revert ZeroAddress();

        IERC20(token).safeTransfer(to, amount);
        emit ForeignTokenRescued(token, to, amount);
    }

    /**
     * @notice Deshabilitado permanentemente para proteger la gobernanza institucional.
     * @dev Revierte incondicionalmente para cualquier caller para prevenir que el contrato
     * quede huérfano de administración para funciones críticas (pausa, timelocks, rescate).
     */
    function renounceOwnership() public pure override {
        revert RenounceOwnershipDisabled();
    }

    // =========================================================================
    // FUNCIONES VIEW AUDITABLES Y CONSULTAS DE ESTADO
    // =========================================================================

    /**
     * @notice Deriva el monto ejecutado de una orden on-the-fly.
     * @param orderId Identificador de la orden.
     */
    function getExecutedAmount(uint64 orderId) external view returns (uint128) {
        Order storage order = orders[orderId];
        if (order.status == OrderStatus.NONE) revert OrderNotFound();
        
        // Si fue cancelada, lo ejecutado fue lo original menos lo que se reembolsó.
        // Si no fue cancelada, lo ejecutado es lo original menos lo que aún resta por ejecutar.
        if (order.status == OrderStatus.CANCELLED) {
            return order.originalAmount - order.refundedAmount;
        }
        return order.originalAmount - order.remainingAmount - order.refundedAmount;
    }

    /**
     * @notice Retorna la longitud física del array de órdenes BLUE.
     */
    function getBlueOrderIdsLength() external view returns (uint256) {
        return blueOrderIds.length;
    }

    /**
     * @notice Retorna la longitud física del array de órdenes USDT.
     */
    function getUsdtOrderIdsLength() external view returns (uint256) {
        return usdtOrderIds.length;
    }

    /**
     * @notice Retorna la cabeza de cola efectiva en memoria saltando órdenes terminales.
     * @dev Función view de solo lectura; no altera punteros de storage.
     */
    function getEffectiveHead(OrderSide side) external view returns (uint64 effectiveHeadIdx, bool hasActiveOrder) {
        if (side == OrderSide.BLUE_FOR_USDT) {
            uint256 len = blueOrderIds.length;
            for (uint256 i = blueHeadIndex; i < len; i++) {
                OrderStatus st = orders[blueOrderIds[i]].status;
                if (st == OrderStatus.OPEN || st == OrderStatus.PARTIALLY_FILLED) {
                    if (i > type(uint64).max) revert HeadIndexOverflow();
                    return (uint64(i), true);
                }
            }
        } else {
            uint256 len = usdtOrderIds.length;
            for (uint256 i = usdtHeadIndex; i < len; i++) {
                OrderStatus st = orders[usdtOrderIds[i]].status;
                if (st == OrderStatus.OPEN || st == OrderStatus.PARTIALLY_FILLED) {
                    if (i > type(uint64).max) revert HeadIndexOverflow();
                    return (uint64(i), true);
                }
            }
        }
        return (0, false);
    }

    /**
     * @notice Calcula el superávit libre de fondos no comprometidos para un token del par.
     * @param isBlue true para evaluar BLUE, false para USDT.
     */
    function freeSurplus(bool isBlue) external view returns (uint256 surplus, bool isSolvent) {
        if (isBlue) {
            uint256 bal = blueToken.balanceOf(address(this));
            uint256 req = uint256(totalReservedBlue) + uint256(accumulatedFeesBlue) + totalPendingRefundBlue;
            if (bal >= req) {
                return (bal - req, true);
            } else {
                return (0, false);
            }
        } else {
            uint256 bal = usdtToken.balanceOf(address(this));
            uint256 req = uint256(totalReservedUsdt) + uint256(accumulatedFeesUsdt) + totalPendingRefundUsdt;
            if (bal >= req) {
                return (bal - req, true);
            } else {
                return (0, false);
            }
        }
    }

    // =========================================================================
    // UTILIDADES ARITMÉTICAS INTERNAS PURAS
    // =========================================================================

    /**
     * @dev Suma segura uint128 con guarda explícita previa contra desbordamiento.
     */
    function _safeAdd128(uint128 a, uint128 b, bytes32 name) internal pure returns (uint128) {
        if (a > type(uint128).max - b) revert CounterOverflow(name);
        return a + b;
    }
}
