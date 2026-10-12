'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../src/middleware/adminSession.js'),'utf8');
function fixture(env={}) {
 const module={exports:{}};
 vm.runInNewContext(source,{module,URL,process:{env:{NODE_ENV:'production',ADMIN_SECRET_KEY:'synthetic-admin',JWT_SECRET:'synthetic-user',...env}},require:name=>name==='jsonwebtoken'?{verify:()=>({userId:1,role:'admin',pwdVersion:'1234567890'})}:{query:async()=>({rows:[{id:1,username:'fixture',role:'admin',account_status:'active',password_hash:'hash1234567890'}]})}});
 return module.exports;
}
(async()=>{
 const {trustedOrigin,verifySession}=fixture();let checks=0;
 for(const origin of [undefined,'null','not-a-url','https://outside.example','http://demo.wintoncoin.com','https://unknown.wintoncoin.com','https://demo.wintoncoin.com:444','http://localhost:3000','https://localhost']) {
  assert.equal(trustedOrigin({headers:{origin,authorization:'Bearer '+'x'.repeat(40)}}),false);checks++;
 }
 for(const origin of ['https://demo.wintoncoin.com','https://www.demo.wintoncoin.com','https://sc.wintoncoin.com','https://wintoncoin.com']){assert.equal(trustedOrigin({headers:{origin}}),true);checks++;}
 assert.equal(trustedOrigin({headers:{referer:'https://demo.wintoncoin.com/wallet.html'}}),true);checks++;
 assert.equal(fixture({NODE_ENV:'development'}).trustedOrigin({headers:{origin:'http://localhost:3000'}}),true);checks++;
 assert.equal(fixture({FRONTEND_URL:'http://localhost:3000'}).trustedOrigin({headers:{origin:'http://localhost:3000'}}),false);checks++;
 for(const [origin,expected] of [['https://outside.example',403],['https://demo.wintoncoin.com',200]]) {
  let status=200,next=false;
  const res={locals:{},setHeader(){},status(n){status=n;return this;},json(){}};
  await verifySession({method:'POST',headers:{origin,authorization:'Bearer '+'x'.repeat(40)},cookies:{admin_token:'synthetic-valid-cookie'}},res,()=>{next=true;});
  assert.equal(status,expected);assert.equal(next,expected===200);checks++;
 }
 console.log('PASS: '+checks+' origin boundary checks; synthetic sessions, no database or network.');
})().catch(e=>{console.error(e);process.exitCode=1;});
