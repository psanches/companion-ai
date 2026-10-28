// One bounded collection, shared by all users. Uses existing secrets and public-news KV only.
import assert from 'node:assert/strict';
import {generateWeeklyDigest,newsWeekActive,validWeeklyEdition} from '../health-news-week.mjs';
assert.equal(process.env.GITHUB_REF,'refs/heads/feature/pc-android-permanent-fix-20261016');
const {CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token,LUMI_RESEARCH_OPENAI_API_KEY:key}=process.env;
assert.ok(account&&token&&key,'Existing deployment and research credentials are required');
assert.ok(newsWeekActive(),'The authorized news week is not active');
const root='https://api.cloudflare.com/client/v4/accounts/'+account;
async function cf(path,options={}){
 const r=await fetch(root+path,{...options,headers:{authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(45000)});
 if(r.status!==404&&!r.ok)throw Error('Public news storage operation failed: HTTP '+r.status);
 return r;
}
const settings=await (await cf('/workers/scripts/lumi-develop/settings')).json();
const binding=settings.result?.bindings?.find(b=>b.name==='HEALTH_NEWS_KV'&&b.type==='kv_namespace');
assert.ok(binding?.namespace_id,'Verified public news KV binding is required');
const prefix='/storage/kv/namespaces/'+binding.namespace_id+'/values/';
const storage={async get(name,type){assert.ok(name.startsWith('health-news:editorial-week:'));const r=await cf(prefix+encodeURIComponent(name));if(r.status===404)return null;return type==='json'?r.json():r.text();},
 async put(name,value,options){assert.ok(name.startsWith('health-news:editorial-week:'));const query=options?.expirationTtl?'?expiration_ttl='+options.expirationTtl:'';const r=await cf(prefix+encodeURIComponent(name)+query,{method:'PUT',body:value,headers:{'content-type':'text/plain'}});assert.ok(r.ok);}};
const digest=await generateWeeklyDigest({HEALTH_NEWS_KV:storage,LUMI_RESEARCH_OPENAI_API_KEY:key});
assert.ok(validWeeklyEdition(digest));
console.log(JSON.stringify({stage:'verified-weekly-edition-published',date:digest.date,items:digest.items.map(({title,url,publishedAt,importance,scope,source})=>({title,url,publishedAt,importance,scope,source})),verification:digest.verification,window:digest.window,personalDataUsed:false}));
