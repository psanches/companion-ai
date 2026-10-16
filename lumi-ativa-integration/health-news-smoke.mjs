// Initialize/verify today's public edition using the existing dedicated research secret.
// Only the HEALTH_NEWS_KV namespace is accessed; no personal namespaces are read.
import assert from 'node:assert/strict';
import {generateHealthDigest} from '../health-news-daily.mjs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const key=process.env.LUMI_RESEARCH_OPENAI_API_KEY;
assert.ok(account&&token&&key,'Existing deployment/research access required');
const base=`https://api.cloudflare.com/client/v4/accounts/${account}`;
async function cf(path,options={}){
 const r=await fetch(base+path,{...options,headers:{authorization:`Bearer ${token}`,...options.headers},signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw Error(`Public-news storage check failed: HTTP ${r.status}`);
 return r;
}
const settings=(await (await cf('/workers/scripts/lumi-develop/settings')).json()).result;
const binding=settings.bindings.find(b=>b.name==='HEALTH_NEWS_KV'&&b.type==='kv_namespace');
assert.ok(binding?.namespace_id,'News namespace binding missing');
const values=`/storage/kv/namespaces/${binding.namespace_id}/values/`;
const kv={
 async get(name){try{return await (await cf(values+encodeURIComponent(name))).json();}catch(e){if(e.message.endsWith('HTTP 404'))return null;throw e;}},
 async put(name,value,options={}){const suffix=options.expirationTtl?`?expiration_ttl=${options.expirationTtl}`:'';await cf(values+encodeURIComponent(name)+suffix,{method:'PUT',headers:{'content-type':'text/plain'},body:value});}
};
const digest=await generateHealthDigest({OPENAI_API_KEY:key,HEALTH_NEWS_KV:kv});
assert.equal(digest.items?.length,5,'Expected five public news items');
// KV is eventually consistent; check the serving route with bounded propagation retries.
let verified=false;
for(let n=0;n<12;n++){
 const response=await fetch('https://lumi-develop.psanchesnle.workers.dev/health-news',{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
 const data=await response.json().catch(()=>null);
 if(response.ok&&data?.date===digest.date&&data?.items?.length===5){verified=true;break;}
 await new Promise(resolve=>setTimeout(resolve,2000));
}
assert.ok(verified,'Edition stored but serving-route propagation not verified yet');
console.log(JSON.stringify({publicNewsEditionVerified:true,date:digest.date,items:digest.items.length,cronExecution:'next scheduled invocation remains to be observed'}));
