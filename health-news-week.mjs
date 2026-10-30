// Shared public editions only. The authorization window is explicit and finite.
import {generateHealthNewsPreview,NEWS_PREVIEW_POLICY,newsOrganization,unrelatedHealthTopic} from './health-news-preview.mjs';
import {checkPublication,publicSourceUrl} from './health-news-verification.mjs';
export const NEWS_WEEK=Object.freeze({start:'2026-10-28T00:00:00-03:00',end:'2026-11-04T00:00:00-03:00',maxItems:10,policyVersion:4});
export const NEWS_GENERATOR_REVISION=4;
export const WEEK_KEY='health-news:editorial-week:latest';
const DATE_PREFIX='health-news:editorial-week:date:',RECENT='health-news:editorial-week:recent';
export const newsDay=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const newsWeekActive=(now=new Date())=>+now>=Date.parse(NEWS_WEEK.start)&&+now<Date.parse(NEWS_WEEK.end);
export function validWeeklyEdition(digest){
 if(digest?.policyVersion!==4||!/^\d{4}-\d{2}-\d{2}$/.test(digest.date||'')||!Array.isArray(digest.items)||!digest.items.length||digest.items.length>10)return false;
 if(new Set(digest.items.map(x=>x.url)).size!==digest.items.length||new Set(digest.items.map(x=>x.topicKey)).size!==digest.items.length)return false;
 return digest.items.every(x=>{try{checkPublication(x.publishedAt,digest.date,7);publicSourceUrl(x.url);return x.dateVerified===true&&x.language==='pt-BR'&&x.kind==='noticia'&&['national','global'].includes(x.scope)&&Number.isInteger(x.importance)&&x.importance>=7&&x.importance<=10&&typeof x.title==='string'&&!!x.title.trim()&&typeof x.summary==='string'&&!!x.summary.trim()&&!!x.topicKey&&!!x.scopeEvidence;}catch{return false;}});
}
export function publishableWeeklyEdition(digest){
 if(!validWeeklyEdition(digest)||digest.items.length<NEWS_PREVIEW_POLICY.minItems)return false;
 const counts=new Map();
 for(const item of digest.items){const key=newsOrganization(item.url),count=(counts.get(key)||0)+1;counts.set(key,count);if(count>NEWS_PREVIEW_POLICY.maxPerSource)return false;const words=item.summary.trim().split(/\s+/).length;if(words<NEWS_PREVIEW_POLICY.minSummaryWords||words>NEWS_PREVIEW_POLICY.maxSummaryWords)return false;}
 return true;
}
export function mergeDailyReadings(fresh,previous,date){
 const items=[],urls=new Set(),topics=new Set(),organizations=new Map();
 function append(item,repeated=false){
  if(!item||unrelatedHealthTopic(item.url+' '+item.title))return;const candidate={...item};
  if(!validWeeklyEdition({policyVersion:4,date,items:[candidate]}))return;
  const words=candidate.summary.trim().split(/\s+/).length;if(words<NEWS_PREVIEW_POLICY.minSummaryWords||words>NEWS_PREVIEW_POLICY.maxSummaryWords)return;
  const organization=newsOrganization(candidate.url);if(urls.has(candidate.url)||topics.has(candidate.topicKey)||(organizations.get(organization)||0)>=NEWS_PREVIEW_POLICY.maxPerSource)return;
  urls.add(candidate.url);topics.add(candidate.topicKey);organizations.set(organization,(organizations.get(organization)||0)+1);
  candidate.repeated=repeated;
  if(repeated)candidate.repeatedFromEdition=previous.date;else delete candidate.repeatedFromEdition;
  items.push(candidate);
 }
 const newest=(a,b)=>b.publishedAt.localeCompare(a.publishedAt);
 for(const item of (Array.isArray(fresh)?fresh:[]).filter(x=>x&&typeof x.publishedAt==='string').sort(newest)){append(item);if(items.length===NEWS_PREVIEW_POLICY.maxItems)break;}
 if(items.length<NEWS_PREVIEW_POLICY.minItems&&validWeeklyEdition(previous)){
  for(const item of [...previous.items].sort(newest)){append(item,true);if(items.length>=NEWS_PREVIEW_POLICY.minItems)break;}
 }
 return items;
}
export async function generateWeeklyDigest(env,now=new Date(),fetcher=fetch,editor=generateHealthNewsPreview){
 if(!newsWeekActive(now))return {status:'news-week-paused',automaticUpdates:false,endsAt:NEWS_WEEK.end};
 if(!env?.HEALTH_NEWS_KV)throw Error('Public news storage is required');
 const date=newsDay(now),cached=await env.HEALTH_NEWS_KV.get(DATE_PREFIX+date,'json');
 if(publishableWeeklyEdition(cached)&&cached.date===date&&cached.generatorRevision===NEWS_GENERATOR_REVISION){await env.HEALTH_NEWS_KV.put(WEEK_KEY,JSON.stringify(cached));return cached;}
 const recentValue=await env.HEALTH_NEWS_KV.get(RECENT,'json');
 const recent=Array.isArray(recentValue)?recentValue.filter(x=>typeof x?.url==='string'&&x.date<date&&Date.parse(date)-Date.parse(x.date)<=7*86400000):[];
 const previous=await env.HEALTH_NEWS_KV.get(WEEK_KEY,'json');
 let preview,collectionError=null;
 try{preview=await editor(env,now,fetcher,{fillMinimum:true,excludeUrls:recent.map(x=>x.url),excludeTopics:recent.map(x=>x.topicKey).filter(Boolean)});}catch(error){collectionError=String(error.message||'Collection unavailable').slice(0,500);preview={policyVersion:4,date,items:[]};}
 const oldUrls=new Set(recent.map(x=>x.url)),oldTopics=new Set(recent.map(x=>x.topicKey).filter(Boolean));
 const freshItems=Array.isArray(preview?.items)?preview.items.filter(x=>x&&!oldUrls.has(x.url)&&!oldTopics.has(x.topicKey)):[];
 const items=mergeDailyReadings(freshItems,previous,date);
 const digest={...preview,date,shortfall:Math.max(0,NEWS_PREVIEW_POLICY.maxItems-items.length),verification:{...preview?.verification,newItems:items.filter(x=>!x.repeated).length,repeatedItems:items.filter(x=>x.repeated).length,...(collectionError?{collectionError}:{})},generatorRevision:NEWS_GENERATOR_REVISION,items,title:'Notícias de Saúde',mode:'daily-editorial',published:true,automaticUpdates:true,window:NEWS_WEEK,generatedAt:now.toISOString()};
 // New readings first; prior verified readings fill the minimum without changing publication dates.
 if(!publishableWeeklyEdition(digest))throw Error('No publishable verified news edition; previous edition preserved. Audit: '+JSON.stringify({date,returned:preview?.items?.length,verification:preview?.verification,collectionError}));
 await env.HEALTH_NEWS_KV.put(DATE_PREFIX+date,JSON.stringify(digest),{expirationTtl:60*60*24*45});
 await env.HEALTH_NEWS_KV.put(WEEK_KEY,JSON.stringify(digest));
 await env.HEALTH_NEWS_KV.put(RECENT,JSON.stringify([...recent,...digest.items.map(x=>({url:x.url,topicKey:x.topicKey,date}))]),{expirationTtl:60*60*24*30});
 return digest;
}
export async function getWeeklyDigest(env,now=new Date()){
 if(!env?.HEALTH_NEWS_KV)return null;
 const stored=await env.HEALTH_NEWS_KV.get(WEEK_KEY,'json');if(!validWeeklyEdition(stored))return null;
 const active=newsWeekActive(now);
 // Keep the real edition date when generation stops or today's collection fails.
 return {...stored,stale:stored.date!==newsDay(now),automaticUpdates:active,mode:active?'daily-editorial':'week-complete',window:NEWS_WEEK};
}

