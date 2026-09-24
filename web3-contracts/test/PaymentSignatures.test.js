const {expect}=require('chai');
const {ethers}=require('hardhat');
const {loadFixture,time}=require('@nomicfoundation/hardhat-network-helpers');
const {fixture,U}=require('./helpers/suite');
const types={Payment:[['payer','address'],['payee','address'],['amount','uint256'],['feeBps','uint256'],['nonce','uint256'],['deadline','uint256'],['agreementHash','bytes32']].map(([name,type])=>({name,type}))};
describe('Firmas de cuentas contractuales y cambios de condiciones',()=>{
 it('ERC1271 acepta propietario correcto y rechaza firma ajena',async()=>{
  const f=await loadFixture(fixture);const account=await (await ethers.getContractFactory('MockSignatureWallet')).deploy(f.alice.address);
  await f.core.setKYCStatus(account.target,true);await f.core.setCreditLimit(account.target,1000n*U);
  const auth={payer:account.target,payee:f.bob.address,amount:U,feeBps:500,nonce:0,deadline:(await time.latest())+900,agreementHash:ethers.id('1271')};
  const domain={name:'WintonCore',version:'4',chainId:(await ethers.provider.getNetwork()).chainId,verifyingContract:f.core.target};
  await expect(f.core.processAuthorizedPayment(auth,await f.other.signTypedData(domain,types,auth))).revertedWith('Protocol: Invalid payer signature');
  await f.core.connect(f.relayer).processAuthorizedPayment(auth,await f.alice.signTypedData(domain,types,auth));
  expect(await f.red.balanceOf(account.target)).eq(1_050_000n);
 });
 it('Rechaza comisión modificada, caducidad y receptor institucional sin KYC',async()=>{
  const f=await loadFixture(fixture);
  const auth={payer:f.alice.address,payee:f.bob.address,amount:U,feeBps:500,nonce:0,deadline:(await time.latest())+900,agreementHash:ethers.id('terms')};
  const sig=await f.alice.signTypedData({name:'WintonCore',version:'4',chainId:(await ethers.provider.getNetwork()).chainId,verifyingContract:f.core.target},types,auth);
  await f.core.setCommissionBps(600);
  await expect(f.core.processAuthorizedPayment(auth,sig)).revertedWith('Protocol: Commission changed');
  await f.core.setCommissionBps(500);await time.increaseTo(auth.deadline+1);
  await expect(f.core.processAuthorizedPayment(auth,sig)).revertedWith('Protocol: Payment authorization expired');
  await f.core.setKYCStatus(f.treasury.target,false);
  await expect(f.pay(f.alice,f.bob,U)).revertedWith('Protocol: Treasury KYC not verified');
 });
});
