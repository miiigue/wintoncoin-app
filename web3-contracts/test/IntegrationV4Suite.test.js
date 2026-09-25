const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');
const { fixture, U } = require('./helpers/suite');
describe('Integración real BLUE/RED/Vault/FIFO', function () {
  let f;
  beforeEach(async () => { f = await loadFixture(fixture); await f.core.setCommissionBps(0); });
  async function invariant() {
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
    expect(await f.vault.totalCollateralLocked()).eq(await f.usdt.balanceOf(f.vault.target) + await f.vault.totalExchangeReserved());
    expect(await f.blue.balanceOf(f.exchange.target)).eq(await f.exchange.totalReservedBlue() + await f.exchange.accumulatedFeesBlue());
    expect(await f.usdt.balanceOf(f.exchange.target)).eq(await f.exchange.totalReservedUsdt() + await f.exchange.accumulatedFeesUsdt());
    for (const user of [f.alice, f.bob, f.carol, f.other]) {
      const count = await f.core.getUserDebtLotsCount(user.address);
      let debt = 0n;
      for (let i=0n; i<count; i++) debt += (await f.core.userDebtLots(user.address,i)).remainingAmount;
      expect(debt).eq(await f.red.balanceOf(user.address));
      expect(await f.blue.lockedBalanceOf(user.address)).lte(await f.blue.balanceOf(user.address));
    }
  }
  it('Compra normal también amortiza el vencido, sin acción posterior del comprador', async () => {
    await f.pay(f.alice,f.bob,100n*U); await time.increase(30*86400);
    await f.exchange.connect(f.bob).createBlueOrder(100n*U);
    await f.exchange.connect(f.alice).createUsdtOrder(100n*U);
    await f.exchange.matchOrders(10,20);
    expect(await f.red.balanceOf(f.alice.address)).eq(0);
    expect(await f.blue.balanceOf(f.alice.address)).eq(0);
    await invariant();
  });
  it('El vendedor no evade su amortización vencida sacando BLUE al Exchange', async () => {
    await f.pay(f.bob,f.carol,40n*U); await f.pay(f.alice,f.bob,100n*U); await time.increase(30*86400);
    await expect(f.exchange.connect(f.bob).createBlueOrder(100n*U)).reverted;
    await f.exchange.connect(f.bob).createBlueOrder(60n*U);
    expect(await f.red.balanceOf(f.bob.address)).eq(0);
    expect(await f.exchange.totalReservedBlue()).eq(60n*U);
    await invariant();
  });
  it('Secuencia reproducible de 80 operaciones mixtas conserva los saldos y reservas', async () => {
    let seed = 6281; const rand = (n) => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed%n; };
    const actors = [f.alice,f.bob,f.carol,f.other];
    for (let i=0; i<80; i++) {
      const user=actors[rand(actors.length)], other=actors[(actors.indexOf(user)+1)%actors.length];
      const amount=BigInt(1+rand(10))*U;
      switch(rand(4)) {
        case 0: await f.pay(user,other,amount); break;
        case 1: await f.vault.connect(user).deposit(amount); break;
        case 2: {
          const debt=await f.red.balanceOf(user.address), blue=await f.blue.balanceOf(user.address);
          const value=amount<debt?(amount<blue?amount:blue):(debt<blue?debt:blue);
          if (value) await f.core.connect(user).amortizeWithBlue(value);
          break;
        }
        default: {
          const free=await f.vault.getFreeCollateral(user.address);
          if (free) await f.vault.connect(user).withdraw(free<amount?free:amount);
        }
      }
      await invariant();
    }
  });
  it('Limpieza de parking y venta antigua no desbloquean ingresos recientes', async () => {
    await f.pay(f.alice,f.bob,10n*U); await time.increase(30*86400);
    await f.pay(f.carol,f.bob,20n*U); await f.blue.cleanParking(f.bob.address,1);
    await f.exchange.connect(f.bob).createBlueOrder(10n*U);
    expect(await f.blue.lockedBalanceOf(f.bob.address)).eq(20n*U);
    await expect(f.exchange.connect(f.bob).createBlueOrder(U)).revertedWith('BLUE: Parking not released');
    await invariant();
  });
  it('Treasury paga por Core y amortiza con BLUE, manteniendo parking y suministro pareado', async () => {
    await f.core.setCommissionBps(500); await f.pay(f.alice,f.bob,100n*U);
    const leaf=ethers.keccak256(ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256','address','uint256','address','uint256'],[1337,f.treasury.target,1,f.bob.address,U])));
    await f.treasury.setMerkleRoot(leaf); await time.increase(30*86400);
    const supply=await f.blue.totalSupply();
    await f.treasury.connect(f.bob).claimBoosterReward(U,[]);
    expect(await f.blue.totalSupply()).eq(supply);
    expect(await f.red.balanceOf(f.treasury.target)).eq(0);
    expect(await f.blue.lockedBalanceOf(f.bob.address)).eq(U);
    expect(await f.treasury.hasClaimed(f.bob.address)).eq(true);
    await invariant();
  });
  it('Orden en cabeza sin KYC es saltada sin revertir el matching para las órdenes legítimas posteriores', async () => {
    await f.pay(f.alice, f.bob, 50n * U);
    await f.pay(f.alice, f.carol, 50n * U);
    await time.increase(30 * 86400);

    await f.exchange.connect(f.bob).createBlueOrder(50n * U);
    await f.exchange.connect(f.carol).createBlueOrder(50n * U);

    // El KYC de Bob es revocado mientras está en cola
    await f.core.setKYCStatus(f.bob.address, false);

    // Other entra a comprar BLUE con USDT
    await f.exchange.connect(f.other).createUsdtOrder(50n * U);

    // matchOrders NO revierte: salta a Bob y liquida a Carol contra Other
    await f.exchange.matchOrders(10, 20);

    expect(await f.usdt.balanceOf(f.carol.address)).eq(10_050n * U);
    expect(await f.blue.balanceOf(f.other.address)).eq(50n * U);

    // Restaurar KYC de Bob
    await f.core.setKYCStatus(f.bob.address, true);
    await invariant();
  });
});
