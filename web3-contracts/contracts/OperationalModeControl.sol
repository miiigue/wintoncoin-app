// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Three-state circuit breaker shared by the economic contracts.
/// NORMAL permits ordinary protocol activity. PRELAUNCH_FROZEN blocks every
/// user mutation. EMERGENCY_EXIT_ONLY blocks new exposure while permitting
/// narrowly-scoped exits and debt reduction through `whenExitAllowed`.
abstract contract OperationalModeControl {
    enum OperationalMode {
        NORMAL,
        PRELAUNCH_FROZEN,
        EMERGENCY_EXIT_ONLY
    }

    OperationalMode public operationalMode;

    event OperationalModeChanged(
        OperationalMode indexed previousMode,
        OperationalMode indexed newMode
    );
    error EnforcedPause();
    error PrelaunchFrozen();

    constructor() {
        operationalMode = OperationalMode.PRELAUNCH_FROZEN;
        emit OperationalModeChanged(
            OperationalMode.NORMAL,
            OperationalMode.PRELAUNCH_FROZEN
        );
    }

    function paused() external view returns (bool) {
        return operationalMode != OperationalMode.NORMAL;
    }

    modifier whenNotPaused() {
        if (operationalMode != OperationalMode.NORMAL) revert EnforcedPause();
        _;
    }

    modifier whenExitAllowed() {
        if (operationalMode == OperationalMode.PRELAUNCH_FROZEN) revert PrelaunchFrozen();
        _;
    }

    function _enterPrelaunchFreeze() internal {
        _changeOperationalMode(OperationalMode.PRELAUNCH_FROZEN);
    }

    function _enterEmergencyExitOnly() internal {
        _changeOperationalMode(OperationalMode.EMERGENCY_EXIT_ONLY);
    }

    function _resumeNormalOperation() internal {
        _changeOperationalMode(OperationalMode.NORMAL);
    }

    function _changeOperationalMode(OperationalMode newMode) private {
        OperationalMode previous = operationalMode;
        operationalMode = newMode;
        emit OperationalModeChanged(previous, newMode);
    }
}
