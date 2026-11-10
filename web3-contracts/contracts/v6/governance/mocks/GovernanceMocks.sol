// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPairControllerCalls {
    function mintPair(address redAccount, address blueAccount, uint256 amount, uint256 releaseAt) external;
    function burnPair(address redAccount, address blueAccount, uint256 amount) external;
}

contract PairedOperatorMock {
    function mint(address controller, address redAccount, address blueAccount, uint256 amount, uint256 releaseAt) external {
        IPairControllerCalls(controller).mintPair(redAccount, blueAccount, amount, releaseAt);
    }
    function burn(address controller, address redAccount, address blueAccount, uint256 amount) external {
        IPairControllerCalls(controller).burnPair(redAccount, blueAccount, amount);
    }
}

contract PairedTokenMock {
    uint8 public immutable decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    constructor(uint8 tokenDecimals) { decimals = tokenDecimals; }
    function seed(address user, uint256 amount) external { balanceOf[user] += amount; totalSupply += amount; }
    function mintWithParking(address to, uint256 amount, uint256) external { balanceOf[to] += amount; totalSupply += amount; }
    function mintCommitment(address to, uint256 amount) external { balanceOf[to] += amount; totalSupply += amount; }
    function burn(address from, uint256 amount) external { balanceOf[from] -= amount; totalSupply -= amount; }
    function burnCommitment(address from, uint256 amount) external { balanceOf[from] -= amount; totalSupply -= amount; }
}
