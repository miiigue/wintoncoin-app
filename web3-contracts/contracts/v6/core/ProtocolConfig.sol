// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Timelocked economic parameters for V6 payment modules.
contract ProtocolConfig is Ownable2Step {
    uint48 public constant UPDATE_DELAY = 48 hours;
    uint48 public constant UPDATE_GRACE_PERIOD = 7 days;
    uint16 public constant MAX_COMMISSION_BPS = 1_000;
    struct Config { uint128 maxPayment; uint48 commitmentDuration; uint16 commissionBps; }
    Config private _active;
    Config private _pending;
    uint48 public pendingUnlockAt;

    event ConfigProposed(uint128 maxPayment, uint48 commitmentDuration, uint16 commissionBps, uint48 unlockAt);
    event ConfigActivated(uint128 maxPayment, uint48 commitmentDuration, uint16 commissionBps);
    event ConfigProposalCancelled();
    error InvalidConfig();
    error ProposalPending();
    error NoPendingProposal();
    error TimelockNotExpired();
    error ProposalExpired();
    error OwnershipRenunciationDisabled();

    constructor(uint128 maxPayment, uint48 commitmentDuration, uint16 commissionBps) Ownable(msg.sender) {
        _validate(maxPayment, commitmentDuration, commissionBps);
        _active = Config(maxPayment, commitmentDuration, commissionBps);
        emit ConfigActivated(maxPayment, commitmentDuration, commissionBps);
    }

    function activeConfig() external view returns (Config memory) { return _active; }
    function pendingConfig() external view returns (Config memory) { return _pending; }

    function proposeConfig(uint128 maxPayment, uint48 commitmentDuration, uint16 commissionBps) external onlyOwner {
        if (pendingUnlockAt != 0) revert ProposalPending();
        _validate(maxPayment, commitmentDuration, commissionBps);
        uint48 unlockAt = uint48(block.timestamp) + UPDATE_DELAY;
        _pending = Config(maxPayment, commitmentDuration, commissionBps);
        pendingUnlockAt = unlockAt;
        emit ConfigProposed(maxPayment, commitmentDuration, commissionBps, unlockAt);
    }

    function executeConfig() external {
        uint48 unlockAt = pendingUnlockAt;
        if (unlockAt == 0) revert NoPendingProposal();
        if (block.timestamp < unlockAt) revert TimelockNotExpired();
        if (block.timestamp > uint256(unlockAt) + UPDATE_GRACE_PERIOD) revert ProposalExpired();
        Config memory next = _pending;
        _active = next;
        delete _pending;
        pendingUnlockAt = 0;
        emit ConfigActivated(next.maxPayment, next.commitmentDuration, next.commissionBps);
    }

    function cancelConfig() external onlyOwner {
        if (pendingUnlockAt == 0) revert NoPendingProposal();
        delete _pending;
        pendingUnlockAt = 0;
        emit ConfigProposalCancelled();
    }

    function _validate(uint128 maxPayment, uint48 commitmentDuration, uint16 commissionBps) private pure {
        if (maxPayment == 0 || commitmentDuration == 0 || commissionBps > MAX_COMMISSION_BPS) revert InvalidConfig();
    }

    function renounceOwnership() public pure override { revert OwnershipRenunciationDisabled(); }
}
