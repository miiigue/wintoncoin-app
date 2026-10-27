'use strict';
jest.mock('../src/services/chainOperationStore',()=>({locked:(_pool,_key,fn)=>fn(_pool)}));
const {tick,retryIssue}=require('../src/services/creditPolicyJobs');
function fixture(job={version_id:1,state:'pending',cursor_id:0},op='confirmed'){
 const calls=[];const db={query:jest.fn(async(sql,args)=>{
  calls.push([sql,args]);
  if(sql.includes('SELECT * FROM credit_policy_jobs'))return {rows:[job]};
  if(sql.includes('SELECT * FROM credit_policy_issues'))return {rows:[]};
  if(sql.includes('SELECT state FROM chain_operations'))return {rows:[{state:op}]};
  if(sql.includes('SELECT id FROM users'))return {rows:[{id:Number(args[0])+1}]};
  return {rows:[],rowCount:0};
 })};return {db,calls};
}
test('skips at most twenty unchanged accounts and persists progress',async()=>{
 const {db,calls}=fixture();const score={syncCreditLimitOnChain:jest.fn(async()=>({skipped:true}))};await tick(db,score);
 expect(score.syncCreditLimitOnChain).toHaveBeenCalledTimes(20);
 expect(calls.filter(([sql])=>sql.includes('SET cursor_id')).at(-1)[1]).toEqual([1,20]);
});
test('confirmed operation advances past its account',async()=>{
 const {db}=fixture({version_id:1,state:'pending',cursor_id:4,operation_id:'op',pending_user_id:5});const score={syncCreditLimitOnChain:jest.fn(async()=>({operationId:'next'}))};await tick(db,score);expect(score.syncCreditLimitOnChain).toHaveBeenCalledTimes(1);expect(score.syncCreditLimitOnChain).toHaveBeenCalledWith(6);
});
test('pending operation never starts another account',async()=>{
 const {db}=fixture({version_id:1,state:'pending',cursor_id:4,operation_id:'op',pending_user_id:5},'pending');const score={syncCreditLimitOnChain:jest.fn()};await tick(db,score);expect(score.syncCreditLimitOnChain).not.toHaveBeenCalled();
});
test('first failure stops the batch instead of amplifying an outage',async()=>{
 const {db}=fixture();const score={syncCreditLimitOnChain:jest.fn(async()=>{throw Error('RPC unavailable');})};await tick(db,score);expect(score.syncCreditLimitOnChain).toHaveBeenCalledTimes(1);
});
test('manual retry cannot reset a pending transaction',async()=>{
 const db={query:jest.fn(async sql=>sql.includes('SELECT id FROM credit_policy_versions')?{rows:[{id:1}]}:{rows:[{}],rowCount:1})};await expect(retryIssue(db,1,2)).rejects.toMatchObject({status:409});expect(db.query.mock.calls.some(([sql])=>sql.includes('SET status'))).toBe(false);
});
