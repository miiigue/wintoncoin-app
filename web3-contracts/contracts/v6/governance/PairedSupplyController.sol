// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPairedBlueToken {
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function mintWithParking(address to, uint256 amount, uint256 releaseAt) external;
    function burn(address from, uint256 amount) external;
}
interface IPairedRedToken {
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function mintCommitment(address to, uint256 amount) external;
    function burnCommitment(address from, uint256 amount) external;
}
interface IProtocolModeSource { function mode() external view returns (uint8); }

/// @notice Exclusive V6 monetary authority. BLUE and RED can only be created
/// or destroyed in an equal amount inside the same atomic transaction.
contract PairedSupplyController is Ownable2Step, ReentrancyGuard {
    uint8 private constant NORMAL = 0;
    uint8 private constant PRELAUNCH_FROZEN = 1;

    IPairedBlueToken public immutable blueToken;
    IPairedRedToken public immutable redToken;
    IProtocolModeSource public immutable modeController;
    mapping(address => bool) public operators;

    event OperatorPermissionChanged(address indexed operator, bool enabled);
    event PairMinted(address indexed redAccount, address indexed blueAccount, uint256 amount, uint256 releaseAt, address operator);
    event PairBurned(address indexed redAccount, address indexed blueAccount, uint256 amount, address operator);

    error ZeroAddress();
    error InvalidContract();
    error InvalidTokenPair();
    error UnauthorizedOperator();
    error InvalidAmount();
    error MintingNotAllowed();
    error BurningNotAllowed();
    error PairSupplyMismatch(uint256 blueSupply, uint256 redSupply);

    constructor(address blue, address red, address modes) Ownable(msg.sender) {
        if (blue == address(0) || red == address(0) || modes == address(0)) revert ZeroAddress();
        if (blue == red) revert InvalidTokenPair();
        if (blue.code.length == 0 || red.code.length == 0 || modes.code.length == 0) revert InvalidContract();
        if (IPairedBlueToken(blue).decimals() != 6 || IPairedRedToken(red).decimals() != 6) revert InvalidTokenPair();
        blueToken = IPairedBlueToken(blue);
        redToken = IPairedRedToken(red);
        modeController = IProtocolModeSource(modes);
        _assertPairedSupply();
    }

    modifier onlyOperator() {
        if (!operators[msg.sender]) revert UnauthorizedOperator();
        _;
    }

    /// @dev Operators should be immutable/versioned V6 engines. Governance may
    /// revoke them immediately; production grants require independent review.
    function setOperator(address operator, bool enabled) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        if (enabled && operator.code.length == 0) revert InvalidContract();
        operators[operator] = enabled;
        emit OperatorPermissionChanged(operator, enabled);
    }

    function mintPair(address redAccount, address blueAccount, uint256 amount, uint256 releaseAt)
        external nonReentrant onlyOperator
    {
        if (modeController.mode() != NORMAL) revert MintingNotAllowed();
        if (redAccount == address(0) || blueAccount == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        _assertPairedSupply();
        redToken.mintCommitment(redAccount, amount);
        blueToken.mintWithParking(blueAccount, amount, releaseAt);
        _assertPairedSupply();
        emit PairMinted(redAccount, blueAccount, amount, releaseAt, msg.sender);
    }

    function burnPair(address redAccount, address blueAccount, uint256 amount)
        external nonReentrant onlyOperator
    {
        if (modeController.mode() == PRELAUNCH_FROZEN) revert BurningNotAllowed();
        if (redAccount == address(0) || blueAccount == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        _assertPairedSupply();
        blueToken.burn(blueAccount, amount);
        redToken.burnCommitment(redAccount, amount);
        _assertPairedSupply();
        emit PairBurned(redAccount, blueAccount, amount, msg.sender);
    }

    function pairedSupply() external view returns (uint256) {
        _assertPairedSupply();
        return blueToken.totalSupply();
    }

    function _assertPairedSupply() private view {
        uint256 blueSupply = blueToken.totalSupply();
        uint256 redSupply = redToken.totalSupply();
        if (blueSupply != redSupply) revert PairSupplyMismatch(blueSupply, redSupply);
    }

    function renounceOwnership() public pure override { revert("PairedSupply: ownership renunciation disabled"); }
}
