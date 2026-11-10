// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "../../libraries/ParkingLedger.sol";

interface IV6RiskRegistry {
    function isKYCVerified(address account) external view returns (bool);
}

interface IV6PairControllerBlue {
    function blueToken() external view returns (address);
}

interface IV6BlueExchange {
    function blueToken() external view returns (address);
}

/// @notice BLUE V6 separates monetary authority, KYC and exchange routing.
/// Supply control and exchange links are configured once, then immutable.
contract BlueTokenV6 is ERC20, Ownable2Step {
    using ParkingLedger for ParkingLedger.Tree;

    IV6RiskRegistry public immutable riskRegistry;
    address public supplyController;
    address public exchange;
    bool public supplyControllerLocked;
    bool public exchangeLocked;

    mapping(address => ParkingLedger.Tree) private _parking;

    event SupplyControllerSet(address indexed controller);
    event ExchangeSet(address indexed exchange);
    event ParkingCreated(address indexed user, uint256 indexed index, uint256 amount, uint256 releaseAt);

    error ZeroAddress();
    error InvalidContract();
    error InvalidSupplyController();
    error InvalidExchange();
    error SupplyControllerAlreadySet();
    error ExchangeAlreadySet();
    error UnauthorizedSupplyController();
    error TransferOutsideExchange();
    error KycNotVerified();
    error ParkingNotReleased();
    error InvalidParking();
    error OwnershipRenunciationDisabled();

    constructor(address risk) ERC20("BLUE Token V6", "BLUE") Ownable(msg.sender) {
        if (risk == address(0)) revert ZeroAddress();
        if (risk.code.length == 0) revert InvalidContract();
        riskRegistry = IV6RiskRegistry(risk);
    }

    function decimals() public pure override returns (uint8) { return 6; }

    modifier onlySupplyController() {
        if (msg.sender != supplyController) revert UnauthorizedSupplyController();
        _;
    }

    function setSupplyController(address controller) external onlyOwner {
        if (supplyControllerLocked) revert SupplyControllerAlreadySet();
        if (controller == address(0)) revert ZeroAddress();
        if (controller.code.length == 0) revert InvalidContract();
        if (IV6PairControllerBlue(controller).blueToken() != address(this)) revert InvalidSupplyController();
        supplyController = controller;
        supplyControllerLocked = true;
        emit SupplyControllerSet(controller);
    }

    function setExchange(address target) external onlyOwner {
        if (exchangeLocked) revert ExchangeAlreadySet();
        if (target == address(0)) revert ZeroAddress();
        if (target.code.length == 0) revert InvalidContract();
        if (IV6BlueExchange(target).blueToken() != address(this)) revert InvalidExchange();
        exchange = target;
        exchangeLocked = true;
        emit ExchangeSet(target);
    }

    function mintWithParking(address to, uint256 amount, uint256 releaseAt) external onlySupplyController {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0 || releaseAt <= block.timestamp) revert InvalidParking();
        _mint(to, amount);
        uint256 index = _parking[to].count();
        _parking[to].append(index, amount, releaseAt);
        emit ParkingCreated(to, index, amount, releaseAt);
    }

    function burn(address from, uint256 amount) external onlySupplyController {
        if (from == address(0)) revert ZeroAddress();
        _parking[from].consume(amount, false, block.timestamp);
        _burn(from, amount);
    }

    function parkingLotsCount(address user) external view returns (uint256) { return _parking[user].count(); }
    function parkingHead(address user) public view returns (uint256) { return _parking[user].first(_parking[user].count()); }
    function parkingLots(address user, uint256 index) external view returns (uint256 remaining, uint256 releaseAt) {
        releaseAt = _parking[user].releaseAt(index);
        if (index < parkingHead(user)) return (0, 0);
        return (_parking[user].balance(index), releaseAt);
    }
    function lockedBalanceOf(address user) public view returns (uint256) { return _parking[user].locked(block.timestamp); }
    function availableBalanceOf(address user) external view returns (uint256) {
        return balanceOf(user) - lockedBalanceOf(user);
    }

    function cleanParking(address user, uint256 maxLots) external {
        uint256 count = _parking[user].count();
        for (uint256 n; n < maxLots; n++) {
            uint256 index = _parking[user].first(count);
            if (index == count || _parking[user].releaseAt(index) > block.timestamp) break;
            _parking[user].erase(index);
        }
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            address market = exchange;
            if (market == address(0) || msg.sender != market || (from != market && to != market)) {
                revert TransferOutsideExchange();
            }
            address user = from == market ? to : from;
            if (!riskRegistry.isKYCVerified(user)) revert KycNotVerified();
            if (from != market) {
                uint256 free = balanceOf(from) - _parking[from].total();
                uint256 released = _parking[from].consume(value, true, block.timestamp);
                if (value > free + released) revert ParkingNotReleased();
            }
        }
        super._update(from, to, value);
    }

    function renounceOwnership() public pure override { revert OwnershipRenunciationDisabled(); }
}
