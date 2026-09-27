/**
 * frontend/src/modules/web3OnChainService.js
 * Servicio Web3 On-Chain Oficial para WintonCoin (Suite V4)
 * 
 * Conecta las pantallas de React (Wallet, Exchange, Admin) directamente a los Smart Contracts
 * en Optimism Sepolia mediante ethers.js (v6) y la API del Backend de Demo.
 */

import { ethers, BrowserProvider, JsonRpcProvider, Contract, parseUnits, formatUnits } from 'ethers';
import { getApiUrl } from './config.js';
import {requestOperation} from './pinOperations.js';

// Direcciones oficiales de la Suite V4 en Optimism Sepolia
export const CONTRACT_ADDRESSES = {}

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
  async connectWallet() { return this.getConnectedAddress(); }
  async ensureDeployment() {
    if(this.deploymentCheckedAt && Date.now()-this.deploymentCheckedAt<30000)return;
    const response=await fetch(getApiUrl()+'/api/web3/deployment',{cache:'no-store'});
    const data=await response.json();
    if(!response.ok||!data.success)throw new Error('El despliegue no pudo verificarse.');
    const networks={'10':{rpcUrl:'https://mainnet.optimism.io',blockExplorerUrl:'https://optimistic.etherscan.io'},'11155420':{rpcUrl:'https://sepolia.optimism.io',blockExplorerUrl:'https://sepolia-optimistic.etherscan.io'}};
    const network=networks[data.chainId];if(!network)throw new Error('Red no admitida por la interfaz.');
    Object.assign(CONTRACT_ADDRESSES,data.contracts,network,{chainId:data.chainId});
    this.deploymentCheckedAt=Date.now();
  }
  async getAssociatedAccount() {
    const token = localStorage.getItem('token');
    const response = await fetch(`${getApiUrl()}/api/me/balance`, {
      credentials:'include', cache:'no-store', headers:token ? {Authorization:`Bearer ${token}`} : {}
    });
    if (!response.ok) { this.signer=null; this.connectedAddress=null; throw new Error('No se pudo verificar tu cuenta. Inicia sesión nuevamente.'); }
    const account = await response.json();
    if (!ethers.isAddress(account.web3_wallet_address)) throw new Error('Tu cuenta aún no tiene una billetera asociada válida.');
    return account;
  }
  async getConnectedAddress() { return (await this.getAssociatedAccount()).web3_wallet_address; }

  /**
   * Cambia o añade la red Optimism Sepolia en MetaMask
   */
  async getUsdtBalance(walletAddress) {
    await this.ensureDeployment();
    const target = walletAddress || (await this.getConnectedAddress());
    if (!target) return 0;
    try {
      const provider = this.provider || new JsonRpcProvider(CONTRACT_ADDRESSES.rpcUrl);
      const usdt = new Contract(CONTRACT_ADDRESSES.USDT, ERC20_ABI, provider);
      const bal = await usdt.balanceOf(target);
      return parseFloat(formatUnits(bal, 6));
    } catch (_) {
      throw new Error('No se pudo consultar el saldo USDT.');
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
      await this.ensureDeployment();
      const res = await fetch(`${API_URL}/api/web3/user/${target}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Error al obtener datos on-chain');
      const json = await res.json();
      if (!json.success) return null;

      // Consultar también saldo líquido de USDT en billetera
      if(json.usdtWalletBalance==null)throw new Error('Saldo USDT no disponible.');
      const usdtWalletBalance = Number(json.usdtWalletBalance);

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
  async depositCollateral(amount) {return requestOperation('deposit',{amount:String(amount)});}
  async withdrawCollateral(amount) {return requestOperation('withdraw',{amount:String(amount)});}
  async transferUsdt(amount,destination) {return requestOperation('transfer',{amount:String(amount),destination});}
  async amortizeWithBlue(amount) {return requestOperation('amortize',{amount:String(amount)});}
  async repayWithCollateral(amount) {return requestOperation('repayCollateral',{amount:String(amount)});}
  async createSellOrder(amount) {return requestOperation('sell',{amount:String(amount)});}
  async createBuyOrder(amount) {return requestOperation('buy',{amount:String(amount)});}
  async cancelOrder(orderId) {return requestOperation('cancel',{orderId:String(orderId)});}
  async resumeOrder(orderId) {return requestOperation('resume',{orderId:String(orderId)});}
  async claimRefunds() {return requestOperation('claim');}
}
export const web3OnChainService=new Web3OnChainService();
export default web3OnChainService;
