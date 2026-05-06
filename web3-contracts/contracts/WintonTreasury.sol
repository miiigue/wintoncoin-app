// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IBlueToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title WintonTreasury
 * @dev Bóveda programable que guarda las comisiones en BLUE real.
 * Permite a los usuarios reclamar sus pagos (IOU -> BLUE) vía Árboles de Merkle,
 * sin costo de Gas (ERC2771).
 */
contract WintonTreasury is Ownable, ERC2771Context, ReentrancyGuard {
    IBlueToken public blueToken;
    address public foundersWallet;

    // Almacena la raíz de Merkle actual autorizada para el mes.
    bytes32 public currentMerkleRoot;

    // Evita que un usuario reclame 2 veces en el mismo ciclo.
    mapping(address => bool) public hasClaimed;

    event ClaimSuccessful(address indexed user, uint256 amount);
    event MerkleRootUpdated(bytes32 newRoot);
    event FoundersWalletUpdated(address newWallet);
    event SurplusWithdrawn(uint256 amount);

    constructor(address _blueToken, address _trustedForwarder) 
        ERC2771Context(_trustedForwarder) 
        Ownable(msg.sender) 
    {
        blueToken = IBlueToken(_blueToken);
    }

    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }

    /**
     * @dev Actualiza la billetera de los fundadores. Flexible para el futuro.
     */
    function setFoundersWallet(address _newWallet) external onlyOwner {
        require(_newWallet != address(0), "Invalid address");
        foundersWallet = _newWallet;
        emit FoundersWalletUpdated(_newWallet);
    }

    /**
     * @dev El servidor (propietario) actualiza la raíz mensual después de calcular 
     * el prorrateo de la Cascada de Pagos.
     */
    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        currentMerkleRoot = _merkleRoot;
        emit MerkleRootUpdated(_merkleRoot);
    }

    /**
     * @dev Permite a los servidores reiniciar el estado de cobro cada mes.
     */
    function resetClaims(address[] calldata users) external onlyOwner {
        for (uint i = 0; i < users.length; i++) {
            hasClaimed[users[i]] = false;
        }
    }

    /**
     * @dev El usuario reclama sus BLUE usando Meta-Transacciones (Sin Gas).
     */
    function claim(uint256 amount, bytes32[] calldata merkleProof) external nonReentrant {
        address user = _msgSender();
        
        require(!hasClaimed[user], "Treasury: You have already claimed this month");
        require(currentMerkleRoot != bytes32(0), "Treasury: Merkle root not set");

        // Validar la firma criptográfica (Prueba de Merkle)
        bytes32 leaf = keccak256(abi.encodePacked(user, amount));
        require(MerkleProof.verify(merkleProof, currentMerkleRoot, leaf), "Treasury: Invalid Merkle Proof");

        require(blueToken.balanceOf(address(this)) >= amount, "Treasury: Insufficient liquidity");

        hasClaimed[user] = true;
        
        // Transferir los tokens reales a la billetera del usuario
        require(blueToken.transfer(user, amount), "Treasury: Transfer failed");

        emit ClaimSuccessful(user, amount);
    }

    /**
     * @dev Permite retirar excedentes de ganancias a la billetera fundadora
     * SOLAMENTE si todas las deudas del mes han sido saldadas.
     */
    function withdrawSurplus(uint256 amount) external onlyOwner nonReentrant {
        require(foundersWallet != address(0), "Treasury: Founders wallet not set");
        require(blueToken.balanceOf(address(this)) >= amount, "Treasury: Insufficient funds");
        
        require(blueToken.transfer(foundersWallet, amount), "Treasury: Transfer failed");
        emit SurplusWithdrawn(amount);
    }
}
