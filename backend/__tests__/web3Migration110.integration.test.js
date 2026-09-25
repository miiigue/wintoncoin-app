const { Client } = require('pg');
const migration = require('../migrations/110_add_suspended_status_and_held_refunds');
const migration109 = require('../migrations/109_web3_suite_v4_contracts_and_governance');
const enabled=process.env.WINTON_MIGRATION_TEST_PORT;
const suite=enabled?describe:describe.skip;
suite('Migración110: PostgreSQL aislado real (no usar DB del proyecto)',()=>{
 let client;
 beforeAll(async()=>{
  client=new Client({host:'127.0.0.1',port:Number(enabled),user:'review070',database:'postgres'});await client.connect();
  const info=await client.query('SHOW data_directory');if(!info.rows[0].data_directory.replaceAll('\\','/').endsWith('/pg-review-070'))throw Error('Se exige instancia aislada pg-review-070');
 });
 beforeEach(async()=>{await client.query('BEGIN');await client.query('CREATE SCHEMA test110');await client.query('SET LOCAL search_path TO test110,public');});
 afterEach(async()=>{await client.query('ROLLBACK');});afterAll(async()=>{await client?.end();});
 async function base(){await client.query('CREATE TABLE users(id SERIAL PRIMARY KEY); CREATE TABLE web3_wallets_sync(onchain_blue_balance NUMERIC,onchain_red_debt NUMERIC)');await migration109.up(client);}
 const addr='0x'+'1'.repeat(40), wallet='0x'+'2'.repeat(40),tx='0x'+'a'.repeat(64),block='0x'+'b'.repeat(64);
 async function balance(chain='10',exchange=addr,amount='2.000001') {return client.query('INSERT INTO web3_pending_refunds(chain_id,exchange_address,wallet_address,token_type,amount,block_number,block_hash) VALUES($1,$2,$3,$4,$5,$6,$7)',[chain,exchange,wallet,'BLUE',amount,'100',block]);}
 test('Dependencias faltantes deben fallar de forma visible',async()=>{await expect(migration.up(client)).rejects.toThrow();});
 test('Aplicar dos veces conserva filas y no inventa una época observada',async()=>{
  await base();await migration.up(client);await client.query("INSERT INTO web3_contract_deployments(network,chain_id,contract_name,contract_address) VALUES('test','10','ProtocolTreasury',$1)",[addr]);await migration.up(client);
  expect((await client.query('SELECT current_reward_epoch FROM web3_contract_deployments')).rows[0].current_reward_epoch).toBeNull();
 });
 test('El espejo de saldo es único por red, contrato, billetera y token',async()=>{await base();await migration.up(client);await balance();await balance('11155420');await balance('10','0x'+'3'.repeat(40));await expect(balance()).rejects.toMatchObject({code:'23505'});});
 test('No admite saldo negativo',async()=>{await base();await migration.up(client);await expect(balance('10',addr,'-1')).rejects.toMatchObject({code:'23514'});});
 test('No redondea silenciosamente fracciones inferiores a una microunidad',async()=>{await base();await migration.up(client);await expect(balance('10',addr,'1.0000001')).rejects.toMatchObject({code:'23514'});});
 test('Conserva exactamente el máximo uint128 en unidades de token',async()=>{await base();await migration.up(client);const value='340282366920938463463374607431768.211455';await balance('10',addr,value);expect((await client.query('SELECT amount::text FROM web3_pending_refunds')).rows[0].amount).toBe(value);});
 test('Eventos duplicados no se contabilizan dos veces; dos logs de una transacción sí',async()=>{await base();await migration.up(client);const insert=i=>client.query('INSERT INTO web3_refund_events(chain_id,exchange_address,tx_hash,log_index,block_number,block_hash,wallet_address,event_name,blue_amount,usdt_amount) VALUES($1,$2,$3,$4,100,$5,$6,$7,1,0)',['10',addr,tx,i,block,wallet,'RefundHeld']);await insert(0);await insert(1);await expect(insert(0)).rejects.toMatchObject({code:'23505'});});
 test('SUSPENDED válido y secuencia uint64 completa; época uint256 completa',async()=>{
  await base();await migration.up(client);
  await client.query("INSERT INTO web3_fifo_exchange_orders(onchain_order_id,sequence_id,wallet_address,side,original_amount,remaining_amount,status,suspend_reason,resubmitted_sequence_id) VALUES(18446744073709551615,18446744073709551615,$1,'SELL_BLUE',1,1,'SUSPENDED',1,18446744073709551615)",[wallet]);
  await client.query("INSERT INTO web3_contract_deployments(network,chain_id,contract_name,contract_address,current_reward_epoch) VALUES('test','10','ProtocolTreasury',$1,$2)",[addr,((1n<<256n)-1n).toString()]);
  expect((await client.query('SELECT sequence_id::text FROM web3_fifo_exchange_orders')).rows[0].sequence_id).toBe('18446744073709551615');
 });
 test('Rollback de versión no destruye historial de devoluciones',async()=>{await base();await migration.up(client);await balance();await expect(migration.down(client)).rejects.toThrow();});
 test('Registro legado sin procedencia no se borra ni se asigna a una red inventada',async()=>{await base();await client.query('CREATE TABLE web3_pending_refunds(id SERIAL PRIMARY KEY,wallet_address TEXT, amount NUMERIC)');await client.query('INSERT INTO web3_pending_refunds(wallet_address,amount) VALUES($1,7)',[wallet]);await expect(migration.up(client)).rejects.toThrow(/reconcil/i);});
 test('Fallo SQL intermedio deshace toda la migración y conserva la causa del error',async()=>{
  await base();const faulty={query:async(sql,...args)=>{if(sql.includes('ALTER TABLE web3_contract_deployments'))return client.query('SELECT 1/0');return client.query(sql,...args);}};
  await expect(migration.up(faulty)).rejects.toMatchObject({code:'22012'});
  expect((await client.query("SELECT to_regclass('web3_pending_refunds') AS name")).rows[0].name).toBeNull();
  expect((await client.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='test110' AND table_name='web3_fifo_exchange_orders' AND column_name='suspend_reason'")).rows[0].n).toBe(0);
 });
 test('111 actualiza un esquema110 antiguo vacío y conserva época antigua como NO observada',async()=>{
  await base();await client.query('CREATE TABLE web3_pending_refunds(id SERIAL PRIMARY KEY,wallet_address TEXT,amount NUMERIC); ALTER TABLE web3_contract_deployments ADD COLUMN current_reward_epoch BIGINT DEFAULT 1');
  await client.query("INSERT INTO web3_contract_deployments(network,chain_id,contract_name,contract_address) VALUES('test','10','ProtocolTreasury',$1)",[addr]);
  await require('../migrations/111_repair_web3_refund_provenance').up(client);await balance();
  const row=(await client.query('SELECT current_reward_epoch,reward_epoch_observed FROM web3_contract_deployments')).rows[0];expect(row.current_reward_epoch).toBe('1');expect(row.reward_epoch_observed).toBe(false);
  await migration.up(client);expect((await client.query('SELECT count(*)::int AS n FROM web3_pending_refunds')).rows[0].n).toBe(1);
 });
 test('No permite declarar época observada sin bloque y hash de origen',async()=>{
  await base();await migration.up(client);await expect(client.query("INSERT INTO web3_contract_deployments(network,chain_id,contract_name,contract_address,current_reward_epoch,reward_epoch_observed) VALUES('test','10','ProtocolTreasury',$1,1,true)",[addr])).rejects.toMatchObject({code:'23514'});
 });
 test('No ejecuta cambios de esquema fuera de una transacción',async()=>{
  await client.query('ROLLBACK');await expect(migration.up(client)).rejects.toMatchObject({code:'25P01'});
 });

});
