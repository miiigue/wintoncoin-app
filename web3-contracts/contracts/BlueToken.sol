// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Interfaz mínima para llamar al Vigilante de Auto-Amortización.
 * BlueToken usa esta interfaz para notificar a WintonProtocol cada vez
 * que alguien recibe tokens BLUE, activando la Regla Materia-Antimateria.
 */
interface IAutoAmortizer {
    function triggerAutoAmortize(address user) external;
}

/**
 * @title BlueToken (Winton BLUE)
 * @author WintonCoin Protocol Team
 * @notice El activo líquido del ecosistema WintonCoin. Cumple ERC-20.
 * @dev Su emisión y quema están estrictamente controladas por el contrato
 * WintonProtocol para asegurar la Regla de Balance Cero (Materia-Antimateria).
 *
 * SEGURIDAD:
 * - La dirección del Protocolo se asigna UNA SOLA VEZ (inmutable post-configuración).
 * - Solo WintonProtocol puede mintear o quemar tokens.
 * - El Owner no puede mintear tokens directamente, eliminando riesgo de rug-pull.
 * - VIGILANTE: Cada recepción de BLUE activa automáticamente la auto-amortización
 *   en WintonProtocol, haciendo imposible que coexistan BLUE y RED.
 */
contract BlueToken is ERC20, Ownable {

    /// @notice Dirección del contrato WintonProtocol autorizado para mintear/quemar.
    address public wintonProtocol;

    /// @notice Bandera de seguridad: true = el protocolo ya fue configurado y es irreversible.
    bool public protocolLocked;

    /// @notice Direcciones exentas del vigilante (Treasury, Protocol) para ahorrar gas.
    /// @dev Estas direcciones nunca tendrán deuda RED, así que revisarlas es innecesario.
    mapping(address => bool) public isExemptFromAmortization;

    /// @notice Evento auditable emitido al configurar el protocolo por única vez.
    event ProtocolSet(address indexed protocol);

    /// @notice Evento emitido al configurar una dirección exenta del vigilante.
    event ExemptionUpdated(address indexed addr, bool status);

    /// @notice Constructor del token. No mintea suministro inicial (Balance Cero).
    constructor() ERC20("Winton BLUE", "BLUE") Ownable(msg.sender) {}

    /**
     * @notice BLOQUEADO. No se permite renunciar a la propiedad del contrato.
     * @dev Sobreescribe Ownable.renounceOwnership() para prevenir que el protocolo
     * quede permanentemente sin administrador. En su lugar, usar transferOwnership()
     * para migrar el control a un Gnosis Safe (multisig) en producción.
     */
    function renounceOwnership() public pure override {
        revert("BLUE: Ownership renunciation is disabled");
    }

    /**
     * @notice Asigna la dirección del Motor Principal. IRREVERSIBLE.
     * @dev Solo puede llamarse una vez por el Owner. Después de esto, el Owner
     * pierde la capacidad de cambiar quién controla la emisión. Esto previene
     * que un atacante que comprometa la llave del Owner pueda redirigir el minteo.
     * @param _protocol Dirección del contrato WintonProtocol desplegado.
     */
    function setWintonProtocol(address _protocol) external onlyOwner {
        // SEGURIDAD: Solo se permite configurar una vez (Patrón de Bloqueo Irreversible).
        require(!protocolLocked, "BLUE: Protocol already locked");
        // SEGURIDAD: Prevenir configuración a dirección vacía (fondos irrecuperables).
        require(_protocol != address(0), "BLUE: Invalid zero address");
        
        // Asignar y bloquear permanentemente.
        wintonProtocol = _protocol;
        protocolLocked = true;
        
        // El propio protocolo está exento del vigilante (nunca tendrá deuda RED).
        isExemptFromAmortization[_protocol] = true;
        
        // Registro auditable del momento exacto de la configuración.
        emit ProtocolSet(_protocol);
    }

    /**
     * @notice Configura direcciones exentas del vigilante de auto-amortización.
     * @dev Solo el Owner puede ejecutar. Usar para la Treasury y otros contratos
     * del ecosistema que nunca tendrán deuda RED. Esto ahorra gas en cada transferencia.
     * @param _addr Dirección a exentar o des-exentar.
     * @param _status true = exenta (no se revisa), false = sujeta al vigilante.
     */
    function setExemptFromAmortization(address _addr, bool _status) external onlyOwner {
        require(_addr != address(0), "BLUE: Invalid zero address");
        isExemptFromAmortization[_addr] = _status;
        emit ExemptionUpdated(_addr, _status);
    }

    /// @dev Modificador que restringe funciones exclusivamente al WintonProtocol.
    modifier onlyProtocol() {
        require(msg.sender == wintonProtocol, "BLUE: Unauthorized. Only WintonProtocol");
        _;
    }

    /**
     * @notice Mintea nuevos tokens BLUE. Exclusivo del Motor Principal durante un pago.
     * @dev Solo WintonProtocol puede llamar esta función. El Owner NO puede.
     * @param to Dirección que recibirá los tokens minteados.
     * @param amount Cantidad de tokens a mintear (en wei, 18 decimales).
     */
    function mint(address to, uint256 amount) external onlyProtocol {
        _mint(to, amount);
    }

    /**
     * @notice Quema tokens BLUE. Exclusivo del Motor Principal durante la auto-amortización.
     * @dev Solo WintonProtocol puede llamar esta función. El Owner NO puede.
     * @param from Dirección cuyo saldo será reducido.
     * @param amount Cantidad de tokens a quemar (en wei, 18 decimales).
     */
    function burn(address from, uint256 amount) external onlyProtocol {
        _burn(from, amount);
    }

    // ========================================================================
    // EL VIGILANTE: Hook de Auto-Amortización en cada recepción de BLUE
    // ========================================================================

    /**
     * @notice Hook interno que se ejecuta en CADA movimiento de tokens (mint, burn, transfer).
     * @dev Sobreescribe la función _update de OpenZeppelin v5.
     * Después de que los tokens se mueven, verifica si el receptor tiene deuda RED.
     * Si la tiene, llama a WintonProtocol para destruir ambos (Materia-Antimateria).
     *
     * OPTIMIZACIONES DE GAS:
     * - No se activa para quemas (to == address(0)): no hay receptor que revisar.
     * - No se activa para direcciones exentas (Treasury, Protocol): nunca tienen RED.
     * - No se activa si el protocolo no fue configurado aún (fase de despliegue).
     * - Si la llamada al Protocolo falla por cualquier razón, la transferencia
     *   NO se revierte (try/catch). Esto previene que un bug en el Protocolo
     *   congele todos los movimientos de BLUE.
     *
     * @param from Dirección que envía los tokens (address(0) para mints).
     * @param to Dirección que recibe los tokens (address(0) para burns).
     * @param value Cantidad de tokens en movimiento.
     */
    function _update(address from, address to, uint256 value) internal override {
        // PASO 1: Ejecutar la transferencia/mint/burn normalmente (ERC-20 estándar).
        super._update(from, to, value);

        // PASO 2: Activar el Vigilante solo si se cumplen las condiciones.
        // - El receptor existe (no es una quema).
        // - El protocolo ya fue configurado.
        // - El receptor NO está en la lista de exentos.
        if (
            to != address(0) &&                      // No es una quema.
            wintonProtocol != address(0) &&           // El protocolo está configurado.
            !isExemptFromAmortization[to]             // El receptor no está exento.
        ) {
            // PASO 3: Llamar al Vigilante en WintonProtocol.
            // Usamos try/catch para que si el Protocolo falla por cualquier razón
            // (ej: no está inicializado), la transferencia de BLUE no se bloquee.
            try IAutoAmortizer(wintonProtocol).triggerAutoAmortize(to) {
                // Auto-amortización ejecutada exitosamente (o no había nada que quemar).
            } catch {
                // Si falla, simplemente continuamos. La transferencia ya se completó.
                // Esto previene que un bug en el Protocolo congele TODOS los tokens.
            }
        }
    }
}
