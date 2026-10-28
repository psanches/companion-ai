import test from 'node:test';import assert from 'node:assert/strict';
import {generateWeeklyDigest,getWeeklyDigest,newsWeekActive,NEWS_WEEK,WEEK_KEY,validWeeklyEdition} from '../../health-news-week.mjs';
import {NEWS_LIVE_HTML} from '../health-news-ui-assets.mjs';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
const now=new Date('2026-10-28T12:00:00Z');
const item={url:'https://www.parkinson.org/news/research/caregivers',publishedAt:'2026-10-27',kind:'noticia',dateVerified:true,language:'pt-BR',scope:'global',importance:8,title:'Pesquisa e cuidado',summary:'Uma pesquisa avaliou o apoio ao cuidador. Há limitações amostrais.',topicKey:'caregiver-support-study',scopeEvidence:'National evidence supports caregivers throughout the country.'};
const preview={policyVersion:4,date:'2026-10-28',items:[item]};
function fixture(){const data=new Map(),writes=[];return {data,writes,env:{HEALTH_NEWS_KV:{get:async k=>data.has(k)?JSON.parse(data.get(k)):null,put:async(k,v)=>{writes.push(k);data.set(k,v);}}}};}
test('window has seven local calendar days and stops before reading credentials or storage',async()=>{
 assert.equal(newsWeekActive(new Date('2026-10-28T02:59:59Z')),false);assert.equal(newsWeekActive(new Date('2026-10-28T03:00:00Z')),true);
 assert.equal(newsWeekActive(new Date('2026-11-04T02:59:59Z')),true);assert.equal(newsWeekActive(new Date('2026-11-04T03:00:00Z')),false);
 const result=await generateWeeklyDigest(new Proxy({},{get(){throw Error('No access after expiry');}}),new Date('2026-11-04T03:00:00Z'));
 assert.equal(result.automaticUpdates,false);assert.equal(Date.parse(NEWS_WEEK.end)-Date.parse(NEWS_WEEK.start),7*86400000);
});
test('one shared collection per date, accepting fewer than ten rather than padding',async()=>{
 const f=fixture();let calls=0;const editor=async()=>{calls++;return preview;};
 const a=await generateWeeklyDigest(f.env,now,undefined,editor),b=await generateWeeklyDigest(f.env,now,undefined,editor);
 assert.equal(calls,1);assert.equal(a.items.length,1);assert.equal(b.date,a.date);assert.equal(a.published,true);assert.equal(f.writes.length,4);
});
test('empty or low-quality edition never overwrites latest verified edition',async()=>{
 const f=fixture();f.data.set(WEEK_KEY,JSON.stringify(preview));
 await assert.rejects(generateWeeklyDigest(f.env,now,undefined,async()=>({...preview,items:[]})),/No publishable/);assert.equal(f.writes.length,0);
 assert.equal(validWeeklyEdition({...preview,items:[{...item,importance:6}]}),false);
 assert.equal(validWeeklyEdition({...preview,items:[{...item,scope:'regional'}]}),false);
 assert.equal(validWeeklyEdition({...preview,items:[{...item,publishedAt:'2026-10-10'}]}),false);
 assert.equal(validWeeklyEdition({...preview,items:[item,item]}),false);
});
test('after expiry readers see the real edition date without new API calls',async()=>{
 const f=fixture();f.data.set(WEEK_KEY,JSON.stringify(preview));
 const result=await getWeeklyDigest(f.env,new Date('2026-11-05T12:00:00Z'));assert.equal(result.date,'2026-10-28');assert.equal(result.mode,'week-complete');assert.equal(result.automaticUpdates,false);assert.equal(result.stale,true);assert.equal(f.writes.length,0);
});
test('recent public topics reach discovery exclusions; live page states dates and no quota padding',async()=>{
 const f=fixture();f.data.set('health-news:editorial-week:recent',JSON.stringify([{url:item.url,topicKey:item.topicKey,date:'2026-10-27'}]));
 const result=await generateWeeklyDigest(f.env,now,undefined,async(env,date,fetcher,options)=>{assert.deepEqual(options.excludeUrls,[item.url]);assert.deepEqual(options.excludeTopics,[item.topicKey]);return {...preview,items:[item,{...item,url:item.url+'-new',topicKey:'new-study'}]};});assert.equal(result.items.length,1);assert.equal(result.items[0].topicKey,'new-study');
 assert.doesNotMatch(NEWS_LIVE_HTML,/DEMONSTRAÇÃO|Demonstração estática|17\/10\/2026/);assert.match(NEWS_LIVE_HTML,/04\/11/);assert.match(NEWS_LIVE_HTML,/sete dias/);
});
test('packaged news wrapper generates only for its cron inside the window; HTTP remains read-only',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lumi-news-week-'));
 try{
  for(const name of ['health-news-worker.mjs','health-news-ui-assets.mjs'])fs.copyFileSync(new URL('../'+name,import.meta.url),path.join(dir,name));
  for(const name of ['health-news-daily.mjs','health-news-verification.mjs'])fs.copyFileSync(new URL('../../'+name,import.meta.url),path.join(dir,name));
  const {withHealthNews}=await import(pathToFileURL(path.join(dir,'health-news-worker.mjs')));
  let generated=0,read=0,waited=0;const original={fetch:()=>new Response('original'),scheduled:()=> 'other'};
  const worker=withHealthNews(original,async()=>{generated++;return preview;},async()=>{read++;return preview;},{live:true,active:newsWeekActive});
  const response=await worker.fetch(new Request('https://lumi-develop.psanchesnle.workers.dev/health-news'),{},{});assert.equal(response.status,200);assert.equal(read,1);assert.equal(generated,0);
  const page=await worker.fetch(new Request('https://lumi-develop.psanchesnle.workers.dev/noticias'),{},{});assert.doesNotMatch(await page.text(),/Demonstração estática/);
  await worker.scheduled({cron:'0 9 * * *',scheduledTime:+now},{},{waitUntil(){waited++;}});assert.equal(generated,1);assert.equal(waited,1);
  const result=worker.scheduled({cron:'0 9 * * *',scheduledTime:+new Date('2026-11-04T03:00:00Z')},{},{});assert.equal(result.automaticUpdates,false);assert.equal(generated,1);
  assert.equal(worker.scheduled({cron:'other'}),'other');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
