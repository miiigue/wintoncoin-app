const base = require('./hardhat.config');

/**
 * Independent V6 validation profile. Unlike the legacy adversarial harness
 * profile, this configuration enforces the real EIP-170 deployment limit and
 * uses a normal optimizer trade-off for production candidates.
 */
module.exports = {
  ...base,
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    ...base.networks,
    hardhat: {
      chainId: 1337,
      allowUnlimitedContractSize: false,
    },
  },
  paths: {
    ...base.paths,
    cache: './cache-v6',
    artifacts: './artifacts-v6',
  },
};
