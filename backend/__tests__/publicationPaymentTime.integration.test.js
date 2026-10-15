'use strict';
const {Client}=require('pg');
const migration=require('../migrations/122_publication_payment_time');
const suite=process.env.PG_SALE_TEST_PORT?describe:describe.skip;
suite('payment recording migration on isolated PostgreSQL',()=>{
 let db;
 beforeAll(async()=>{
  db=new Client({host:'127.0.0.1',port:Number(process.env.PG_SALE_TEST_PORT),user:'review122',database:'postgres'});await db.connect();
  const dir=(await db.query('SHOW data_directory')).rows[0].data_directory;
  if(!/winton-sale-122-[a-f0-9]+$/.test(dir))throw Error('Not an isolated sale test cluster');
  await db.query(`CREATE TABLE publication_acceptances(id int PRIMARY KEY,status text); CREATE TABLE chain_operations(id int PRIMARY KEY,kind text,state text,payload jsonb); CREATE TABLE marketplace_payment_settlements(operation_id int,applied_at timestamptz);
   INSERT INTO publication_acceptances VALUES(1,'confirmed_paid'),(2,'confirmed_paid'),(3,'approved');
   INSERT INTO chain_operations VALUES(1,'marketplace','confirmed','{"acceptanceId":"1"}');
   INSERT INTO marketplace_payment_settlements VALUES(1,'2026-10-13T10:00:00Z');`);
  await migration.up(db);
 });
 afterAll(async()=>{await db?.end();});
 test('uses evidenced settlement and leaves unknown date empty',async()=>{
  const {rows}=await db.query('SELECT * FROM publication_acceptances ORDER BY id');
  expect(rows[0].paid_recorded_at.toISOString()).toBe('2026-10-13T10:00:00.000Z');expect(rows[1].paid_recorded_at).toBeNull();expect(rows[2].paid_recorded_at).toBeNull();
 });
 test('stamps transition once, rolls back with payment, and is idempotent',async()=>{
  await db.query("BEGIN; UPDATE publication_acceptances SET status='confirmed_paid' WHERE id=3; ROLLBACK");
  expect((await db.query('SELECT paid_recorded_at FROM publication_acceptances WHERE id=3')).rows[0].paid_recorded_at).toBeNull();
  await db.query("UPDATE publication_acceptances SET status='confirmed_paid' WHERE id=3");
  const time=(await db.query('SELECT paid_recorded_at FROM publication_acceptances WHERE id=3')).rows[0].paid_recorded_at;
  expect(time).toBeInstanceOf(Date);
  await db.query("UPDATE publication_acceptances SET paid_recorded_at='2000-01-01' WHERE id=3");await migration.up(db);
  expect((await db.query('SELECT paid_recorded_at FROM publication_acceptances WHERE id=3')).rows[0].paid_recorded_at).toEqual(time);
  await db.query("INSERT INTO publication_acceptances(id,status) VALUES(4,'confirmed_paid')");
  expect((await db.query('SELECT paid_recorded_at FROM publication_acceptances WHERE id=4')).rows[0].paid_recorded_at).toBeInstanceOf(Date);
 });
});
