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
        runs: 200 // Estándar para reducción de gas en despliegues.
      }
    }
  },
  networks: {
    // Red de simulación sellada para pruebas sin gasto real
    hardhat: {
      chainId: 1337
    },
    // Entorno de Staging/Demo: Optimism Sepolia (Testnet Pública)
    optimismSepolia: {
      url: process.env.ALCHEMY_API_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11155420,
      gas: 5000000
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
