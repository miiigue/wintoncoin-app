// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../libraries/ParkingLedger.sol";
contract ParkingLedgerHarness {
    using ParkingLedger for ParkingLedger.Tree;
    ParkingLedger.Tree private tree;
    uint256 public count;
    function append(uint256 amount,uint256 releaseAt) external { tree.append(count++,amount,releaseAt); }
    function consume(uint256 amount,bool maturedOnly,uint256 timestamp) external returns(uint256) { return tree.consume(amount,maturedOnly,timestamp); }
    function erase(uint256 index) external { require(index<count);tree.erase(index); }
    function total() external view returns(uint256) { return tree.total(); }
    function first() external view returns(uint256) { return tree.first(count); }
    function balance(uint256 index) external view returns(uint256) { require(index<count);return tree.balance(index); }
    function locked(uint256 timestamp) external view returns(uint256) { return tree.locked(timestamp); }
}
