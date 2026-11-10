// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BlueExchangeV6Mock {
    address public immutable blueToken;
    constructor(address blue) { blueToken = blue; }
    function depositFrom(address user, uint256 amount) external {
        IERC20(blueToken).transferFrom(user, address(this), amount);
    }
    function refund(address user, uint256 amount) external {
        IERC20(blueToken).transfer(user, amount);
    }
}
