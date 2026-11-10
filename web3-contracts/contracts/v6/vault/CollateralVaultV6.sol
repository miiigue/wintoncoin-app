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
}
interface IVaultRouterV6 {
    function createCollateralOrder(address user, uint128 amount) external returns (uint64);
    function custody() external view returns (address);
    function amortization() external view returns (address);
}
interface IVaultAdapterV6 {
    function register(uint64 orderId, address user, uint128 amount) external;
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

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event CollateralOrderCreated(address indexed user, uint64 indexed orderId, uint128 amount);
    event CollateralConsumed(address indexed user, uint64 indexed orderId, uint128 grossUsdt, uint128 blueBurned);
    event CollateralReturned(address indexed user, uint64 indexed orderId, uint128 amount);

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
        _normal(); _kyc(msg.sender); if (amount == 0) revert InvalidAmount();
        uint256 beforeBalance = usdt.balanceOf(address(this));
        usdt.safeTransferFrom(msg.sender, address(this), amount);
        if (usdt.balanceOf(address(this)) - beforeBalance != amount) revert DepositAmountMismatch();
        collateralBalance[msg.sender] += amount; totalCollateral += amount;
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
        if (amount == 0 || amount > unreservedCollateral(msg.sender)) revert InsufficientFreeCollateral();
        exchangeReserved[msg.sender] += amount; totalExchangeReserved += amount;
        usdt.forceApprove(exchangeCustody, amount);
        orderId = router.createCollateralOrder(msg.sender, amount);
        usdt.forceApprove(exchangeCustody, 0);
        orderUser[orderId] = msg.sender; orderReserved[orderId] = amount;
        adapter.register(orderId, msg.sender, amount);
        emit CollateralOrderCreated(msg.sender, orderId, amount);
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
    }
    function _normal() private view { if (modes.mode() != NORMAL) revert NotNormal(); }
    function _exits() private view { if (modes.mode() == PRELAUNCH_FROZEN) revert ExitsNotAllowed(); }
    function _kyc(address user) private view { if (!risk.isKYCVerified(user)) revert KycNotVerified(); }
    function _assertSolvent() private view {
        if (usdt.balanceOf(address(this)) < totalCollateral - totalExchangeReserved) revert Insolvent();
    }
    function renounceOwnership() public pure override { revert OwnershipRenunciationDisabled(); }
}
