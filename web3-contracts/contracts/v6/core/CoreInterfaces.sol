// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IModeControllerV6 { function mode() external view returns (uint8); }

interface IRiskRegistryV6 {
    function isKYCVerified(address account) external view returns (bool);
    function creditLimit(address account) external view returns (uint256);
    function userLevel(address account) external view returns (uint8);
}

interface IProtocolConfigV6 {
    struct Config { uint128 maxPayment; uint48 commitmentDuration; uint16 commissionBps; }
    function activeConfig() external view returns (Config memory);
}

interface IPaymentAuthorizationV6 {
    struct Payment {
        address payer; address payee; uint256 amount; uint256 blueAmount; uint256 redAmount;
        uint16 feeBps; uint48 duration; uint256 nonce; uint256 deadline;
        bytes32 agreementHash; bytes32 payerStateHash;
    }
    function consume(Payment calldata payment, bytes calldata signature) external returns (bytes32);
}

interface ICommitmentLedgerV6 {
    function createCommitment(address account, uint256 amount, uint256 dueAt, uint256 fee, uint256 margin)
        external returns (uint256 lotId);
    function extendCommitment(address account, uint256 lotId, uint256 newDueAt, uint256 addedFee, uint256 addedMargin)
        external;
    function amortize(address account, uint256 amount, bool maturedOnly) external returns (uint256 releasedMargin);
    function outstanding(address account) external view returns (uint256);
    function matured(address account) external view returns (uint256);
    function ledgerVersion(address account) external view returns (uint256);
    function lot(address account, uint256 lotId)
        external view returns (uint256 dueAt, uint256 amount, uint256 fee, uint256 margin, bool active);
}

interface IPairedSupplyControllerV6 {
    function mintPair(address redAccount, address blueAccount, uint256 amount, uint256 releaseAt) external;
    function burnPair(address redAccount, address blueAccount, uint256 amount) external;
}

interface IBlueTokenV6View {
    function balanceOf(address account) external view returns (uint256);
    function availableBalanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

interface IRedTokenV6View {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

interface ICollateralVaultCoreV6 {
    function collateralCoverage(address user) external view returns (uint256);
    function engine() external view returns (address);
}

interface IPaymentEngineExtensionV6 {
    function applyExtension(address user, uint256 lotId, uint256 newDueAt, uint256 fee, uint256 margin) external;
}
