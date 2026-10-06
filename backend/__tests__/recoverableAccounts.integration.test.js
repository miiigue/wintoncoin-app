'use strict';
const {isolatedDb}=require('./helpers/exchangeDb');
const {ensureIdentity,attachReviewedDocument}=require('../src/services/accountIdentity');
const {randomUUID}=require('crypto');
const suite=process.env.PG_REVIEW_PORT?describe:describe.skip;
suite('Identidad recuperable: PostgreSQL aislado',()=>{
 let db;
 beforeAll(async()=>{
  db=await isolatedDb(process.env.PG_REVIEW_PORT);
  await db.pool.query('CREATE TABLE admin_users(id INTEGER PRIMARY KEY); INSERT INTO admin_users VALUES(1); INSERT INTO users(id) VALUES(1),(2)');
  await require('../migrations/121_recoverable_accounts').up(db.pool);
 });
 afterAll(async()=>{await db?.close();});
 test('migración repetida conserva identidades y no cambia saldos',async()=>{
  const identity=await ensureIdentity(db.pool,1);
  await require('../migrations/121_recoverable_accounts').up(db.pool);
  expect((await ensureIdentity(db.pool,1)).id).toBe(identity.id);
 });
 test('dos solicitudes simultáneas no asignan el mismo documento a dos usuarios',async()=>{
  async function register(userId){const client=await db.pool.connect();try{await client.query('BEGIN');const r=await attachReviewedDocument(client,{userId,reviewerId:1,country:'AR',type:'passport',number:'AB123456',evidenceReference:'synthetic-review'},'test-only-key-for-identity-00000000000');await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
  const results=await Promise.allSettled([register(1),register(2)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
  expect((await db.pool.query('SELECT * FROM identity_documents')).rowCount).toBe(1);
 });
 test('una identidad no puede abrir dos cuentas en la misma red ni dos recuperaciones simultáneas',async()=>{
  const a=await ensureIdentity(db.pool,1);
  const insert=()=>db.pool.query("INSERT INTO smart_accounts(identity_id,chain_id,address,passkey,recovery_address,manifest_hash,state) VALUES($1,'10',$2,'{}',$3,'synthetic','prepared')",[a.id,'0x'+'1'.repeat(40),'0x'+'2'.repeat(40)]);
  await insert();await expect(insert()).rejects.toMatchObject({code:'23505'});
  const recovery=()=>db.pool.query("INSERT INTO account_recovery_cases(id,identity_id,chain_id,terms_version) VALUES($1,$2,'10','synthetic')",[randomUUID(),a.id]);
  await recovery();await expect(recovery()).rejects.toMatchObject({code:'23505'});
 });
});
