import assert from 'node:assert/strict';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;assert.ok(account&&token);
const api='https://api.cloudflare.com/client/v4/accounts/'+account;
async function read(path){const r=await fetch(api+path,{headers:{authorization:'Bearer '+token}});if(!r.ok)throw Error('Read '+path+' HTTP '+r.status);return r;}
const domains=(await(await read('/workers/domains')).json()).result;
console.log(JSON.stringify({domains:domains.map(x=>({id:x.id,hostname:x.hostname,service:x.service,environment:x.environment,zone_id:x.zone_id}))}));
for(const name of ['companion-ai','lumi-develop']){
 const settings=(await(await read('/workers/scripts/'+name+'/settings')).json()).result;
 const r=await read('/workers/scripts/'+name+'/content/v2');const files=[];const moduleSources=[];
 for(const [name,f]of await r.formData())if(typeof f!=='string'){const source=await f.text();files.push({name,size:source.length,hosts:[...new Set([...source.matchAll(/https:\/\/([a-z0-9.-]+)/g)].map(m=>m[1]))].filter(h=>/lumi|companion|supabase/.test(h)),hostGuards:[...source.matchAll(/(?:hostname|origin)\s*(?:!==|===|==|!=)\s*['"]([^'"]+)['"]/g)].map(m=>m[1])});moduleSources.push(source);}
 const deployment=(await(await read('/workers/scripts/'+name+'/deployments')).json()).result;
 console.log(JSON.stringify({worker:name,assets:settings.assets||null,bindings:settings.bindings?.map(b=>({type:b.type,name:b.name})),files,active:deployment.deployments?.[0]?.versions}));
}
for(const host of ['mylumicompanion.com','app.mylumicompanion.com','companion-ai.psanchesnle.workers.dev']){try{const r=await fetch('https://'+host+'/',{redirect:'manual'});const body=await r.text();console.log(JSON.stringify({host,status:r.status,location:r.headers.get('location'),type:r.headers.get('content-type'),title:body.match(/<title>([^<]+)/)?.[1],scripts:[...body.matchAll(/<script[^>]+src=['"]([^'"]+)/g)].map(m=>m[1])}));}catch{console.log(JSON.stringify({host,unreachable:true}));}}
