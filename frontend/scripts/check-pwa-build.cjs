const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
// Only local build files. No accounts, backend credentials or blockchain requests.
(async () => {
 const browser = await chromium.launch({headless:true});
 try {
  for (const folder of process.argv.slice(2).length ? process.argv.slice(2) : ['dist-demo','dist']) {
   assert(['dist-demo','dist'].includes(folder), 'Unsupported build folder');
   const root = path.resolve(__dirname,'..',folder);
   assert(fs.existsSync(path.join(root,'sw-source.js')), 'Build the application first');
   const missing=[];
   const server=http.createServer((req,res)=>{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(name==='/__pwa_test'){res.setHeader('Content-Type','text/html');res.end('<title>Local PWA verification</title>');return;}
    const file=path.resolve(root,'.'+name);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
     missing.push(name);res.statusCode=404;res.end();return;
    }
    const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json'};
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
    fs.createReadStream(file).pipe(res);
   });
   await new Promise(r=>server.listen(0,'127.0.0.1',r));
   const context=await browser.newContext();
   try {
    const page=await context.newPage();
    await page.goto('http://127.0.0.1:'+server.address().port+'/__pwa_test');
    await page.evaluate(()=>navigator.serviceWorker.register('/sw-source.js',{scope:'/'}));
    const worker=fs.readFileSync(path.join(root,'sw-source.js'),'utf8');
    const expected=[...worker.matchAll(/\{"revision":[^}]+,"url":"([^"]+)"\}/g)]
     .map(m=>'/'+m[1]).filter(p=>!/^\/(?:admin(?:[/.\-]|$)|governance-panel|momentum-admin)/.test(p));
    assert(expected.length>0,'Precache manifest not found');
    let cached=[],active=false;const deadline=Date.now()+30000;
    do {
     ({cached,active}=await page.evaluate(async()=>{
      const cached=[];for(const name of await caches.keys())for(const r of await (await caches.open(name)).keys())cached.push(new URL(r.url).pathname);
      return {cached,active:(await navigator.serviceWorker.getRegistration())?.active?.state==='activated'};
     }));
     if(active&&expected.every(p=>cached.includes(p)))break;
     await new Promise(r=>setTimeout(r,100));
    } while(Date.now()<deadline);
    assert(active,'Worker did not activate');
    assert(expected.every(p=>cached.includes(p)),'Precache incomplete');
    assert(cached.includes('/wallet.html'),'Wallet absent from precache: '+JSON.stringify(cached));
    assert(!cached.some(p=>/^\/(?:admin(?:[/.\-]|$)|governance-panel|momentum-admin)/.test(p)),'Administrative HTML must not be cached');
    assert.deepEqual(missing,[],'Precache contains missing files');
    await context.setOffline(true);
    assert(await page.evaluate(async()=>Boolean(await caches.match('/wallet.html',{ignoreSearch:true}))),'Wallet shell unavailable offline');
    console.log('PASS '+folder+': worker activated, '+cached.length+' cached resources, no admin HTML or missing files.');
   } finally {await context.close();await new Promise(r=>server.close(r));}
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
