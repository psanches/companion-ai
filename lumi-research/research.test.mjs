import test from 'node:test';
import assert from 'node:assert/strict';
import {validateResearchQuestion, canPromiseFollowUp, researchNow} from './research.mjs';

test('rejects empty and oversized questions', () => {
  assert.throws(() => validateResearchQuestion('  '));
  assert.throws(() => validateResearchQuestion('a'.repeat(1201)));
});
test('never promises unpersisted follow-up', () => {
  assert.equal(canPromiseFollowUp(null), false);
  assert.equal(canPromiseFollowUp({id:'1',persisted:true}), false);
  assert.equal(canPromiseFollowUp({id:'1',persisted:true,deliveryConfigured:true}), true);
});
test('does not call external API without authorization', async () => {
  let called=false;
  const result=await researchNow({question:'weather?',authorized:false,apiKey:'fake',fetcher:async()=>{called=true;}});
  assert.equal(result.status,'denied');
  assert.equal(called,false);
});
test('bounded web research extracts text and citations', async () => {
  let request;
  const result=await researchNow({question:'  What happened?  ',authorized:true,apiKey:'test',
    maxOutputTokens:5000,fetcher:async (_url,opts)=>{
      request=JSON.parse(opts.body);
      return {ok:true,json:async()=>({output:[{type:'web_search_call',status:'completed'},{content:[{type:'output_text',text:'Verified answer',annotations:[{type:'url_citation',url:'https://example.org',title:'Source'}]}]}]})};
    }});
  assert.equal(request.max_output_tokens,800);
  assert.equal(request.tool_choice,'required');
  assert.equal(request.input[1].content,'What happened?');
  assert.deepEqual(request.tools,[{type:'web_search'}]);
  assert.equal(result.answer,'Verified answer');
  assert.equal(result.citations[0].url,'https://example.org');
});
test('API failure is explicit, not a promised callback', async () => {
  const result=await researchNow({question:'What?',authorized:true,apiKey:'test',fetcher:async()=>({ok:false})});
  assert.equal(result.status,'failed');
});

test('rejects uncited or unsearched answer as unverified', async () => {
  for (const output of [
    [{content:[{type:'output_text',text:'An uncited answer'}]}],
    [{type:'web_search_call',status:'completed'},{content:[{type:'output_text',text:'No citations'}]}],
    [{content:[{type:'output_text',text:'Cited but no search',annotations:[{type:'url_citation',url:'https://example.org'}]}]}]
  ]) {
    const result=await researchNow({question:'Verify this',authorized:true,apiKey:'test',
      fetcher:async()=>({ok:true,json:async()=>({output})})});
    assert.equal(result.status,'unverified');
  }
});


test('failed, unfinished searches and incomplete answers cannot masquerade as verified research',async()=>{
 for(const [searchStatus,status]of [['failed','completed'],['incomplete','completed'],['in_progress','completed'],['completed','incomplete']]){const r=await researchNow({question:'weather Bauru',authorized:true,apiKey:'test',fetcher:async()=>Response.json({status,output:[{type:'web_search_call',status:searchStatus},{content:[{type:'output_text',text:'Claim',annotations:[{type:'url_citation',url:'https://example.org/forecast'}]}]}]})});assert.equal(r.status,'unverified');}
});
test('weather rejects homepage-only evidence, records search time, and distinguishes source update date in instructions',async()=>{
 let payload;const fetcher=url=>async(_url,opts)=>{payload=JSON.parse(opts.body);return Response.json({status:'completed',output:[{type:'web_search_call',status:'completed'},{content:[{type:'output_text',text:'Previsão. Quer que eu crie um lembrete?',annotations:[{type:'url_citation',url}]}]}]});};
 const options={question:'Previsão do tempo para Bauru hoje',authorized:true,apiKey:'test',now:new Date('2026-10-22T01:00:00Z')};
 assert.equal((await researchNow({...options,fetcher:fetcher('https://example.org/')})).status,'unverified');
 const r=await researchNow({...options,fetcher:fetcher('https://example.org/forecast/bauru')});assert.equal(r.status,'complete');assert.equal(r.answer,'Previsão.');assert.equal(r.researchedAt,'2026-10-22T01:00:00.000Z');assert.match(payload.input[0].content,/2026-10-21/);assert.match(payload.input[0].content,/source update dates/);assert.equal(payload.max_output_tokens,600);
});

test('research refuses upstream redirects without forwarding the API credential',async()=>{
 let calls=0;
 const result=await researchNow({question:'Weather today in Bauru',authorized:true,apiKey:'test',fetcher:async(url,options)=>{
  calls++;assert.equal(url,'https://api.openai.com/v1/responses');
  assert.equal(options.redirect,'manual');
  return new Response(null,{status:307,headers:{location:'https://foreign.example/'}});
 }});
 assert.equal(result.status,'failed');assert.equal(calls,1);
});

test('an uncited weather card triggers one fresh page search; only its cited answer is used',async()=>{
 const requests=[];
 const result=await researchNow({question:'Como está o tempo em Bauru?',authorized:true,apiKey:'test',fetcher:async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');
  requests.push(JSON.parse(options.body));
  return Response.json({status:'completed',output:[{type:'web_search_call',status:'completed'},{type:'message',content:[{type:'output_text',text:requests.length===1?'UNSOURCED WEATHER CARD':'Previsão com fonte.',annotations:requests.length===1?[]:[{type:'url_citation',url:'https://example.org/forecast/bauru'}]}]}]});
 }});
 assert.equal(requests.length,2);
 assert.match(requests[0].input[0].content,/not weather cards or widgets/);
 assert.match(requests[1].input[0].content,/fresh web search/);
 assert.equal(requests[1].input[1].content,'Como está o tempo em Bauru?');
 assert.equal(result.status,'complete');
 assert.equal(result.answer,'Previsão com fonte.');
 assert.equal(result.citations.length,1);
});

test('recovery stays bounded and never promotes searched sources or fabricated markdown into citations',async()=>{
 let calls=0;
 const result=await researchNow({question:'Weather Bauru',authorized:true,apiKey:'test',fetcher:async()=>{
  calls++;
  return Response.json({status:'completed',output:[{type:'web_search_call',status:'completed',action:{sources:[{url:'https://example.org/forecast'}]}},{content:[{type:'output_text',text:'Unverified [source](https://example.org/forecast)',annotations:[]}]}]});
 }});
 assert.equal(calls,2);assert.equal(result.status,'unverified');assert.deepEqual(result.citations,[]);
});

test('weather homepage-only citations recover using a specific forecast page',async()=>{
 let calls=0;
 const result=await researchNow({question:'Weather Bauru',authorized:true,apiKey:'test',fetcher:async()=>{
  calls++;
  return Response.json({status:'completed',output:[{type:'web_search_call',status:'completed'},{content:[{type:'output_text',text:'Forecast',annotations:[{type:'url_citation',url:calls===1?'https://example.org/':'https://example.org/forecast/bauru'}]}]}]});
 }});
 assert.equal(calls,2);assert.equal(result.status,'complete');assert.equal(result.citations[0].url,'https://example.org/forecast/bauru');
});

test('valid first result, HTTP failures and incomplete outputs do not trigger an extra API call',async()=>{
 for(const mode of ['complete','http-error','incomplete']){
  let calls=0;
  const result=await researchNow({question:'Weather Bauru',authorized:true,apiKey:'test',fetcher:async()=>{
   calls++;if(mode==='http-error')return new Response(null,{status:429});
   return Response.json({status:mode==='complete'?'completed':mode,output:[{type:'web_search_call',status:'completed'},{content:[{type:'output_text',text:'Forecast',annotations:[{type:'url_citation',url:'https://example.org/forecast/bauru'}]}]}]});
  }});
  assert.equal(calls,1);assert.equal(result.status,mode==='complete'?'complete':mode==='http-error'?'failed':'unverified');
 }
});
