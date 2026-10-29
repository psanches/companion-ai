import test from 'node:test';import assert from 'node:assert/strict';
import {internalBudget,reserveInteractiveBudget} from '../budget-internal.mjs';
import {budgetedModelFetch} from '../../lumi-ativa-integration/model-budget.mjs';
const secret='synthetic-internal-auth-credential-for-tests';
function state(){const map=new Map();let chain=Promise.resolve();const tx={get:async k=>structuredClone(map.get(k)),put:async(k,v)=>map.set(k,structuredClone(v))};return {storage:{transaction:fn=>{const result=chain.then(()=>fn(tx));chain=result.catch(()=>{});return result;}}};}
function fixture(){const clock=Date.now(),storage=state(),config={LUMI_INTERNAL_BUDGET_SECRET:secret,BUDGET:{idFromName:x=>x,get:()=>({fetch:async request=>reserveInteractiveBudget(storage,await request.json(),clock)})}},seen=[];return {storage,seen,env:{LUMI_INTERNAL_BUDGET_SECRET:secret,LUMI_ATIVA_DEMO:{fetch:async request=>{seen.push(await request.clone().text());return internalBudget(request,config);}}},config};}
const options={method:'POST',body:JSON.stringify({max_output_tokens:3200,input:'PRIVATE_PATIENT_TEXT'})};
test('budget envelope is signed, contains no patient text or raw owner and blocks unsigned or expired requests',async()=>{
 const f=fixture();let calls=0;await budgetedModelFetch(f.env,'private-user-id','https://api.openai.com/v1/responses',options,async()=>{calls++;return Response.json({});});assert.equal(calls,1);assert.doesNotMatch(f.seen.join(''),/PRIVATE_PATIENT_TEXT|private-user-id/);
 assert.equal((await internalBudget(new Request('https://budget/internal/lumi-budget',{method:'POST',body:'{}'}),f.config)).status,401);
 let request;const saved={...f.env,LUMI_ATIVA_DEMO:{fetch:async r=>{request=r;return Response.json({allowed:true});}}};await budgetedModelFetch(saved,'id','https://api.openai.com/v1/responses',options,async()=>Response.json({}));const raw=await request.text();const tampered=new Request(request.url,{method:'POST',headers:request.headers,body:raw.replace(/"tokens":\d+/, '"tokens":1')});assert.equal((await internalBudget(tampered,f.config)).status,401);
});
test('atomic global token ceiling survives concurrent reservations and object reconstruction',async()=>{
 const storage=state(),request=()=>({id:crypto.randomUUID(),owner:crypto.randomUUID().replaceAll('-','').repeat(2),tokens:60000});
 const rs=await Promise.all(Array.from({length:30},()=>reserveInteractiveBudget(storage,request())));assert.equal(rs.filter(x=>x.status===200).length,16);assert.equal((await reserveInteractiveBudget(storage,request())).status,429);
});
test('per-user minute limit blocks model calls while other users retain their own capacity',async()=>{
 const f=fixture();let calls=0;const fetcher=async()=>{calls++;return Response.json({});};for(let i=0;i<15;i++)await budgetedModelFetch(f.env,'alice','https://api.openai.com/v1/responses',options,fetcher);
 await assert.rejects(budgetedModelFetch(f.env,'alice','https://api.openai.com/v1/responses',options,fetcher),{code:'LUMI_MODEL_LIMIT'});assert.equal(calls,15);await budgetedModelFetch(f.env,'bob','https://api.openai.com/v1/responses',options,fetcher);assert.equal(calls,16);
});
test('unconfigured or unavailable budget and oversized model inputs never reach the model provider',async()=>{
 const fetcher=async()=>assert.fail('No provider call expected');await assert.rejects(budgetedModelFetch({},'alice','https://api.openai.com/v1/responses',options,fetcher),{status:503});
 const f=fixture();await assert.rejects(budgetedModelFetch(f.env,'alice','https://api.openai.com/v1/responses',{body:JSON.stringify({input:'x'.repeat(70000),max_output_tokens:3200})},fetcher),{status:413});
});

test('daily per-user and global call caps remain effective across minute windows',async()=>{
 const now=Date.parse('2026-10-29T12:00:00Z'),one=state(),owner='a'.repeat(64),body=()=>({id:crypto.randomUUID(),owner,tokens:1});
 for(let i=0;i<100;i++)assert.equal((await reserveInteractiveBudget(one,body(),now+Math.floor(i/10)*60000)).status,200);
 assert.equal((await reserveInteractiveBudget(one,body(),now+10*60000)).status,429);
 const global=state();for(let i=0;i<200;i++)assert.equal((await reserveInteractiveBudget(global,{id:crypto.randomUUID(),owner:crypto.randomUUID().replaceAll('-','').repeat(2),tokens:1},now)).status,200);
 assert.equal((await reserveInteractiveBudget(global,{id:crypto.randomUUID(),owner:'b'.repeat(64),tokens:1},now)).status,429);
});
