// Reproduce the public generation pipeline without writing to any deployed KV/database.
import assert from 'node:assert/strict';
import {generateHealthDigest} from '../health-news-daily.mjs';
const key=process.env.LUMI_RESEARCH_OPENAI_API_KEY;assert.ok(key,'Existing Research secret missing');
const publicResponse=await fetch('https://lumi-develop.psanchesnle.workers.dev/health-news',{cache:'no-store'});const edition=await publicResponse.json();const recent=(edition.items||[]).map(x=>({url:x.url,date:edition.date}));
const writes=[];let apiRequests=0;
const env={LUMI_RESEARCH_OPENAI_API_KEY:key,HEALTH_NEWS_KV:{async get(k){return k==='health-news:recent-urls'?recent:null;},async put(k,v){writes.push({key:k,bytes:v.length});}}};
const fetcher=async(url,options)=>{const r=await fetch(url,options);if(url==='https://api.openai.com/v1/responses'){apiRequests++;const copy=r.clone();const d=await copy.json().catch(()=>({}));console.log(JSON.stringify({stage:'generation-api',attempt:apiRequests,status:r.status,result:d.status,errorCode:d.error?.code||null,incompleteReason:d.incomplete_details?.reason||null,usage:d.usage?{input:d.usage.input_tokens,output:d.usage.output_tokens}:null}));}return r;};
try{const d=await generateHealthDigest(env,new Date(),fetcher);console.log(JSON.stringify({stage:'generation-diagnostic',ok:true,date:d.date,items:d.items.length,verification:d.verification,localWrites:writes.length,deployedWrites:0,limitation:'Only previous public edition URLs seeded; full deployed recent-URL history unavailable.'}));}
catch(error){console.log(JSON.stringify({stage:'generation-diagnostic',ok:false,error:error.message,apiRequests,localWrites:writes.length,deployedWrites:0}));process.exitCode=1;}
