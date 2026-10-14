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
      return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Verified answer',annotations:[{type:'url_citation',url:'https://example.org',title:'Source'}]}]}]})};
    }});
  assert.equal(request.max_output_tokens,800);
  assert.equal(request.input[1].content,'What happened?');
  assert.deepEqual(request.tools,[{type:'web_search'}]);
  assert.equal(result.answer,'Verified answer');
  assert.equal(result.citations[0].url,'https://example.org');
});
test('API failure is explicit, not a promised callback', async () => {
  const result=await researchNow({question:'What?',authorized:true,apiKey:'test',fetcher:async()=>({ok:false})});
  assert.equal(result.status,'failed');
});
