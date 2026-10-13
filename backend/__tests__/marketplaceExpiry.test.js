const {canRenewUnsentPayment}=require('../src/services/marketplaceExpiry');
const row={state:'prepared',steps:[],payload:{authorization:{deadline:100}}};
test('renew only expired unsent preparation with verified chain time',()=>{
 expect(canRenewUnsentPayment(row,101,false)).toBe(true);
 for(const time of [99,100,undefined,NaN])expect(canRenewUnsentPayment(row,time,false)).toBe(false);
 for(const state of ['pending','conflict','confirmed','failed'])expect(canRenewUnsentPayment({...row,state},101,false)).toBe(false);
 expect(canRenewUnsentPayment({...row,steps:[{hash:'fixture'}]},101,false)).toBe(false);
 expect(canRenewUnsentPayment(row,101,true)).toBe(false);
 expect(canRenewUnsentPayment({...row,payload:{}},101,false)).toBe(false);
});
