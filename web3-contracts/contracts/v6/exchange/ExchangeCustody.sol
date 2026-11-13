// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IExchangeConfigV6 { function treasury() external view returns (address); }

/// @notice Asset custody and double-entry reserves. It contains no order selection logic.
contract ExchangeCustody is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    enum Asset { BLUE, USDT }
    IERC20 public immutable blue; IERC20 public immutable usdt;
    address public router; IExchangeConfigV6 public config;
    uint128[2] public totalReserved; uint128[2] public totalPendingRefund; uint128[2] public accumulatedFees;
    mapping(address => uint128[2]) private _pendingRefund;
    event IntegrationLocked(address indexed router, address indexed config);
    event Deposited(Asset indexed asset, address indexed user, uint128 amount);
    event MatchSettled(address indexed blueSeller, address indexed usdtBuyer, uint128 gross);
    event Refunded(Asset indexed asset, address indexed user, uint128 amount, bool held);
    event PendingReleased(Asset indexed asset, address indexed user, address indexed recipient, uint128 amount);
    event FeesClaimed(address indexed treasury, uint128 blueAmount, uint128 usdtAmount);
    error Unauthorized(); error InvalidAddress(); error InvalidToken(); error InvalidDecimals();
    error IntegrationAlreadyLocked(); error InvalidAmount(); error DepositAmountMismatch();
    error InsufficientReserve(); error InsufficientPendingRefund(); error Insolvent();

    constructor(address blueAsset, address usdtAsset) Ownable(msg.sender) {
        if (blueAsset == address(0) || usdtAsset == address(0) || blueAsset == usdtAsset) revert InvalidToken();
        if (blueAsset.code.length == 0 || usdtAsset.code.length == 0) revert InvalidToken();
        if (IERC20Metadata(blueAsset).decimals() != 6 || IERC20Metadata(usdtAsset).decimals() != 6) revert InvalidDecimals();
        blue = IERC20(blueAsset); usdt = IERC20(usdtAsset);
    }
    modifier onlyRouter() { if (msg.sender != router) revert Unauthorized(); _; }
    function setIntegration(address routerAddress, address configAddress) external onlyOwner {
        if (router != address(0)) revert IntegrationAlreadyLocked();
        if (routerAddress.code.length == 0 || configAddress.code.length == 0) revert InvalidAddress();
        router = routerAddress; config = IExchangeConfigV6(configAddress);
        emit IntegrationLocked(routerAddress, configAddress);
    }
    function deposit(Asset asset, address from, uint128 amount) external onlyRouter nonReentrant {
        if (from == address(0) || amount == 0) revert InvalidAmount(); IERC20 token = _token(asset);
        uint256 beforeBalance = token.balanceOf(address(this)); token.safeTransferFrom(from, address(this), amount);
        uint256 afterBalance = token.balanceOf(address(this));
        if (afterBalance - beforeBalance != amount) revert DepositAmountMismatch();
        totalReserved[uint8(asset)] += amount;
        if (afterBalance < liabilities(asset)) revert Insolvent();
        emit Deposited(asset, from, amount);
    }
    function settleMatch(address blueSeller, address usdtBuyer, uint128 gross, uint128 blueNet,
        uint128 usdtNet, uint128 blueFee, uint128 usdtFee) external onlyRouter nonReentrant {
        if (blueSeller == address(0) || usdtBuyer == address(0) || gross == 0) revert InvalidAmount();
        if (uint256(blueNet) + blueFee != gross || uint256(usdtNet) + usdtFee != gross) revert InvalidAmount();
        _consumeReserve(Asset.BLUE, gross); _consumeReserve(Asset.USDT, gross);
        accumulatedFees[0] += blueFee; accumulatedFees[1] += usdtFee;
        blue.safeTransfer(usdtBuyer, blueNet); usdt.safeTransfer(blueSeller, usdtNet);
        _assertSolvent(Asset.BLUE); _assertSolvent(Asset.USDT); emit MatchSettled(blueSeller, usdtBuyer, gross);
    }
    function settleMatchWithoutFees(address blueSeller, address usdtBuyer, uint128 gross)
        external onlyRouter nonReentrant
    {
        if (blueSeller == address(0) || usdtBuyer == address(0) || gross == 0) revert InvalidAmount();
        _consumeReserve(Asset.BLUE, gross); _consumeReserve(Asset.USDT, gross);
        blue.safeTransfer(usdtBuyer, gross); usdt.safeTransfer(blueSeller, gross);
        _assertSolvent(Asset.BLUE); _assertSolvent(Asset.USDT);
        emit MatchSettled(blueSeller, usdtBuyer, gross);
    }
    function refund(Asset asset, address user, uint128 amount, bool hold) external onlyRouter nonReentrant {
        if (user == address(0) || amount == 0) revert InvalidAmount(); _consumeReserve(asset, amount);
        if (hold) { _pendingRefund[user][uint8(asset)] += amount; totalPendingRefund[uint8(asset)] += amount; }
        else _token(asset).safeTransfer(user, amount);
        _assertSolvent(asset); emit Refunded(asset, user, amount, hold);
    }
    function releasePending(Asset asset, address user, address recipient, uint128 amount) external onlyRouter nonReentrant {
        if (recipient == address(0) || amount == 0) revert InvalidAmount(); uint8 index = uint8(asset);
        uint128 pending = _pendingRefund[user][index]; if (amount > pending) revert InsufficientPendingRefund();
        _pendingRefund[user][index] = pending - amount; totalPendingRefund[index] -= amount;
        _token(asset).safeTransfer(recipient, amount); _assertSolvent(asset);
        emit PendingReleased(asset, user, recipient, amount);
    }
    function claimFees() external onlyRouter nonReentrant {
        address recipient = config.treasury(); if (recipient == address(0)) revert InvalidAddress();
        uint128 blueAmount = accumulatedFees[0]; uint128 usdtAmount = accumulatedFees[1];
        accumulatedFees[0] = 0; accumulatedFees[1] = 0;
        if (blueAmount > 0) blue.safeTransfer(recipient, blueAmount);
        if (usdtAmount > 0) usdt.safeTransfer(recipient, usdtAmount);
        _assertSolvent(Asset.BLUE); _assertSolvent(Asset.USDT);
        emit FeesClaimed(recipient, blueAmount, usdtAmount);
    }
    function pendingRefund(address user, Asset asset) external view returns (uint128) { return _pendingRefund[user][uint8(asset)]; }
    /// @notice Compatibility getter used by BLUE V6 when permanently linking its exchange custody.
    function blueToken() external view returns (address) { return address(blue); }
    function liabilities(Asset asset) public view returns (uint256) {
        uint8 index = uint8(asset); return uint256(totalReserved[index]) + totalPendingRefund[index] + accumulatedFees[index];
    }
    function solvent(Asset asset) external view returns (bool) { return _token(asset).balanceOf(address(this)) >= liabilities(asset); }
    function _consumeReserve(Asset asset, uint128 amount) private {
        uint8 index = uint8(asset); uint128 reserve = totalReserved[index];
        if (amount > reserve) revert InsufficientReserve(); totalReserved[index] = reserve - amount;
    }
    function _assertSolvent(Asset asset) private view {
        if (_token(asset).balanceOf(address(this)) < liabilities(asset)) revert Insolvent();
    }
    function _token(Asset asset) private view returns (IERC20) { return asset == Asset.BLUE ? blue : usdt; }
    function renounceOwnership() public pure override { revert Unauthorized(); }
}
