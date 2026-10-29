import test from 'node:test';
import assert from 'node:assert/strict';
import {createLumiResearchHandler} from './handler.mjs';

const origin='https://lumi-develop.psanchesnle.workers.dev';
const req=(token='long-valid-token')=>new Request(origin+'/research',{method:'POST',headers:{origin,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({question:'What is the latest WHO malaria estimate?'})});
const mockFetch=async(url,options)=>{
 if(url.endsWith('/auth/v1/user')) return Response.json({id:'verified-user'});
 if(url==='https://api.openai.com/v1/responses') return Response.json({output:[{type:'web_search_call',status:'completed'},{type:'message',content:[{type:'output_text',text:'Verified result',annotations:[{type:'url_citation',url:'https://www.who.int/',title:'WHO'}]}]}]});
 throw Error('unexpected upstream');
};
test('without limiter, fail closed before any research',async()=>{
 const handler=createLumiResearchHandler({fetcher:mockFetch});
 const r=await handler(req(),{LUMI_RESEARCH_OPENAI_API_KEY:'server-key'});
 assert.equal(r.status,503);
});
test('authenticated research uses limiter keyed by verified user ID',async()=>{
 let key;
 const handler=createLumiResearchHandler({fetcher:mockFetch});
 const r=await handler(req(),{LUMI_RESEARCH_OPENAI_API_KEY:'server-key',LUMI_RESEARCH_RATE_LIMIT:{limit:async({key:k})=>{key=k;return {success:true};}}});
 assert.equal(r.status,200);assert.equal(key,'verified-user');
 const body=await r.json();assert.equal(body.status,'complete');assert.equal(body.citations[0].url,'https://www.who.int/');
});
test('limit exhaustion blocks API call and returns 429',async()=>{
 let apiCalls=0;
 const handler=createLumiResearchHandler({fetcher:async(url,options)=>{if(url.endsWith('/auth/v1/user'))return Response.json({id:'verified-user'});apiCalls++;throw Error('should not call OpenAI');}});
 const r=await handler(req(),{LUMI_RESEARCH_OPENAI_API_KEY:'server-key',LUMI_RESEARCH_RATE_LIMIT:{limit:async()=>({success:false})}});
 assert.equal(r.status,429);assert.equal(apiCalls,0);
});


test('each valid research request verifies identity once; foreign routes and origins do not consume the limiter',async()=>{let verifies=0,limits=0;const handler=createLumiResearchHandler({fetcher:async(url,opts)=>{if(url.endsWith('/auth/v1/user'))verifies++;return mockFetch(url,opts);}});const env={LUMI_RESEARCH_OPENAI_API_KEY:'test',LUMI_RESEARCH_RATE_LIMIT:{limit:async()=>{limits++;return {success:true};}}};assert.equal((await handler(req(),env)).status,200);assert.equal(verifies,1);assert.equal(limits,1);const foreign=new Request(origin+'/research',{method:'POST',headers:{origin:'https://evil.example'},body:'{}'});assert.equal((await handler(foreign,env)).status,403);assert.equal(limits,1);assert.equal(await handler(new Request(origin+'/other'),env),null);});

test('Weather today succeeds under Worker redirect constraints after server identity verification',async()=>{
 let verified=0,limited=0,research=0;
 const handler=createLumiResearchHandler({fetcher:async(url,options)=>{
  if(options.redirect==='error')throw new TypeError('Unsupported redirect mode');
  assert.equal(options.redirect,'manual');
  if(url.endsWith('/auth/v1/user')){
   verified++;
   return Response.json({id:'verified-user'});
  }
  research++;return Response.json({output:[{type:'web_search_call',status:'completed'},{type:'message',content:[{type:'output_text',text:'Weather result',annotations:[{type:'url_citation',url:'https://www.climatempo.com.br/previsao-do-tempo/cidade/558/bauru-sp',title:'Bauru forecast'}]}]}]});
 }});
 const request=new Request(origin+'/research',{method:'POST',headers:{origin,authorization:'Bearer long-valid-token','content-type':'application/json'},body:JSON.stringify({question:'Weather today in Bauru'})});
 const response=await handler(request,{LUMI_RESEARCH_OPENAI_API_KEY:'test',LUMI_RESEARCH_RATE_LIMIT:{limit:async({key})=>{assert.equal(key,'verified-user');limited++;return {success:true};}}});
 assert.equal(response.status,200);assert.equal(verified,1);assert.equal(limited,1);assert.equal(research,1);
});
