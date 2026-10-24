import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import bundle from './bundle.generated.mjs';

const ROOT='https://mylumicompanion.com',TARGET='lumi-institutional-public';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

// Update the existing website only. No domain, application or credential writes.
export async function updatePublicWebsite({account,token,commit,ref,confirm,fetchImpl=fetch,pause=ms=>new Promise(r=>setTimeout(r,ms)),site=bundle}){
 assert.equal(ref,'refs/heads/feature/lumi-institutional-refresh-20261017');
 assert.equal(confirm,'UPDATE_EXISTING_PUBLIC_WEBSITE_ONLY');
 assert.equal(site.commit,commit);assert.ok(account&&token);
 const api='https://api.cloudflare.com/client/v4/accounts/'+account,script=api+'/workers/scripts/'+TARGET;
 async function cf(url,options={}){
  const method=options.method||'GET';
  assert.ok(method==='GET'||(url===script&&method==='PUT')||(url===script+'/deployments'&&method==='POST'),'Forbidden website update target');
  const r=await fetchImpl(url,{...options,headers:{authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(45000)});
  if(!r.ok)throw Error('Website '+method+' HTTP '+r.status+'; credentials omitted');return r;
 }
 const json=async url=>(await(await cf(url)).json()).result;
 const get=path=>fetchImpl(ROOT+path,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(25000)});
 const appEntry=()=>fetchImpl('https://app.mylumicompanion.com/',{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(25000)});
 async function modules(name){const r=await cf(api+'/workers/scripts/'+name+'/content/v2'),items=[];for(const [name,file]of await r.formData())if(typeof file!=='string')items.push({name,type:file.type,bytes:Buffer.from(await file.arrayBuffer())});return items;}
 async function snapshot(name){const items=await modules(name);return hash(JSON.stringify({modules:items.map(m=>({name:m.name,type:m.type,hash:hash(m.bytes)})).sort((a,b)=>a.name.localeCompare(b.name)),settings:await json(api+'/workers/scripts/'+name+'/settings'),schedules:await json(api+'/workers/scripts/'+name+'/schedules')}));}
 const domains=await json(api+'/workers/domains');
 for(const hostname of ['mylumicompanion.com','app.mylumicompanion.com'])assert.equal(domains.find(d=>d.hostname===hostname)?.service,TARGET,'Unexpected public routing');
 const protectedBefore={};for(const name of ['companion-ai','lumi-develop'])protectedBefore[name]=await snapshot(name);
 const settings=await json(script+'/settings'),schedules=await json(script+'/schedules'),deployments=await json(script+'/deployments');
 const active=deployments.deployments?.[0]?.versions;assert.ok(active?.length,'Active website version missing');
 assert.equal(settings.bindings?.length,1);assert.equal(settings.bindings[0].name,'LEGACY_LUMI');assert.equal(settings.bindings[0].type,'service');assert.equal(settings.bindings[0].service,'companion-ai');
 const original=await modules(TARGET);
 assert.deepEqual(original.map(m=>m.name).sort(),['bundle.generated.mjs','public-worker.mjs']);
 const router=fs.readFileSync(new URL('./public-worker.mjs',import.meta.url));
 assert.equal(hash(original.find(m=>m.name==='public-worker.mjs').bytes),hash(router),'Public router drift; review before update');
 const before=await get('/release.json');assert.equal(before.status,200);const previous=await before.json();
 assert.notEqual(previous.commit,commit,'Website already runs this commit');
 const baselineBundle=JSON.parse(original.find(m=>m.name==='bundle.generated.mjs').bytes.toString().replace(/^export default /,'').replace(/;\s*$/,''));
 assert.equal(baselineBundle.commit,previous.commit);assert.equal(baselineBundle.release,previous.release,'Live website and source disagree');
 const appBefore=await get('/?lumi_app=1');assert.equal(appBefore.status,200);const appHash=hash(Buffer.from(await appBefore.arrayBuffer()));
 const entryBefore=await appEntry();assert.equal(entryBefore.status,302);const entryLocation=entryBefore.headers.get('location');
 const replacement=original.map(m=>m.name==='bundle.generated.mjs'?{...m,bytes:Buffer.from('export default '+JSON.stringify(site)+';\n')}:m);
 function form(items){const data=new FormData(),metadata={main_module:'public-worker.mjs',bindings:settings.bindings};for(const key of ['compatibility_date','compatibility_flags','logpush','tail_consumers','observability','placement','limits','tags'])if(settings[key]!==undefined)metadata[key]=settings[key];data.set('metadata',JSON.stringify(metadata));for(const m of items)data.set(m.name,new File([m.bytes],m.name,{type:m.type}));return data;}
 let changed=false;
 try{
  // Lease the active version so another website publication is never overwritten.
  assert.deepEqual((await json(script+'/deployments')).deployments?.[0]?.versions,active,'Website changed during preparation');
  changed=true;await cf(script,{method:'PUT',body:form(replacement)});
  let ready=false;for(let n=0;n<30;n++){try{const r=await get('/release.json');if(r.ok&&(await r.json()).release===site.release){ready=true;break;}}catch{}await pause(1000);}assert.ok(ready,'New public website did not converge');
  for(const path of ['/','/pt/']){const r=await get(path);assert.equal(r.status,200);assert.equal(r.headers.get('x-lumi-institutional-commit'),commit);const html=await r.text();assert.equal((html.match(/class="button app-link/g)||[]).length,3,'Missing prominent app links');assert.ok(html.includes(path==='/'?'Open Lumi App':'Abrir aplicativo Lumi'));}
  for(const [path,a]of Object.entries(site.assets)){const r=await get(path);assert.equal(r.status,200);assert.equal(hash(Buffer.from(await r.arrayBuffer())),hash(Buffer.from(a.body,'base64')));}
  const appAfter=await get('/?lumi_app=1');assert.equal(appAfter.status,200);assert.equal(hash(Buffer.from(await appAfter.arrayBuffer())),appHash,'Application homepage changed');
  const entryAfter=await appEntry();assert.equal(entryAfter.status,entryBefore.status);assert.equal(entryAfter.headers.get('location'),entryLocation);
  assert.deepEqual(await json(api+'/workers/domains'),domains,'Domain configuration changed');
  assert.deepEqual(await json(script+'/settings'),settings,'Website settings changed');assert.deepEqual(await json(script+'/schedules'),schedules,'Website schedules changed');
  for(const name of ['companion-ai','lumi-develop'])assert.equal(await snapshot(name),protectedBefore[name],name+' changed');
  const deployed=await modules(TARGET);for(const expected of replacement)assert.equal(hash(deployed.find(m=>m.name===expected.name)?.bytes||Buffer.alloc(0)),hash(expected.bytes),'Website module mismatch');
  return {updated:true,commit,release:site.release,website:ROOT+'/',portuguese:ROOT+'/pt/',appButtonsPerLanguage:3,applicationDestination:'https://lumi-develop.psanchesnle.workers.dev/',applicationHomepageUnchanged:true,productionAppWorkerUnchanged:true,developmentWorkerUnchanged:true,domainsUntouched:true,emailDnsUntouched:true};
 }catch(error){
  if(changed){try{await cf(script,{method:'PUT',body:form(original)});await cf(script+'/deployments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:active.map(({version_id,percentage})=>({version_id,percentage}))})});console.error('Website update failed; previous public website restored.');}catch{console.error('Website rollback failed; public website requires review. Application Workers and domain routing were not written.');}}
  throw error;
 }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await updatePublicWebsite({account:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN,commit:process.env.GITHUB_SHA,ref:process.env.GITHUB_REF,confirm:process.env.LUMI_WEBSITE_UPDATE_CONFIRM});
 fs.mkdirSync(new URL('./test-results/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('./test-results/website-update.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## Public website app access updated\n\n```json\n'+JSON.stringify(result,null,2)+'\n```\n');
}
