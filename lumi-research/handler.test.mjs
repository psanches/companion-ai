import test from 'node:test';
import assert from 'node:assert/strict';
import {createLumiResearchHandler} from './handler.mjs';
import {requestedWeatherCity} from './weather-location.mjs';
import {withCompanionChat} from '../lumi-ativa-integration/companion-chat.mjs';

const origin='https://lumi-develop.psanchesnle.workers.dev';
const req=(token='long-valid-token')=>new Request(origin+'/research',{method:'POST',headers:{origin,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({question:'What is the latest WHO malaria estimate?'})});
const mockFetch=async(url,options)=>{
 if(url.endsWith('/auth/v1/user')) return Response.json({id:'verified-user'});
 if(url==='https://api.openai.com/v1/responses') return Response.json({output:[{type:'web_search_call',status:'completed'},{type:'message',content:[{type:'output_text',text:'Verified result',annotations:[{type:'url_citation',url:'https://www.who.int/',title:'WHO'}]}]}]});
 throw Error('unexpected upstream');
};
test('without limiter, fail closed before any research',async()=>{
 const handler=createLumiResearchHandler({reserve:async()=>{},fetcher:mockFetch});
 const r=await handler(req(),{LUMI_RESEARCH_OPENAI_API_KEY:'server-key'});
 assert.equal(r.status,503);
});
test('authenticated research uses limiter keyed by verified user ID',async()=>{
 let key;
 const handler=createLumiResearchHandler({reserve:async()=>{},fetcher:mockFetch});
 const r=await handler(req(),{LUMI_RESEARCH_OPENAI_API_KEY:'server-key',LUMI_RESEARCH_RATE_LIMIT:{limit:async({key:k})=>{key=k;return {success:true};}}});
 assert.equal(r.status,200);assert.equal(key,'verified-user');
 const body=await r.json();assert.equal(body.status,'complete');assert.equal(body.citations[0].url,'https://www.who.int/');
});
test('limit exhaustion blocks API call and returns 429',async()=>{
 let apiCalls=0;
 const handler=createLumiResearchHandler({reserve:async()=>{},fetcher:async(url,options)=>{if(url.endsWith('/auth/v1/user'))return Response.json({id:'verified-user'});apiCalls++;throw Error('should not call OpenAI');}});
 const r=await handler(req(),{LUMI_RESEARCH_OPENAI_API_KEY:'server-key',LUMI_RESEARCH_RATE_LIMIT:{limit:async()=>({success:false})}});
 assert.equal(r.status,429);assert.equal(apiCalls,0);
});


test('each valid research request verifies identity once; foreign routes and origins do not consume the limiter',async()=>{let verifies=0,limits=0;const handler=createLumiResearchHandler({reserve:async()=>{},fetcher:async(url,opts)=>{if(url.endsWith('/auth/v1/user'))verifies++;return mockFetch(url,opts);}});const env={LUMI_RESEARCH_OPENAI_API_KEY:'test',LUMI_RESEARCH_RATE_LIMIT:{limit:async()=>{limits++;return {success:true};}}};assert.equal((await handler(req(),env)).status,200);assert.equal(verifies,1);assert.equal(limits,1);const foreign=new Request(origin+'/research',{method:'POST',headers:{origin:'https://evil.example'},body:'{}'});assert.equal((await handler(foreign,env)).status,403);assert.equal(limits,1);assert.equal(await handler(new Request(origin+'/other'),env),null);});

test('Weather today succeeds under Worker redirect constraints after server identity verification',async()=>{
 let verified=0,limited=0,research=0;
 const handler=createLumiResearchHandler({reserve:async()=>{},fetcher:async(url,options)=>{
  if(options.redirect==='error')throw new TypeError('Unsupported redirect mode');
  assert.equal(options.redirect,'manual');
  if(url.endsWith('/auth/v1/user')){
   verified++;
   return Response.json({id:'verified-user'});
  }
  research++;return Response.json({output:[{type:'web_search_call',status:'completed'},{type:'message',content:[{type:'output_text',text:'Weather result for Bauru',annotations:[{type:'url_citation',url:'https://www.climatempo.com.br/previsao-do-tempo/cidade/558/bauru-sp',title:'Bauru forecast'}]}]}]});
 }});
 const request=new Request(origin+'/research',{method:'POST',headers:{origin,authorization:'Bearer long-valid-token','content-type':'application/json'},body:JSON.stringify({question:'Weather today in Bauru'})});
 const response=await handler(request,{LUMI_RESEARCH_OPENAI_API_KEY:'test',LUMI_RESEARCH_RATE_LIMIT:{limit:async({key})=>{assert.equal(key,'verified-user');limited++;return {success:true};}}});
 assert.equal(response.status,200);assert.equal(verified,1);assert.equal(limited,1);assert.equal(research,1);
});

test('chat recovers an uncited weather response through authenticated research and stores only the cited result',async()=>{
 let apiCalls=0,limits=0,verifies=0,saved;
 const research=createLumiResearchHandler({reserve:async()=>{},fetcher:async(url,options)=>{
  assert.equal(options.redirect,'manual');
  if(url.endsWith('/auth/v1/user')){verifies++;return Response.json({id:'verified-user'});}
  assert.equal(url,'https://api.openai.com/v1/responses');apiCalls++;
  return Response.json({status:'completed',output:[{type:'web_search_call',status:'completed'},{content:[{type:'output_text',text:apiCalls===1?'UNVERIFIED FIRST ANSWER':'Previsão recuperada para Bauru.',annotations:apiCalls===1?[]:[{type:'url_citation',url:'https://example.org/previsao/bauru'}]}]}]});
 }});
 const chat=withCompanionChat({fetch(){throw Error('Research must not fall through to ordinary chat');}},{verify:async()=>({id:'verified-user'}),research});
 const response=await chat.fetch(new Request(origin+'/api/chat',{method:'POST',headers:{origin,authorization:'Bearer synthetic-session','content-type':'application/json'},body:JSON.stringify({message:'Como está o tempo em Bauru?'})}),{
  Memory:{get:async()=>[],put:async(key,value)=>{assert.equal(key,'history:user:verified-user');saved=JSON.parse(value);}},
  LUMI_RESEARCH_OPENAI_API_KEY:'test',LUMI_RESEARCH_RATE_LIMIT:{limit:async()=>{limits++;return {success:true};}}
 },{});
 const data=await response.json();
 assert.equal(response.status,200);assert.equal(data.researchStatus,'complete');assert.equal(apiCalls,2);assert.equal(limits,1);assert.equal(verifies,1);
 assert.match(data.reply,/\[Fonte\]\(https:\/\/example.org\/previsao\/bauru\)/);assert.doesNotMatch(data.reply,/UNVERIFIED/);
 assert.equal(saved.at(-1).content,data.reply);
});

test('rain and weather follow-ups search directly using only the owner city from personal memory',async()=>{
 const apiQuestions=[],history=[];
 const research=createLumiResearchHandler({reserve:async()=>{},fetcher:async(url,options)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'verified-user'});
  apiQuestions.push(JSON.parse(options.body).input[1].content);
  const city=requestedWeatherCity(apiQuestions.at(-1));
  return Response.json({status:'completed',output:[{type:'web_search_call',status:'completed'},{content:[{type:'output_text',text:'Previsão para '+city,annotations:[{type:'url_citation',url:'https://example.org/forecast/'+city.split(',')[0].toLowerCase()}]}]}]});
 }});
 const chat=withCompanionChat({fetch(){throw Error('Weather must not fall through to the model without search');}},{verify:async()=>({id:'verified-user'}),research});
 const env={LUMI_RESEARCH_OPENAI_API_KEY:'test',LUMI_RESEARCH_RATE_LIMIT:{limit:async()=>({success:true})},Memory:{
  get:async(key)=>key==='memory:user:verified-user'?'Cidade: Bauru, SP\nCondição de saúde: PRIVATE HEALTH DETAIL':history,
  put:async(key,value)=>{assert.equal(key,'history:user:verified-user');history.splice(0,history.length,...JSON.parse(value));}
 }};
 for(const message of ['Vai chover hoje?','Sim','Você sabe minha localização?','Qual a temperatura em Santos hoje?']){
  const response=await chat.fetch(new Request(origin+'/chat',{method:'POST',headers:{origin,authorization:'Bearer synthetic-session','content-type':'application/json'},body:JSON.stringify({message})}),env,{});
  const data=await response.json();assert.equal(data.researchStatus,'complete');assert.match(data.reply,/\[Fonte\]/);assert.doesNotMatch(data.reply,/A\)|B\)|C\)|curl|colar um link/);
  assert.match(apiQuestions.at(-1),/Cidade da previsão: (?:Bauru, SP|Santos)/);assert.doesNotMatch(apiQuestions.at(-1),/PRIVATE HEALTH DETAIL/);
 }
 assert.equal(apiQuestions.length,4);assert.match(apiQuestions.at(-1),/Cidade da previsão: Santos/);assert.match(apiQuestions.at(-1),/Santos hoje/);
});

test('missing location asks once without a search; a bare city reply supplies the target and persists as context',async()=>{
 let history=[],apiCalls=0;
 const research=createLumiResearchHandler({reserve:async()=>{},fetcher:async(url,options)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'verified-user'});
  apiCalls++;assert.match(JSON.parse(options.body).input[1].content,/Cidade da previsão: Bauru/);
  return Response.json({status:'completed',output:[{type:'web_search_call',status:'completed'},{content:[{type:'output_text',text:'Bauru: previsão confirmada.',annotations:[{type:'url_citation',url:'https://example.org/forecast/bauru'}]}]}]});
 }});
 const chat=withCompanionChat({fetch(){throw Error('Weather must stay on the research path');}},{verify:async()=>({id:'verified-user'}),research});
 const env={LUMI_RESEARCH_OPENAI_API_KEY:'test',LUMI_RESEARCH_RATE_LIMIT:{limit:async()=>({success:true})},Memory:{get:async key=>key.startsWith('memory:')?null:history,put:async(key,value)=>{history=JSON.parse(value);}}};
 const ask=async message=>(await chat.fetch(new Request(origin+'/chat',{method:'POST',headers:{origin,authorization:'Bearer synthetic-session','content-type':'application/json'},body:JSON.stringify({message})}),env,{})).json();
 assert.equal((await ask('Vai chover hoje?')).researchStatus,'needs_location');assert.equal(apiCalls,0);
 assert.equal((await ask('Bauru')).researchStatus,'complete');assert.equal(apiCalls,1);
 assert.equal((await ask('Vai chover amanhã?')).researchStatus,'complete');assert.equal(apiCalls,2);
});

test('the observed weather preference uses the residence memory and does not search for words as a city',async()=>{
 let saved;
 const chat=withCompanionChat({fetch(){throw Error('Preference must not fall through');}},{verify:async()=>({id:'verified-user'}),research:async()=>{throw Error('A preference is not a new weather query');}});
 const response=await chat.fetch(new Request(origin+'/chat',{method:'POST',headers:{origin,authorization:'Bearer synthetic-session','content-type':'application/json'},body:JSON.stringify({message:'So apresentar clima para esta cidade ou se for pedida outra cidade'})}),{
  Memory:{get:async key=>key.startsWith('memory:')?'Local de residência: Bauru, São Paulo, Brasil':[],put:async(key,value)=>{saved=JSON.parse(value);}}
 },{});
 const data=await response.json();assert.equal(data.researchStatus,'preference_acknowledged');assert.match(data.reply,/Usarei Bauru, SP/);assert.doesNotMatch(data.reply,/pedida outra cidade/);assert.equal(saved.at(-1).content,data.reply);
});

test('temporary authentication outage is 503 rather than an invalid session and consumes no search quota',async()=>{
 for(const status of [401,503,429]){let apiCalls=0,limits=0;
  const handler=createLumiResearchHandler({reserve:async()=>{},fetcher:async(url)=>{if(url.endsWith('/auth/v1/user'))return new Response(null,{status});apiCalls++;throw Error('No AI calls expected');}});
  const response=await handler(req(),{LUMI_RESEARCH_RATE_LIMIT:{limit:async()=>{limits++;return {success:true};}}});
  assert.equal(response.status,status===401?401:503);assert.equal(apiCalls,0);assert.equal(limits,0);assert.doesNotMatch(await response.text(),/long-valid-token|sb_publishable/);
 }
});

test('central model budget denial returns 429 before contacting the model provider',async()=>{
 let provider=0;const handler=createLumiResearchHandler({reserve:async()=>{throw Object.assign(Error('Limite de uso da IA atingido.'),{code:'LUMI_MODEL_LIMIT',status:429});},fetcher:async url=>{if(url.endsWith('/auth/v1/user'))return Response.json({id:'alice'});provider++;throw Error('No model call expected');}});
 const response=await handler(req(),{LUMI_RESEARCH_OPENAI_API_KEY:'synthetic',LUMI_RESEARCH_RATE_LIMIT:{limit:async()=>({success:true})}});assert.equal(response.status,429);assert.equal(provider,0);assert.equal((await response.json()).status,'limited');
});
