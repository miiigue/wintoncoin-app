import test from 'node:test';
import assert from 'node:assert/strict';
import {registerAppWorker} from '../src/modules/swRegistration.js';
function fixture(path='/admin-panel.html') {
 const events={},nodes=[];let reloads=0,updates=0,registration;
 const on=(key,fn)=>{events[key]=fn;};
 const sw={addEventListener:on,register:async(...args)=>{registration=args;return {update:async()=>updates++};}};
 const win={navigator:{serviceWorker:sw},location:{pathname:path,reload:()=>reloads++},addEventListener:on};
 const doc={visibilityState:'visible',readyState:'complete',addEventListener:on,body:{appendChild:n=>nodes.push(n)},getElementById:id=>nodes.find(n=>n.id===id),createElement:()=>({style:{},setAttribute(){}})};
 registerAppWorker(win,doc);
 return {events,nodes,sw,win,doc,get reloads(){return reloads},get updates(){return updates},get registration(){return registration}};
}
test('registers without HTTP cache and checks for updates',async()=>{
 const f=fixture();await new Promise(setImmediate);
 assert.deepEqual(f.registration,['/sw-source.js',{scope:'/',updateViaCache:'none'}]);assert.equal(f.updates,1);
 await f.events.focus();assert.equal(f.updates,1);
});
test('updates a clean admin page only once',()=>{const f=fixture();f.events.controllerchange();f.events.controllerchange();assert.equal(f.reloads,1);});
test('never reloads an administrator with unsaved edits',()=>{const f=fixture();f.events.input();f.events.controllerchange();f.events.controllerchange();assert.equal(f.reloads,0);assert.equal(f.nodes.length,1);assert.match(f.nodes[0].textContent,/Guarda tus cambios/);});
test('does not interrupt wallet or payment pages',()=>{const f=fixture('/wallet.html');f.events.controllerchange();assert.equal(f.reloads,0);assert.equal(f.nodes.length,0);});
test('a clean admin page restored by browser history is refreshed',()=>{const f=fixture();f.events.pageshow({persisted:false});assert.equal(f.reloads,0);f.events.pageshow({persisted:true});assert.equal(f.reloads,1);});
