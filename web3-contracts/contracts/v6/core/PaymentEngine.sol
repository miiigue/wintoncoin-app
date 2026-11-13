// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./CoreInterfaces.sol";

/// @notice Atomic V6 payment orchestrator. It owns no token balances and all
/// monetary changes pass through the paired-supply controller.
contract PaymentEngine is Ownable2Step, ReentrancyGuard {
    uint8 private constant NORMAL = 0;
    uint8 private constant PRELAUNCH_FROZEN = 1;
    uint256 private constant BPS = 10_000;

    IModeControllerV6 public immutable modes;
    IRiskRegistryV6 public immutable risk;
    IProtocolConfigV6 public immutable config;
    IPaymentAuthorizationV6 public immutable authorization;
    ICommitmentLedgerV6 public immutable ledger;
    IPairedSupplyControllerV6 public immutable pairs;
    IBlueTokenV6View public immutable blue;
    IRedTokenV6View public immutable red;
    address public immutable treasury;
    address public extensionManager;
    address public collateralVault;

    event ExtensionManagerLinked(address indexed manager);
    event CollateralVaultLinked(address indexed vault);
    event PaymentProcessed(address indexed payer, address indexed payee, uint256 amount, uint256 fee, uint256 blueUsed, uint256 redCreated, uint256 lotId);
    event DebtAmortized(address indexed user, uint256 amount, bool maturedOnly);
    event CommitmentExtended(address indexed user, uint256 indexed lotId, uint256 newDueAt, uint256 fee, uint256 margin);

    error ZeroAddress();
    error InvalidContract();
    error NotNormal();
    error ExitsNotAllowed();
    error KycNotVerified();
    error InvalidPayment();
    error SelfPayment();
    error PaymentLimitExceeded();
    error InsufficientCapacity();
    error InsufficientBlue();
    error OverdueCommitments();
    error AccountingMismatch();
    error AuthorizationStateChanged();
    error UnauthorizedExtensionManager();
    error ExtensionManagerAlreadyLinked();
    error UnauthorizedCollateralVault();
    error CollateralVaultAlreadyLinked();
    error OwnershipRenunciationDisabled();

    constructor(
        address modeController, address riskRegistry, address protocolConfig,
        address paymentAuthorization, address commitmentLedger, address pairController,
        address blueToken, address redToken, address treasuryAccount
    ) Ownable(msg.sender) {
        address[9] memory dependencies = [modeController, riskRegistry, protocolConfig, paymentAuthorization,
            commitmentLedger, pairController, blueToken, redToken, treasuryAccount];
        for (uint256 i; i < dependencies.length; i++) {
            if (dependencies[i] == address(0)) revert ZeroAddress();
            if (dependencies[i].code.length == 0 && i != 8) revert InvalidContract();
        }
        modes = IModeControllerV6(modeController);
        risk = IRiskRegistryV6(riskRegistry);
        config = IProtocolConfigV6(protocolConfig);
        authorization = IPaymentAuthorizationV6(paymentAuthorization);
        ledger = ICommitmentLedgerV6(commitmentLedger);
        pairs = IPairedSupplyControllerV6(pairController);
        blue = IBlueTokenV6View(blueToken);
        red = IRedTokenV6View(redToken);
        treasury = treasuryAccount;
    }

    function setExtensionManager(address manager) external onlyOwner {
        if (extensionManager != address(0)) revert ExtensionManagerAlreadyLinked();
        if (manager == address(0) || manager.code.length == 0) revert InvalidContract();
        extensionManager = manager;
        emit ExtensionManagerLinked(manager);
    }

    function setCollateralVault(address vaultAddress) external onlyOwner {
        if (collateralVault != address(0)) revert CollateralVaultAlreadyLinked();
        if (vaultAddress == address(0) || vaultAddress.code.length == 0) revert InvalidContract();
        if (ICollateralVaultCoreV6(vaultAddress).engine() != address(this)) revert InvalidContract();
        collateralVault = vaultAddress;
        emit CollateralVaultLinked(vaultAddress);
    }

    function processPayment(address payee, uint256 amount) external nonReentrant returns (uint256 lotId) {
        lotId = _process(msg.sender, payee, amount, 0);
    }

    function processMixedPayment(address payee, uint256 amount, uint256 blueAmount)
        external nonReentrant returns (uint256 lotId)
    {
        lotId = _process(msg.sender, payee, amount, blueAmount);
    }

    function processAuthorizedPayment(IPaymentAuthorizationV6.Payment calldata payment, bytes calldata signature)
        external nonReentrant returns (uint256 lotId)
    {
        _requireNormal();
        IProtocolConfigV6.Config memory active = config.activeConfig();
        if (payment.feeBps != active.commissionBps || payment.duration != active.commitmentDuration) {
            revert AccountingMismatch();
        }
        if (payment.payerStateHash != paymentStateHash(payment.payer)) revert AuthorizationStateChanged();
        authorization.consume(payment, signature);
        uint256 fee = payment.amount * active.commissionBps / BPS;
        uint256 total = payment.amount + fee;
        if (payment.blueAmount + payment.redAmount != total) revert AccountingMismatch();
        lotId = _processWithConfig(payment.payer, payment.payee, payment.amount, payment.blueAmount, active);
    }

    function amortizeWithBlue(uint256 amount) external nonReentrant {
        _requireExits();
        _requireKyc(msg.sender);
        uint256 debt = ledger.outstanding(msg.sender);
        if (amount == 0 || amount > debt) revert InvalidPayment();
        if (amount > blue.balanceOf(msg.sender)) revert InsufficientBlue();
        pairs.burnPair(msg.sender, msg.sender, amount);
        ledger.amortize(msg.sender, amount, false);
        // burnPair validates global BLUE/RED equality before and after burning.
        // Both the user's RED balance and the FIFO commitment ledger must
        // independently converge to the same already-calculated result.
        uint256 expected = debt - amount;
        if (red.balanceOf(msg.sender) != expected || ledger.outstanding(msg.sender) != expected)
            revert AccountingMismatch();
        emit DebtAmortized(msg.sender, amount, false);
    }

    function settleMatured(address user) external nonReentrant returns (uint256 amount) {
        _requireExits();
        _requireKyc(user);
        amount = _settleMatured(user);
    }

    /// @notice Burns BLUE already delivered to the Vault against the user's RED.
    /// The Vault is the only caller and the paired controller keeps both supplies equal.
    function amortizeFromCollateral(address user, address blueHolder, uint256 amount) external nonReentrant {
        if (msg.sender != collateralVault || blueHolder != collateralVault) revert UnauthorizedCollateralVault();
        _requireExits();
        _requireKyc(user);
        if (amount == 0 || amount > ledger.outstanding(user)) revert InvalidPayment();
        if (amount > blue.balanceOf(blueHolder)) revert InsufficientBlue();
        pairs.burnPair(user, blueHolder, amount);
        ledger.amortize(user, amount, false);
        if (ledger.outstanding(user) > _coverage(user)) revert InsufficientCapacity();
        _assertAccounting(user);
        emit DebtAmortized(user, amount, false);
    }

    function applyExtension(address user, uint256 lotId, uint256 newDueAt, uint256 fee, uint256 margin)
        external nonReentrant
    {
        if (msg.sender != extensionManager) revert UnauthorizedExtensionManager();
        _requireNormal();
        _requireKyc(user);
        if (ledger.outstanding(user) + fee > _coverage(user) + margin) {
            revert InsufficientCapacity();
        }
        uint256 releaseAt = block.timestamp + config.activeConfig().commitmentDuration;
        if (fee != 0) pairs.mintPair(user, treasury, fee, releaseAt);
        ledger.extendCommitment(user, lotId, newDueAt, fee, margin);
        _assertAccounting(user);
        emit CommitmentExtended(user, lotId, newDueAt, fee, margin);
    }

    function quotePayment(address payer, uint256 amount)
        external view returns (uint256 fee, uint256 total, uint256 suggestedBlue, uint256 requiredRed)
    {
        IProtocolConfigV6.Config memory active = config.activeConfig();
        fee = amount * active.commissionBps / BPS;
        total = amount + fee;
        uint256 available = blue.balanceOf(payer);
        suggestedBlue = available < total ? available : total;
        requiredRed = total - suggestedBlue;
    }

    function paymentStateHash(address payer) public view returns (bytes32) {
        IProtocolConfigV6.Config memory active = config.activeConfig();
        return keccak256(abi.encode(
            payer, ledger.ledgerVersion(payer), ledger.outstanding(payer), red.balanceOf(payer),
            blue.balanceOf(payer), active.maxPayment, active.commitmentDuration,
            active.commissionBps, block.chainid, address(this)
        ));
    }

    function requiredCollateral(address user) external view returns (uint256) {
        uint256 debt = ledger.outstanding(user);
        uint256 unsecured = risk.creditLimit(user);
        return debt > unsecured ? debt - unsecured : 0;
    }

    function _process(address payer, address payee, uint256 amount, uint256 blueAmount)
        private returns (uint256 lotId)
    {
        _requireNormal();
        return _processWithConfig(payer, payee, amount, blueAmount, config.activeConfig());
    }

    function _processWithConfig(
        address payer, address payee, uint256 amount, uint256 blueAmount,
        IProtocolConfigV6.Config memory active
    ) private returns (uint256 lotId) {
        _requireKyc(payer); _requireKyc(payee);
        if (payer == payee) revert SelfPayment();
        if (amount == 0) revert InvalidPayment();
        if (amount > active.maxPayment) revert PaymentLimitExceeded();
        if (active.commissionBps > 0) _requireKyc(treasury);

        _settleMatured(payer);
        if (ledger.matured(payer) != 0) revert OverdueCommitments();

        uint256 fee = amount * active.commissionBps / BPS;
        uint256 total = amount + fee;
        if (blueAmount > total || blueAmount > blue.balanceOf(payer)) revert InsufficientBlue();
        uint256 redCreated = total - blueAmount;
        if (ledger.outstanding(payer) + redCreated > _coverage(payer)) revert InsufficientCapacity();

        uint256 dueAt = block.timestamp + active.commitmentDuration;
        lotId = ledger.createCommitment(payer, total, dueAt, fee, 0);
        pairs.mintPair(payer, payee, amount, dueAt);
        if (fee != 0) pairs.mintPair(payer, treasury, fee, dueAt);
        if (blueAmount != 0) {
            pairs.burnPair(payer, payer, blueAmount);
            ledger.amortize(payer, blueAmount, false);
        }
        _settleMatured(payee);
        _assertAccounting(payer);
        emit PaymentProcessed(payer, payee, amount, fee, blueAmount, redCreated, lotId);
    }

    function _settleMatured(address user) private returns (uint256 amount) {
        uint256 debt = ledger.matured(user);
        uint256 balance = blue.balanceOf(user);
        amount = debt < balance ? debt : balance;
        if (amount == 0) return 0;
        pairs.burnPair(user, user, amount);
        ledger.amortize(user, amount, true);
        _assertAccounting(user);
        emit DebtAmortized(user, amount, true);
    }

    function _requireNormal() private view { if (modes.mode() != NORMAL) revert NotNormal(); }
    function _requireExits() private view { if (modes.mode() == PRELAUNCH_FROZEN) revert ExitsNotAllowed(); }
    function _requireKyc(address user) private view { if (!risk.isKYCVerified(user)) revert KycNotVerified(); }
    function _coverage(address user) private view returns (uint256 amount) {
        amount = risk.creditLimit(user);
        address vaultAddress = collateralVault;
        if (vaultAddress != address(0)) amount += ICollateralVaultCoreV6(vaultAddress).collateralCoverage(user);
    }
    function _assertAccounting(address user) private view {
        if (blue.totalSupply() != red.totalSupply() || ledger.outstanding(user) != red.balanceOf(user)) {
            revert AccountingMismatch();
        }
    }
    function renounceOwnership() public pure override { revert OwnershipRenunciationDisabled(); }
}
