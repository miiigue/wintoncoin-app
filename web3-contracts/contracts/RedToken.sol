// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RedToken
 * @dev Representación de la Deuda en WintonCoin.
 * A diferencia del BLUE, el RED NO es transferible entre usuarios.
 * Solo puede ser creado (cuando asumes deuda) o destruido (auto-amortización).
 */
contract RedToken is ERC20, Ownable {
    address public wintonProtocol;

    constructor() ERC20("Winton RED Debt", "RED") Ownable(msg.sender) {}

    function setWintonProtocol(address _protocol) external onlyOwner {
        require(_protocol != address(0), "Invalid address");
        wintonProtocol = _protocol;
    }

    modifier onlyProtocol() {
        require(msg.sender == wintonProtocol, "RED: Unauthorized. Only WintonProtocol");
        _;
    }

    /**
     * @dev Asigna deuda al usuario (Mintea RED).
     */
    function mintDebt(address to, uint256 amount) external onlyProtocol {
        _mint(to, amount);
    }

    /**
     * @dev Cancela deuda del usuario (Quema RED).
     */
    function burnDebt(address from, uint256 amount) external onlyProtocol {
        _burn(from, amount);
    }

    /**
     * @dev Bloquea las transferencias manuales. La deuda no se puede enviar a otro.
     */
    function transfer(address, uint256) public pure override returns (bool) {
        revert("RED: Debt tokens are non-transferable");
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert("RED: Debt tokens are non-transferable");
    }
}
