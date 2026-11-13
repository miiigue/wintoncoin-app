// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../FifoOrderBook.sol";
import "../ExchangeCustody.sol";
import "../AmortizationAdapter.sol";

/// @dev Test-only caller used to exercise module boundaries before Router exists.
contract ExchangeRouterHarness {
    FifoOrderBook public immutable book;
    ExchangeCustody public immutable custody;
    constructor(address bookAddress, address custodyAddress) {
        book = FifoOrderBook(bookAddress); custody = ExchangeCustody(custodyAddress);
    }
    function create(address user, FifoOrderBook.Side side, uint128 amount) external returns (uint64) { return book.create(user, side, amount); }
    function fill(uint64 id, uint128 amount) external { book.applyFill(id, amount); }
    function fillPair(uint64 blueId, uint64 usdtId, uint128 amount) external { book.applyMatchedFill(blueId, usdtId, amount); }
    function cancel(uint64 id) external returns (address, FifoOrderBook.Side, uint128) { return book.cancel(id); }
    function suspend(uint64 id) external { book.suspend(id); }
    function resume(uint64 id) external returns (uint64) { return book.resume(id); }
    function deposit(ExchangeCustody.Asset asset, address user, uint128 amount) external { custody.deposit(asset, user, amount); }
    function settle(address blueSeller, address usdtBuyer, uint128 gross, uint128 blueNet,
        uint128 usdtNet, uint128 blueFee, uint128 usdtFee) external {
        custody.settleMatch(blueSeller, usdtBuyer, gross, blueNet, usdtNet, blueFee, usdtFee);
    }
    function settleWithoutFees(address blueSeller, address usdtBuyer, uint128 gross) external {
        custody.settleMatchWithoutFees(blueSeller, usdtBuyer, gross);
    }
    function refund(ExchangeCustody.Asset asset, address user, uint128 amount, bool hold) external { custody.refund(asset, user, amount, hold); }
    function release(ExchangeCustody.Asset asset, address user, address recipient, uint128 amount) external {
        custody.releasePending(asset, user, recipient, amount);
    }
    function claimFees() external { custody.claimFees(); }
}

contract AmortizationVaultHarness {
    AmortizationAdapter public immutable adapter;
    uint128 public filledUsdt;
    uint128 public receivedBlue;
    uint128 public refundedUsdt;
    constructor(address adapterAddress) { adapter = AmortizationAdapter(adapterAddress); }
    function register(uint64 orderId, address user, uint128 amount) external { adapter.register(orderId, user, amount); }
    function onCollateralFill(address, uint64, uint128 grossUsdt, uint128 netBlue) external {
        require(msg.sender == address(adapter), "only adapter"); filledUsdt += grossUsdt; receivedBlue += netBlue;
    }
    function onCollateralRefund(address, uint64, uint128 amount) external {
        require(msg.sender == address(adapter), "only adapter"); refundedUsdt += amount;
    }
}
