// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./FifoOrderBook.sol";
import "./ExchangeCustody.sol";

interface IModeForAdapter { function mode() external view returns (uint8); }
interface IAmortizationVaultV6 {
    function onCollateralFill(address user, uint64 orderId, uint128 grossUsdt, uint128 netBlue) external;
    function onCollateralRefund(address user, uint64 orderId, uint128 amount) external;
}

/// @notice Records which part of one physical USDT order is pledged to RED.
/// It never holds assets; the same custody reserve cannot be registered twice.
contract AmortizationAdapter is Ownable2Step, ReentrancyGuard {
    struct Reservation { address user; uint128 remaining; }
    uint8 private constant NORMAL = 0;
    IModeForAdapter public immutable modes;
    FifoOrderBook public immutable book;
    ExchangeCustody public immutable custody;
    address public router;
    address public vault;
    uint128 public totalCollateralReserved;
    mapping(uint64 => Reservation) private _reservations;

    event IntegrationLocked(address indexed router, address indexed vault);
    event CollateralRegistered(address indexed user, uint64 indexed orderId, uint128 amount);
    event CollateralConsumed(address indexed user, uint64 indexed orderId, uint128 grossUsdt, uint128 netBlue);
    event CollateralReleased(address indexed user, uint64 indexed orderId, uint128 amount);
    error Unauthorized(); error InvalidAddress(); error IntegrationAlreadyLocked(); error InvalidOrder();
    error InvalidAmount(); error NotNormal(); error InsufficientPhysicalReserve();

    constructor(address modeController, address orderBook, address exchangeCustody) Ownable(msg.sender) {
        if (modeController.code.length == 0 || orderBook.code.length == 0 || exchangeCustody.code.length == 0)
            revert InvalidAddress();
        modes = IModeForAdapter(modeController); book = FifoOrderBook(orderBook); custody = ExchangeCustody(exchangeCustody);
    }
    modifier onlyRouter() { if (msg.sender != router) revert Unauthorized(); _; }
    modifier onlyVault() { if (msg.sender != vault) revert Unauthorized(); _; }

    function setIntegration(address routerAddress, address vaultAddress) external onlyOwner {
        if (router != address(0)) revert IntegrationAlreadyLocked();
        if (routerAddress.code.length == 0 || vaultAddress.code.length == 0) revert InvalidAddress();
        router = routerAddress; vault = vaultAddress; emit IntegrationLocked(routerAddress, vaultAddress);
    }

    function register(uint64 orderId, address user, uint128 amount) external onlyVault {
        if (modes.mode() != NORMAL) revert NotNormal();
        if (user == address(0) || amount == 0) revert InvalidAmount();
        FifoOrderBook.Order memory value = book.order(orderId);
        if (value.user != user || value.side != FifoOrderBook.Side.USDT_FOR_BLUE ||
            (value.status != FifoOrderBook.Status.OPEN && value.status != FifoOrderBook.Status.PARTIALLY_FILLED))
            revert InvalidOrder();
        Reservation storage storedReservation = _reservations[orderId];
        if (storedReservation.user != address(0) && storedReservation.user != user) revert InvalidOrder();
        if (uint256(storedReservation.remaining) + amount > value.remaining) revert InvalidAmount();
        if (uint256(totalCollateralReserved) + amount > custody.totalReserved(uint256(ExchangeCustody.Asset.USDT)))
            revert InsufficientPhysicalReserve();
        storedReservation.user = user; storedReservation.remaining += amount; totalCollateralReserved += amount;
        emit CollateralRegistered(user, orderId, amount);
    }

    function quote(uint64 orderId, uint128 maximum) external view returns (uint128 amount, address recipient) {
        uint128 reserved = _reservations[orderId].remaining;
        amount = reserved < maximum ? reserved : maximum;
        recipient = amount == 0 ? address(0) : vault;
    }

    function consume(uint64 orderId, uint128 grossUsdt, uint128 netBlue) external onlyRouter nonReentrant {
        Reservation storage storedReservation = _reservations[orderId];
        if (grossUsdt == 0 || grossUsdt > storedReservation.remaining) revert InvalidAmount();
        address user = storedReservation.user;
        storedReservation.remaining -= grossUsdt; totalCollateralReserved -= grossUsdt;
        IAmortizationVaultV6(vault).onCollateralFill(user, orderId, grossUsdt, netBlue);
        emit CollateralConsumed(user, orderId, grossUsdt, netBlue);
    }

    function release(uint64 orderId, uint128 maximum) external onlyRouter nonReentrant returns (uint128 amount, address recipient) {
        Reservation storage storedReservation = _reservations[orderId];
        amount = storedReservation.remaining < maximum ? storedReservation.remaining : maximum;
        if (amount == 0) return (0, address(0));
        address user = storedReservation.user;
        storedReservation.remaining -= amount; totalCollateralReserved -= amount;
        recipient = vault;
        IAmortizationVaultV6(vault).onCollateralRefund(user, orderId, amount);
        emit CollateralReleased(user, orderId, amount);
    }

    function reservation(uint64 orderId) external view returns (address user, uint128 remaining) {
        Reservation storage value = _reservations[orderId]; return (value.user, value.remaining);
    }
    function renounceOwnership() public pure override { revert Unauthorized(); }
}
