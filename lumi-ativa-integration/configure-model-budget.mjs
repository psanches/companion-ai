// One-time internal credential rotation for two existing sandbox services; no API key is created.
import assert from 'node:assert/strict';import {randomBytes,createHmac} from 'node:crypto';
assert.equal(process.env.GITHUB_REF,'refs/heads/feature/pc-android-permanent-fix-20261016');
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;assert.ok(account&&token);
const internalSecret=randomBytes(32).toString('hex');
for(const script of ['lumi-develop','lumi-ativa-medical-demo']){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+script+'/secrets',{method:'PUT',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({name:'LUMI_INTERNAL_BUDGET_SECRET',type:'secret_text',text:internalSecret}),signal:AbortSignal.timeout(30000)});
 assert.ok(response.ok,'Unable to configure internal model-budget authentication');await response.body?.cancel();
}
let ready=false;
for(let attempt=0;attempt<45;attempt++){
 const body=JSON.stringify({kind:'health',timestamp:Date.now()}),signature=createHmac('sha256',internalSecret).update(body).digest('hex');
 try{const response=await fetch('https://lumi-ativa-medical-demo.psanchesnle.workers.dev/internal/lumi-budget',{method:'POST',headers:{'content-type':'application/json','x-lumi-budget-signature':signature},body,signal:AbortSignal.timeout(10000)}),data=await response.json();if(response.ok&&data.service==='lumi-model-budget-v1'){ready=true;break;}}catch{}
 await new Promise(resolve=>setTimeout(resolve,1000));
}
assert.ok(ready,'Model budget service not ready; Develop deployment must not proceed');
console.log(JSON.stringify({internalBudgetAuthenticationConfigured:true,budgetServiceVerified:true,personalDataUsed:false,quotaConsumed:false}));
