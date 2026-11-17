// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IVaultModeV6 { function mode() external view returns (uint8); }
interface IVaultRiskV6 { function isKYCVerified(address user) external view returns (bool); }
interface IVaultPaymentEngineV6 {
    function amortizeFromCollateral(address user, address blueHolder, uint256 amount) external;
    function requiredCollateral(address user) external view returns (uint256);
    function settleMatured(address user) external returns (uint256);
    function ledger() external view returns (address);
}
interface IVaultLedgerV6 {
    function matured(address user) external view returns (uint256);
    function outstanding(address user) external view returns (uint256);
}
interface IVaultBookV6 { function collateralOrderRemaining(uint64 id,address user) external view returns(uint128); }
interface IVaultExchangeConfigV6 { function feeBps() external view returns (uint16); }
interface IVaultRouterV6 {
    function createCollateralOrder(address user, uint128 amount) external returns (uint64);
    function custody() external view returns (address);
    function amortization() external view returns (address);
    function book() external view returns (address);
    function config() external view returns (address);
}
interface IVaultAdapterV6 {
    function register(uint64 orderId, address user, uint128 amount) external;
    function unreserve(uint64 orderId, address user, uint128 amount) external;
    function custody() external view returns (address);
}

/// @notice V6 physical USDT custody. Exchange reservations remain part of the
/// same collateral balance and can never be withdrawn or counted twice.
contract CollateralVaultV6 is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    uint8 private constant NORMAL = 0;
    uint8 private constant PRELAUNCH_FROZEN = 1;

    IERC20 public immutable usdt;
    IVaultModeV6 public immutable modes;
    IVaultRiskV6 public immutable risk;
    IVaultPaymentEngineV6 public immutable engine;
    IVaultRouterV6 public immutable router;
    IVaultAdapterV6 public immutable adapter;
    address public immutable exchangeCustody;

    mapping(address => uint256) public collateralBalance;
    mapping(address => uint256) public exchangeReserved;
    mapping(uint64 => address) public orderUser;
    mapping(uint64 => uint128) public orderReserved;
    uint256 public totalCollateral;
    uint256 public totalExchangeReserved;
    mapping(address => bool) public automaticExchangeCollateral;
    // Distinguishes user-funded Exchange orders from Vault-originated amortization orders.
    mapping(uint64 => bool) public existingOrder;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event CollateralOrderCreated(address indexed user, uint64 indexed orderId, uint128 amount);
    event CollateralConsumed(address indexed user, uint64 indexed orderId, uint128 grossUsdt, uint128 blueBurned);
    event CollateralReturned(address indexed user, uint64 indexed orderId, uint128 amount);
    event AutomaticExchangeCollateralChanged(address indexed user, bool enabled);
    event ExistingOrderCollateralized(address indexed user, uint64 indexed orderId, uint128 amount, bool automatic);
    event ExistingOrderCollateralReleased(address indexed user, uint64 indexed orderId, uint128 amount);

    error InvalidDependency(); error InvalidAmount(); error NotNormal(); error ExitsNotAllowed();
    error KycNotVerified(); error InsufficientFreeCollateral(); error Unauthorized(); error InvalidOrder();
    error DepositAmountMismatch(); error Insolvent(); error OwnershipRenunciationDisabled();

    constructor(address usdtToken, address modeController, address riskRegistry, address paymentEngine,
        address exchangeRouter, address amortizationAdapter, address custodyAddress) Ownable(msg.sender) {
        address[7] memory dependencies = [usdtToken, modeController, riskRegistry, paymentEngine,
            exchangeRouter, amortizationAdapter, custodyAddress];
        for (uint256 i; i < dependencies.length; i++) {
            if (dependencies[i] == address(0) || dependencies[i].code.length == 0) revert InvalidDependency();
        }
        if (IERC20Metadata(usdtToken).decimals() != 6) revert InvalidDependency();
        if (IVaultRouterV6(exchangeRouter).custody() != custodyAddress ||
            IVaultRouterV6(exchangeRouter).amortization() != amortizationAdapter ||
            IVaultAdapterV6(amortizationAdapter).custody() != custodyAddress) revert InvalidDependency();
        usdt = IERC20(usdtToken); modes = IVaultModeV6(modeController); risk = IVaultRiskV6(riskRegistry);
        engine = IVaultPaymentEngineV6(paymentEngine); router = IVaultRouterV6(exchangeRouter);
        adapter = IVaultAdapterV6(amortizationAdapter); exchangeCustody = custodyAddress;
    }

    function deposit(uint256 amount) external nonReentrant {
        _normal(); _kyc(msg.sender);
        _deposit(msg.sender, amount);
        _assertSolvent(); emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        _exits(); _kyc(msg.sender);
        if (amount == 0 || amount > freeCollateral(msg.sender)) revert InsufficientFreeCollateral();
        collateralBalance[msg.sender] -= amount; totalCollateral -= amount;
        usdt.safeTransfer(msg.sender, amount); _assertSolvent(); emit Withdrawn(msg.sender, amount);
    }

    function createAmortizationOrder(uint128 amount) external nonReentrant returns (uint64 orderId) {
        _normal(); _kyc(msg.sender);
        orderId = _createAmortizationOrder(msg.sender, amount);
    }

    /// @notice Consent can be revoked; it never releases amounts already reserved.
    function setAutomaticExchangeCollateral(bool enabled) external {
        _normal(); _kyc(msg.sender);
        automaticExchangeCollateral[msg.sender] = enabled;
        emit AutomaticExchangeCollateralChanged(msg.sender, enabled);
    }

    /// @notice Pledges an existing user-funded USDT order without moving its funds.
    /// Applies parked BLUE against matured RED first and caps reservation to residual RED.
    function collateralizeExisting(uint64 orderId, uint128 amount) external nonReentrant {
        _normal(); _kyc(msg.sender);
        uint128 remaining = IVaultBookV6(router.book()).collateralOrderRemaining(orderId, msg.sender);
        if (amount == 0 || remaining == 0 || amount > remaining) revert InvalidOrder();
        // Burn any parked BLUE against matured commitments before locking USDT collateral.
        uint256 settled = engine.settleMatured(msg.sender);
        _reconcileExisting(msg.sender, orderId);
        if (uint256(orderReserved[orderId]) + amount > remaining) revert InvalidOrder();
        uint256 needed = _budget(IVaultLedgerV6(engine.ledger()).outstanding(msg.sender));
        uint256 currentReserved = exchangeReserved[msg.sender];
        if (needed <= currentReserved) {
            if (settled > 0) return;
            revert InvalidAmount();
        }
        uint256 cap = needed - currentReserved;
        uint128 reserveAmount = uint256(amount) <= cap ? amount : uint128(cap);
        _collateralizeExisting(msg.sender, orderId, reserveAmount, false);
    }

    /// @notice Anyone may invoke the overdue workflow; no on-chain transaction is automatic.
    /// Reconciles prior existing-order excess even when automatic protection is disabled.
    function protectOverdue(address user, uint64 orderId) external nonReentrant {
        _normal(); _kyc(user);
        engine.settleMatured(user);
        // Release excess reservation if RED decreased via another payment path before match/cancel.
        _reconcileExisting(user, orderId);
        if (!automaticExchangeCollateral[user]) return;
        uint256 matured = IVaultLedgerV6(engine.ledger()).matured(user);
        uint256 unreservedVault = collateralBalance[user] - exchangeReserved[user];
        if (matured <= unreservedVault) return;
        uint256 targetReserve = _budget(matured - unreservedVault);
        if (targetReserve <= exchangeReserved[user]) return;
        uint128 orderRemaining = IVaultBookV6(router.book()).collateralOrderRemaining(orderId, user);
        uint128 old = orderReserved[orderId];
        if (orderRemaining <= old) return;
        uint256 needed = targetReserve - exchangeReserved[user];
        uint128 available = orderRemaining - old;
        uint128 amount = needed < available ? uint128(needed) : available;
        _collateralizeExisting(user, orderId, amount, true);
    }

    function _collateralizeExisting(address user, uint64 orderId, uint128 amount, bool automatic) private {
        uint128 remaining = IVaultBookV6(router.book()).collateralOrderRemaining(orderId, user);
        if (amount == 0 || remaining == 0 || uint256(orderReserved[orderId]) + amount > remaining) revert InvalidOrder();
        address previous = orderUser[orderId];
        if (previous != address(0) && (previous != user || !existingOrder[orderId])) revert InvalidOrder();
        orderUser[orderId] = user;
        existingOrder[orderId] = true;
        orderReserved[orderId] += amount;
        collateralBalance[user] += amount; totalCollateral += amount;
        exchangeReserved[user] += amount; totalExchangeReserved += amount;
        adapter.register(orderId, user, amount);
        _assertSolvent(); emit ExistingOrderCollateralized(user, orderId, amount, automatic);
    }

    /// @notice Releases excess Exchange reservation on an existing user-funded order
    /// when total outstanding RED drops below the reserved amount (e.g. external amortization).
    function _reconcileExisting(address user, uint64 orderId) private {
        if (!existingOrder[orderId] || orderUser[orderId] != user) return;
        uint128 reserved = orderReserved[orderId];
        if (reserved == 0) return;
        uint256 needed = _budget(IVaultLedgerV6(engine.ledger()).outstanding(user));
        uint256 currentReserved = exchangeReserved[user];
        if (currentReserved <= needed) return;
        uint256 excess = currentReserved - needed;
        uint128 releaseAmount = excess < reserved ? uint128(excess) : reserved;
        orderReserved[orderId] = reserved - releaseAmount;
        if (orderReserved[orderId] == 0) {
            delete orderUser[orderId];
            delete existingOrder[orderId];
        }
        exchangeReserved[user] = currentReserved - releaseAmount;
        totalExchangeReserved -= releaseAmount;
        collateralBalance[user] -= releaseAmount;
        totalCollateral -= releaseAmount;
        adapter.unreserve(orderId, user, releaseAmount);
        _assertSolvent();
        emit ExistingOrderCollateralReleased(user, orderId, releaseAmount);
    }

    function _budget(uint256 targetRed) private view returns (uint256) {
        if (targetRed == 0) return 0;
        uint256 feeBps = IVaultExchangeConfigV6(router.config()).feeBps();
        return (targetRed * 10_000) / (10_000 - feeBps);
    }

    /// @notice Deposits USDT and reserves it in the FIFO amortization queue in
    /// one atomic operation. A failure in any module rolls the whole deposit back.
    function depositAndCreateAmortizationOrder(uint128 amount)
        external nonReentrant returns (uint64 orderId)
    {
        _normal(); _kyc(msg.sender);
        _deposit(msg.sender, amount);
        emit Deposited(msg.sender, amount);
        orderId = _createAmortizationOrder(msg.sender, amount);
        _assertSolvent();
    }

    function _deposit(address user, uint256 amount) private {
        if (amount == 0) revert InvalidAmount();
        uint256 beforeBalance = usdt.balanceOf(address(this));
        usdt.safeTransferFrom(user, address(this), amount);
        if (usdt.balanceOf(address(this)) - beforeBalance != amount) revert DepositAmountMismatch();
        collateralBalance[user] += amount; totalCollateral += amount;
    }

    function _createAmortizationOrder(address user, uint128 amount) private returns (uint64 orderId) {
        if (amount == 0 || amount > unreservedCollateral(user)) revert InsufficientFreeCollateral();
        exchangeReserved[user] += amount; totalExchangeReserved += amount;
        usdt.forceApprove(exchangeCustody, amount);
        orderId = router.createCollateralOrder(user, amount);
        usdt.forceApprove(exchangeCustody, 0);
        orderUser[orderId] = user; orderReserved[orderId] = amount;
        adapter.register(orderId, user, amount);
        emit CollateralOrderCreated(user, orderId, amount);
    }

    function onCollateralFill(address user, uint64 orderId, uint128 grossUsdt, uint128 netBlue)
        external nonReentrant {
        if (msg.sender != address(adapter)) revert Unauthorized();
        _exits();
        _consumeReservation(user, orderId, grossUsdt);
        collateralBalance[user] -= grossUsdt; totalCollateral -= grossUsdt;
        if (netBlue > 0) engine.amortizeFromCollateral(user, address(this), netBlue);
        _assertSolvent(); emit CollateralConsumed(user, orderId, grossUsdt, netBlue);
    }

    function onCollateralRefund(address user, uint64 orderId, uint128 amount) external nonReentrant {
        if (msg.sender != address(adapter)) revert Unauthorized();
        _exits(); _consumeReservation(user, orderId, amount);
        emit CollateralReturned(user, orderId, amount);
    }

    function collateralCoverage(address user) external view returns (uint256) { return collateralBalance[user]; }
    function freeCollateral(address user) public view returns (uint256) {
        uint256 required = engine.requiredCollateral(user);
        // Overdue RED is protected even when it is within the ordinary credit limit.
        uint256 matured = IVaultLedgerV6(engine.ledger()).matured(user);
        if (matured > required) required = matured;
        uint256 reserved = exchangeReserved[user];
        uint256 locked = required > reserved ? required : reserved;
        uint256 balance = collateralBalance[user];
        return balance > locked ? balance - locked : 0;
    }
    function unreservedCollateral(address user) public view returns (uint256) {
        return collateralBalance[user] - exchangeReserved[user];
    }
    function solvent() external view returns (bool) {
        return usdt.balanceOf(address(this)) >= totalCollateral - totalExchangeReserved;
    }

    function _consumeReservation(address user, uint64 orderId, uint128 amount) private {
        if (orderUser[orderId] != user || amount == 0 || amount > orderReserved[orderId]) revert InvalidOrder();
        orderReserved[orderId] -= amount; exchangeReserved[user] -= amount; totalExchangeReserved -= amount;
        if (orderReserved[orderId] == 0) {
            delete orderUser[orderId];
            delete existingOrder[orderId];
        }
    }
    function _normal() private view { if (modes.mode() != NORMAL) revert NotNormal(); }
    function _exits() private view { if (modes.mode() == PRELAUNCH_FROZEN) revert ExitsNotAllowed(); }
    function _kyc(address user) private view { if (!risk.isKYCVerified(user)) revert KycNotVerified(); }
    function _assertSolvent() private view {
        if (usdt.balanceOf(address(this)) < totalCollateral - totalExchangeReserved) revert Insolvent();
    }
    function renounceOwnership() public pure override { revert OwnershipRenunciationDisabled(); }
}
