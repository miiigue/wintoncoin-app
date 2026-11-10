// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

interface IV6PairControllerRed {
    function redToken() external view returns (address);
}

/// @notice Non-transferable V6 commitment token. Only the paired-supply
/// controller may create or extinguish RED.
contract RedTokenV6 is ERC20, Ownable2Step {
    address public supplyController;
    bool public supplyControllerLocked;

    event SupplyControllerSet(address indexed controller);

    error ZeroAddress();
    error InvalidContract();
    error InvalidSupplyController();
    error SupplyControllerAlreadySet();
    error UnauthorizedSupplyController();
    error NonTransferable();
    error OwnershipRenunciationDisabled();

    constructor() ERC20("RED Commitment Token V6", "RED") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) { return 6; }

    modifier onlySupplyController() {
        if (msg.sender != supplyController) revert UnauthorizedSupplyController();
        _;
    }

    function setSupplyController(address controller) external onlyOwner {
        if (supplyControllerLocked) revert SupplyControllerAlreadySet();
        if (controller == address(0)) revert ZeroAddress();
        if (controller.code.length == 0) revert InvalidContract();
        if (IV6PairControllerRed(controller).redToken() != address(this)) revert InvalidSupplyController();
        supplyController = controller;
        supplyControllerLocked = true;
        emit SupplyControllerSet(controller);
    }

    function mintCommitment(address to, uint256 amount) external onlySupplyController {
        if (to == address(0)) revert ZeroAddress();
        _mint(to, amount);
    }

    function burnCommitment(address from, uint256 amount) external onlySupplyController {
        if (from == address(0)) revert ZeroAddress();
        _burn(from, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) revert NonTransferable();
        super._update(from, to, value);
    }

    function renounceOwnership() public pure override { revert OwnershipRenunciationDisabled(); }
}
