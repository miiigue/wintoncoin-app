// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Storage-only FIFO order book. It never transfers or approves assets.
contract FifoOrderBook is Ownable2Step {
    enum Side { BLUE_FOR_USDT, USDT_FOR_BLUE }
    enum Status { NONE, OPEN, PARTIALLY_FILLED, FILLED, CANCELLED, SUSPENDED }
    struct Order {
        uint64 id; uint64 sequence; uint128 remaining;
        address user; Status status; Side side; uint48 createdAt;
        uint128 original; uint128 refunded;
    }
    struct QueueEntry { uint64 id; uint64 sequence; }
    struct MatchCandidate { uint64 id; uint128 remaining; address user; uint256 index; }

    address public router;
    uint64 public nextOrderId = 1;
    uint64 public nextSequence = 1;
    QueueEntry[] private _blueIds;
    QueueEntry[] private _usdtIds;
    mapping(uint64 => Order) private _orders;

    event RouterLocked(address indexed router);
    event OrderCreated(uint64 indexed id, uint64 indexed sequence, address indexed user, Side side, uint128 amount);
    event OrderFilled(uint64 indexed id, uint128 amount, uint128 remaining);
    event OrderCancelled(uint64 indexed id, uint128 refund);
    event OrderSuspended(uint64 indexed id);
    event OrderResumed(uint64 indexed id, uint64 previousSequence, uint64 newSequence);
    error Unauthorized(); error IntegrationLocked(); error InvalidAddress(); error InvalidAmount();
    error CounterOverflow(); error OrderNotActive(); error OrderNotSuspended();

    constructor() Ownable(msg.sender) {}
    modifier onlyRouter() { if (msg.sender != router) revert Unauthorized(); _; }

    function setRouter(address value) external onlyOwner {
        if (router != address(0)) revert IntegrationLocked();
        if (value.code.length == 0) revert InvalidAddress();
        router = value; emit RouterLocked(value);
    }

    function create(address user, Side side, uint128 amount) external onlyRouter returns (uint64 id) {
        if (user == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (nextOrderId == type(uint64).max || nextSequence == type(uint64).max) revert CounterOverflow();
        id = nextOrderId++; uint64 sequence = nextSequence++;
        _orders[id] = Order(id, sequence, amount, user, Status.OPEN, side, uint48(block.timestamp), amount, 0);
        QueueEntry memory entry = QueueEntry(id, sequence);
        if (side == Side.BLUE_FOR_USDT) _blueIds.push(entry); else _usdtIds.push(entry);
        emit OrderCreated(id, sequence, user, side, amount);
    }

    function applyFill(uint64 id, uint128 amount) external onlyRouter {
        _applyFill(id, amount);
    }

    function applyMatchedFill(uint64 blueId, uint64 usdtId, uint128 amount) external onlyRouter {
        _applyFill(blueId, amount);
        _applyFill(usdtId, amount);
    }

    function cancel(uint64 id) external onlyRouter returns (address user, Side side, uint128 refund) {
        Order storage value = _orders[id];
        if (!_active(value.status) && value.status != Status.SUSPENDED) revert OrderNotActive();
        user = value.user; side = value.side; refund = value.remaining;
        value.remaining = 0; value.refunded = refund; value.status = Status.CANCELLED;
        emit OrderCancelled(id, refund);
    }

    function suspend(uint64 id) external onlyRouter {
        Order storage value = _orders[id];
        if (!_active(value.status)) revert OrderNotActive();
        value.status = Status.SUSPENDED; emit OrderSuspended(id);
    }

    function resume(uint64 id) external onlyRouter returns (uint64 newSequence) {
        Order storage value = _orders[id];
        if (value.status != Status.SUSPENDED) revert OrderNotSuspended();
        if (nextSequence == type(uint64).max) revert CounterOverflow();
        uint64 previous = value.sequence; newSequence = nextSequence++;
        value.sequence = newSequence;
        value.status = value.remaining == value.original ? Status.OPEN : Status.PARTIALLY_FILLED;
        QueueEntry memory entry = QueueEntry(id, newSequence);
        if (value.side == Side.BLUE_FOR_USDT) _blueIds.push(entry); else _usdtIds.push(entry);
        emit OrderResumed(id, previous, newSequence);
    }

    function order(uint64 id) external view returns (Order memory) { return _orders[id]; }
    function collateralOrderRemaining(uint64 id, address user) external view returns (uint128) {
        Order storage value = _orders[id];
        if (value.user != user || value.side != Side.USDT_FOR_BLUE || !_active(value.status)) return 0;
        return value.remaining;
    }
    function queueLength(Side side) external view returns (uint256) {
        return side == Side.BLUE_FOR_USDT ? _blueIds.length : _usdtIds.length;
    }
    function queueAt(Side side, uint256 index) external view returns (uint64) {
        return side == Side.BLUE_FOR_USDT ? _blueIds[index].id : _usdtIds[index].id;
    }
    function nextActive(Side side, uint256 from, uint256 maximum) external view returns (uint64 id, uint256 nextIndex) {
        QueueEntry[] storage ids = side == Side.BLUE_FOR_USDT ? _blueIds : _usdtIds;
        uint256 end = from + maximum;
        if (end < from || end > ids.length) end = ids.length;
        for (uint256 i = from; i < end; ++i) {
            QueueEntry storage entry = ids[i];
            Order storage candidate = _orders[entry.id];
            if (_active(candidate.status) && candidate.sequence == entry.sequence) return (candidate.id, i);
        }
        return (0, end);
    }
    function nextPair(uint256 blueFrom, uint256 usdtFrom, uint256 maximum)
        external view returns (MatchCandidate memory blueOrder, MatchCandidate memory usdtOrder)
    {
        blueOrder = _nextActiveCandidate(_blueIds, blueFrom, maximum);
        usdtOrder = _nextActiveCandidate(_usdtIds, usdtFrom, maximum);
    }
    function _nextActiveCandidate(QueueEntry[] storage ids, uint256 from, uint256 maximum)
        private view returns (MatchCandidate memory result)
    {
        uint256 end = from + maximum;
        if (end < from || end > ids.length) end = ids.length;
        for (uint256 i = from; i < end; ++i) {
            QueueEntry storage entry = ids[i];
            Order storage candidate = _orders[entry.id];
            if (_active(candidate.status) && candidate.sequence == entry.sequence) {
                return MatchCandidate(candidate.id, candidate.remaining, candidate.user, i);
            }
        }
        result.index = end;
    }
    function _applyFill(uint64 id, uint128 amount) private {
        Order storage value = _orders[id];
        if (!_active(value.status)) revert OrderNotActive();
        if (amount == 0 || amount > value.remaining) revert InvalidAmount();
        value.remaining -= amount;
        value.status = value.remaining == 0 ? Status.FILLED : Status.PARTIALLY_FILLED;
        emit OrderFilled(id, amount, value.remaining);
    }
    function _active(Status value) private pure returns (bool) {
        return value == Status.OPEN || value == Status.PARTIALLY_FILLED;
    }
    function renounceOwnership() public pure override { revert Unauthorized(); }
}
