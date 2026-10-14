import test from 'node:test';
import assert from 'node:assert/strict';
import {createLumiAtivaIntegration} from './factory.mjs';
const origin='https://lumi-develop.psanchesnle.workers.dev';
test('research route is opt-in and other chat requests retain original baseline',async()=>{
 let originalCalls=0, researchCalls=0;
 const original={fetch:async()=>{originalCalls++;return Response.json({reply:'Lumi original'});}};
 const research=async request=>{researchCalls++;assert.equal(new URL(request.url).pathname,'/research');return Response.json({status:'complete',answer:'Pesquisa verificada',citations:[{url:'https://example.org'}]});};
 const wrapper=createLumiAtivaIntegration(original,{},fetch,research);
 const researchResult=await wrapper.fetch(new Request(origin+'/research',{method:'POST'}),{},{});
 assert.equal((await researchResult.json()).status,'complete');
 const chatResult=await wrapper.fetch(new Request(origin+'/chat',{method:'POST'}),{},{});
 assert.equal((await chatResult.json()).reply,'Lumi original');
 assert.equal(researchCalls,1);assert.equal(originalCalls,1);
});
test('research route stays unmodified on production hostname',async()=>{
 let originalCalls=0,researchCalls=0;
 const original={fetch:async()=>{originalCalls++;return new Response('original');}};
 const wrapper=createLumiAtivaIntegration(original,{},fetch,async()=>{researchCalls++;return new Response('research');});
 const result=await wrapper.fetch(new Request('https://mylumicompanion.com/research'),{},{});
 assert.equal(await result.text(),'original');assert.equal(originalCalls,1);assert.equal(researchCalls,0);
});
