import test from 'node:test';import assert from 'node:assert/strict';
import {withSharedScience,sharedScienceCatalog} from '../../companion-science/shared-worker.mjs';
const origin='https://lumi-develop.psanchesnle.workers.dev';
const request=(message,headers={},host=origin)=>new Request(host+'/chat',{method:'POST',headers:{origin:host,authorization:'Bearer valid','content-type':'application/json',...headers},body:JSON.stringify({message,history:[{role:'user',content:'untrusted client data'}]})});
function fixture(){const store=new Map(),calls=[];const env={Memory:{async get(k,type){calls.push(['get',k]);const v=store.get(k);return type==='json'&&v?JSON.parse(v):v||null;},async put(k,v){calls.push(['put',k]);store.set(k,v);}}};const original={fetch:async(r,e)=>{calls.push(['baseline',e]);return Response.json({reply:'baseline'});}};return {store,calls,env,worker:withSharedScience(original,{verify:async t=>t==='valid'?{id:'alice'}:t==='bob'?{id:'bob'}:null})};}
test('public catalog is versioned, read only and identical for all users without touching personal memory',async()=>{
 const f=fixture(),data=sharedScienceCatalog();assert.equal(data.topics.length,33);assert.equal(data.doctoralResearch.filter(t=>t.kind==='Tese de doutorado concluída').length,4);assert.equal(data.doctoralResearch.filter(t=>t.kind==='Grupo com doutorandos identificados').length,1);assert.equal(data.topics.filter(t=>t.category==='Fonoaudiologia').length,5);assert.equal(data.topics.filter(t=>t.category==='Psicologia e saúde emocional').length,5);
 for(const token of ['valid','bob']){const r=await f.worker.fetch(new Request(origin+'/companion-science/catalog',{headers:{authorization:'Bearer '+token}}),f.env);assert.match(r.headers.get('cache-control'),/public/);assert.deepEqual(await r.json(),data);}
 assert.equal(f.calls.length,0);
 assert.equal((await f.worker.fetch(new Request(origin+'/companion-science/catalog',{method:'POST',body:'{}'}),f.env)).status,405);
});
test('explicit science lookup returns canonical evidence without AI, retains history and only writes owner conversation',async()=>{
 const f=fixture();f.store.set('memory:user:alice','Private personal data');f.store.set('history:user:alice',JSON.stringify([{role:'user',content:'previous topic'}]));
 const r=await f.worker.fetch(request('Companion: Terapia de voz e LSVT LOUD'),f.env);const d=await r.json();assert.equal(r.status,200);assert.equal(d.modelCalls,0);assert.equal(d.knowledgeSource,'shared-science');assert.match(d.reply,/388 participantes/);assert.match(d.reply,/esforço vocal/);assert.match(d.reply,/https:\/\/pmc/);assert.equal(d.history[0].content,'previous topic');assert.doesNotMatch(d.reply,/Private personal|untrusted client/);assert.equal(f.store.get('memory:user:alice'),'Private personal data');assert.deepEqual(f.calls.filter(x=>x[0]==='put').map(x=>x[1]),['history:user:alice']);assert.equal(f.calls.some(x=>x[0]==='baseline'),false);
 const second=await(await f.worker.fetch(request('Companion: Terapia de voz e LSVT LOUD',{authorization:'Bearer bob'}),f.env)).json();assert.equal(second.reply,d.reply);assert.equal(second.history.length,2);
});
test('shared lookup requires owner authentication and origin; unknown topics never fabricate a scientific answer',async()=>{
 const f=fixture();for(const [h,status]of [[{authorization:'Bearer invalid'},401],[{origin:'https://evil.example'},403]])assert.equal((await f.worker.fetch(request('Companion: protein',h),f.env)).status,status);assert.equal(f.calls.length,0);
 const d=await(await f.worker.fetch(request('Companion: unknown'),f.env)).json();assert.equal(d.topicId,null);assert.equal(d.modelCalls,0);assert.match(d.reply,/não consta/);
});
test('general chat, personal requests, new research and production keep existing behavior',async()=>{
 const f=fixture();for(const q of ['Tenho depressão, qual remédio tomar?','Pesquise novos papers de fonoaudiologia','Lembre que meu nome é Pedro','Quero conversar sobre ansiedade'])assert.equal((await(await f.worker.fetch(request(q),f.env)).json()).reply,'baseline');
 assert.equal((await(await f.worker.fetch(request('Companion: protein',{},'https://mylumicompanion.com'),f.env)).json()).reply,'baseline');assert.equal(f.calls.filter(x=>x[0]==='put').length,0);
});
test('failed conversation persistence does not claim a successful saved response',async()=>{
 const f=fixture();f.env.Memory.put=async()=>{throw Error('unavailable');};const r=await f.worker.fetch(request('Companion: psychology'),f.env);assert.equal(r.status,503);assert.equal((await r.json()).knowledgeSource,undefined);
});
