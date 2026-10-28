// Shared public editions only. The authorization window is explicit and finite.
import {generateHealthNewsPreview} from './health-news-preview.mjs';
import {checkPublication,publicSourceUrl} from './health-news-verification.mjs';
export const NEWS_WEEK=Object.freeze({start:'2026-10-28T00:00:00-03:00',end:'2026-11-04T00:00:00-03:00',maxItems:10,policyVersion:4});
export const WEEK_KEY='health-news:editorial-week:latest';
const DATE_PREFIX='health-news:editorial-week:date:',RECENT='health-news:editorial-week:recent';
export const newsDay=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const newsWeekActive=(now=new Date())=>+now>=Date.parse(NEWS_WEEK.start)&&+now<Date.parse(NEWS_WEEK.end);
export function validWeeklyEdition(digest){
 if(digest?.policyVersion!==4||!/^\d{4}-\d{2}-\d{2}$/.test(digest.date||'')||!Array.isArray(digest.items)||!digest.items.length||digest.items.length>10)return false;
 if(new Set(digest.items.map(x=>x.url)).size!==digest.items.length||new Set(digest.items.map(x=>x.topicKey)).size!==digest.items.length)return false;
 return digest.items.every(x=>{try{checkPublication(x.publishedAt,digest.date,7);publicSourceUrl(x.url);return x.dateVerified===true&&x.language==='pt-BR'&&x.kind==='noticia'&&['national','global'].includes(x.scope)&&Number.isInteger(x.importance)&&x.importance>=7&&x.importance<=10&&typeof x.title==='string'&&!!x.title.trim()&&typeof x.summary==='string'&&!!x.summary.trim()&&!!x.topicKey&&!!x.scopeEvidence;}catch{return false;}});
}
export async function generateWeeklyDigest(env,now=new Date(),fetcher=fetch,editor=generateHealthNewsPreview){
 if(!newsWeekActive(now))return {status:'news-week-paused',automaticUpdates:false,endsAt:NEWS_WEEK.end};
 if(!env?.HEALTH_NEWS_KV)throw Error('Public news storage is required');
 const date=newsDay(now),cached=await env.HEALTH_NEWS_KV.get(DATE_PREFIX+date,'json');
 if(validWeeklyEdition(cached)&&cached.date===date){await env.HEALTH_NEWS_KV.put(WEEK_KEY,JSON.stringify(cached));return cached;}
 const recentValue=await env.HEALTH_NEWS_KV.get(RECENT,'json');
 const recent=Array.isArray(recentValue)?recentValue.filter(x=>typeof x?.url==='string'&&x.date<date&&Date.parse(date)-Date.parse(x.date)<=7*86400000):[];
 const preview=await editor(env,now,fetcher,{excludeUrls:recent.map(x=>x.url),excludeTopics:recent.map(x=>x.topicKey).filter(Boolean)});
 const oldUrls=new Set(recent.map(x=>x.url)),oldTopics=new Set(recent.map(x=>x.topicKey).filter(Boolean));
 const freshItems=preview.items?.filter(x=>!oldUrls.has(x.url)&&!oldTopics.has(x.topicKey));
 const digest={...preview,items:freshItems,title:'Notícias de Saúde',mode:'daily-editorial',published:true,automaticUpdates:true,window:NEWS_WEEK,generatedAt:now.toISOString()};
 // An empty or invalid result never replaces the last verified public edition.
 if(!validWeeklyEdition(digest))throw Error('No publishable verified news edition; previous edition preserved. Audit: '+JSON.stringify({date,returned:preview.items?.length,verification:preview.verification}));
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
