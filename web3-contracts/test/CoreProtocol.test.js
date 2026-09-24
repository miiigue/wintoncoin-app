const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');
const { fixture, U } = require('./helpers/suite');

describe('Core: consentimiento, paridad, capacidad y vencimientos', function () {
  let f;
  beforeEach(async () => { f = await loadFixture(fixture); });
  it('100 al trabajador, 5 al destinatario de comisión, 105 RED al pagador', async () => {
    await f.pay(f.alice,f.bob,100n*U);
    expect(await f.blue.balanceOf(f.bob.address)).eq(100n*U);
    expect(await f.blue.balanceOf(f.treasury.target)).eq(5n*U);
    expect(await f.red.balanceOf(f.alice.address)).eq(105n*U);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
    expect(await f.blue.lockedBalanceOf(f.bob.address)).eq(100n*U);
  });
  it('Comisión 0 es válida y capacidad realmente aditiva', async () => {
    await f.core.setCommissionBps(0); await f.core.setCreditLimit(f.alice.address,100n*U);
    await f.vault.connect(f.alice).deposit(100n*U);
    expect(await f.core.getAvailableCreditCapacity(f.alice.address)).eq(200n*U);
    await f.pay(f.alice,f.bob,200n*U);
    expect(await f.core.getAvailableCreditCapacity(f.alice.address)).eq(0);
  });
  it('El relayer no cambia límites ni origina compromisos ajenos', async () => {
    await expect(f.core.connect(f.relayer).setCreditLimit(f.alice.address,U)).revertedWithCustomError(f.core,'OwnableUnauthorizedAccount');
    await expect(f.core.connect(f.relayer).processPayment(f.alice.address,f.bob.address,U)).revertedWith('Protocol: Payer authorization required');
    await expect(f.core.processPayment(f.alice.address,f.bob.address,U)).revertedWith('Protocol: Payer authorization required');
  });
  it('Firma del pagador: dominio, comisión, destinatario y nonce impiden alteración y repetición', async () => {
    const auth = { payer:f.alice.address, payee:f.bob.address, amount:100n*U, feeBps:500,
      nonce:0, deadline:(await time.latest())+900, agreementHash:ethers.id('trabajo-17') };
    const types = { Payment: [ ['payer','address'],['payee','address'],['amount','uint256'],['feeBps','uint256'],['nonce','uint256'],['deadline','uint256'],['agreementHash','bytes32'] ].map(([name,type])=>({name,type})) };
    const domain={name:'WintonCore',version:'4',chainId:(await ethers.provider.getNetwork()).chainId,verifyingContract:f.core.target};
    const signature=await f.alice.signTypedData(domain,types,auth);
    await expect(f.core.connect(f.relayer).processAuthorizedPayment({...auth,payee:f.carol.address},signature)).revertedWith('Protocol: Invalid payer signature');
    await f.core.connect(f.relayer).processAuthorizedPayment(auth,signature);
    await expect(f.core.connect(f.relayer).processAuthorizedPayment(auth,signature)).revertedWith('Protocol: Invalid payment nonce');
    const otherSignature=await f.alice.signTypedData({...domain,chainId:1},types,{...auth,nonce:1});
    await expect(f.core.connect(f.relayer).processAuthorizedPayment({...auth,nonce:1},otherSignature)).revertedWith('Protocol: Invalid payer signature');
  });
  it('KYC, autopago, límites por operación y pausa', async () => {
    await f.core.setKYCStatus(f.bob.address,false);
    await expect(f.pay(f.alice,f.bob,U)).revertedWith('Protocol: Payee KYC not verified');
    await f.core.setKYCStatus(f.bob.address,true);
    await expect(f.pay(f.alice,f.alice,U)).revertedWith('Protocol: Self payment not permitted');
    await f.core.setMaxTransactionAmount(U);
    await expect(f.pay(f.alice,f.bob,2n*U)).revertedWith('Protocol: Exceeds max transaction limit');
    await f.core.pause();
    await expect(f.pay(f.alice,f.bob,U)).revertedWithCustomError(f.core,'EnforcedPause');
  });
  it('Mora en el vencimiento exacto, sin 30 días extra; plazo cambia solo nuevas operaciones', async () => {
    await f.core.setCommissionBps(0); await f.pay(f.alice,f.bob,U);
    const original=await f.core.userDebtLots(f.alice.address,0);
    await f.core.setCommitmentDuration(15*86400); await f.pay(f.alice,f.bob,U);
    expect((await f.core.userDebtLots(f.alice.address,0)).dueAt).eq(original.dueAt);
    const next=await f.core.userDebtLots(f.alice.address,1);
    await time.increaseTo(next.dueAt);
    expect(await f.core.isDelinquent(f.alice.address)).eq(true);
    await expect(f.pay(f.alice,f.bob,U)).revertedWith('Protocol: Payer has overdue commitments');
  });
  it('El trabajo de un moroso amortiza BLUE/RED; no queda BLUE estacionado frente al vencido', async () => {
    await f.core.setCommissionBps(0); await f.pay(f.alice,f.bob,100n*U);
    const lot=await f.core.userDebtLots(f.alice.address,0);
    await time.increaseTo(lot.dueAt);
    await f.pay(f.carol,f.alice,60n*U);
    expect(await f.red.balanceOf(f.alice.address)).eq(40n*U);
    expect(await f.blue.balanceOf(f.alice.address)).eq(0);
    expect(await f.blue.totalSupply()).eq(await f.red.totalSupply());
  });
  it('BLUE no se transfiere P2P ni se vende antes de su fecha', async () => {
    await f.pay(f.alice,f.bob,100n*U);
    await expect(f.blue.connect(f.bob).transfer(f.carol.address,U)).revertedWith('BLUE: Transfers only through exchange');
    await expect(f.exchange.connect(f.bob).createBlueOrder(U)).revertedWith('BLUE: Parking not released');
    await time.increase(30*86400);
    await f.exchange.connect(f.bob).createBlueOrder(U);
    await expect(f.blue.connect(f.bob).transfer(f.carol.address,U)).revertedWith('BLUE: Transfers only through exchange');
  });
  it('Amortizar consume primero el compromiso que vence antes, incluso con plazos distintos', async () => {
    await f.core.setCommissionBps(0); await f.core.setCommitmentDuration(60*86400);
    await f.pay(f.alice,f.bob,100n*U);
    await f.core.setCommitmentDuration(15*86400); await f.pay(f.alice,f.bob,50n*U);
    await f.pay(f.carol,f.alice,50n*U); await f.core.connect(f.alice).amortizeWithBlue(50n*U);
    expect((await f.core.userDebtLots(f.alice.address,1)).repaid).eq(true);
    expect((await f.core.userDebtLots(f.alice.address,0)).remainingAmount).eq(100n*U);
  });
});
