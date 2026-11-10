// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IERC1271Minimal {
    function isValidSignature(bytes32 digest, bytes calldata signature) external view returns (bytes4);
}

/// @notice Isolated EIP-712 authorization and replay protection for V6 payments.
contract PaymentAuthorization is Ownable2Step {
    bytes32 private constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant NAME_HASH = keccak256("WintonPayment");
    bytes32 private constant VERSION_HASH = keccak256("6");
    bytes4 private constant ERC1271_MAGIC = 0x1626ba7e;
    bytes32 public constant PAYMENT_TYPEHASH = keccak256(
        "Payment(address payer,address payee,uint256 amount,uint256 blueAmount,uint256 redAmount,uint16 feeBps,uint48 duration,uint256 nonce,uint256 deadline,bytes32 agreementHash,bytes32 payerStateHash)"
    );
    struct Payment {
        address payer; address payee; uint256 amount; uint256 blueAmount; uint256 redAmount;
        uint16 feeBps; uint48 duration; uint256 nonce; uint256 deadline;
        bytes32 agreementHash; bytes32 payerStateHash;
    }
    mapping(address => uint256) public nonces;
    address public paymentEngine;

    event PaymentEngineLinked(address indexed paymentEngine);
    event AuthorizationConsumed(address indexed payer, uint256 indexed nonce, bytes32 digest);
    error EngineAlreadyLinked();
    error InvalidEngine();
    error UnauthorizedEngine();
    error AuthorizationExpired();
    error InvalidNonce();
    error InvalidSignature();
    error OwnershipRenunciationDisabled();

    constructor() Ownable(msg.sender) {}
    modifier onlyEngine() { if (msg.sender != paymentEngine) revert UnauthorizedEngine(); _; }

    function setPaymentEngine(address engine) external onlyOwner {
        if (paymentEngine != address(0)) revert EngineAlreadyLinked();
        if (engine == address(0) || engine.code.length == 0) revert InvalidEngine();
        paymentEngine = engine;
        emit PaymentEngineLinked(engine);
    }

    function digest(Payment calldata payment) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            PAYMENT_TYPEHASH, payment.payer, payment.payee, payment.amount,
            payment.blueAmount, payment.redAmount, payment.feeBps, payment.duration,
            payment.nonce, payment.deadline, payment.agreementHash, payment.payerStateHash
        ));
        bytes32 domainSeparator = keccak256(abi.encode(
            DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)
        ));
        return keccak256(abi.encodePacked(hex"1901", domainSeparator, structHash));
    }

    function consume(Payment calldata payment, bytes calldata signature)
        external onlyEngine returns (bytes32 authorizationDigest)
    {
        if (block.timestamp > payment.deadline) revert AuthorizationExpired();
        if (payment.nonce != nonces[payment.payer]) revert InvalidNonce();
        authorizationDigest = digest(payment);
        if (!_validSignature(payment.payer, authorizationDigest, signature)) revert InvalidSignature();
        nonces[payment.payer] = payment.nonce + 1;
        emit AuthorizationConsumed(payment.payer, payment.nonce, authorizationDigest);
    }

    function _validSignature(address signer, bytes32 authorizationDigest, bytes calldata signature)
        private view returns (bool)
    {
        if (signer.code.length == 0) {
            (address recovered, ECDSA.RecoverError error,) = ECDSA.tryRecover(authorizationDigest, signature);
            return error == ECDSA.RecoverError.NoError && recovered == signer;
        }
        try IERC1271Minimal(signer).isValidSignature(authorizationDigest, signature) returns (bytes4 magicValue) {
            return magicValue == ERC1271_MAGIC;
        } catch { return false; }
    }

    function renounceOwnership() public pure override { revert OwnershipRenunciationDisabled(); }
}
