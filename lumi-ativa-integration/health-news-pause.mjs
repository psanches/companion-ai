// Operational pause only: never uploads Worker code, changes secrets, or calls AI.
import assert from 'node:assert/strict';
assert.equal(process.env.GITHUB_REF,'refs/heads/feature/pc-android-permanent-fix-20261016');
const {CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token}=process.env;assert.ok(account&&token);
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/lumi-develop';
async function cf(suffix,options={}){const r=await fetch(base+suffix,{...options,headers:{authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(30000)});assert.ok(r.ok,'Cloudflare request failed: '+r.status);return (await r.json()).result;}
const before=(await cf('/schedules')).schedules;assert.ok(Array.isArray(before));
const remaining=before.filter(s=>s.cron!=='0 9 * * *');
if(remaining.length!==before.length)await cf('/schedules',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(remaining.map(({cron})=>({cron})))});
const after=(await cf('/schedules')).schedules;
assert.deepEqual(after.map(s=>s.cron).sort(),remaining.map(s=>s.cron).sort());
console.log(JSON.stringify({newsGenerationPaused:true,removedNewsCron:before.length!==remaining.length,remainingCrons:after.map(s=>s.cron),workerCodeDeployed:false,aiRequests:0}));
