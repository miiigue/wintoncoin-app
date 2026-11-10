require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** 
 * WintonCoin Web3 Core
 * Estandarización de Seguridad de Grado Militar / Optimism L2 Capable
 * 
 * Este archivo configura las reglas de compilación estricta y ruteo para evitar 
 * fugas de liquidez y mantener operaciones gas-efficient.
 * 
 * @type import('hardhat/config').HardhatUserConfig 
 */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1 // Mantiene desplegable la suite; la suite de gas limita las rutas frecuentes.
      }
    }
  },
  networks: {
    // Red de simulación sellada para pruebas sin gasto real
    hardhat: {
      chainId: 1337,
      // Solo el harness adversarial añade una función y supera el límite.
      // GasScaling valida por separado el bytecode de cada contrato real.
      allowUnlimitedContractSize: true
    },
    // Entorno de Staging/Demo: Optimism Sepolia (Testnet Pública)
    optimismSepolia: {
      url: process.env.OPTIMISM_SEPOLIA_RPC_URL || "https://sepolia.optimism.io",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11155420,
      gas: 6000000 // Core con pago mixto: 5.16M medidos; margen de ejecución en testnet.
    }
  },
  etherscan: {
    apiKey: {
      optimismSepolia: process.env.ETHERSCAN_API_KEY || ""
    },
    customChains: [
      {
        network: "optimismSepolia",
        chainId: 11155420,
        urls: {
          apiURL: "https://api-sepolia-optimistic.etherscan.io/api",
          browserURL: "https://sepolia-optimism.etherscan.io/"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
