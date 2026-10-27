const {chromium}=require('playwright'),esbuild=require('esbuild'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const build=await esbuild.build({stdin:{resolveDir:path.resolve(__dirname,'..'),loader:'jsx',contents:"import React from 'react';import{createRoot}from'react-dom/client';import Recovery from './src/components/RecoveryStatus.jsx';createRoot(document.getElementById('root')).render(<Recovery/>);"},bundle:true,write:false,plugins:[{name:'config',setup(b){b.onLoad({filter:/modules[\\/]config.js$/},()=>({contents:"export const getApiUrl=()=>'';"}));}}]});
 const browser=await chromium.launch();try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://fixture.invalid/**',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
 await page.goto('https://fixture.invalid');await page.evaluate(()=>{window.posts=0;window.fetch=async(url,options={})=>{
 if(options.method==='POST'){window.posts++;return{ok:true,json:async()=>({success:true,message:'Revisión programada'})};}
 const p=new URL(url,location.href).searchParams,historical=p.get('version')==='11',next=p.get('after')==='25';
 return{ok:true,json:async()=>({success:true,currentVersion:12,selectedVersion:historical?11:12,historical,jobs:[{version_id:12,state:'complete_with_issues',cursor_id:50},{version_id:11,state:'superseded',cursor_id:10}],groups:[{status:'dead_letter',reason:'UPDATE_UNAVAILABLE',count:'30'}],issues:[{version_id:historical?11:12,user_id:next?26:1,username:next?'second':'first',status:'dead_letter',reason:'UPDATE_UNAVAILABLE'}],nextAfter:next?null:'25',operations:[]})};
 };});
 await page.addScriptTag({content:build.outputFiles[0].text});await page.getByText('30 incidencias de la política vigente sin resolver.').waitFor();
 assert.equal(await page.getByRole('button',{name:'Solicitar revisión de esta cuenta'}).isVisible(),false);
 await page.getByText('Ver cuentas con incidencias (1 en esta página)').click();await page.getByRole('button',{name:'Siguiente',exact:true}).click();await page.getByText('@second',{exact:false}).waitFor();
 await page.getByRole('combobox').selectOption('11');await page.getByText('Historial: estas incidencias',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Solicitar revisión de esta cuenta'}).count(),0);
 await page.getByRole('combobox').selectOption('');await page.getByText('30 incidencias de la política vigente sin resolver.').waitFor();if(await page.locator('details').first().getAttribute('open')===null)await page.getByText('Ver cuentas con incidencias (1 en esta página)').click();await page.getByRole('button',{name:'Solicitar revisión de esta cuenta'}).click();assert.equal(await page.evaluate(()=>window.posts),1);assert.deepEqual(errors,[]);
 console.log('PASS: recovery summary, collapsed details, cursor pagination, read-only history and explicit exception retry.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
