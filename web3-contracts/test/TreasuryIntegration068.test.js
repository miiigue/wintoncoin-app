const {expect}=require('chai');
const {ethers}=require('hardhat');
const {loadFixture,time}=require('@nomicfoundation/hardhat-network-helpers');
const {fixture,U}=require('./helpers/suite');
const leaf=(t,epoch,user,amount,chain=1337)=>ethers.keccak256(ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256','address','uint256','address','uint256'],[chain,t,epoch,user,amount])));
describe('Tesorería real: bonos, comisiones y ciclos',()=>{
 let f;beforeEach(async()=>{f=await loadFixture(fixture);await f.core.setCommissionBps(0);await f.core.connect(f.alice).processPayment(f.alice.address,f.treasury.target,100n*U);});
 async function root(amount=10n*U){await f.treasury.setMerkleRoot(leaf(f.treasury.target,(await f.treasury.rewardEpoch())+1n,f.bob.address,amount));}
 for(const bps of [0,500,1000])it(`Bono100, comisión ${bps/100}%: destinatario100 aparcados, tesorería sin RED, suministros iguales`,async()=>{
  await f.core.setCommissionBps(bps);await root(100n*U);const supply=await f.blue.totalSupply();
  const r=await(await f.treasury.connect(f.bob).claimBoosterReward(100n*U,[])).wait();
  expect(await f.blue.balanceOf(f.treasury.target)).eq(0);expect(await f.red.balanceOf(f.treasury.target)).eq(0);
  expect(await f.blue.balanceOf(f.bob.address)).eq(100n*U);expect(await f.blue.lockedBalanceOf(f.bob.address)).eq(100n*U);
  expect(await f.blue.totalSupply()).eq(supply);expect(await f.red.totalSupply()).eq(supply);
  console.log(JSON.stringify({treasuryRewardGas:r.gasUsed.toString(),feeBps:bps}));
 });
 it('Falta capacidad para la comisión: revierte todo sin consumir el bono',async()=>{
  await f.core.setCommissionBps(500);await f.core.setCreditLimit(f.treasury.target,100n*U);await root(100n*U);
  await expect(f.treasury.connect(f.bob).claimBoosterReward(100n*U,[])).revertedWith('Protocol: Insufficient credit capacity');
  expect(await f.treasury.hasClaimed(f.bob.address)).eq(false);expect(await f.blue.balanceOf(f.treasury.target)).eq(100n*U);expect(await f.red.balanceOf(f.treasury.target)).eq(0);
 });
 it('Fondos insuficientes no consumen el derecho de reclamo',async()=>{
  await root(101n*U);await expect(f.treasury.connect(f.bob).claimBoosterReward(101n*U,[])).revertedWith('Treasury: Insufficient BLUE liquidity in treasury');expect(await f.treasury.hasClaimed(f.bob.address)).eq(false);
 });
 for(const role of ['bob','treasury'])it(`KYC suspendido ${role}: sin emisión, quema ni reclamo consumido`,async()=>{
  await root();await f.core.setKYCStatus(f[role].target||f[role].address,false);
  await expect(f.treasury.connect(f.bob).claimBoosterReward(10n*U,[])).reverted;
  expect(await f.treasury.hasClaimed(f.bob.address)).eq(false);expect(await f.red.balanceOf(f.treasury.target)).eq(0);
 });
 it('Pausa del protocolo revierte todo y permite reintentar después',async()=>{
  await root();await f.core.pause();await expect(f.treasury.connect(f.bob).claimBoosterReward(10n*U,[])).revertedWithCustomError(f.core,'EnforcedPause');
  expect(await f.treasury.hasClaimed(f.bob.address)).eq(false);await f.core.unpause();await f.treasury.connect(f.bob).claimBoosterReward(10n*U,[]);
 });
 it('Repetir una raíz antigua no habilita cobrarla de nuevo; nueva época sí',async()=>{
  await root();const old=await f.treasury.currentMerkleRoot();await f.treasury.connect(f.bob).claimBoosterReward(10n*U,[]);
  await f.treasury.setMerkleRoot(old);await expect(f.treasury.connect(f.bob).claimBoosterReward(10n*U,[])).revertedWith('Treasury: Invalid Merkle proof');
  await root();await f.treasury.connect(f.bob).claimBoosterReward(10n*U,[]);expect(await f.blue.balanceOf(f.bob.address)).eq(20n*U);
 });
 for(const wrong of ['chain','contract','amount','user'])it(`Prueba de bono no se reutiliza con ${wrong} diferente`,async()=>{
  const hash=leaf(wrong==='contract'?f.core.target:f.treasury.target,1,wrong==='user'?f.carol.address:f.bob.address,wrong==='amount'?11n*U:10n*U,wrong==='chain'?1:1337);
  await f.treasury.setMerkleRoot(hash);await expect(f.treasury.connect(f.bob).claimBoosterReward(10n*U,[])).revertedWith('Treasury: Invalid Merkle proof');
 });
 it('Enlace irreversible, administrador requerido y autocobro prohibido',async()=>{
  await expect(f.treasury.connect(f.bob).setCoreProtocol(f.core.target)).revertedWithCustomError(f.treasury,'OwnableUnauthorizedAccount');
  await expect(f.treasury.setCoreProtocol(f.core.target)).revertedWith('Treasury: Invalid core');
  await f.treasury.setCorporateTreasuryWallet(f.treasury.target);await f.treasury.proposeSurplusWithdrawal(U);await time.increase(48*3600);
  await expect(f.treasury.executeSurplusWithdrawal()).revertedWith('Protocol: Self payment not permitted');expect((await f.treasury.activeSurplusProposal()).executed).eq(false);
 });
 it('Pausa también detiene pago corporativo y propuesta expirada no ejecuta',async()=>{
  await f.treasury.setCorporateTreasuryWallet(f.carol.address);await f.treasury.proposeSurplusWithdrawal(U);await time.increase(48*3600);await f.treasury.pause();
  await expect(f.treasury.executeSurplusWithdrawal()).revertedWithCustomError(f.treasury,'EnforcedPause');await f.treasury.unpause();await time.increase(7*86400+1);
  await expect(f.treasury.executeSurplusWithdrawal()).revertedWith('Treasury: Proposal has expired (7 days)');
 });
});
