// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title BlueToken (Winton BLUE) - Suite V4
 * @author WintonCoin Protocol Engineering Team
 * @notice Token de activo circulante del ecosistema WintonCoin. Cumple el estándar ERC-20.
 * @dev Diseñado para Optimism Sepolia y L2 con precisión de 6 decimales (paridad 1:1 con USDT).
 * 
 * PRINCIPIOS DE SEGURIDAD FINTECH & ZERO-TRUST:
 * 1. Precisión Unificada: 6 decimales nativos para eliminar discrepancias aritméticas con USDT.
 * 2. Cero Hooks Externos: Se erradican llamadas económicas en `_update` para prevenir reentrancias y fallos de disponibilidad.
 * 3. Control de Emisión Estricto: Solo el contrato `WintonProtocol` tiene autorización para mintear y quemar.
 * 4. Gobernanza en Dos Pasos: Hereda Ownable2Step para evitar pérdidas accidentales de titularidad hacia direcciones erróneas.
 * 5. Prohibición de Renuncia: `renounceOwnership()` revierte para impedir que el contrato quede sin administración.
 */
contract BlueToken is ERC20, Ownable2Step {

    // ========================================================================
    // VARIABLES DE ESTADO
    // ========================================================================

    /// @notice Dirección del contrato WintonProtocol autorizado exclusivamente para emitir y destruir tokens.
    address public wintonProtocol;

    /// @notice Bandera de bloqueo inmutable: true indica que el protocolo fue asignado de forma permanente.
    bool public protocolLocked;

    // ========================================================================
    // EVENTOS AUDITABLES
    // ========================================================================

    /// @notice Evento emitido al enlazar de forma irreversible la dirección de WintonProtocol.
    /// @param protocol Dirección del contrato WintonProtocol verificado.
    event ProtocolSet(address indexed protocol);

    // ========================================================================
    // MODIFICADORES DE CONTROL DE ACCESO
    // ========================================================================

    /// @dev Modificador que restringe la ejecución exclusivamente al contrato WintonProtocol enlazado.
    modifier onlyProtocol() {
        require(msg.sender == wintonProtocol, "BLUE: Unauthorized. Caller is not WintonProtocol");
        _;
    }

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * @notice Constructor del token BLUE. Inicializa el nombre y símbolo bajo estándar ERC-20.
     * @dev No acuña suministro inicial; toda emisión se realiza bajo el principio de Balance Cero respaldado.
     */
    constructor() ERC20("Winton BLUE", "BLUE") Ownable(msg.sender) {}

    // ========================================================================
    // CONFIGURACIÓN DE DECIMALES (ESTÁNDAR FINTECH)
    // ========================================================================

    /**
     * @notice Sobrescribe la precisión predeterminada de 18 decimales de ERC-20 a 6 decimales.
     * @dev Garantiza paridad numérica exacta con USDT (Tether) y previene errores de escala en el Exchange.
     * @return 6 Número de decimales exactos del token.
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    // ========================================================================
    // GOBERNANZA Y ENLACE DE CONTRATOS
    // ========================================================================

    /**
     * @notice Enlaza permanentemente el contrato WintonProtocol. Operación irreversible.
     * @dev Solo puede ser ejecutado una única vez por el Propietario (o Multisig de Gobernanza).
     * @param _protocol Dirección del contrato WintonProtocol desplegado en la red.
     */
    function setWintonProtocol(address _protocol) external onlyOwner {
        // SEGURIDAD: Prevenir reconfiguración si ya fue sellado (Patrón de Bloqueo Inmutable).
        require(!protocolLocked, "BLUE: Protocol reference is already locked");
        // SEGURIDAD: Prevenir asignación a dirección cero.
        require(_protocol != address(0), "BLUE: Cannot set protocol to zero address");

        wintonProtocol = _protocol;
        protocolLocked = true;

        emit ProtocolSet(_protocol);
    }

    /**
     * @notice Prohibición estricta de renunciar a la propiedad del contrato.
     * @dev Previene que la llave del administrador quede vacía. Para transferir la gobernanza
     * a un Multisig (Gnosis Safe), debe utilizarse el flujo en dos pasos transferOwnership / acceptOwnership.
     */
    function renounceOwnership() public pure override {
        revert("BLUE: Ownership renunciation is permanently disabled");
    }

    // ========================================================================
    // FUNCIONES ECONÓMICAS OPERATIVAS (SOLO WINTON PROTOCOL)
    // ========================================================================

    /**
     * @notice Emite nuevos tokens BLUE hacia una cuenta beneficiaria durante un pago del marketplace.
     * @dev Exclusivo de WintonProtocol. El Owner no puede emitir tokens arbitrariamente.
     * @param to Dirección de la cuenta que recibirá los tokens emitidos.
     * @param amount Cantidad exacta de tokens a emitir (expresada en unidades base con 6 decimales).
     */
    function mint(address to, uint256 amount) external onlyProtocol {
        require(to != address(0), "BLUE: Cannot mint to zero address");
        _mint(to, amount);
    }

    /**
     * @notice Quema tokens BLUE para amortización voluntaria, pago con saldo ganado o compensación de compromisos.
     * @dev Exclusivo de WintonProtocol.
     * @param from Dirección de la cuenta de la cual se deducirán y destruirán los tokens.
     * @param amount Cantidad exacta de tokens a quemar (expresada en 6 decimales).
     */
    function burn(address from, uint256 amount) external onlyProtocol {
        require(from != address(0), "BLUE: Cannot burn from zero address");
        _burn(from, amount);
    }
}
