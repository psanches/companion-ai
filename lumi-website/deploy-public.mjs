import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import bundle from './bundle.generated.mjs';
assert.equal(process.env.GITHUB_REF,'refs/heads/feature/lumi-institutional-refresh-20261017');assert.equal(process.env.LUMI_PUBLICATION_CONFIRM,'PUBLISH_OWNER_AUTHORIZED_20261017');assert.equal(bundle.commit,process.env.GITHUB_SHA);
const target='lumi-institutional-public',root='mylumicompanion.com',app='app.'+root;
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;assert.ok(account&&token);const api='https://api.cloudflare.com/client/v4/accounts/'+account,script=api+'/workers/scripts/'+target;
async function cf(url,options={}){const method=options.method||'GET';if(method!=='GET'){assert.ok(url===script||url===script+'/subdomain'||url===api+'/workers/domains'||url.startsWith(api+'/workers/domains/'),'Write target forbidden');if(url===api+'/workers/domains'){const b=JSON.parse(options.body);assert.ok([root,app].includes(b.hostname));assert.ok([target,'companion-ai'].includes(b.service));}}
 const r=await fetch(url,{...options,headers:{authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(45000)});if(!r.ok){let codes=[];try{codes=(await r.json()).errors?.map(x=>x.code)||[];}catch{}throw Error('Cloudflare '+method+' '+url.replace(api,'ACCOUNT')+' HTTP '+r.status+' codes '+codes.join(',')+'; no credentials logged');}return r;}
const hash=b=>createHash('sha256').update(b).digest('hex');
async function snapshot(name){const base=api+'/workers/scripts/'+name;const response=await cf(base+'/content/v2'),modules=[];for(const [name,f]of await response.formData())if(typeof f!=='string')modules.push({name,type:f.type,hash:hash(Buffer.from(await f.arrayBuffer()))});modules.sort((a,b)=>a.name.localeCompare(b.name));const settings=(await(await cf(base+'/settings')).json()).result,schedules=(await(await cf(base+'/schedules')).json()).result;return hash(JSON.stringify({modules,settings,schedules}));}
const protectedBefore={};for(const n of ['companion-ai','lumi-develop'])protectedBefore[n]=await snapshot(n);
const domains=(await(await cf(api+'/workers/domains')).json()).result;
const originalDomain=domains.find(x=>x.hostname===root);assert.equal(originalDomain?.service,'companion-ai','Original public routing changed; inspect before publication');assert.ok(!domains.some(x=>x.hostname===app),'App domain already exists: inspect rather than overwrite');
const domainBody=(hostname,service)=>({hostname,service,environment:'production',zone_id:originalDomain.zone_id,enabled:true});
const request=async(origin,path)=>fetch(origin+path,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(20000)});
const before=await request('https://'+root,'/');assert.equal(before.status,200);const previousHtml=await before.text();assert.equal(hash(previousHtml),'addb5365069f9edbdc03af37fffba7df2bbcbe6fb8fdd86ffe5e0e5bbdeecea3');
const form=new FormData();form.set('metadata',JSON.stringify({main_module:'public-worker.mjs',compatibility_date:'2026-10-16',bindings:[{name:'LEGACY_LUMI',type:'service',service:'companion-ai'}],observability:{enabled:false}}));
for(const name of ['public-worker.mjs','bundle.generated.mjs'])form.set(name,new File([fs.readFileSync(new URL('./'+name,import.meta.url))],name,{type:'application/javascript+module'}));
await cf(script,{method:'PUT',body:form});await cf(script+'/subdomain',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({enabled:true,previews_enabled:false})});
const preview='https://'+target+'.psanchesnle.workers.dev';
async function converge(origin,path,check){let last;for(let n=0;n<45;n++){try{const r=await request(origin,path);if(await check(r))return;}catch(e){last=e.message;}await new Promise(r=>setTimeout(r,2000));}throw Error('Public check failed '+origin+path+(last?' '+last:''));}
await converge(preview,'/release.json',async r=>r.status===200&&(await r.json()).commit===bundle.commit);
await converge(preview,'/?lumi_app=1',async r=>r.status===200&&(await r.text())===previousHtml);
for(const p of ['/','/pt/']){const r=await request(preview,p);assert.equal(r.status,200);assert.equal(r.headers.get('x-lumi-institutional-commit'),bundle.commit);assert.ok((await r.text()).includes('mailto:speakwithus@mylumicompanion.com'));}
console.log(JSON.stringify({stage:'public-worker-preflight-passed',preview,commit:bundle.commit,legacyHomeIdentical:true}));
let rootChanged=false,appCreated=false;let appId;
try{
 const attached=(await(await cf(api+'/workers/domains',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(domainBody(app,target))})).json()).result;appCreated=true;appId=attached.id;assert.ok(appId);
 await converge('https://'+app,'/',async r=>r.status===302&&r.headers.get('location')==='https://'+root+'/?lumi_app=1');
 // Only switch the public homepage after the original application is reachable through the new service.
 rootChanged=true;await cf(api+'/workers/domains',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(domainBody(root,target))});
 for(const p of ['/','/pt/'])await converge('https://'+root,p,async r=>r.status===200&&r.headers.get('x-lumi-institutional-commit')===bundle.commit&&(await r.text()).includes('mailto:speakwithus@mylumicompanion.com'));
 await converge('https://'+root,'/?lumi_app=1',async r=>r.status===200&&(await r.text())===previousHtml);
 for(const [path,a]of Object.entries(bundle.assets)){const r=await request('https://'+root,path);assert.equal(r.status,200);assert.equal(hash(Buffer.from(await r.arrayBuffer())),hash(Buffer.from(a.body,'base64')));assert.match(r.headers.get('cache-control'),/immutable/);}
 const sw=await request('https://'+root,'/sw.js');assert.match(await sw.text(),/unregister/);
 for(const n of ['companion-ai','lumi-develop'])assert.equal(await snapshot(n),protectedBefore[n],n+' code/configuration changed');
 const version=(await(await cf(script+'/deployments')).json()).result.deployments?.[0]?.versions?.[0]?.version_id;assert.ok(version);
 const evidence={published:true,commit:bundle.commit,cloudflareVersion:version,release:bundle.release,website:'https://'+root+'/',portuguese:'https://'+root+'/pt/',app:'https://'+app+'/',appRedirect:'https://'+root+'/?lumi_app=1',originalApplicationBytesPreserved:true,productionAppWorkerUnchanged:true,developmentWorkerUnchanged:true,emailDnsUntouched:true,realGoogleSignInTested:false,rollback:{hostname:root,service:originalDomain.service,environment:originalDomain.environment,zone_id:originalDomain.zone_id},limitations:['App entry redirects to original origin to preserve sessions and hardcoded authentication callbacks.','Real user login, account history and physical Android require owner validation.']};
 fs.mkdirSync(new URL('./test-results/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('./test-results/publication.json',import.meta.url),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## Owner-authorized public website publication\n\n```json\n'+JSON.stringify(evidence,null,2)+'\n```\n');
}catch(error){if(rootChanged){await cf(api+'/workers/domains',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(domainBody(root,originalDomain.service))});console.error('Public root restored to original application Worker.');}if(appCreated&&appId)await cf(api+'/workers/domains/'+appId,{method:'DELETE'});throw error;}
