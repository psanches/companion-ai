import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
export async function verifyFrontend(origin,release){
 assert.equal(origin,'https://lumi-develop.psanchesnle.workers.dev');
 const get=path=>fetch(origin+path,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
 const r=await get('/'),html=await r.text();assert.equal(r.status,200);assert.equal(r.headers.get('x-lumi-commit'),release.commit);assert.equal(r.headers.get('x-lumi-release'),release.release);assert.match(r.headers.get('cache-control'),/must-revalidate/);
 for(const [name,path]of Object.entries(release.routes)){
  const r=await get(path);assert.equal(r.status,200,name);assert.match(r.headers.get('cache-control'),/immutable/);
  assert.equal(createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),path.split('/')[2],name+' deployed byte hash');
 }
 for(const name of ['/app.js','/style.css','/supabase.js','/experience.js','/experience.css','/lumi-research.js','/health-news-ui.js'])assert.ok(html.includes(release.routes[name]),name+' homepage reference');
 assert.doesNotMatch(html,/lumiScript\.src|app\.js\?v=/,'Legacy timestamp script loader remains');assert.ok(!html.includes('cdn.jsdelivr.net'));
 const sw=await get('/sw.js');assert.match(sw.headers.get('cache-control'),/must-revalidate/);assert.match(await sw.text(),/lumi-fingerprints-v1/);
 const version=await(await get('/frontend-version')).json();assert.equal(version.commit,release.commit);assert.equal(version.release,release.release);
 console.log(JSON.stringify({stage:'frontend-byte-verification',commit:release.commit,release:release.release,immutableAssets:Object.keys(release.routes).length,allHashesMatch:true}));
}
