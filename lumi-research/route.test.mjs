import test from 'node:test';
import assert from 'node:assert/strict';
import { createResearchRoute } from './route.mjs';

const origin='https://lumi-develop.psanchesnle.workers.dev';
function request(path='/research',{method='POST',token='valid',from=origin,body={question:'What is the latest WHO malaria estimate?'}}={}) {
  return new Request(origin+path,{method,headers:{origin:from,...(token?{authorization:'Bearer '+token}:{}),'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})});
}
test('route requires server-side token verification, never caller authorization',async()=>{
  assert.throws(()=>createResearchRoute(),/Verified token/);
  let calls=0;
  const route=createResearchRoute({verifyToken:async token=>{calls++;return token==='valid'?{id:'verified-user'}:null;},fetcher:()=>{throw Error('No research should run');}});
  assert.equal((await route(request('/research',{token:null}),{})).status,401);
  assert.equal((await route(request('/research',{token:'invalid'}),{})).status,401);
  assert.equal(calls,1);
});
test('rejects foreign origins, invalid method, and malformed payload before research',async()=>{
  const route=createResearchRoute({verifyToken:async()=>({id:'verified-user'}),fetcher:()=>{throw Error('No research should run');}});
  assert.equal((await route(request('/research',{from:'https://evil.example'}),{})).status,403);
  assert.equal((await route(request('/research',{method:'GET'}),{})).status,405);
  assert.equal((await route(request('/research',{body:{question:'hello',authorized:true}}),{})).status,400);
  assert.equal((await route(request('/research',{body:{question:42}}),{})).status,400);
});
test('cannot activate on production or other paths',async()=>{
  const route=createResearchRoute({verifyToken:async()=>({id:'user'})});
  assert.equal(await route(new Request('https://mylumicompanion.com/research',{method:'POST'}),{}),null);
  assert.equal(await route(request('/chat'),{}),null);
});
test('without server-side key, returns unavailable and never exposes credentials',async()=>{
  const route=createResearchRoute({verifyToken:async()=>({id:'user'})});
  const result=await route(request(),{});
  assert.equal(result.status,503);
  assert.equal((await result.json()).status,'unavailable');
  assert.equal(result.headers.get('cache-control'),'no-store');
});
