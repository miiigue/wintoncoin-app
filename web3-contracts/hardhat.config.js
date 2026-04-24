require("@nomicfoundation/hardhat-toolbox");

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
    }
    // NOTA: Se añadirán redes para Testnet (Optimism Sepolia) y Mainnet 
    // luego de las auditorías correspondientes.
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
