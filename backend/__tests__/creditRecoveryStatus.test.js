'use strict';
const {readRecoveryStatus}=require('../src/services/creditRecoveryStatus');
function db(){return {query:jest.fn(async(sql,args)=>{
 if(sql.includes('SELECT * FROM credit_policy_jobs'))return {rows:[{version_id:12},{version_id:11}]};
 if(sql.includes('SELECT 1 FROM credit_policy_jobs'))return {rowCount:1};
 if(sql.includes('LEFT JOIN users'))return {rows:Array.from({length:26},(_,i)=>({user_id:i+1,version_id:args[0]}))};
 if(sql.includes('GROUP BY'))return {rows:[{status:'open',reason:'RPC',count:26}]};
 return {rows:[]};
})};}
test('defaults to current policy with bounded cursor pagination',async()=>{const pool=db();const result=await readRecoveryStatus(pool);expect(result.historical).toBe(false);expect(result.issues).toHaveLength(25);expect(result.nextAfter).toBe('25');expect(pool.query.mock.calls.find(([sql])=>sql.includes('LEFT JOIN users'))[1]).toEqual([12,'0']);});
test('historical data is explicitly labelled and parameterized',async()=>{const pool=db();const result=await readRecoveryStatus(pool,{version:'11',after:'25'});expect(result.historical).toBe(true);expect(pool.query.mock.calls.find(([sql])=>sql.includes('LEFT JOIN users'))[1]).toEqual(['11','25']);});
test('malformed filters never reach the database',async()=>{const pool=db();await expect(readRecoveryStatus(pool,{version:'1 OR 1=1'})).rejects.toMatchObject({status:400});expect(pool.query).not.toHaveBeenCalled();});
