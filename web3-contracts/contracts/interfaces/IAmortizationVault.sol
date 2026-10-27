// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAmortizationVault {
    function availableReservation(address user, bool maturedOnly) external view returns (uint256);
    function registerExchangeCollateral(address user, uint64 orderId, uint128 amount, bool maturedOnly) external;
    function releaseExchangeCollateral(uint64 orderId, uint128 amount) external;
    function protectPendingRefund(address user, uint128 amount) external returns (uint128);
    function maxAmortizationGross(uint64 orderId) external view returns (uint128);
    function onAmortizationRefund(uint64 orderId, uint128 amount) external;
    function onAmortizationFill(uint64 orderId, uint128 gross, uint128 netBlue) external;
}
