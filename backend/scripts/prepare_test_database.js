'use strict';
const {URL}=require('url');
async function prepare(){
 if(process.env.NODE_ENV!=='test')throw Error('Solo NODE_ENV=test.');
 const url=new URL(process.env.DATABASE_URL||'');
 if(!['localhost','127.0.0.1'].includes(url.hostname)||!decodeURIComponent(url.pathname.slice(1)).endsWith('_test')||Number(url.port||5432)!==Number(process.env.PG_REVIEW_PORT||5432))throw Error('Solo base local de pruebas explícita.');
 const pool=require('../src/config/db');
 const directory=(await pool.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/');
 if(!directory.endsWith('/pg-review-070'))throw Error('Clúster de pruebas no reconocido.');
 process.env.PLATFORM_USER_PASSWORD ||= require('crypto').randomBytes(32).toString('hex');
 await require('../src/config/databaseInit').initializeDatabase();
 await require('./migrationRunner').runPendingMigrations();
 console.log('TEST_DATABASE_READY: estructura y configuración inicial preparadas.');
}
module.exports={prepare};
if(require.main===module)prepare().then(()=>process.exit(0)).catch(()=>{console.error('TEST_DATABASE_SETUP_FAILED: verifica entorno local de pruebas.');process.exit(1)});
