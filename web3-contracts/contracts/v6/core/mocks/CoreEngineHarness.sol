// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../PaymentAuthorization.sol";
import "../CommitmentLedger.sol";

/// @dev Test-only caller that models the one linked engine address.
contract CoreEngineHarness {
    function consumeAuthorization(PaymentAuthorization authorization,
        PaymentAuthorization.Payment calldata payment, bytes calldata signature) external returns (bytes32) {
        return authorization.consume(payment, signature);
    }
    function create(CommitmentLedger ledger, address account, uint256 amount, uint256 dueAt,
        uint256 fee, uint256 margin) external returns (uint256) {
        return ledger.createCommitment(account, amount, dueAt, fee, margin);
    }
    function extend(CommitmentLedger ledger, address account, uint256 lotId, uint256 dueAt,
        uint256 fee, uint256 margin) external {
        ledger.extendCommitment(account, lotId, dueAt, fee, margin);
    }
    function amortize(CommitmentLedger ledger, address account, uint256 amount, bool maturedOnly)
        external returns (uint256) {
        return ledger.amortize(account, amount, maturedOnly);
    }
}
