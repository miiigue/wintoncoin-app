'use strict';
const {URL}=require('url');
function assertDemoTarget(env,expected){
 if(env.IS_DEMO_ENV!=='true')throw Error('Se requiere entorno demo explícito.');
 if(String(expected.chainId)!=='11155420')throw Error('Solo Optimism Sepolia.');
 const url=new URL(env.DATABASE_URL||'');
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!==expected.host||decodeURIComponent(url.pathname.slice(1))!==expected.database||decodeURIComponent(url.username)!==expected.role)throw Error('La base no coincide con el destino demo verificado.');
 return url;
}
async function reset(client,env,expected,{apply=false}={}){
 assertDemoTarget(env,expected);
 await client.query(apply?'BEGIN':'BEGIN READ ONLY');
 try{
  const identity=(await client.query('SELECT current_database() AS name,current_user AS role')).rows[0];
  if(identity.name!==expected.database||identity.role!==expected.role)throw Error('Identidad real de PostgreSQL distinta del destino autorizado.');
  if(apply){
   if(env.DEMO_SERVICES_STOPPED!=='true')throw Error('Detén primero el backend y sus trabajadores de demo.');
   const active=(await client.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'")).rows[0].n;
   if(active!==0)throw Error('Hay conexiones de demo abiertas; no se ejecuta el borrado.');
   await client.query('SET LOCAL lock_timeout = \'5s\'');
   await client.query('DROP SCHEMA public CASCADE');
   await client.query('CREATE SCHEMA public');
  }
  await client.query('COMMIT');return {applied:apply,database:identity.name,role:identity.role};
 }catch(e){await client.query('ROLLBACK');throw e;}
}
module.exports={assertDemoTarget,reset};
if(require.main===module){
 (async()=>{
  const fs=require('fs'),{Client}=require('pg');
  if(!process.env.DEMO_RESET_TARGET_PATH)throw Error('Falta destino demo verificado.');
  const expected=JSON.parse(fs.readFileSync(process.env.DEMO_RESET_TARGET_PATH,'utf8'));
  const url=assertDemoTarget(process.env,expected);
  const ssl=['127.0.0.1','localhost'].includes(url.hostname)?false:{rejectUnauthorized:process.env.DEMO_DB_TLS_VERIFY!=='false'};
  const client=new Client({connectionString:process.env.DATABASE_URL,ssl,connectionTimeoutMillis:8000});
  try{await client.connect();console.log(JSON.stringify(await reset(client,process.env,expected,{apply:process.argv.includes('--apply')})));}finally{await client.end()}
 })().catch(()=>{console.error('Reinicio demo detenido: comprueba destino, aislamiento, conexiones y permisos. No se muestran credenciales.');process.exitCode=1});
}
