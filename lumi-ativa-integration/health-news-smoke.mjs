// Ephemeral runtime smoke: test existing news binding without granting the deploy token KV API access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const key=process.env.LUMI_RESEARCH_OPENAI_API_KEY;
assert.ok(account&&token&&key,'Existing deployment/research access required');
assert.equal(process.env.GITHUB_REF,'refs/heads/feature/restore-lumi-home-20261014');
const name='lumi-health-news-check-'+process.env.GITHUB_RUN_ID;
assert.match(name,/^lumi-health-news-check-[0-9]+$/);
const base=`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/`;
async function cf(path,options={}){
 const r=await fetch(base+path,{...options,headers:{authorization:`Bearer ${token}`,...options.headers},signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw Error(`Public-news runtime check control failed: HTTP ${r.status}`);
 return r;
}
const settings=(await (await cf('lumi-develop/settings')).json()).result;
const binding=settings.bindings.find(b=>b.name==='HEALTH_NEWS_KV'&&b.type==='kv_namespace');
assert.ok(binding?.namespace_id,'News namespace binding missing');
const checkToken=randomBytes(32).toString('hex');
const entry=`import {withHealthNews} from './health-news-worker.mjs';
const worker=withHealthNews({fetch(){return new Response(null,{status:404});}});
export default {async fetch(request,env,ctx){
 if(request.method!=='POST'||request.headers.get('authorization')!=='Bearer '+env.CHECK_TOKEN)return new Response(null,{status:404});
 try{const digest=await worker.scheduled({cron:'0 9 * * *',scheduledTime:Date.now()},env,ctx);return Response.json({date:digest.date,items:digest.items.length});}
 catch(error){console.error('Public news generation failed:',error.message);return Response.json({error:error.message},{status:502});}
}};`;
const form=new FormData();
form.set('metadata',new Blob([JSON.stringify({main_module:'worker.js',compatibility_date:settings.compatibility_date,bindings:[binding,{type:'secret_text',name:'OPENAI_API_KEY',text:key},{type:'secret_text',name:'CHECK_TOKEN',text:checkToken}]})],{type:'application/json'}));
for(const [module,content] of [['worker.js',entry],['health-news-worker.mjs',fs.readFileSync(new URL('./health-news-worker.mjs',import.meta.url))],['health-news-daily.mjs',fs.readFileSync(new URL('../health-news-daily.mjs',import.meta.url))]])form.set(module,new Blob([content],{type:'application/javascript+module'}),module);
let created=false;
try{
 created=true;await cf(name,{method:'PUT',body:form});
 await cf(name+'/subdomain',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({enabled:true,previews_enabled:false})});
 let response;
 // Deployment propagation retries must not repeat generation after a runtime error.
 for(let n=0;n<15;n++){
  response=await fetch(`https://${name}.psanchesnle.workers.dev/`,{method:'POST',headers:{authorization:'Bearer '+checkToken},signal:AbortSignal.timeout(180000)});
  if(response.status!==404)break;
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 const result=await response.json().catch(()=>null);
 assert.equal(response.status,200,'Generation failed: '+(result?.error||response.status));assert.equal(result?.items,5);
 let verified=false;
 for(let n=0;n<40;n++){
  const edition=await fetch('https://lumi-develop.psanchesnle.workers.dev/health-news',{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
  const data=await edition.json().catch(()=>null);
  if(edition.ok&&data?.date===result.date&&data?.items?.length===5){verified=true;break;}
  await new Promise(resolve=>setTimeout(resolve,2000));
 }
 assert.ok(verified,'Edition stored but serving-route propagation not verified yet');
 console.log(JSON.stringify({publicNewsEditionVerified:true,date:result.date,items:result.items,cronExecution:'scheduled handler exercised in temporary runtime; sandbox cron invocation remains to be observed'}));
}finally{if(created){await cf(name,{method:'DELETE'});console.log('Temporary public-news test Worker removed.');}}
