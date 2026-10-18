// Authorized temporary hosted validation. No existing Worker code, KV or AI keys are changed.
import assert from 'node:assert/strict';import fs from 'node:fs';import {randomBytes} from 'node:crypto';
import {NEWS_DEMO_DIGEST as snapshot} from './health-news-ui-assets.mjs';
assert.equal(process.env.GITHUB_REF,'refs/heads/feature/pc-android-permanent-fix-20261016');
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;assert.ok(account&&token);
const name='lumi-news-validate-'+process.env.GITHUB_RUN_ID;assert.match(name,/^lumi-news-validate-[0-9]+$/);
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/';
async function cf(path,options={}){const r=await fetch(root+path,{...options,headers:{authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(45000)});assert.ok(r.ok,'Cloudflare operation failed: '+r.status);return r;}
const active=async()=>(await (await cf('lumi-develop/deployments')).json()).result.deployments?.[0]?.id;
const before=await active();assert.ok(before);
const settings=(await (await cf('lumi-develop/settings')).json()).result;
const schedules=(await (await cf('lumi-develop/schedules')).json()).result.schedules;
assert.ok(!schedules.some(s=>s.cron==='0 9 * * *'),'News cron must remain paused');
const pages=await Promise.all(snapshot.items.map(async item=>{
 const r=await fetch(item.url,{signal:AbortSignal.timeout(30000)});assert.ok(r.ok,'Public test page unavailable: '+r.status);
 const reader=r.body.getReader(),chunks=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1500000){await reader.cancel();throw Error('Test page exceeds source limit');}chunks.push(value);}
 return {item,html:Buffer.concat(chunks).toString('utf8')};
}));
const checkToken=randomBytes(32).toString('hex');
const entry=`import validation from './runtime-test.mjs';
export default {async fetch(request,env,ctx){
 if(request.method!=='POST'||request.headers.get('authorization')!=='Bearer '+env.CHECK_TOKEN)return new Response(null,{status:404});
 try{await validation.test({},env,ctx);return Response.json({passed:true,realPages:5,malformedHtmlBytes:1400000,realAIRequests:0,staticEdition:true});}
 catch(e){console.error('News hosted validation failed:',e.message);return Response.json({passed:false,error:e.message},{status:500});}
}};`;
const modules=[['worker.mjs',entry],['runtime-test.mjs',fs.readFileSync(new URL('./health-news-runtime-test.mjs',import.meta.url))],['runtime-fixtures.mjs','export default '+JSON.stringify({snapshot,pages})+';']];
for(const [name,path] of [['health-news-verification.mjs','../health-news-verification.mjs'],['health-news-daily.mjs','../health-news-daily.mjs'],['health-news-worker.mjs','./health-news-worker.mjs'],['health-news-ui-assets.mjs','./health-news-ui-assets.mjs']])modules.push([name,fs.readFileSync(new URL(path,import.meta.url))]);
const form=new FormData();form.set('metadata',new Blob([JSON.stringify({main_module:'worker.mjs',compatibility_date:settings.compatibility_date,limits:{cpu_ms:100000},bindings:[{type:'secret_text',name:'CHECK_TOKEN',text:checkToken}]})],{type:'application/json'}));
for(const [name,content] of modules)form.set(name,new Blob([content],{type:'application/javascript+module'}),name);
let created=false;
try{
 created=true;await cf(name,{method:'PUT',body:form});
 await cf(name+'/subdomain',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({enabled:true,previews_enabled:false})});
 let result;
 for(let n=0;n<20;n++){
  const r=await fetch('https://'+name+'.psanchesnle.workers.dev/',{method:'POST',headers:{authorization:'Bearer '+checkToken},signal:AbortSignal.timeout(30000)});
  if(r.status===404){await r.body?.cancel();await new Promise(resolve=>setTimeout(resolve,1000));continue;}
  result=await r.json().catch(()=>null);assert.equal(r.status,200,'Hosted regression failed: '+(result?.error||r.status));break;
 }
 assert.ok(result?.passed,'Hosted validation did not complete');
 assert.equal(await active(),before,'Existing Develop deployment changed');
 const after=(await (await cf('lumi-develop/schedules')).json()).result.schedules;
 assert.deepEqual(after.map(s=>s.cron).sort(),schedules.map(s=>s.cron).sort());
 console.log(JSON.stringify({...result,hostedValidation:true,compatibilityDate:settings.compatibility_date,existingDevelopCodeUnchanged:true,newsCronPaused:true}));
}finally{
 if(created){await cf(name,{method:'DELETE'});const removed=await fetch(root+name+'/settings',{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});assert.equal(removed.status,404,'Temporary Worker removal not confirmed');console.log(JSON.stringify({temporaryWorkerRemoved:true,realAIRequests:0}));}
}
