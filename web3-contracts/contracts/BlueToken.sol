// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BlueToken
 * @dev El activo líquido de WintonCoin.
 * Cumple con el estándar ERC-20, pero su emisión y quema están estrictamente
 * controladas por el contrato WintonProtocol para asegurar el balance económico.
 */
contract BlueToken is ERC20, Ownable {
    address public wintonProtocol;

    constructor() ERC20("Winton BLUE", "BLUE") Ownable(msg.sender) {}

    /**
     * @dev Asigna la dirección del Motor Principal. Solo el dueño puede hacerlo.
     */
    function setWintonProtocol(address _protocol) external onlyOwner {
        require(_protocol != address(0), "Invalid address");
        wintonProtocol = _protocol;
    }

    modifier onlyProtocol() {
        require(msg.sender == wintonProtocol, "BLUE: Unauthorized. Only WintonProtocol");
        _;
    }

    /**
     * @dev Mintea nuevos tokens BLUE. Exclusivo del Motor Principal durante un pago.
     */
    function mint(address to, uint256 amount) external onlyProtocol {
        _mint(to, amount);
    }

    /**
     * @dev Quema tokens BLUE. Exclusivo del Motor Principal durante la auto-amortización.
     */
    function burn(address from, uint256 amount) external onlyProtocol {
        _burn(from, amount);
    }
}
