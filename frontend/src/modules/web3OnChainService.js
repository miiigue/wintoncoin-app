/**
 * frontend/src/modules/web3OnChainService.js
 * Servicio Web3 On-Chain Oficial para WintonCoin (Suite V4)
 * 
 * Conecta las pantallas de React (Wallet, Exchange, Admin) directamente a los Smart Contracts
 * en Optimism Sepolia mediante ethers.js (v6) y la API del Backend de Demo.
 */

import { ethers, BrowserProvider, JsonRpcProvider, Contract, parseUnits, formatUnits } from 'ethers';
import { getApiUrl } from './config.js';

// Direcciones oficiales de la Suite V4 en Optimism Sepolia
export const CONTRACT_ADDRESSES = {
  chainId: 11155420,
  chainIdHex: '0xaa37dc',
  chainName: 'Optimism Sepolia',
  rpcUrl: 'https://sepolia.optimism.io',
  blockExplorerUrl: 'https://sepolia-optimism.etherscan.io',
  CoreProtocol: '0x56a83A394B40d83Ab40ff5e6884F08D6648bd92d',
  CollateralVault: '0xA2c5095A5D6b4e881a28921Ce144394F27C1F618',
  FifoExchange: '0xdE41187f8943623E34Af7249D9691d58e28230cA',
  BlueToken: '0xb1B6a07373719c5311639E2A64657d9596ADc544',
  RedToken: '0xe077391D3729673634a3ee4C8963Cb57b74D386b',
  USDT: '0xA558A97CdD986a2f342684a8E89EAea4F01F28F3',
  ProtocolTreasury: '0x5040555a602446695c03CCBBBE26276e6B913245'
};

// ABIs mínimas oficiales para interacción on-chain
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

const VAULT_ABI = [
  "function deposit(uint256 value) external",
  "function withdraw(uint256 value) external",
  "function repayWithCollateral(address user, uint256 value) external",
  "function getFreeCollateral(address user) view returns (uint256)",
  "function userCollateral(address user) view returns (uint256)",
  "function exchangeReserved(address user) view returns (uint256)",
  "function pendingReserve(address user) view returns (uint256)"
];

const CORE_ABI = [
  "function amortizeWithBlue(uint256 amount) external",
  "function isKYCVerified(address account) view returns (bool)",
  "function creditLimits(address account) view returns (uint256)",
  "function getAvailableCreditCapacity(address user) view returns (uint256)",
  "function getRequiredCollateral(address user) view returns (uint256)",
  "function isDelinquent(address user) view returns (bool)"
];

const EXCHANGE_ABI = [
  "function createBlueOrder(uint128 amount) external returns (uint64)",
  "function createUsdtOrder(uint128 amount) external returns (uint64)",
  "function cancelOrder(uint64 orderId) external",
  "function claimPendingRefunds() external",
  "function pendingRefundBlue(address) view returns (uint128)",
  "function pendingRefundUsdt(address) view returns (uint128)"
];

class Web3OnChainService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.connectedAddress = null;
  }

  /**
   * Verifica si MetaMask / proveedor Web3 está disponible en el navegador
   */
  hasInjectedProvider() {
    return typeof window !== 'undefined' && Boolean(window.ethereum);
  }

  /**
   * Conecta MetaMask y asegura que la red sea Optimism Sepolia
   */
  async connectWallet() {
    if (!this.hasInjectedProvider()) {
      throw new Error('MetaMask no detectado. Instala la extensión o abre en el navegador Web3 de MetaMask.');
    }

    this.provider = new BrowserProvider(window.ethereum);
    
    // Solicitar cuentas
    const accounts = await this.provider.send('eth_requestAccounts', []);
    if (!accounts || accounts.length === 0) {
      throw new Error('No se seleccionó ninguna cuenta en MetaMask.');
    }

    // Asegurar red Optimism Sepolia (11155420)
    await this.ensureOptimismSepoliaNetwork();

    this.signer = await this.provider.getSigner();
    this.connectedAddress = await this.signer.getAddress();

    // Guardar en localStorage para persistencia
    localStorage.setItem('web3ConnectedWallet', this.connectedAddress);

    return this.connectedAddress;
  }

  /**
   * Obtiene la dirección conectada actualmente
   */
  async getConnectedAddress() {
    if (this.connectedAddress) return this.connectedAddress;
    
    if (this.hasInjectedProvider()) {
      try {
        this.provider = new BrowserProvider(window.ethereum);
        const accounts = await this.provider.send('eth_accounts', []);
        if (accounts && accounts.length > 0) {
          this.signer = await this.provider.getSigner();
          this.connectedAddress = accounts[0];
          return this.connectedAddress;
        }
      } catch (_) {}
    }

    // Fallback a localStorage si el usuario ya inició sesión
    const saved = localStorage.getItem('web3ConnectedWallet');
    if (saved && /^0x[a-fA-F0-9]{40}$/.test(saved)) {
      return saved;
    }

    return null;
  }

  /**
   * Cambia o añade la red Optimism Sepolia en MetaMask
   */
  async ensureOptimismSepoliaNetwork() {
    if (!this.provider) this.provider = new BrowserProvider(window.ethereum);
    const network = await this.provider.getNetwork();
    
    if (Number(network.chainId) !== CONTRACT_ADDRESSES.chainId) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: CONTRACT_ADDRESSES.chainIdHex }]
        });
      } catch (switchError) {
        // Código 4902: la red no está agregada en MetaMask
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: CONTRACT_ADDRESSES.chainIdHex,
              chainName: CONTRACT_ADDRESSES.chainName,
              nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: [CONTRACT_ADDRESSES.rpcUrl],
              blockExplorerUrls: [CONTRACT_ADDRESSES.blockExplorerUrl]
            }]
          });
        } else {
          throw switchError;
        }
      }
    }
  }

  /**
   * Consulta el saldo de USDT ERC-20 en la billetera del usuario
   */
  async getUsdtBalance(walletAddress) {
    const target = walletAddress || (await this.getConnectedAddress());
    if (!target) return 0;
    try {
      const provider = this.provider || new JsonRpcProvider(CONTRACT_ADDRESSES.rpcUrl);
      const usdt = new Contract(CONTRACT_ADDRESSES.USDT, ERC20_ABI, provider);
      const bal = await usdt.balanceOf(target);
      return parseFloat(formatUnits(bal, 6));
    } catch (_) {
      return 0;
    }
  }

  /**
   * Consulta el estado financiero on-chain real de un usuario desde el backend
   */
  async fetchUserOnChainState(walletAddress) {
    const API_URL = getApiUrl();
    const target = walletAddress || (await this.getConnectedAddress());
    if (!target) return null;

    try {
      const res = await fetch(`${API_URL}/api/web3/user/${target}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Error al obtener datos on-chain');
      const json = await res.json();
      if (!json.success) return null;

      // Consultar también saldo líquido de USDT en billetera
      const usdtWalletBalance = await this.getUsdtBalance(target);

      return {
        wallet: json.wallet,
        blockNumber: json.blockNumber,
        blueUnlocked: parseFloat(json.blueBalance) || 0,
        redCommitment: parseFloat(json.redCommitment) || 0,
        collateralLocked: parseFloat(json.collateralVault?.totalLocked) || 0,
        collateralFree: parseFloat(json.collateralVault?.freeForWithdrawal) || 0,
        collateralReserved: parseFloat(json.collateralVault?.reservedInExchange) || 0,
        baseCreditLimit: parseFloat(json.credit?.baseLimit) || 0,
        availableCapacity: parseFloat(json.credit?.availableCapacity) || 0,
        isKYCVerified: Boolean(json.credit?.isKYCVerified),
        isDelinquent: Boolean(json.credit?.isDelinquent),
        userLevel: json.credit?.level || 0,
        debtLots: json.debtLots || [],
        usdtWalletBalance
      };
    } catch (err) {
      console.warn('[Web3Service] Error fetching user on-chain state:', err.message);
      return null;
    }
  }

  /**
   * Consulta el snapshot de órdenes del Exchange para una billetera
   */
  async fetchExchangeSnapshot(walletAddress) {
    const API_URL = getApiUrl();
    const target = walletAddress || (await this.getConnectedAddress());
    if (!target) return null;

    try {
      const res = await fetch(`${API_URL}/api/web3/exchange/${target}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    } catch (_) {
      return null;
    }
  }

  /**
   * Consulta la cola global activa del FifoExchange indexada en PostgreSQL
   */
  async fetchPublicExchangeQueue() {
    const API_URL = getApiUrl();
    try {
      const res = await fetch(`${API_URL}/api/web3/exchange-queue`);
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    } catch (_) {
      return null;
    }
  }

  // ==========================================================================
  // TRANSACCIONES ON-CHAIN CON METAMASK (OPTIMISM SEPOLIA)
  // ==========================================================================

  /**
   * Deposita USDT de garantía en CollateralVault.sol
   */
  async depositCollateral(amountUsdt) {
    await this.connectWallet();
    const parsed = parseUnits(String(amountUsdt), 6);
    
    // 1. Aprobar USDT para la Bóveda si es necesario
    const usdtContract = new Contract(CONTRACT_ADDRESSES.USDT, ERC20_ABI, this.signer);
    const allowance = await usdtContract.allowance(this.connectedAddress, CONTRACT_ADDRESSES.CollateralVault);
    
    if (allowance < parsed) {
      const approveTx = await usdtContract.approve(CONTRACT_ADDRESSES.CollateralVault, parsed);
      await approveTx.wait();
    }

    // 2. Depositar en la Bóveda
    const vaultContract = new Contract(CONTRACT_ADDRESSES.CollateralVault, VAULT_ABI, this.signer);
    const tx = await vaultContract.deposit(parsed);
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.hash };
  }

  /**
   * Retira colateral USDT libre de CollateralVault.sol
   */
  async withdrawCollateral(amountUsdt) {
    await this.connectWallet();
    const parsed = parseUnits(String(amountUsdt), 6);
    const vaultContract = new Contract(CONTRACT_ADDRESSES.CollateralVault, VAULT_ABI, this.signer);
    const tx = await vaultContract.withdraw(parsed);
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.hash };
  }

  /**
   * Amortiza compromiso RED utilizando tokens BLUE líquidos en CoreProtocol.sol
   */
  async amortizeWithBlue(amountBlue) {
    await this.connectWallet();
    const parsed = parseUnits(String(amountBlue), 6);
    const coreContract = new Contract(CONTRACT_ADDRESSES.CoreProtocol, CORE_ABI, this.signer);
    const tx = await coreContract.amortizeWithBlue(parsed);
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.hash };
  }

  /**
   * Crea una orden de venta de BLUE en FifoExchange.sol
   */
  async createSellOrder(amountBlue) {
    await this.connectWallet();
    const parsed = parseUnits(String(amountBlue), 6);

    // 1. Aprobar BLUE para el Exchange
    const blueContract = new Contract(CONTRACT_ADDRESSES.BlueToken, ERC20_ABI, this.signer);
    const allowance = await blueContract.allowance(this.connectedAddress, CONTRACT_ADDRESSES.FifoExchange);
    if (allowance < parsed) {
      const approveTx = await blueContract.approve(CONTRACT_ADDRESSES.FifoExchange, parsed);
      await approveTx.wait();
    }

    // 2. Crear orden de venta
    const exchangeContract = new Contract(CONTRACT_ADDRESSES.FifoExchange, EXCHANGE_ABI, this.signer);
    const tx = await exchangeContract.createBlueOrder(parsed);
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.hash };
  }

  /**
   * Crea una orden de compra de BLUE entregando USDT en FifoExchange.sol
   */
  async createBuyOrder(amountUsdt) {
    await this.connectWallet();
    const parsed = parseUnits(String(amountUsdt), 6);

    // 1. Aprobar USDT para el Exchange
    const usdtContract = new Contract(CONTRACT_ADDRESSES.USDT, ERC20_ABI, this.signer);
    const allowance = await usdtContract.allowance(this.connectedAddress, CONTRACT_ADDRESSES.FifoExchange);
    if (allowance < parsed) {
      const approveTx = await usdtContract.approve(CONTRACT_ADDRESSES.FifoExchange, parsed);
      await approveTx.wait();
    }

    // 2. Crear orden de compra
    const exchangeContract = new Contract(CONTRACT_ADDRESSES.FifoExchange, EXCHANGE_ABI, this.signer);
    const tx = await exchangeContract.createUsdtOrder(parsed);
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.hash };
  }

  /**
   * Cancela una orden activa en FifoExchange.sol
   */
  async cancelOrder(orderId) {
    await this.connectWallet();
    const exchangeContract = new Contract(CONTRACT_ADDRESSES.FifoExchange, EXCHANGE_ABI, this.signer);
    const tx = await exchangeContract.cancelOrder(orderId);
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.hash };
  }

  /**
   * Reclama devoluciones pendientes en FifoExchange.sol
   */
  async claimRefunds() {
    await this.connectWallet();
    const exchangeContract = new Contract(CONTRACT_ADDRESSES.FifoExchange, EXCHANGE_ABI, this.signer);
    const tx = await exchangeContract.claimPendingRefunds();
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.hash };
  }
}

export const web3OnChainService = new Web3OnChainService();
export default web3OnChainService;
