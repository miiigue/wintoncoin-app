// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../WintonFifoExchange.sol";

/**
 * @title MockERC20
 * @notice Contrato mock para simulación en pruebas unitarias y de integración de tokens con 6 decimales.
 * @dev Permite minteo libre para configurar balances en suites de test.
 */
contract MockERC20 is ERC20 {
    uint8 private immutable _customDecimals;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _customDecimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _customDecimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

/**
 * @title MockFeeOnTransferERC20
 * @notice Token mock con 6 decimales que deduce una comisión durante transferFrom.
 * @dev Utilizado para verificar que WintonFifoExchange revierte con DepositAmountMismatch si el depósito no es íntegro.
 */
contract MockFeeOnTransferERC20 is ERC20 {
    uint8 private immutable _customDecimals;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _customDecimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _customDecimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        uint256 fee = 10_000; // Deducción artificial de 0.01 tokens
        uint256 net = amount > fee ? amount - fee : amount;
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, net);
        return true;
    }
}

/**
 * @title MockReentrantERC20
 * @notice Token mock con 6 decimales diseñado para simular ataques de reentrancia adversarial.
 * @dev Durante transfer o transferFrom, intenta llamar reentrantemente a funciones protegidas
 * con timelock (executeFeeUpdate / executeTreasuryUpdate) en WintonFifoExchange.
 */
contract MockReentrantERC20 is ERC20 {
    uint8 private immutable _customDecimals;
    address public targetExchange;
    bool public attackFeeUpdate;
    bool public attackTreasuryUpdate;
    bool public reentrancyAttempted;
    bool public reentrancyFailed;
    bytes public reentrancyErrorData;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _customDecimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _customDecimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setAttackConfig(
        address _targetExchange,
        bool _attackFee,
        bool _attackTreasury
    ) external {
        targetExchange = _targetExchange;
        attackFeeUpdate = _attackFee;
        attackTreasuryUpdate = _attackTreasury;
        reentrancyAttempted = false;
        reentrancyFailed = false;
        reentrancyErrorData = "";
    }

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        _executeAttack();
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        _executeAttack();
        return super.transferFrom(from, to, amount);
    }

    function _executeAttack() internal {
        if (targetExchange != address(0)) {
            if (attackFeeUpdate) {
                reentrancyAttempted = true;
                (bool success, bytes memory data) = targetExchange.call(
                    abi.encodeWithSignature("executeFeeUpdate()")
                );
                if (!success) {
                    reentrancyFailed = true;
                    reentrancyErrorData = data;
                }
            } else if (attackTreasuryUpdate) {
                reentrancyAttempted = true;
                (bool success, bytes memory data) = targetExchange.call(
                    abi.encodeWithSignature("executeTreasuryUpdate()")
                );
                if (!success) {
                    reentrancyFailed = true;
                    reentrancyErrorData = data;
                }
            }
        }
    }
}

/**
 * @title WintonFifoExchangeHarness
 * @notice Harness para pruebas adversariales y validación de violaciones de invariantes en WintonFifoExchange.
 */
contract WintonFifoExchangeHarness is WintonFifoExchange {
    constructor(
        address _blue,
        address _usdt,
        address _treasury,
        uint16 _initialFeeBps
    ) WintonFifoExchange(_blue, _usdt, _treasury, _initialFeeBps) {}

    function setOrderRemainingAmount(uint64 orderId, uint128 remaining) external {
        orders[orderId].remainingAmount = remaining;
    }
}



