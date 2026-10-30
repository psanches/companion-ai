// Generate inside an ephemeral runtime using the EXISTING public-news binding.
// The deployment token receives no additional KV API permissions.
import assert from 'node:assert/strict';import fs from 'node:fs';import {randomBytes} from 'node:crypto';
import {newsWeekActive,validWeeklyEdition} from '../health-news-week.mjs';
assert.equal(process.env.GITHUB_REF,'refs/heads/feature/pc-android-permanent-fix-20261016');
const {CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token,LUMI_RESEARCH_OPENAI_API_KEY:key}=process.env;
assert.ok(account&&token&&key,'Existing deployment and research credentials are required');
assert.ok(newsWeekActive(),'The authorized news week is not active');
const name='lumi-news-week-check-'+process.env.GITHUB_RUN_ID;assert.match(name,/^lumi-news-week-check-[0-9]+$/);
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/';
async function cf(path,options={}){const r=await fetch(root+path,{...options,headers:{authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('Public news runtime operation failed: HTTP '+r.status);return r;}
const settings=(await (await cf('lumi-develop/settings')).json()).result;
const binding=settings.bindings?.find(b=>b.name==='HEALTH_NEWS_KV'&&b.type==='kv_namespace');assert.ok(binding?.namespace_id,'Verified public news binding is required');
const checkToken=randomBytes(32).toString('hex');
const entry=`import {generateWeeklyDigest} from './health-news-week.mjs';
export default {async fetch(request,env){
 if(request.method!=='POST'||request.headers.get('authorization')!=='Bearer '+env.CHECK_TOKEN)return new Response(null,{status:404});
 const storage=env.HEALTH_NEWS_KV;
 // An authorized manual refresh may retry a same-day edition whose collection
 // failed, while successful same-day editions still reuse the shared cache.
 const retryEnv={...env,HEALTH_NEWS_KV:{
  async get(key,type){const value=await storage.get(key,type);return key.startsWith('health-news:editorial-week:date:')&&value?.verification?.collectionError?null:value;},
  put(...args){return storage.put(...args);}
 }};
 try{return Response.json(await generateWeeklyDigest(retryEnv));}
 catch(error){return Response.json({error:error.message},{status:502});}
}};`;
const form=new FormData();form.set('metadata',new Blob([JSON.stringify({main_module:'worker.mjs',compatibility_date:settings.compatibility_date,bindings:[binding,{type:'secret_text',name:'LUMI_RESEARCH_OPENAI_API_KEY',text:key},{type:'secret_text',name:'CHECK_TOKEN',text:checkToken}]})],{type:'application/json'}));
form.set('worker.mjs',new Blob([entry],{type:'application/javascript+module'}),'worker.mjs');
for(const module of ['health-news-week.mjs','health-news-preview.mjs','health-news-daily.mjs','health-news-verification.mjs'])form.set(module,new Blob([fs.readFileSync(new URL('../'+module,import.meta.url))],{type:'application/javascript+module'}),module);
let created=false;
try{
 created=true;await cf(name,{method:'PUT',body:form});
 await cf(name+'/subdomain',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({enabled:true,previews_enabled:false})});
 let response;
 // Retry only propagation 404s; never repeat API generation after a runtime failure.
 for(let n=0;n<20;n++){
  response=await fetch('https://'+name+'.psanchesnle.workers.dev/',{method:'POST',headers:{authorization:'Bearer '+checkToken},signal:AbortSignal.timeout(420000)});
  if(response.status!==404)break;await response.body?.cancel();await new Promise(resolve=>setTimeout(resolve,1000));
 }
 const digest=await response.json().catch(()=>null);assert.equal(response.status,200,'Initial news generation failed: '+(digest?.error||response.status));assert.ok(validWeeklyEdition(digest),'Invalid verified public edition');
 console.log(JSON.stringify({stage:'verified-weekly-edition-published',date:digest.date,items:digest.items.map(({title,url,publishedAt,importance,scope,source})=>({title,url,publishedAt,importance,scope,source})),verification:digest.verification,officialSources:digest.officialSources,window:digest.window,personalDataUsed:false}));
}finally{
 if(created){await cf(name,{method:'DELETE'});console.log(JSON.stringify({temporaryNewsWorkerRemoved:true}));}
}
