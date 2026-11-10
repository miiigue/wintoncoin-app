// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Minimal on-chain risk facts consumed by V6 economic modules.
/// Legal KYC/AML evidence remains off-chain; this registry only exposes the
/// currently approved protocol decision.
contract RiskRegistry is Ownable2Step {
    struct Profile { uint128 creditLimit; uint8 level; bool kycVerified; }
    mapping(address => Profile) private _profiles;
    address public riskOperator;

    event RiskOperatorChanged(address indexed previousOperator, address indexed newOperator);
    event ProfileUpdated(address indexed account, bool kycVerified, uint128 creditLimit, uint8 level);
    error UnauthorizedRiskOperator();
    error ZeroAddress();
    error InvalidLevel();
    error OwnershipRenunciationDisabled();

    constructor(address initialOperator) Ownable(msg.sender) {
        if (initialOperator == address(0)) revert ZeroAddress();
        riskOperator = initialOperator;
        emit RiskOperatorChanged(address(0), initialOperator);
    }

    modifier onlyRiskOperator() {
        if (msg.sender != riskOperator && msg.sender != owner()) revert UnauthorizedRiskOperator();
        _;
    }

    function setRiskOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert ZeroAddress();
        address previous = riskOperator;
        riskOperator = newOperator;
        emit RiskOperatorChanged(previous, newOperator);
    }

    function setProfile(address account, bool verified, uint128 newCreditLimit, uint8 level)
        external onlyRiskOperator
    {
        if (account == address(0)) revert ZeroAddress();
        if (level > 6) revert InvalidLevel();
        _profiles[account] = Profile(newCreditLimit, level, verified);
        emit ProfileUpdated(account, verified, newCreditLimit, level);
    }

    function profile(address account) external view returns (Profile memory) { return _profiles[account]; }
    function isKYCVerified(address account) external view returns (bool) { return _profiles[account].kycVerified; }
    function creditLimit(address account) external view returns (uint256) { return _profiles[account].creditLimit; }
    function userLevel(address account) external view returns (uint8) { return _profiles[account].level; }

    function renounceOwnership() public pure override { revert OwnershipRenunciationDisabled(); }
}
