'use strict';
const {randomUUID}=require('crypto');
const {isolatedDb}=require('./helpers/exchangeDb');
const execution=require('../src/services/legacyMigrationExecution');
const policy=require('../src/services/safeAccountPolicy');
const {RecoverableAccounts}=require('../src/services/recoverableAccounts');
const enabled=process.env.PG_REVIEW_PORT;
(enabled?describe:describe.skip)('Migración automática: selección real en PostgreSQL aislado',()=>{
 let db;
 beforeAll(async()=>{
  db=await isolatedDb(enabled);
  await db.pool.query('CREATE TABLE app_settings(setting_key TEXT PRIMARY KEY,setting_value TEXT); CREATE TABLE admin_users(id SERIAL PRIMARY KEY)');
  await require('../migrations/116_durable_chain_operations').up(db.pool);
  await require('../migrations/121_recoverable_accounts').up(db.pool);
 });
 afterAll(async()=>{jest.restoreAllMocks();await db?.close();});
 test('solo continúa una activación confirmada y autorizada; no repite cuentas activas',async()=>{
  const identity=randomUUID(),id=randomUUID(),address='0x'+'1'.repeat(40);
  const user=(await db.pool.query('INSERT INTO users DEFAULT VALUES RETURNING id')).rows[0].id;
  await db.pool.query('INSERT INTO account_identities(id,user_id) VALUES($1,$2)',[identity,user]);
  await db.pool.query("INSERT INTO smart_accounts(identity_id,chain_id,address,passkey,recovery_address,manifest_hash,state) VALUES($1,'10',$2,'{}',$2,'test','prepared')",[identity,address]);
  await db.pool.query("INSERT INTO chain_operations(id,user_id,request_key,chain_id,sender,resource_key,kind,payload,state) VALUES($1::uuid,$2,$1::text,'10',$3,'test','accountActivation',$4,'confirmed')",[id,user,address,JSON.stringify({account:address,legacyPlan:{},migrationApproved:false})]);
  const status=jest.spyOn(RecoverableAccounts.prototype,'activationStatus').mockImplementation(async()=>{
   await db.pool.query("UPDATE smart_accounts SET state='active' WHERE identity_id=$1",[identity]);return {success:true};
  });
  jest.spyOn(policy,'configuration').mockReturnValue({chainId:'10',hash:'test'});
  await expect(execution.sweep(db.pool,{})).resolves.toEqual({checked:0});expect(status).not.toHaveBeenCalled();
  await db.pool.query("UPDATE chain_operations SET payload=payload||'{\"migrationApproved\":true}'::jsonb,state='prepared' WHERE id=$1",[id]);
  await expect(execution.sweep(db.pool,{})).resolves.toEqual({checked:0});
  await db.pool.query("UPDATE chain_operations SET state='confirmed' WHERE id=$1",[id]);
  await expect(execution.sweep(db.pool,{})).resolves.toEqual({checked:1});expect(status).toHaveBeenCalledWith(user,id);
  await expect(execution.sweep(db.pool,{})).resolves.toEqual({checked:0});expect(status).toHaveBeenCalledTimes(1);
 });
});
