// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Timelocked economic configuration, isolated from custody and matching.
contract ExchangeConfig is Ownable2Step {
    uint16 public constant MAX_FEE_BPS = 500;
    uint48 public constant DELAY = 48 hours;
    uint48 public constant GRACE = 7 days;
    uint16 public feeBps; address public treasury;
    uint16 public pendingFeeBps; uint48 public feeReadyAt;
    address public pendingTreasury; uint48 public treasuryReadyAt;
    event FeeProposed(uint16 value, uint48 readyAt); event FeeUpdated(uint16 previous, uint16 current);
    event TreasuryProposed(address indexed value, uint48 readyAt);
    event TreasuryUpdated(address indexed previous, address indexed current);
    event ProposalCancelled(bytes32 indexed kind);
    error InvalidAddress(); error InvalidFee(); error ProposalPending(); error NoProposal();
    error TimelockActive(); error ProposalExpired(); error Unauthorized();

    constructor(address initialTreasury, uint16 initialFeeBps) Ownable(msg.sender) {
        if (initialTreasury == address(0)) revert InvalidAddress();
        if (initialFeeBps > MAX_FEE_BPS) revert InvalidFee();
        treasury = initialTreasury; feeBps = initialFeeBps;
    }
    function proposeFee(uint16 value) external onlyOwner {
        if (value > MAX_FEE_BPS) revert InvalidFee(); if (feeReadyAt != 0) revert ProposalPending();
        pendingFeeBps = value; feeReadyAt = uint48(block.timestamp) + DELAY; emit FeeProposed(value, feeReadyAt);
    }
    function executeFee() external {
        uint48 ready = feeReadyAt; _ready(ready); uint16 previous = feeBps;
        feeBps = pendingFeeBps; pendingFeeBps = 0; feeReadyAt = 0; emit FeeUpdated(previous, feeBps);
    }
    function cancelFee() external onlyOwner {
        if (feeReadyAt == 0) revert NoProposal(); pendingFeeBps = 0; feeReadyAt = 0;
        emit ProposalCancelled(keccak256("FEE"));
    }
    function proposeTreasury(address value) external onlyOwner {
        if (value == address(0)) revert InvalidAddress(); if (treasuryReadyAt != 0) revert ProposalPending();
        pendingTreasury = value; treasuryReadyAt = uint48(block.timestamp) + DELAY;
        emit TreasuryProposed(value, treasuryReadyAt);
    }
    function executeTreasury() external {
        uint48 ready = treasuryReadyAt; _ready(ready); address previous = treasury;
        treasury = pendingTreasury; pendingTreasury = address(0); treasuryReadyAt = 0;
        emit TreasuryUpdated(previous, treasury);
    }
    function cancelTreasury() external onlyOwner {
        if (treasuryReadyAt == 0) revert NoProposal(); pendingTreasury = address(0); treasuryReadyAt = 0;
        emit ProposalCancelled(keccak256("TREASURY"));
    }
    function _ready(uint48 ready) private view {
        if (ready == 0) revert NoProposal(); if (block.timestamp < ready) revert TimelockActive();
        if (block.timestamp > uint256(ready) + GRACE) revert ProposalExpired();
    }
    function renounceOwnership() public pure override { revert Unauthorized(); }
}
