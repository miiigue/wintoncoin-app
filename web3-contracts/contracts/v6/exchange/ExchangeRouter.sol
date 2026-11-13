// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./FifoOrderBook.sol";
import "./ExchangeCustody.sol";
import "./ExchangeConfig.sol";
import "./AmortizationAdapter.sol";

interface IModeForExchange { function mode() external view returns (uint8); }
interface IRiskForExchange {
    function isKYCVerified(address account) external view returns (bool);
    function verificationPair(address first, address second) external view returns (bool, bool);
}

/// @notice Single public mutation surface for the modular V6 exchange.
contract ExchangeRouter is ReentrancyGuard {
    uint8 private constant NORMAL = 0;
    uint8 private constant PRELAUNCH_FROZEN = 1;
    uint128 public constant MIN_ORDER_AMOUNT = 1_000_000;
    IModeForExchange public immutable modes;
    IRiskForExchange public immutable risk;
    FifoOrderBook public immutable book;
    ExchangeCustody public immutable custody;
    ExchangeConfig public immutable config;
    AmortizationAdapter public immutable amortization;
    uint256 public blueCursor;
    uint256 public usdtCursor;

    event OrderOpened(uint64 indexed orderId, address indexed user, FifoOrderBook.Side side, uint128 amount);
    event OrdersMatched(uint64 indexed blueOrderId, uint64 indexed usdtOrderId, uint128 gross, uint128 fee);
    event OrderCancelled(uint64 indexed orderId, address indexed user, uint128 personalRefund, uint128 collateralRefund);
    event OrderSkipped(uint64 indexed orderId, address indexed user);
    error InvalidDependency(); error OperationsFrozen(); error ExitOnly(); error KycNotVerified();
    error InvalidAmount(); error Unauthorized(); error NoPendingRefund();

    constructor(address modeController, address riskRegistry, address orderBook, address exchangeCustody,
        address exchangeConfig, address amortizationAdapter) {
        if (modeController.code.length == 0 || riskRegistry.code.length == 0 || orderBook.code.length == 0 ||
            exchangeCustody.code.length == 0 || exchangeConfig.code.length == 0 || amortizationAdapter.code.length == 0)
            revert InvalidDependency();
        modes = IModeForExchange(modeController); risk = IRiskForExchange(riskRegistry);
        book = FifoOrderBook(orderBook); custody = ExchangeCustody(exchangeCustody);
        config = ExchangeConfig(exchangeConfig); amortization = AmortizationAdapter(amortizationAdapter);
    }

    function createOrder(FifoOrderBook.Side side, uint128 amount) external nonReentrant returns (uint64 id) {
        _normal(); _kyc(msg.sender); if (amount < MIN_ORDER_AMOUNT) revert InvalidAmount();
        ExchangeCustody.Asset asset = side == FifoOrderBook.Side.BLUE_FOR_USDT
            ? ExchangeCustody.Asset.BLUE : ExchangeCustody.Asset.USDT;
        custody.deposit(asset, msg.sender, amount);
        id = book.create(msg.sender, side, amount); emit OrderOpened(id, msg.sender, side, amount);
    }

    /// @notice Opens a USDT order physically funded by the linked Vault but owned by the user.
    function createCollateralOrder(address user, uint128 amount) external nonReentrant returns (uint64 id) {
        _normal();
        if (msg.sender != amortization.vault()) revert Unauthorized();
        _kyc(user);
        if (amount < MIN_ORDER_AMOUNT) revert InvalidAmount();
        custody.deposit(ExchangeCustody.Asset.USDT, msg.sender, amount);
        id = book.create(user, FifoOrderBook.Side.USDT_FOR_BLUE, amount);
        emit OrderOpened(id, user, FifoOrderBook.Side.USDT_FOR_BLUE, amount);
    }

    /// @notice Matches only the earliest active order of each side within a bounded scan.
    function matchNext(uint256 maximumScanned) external nonReentrant returns (uint128 gross) {
        _normal(); if (maximumScanned == 0) revert InvalidAmount();
        (FifoOrderBook.MatchCandidate memory blueOrder,
            FifoOrderBook.MatchCandidate memory usdtOrder) = book.nextPair(blueCursor, usdtCursor, maximumScanned);
        if (blueOrder.id == 0 || usdtOrder.id == 0) return 0;
        (bool blueVerified, bool usdtVerified) = risk.verificationPair(blueOrder.user, usdtOrder.user);
        if (!blueVerified) {
            book.suspend(blueOrder.id); blueCursor = blueOrder.index + 1;
            emit OrderSkipped(blueOrder.id, blueOrder.user); return 0;
        }
        if (!usdtVerified) {
            book.suspend(usdtOrder.id); usdtCursor = usdtOrder.index + 1;
            emit OrderSkipped(usdtOrder.id, usdtOrder.user); return 0;
        }
        gross = blueOrder.remaining < usdtOrder.remaining ? blueOrder.remaining : usdtOrder.remaining;
        (uint128 secured, address blueRecipient) = amortization.quote(usdtOrder.id, gross);
        if (secured > 0) gross = secured; else blueRecipient = usdtOrder.user;
        uint128 fee = uint128(uint256(gross) * config.feeBps() / 10_000);
        uint128 net = gross - fee;
        book.applyMatchedFill(blueOrder.id, usdtOrder.id, gross);
        if (gross == blueOrder.remaining) blueCursor = blueOrder.index + 1; else blueCursor = blueOrder.index;
        if (gross == usdtOrder.remaining) usdtCursor = usdtOrder.index + 1; else usdtCursor = usdtOrder.index;
        if (fee == 0) custody.settleMatchWithoutFees(blueOrder.user, blueRecipient, gross);
        else custody.settleMatch(blueOrder.user, blueRecipient, gross, net, net, fee, fee);
        if (secured > 0) amortization.consume(usdtOrder.id, gross, net);
        emit OrdersMatched(blueOrder.id, usdtOrder.id, gross, fee);
    }

    function cancelOrder(uint64 orderId) external nonReentrant {
        _exitAllowed();
        FifoOrderBook.Order memory current = book.order(orderId);
        if (current.user != msg.sender) revert Unauthorized();
        (, FifoOrderBook.Side side, uint128 refundAmount) = book.cancel(orderId);
        uint128 collateralRefund; address vaultRecipient;
        if (side == FifoOrderBook.Side.USDT_FOR_BLUE) {
            (collateralRefund, vaultRecipient) = amortization.release(orderId, refundAmount);
            if (collateralRefund > 0) custody.refund(ExchangeCustody.Asset.USDT, vaultRecipient, collateralRefund, false);
        }
        uint128 personal = refundAmount - collateralRefund;
        if (personal > 0) {
            ExchangeCustody.Asset asset = side == FifoOrderBook.Side.BLUE_FOR_USDT
                ? ExchangeCustody.Asset.BLUE : ExchangeCustody.Asset.USDT;
            custody.refund(asset, msg.sender, personal, !risk.isKYCVerified(msg.sender));
        }
        emit OrderCancelled(orderId, msg.sender, personal, collateralRefund);
    }

    function claimPending(ExchangeCustody.Asset asset) external nonReentrant {
        _exitAllowed(); _kyc(msg.sender);
        uint128 amount = custody.pendingRefund(msg.sender, asset); if (amount == 0) revert NoPendingRefund();
        custody.releasePending(asset, msg.sender, msg.sender, amount);
    }
    function resumeOrder(uint64 orderId) external nonReentrant {
        _normal(); _kyc(msg.sender); FifoOrderBook.Order memory value = book.order(orderId);
        if (value.user != msg.sender) revert Unauthorized(); book.resume(orderId);
    }
    function claimFees() external nonReentrant { _normal(); custody.claimFees(); }
    function blueToken() external view returns (address) { return address(custody.blue()); }

    function _normal() private view { uint8 value = modes.mode(); if (value == PRELAUNCH_FROZEN) revert OperationsFrozen(); if (value != NORMAL) revert ExitOnly(); }
    function _exitAllowed() private view { if (modes.mode() == PRELAUNCH_FROZEN) revert OperationsFrozen(); }
    function _kyc(address user) private view { if (!risk.isKYCVerified(user)) revert KycNotVerified(); }
}
