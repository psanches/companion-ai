import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lumi-static-news-'));
for(const name of ['health-news-worker.mjs','health-news-ui-assets.mjs'])fs.copyFileSync(new URL('../'+name,import.meta.url),path.join(dir,name));
for(const name of ['health-news-daily.mjs','health-news-verification.mjs'])fs.copyFileSync(new URL('../../'+name,import.meta.url),path.join(dir,name));
const {withHealthNews}=await import(pathToFileURL(path.join(dir,'health-news-worker.mjs')));
test.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
test('static public edition requires no KV, research calls or date refresh',async()=>{
 const env=new Proxy({},{get(){throw Error('Static news must not read credentials or storage');}});
 const worker=withHealthNews({fetch(){throw Error('Unexpected fallback');}},()=>{throw Error('Generation must stay paused');});
 const response=await worker.fetch(new Request('https://lumi-develop.psanchesnle.workers.dev/health-news'),env,{});
 const data=await response.json();assert.equal(response.status,200);assert.equal(data.mode,'demo-static');assert.equal(data.date,'2026-10-17');assert.equal(data.items.length,5);assert.equal(data.automaticUpdates,false);
 assert.deepEqual(worker.scheduled({cron:'0 9 * * *'},env,{}),{status:'demo-static',automaticUpdates:false});
});
test('unrelated schedules remain owned by original worker',()=>{
 const original={scheduled(c){assert.equal(this,original);return c.cron;}};
 assert.equal(withHealthNews(original).scheduled({cron:'other'}),'other');
});
test('reader clearly labels frozen demonstration and keeps original dates',async()=>{
 const response=await withHealthNews({}).fetch(new Request('https://lumi-develop.psanchesnle.workers.dev/noticias'));
 const html=await response.text();assert.match(html,/DEMONSTRAÇÃO/);assert.ok(html.includes('17/10/2026'));assert.match(html,/Sem atualização automática/);
});
