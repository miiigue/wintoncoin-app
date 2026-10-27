const {expect}=require('chai');
const {ethers}=require('hardhat');
const {loadFixture,time}=require('@nomicfoundation/hardhat-network-helpers');
const {fixture,U}=require('./helpers/suite');
const types={MixedPayment:[['payer','address'],['payee','address'],['amount','uint256'],['feeBps','uint256'],['blueAmount','uint256'],['redAmount','uint256'],['duration','uint256'],['nonce','uint256'],['deadline','uint256'],['agreementHash','bytes32'],['payerStateHash','bytes32']].map(([name,type])=>({name,type}))};
describe('Firmas de cuentas contractuales y cambios de condiciones',()=>{
 it('ERC1271 acepta propietario correcto y rechaza firma ajena',async()=>{
  const f=await loadFixture(fixture);const account=await (await ethers.getContractFactory('MockSignatureWallet')).deploy(f.alice.address);
  await f.core.setKYCStatus(account.target,true);await f.core.setCreditLimit(account.target,1000n*U);
  const q=await f.core.quoteMixedPayment(account.target,U);const auth={payer:account.target,payee:f.bob.address,amount:U,feeBps:500,blueAmount:q.blueAmount,redAmount:q.redAmount,duration:q.duration,nonce:0,deadline:(await time.latest())+900,agreementHash:ethers.id('1271'),payerStateHash:await f.core.paymentStateHash(account.target)};
  const domain={name:'WintonCore',version:'5',chainId:(await ethers.provider.getNetwork()).chainId,verifyingContract:f.core.target};
  await expect(f.core.processAuthorizedMixedPayment(auth,await f.other.signTypedData(domain,types,auth))).revertedWithCustomError(f.core,'InvalidPayerSignature');
  await f.core.connect(f.relayer).processAuthorizedMixedPayment(auth,await f.alice.signTypedData(domain,types,auth));
  expect(await f.red.balanceOf(account.target)).eq(1_050_000n);
 });
 it('Rechaza comisión modificada, caducidad y receptor institucional sin KYC',async()=>{
  const f=await loadFixture(fixture);
  const q=await f.core.quoteMixedPayment(f.alice.address,U);const auth={payer:f.alice.address,payee:f.bob.address,amount:U,feeBps:500,blueAmount:q.blueAmount,redAmount:q.redAmount,duration:q.duration,nonce:0,deadline:(await time.latest())+900,agreementHash:ethers.id('terms'),payerStateHash:await f.core.paymentStateHash(f.alice.address)};
  const sig=await f.alice.signTypedData({name:'WintonCore',version:'5',chainId:(await ethers.provider.getNetwork()).chainId,verifyingContract:f.core.target},types,auth);
  await f.core.setCommissionBps(600);
  await expect(f.core.processAuthorizedMixedPayment(auth,sig)).revertedWithCustomError(f.core,'CommissionChanged');
  await f.core.setCommissionBps(500);await time.increaseTo(auth.deadline+1);
  await expect(f.core.processAuthorizedMixedPayment(auth,sig)).revertedWithCustomError(f.core,'PaymentAuthorizationExpired');
  await f.core.setKYCStatus(f.treasury.target,false);
  await expect(f.pay(f.alice,f.bob,U)).revertedWith('Protocol: Treasury KYC not verified');
 });
});
