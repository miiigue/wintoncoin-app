// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WintonProtocol
 * @dev Contrato principal para WintonCoin en Capa 2 (Optimism).
 * Maneja el Libro Mayor público de transacciones y el Trust Score (WTS).
 */
contract WintonProtocol is Ownable {
    
    // Eventos para auditar en Etherscan
    event PaymentSynced(address indexed payer, address indexed payee, uint256 amount, uint256 dbTxId);
    event TrustScoreUpdated(address indexed user, uint256 newScoreLimit);

    // Mapeo del límite de crédito RED en blockchain
    mapping(address => uint256) public redCreditLimits;

    // Solo la plataforma (Relayer) puede actualizar este contrato
    address public relayer;

    constructor(address _relayer) Ownable(msg.sender) {
        relayer = _relayer;
    }

    /**
     * @dev Actualiza la billetera Relayer autorizada
     */
    function setRelayer(address _newRelayer) external onlyOwner {
        relayer = _newRelayer;
    }

    modifier onlyRelayer() {
        require(msg.sender == relayer || msg.sender == owner(), "WintonProtocol: Unauthorized");
        _;
    }

    /**
     * @dev Sincroniza un pago off-chain al ledger on-chain
     * @param payer Billetera que paga
     * @param payee Billetera que recibe
     * @param amountBlue Cantidad pagada en Wei
     * @param dbTxId ID de la base de datos para trazabilidad cruzada
     */
    function syncPayment(address payer, address payee, uint256 amountBlue, uint256 dbTxId) external onlyRelayer {
        require(payer != address(0) && payee != address(0), "Invalid addresses");
        emit PaymentSynced(payer, payee, amountBlue, dbTxId);
    }

    /**
     * @dev Actualiza el límite de crédito RED basado en el motor de Scoring (WTS)
     * @param userWallet Billetera del usuario
     * @param newScoreLimit Nuevo límite calculado
     */
    function updateUserTrustScore(address userWallet, uint256 newScoreLimit) external onlyRelayer {
        require(userWallet != address(0), "Invalid address");
        redCreditLimits[userWallet] = newScoreLimit;
        emit TrustScoreUpdated(userWallet, newScoreLimit);
    }
}
