import test from 'node:test';import assert from 'node:assert/strict';
import {generateWeeklyDigest,getWeeklyDigest,newsWeekActive,NEWS_WEEK,WEEK_KEY,validWeeklyEdition,publishableWeeklyEdition,NEWS_GENERATOR_REVISION,mergeDailyReadings} from '../../health-news-week.mjs';
import {NEWS_LIVE_HTML} from '../health-news-ui-assets.mjs';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
const now=new Date('2026-10-28T12:00:00Z');
const item={url:'https://www.parkinson.org/news/research/caregivers',publishedAt:'2026-10-27',kind:'noticia',dateVerified:true,language:'pt-BR',scope:'global',importance:8,title:'Pesquisa e cuidado',summary:Array(90).fill('evidência-fictícia').join(' '),topicKey:'caregiver-support-study',scopeEvidence:'National evidence supports caregivers throughout the country.'};
const preview={policyVersion:4,date:'2026-10-28',items:Array.from({length:6},(_,i)=>({...item,url:'https://'+['www.parkinson.org','www.nih.gov','www.who.int','www.fiocruz.br','www.paho.org','www.nature.com'][i]+'/news/test-'+i,topicKey:'study-'+i}))};
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
 assert.equal(calls,1);assert.equal(a.items.length,6);assert.equal(b.date,a.date);assert.equal(a.published,true);assert.equal(f.writes.length,4);
});
test('empty or low-quality edition never overwrites latest verified edition',async()=>{
 const f=fixture();f.data.set(WEEK_KEY,JSON.stringify({...preview,items:preview.items.slice(0,1)}));
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
test('recent public topics reach discovery exclusions; live page keeps a concise header and no quota padding',async()=>{
 const f=fixture();f.data.set('health-news:editorial-week:recent',JSON.stringify([{url:item.url,topicKey:item.topicKey,date:'2026-10-27'}]));
 const result=await generateWeeklyDigest(f.env,now,undefined,async(env,date,fetcher,options)=>{assert.deepEqual(options.excludeUrls,[item.url]);assert.deepEqual(options.excludeTopics,[item.topicKey]);return {...preview,items:[item,...preview.items]};});assert.equal(result.items.length,6);assert.ok(result.items.every(x=>x.url!==item.url));
 assert.doesNotMatch(NEWS_LIVE_HTML,/DEMONSTRAÇÃO|Demonstração estática|17\/10\/2026/);assert.doesNotMatch(NEWS_LIVE_HTML,/Seleção diária verificada|Atualização diária às|Pausa automática|O último boletim verificado permanece disponível/);assert.match(NEWS_LIVE_HTML,/<header class="news-hero"><h1>Notícias de Saúde<\/h1><\/header>/);assert.match(NEWS_LIVE_HTML,/sete dias/);
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



test('a generator revision regenerates an older same-day cache once and then reuses the new edition',async()=>{
 const f=fixture();f.data.set('health-news:editorial-week:date:2026-10-28',JSON.stringify({...preview,generatorRevision:1}));let calls=0;
 const editor=async()=>{calls++;return preview;};
 const first=await generateWeeklyDigest(f.env,now,undefined,editor);assert.equal(first.generatorRevision,NEWS_GENERATOR_REVISION);assert.equal(calls,1);
 await generateWeeklyDigest(f.env,now,undefined,editor);assert.equal(calls,1);
});


test('publication accepts three complete readings and rejects a single-source edition without deleting the last good one',async()=>{
 const f=fixture(),legacy={...preview,items:preview.items.slice(0,1)};f.data.set(WEEK_KEY,JSON.stringify(legacy));
 assert.equal(publishableWeeklyEdition(preview),true);
 for(const items of [preview.items.slice(0,2),preview.items.map((x,i)=>({...x,url:'https://www.who.int/news/'+i})),preview.items.map(x=>({...x,summary:'Uma frase muito curta.'}))]){
  assert.equal(publishableWeeklyEdition({...preview,items}),false);
  await assert.rejects(generateWeeklyDigest(f.env,now,undefined,async()=>({...preview,items})),/No publishable/);
  assert.equal(f.writes.length,0);assert.deepEqual(JSON.parse(f.data.get(WEEK_KEY)),legacy);
 }
});


test('two new readings lead the edition and one prior reading fills three, with original dates and no duplicates',async()=>{
 const f=fixture(),previous={...preview,date:'2026-10-27'};f.data.set(WEEK_KEY,JSON.stringify(previous));
 const fresh=preview.items.slice(0,2).map((x,i)=>({...x,url:x.url+'-new',topicKey:'fresh-'+i,publishedAt:'2026-10-28'}));
 const result=await generateWeeklyDigest(f.env,now,undefined,async()=>({...preview,items:fresh}));
 assert.equal(result.items.length,3);assert.deepEqual(result.items.slice(0,2).map(x=>x.topicKey),['fresh-0','fresh-1']);assert.equal(result.verification.newItems,2);assert.equal(result.verification.repeatedItems,1);
 for(const x of result.items.slice(2)){assert.equal(x.repeated,true);assert.equal(x.repeatedFromEdition,'2026-10-27');assert.equal(x.publishedAt,'2026-10-27');}
 assert.equal(new Set(result.items.map(x=>x.url)).size,3);assert.equal(new Set(result.items.map(x=>x.topicKey)).size,3);assert.equal(publishableWeeklyEdition(result),true);
});
test('failed collection can reuse three verified readings but never relabels publication dates as today',async()=>{
 const f=fixture();f.data.set(WEEK_KEY,JSON.stringify({...preview,date:'2026-10-27'}));
 const result=await generateWeeklyDigest(f.env,now,undefined,async()=>{throw Error('Search unavailable');});
 assert.equal(result.date,'2026-10-28');assert.equal(result.items.length,3);assert.equal(result.verification.newItems,0);assert.equal(result.verification.repeatedItems,3);assert.ok(result.items.every(x=>x.repeated&&x.publishedAt==='2026-10-27'));
});
test('fallback skips old and duplicate topics and never displaces new readings',()=>{
 const previous={...preview,date:'2026-10-27'},fresh=[{...preview.items[0],publishedAt:'2026-10-28'}];
 const items=mergeDailyReadings(fresh,previous,'2026-10-28');assert.equal(items.length,3);assert.equal(items[0].repeated,false);assert.equal(items.filter(x=>x.url===fresh[0].url).length,1);
 assert.equal(mergeDailyReadings([],previous,'2026-11-05').length,0);
});

test('reused readings cannot fill the edition with institutional elections or isolated accidents',()=>{
 const admin={...item,url:'https://www.who.int/news/announcement-of-candidates-for-the-position-of-who-director-general',title:'OMS anuncia candidatos ao cargo de Diretor-Geral',topicKey:'leadership'};
 const accident={...item,url:'https://www.who.int/news/train-accident',title:'Declaração sobre acidente de trem',topicKey:'accident'};
 const result=mergeDailyReadings([admin,accident],preview,preview.date);
 assert.equal(result.length,3);assert.ok(result.every(x=>!['leadership','accident'].includes(x.topicKey)));
});

test('three short, sourced readings can publish while unverified dates and unsupported text remain rejected',()=>{
 const brief={...preview,items:preview.items.slice(0,3).map(x=>({...x,summary:Array(50).fill('evidência').join(' ')}))};
 assert.equal(publishableWeeklyEdition(brief),true);
 assert.equal(publishableWeeklyEdition({...brief,items:brief.items.slice(0,2)}),false);
 for(const change of [{publishedAt:'2026-10-29'},{dateVerified:false},{scope:'regional'},{summary:Array(49).fill('palavra').join(' ')}]){
  assert.equal(publishableWeeklyEdition({...brief,items:brief.items.map((x,i)=>i===0?{...x,...change}:x)}),false);
 }
});
