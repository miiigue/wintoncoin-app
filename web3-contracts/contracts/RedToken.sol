// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RedToken (Winton RED Debt)
 * @author WintonCoin Protocol Team
 * @notice Representación on-chain de la deuda en el ecosistema WintonCoin.
 * @dev A diferencia del BLUE, el RED NO es transferible entre usuarios.
 * Solo puede ser creado (cuando asumes deuda) o destruido (auto-amortización).
 * Los tokens RED se cancelan automáticamente al recibir BLUE (Materia-Antimateria).
 *
 * SEGURIDAD:
 * - transfer() y transferFrom() están permanentemente bloqueados (revert).
 * - approve() está bloqueado para prevenir ataques de allowance sobre deuda.
 * - La dirección del Protocolo se asigna UNA SOLA VEZ (inmutable post-configuración).
 * - Solo WintonProtocol puede mintear o quemar deuda.
 */
contract RedToken is ERC20, Ownable {

    /// @notice Dirección del contrato WintonProtocol autorizado para mintear/quemar deuda.
    address public wintonProtocol;

    /// @notice Bandera de seguridad: true = el protocolo ya fue configurado y es irreversible.
    bool public protocolLocked;

    /// @notice Evento auditable emitido al configurar el protocolo por única vez.
    event ProtocolSet(address indexed protocol);

    /// @notice Constructor del token de deuda. No mintea suministro inicial (Balance Cero).
    constructor() ERC20("Winton RED Debt", "RED") Ownable(msg.sender) {}

    /**
     * @notice BLOQUEADO. No se permite renunciar a la propiedad del contrato.
     * @dev Sobreescribe Ownable.renounceOwnership() para prevenir que el protocolo
     * quede permanentemente sin administrador. En su lugar, usar transferOwnership()
     * para migrar el control a un Gnosis Safe (multisig) en producción.
     */
    function renounceOwnership() public pure override {
        revert("RED: Ownership renunciation is disabled");
    }

    /**
     * @notice Asigna la dirección del Motor Principal. IRREVERSIBLE.
     * @dev Solo puede llamarse una vez por el Owner. Patrón de Bloqueo Irreversible.
     * @param _protocol Dirección del contrato WintonProtocol desplegado.
     */
    function setWintonProtocol(address _protocol) external onlyOwner {
        // SEGURIDAD: Solo se permite configurar una vez.
        require(!protocolLocked, "RED: Protocol already locked");
        // SEGURIDAD: Prevenir configuración a dirección vacía.
        require(_protocol != address(0), "RED: Invalid zero address");
        
        // Asignar y bloquear permanentemente.
        wintonProtocol = _protocol;
        protocolLocked = true;
        
        // Registro auditable.
        emit ProtocolSet(_protocol);
    }

    /// @dev Modificador que restringe funciones exclusivamente al WintonProtocol.
    modifier onlyProtocol() {
        require(msg.sender == wintonProtocol, "RED: Unauthorized. Only WintonProtocol");
        _;
    }

    /**
     * @notice Asigna deuda al usuario (Mintea RED).
     * @dev Solo WintonProtocol puede llamar esta función durante processPayment().
     * @param to Dirección del deudor que recibirá la deuda.
     * @param amount Cantidad de deuda a asignar (en wei, 18 decimales).
     */
    function mintDebt(address to, uint256 amount) external onlyProtocol {
        _mint(to, amount);
    }

    /**
     * @notice Cancela deuda del usuario (Quema RED) durante auto-amortización.
     * @dev Solo WintonProtocol puede llamar esta función.
     * @param from Dirección del deudor cuya deuda será reducida.
     * @param amount Cantidad de deuda a cancelar (en wei, 18 decimales).
     */
    function burnDebt(address from, uint256 amount) external onlyProtocol {
        _burn(from, amount);
    }

    /**
     * @notice BLOQUEADO. La deuda no se puede transferir a otro usuario.
     * @dev Previene que un deudor escape de su responsabilidad enviando 
     * su deuda a una billetera desechable o a un tercero inocente.
     */
    function transfer(address, uint256) public pure override returns (bool) {
        revert("RED: Debt tokens are non-transferable");
    }

    /// @notice BLOQUEADO. Previene transferencias delegadas de deuda.
    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert("RED: Debt tokens are non-transferable");
    }

    /**
     * @notice BLOQUEADO. No se permite aprobar allowances sobre deuda.
     * @dev Previene un vector de ataque donde un contrato malicioso podría
     * manipular la deuda de un usuario mediante approve + transferFrom.
     */
    function approve(address, uint256) public pure override returns (bool) {
        revert("RED: Debt tokens cannot be approved");
    }
}
