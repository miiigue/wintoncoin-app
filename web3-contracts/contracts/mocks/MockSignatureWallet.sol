// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
/// @dev Test-only ERC-1271 wallet, never a production account implementation.
contract MockSignatureWallet {
    address public immutable owner;
    constructor(address signer) { owner = signer; }
    function isValidSignature(bytes32 digest, bytes calldata sig) external view returns(bytes4) {
        (address signer,ECDSA.RecoverError error,) = ECDSA.tryRecover(digest,sig);
        return error == ECDSA.RecoverError.NoError && signer == owner ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
    }
}
