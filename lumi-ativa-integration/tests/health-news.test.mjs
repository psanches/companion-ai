import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {packageWorker} from '../package-worker.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lumi-health-'));
for(const name of ['health-news-worker.mjs']) fs.copyFileSync(new URL('../'+name,import.meta.url),path.join(dir,name));
fs.copyFileSync(new URL('../../health-news-daily.mjs',import.meta.url),path.join(dir,'health-news-daily.mjs'));
const {withHealthNews}=await import(pathToFileURL(path.join(dir,'health-news-worker.mjs')));
test.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
test('cron dispatch uses scheduled time and exposes failures without swallowing them',async()=>{
 const env={}, date=Date.parse('2026-10-16T09:00:00Z');let received,waited;
 const w=withHealthNews({fetch(){}},async(e,now)=>{received=[e,now];return 'ok';});
 assert.equal(await w.scheduled({cron:'0 9 * * *',scheduledTime:date},env,{waitUntil(p){waited=p;}}),'ok');
 assert.equal(await waited,'ok');assert.equal(received[0],env);assert.equal(+received[1],date);
 const failed=withHealthNews({fetch(){}},async()=>{throw Error('failed');});
 await assert.rejects(failed.scheduled({cron:'0 9 * * *',scheduledTime:date},env,{waitUntil(){}}),/failed/);
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
test('daily generator reuses Brazilian-day cache and retains last good digest on API failure',async()=>{
 const {generateHealthDigest}=await import('../../health-news-daily.mjs');
 const savedFetch=globalThis.fetch;let requests=0,puts=[];
 const cached={date:'2026-10-16',items:['existing']};
 try{
  globalThis.fetch=async()=>{requests++;return new Response('failure',{status:503});};
  const env={OPENAI_API_KEY:'test-only',HEALTH_NEWS_KV:{get:async(key)=>key==='health-news:date:2026-10-16'?cached:null,put:async(...args)=>puts.push(args)}};
  assert.equal(await generateHealthDigest(env,new Date('2026-10-16T09:00:00Z')),cached);assert.equal(requests,0);
  env.HEALTH_NEWS_KV.get=async()=>null;
  await assert.rejects(generateHealthDigest(env,new Date('2026-10-17T09:00:00Z')),/503/);
  assert.deepEqual(puts,[]);assert.equal(requests,1);
  await assert.rejects(generateHealthDigest({}),/required/);
 }finally{globalThis.fetch=savedFetch;}
});
