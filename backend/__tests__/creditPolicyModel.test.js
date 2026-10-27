"use strict";
const {effectiveLimit:f,MONTH}=require('../experiments/creditPolicyModel');
const unit=1000000n;
const account={base:80n*unit,protectedBase:100n*unit,bonus:10n*unit,now:1n};
test('protect only base; lost bonus is not retained by the ratchet',()=>{
 expect(f(account)).toBe(110n*unit);expect(f({...account,bonus:0n})).toBe(100n*unit);
});
test('mora dominates base protection; same input cannot halve twice',()=>{
 const state={...account,overdueSince:0n,riskAnchor:100n*unit};
 expect(f(state)).toBe(50n*unit);expect(f(state)).toBe(50n*unit);
 expect(f({...state,now:MONTH})).toBe(25n*unit);
 expect(f({...state,now:1000000000000n*MONTH})).toBe(0n);
});
test('recovery progresses without looping over elapsed months',()=>{
 const state={...account,curedAt:0n,penalty:50n*unit,target:100n*unit};
 expect(f(state)).toBe(50n*unit);expect(f({...state,now:MONTH})).toBe(60n*unit);expect(f({...state,now:1000000000n*MONTH})).toBe(100n*unit);
});
test('rejects ambiguous risk and invalid inputs instead of guessing',()=>{
 expect(()=>f({...account,overdueSince:0n})).toThrow();expect(()=>f({...account,bonus:-1n})).toThrow();
 expect(()=>f({...account,curedAt:0n,penalty:50n,target:100n,overdueSince:0n,riskAnchor:100n})).toThrow();
});
