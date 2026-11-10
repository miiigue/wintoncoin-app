// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "../../libraries/CommitmentTree.sol";

/// @notice Debt-lot storage and FIFO accounting isolated from token movement.
contract CommitmentLedger is Ownable2Step {
    using CommitmentTree for CommitmentTree.Tree;
    mapping(address => CommitmentTree.Tree) private _trees;
    mapping(uint256 => address) public lotOwner;
    mapping(address => uint256) public ledgerVersion;
    uint256 public nextLotId = 1;
    address public paymentEngine;

    event PaymentEngineLinked(address indexed paymentEngine);
    event CommitmentCreated(address indexed account, uint256 indexed lotId, uint256 amount, uint256 dueAt, uint256 fee, uint256 margin);
    event CommitmentExtended(address indexed account, uint256 indexed lotId, uint256 newDueAt, uint256 addedFee, uint256 addedMargin);
    event CommitmentAmortized(address indexed account, uint256 amount, uint256 releasedMargin, bool maturedOnly);
    error EngineAlreadyLinked();
    error InvalidEngine();
    error UnauthorizedEngine();
    error InvalidAccount();
    error InvalidLot();
    error InvalidAmount();
    error InvalidDueAt();
    error AmountExceedsMatured();
    error CounterOverflow();
    error OwnershipRenunciationDisabled();

    constructor() Ownable(msg.sender) {}
    modifier onlyEngine() { if (msg.sender != paymentEngine) revert UnauthorizedEngine(); _; }

    function setPaymentEngine(address engine) external onlyOwner {
        if (paymentEngine != address(0)) revert EngineAlreadyLinked();
        if (engine == address(0) || engine.code.length == 0) revert InvalidEngine();
        paymentEngine = engine;
        emit PaymentEngineLinked(engine);
    }

    function createCommitment(address account, uint256 amount, uint256 dueAt, uint256 fee, uint256 margin)
        external onlyEngine returns (uint256 lotId)
    {
        if (account == address(0)) revert InvalidAccount();
        if (amount == 0) revert InvalidAmount();
        if (dueAt <= block.timestamp) revert InvalidDueAt();
        lotId = nextLotId;
        if (lotId == type(uint256).max) revert CounterOverflow();
        nextLotId = lotId + 1;
        _trees[account].insert(lotId, dueAt, amount, fee, margin);
        lotOwner[lotId] = account;
        ledgerVersion[account]++;
        emit CommitmentCreated(account, lotId, amount, dueAt, fee, margin);
    }

    function extendCommitment(address account, uint256 lotId, uint256 newDueAt, uint256 addedFee, uint256 addedMargin)
        external onlyEngine
    {
        CommitmentTree.Tree storage tree = _trees[account];
        if (lotOwner[lotId] != account || !tree.contains(lotId)) revert InvalidLot();
        CommitmentTree.Node storage node = tree.nodes[lotId];
        if (newDueAt <= node.dueAt) revert InvalidDueAt();
        uint256 amount = node.amount + addedFee;
        uint256 fee = node.fee + addedFee;
        uint256 margin = node.margin + addedMargin;
        tree.remove(lotId);
        tree.insert(lotId, newDueAt, amount, fee, margin);
        ledgerVersion[account]++;
        emit CommitmentExtended(account, lotId, newDueAt, addedFee, addedMargin);
    }

    function amortize(address account, uint256 amount, bool maturedOnly)
        external onlyEngine returns (uint256 releasedMargin)
    {
        if (amount == 0) revert InvalidAmount();
        CommitmentTree.Tree storage tree = _trees[account];
        if (maturedOnly && amount > tree.matured(block.timestamp)) revert AmountExceedsMatured();
        releasedMargin = tree.consume(amount);
        ledgerVersion[account]++;
        emit CommitmentAmortized(account, amount, releasedMargin, maturedOnly);
    }

    function outstanding(address account) external view returns (uint256) {
        CommitmentTree.Tree storage tree = _trees[account];
        return tree.nodes[tree.root].sum;
    }
    function matured(address account) external view returns (uint256) { return _trees[account].matured(block.timestamp); }
    function firstLotId(address account) external view returns (uint256 lotId) {
        CommitmentTree.Tree storage tree = _trees[account];
        lotId = tree.root;
        while (lotId != 0 && tree.nodes[lotId].left != 0) lotId = tree.nodes[lotId].left;
    }
    function lot(address account, uint256 lotId)
        external view returns (uint256 dueAt, uint256 amount, uint256 fee, uint256 margin, bool active)
    {
        CommitmentTree.Tree storage tree = _trees[account];
        active = lotOwner[lotId] == account && tree.contains(lotId);
        if (!active) return (0, 0, 0, 0, false);
        CommitmentTree.Node storage node = tree.nodes[lotId];
        return (node.dueAt, node.amount, node.fee, node.margin, true);
    }

    function renounceOwnership() public pure override { revert OwnershipRenunciationDisabled(); }
}
