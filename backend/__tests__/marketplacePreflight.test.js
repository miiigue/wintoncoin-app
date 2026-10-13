const {assertTreasuryReady}=require('../src/services/marketplacePreflight');
test('rejects fee-bearing payment to unverified treasury before authorization',async()=>{
 const core={treasury:jest.fn().mockResolvedValue('treasury'),isKYCVerified:jest.fn().mockResolvedValue(false)};
 await expect(assertTreasuryReady(core,200n,400n)).rejects.toMatchObject({status:503,code:'TREASURY_KYC_REQUIRED'});
 core.isKYCVerified.mockResolvedValue(true);await expect(assertTreasuryReady(core,200n,400n)).resolves.toBeUndefined();
});
test('zero effective fee does not require treasury KYC',async()=>{
 const core={treasury:jest.fn()};await assertTreasuryReady(core,200n,0n);await assertTreasuryReady(core,1n,1n);expect(core.treasury).not.toHaveBeenCalled();
});
