const { ethers } = require('hardhat');
const U = 1_000_000n;
async function fixture() {
  const [owner, alice, bob, carol, relayer, other] = await ethers.getSigners();
  const blue = await (await ethers.getContractFactory('BlueToken')).deploy();
  const red = await (await ethers.getContractFactory('RedToken')).deploy();
  const usdt = await (await ethers.getContractFactory('MockERC20')).deploy('USDT', 'USDT', 6);
  const core = await (await ethers.getContractFactory('CoreProtocol')).deploy();
  const treasury = await (await ethers.getContractFactory('ProtocolTreasury')).deploy(blue.target);
  const vault = await (await ethers.getContractFactory('CollateralVault')).deploy(usdt.target);
  const exchange = await (await ethers.getContractFactory('FifoExchange')).deploy(blue.target, usdt.target, treasury.target, 0);
  await core.setContracts(blue.target, red.target, treasury.target, vault.target);
  await blue.setCoreProtocol(core.target); await red.setCoreProtocol(core.target);
  await blue.setExchange(exchange.target);
  await vault.linkCoreContracts(core.target, exchange.target);
  await exchange.setAmortizationVault(vault.target);
  await core.setRelayer(relayer.address);
  for (const user of [owner, alice, bob, carol, relayer, other]) {
    await core.setKYCStatus(user.address, true);
    await core.setCreditLimit(user.address, 10_000n * U);
    await core.setUserLevel(user.address, 3);
    await usdt.mint(user.address, 10_000n * U);
    await usdt.connect(user).approve(vault.target, ethers.MaxUint256);
    await usdt.connect(user).approve(exchange.target, ethers.MaxUint256);
    await blue.connect(user).approve(exchange.target, ethers.MaxUint256);
  }
  await core.setKYCStatus(treasury.target, true);
  await treasury.setCoreProtocol(core.target);
  await core.setCreditLimit(treasury.target, 10_000n * U);
  await core.setExtensionFeeRecipient(treasury.target); // receiver only; not a coverage fund
  await core.setExtensionOption(15, 250, true);
  await core.setExtensionOption(30, 500, true);
  await core.setExtensionOption(60, 1000, true);
  const pay = (payer, payee, amount) => core.connect(payer).processPayment(payer.address, payee.address, amount);
  const extend = async (user, index = 0, days = 30) => {
    const lot = await core.userDebtLots(user.address, index);
    const quote = await core.quoteExtension(user.address, index, days);
    const block = await ethers.provider.getBlock('latest');
    return core.connect(user).requestCommitmentExtension(index, days, quote.fee, lot.dueAt, treasury.target, block.timestamp + 900);
  };
  return { owner, alice, bob, carol, relayer, other, blue, red, usdt, core, treasury, vault, exchange, pay, extend };
}
module.exports = { fixture, U };
