// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Interfaces para interactuar con los tokens
interface IBlueToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

interface IRedToken {
    function mintDebt(address to, uint256 amount) external;
    function burnDebt(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title WintonProtocol (El Motor Central)
 * @dev Implementa la lógica de Cero Gas (EIP-2771) y las Leyes Económicas
 * de Creación y Destrucción Simultánea (Materia-Antimateria).
 */
contract WintonProtocol is Ownable, ERC2771Context, ReentrancyGuard {
    IBlueToken public blueToken;
    IRedToken public redToken;
    address public treasury; // WintonTreasury.sol
    
    uint256 public commissionRate = 5; // 5% por defecto

    // Muro KYC On-Chain
    mapping(address => bool) public isKYCVerified;

    event PaymentProcessed(address indexed payer, address indexed payee, uint256 amountBlue, uint256 fee);
    event AutoAmortization(address indexed user, uint256 amountBurned);

    event ContractsUpdated(address blue, address red, address treasuryWallet);
    event KYCStatusUpdated(address indexed wallet, bool status);
    event CommissionRateUpdated(uint256 oldRate, uint256 newRate);

    constructor(address _trustedForwarder) 
        ERC2771Context(_trustedForwarder) 
        Ownable(msg.sender) 
    {}

    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }

    function setContracts(address _blue, address _red, address _treasury) external onlyOwner {
        require(_blue != address(0) && _red != address(0) && _treasury != address(0), "WintonProtocol: Invalid zero address");
        blueToken = IBlueToken(_blue);
        redToken = IRedToken(_red);
        treasury = _treasury;
        emit ContractsUpdated(_blue, _red, _treasury);
    }

    function setKYCStatus(address _wallet, bool _status) external onlyOwner {
        require(_wallet != address(0), "WintonProtocol: Invalid zero address");
        isKYCVerified[_wallet] = _status;
        emit KYCStatusUpdated(_wallet, _status);
    }

    function setCommissionRate(uint256 _newRate) external onlyOwner {
        require(_newRate <= 50, "WintonProtocol: Commission too high"); // Max 50% safety cap
        emit CommissionRateUpdated(commissionRate, _newRate);
        commissionRate = _newRate;
    }

    /**
     * @dev Función principal de pago. El Relayer llama a esta función con la firma del usuario.
     * _msgSender() extrae automáticamente al usuario original gracias a ERC2771.
     */
    function processPayment(address payee, uint256 amountBlue) external nonReentrant {
        address payer = _msgSender();

        require(isKYCVerified[payer], "Payer KYC not verified");
        require(isKYCVerified[payee], "Payee KYC not verified");
        require(amountBlue > 0, "Amount must be greater than 0");

        // Cálculo de Comisión
        uint256 fee = (amountBlue * commissionRate) / 100;
        uint256 totalDebt = amountBlue + fee;

        // REGLA 1: Minteo Simultáneo (Balance Cero)
        redToken.mintDebt(payer, totalDebt); // Se crea Deuda RED para el pagador
        blueToken.mint(payee, amountBlue);   // Se crea BLUE líquido para el que recibe
        blueToken.mint(treasury, fee);       // Se crea BLUE líquido para la Tesorería (Comisión)

        emit PaymentProcessed(payer, payee, amountBlue, fee);

        // REGLA 2: Auto-Amortización (Comprobar si el receptor tiene deuda previa)
        _autoAmortize(payee);
    }

    /**
     * @dev Destruye simultáneamente saldo BLUE y deuda RED si coexisten.
     */
    function _autoAmortize(address user) internal {
        uint256 blueBalance = blueToken.balanceOf(user);
        uint256 redBalance = redToken.balanceOf(user);

        if (blueBalance > 0 && redBalance > 0) {
            uint256 amountToBurn = blueBalance < redBalance ? blueBalance : redBalance;
            
            blueToken.burn(user, amountToBurn);
            redToken.burnDebt(user, amountToBurn);

            emit AutoAmortization(user, amountToBurn);
        }
    }
}
