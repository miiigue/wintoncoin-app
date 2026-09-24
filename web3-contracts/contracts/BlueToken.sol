// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title BlueToken (BLUE) - Suite V4
 * @notice Token de activo circulante del ecosistema. Cumple el estándar ERC-20.
 * @dev Diseñado para Optimism Sepolia y L2 con precisión de 6 decimales (paridad 1:1 con USDT).
 * 
 * PRINCIPIOS DE SEGURIDAD FINTECH & ZERO-TRUST:
 * 1. Precisión Unificada: 6 decimales nativos para eliminar discrepancias aritméticas con USDT.
 * 2. Cero Hooks Externos: Se erradican llamadas económicas en `_update` para prevenir reentrancias y fallos de disponibilidad.
 * 3. Control de Emisión Estricto: Solo el contrato de protocolo central tiene autorización para mintear y quemar.
 * 4. Gobernanza en Dos Pasos: Hereda Ownable2Step para evitar pérdidas accidentales de titularidad hacia direcciones erróneas.
 * 5. Prohibición de Renuncia: `renounceOwnership()` revierte para impedir que el contrato quede sin administración.
 */
interface IBlueKYC { function isKYCVerified(address user) external view returns (bool); }
interface IBlueExchange { function blueToken() external view returns (address); }

contract BlueToken is ERC20, Ownable2Step {
    struct ParkingLot { uint256 remaining; uint256 releaseAt; }
    mapping(address => ParkingLot[]) public parkingLots;
    mapping(address => uint256) public parkingHead;
    address public exchange;
    event ParkingCreated(address indexed user, uint256 indexed index, uint256 amount, uint256 releaseAt);
    event ExchangeSet(address indexed exchange);

    function setExchange(address target) external onlyOwner {
        require(exchange == address(0), "BLUE: Exchange already set");
        require(target.code.length > 0 && IBlueExchange(target).blueToken() == address(this), "BLUE: Invalid exchange");
        exchange = target;
        emit ExchangeSet(target);
    }

    function mintWithParking(address to, uint256 amount, uint256 releaseAt) external onlyProtocol {
        require(releaseAt > block.timestamp, "BLUE: Parking must be in the future");
        _mintParked(to, amount, releaseAt);
    }

    function _mintParked(address to, uint256 amount, uint256 releaseAt) private {
        require(to != address(0), "BLUE: Cannot mint to zero address");
        _mint(to, amount);
        parkingLots[to].push(ParkingLot(amount, releaseAt));
        emit ParkingCreated(to, parkingLots[to].length - 1, amount, releaseAt);
    }

    function parkingLotsCount(address user) external view returns (uint256) { return parkingLots[user].length; }

    function lockedBalanceOf(address user) public view returns (uint256 locked) {
        ParkingLot[] storage lots = parkingLots[user];
        for (uint256 i = parkingHead[user]; i < lots.length; i++) {
            if (lots[i].releaseAt > block.timestamp) locked += lots[i].remaining;
        }
    }

    function availableBalanceOf(address user) external view returns (uint256) {
        return balanceOf(user) - lockedBalanceOf(user);
    }

    // Permissionless bounded housekeeping. Never deletes a user's token balance.
    function cleanParking(address user, uint256 maxLots) external {
        uint256 head = parkingHead[user];
        ParkingLot[] storage lots = parkingLots[user];
        for (uint256 scanned; head < lots.length && scanned < maxLots; scanned++) {
            if (lots[head].remaining > 0 && lots[head].releaseAt > block.timestamp) break;
            delete lots[head];
            head++;
        }
        parkingHead[user] = head;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            require(exchange != address(0) && msg.sender == exchange
                && (from == exchange || to == exchange), "BLUE: Transfers only through exchange");
            address user = from == exchange ? to : from;
            require(IBlueKYC(coreProtocol).isKYCVerified(user), "BLUE: KYC not verified");
            if (from != exchange) {
                require(value <= balanceOf(from) - lockedBalanceOf(from), "BLUE: Parking not released");
                uint256 remaining = value;
                ParkingLot[] storage lots = parkingLots[from];
                for (uint256 i = parkingHead[from]; i < lots.length && remaining > 0; i++) {
                    if (lots[i].releaseAt > block.timestamp) continue;
                    uint256 spent = remaining < lots[i].remaining ? remaining : lots[i].remaining;
                    lots[i].remaining -= spent;
                    remaining -= spent;
                }
            }
        }
        super._update(from, to, value);
    }


    // ========================================================================
    // VARIABLES DE ESTADO
    // ========================================================================

    /// @notice Dirección del contrato de protocolo central autorizado exclusivamente para emitir y destruir tokens.
    address public coreProtocol;

    /// @notice Bandera de bloqueo inmutable: true indica que el protocolo fue asignado de forma permanente.
    bool public protocolLocked;

    // ========================================================================
    // EVENTOS AUDITABLES
    // ========================================================================

    /// @notice Evento emitido al enlazar de forma irreversible la dirección del protocolo central.
    /// @param protocol Dirección del contrato de protocolo central verificado.
    event ProtocolSet(address indexed protocol);

    // ========================================================================
    // MODIFICADORES DE CONTROL DE ACCESO
    // ========================================================================

    /// @dev Modificador que restringe la ejecución exclusivamente al contrato de protocolo central enlazado.
    modifier onlyProtocol() {
        require(msg.sender == coreProtocol, "BLUE: Unauthorized. Caller is not core protocol");
        _;
    }

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * @notice Constructor del token BLUE. Inicializa el nombre y símbolo bajo estándar ERC-20.
     * @dev No acuña suministro inicial; toda emisión se realiza bajo el principio de Balance Cero respaldado.
     */
    constructor() ERC20("BLUE Token", "BLUE") Ownable(msg.sender) {}

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
     * @notice Enlaza permanentemente el contrato de protocolo central. Operación irreversible.
     * @dev Solo puede ser ejecutado una única vez por el Propietario (o Multisig de Gobernanza).
     * @param _protocol Dirección del contrato de protocolo central desplegado en la red.
     */
    function setCoreProtocol(address _protocol) external onlyOwner {
        // SEGURIDAD: Prevenir reconfiguración si ya fue sellado (Patrón de Bloqueo Inmutable).
        require(!protocolLocked, "BLUE: Protocol reference is already locked");
        // SEGURIDAD: Prevenir asignación a dirección cero.
        require(_protocol != address(0), "BLUE: Cannot set protocol to zero address");

        coreProtocol = _protocol;
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
    // FUNCIONES ECONÓMICAS OPERATIVAS (SOLO PROTOCOLO CENTRAL)
    // ========================================================================

    /**
     * @notice Emite nuevos tokens BLUE hacia una cuenta beneficiaria durante un pago del marketplace.
     * @dev Exclusivo del protocolo central. El Owner no puede emitir tokens arbitrariamente.
     * @param to Dirección de la cuenta que recibirá los tokens emitidos.
     * @param amount Cantidad exacta de tokens a emitir (expresada en unidades base con 6 decimales).
     */
    function mint(address to, uint256 amount) external onlyProtocol {
        require(to != address(0), "BLUE: Cannot mint to zero address");
        _mintParked(to, amount, block.timestamp + 30 days);
    }

    /**
     * @notice Quema tokens BLUE para amortización voluntaria, pago con saldo ganado o compensación de compromisos.
     * @dev Exclusivo del protocolo central.
     * @param from Dirección de la cuenta de la cual se deducirán y destruirán los tokens.
     * @param amount Cantidad exacta de tokens a quemar (expresada en 6 decimales).
     */
    function burn(address from, uint256 amount) external onlyProtocol {
        require(from != address(0), "BLUE: Cannot burn from zero address");
        // Consume parked BLUE by reception order; unlocked remainder needs no lot.
        uint256 remaining = amount;
        ParkingLot[] storage lots = parkingLots[from];
        for (uint256 i = parkingHead[from]; i < lots.length && remaining > 0; i++) {
            uint256 used = remaining < lots[i].remaining ? remaining : lots[i].remaining;
            lots[i].remaining -= used;
            remaining -= used;
        }
        _burn(from, amount);
        uint256 head = parkingHead[from];
        while (head < lots.length && lots[head].remaining == 0) head++;
        parkingHead[from] = head;
    }
}
