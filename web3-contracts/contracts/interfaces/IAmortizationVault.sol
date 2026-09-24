// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAmortizationVault {
    function maxAmortizationGross(uint64 orderId) external view returns (uint128);
    function onAmortizationRefund(uint64 orderId, uint128 amount) external;
    function onAmortizationFill(uint64 orderId, uint128 gross, uint128 netBlue) external;
}
