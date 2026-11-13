'use strict';

// Read-only verification. Caller supplies ethers.Contract and an already
// authenticated, explicitly selected Demo provider. No transaction is sent.
const LINKS = {
  PaymentEngine: { modes:'ProtocolModeController', risk:'RiskRegistry', config:'ProtocolConfig', authorization:'PaymentAuthorization', ledger:'CommitmentLedger', pairs:'PairedSupplyController', blue:'BlueTokenV6', red:'RedTokenV6', collateralVault:'CollateralVaultV6', extensionManager:'ExtensionManager', treasury:'ProtocolTreasuryV6' },
  ProtocolTreasuryV6: { blueToken:'BlueTokenV6', coreProtocol:'PaymentEngine' },
  ExchangeConfig: { treasury:'ProtocolTreasuryV6' },
  PairedSupplyController: { blueToken:'BlueTokenV6', redToken:'RedTokenV6', modeController:'ProtocolModeController' },
  BlueTokenV6: { supplyController:'PairedSupplyController', exchange:'ExchangeCustody', riskRegistry:'RiskRegistry' },
  RedTokenV6: { supplyController:'PairedSupplyController' },
  PaymentAuthorization: { paymentEngine:'PaymentEngine' },
  CommitmentLedger: { paymentEngine:'PaymentEngine' },
  ExtensionManager: { modes:'ProtocolModeController', risk:'RiskRegistry', ledger:'CommitmentLedger', engine:'PaymentEngine' },
  ExchangeRouter: { modes:'ProtocolModeController', risk:'RiskRegistry', book:'FifoOrderBook', custody:'ExchangeCustody', config:'ExchangeConfig', amortization:'AmortizationAdapter' },
  FifoOrderBook: { router:'ExchangeRouter' },
  ExchangeCustody: { blue:'BlueTokenV6', usdt:'USDT', router:'ExchangeRouter', config:'ExchangeConfig' },
  AmortizationAdapter: { modes:'ProtocolModeController', book:'FifoOrderBook', custody:'ExchangeCustody', router:'ExchangeRouter', vault:'CollateralVaultV6' },
  CollateralVaultV6: { usdt:'USDT', modes:'ProtocolModeController', risk:'RiskRegistry', engine:'PaymentEngine', router:'ExchangeRouter', adapter:'AmortizationAdapter', exchangeCustody:'ExchangeCustody' },
};

async function validateV6Demo({provider, contracts, Contract, getAddress, keccak256, manifest, localRehearsal = false}) {
  const chainId = String((await provider.getNetwork()).chainId);
  if (chainId !== (localRehearsal ? '1337' : '11155420')) throw new Error('Red distinta de Demo.');
  // Pin all reads to one block: a mixed-block view can falsely report parity
  // or links during a concurrent configuration change.
  const blockTag = await provider.getBlockNumber();
  const names = new Set(['ProtocolModeController', 'RiskRegistry', 'ProtocolConfig', ...Object.keys(LINKS), ...Object.values(LINKS).flatMap(Object.values)]);
  if (!localRehearsal && !manifest) throw new Error('Manifiesto V6 Demo incompleto.');
  if (manifest && (manifest.epoch !== 'V6_DEMO' || String(manifest.chainId) !== chainId || !manifest.codeHashes || !manifest.owners || !manifest.roles || !keccak256)) throw new Error('Manifiesto V6 Demo incompleto.');
  const addresses = {};
  for (const name of names) {
    addresses[name] = getAddress(contracts[name]);
    const code = await provider.getCode(addresses[name], blockTag);
    if (/^0x0{40}$/i.test(addresses[name]) || code === '0x') throw new Error('Contrato ausente: ' + name);
    if (manifest && (!manifest.contracts || getAddress(manifest.contracts[name]) !== addresses[name] || !manifest.codeHashes[name] || keccak256(code).toLowerCase() !== manifest.codeHashes[name].toLowerCase())) throw new Error('Identidad incorrecta: ' + name);
  }
  if (new Set(Object.values(addresses).map(a => a.toLowerCase())).size !== names.size) throw new Error('Direcciones de contratos repetidas.');
  if (manifest) {
    for (const name of names) {
      if (name === 'USDT' || name === 'ExchangeRouter') continue;
      if (!manifest.owners[name]) throw new Error('Propietario no definido: ' + name);
      const instance = new Contract(addresses[name], ['function owner() view returns(address)'], provider);
      if (getAddress(await instance.owner({blockTag})) !== getAddress(manifest.owners[name])) throw new Error('Propietario incorrecto: ' + name);
    }
    for (const [name, method, role] of [['ProtocolModeController','guardian','guardian'], ['RiskRegistry','riskOperator','riskOperator']]) {
      const expected = getAddress(manifest.roles[role]);
      if (/^0x0{40}$/i.test(expected)) throw new Error('Rol no configurado: ' + role);
      const instance = new Contract(addresses[name], [`function ${method}() view returns(address)`], provider);
      if (getAddress(await instance[method]({blockTag})) !== expected) throw new Error('Rol incorrecto: ' + role);
    }
  }
  for (const [source, links] of Object.entries(LINKS)) {
    const methods = Object.keys(links);
    const instance = new Contract(addresses[source], methods.map(name => `function ${name}() view returns(address)`), provider);
    for (const [method, target] of Object.entries(links)) {
      if (getAddress(await instance[method]({blockTag})) !== addresses[target]) throw new Error(`Enlace incorrecto: ${source}.${method}`);
    }
  }
  const mode = new Contract(addresses.ProtocolModeController, ['function mode() view returns(uint8)'], provider);
  if (await mode.mode({blockTag}) !== 1n) throw new Error('V6 no está en Prelanzamiento congelado.');
  const tokenAbi = ['function decimals() view returns(uint8)', 'function totalSupply() view returns(uint256)'];
  const blue = new Contract(addresses.BlueTokenV6, tokenAbi, provider);
  const red = new Contract(addresses.RedTokenV6, tokenAbi, provider);
  const usdt = new Contract(addresses.USDT, tokenAbi, provider);
  for (const token of [blue, red, usdt]) if (await token.decimals({blockTag}) !== 6n) throw new Error('Decimales incorrectos.');
  if (await blue.totalSupply({blockTag}) !== await red.totalSupply({blockTag})) throw new Error('BLUE y RED no coinciden.');
  const pairs = new Contract(addresses.PairedSupplyController, ['function operators(address) view returns(bool)'], provider);
  if (!await pairs.operators(addresses.PaymentEngine, {blockTag})) throw new Error('Motor no autorizado para suministro pareado.');
  return {chainId, blockNumber:blockTag, mode:'PRELAUNCH_FROZEN', contracts:addresses};
}
module.exports = {validateV6Demo, LINKS};
