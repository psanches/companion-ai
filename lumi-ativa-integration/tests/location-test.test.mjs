import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {withLocalLocationTest,locationScript} from '../location-test-worker.mjs';
test('location test is dev only, never accepts coordinates and preserves handlers',async()=>{
 const baseline={scheduled(){},fetch:()=>new Response('baseline')};
 const app=withLocalLocationTest(baseline);
 assert.equal(app.scheduled,baseline.scheduled);
 for(const path of ['/location-test','/location-test.js']){
  const r=await app.fetch(new Request('https://lumi-develop.psanchesnle.workers.dev'+path));
  assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');
  assert.match(r.headers.get('Content-Security-Policy'),/connect-src 'none'/);
  assert.equal((await app.fetch(new Request('https://lumi-develop.psanchesnle.workers.dev'+path,{method:'POST'}))).status,405);
  assert.equal(await (await app.fetch(new Request('https://mylumicompanion.com'+path))).text(),'baseline');
 }
});
test('device permission, accuracy, stop, stale callbacks and hidden page',()=>{
 const elements=Object.fromEntries(['start','stop','status','details','map'].map(id=>[id,{removeAttribute(key){delete this[key];}}]));
 const events={};let success,failure,cleared=0;
 const document={getElementById:id=>elements[id],addEventListener:(name,fn)=>events[name]=fn,hidden:false};
 const window={isSecureContext:true,addEventListener:(name,fn)=>events[name]=fn};
 const navigator={geolocation:{watchPosition(ok,fail,options){success=ok;failure=fail;assert.equal(options.maximumAge,0);return 5;},clearWatch(id){assert.equal(id,5);cleared++;}}};
 vm.runInNewContext(locationScript,{document,window,navigator});
 assert.equal(success,undefined,'no request before explicit start');
 elements.start.onclick();
 success({coords:{latitude:-22,longitude:-49,accuracy:12},timestamp:Date.now()});
 assert.equal(elements.map.hidden,false);assert.match(elements.details.textContent,/12 metros/);
 assert.match(elements.map.href,/query=-22%2C-49/);
 elements.stop.onclick();assert.equal(cleared,1);assert.equal(elements.map.href,undefined);
 success({coords:{latitude:0,longitude:0,accuracy:1},timestamp:Date.now()});assert.equal(elements.map.hidden,true);
 elements.start.onclick();failure({code:1});assert.match(elements.status.textContent,/Permissão negada/);
 assert.equal(elements.start.disabled,false);
 elements.start.onclick();document.hidden=true;events.visibilitychange();
 assert.equal(elements.map.hidden,true);assert.match(elements.status.textContent,/pausado/);
});
