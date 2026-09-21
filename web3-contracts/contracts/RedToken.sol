// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title RedToken (Winton RED Commitment) - Suite V4
 * @author WintonCoin Protocol Engineering Team
 * @notice Representación contable on-chain de los compromisos adquiridos en el ecosistema WintonCoin.
 * @dev Diseñado para Optimism Sepolia y L2 con precisión de 6 decimales.
 * 
 * REGLAS NORMATIVAS Y DE SEGURIDAD BANCARIA:
 * 1. Precisión de 6 Decimales: Idéntica a BLUE y USDT para preservar la equivalencia 1:1 en la amortización.
 * 2. No Transferibilidad Estricta: Se prohíbe cualquier transferencia de compromisos entre usuarios (P2P).
 *    Los compromisos pertenecen a la identidad/wallet que originó la obligación y solo pueden ser
 *    creados (mint en originación) o extinguidos (burn en amortización/compensación).
 * 3. Control de Emisión Exclusivo: Únicamente el contrato `WintonProtocol` puede emitir o destruir tokens RED.
 * 4. Gobernanza en Dos Pasos (Ownable2Step) y Prohibición de Renuncia para proteger la administración del contrato.
 */
contract RedToken is ERC20, Ownable2Step {

    // ========================================================================
    // VARIABLES DE ESTADO
    // ========================================================================

    /// @notice Dirección del contrato WintonProtocol autorizado para originar y amortizar compromisos.
    address public wintonProtocol;

    /// @notice Bandera de bloqueo inmutable: true indica que el protocolo fue asignado y no puede ser alterado.
    bool public protocolLocked;

    // ========================================================================
    // EVENTOS AUDITABLES
    // ========================================================================

    /// @notice Evento emitido al registrar de forma definitiva la dirección de WintonProtocol.
    /// @param protocol Dirección del contrato WintonProtocol enlazado.
    event ProtocolSet(address indexed protocol);

    // ========================================================================
    // MODIFICADORES DE CONTROL DE ACCESO
    // ========================================================================

    /// @dev Modificador que restringe la ejecución exclusivamente a WintonProtocol.
    modifier onlyProtocol() {
        require(msg.sender == wintonProtocol, "RED: Unauthorized. Caller is not WintonProtocol");
        _;
    }

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * @notice Constructor del token RED.
     * @dev Asigna el nombre oficial "Winton RED Commitment" y símbolo "RED". No acuña suministro inicial.
     */
    constructor() ERC20("Winton RED Commitment", "RED") Ownable(msg.sender) {}

    // ========================================================================
    // CONFIGURACIÓN DE DECIMALES (ESTÁNDAR FINTECH)
    // ========================================================================

    /**
     * @notice Sobrescribe la precisión predeterminada a 6 decimales para paridad exacta con BLUE y USDT.
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
     * @dev Solo puede ser ejecutado una única vez por el Propietario (o Multisig).
     * @param _protocol Dirección del contrato WintonProtocol desplegado.
     */
    function setWintonProtocol(address _protocol) external onlyOwner {
        require(!protocolLocked, "RED: Protocol reference is already locked");
        require(_protocol != address(0), "RED: Cannot set protocol to zero address");

        wintonProtocol = _protocol;
        protocolLocked = true;

        emit ProtocolSet(_protocol);
    }

    /**
     * @notice Prohibición estricta de renunciar a la propiedad del contrato.
     */
    function renounceOwnership() public pure override {
        revert("RED: Ownership renunciation is permanently disabled");
    }

    // ========================================================================
    // REGLA DE NO TRANSFERIBILIDAD (BARRERA ANTI-EVASIÓN)
    // ========================================================================

    /**
     * @notice Gancho interno de actualización de transferencias bajo OpenZeppelin v5.
     * @dev Bloquea todas las transferencias de compromisos entre usuarios comunes.
     * Solo se permiten:
     * 1. Acuñación (Minting): `from == address(0)` (WintonProtocol originando un compromiso).
     * 2. Quema (Burning): `to == address(0)` (WintonProtocol amortizando un compromiso).
     * Cualquier intento de transferir saldo RED a otra wallet revierte de inmediato.
     * @param from Dirección de origen del movimiento.
     * @param to Dirección de destino del movimiento.
     * @param value Cantidad de tokens en movimiento.
     */
    function _update(address from, address to, uint256 value) internal override {
        require(
            from == address(0) || to == address(0),
            "RED: Commitment tokens are strictly non-transferable between accounts"
        );
        super._update(from, to, value);
    }

    // ========================================================================
    // FUNCIONES OPERATIVAS EXCLUSIVAS DE WINTON PROTOCOL
    // ========================================================================

    /**
     * @notice Asigna un compromiso RED a un deudor durante la originación de un pago de marketplace.
     * @dev Solo ejecutable por WintonProtocol.
     * @param to Dirección del usuario que adquiere el compromiso.
     * @param amount Monto exacto del compromiso en unidades base de 6 decimales.
     */
    function mintCommitment(address to, uint256 amount) external onlyProtocol {
        require(to != address(0), "RED: Cannot mint commitment to zero address");
        _mint(to, amount);
    }

    /**
     * @notice Extingue y destruye compromisos RED al momento de la amortización, pago con trabajo o compensación.
     * @dev Solo ejecutable por WintonProtocol.
     * @param from Dirección del usuario cuyo compromiso es saldado.
     * @param amount Monto exacto del compromiso a extinguir (6 decimales).
     */
    function burnCommitment(address from, uint256 amount) external onlyProtocol {
        require(from != address(0), "RED: Cannot burn commitment from zero address");
        _burn(from, amount);
    }
}
