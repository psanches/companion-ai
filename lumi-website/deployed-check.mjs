import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export async function verifyInstitutional(origin,bundle){
 assert.equal(origin,'https://lumi-develop.psanchesnle.workers.dev');
 const get=path=>fetch(origin+path,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
 for(const path of ['/','/pt/']){
  const response=await get('/sobre'+path);assert.equal(response.status,200);
  assert.equal(response.headers.get('x-lumi-institutional-commit'),bundle.commit);
  assert.equal(response.headers.get('x-lumi-institutional-release'),bundle.release);
  assert.match(response.headers.get('cache-control'),/must-revalidate/);
  const html=await response.text();assert.equal(html,bundle.pages[path]);
  for(const email of ['faleconosco','speakwithus'])assert.ok(html.includes('mailto:'+email+'@mylumicompanion.com'));
 }
 for(const [path,asset] of Object.entries(bundle.assets)){
  const response=await get('/sobre'+path);assert.equal(response.status,200);
  assert.match(response.headers.get('cache-control'),/immutable/);
  const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest(Buffer.from(await response.arrayBuffer())),digest(Buffer.from(asset.body,'base64')));
 }
 const home=await get('/');assert.ok((await home.text()).includes('id="lumiInstitutionalLink" href="/sobre/pt/"'));
 console.log(JSON.stringify({stage:'institutional-development-verified',commit:bundle.commit,languages:2,assets:Object.keys(bundle.assets).length,applicationHomePreserved:true}));
}
