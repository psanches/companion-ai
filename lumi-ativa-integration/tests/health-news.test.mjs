import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {packageWorker} from '../package-worker.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lumi-health-'));
for(const name of ['health-news-worker.mjs','health-news-ui-assets.mjs']) fs.copyFileSync(new URL('../'+name,import.meta.url),path.join(dir,name));
for(const name of ['health-news-daily.mjs','health-news-verification.mjs'])fs.copyFileSync(new URL('../../'+name,import.meta.url),path.join(dir,name));
const {withHealthNews}=await import(pathToFileURL(path.join(dir,'health-news-worker.mjs')));
test.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
test('news cron is paused and never calls generation during static demonstration',()=>{
 let calls=0;const worker=withHealthNews({fetch(){}},()=>{calls++;throw Error('Generation disabled');});
 assert.deepEqual(worker.scheduled({cron:'0 9 * * *'}, {}, {}),{status:'demo-static',automaticUpdates:false});
 assert.equal(calls,0);
});
test('existing routes, receiver, handlers and unrelated schedules are preserved',async()=>{
 const original={async fetch(...args){assert.equal(this,original);return new Response(args[0].url);},scheduled(){assert.equal(this,original);return 'existing';},queue(){return 'queue';}};
 const w=withHealthNews(original);
 for(const url of ['https://lumi-develop.psanchesnle.workers.dev/chat','https://mylumicompanion.com/health-news']) assert.equal(await (await w.fetch(new Request(url))).text(),url);
 assert.equal(w.scheduled({cron:'other'}),'existing');assert.equal(w.queue(),'queue');
});
test('public endpoint only reads stored public news, no generation from HTTP',async()=>{
 let calls=0;const w=withHealthNews({fetch(){}},()=>{calls++;},async()=>({date:'2026-10-16',items:[]}));
 const req=method=>new Request('https://lumi-develop.psanchesnle.workers.dev/health-news',{method});
 assert.equal((await w.fetch(req('GET'))).status,200);
 assert.equal(await (await w.fetch(req('HEAD'))).text(),'');
 assert.equal((await w.fetch(req('POST'))).status,405);assert.equal(calls,0);
});
test('deployment package includes executable default scheduled handler and all imports',async()=>{
 const modules=packageWorker({type:'application/javascript+module',bytes:Buffer.from('export default {fetch(){return new Response("baseline")}}')});
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lumi-package-'));
 try{
  fs.writeFileSync(path.join(root,'package.json'),'{"type":"module"}');
  for(const m of modules)fs.writeFileSync(path.join(root,m.name),m.bytes);
  const {default:worker}=await import(pathToFileURL(path.join(root,'worker.js')));
  assert.equal(typeof worker.scheduled,'function');assert.equal(typeof worker.fetch,'function');
  const response=await worker.fetch(new Request('https://other.example/chat'),{},{});assert.equal(await response.text(),'baseline');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('verified edition is reused; legacy cache is hidden and does not prevent regeneration',async()=>{
 const {generateHealthDigest,getLatestHealthDigest,validEdition}=await import('../../health-news-daily.mjs');
 const cached={policyVersion:3,date:'2026-10-16',items:Array.from({length:5},(_,i)=>({url:'https://www.nia.nih.gov/news/test'+i,publishedAt:'2026-10-15',kind:'noticia',dateVerified:true,language:'pt-BR',summary:'Texto'}))};
 let writes=[];const env={OPENAI_API_KEY:'test',HEALTH_NEWS_KV:{get:async()=>cached,put:async(...a)=>writes.push(a)}};
 assert.equal(await generateHealthDigest(env,new Date('2026-10-16T09:00:00Z')),cached);assert.equal(writes.length,1);
 assert.equal(validEdition({...cached,policyVersion:1},'2026-10-16'),false);
 env.HEALTH_NEWS_KV.get=async()=>({date:'2026-10-16',items:['legacy']});
 assert.equal(await getLatestHealthDigest(env),null);
 env.HEALTH_NEWS_KV.get=async()=>({...cached,items:cached.items.map((x,i)=>i?x:{...x,publishedAt:'2026-10-17'})});assert.equal(await getLatestHealthDigest(env,new Date('2026-10-16T09:00:00Z')),null);
 env.HEALTH_NEWS_KV.get=async()=>({date:'2026-10-16',items:['legacy']});
 await assert.rejects(generateHealthDigest(env,new Date('2026-10-16T09:00:00Z'),async()=>new Response('',{status:503})),/503/);assert.equal(writes.length,1);
});
test('international source is date-verified before Portuguese translation and persistence',async()=>{
 const {generateHealthDigest}=await import('../../health-news-daily.mjs');let calls=0,writes=[];
 const source='https://www.nia.nih.gov/news/test';
 const env={LUMI_RESEARCH_OPENAI_API_KEY:'test',HEALTH_NEWS_KV:{get:async()=>null,put:async(...a)=>writes.push(a)}};
 const response=output=>Response.json({status:'completed',output});
 const message=items=>({type:'message',content:[{type:'output_text',text:JSON.stringify({items})}]});
 const fetcher=async(url,opts)=>{
  if(['https://www.michaeljfox.org/research-news','https://agencia.fapesp.br/','https://www.gov.br/saude/pt-br/assuntos/noticias-ms'].includes(url))return new Response('',{status:503});
  if(url.startsWith(source))return new Response('<meta property="article:published_time" content="2026-10-15T10:00:00Z"><h1>Research news</h1><p>'+('Evidence and limitations of a supervised study. '.repeat(20))+'</p>',{headers:{'content-type':'text/html'}});
  const body=JSON.parse(opts.body);calls++;
  if(calls===1){assert.equal(body.max_tool_calls,6);assert.ok(body.input.includes('português e inglês'));return response([{type:'web_search_call',action:{sources:Array.from({length:5},(_,i)=>({url:source+i}))}},message(Array.from({length:5},(_,i)=>({url:source+i,publishedAt:'2026-10-15'})))]);}
  assert.equal(body.tools,undefined);assert.match(body.input[0].content,/português do Brasil/);
  return response([message(Array.from({length:5},(_,id)=>({id,title:'Estudo sobre saúde '+id,summary:'Uma pesquisa avaliou a saúde. Os resultados ainda são preliminares.'})))]);
 };
 const digest=await generateHealthDigest(env,new Date('2026-10-16T09:00:00Z'),fetcher);
 assert.equal(calls,2);assert.equal(writes.length,3);assert.equal(digest.items.length,5);assert.equal(digest.items[0].region,'Internacional');assert.equal(digest.items[0].publishedAt,'2026-10-15');assert.equal(digest.items[0].dateVerified,true);assert.equal(digest.items[0].sourceText,undefined);
});
test('incomplete discovery fails without overwriting storage',async()=>{
 const {generateHealthDigest}=await import('../../health-news-daily.mjs');let writes=0;
 const env={OPENAI_API_KEY:'test',HEALTH_NEWS_KV:{get:async()=>null,put:async()=>writes++}};
 await assert.rejects(generateHealthDigest(env,new Date(),async()=>Response.json({status:'incomplete',incomplete_details:{reason:'max_output_tokens'}})),/incomplete/);assert.equal(writes,0);
});
test('sandbox homepage receives reader assets while production HTML remains untouched',async()=>{
 const original={fetch(){return new Response('<html><body><main>Original Lumi</main></body></html>',{headers:{'content-type':'text/html','etag':'old','content-length':'60'}});}};
 const worker=withHealthNews(original);
 const home=await worker.fetch(new Request('https://lumi-develop.psanchesnle.workers.dev/'));
 const html=await home.text();assert.match(html,/Original Lumi/);assert.match(html,/health-news-ui.js/);assert.equal(home.headers.has('content-length'),false);assert.equal(home.headers.has('etag'),false);
 const prod=await worker.fetch(new Request('https://mylumicompanion.com/'));assert.doesNotMatch(await prod.text(),/health-news-ui/);
 const reader=await worker.fetch(new Request('https://lumi-develop.psanchesnle.workers.dev/noticias'));assert.match(await reader.text(),/Notícias de Saúde/);
});
test('supplementary research completes exactly five daily readings and never publishes a partial edition',async()=>{
 const {generateHealthDigest}=await import('../../health-news-daily.mjs');
 const base='https://www.nia.nih.gov/news/health-',message=items=>({type:'message',content:[{type:'output_text',text:JSON.stringify({items})}]});
 const api=items=>Response.json({status:'completed',output:[{type:'web_search_call',action:{sources:items.map(x=>({url:x.url}))}},message(items)]});
 let calls=0,writes=0;
 const env={OPENAI_API_KEY:'test',HEALTH_NEWS_KV:{get:async()=>null,put:async()=>writes++}};
 const fetcher=async(url,options)=>{
  if(['https://www.michaeljfox.org/research-news','https://agencia.fapesp.br/','https://www.gov.br/saude/pt-br/assuntos/noticias-ms'].includes(url))return new Response('',{status:503});
  if(url.startsWith(base))return new Response('<meta property="article:published_time" content="2026-10-15"><h1>Health discovery</h1><p>'+('New prevention research with limitations. '.repeat(20))+'</p>',{headers:{'content-type':'text/html'}});
  calls++;if(calls===1)return api([0,1,2].map(i=>({url:base+i})));
  if(calls===2){assert.equal(JSON.parse(options.body).max_tool_calls,4);return api([2,3,4].map(i=>({url:base+i})));}
  return Response.json({status:'completed',output:[message(Array.from({length:5},(_,id)=>({id,title:'Saúde '+id,summary:'Estudo sobre prevenção. Os achados têm limitações.'})))]});
 };
 const digest=await generateHealthDigest(env,new Date('2026-10-16T09:00:00Z'),fetcher);assert.equal(calls,3);assert.equal(digest.items.length,5);assert.equal(new Set(digest.items.map(x=>x.url)).size,5);assert.equal(writes,3);
 calls=0;writes=0;
 await assert.rejects(generateHealthDigest(env,new Date('2026-10-16T09:00:00Z'),async(url,options)=>{
  if(['https://www.michaeljfox.org/research-news','https://agencia.fapesp.br/','https://www.gov.br/saude/pt-br/assuntos/noticias-ms'].includes(url))return new Response('',{status:503});
  if(url.startsWith(base))return fetcher(url,options);
  return api([{url:base+1}]);
 }),/complete five/);assert.equal(writes,0);
});
