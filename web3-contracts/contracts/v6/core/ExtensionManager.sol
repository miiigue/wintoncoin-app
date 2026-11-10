// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./CoreInterfaces.sol";

/// @notice Timelocked extension catalogue and user quote protection for V6.
contract ExtensionManager is Ownable2Step, ReentrancyGuard {
    uint48 public constant UPDATE_DELAY = 48 hours;
    uint256 private constant BPS = 10_000;
    struct Option { uint16 feeBps; uint8 minLevel; bool enabled; }
    struct PendingOption { Option option; uint48 unlockAt; }

    IModeControllerV6 public immutable modes;
    IRiskRegistryV6 public immutable risk;
    ICommitmentLedgerV6 public immutable ledger;
    IPaymentEngineExtensionV6 public immutable engine;
    mapping(uint48 => Option) public options;
    mapping(uint48 => PendingOption) public pendingOptions;

    event OptionProposed(uint48 indexed duration, uint16 feeBps, uint8 minLevel, bool enabled, uint48 unlockAt);
    event OptionActivated(uint48 indexed duration, uint16 feeBps, uint8 minLevel, bool enabled);
    event ExtensionRequested(address indexed user, uint256 indexed lotId, uint48 duration, uint256 fee, uint256 newDueAt);
    error NotNormal();
    error InvalidOption();
    error ProposalPending();
    error NoPendingProposal();
    error TimelockNotExpired();
    error OptionDisabled();
    error NotEligible();
    error AuthorizationExpired();
    error QuoteChanged();
    error InvalidLot();
    error OwnershipRenunciationDisabled();

    constructor(address modeController, address riskRegistry, address commitmentLedger, address paymentEngine)
        Ownable(msg.sender)
    {
        if (modeController.code.length == 0 || riskRegistry.code.length == 0 ||
            commitmentLedger.code.length == 0 || paymentEngine.code.length == 0) revert InvalidOption();
        modes = IModeControllerV6(modeController);
        risk = IRiskRegistryV6(riskRegistry);
        ledger = ICommitmentLedgerV6(commitmentLedger);
        engine = IPaymentEngineExtensionV6(paymentEngine);
    }

    function proposeOption(uint48 duration, uint16 feeBps, uint8 minLevel, bool enabled) external onlyOwner {
        if (duration == 0 || feeBps > 2_000 || minLevel > 6) revert InvalidOption();
        if (pendingOptions[duration].unlockAt != 0) revert ProposalPending();
        uint48 unlockAt = uint48(block.timestamp) + UPDATE_DELAY;
        pendingOptions[duration] = PendingOption(Option(feeBps, minLevel, enabled), unlockAt);
        emit OptionProposed(duration, feeBps, minLevel, enabled, unlockAt);
    }

    function executeOption(uint48 duration) external {
        PendingOption memory pending = pendingOptions[duration];
        if (pending.unlockAt == 0) revert NoPendingProposal();
        if (block.timestamp < pending.unlockAt) revert TimelockNotExpired();
        options[duration] = pending.option;
        delete pendingOptions[duration];
        emit OptionActivated(duration, pending.option.feeBps, pending.option.minLevel, pending.option.enabled);
    }

    function requestExtension(
        uint256 lotId, uint48 duration, uint256 expectedFee, uint256 expectedDueAt, uint256 deadline
    ) external nonReentrant {
        if (modes.mode() != 0) revert NotNormal();
        if (block.timestamp > deadline) revert AuthorizationExpired();
        if (!risk.isKYCVerified(msg.sender)) revert NotEligible();
        Option memory option = options[duration];
        if (!option.enabled) revert OptionDisabled();
        if (risk.userLevel(msg.sender) < option.minLevel) revert NotEligible();
        (uint256 dueAt, uint256 amount, uint256 previousFee,, bool active) = ledger.lot(msg.sender, lotId);
        if (!active || dueAt <= block.timestamp || amount <= previousFee) revert InvalidLot();
        uint256 fee = (amount - previousFee) * option.feeBps / BPS;
        uint256 newDueAt = dueAt + duration;
        if (fee != expectedFee || newDueAt != expectedDueAt) revert QuoteChanged();
        engine.applyExtension(msg.sender, lotId, newDueAt, fee, 0);
        emit ExtensionRequested(msg.sender, lotId, duration, fee, newDueAt);
    }

    function quoteExtension(address user, uint256 lotId, uint48 duration)
        external view returns (uint256 fee, uint256 newDueAt)
    {
        Option memory option = options[duration];
        if (!option.enabled) revert OptionDisabled();
        (uint256 dueAt, uint256 amount, uint256 previousFee,, bool active) = ledger.lot(user, lotId);
        if (!active || amount <= previousFee) revert InvalidLot();
        fee = (amount - previousFee) * option.feeBps / BPS;
        newDueAt = dueAt + duration;
    }

    function renounceOwnership() public pure override { revert OwnershipRenunciationDisabled(); }
}
