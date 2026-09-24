// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IAmortizationVault.sol";

interface ICoreVault {
    function isKYCVerified(address user) external view returns (bool);
    function getRequiredCollateral(address user) external view returns (uint256);
    function getMaturedDebt(address user) external view returns (uint256);
    function getCoverageShortfall(address user) external view returns (uint256);
    function redToken() external view returns (address);
    function onCollateralRepayment(address user, uint256 amount) external;
}
interface IExchangeVault {
    function usdtToken() external view returns (address);
    function feeBps() external view returns (uint16);
    function MIN_ORDER_AMOUNT() external view returns (uint128);
    function createAmortizationOrder(address user, uint128 amount) external returns (uint64);
}

/// @notice Collateral is counted once across Vault and FIFO. Only purchased BLUE
/// settles RED. Cancelled orders return funds here, never bypassing withdrawals.
contract CollateralVault is Ownable2Step, ReentrancyGuard, Pausable, IAmortizationVault {
    using SafeERC20 for IERC20;
    IERC20 public immutable collateralToken;
    address public coreProtocol;
    address public exchange;
    bool public protocolLocked;
    mapping(address => uint256) public userCollateral;
    uint256 public totalCollateralLocked;
    uint256 public totalExchangeReserved;
    mapping(address => uint256) public exchangeReserved;
    mapping(address => uint256) public pendingReserve;
    mapping(address => uint64) public activeAmortizationOrder;
    mapping(address => bool) public pendingMaturedOnly;
    struct Purchase { address user; uint128 remaining; bool maturedOnly; }
    mapping(uint64 => Purchase) public purchases;
    event CollateralDeposited(address indexed user, uint256 amount, uint256 newUserTotal, uint256 newVaultTotal);
    event CollateralWithdrawn(address indexed user, uint256 amount, uint256 newUserTotal, uint256 newVaultTotal);
    event CoreContractsLinked(address indexed protocol, address indexed exchangeAddress);
    event AmortizationQueued(address indexed user, uint256 pendingAmount, bool maturedOnly);
    event AmortizationOrderCreated(address indexed user, uint64 indexed orderId, uint256 amount);
    event AmortizationPurchaseFilled(address indexed user, uint64 indexed orderId, uint256 usdtSpent, uint256 blueBurned);
    event AmortizationReserveReturned(address indexed user, uint64 indexed orderId, uint256 amount);

    constructor(address token) Ownable(msg.sender) {
        require(token.code.length > 0 && IERC20Metadata(token).decimals() == 6, "Vault: Invalid collateral token");
        collateralToken = IERC20(token);
    }
    modifier onlyExchange() { require(msg.sender == exchange, "Vault: Only exchange"); _; }
    function _kyc(address user) private view {
        require(coreProtocol != address(0) && ICoreVault(coreProtocol).isKYCVerified(user), "Vault: KYC not verified");
    }
    function linkCoreContracts(address core, address market) external onlyOwner {
        require(!protocolLocked, "Vault: Core contracts are already locked");
        require(core.code.length > 0 && market.code.length > 0, "Vault: Invalid contracts");
        require(IExchangeVault(market).usdtToken() == address(collateralToken), "Vault: Collateral mismatch");
        coreProtocol = core;
        exchange = market;
        protocolLocked = true;
        emit CoreContractsLinked(core, market);
    }
    function deposit(uint256 value) external nonReentrant whenNotPaused {
        _kyc(msg.sender);
        require(value > 0, "Vault: Deposit amount must be greater than zero");
        uint256 beforeBalance = collateralToken.balanceOf(address(this));
        collateralToken.safeTransferFrom(msg.sender, address(this), value);
        require(collateralToken.balanceOf(address(this)) - beforeBalance == value, "Vault: Deposit amount mismatch");
        userCollateral[msg.sender] += value;
        totalCollateralLocked += value;
        emit CollateralDeposited(msg.sender, value, userCollateral[msg.sender], totalCollateralLocked);
    }
    function getFreeCollateral(address user) public view returns (uint256) {
        if (coreProtocol == address(0)) return 0;
        uint256 required = ICoreVault(coreProtocol).getRequiredCollateral(user);
        uint256 reserved = exchangeReserved[user] + pendingReserve[user];
        if (reserved > required) required = reserved;
        return userCollateral[user] > required ? userCollateral[user] - required : 0;
    }
    function withdraw(uint256 value) external nonReentrant whenNotPaused {
        _kyc(msg.sender);
        _refreshPending(msg.sender);
        require(value > 0 && value <= getFreeCollateral(msg.sender), "Vault: Requested amount exceeds free collateral");
        userCollateral[msg.sender] -= value;
        totalCollateralLocked -= value;
        collateralToken.safeTransfer(msg.sender, value);
        emit CollateralWithdrawn(msg.sender, value, userCollateral[msg.sender], totalCollateralLocked);
    }
    function _target(address user, bool maturedOnly) private view returns (uint256) {
        return maturedOnly ? ICoreVault(coreProtocol).getMaturedDebt(user)
            : IERC20(ICoreVault(coreProtocol).redToken()).balanceOf(user);
    }
    function _budget(uint256 target) private view returns (uint256) {
        return target * 10_000 / (10_000 - IExchangeVault(exchange).feeBps());
    }
    function repayWithCollateral(address user, uint256 value) external nonReentrant whenNotPaused {
        require(msg.sender == user, "Vault: User authorization required");
        _queue(user, value, false);
    }
    function liquidateDelinquent(address user, uint256 value) external nonReentrant whenNotPaused {
        require(ICoreVault(coreProtocol).getMaturedDebt(user) > 0, "Vault: No matured commitment");
        _queue(user, value, true);
    }
    function _queue(address user, uint256 value, bool maturedOnly) private {
        _kyc(user);
        _refreshPending(user);
        require(value > 0, "Vault: Invalid amount");
        if (pendingReserve[user] == 0) pendingMaturedOnly[user] = maturedOnly;
        else require(pendingMaturedOnly[user] == maturedOnly, "Vault: Pending purchase has another purpose");
        uint256 reserved = exchangeReserved[user] + pendingReserve[user];
        require(reserved + value <= userCollateral[user], "Vault: Insufficient unassigned collateral");
        require(reserved + value <= _budget(_target(user, maturedOnly)), "Vault: Purchase exceeds remaining commitment");
        pendingReserve[user] += value;
        emit AmortizationQueued(user, pendingReserve[user], maturedOnly);
        _processPending(user);
    }
    function processPending(address user) external nonReentrant whenNotPaused {
        _kyc(user);
        _refreshPending(user);
        _processPending(user);
    }
    function _refreshPending(address user) private {
        uint256 budget = _budget(_target(user, pendingMaturedOnly[user]));
        uint256 remaining = budget > exchangeReserved[user] ? budget - exchangeReserved[user] : 0;
        if (pendingReserve[user] > remaining) pendingReserve[user] = remaining;
    }
    function _processPending(address user) private {
        if (activeAmortizationOrder[user] != 0) return;
        uint256 value = pendingReserve[user];
        if (value < IExchangeVault(exchange).MIN_ORDER_AMOUNT()) return;
        require(value <= type(uint128).max, "Vault: Amount overflow");
        pendingReserve[user] = 0;
        exchangeReserved[user] += value;
        totalExchangeReserved += value;
        collateralToken.forceApprove(exchange, value);
        uint64 id = IExchangeVault(exchange).createAmortizationOrder(user, uint128(value));
        collateralToken.forceApprove(exchange, 0);
        purchases[id] = Purchase(user, uint128(value), pendingMaturedOnly[user]);
        activeAmortizationOrder[user] = id;
        emit AmortizationOrderCreated(user, id, value);
    }
    function maxAmortizationGross(uint64 id) external view returns (uint128) {
        Purchase memory purchase = purchases[id];
        uint256 budget = _budget(_target(purchase.user, purchase.maturedOnly));
        return uint128(budget < purchase.remaining ? budget : purchase.remaining);
    }
    function _deductReservation(uint64 id, uint128 value) private returns (address user) {
        Purchase storage purchase = purchases[id];
        require(value > 0 && value <= purchase.remaining, "Vault: Invalid purchase settlement");
        user = purchase.user;
        purchase.remaining -= value;
        exchangeReserved[user] -= value;
        totalExchangeReserved -= value;
        if (purchase.remaining == 0) activeAmortizationOrder[user] = 0;
    }
    function onAmortizationRefund(uint64 id, uint128 value) external onlyExchange nonReentrant {
        address user = _deductReservation(id, value);
        emit AmortizationReserveReturned(user, id, value);
    }
    function onAmortizationFill(uint64 id, uint128 gross, uint128 netBlue) external onlyExchange nonReentrant {
        Purchase memory purchase = purchases[id];
        require(netBlue <= _target(purchase.user, purchase.maturedOnly), "Vault: Purchase target changed");
        uint256 shortfall = ICoreVault(coreProtocol).getCoverageShortfall(purchase.user);
        address user = _deductReservation(id, gross);
        userCollateral[user] -= gross;
        totalCollateralLocked -= gross;
        ICoreVault(coreProtocol).onCollateralRepayment(user, netBlue);
        require(ICoreVault(coreProtocol).getCoverageShortfall(user) <= shortfall,
            "Vault: Additional fee coverage required");
        emit AmortizationPurchaseFilled(user, id, gross, netBlue);
        // A separate permissionless processPending creates the next FIFO order;
        // never re-enter the exchange from its matching callback.
    }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function renounceOwnership() public pure override { revert("Vault: Ownership renunciation is permanently disabled"); }
}
