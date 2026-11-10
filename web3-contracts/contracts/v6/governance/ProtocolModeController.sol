// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Single source of truth for the operational state of every V6 module.
/// @dev Governance should be a Safe/timelock. A guardian may only move to a
/// stricter state; it can never restore normal operation.
contract ProtocolModeController is Ownable2Step {
    enum OperationalMode { NORMAL, PRELAUNCH_FROZEN, EMERGENCY_EXIT_ONLY }

    OperationalMode public mode = OperationalMode.PRELAUNCH_FROZEN;
    address public guardian;

    event OperationalModeChanged(OperationalMode indexed previousMode, OperationalMode indexed newMode, address indexed actor);
    event GuardianChanged(address indexed previousGuardian, address indexed newGuardian);

    error UnauthorizedGuardian();
    error GuardianCannotRelaxMode();
    error ModeUnchanged();

    constructor(address initialGuardian) Ownable(msg.sender) {
        guardian = initialGuardian;
        emit GuardianChanged(address(0), initialGuardian);
        emit OperationalModeChanged(OperationalMode.NORMAL, OperationalMode.PRELAUNCH_FROZEN, msg.sender);
    }

    function setGuardian(address newGuardian) external onlyOwner {
        address previous = guardian;
        guardian = newGuardian;
        emit GuardianChanged(previous, newGuardian);
    }

    /// @notice Governance transition. Returning to NORMAL is intentionally
    /// restricted to the owner, which should be a Safe/timelock in deployment.
    function setMode(OperationalMode newMode) external onlyOwner { _setMode(newMode); }

    /// @notice Immediate circuit breaker. NORMAL -> EMERGENCY/PRELAUNCH and
    /// EMERGENCY -> PRELAUNCH are the only guardian transitions.
    function guardianRestrictTo(OperationalMode newMode) external {
        if (msg.sender != guardian) revert UnauthorizedGuardian();
        OperationalMode current = mode;
        bool stricter =
            (current == OperationalMode.NORMAL && newMode != OperationalMode.NORMAL) ||
            (current == OperationalMode.EMERGENCY_EXIT_ONLY && newMode == OperationalMode.PRELAUNCH_FROZEN);
        if (!stricter) revert GuardianCannotRelaxMode();
        _setMode(newMode);
    }

    function isNormal() external view returns (bool) { return mode == OperationalMode.NORMAL; }
    function exitsAllowed() external view returns (bool) { return mode != OperationalMode.PRELAUNCH_FROZEN; }

    function _setMode(OperationalMode newMode) private {
        OperationalMode previous = mode;
        if (previous == newMode) revert ModeUnchanged();
        mode = newMode;
        emit OperationalModeChanged(previous, newMode, msg.sender);
    }

    function renounceOwnership() public pure override { revert("ModeController: ownership renunciation disabled"); }
}
