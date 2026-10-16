// Isolated localhost browser lifecycle test. No Cloudflare writes or account data.
import {chromium} from 'playwright';
import http from 'node:http';import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {withFrontendVersion} from './version-worker.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const origin='https://lumi-develop.psanchesnle.workers.dev';
const asset=text=>({content:text,type:'application/javascript'});
const oldPath='/_assets/'+hash('old-public-bytes')+'/probe.js',newPath='/_assets/'+hash('new-public-bytes')+'/probe.js';
const older={release:'release-a',commit:'commit-a',routes:{},immutable:{[oldPath]:asset('old-public-bytes')}},newer={release:'release-b',commit:'commit-b',routes:{},immutable:{[newPath]:asset('new-public-bytes')}};
let phase='legacy';
const html='<html><head></head><body><textarea id="messageInput"></textarea></body></html>';
const baseline={fetch:async request=>{const path=new URL(request.url).pathname;if(path==='/sw.js')return new Response(fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8'),{headers:{'content-type':'application/javascript','cache-control':'no-cache'}});if(path==='/experience.js')return new Response(fs.readFileSync(new URL('./experience.js',import.meta.url),'utf8'),{headers:{'content-type':'application/javascript'}});if(path==='/experience.css')return new Response('',{headers:{'content-type':'text/css'}});return new Response(html,{headers:{'content-type':'text/html'}});}};
// Explicit experience routes satisfy the wrapper's injected tags in this small fixture.
for(const release of [older,newer]){release.routes['/experience.js']='/experience.js';release.routes['/experience.css']='/experience.css';release.immutable['/experience.js']={content:fs.readFileSync(new URL('./experience.js',import.meta.url),'utf8'),type:'application/javascript'};release.immutable['/experience.css']={content:'',type:'text/css'};}
const a=withFrontendVersion(baseline,older),b=withFrontendVersion(baseline,newer,older.immutable);
const legacySW="self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));";
const server=http.createServer(async(req,res)=>{try{let r;if(phase==='legacy'){r=req.url==='/sw.js'?new Response(legacySW,{headers:{'content-type':'application/javascript'}}):new Response('<script>navigator.serviceWorker.register("/sw.js")</script>',{headers:{'content-type':'text/html'}});}else r=await(phase==='a'?a:b).fetch(new Request(origin+req.url));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(500);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const local='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.LUMI_CHROMIUM_EXECUTABLE?{executablePath:process.env.LUMI_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote']}:{})});
try{
 const context=await browser.newContext(),page=await context.newPage();await page.goto(local);await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.evaluate(async()=>{const cache=await caches.open('lumi-v8');await cache.put('/style.css',new Response('stale-style'));});
 phase='a';await page.goto(local);await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
 await page.waitForFunction(async()=>!(await caches.keys()).includes('lumi-v8'));
 await page.locator('#messageInput').fill('Draft survives service-worker activation');
 assert.equal(await page.locator('#messageInput').inputValue(),'Draft survives service-worker activation');
 assert.equal(await page.evaluate(path=>fetch(path).then(r=>r.text()),oldPath),'old-public-bytes');
 await context.setOffline(true);assert.equal(await page.evaluate(path=>fetch(path).then(r=>r.text()),oldPath),'old-public-bytes');
 assert.equal(await page.evaluate(()=>fetch('/history').then(()=>false,()=>true)),true);
 assert.equal(await page.evaluate(()=>fetch('/').then(()=>false,()=>true)),true);
 await context.setOffline(false);phase='b';await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.locator('#lumiUpdateNotice').waitFor();await page.getByRole('button',{name:'Atualizar',exact:true}).click();assert.equal(await page.locator('#messageInput').inputValue(),'Draft survives service-worker activation');
 await page.locator('#messageInput').fill('');await page.locator('#messageInput').blur();await page.getByRole('button',{name:'Atualizar',exact:true}).click();await page.waitForFunction(()=>document.querySelector('meta[name=lumi-release]')?.content==='release-b');
 assert.equal(await page.evaluate(path=>fetch(path).then(r=>r.text()),newPath),'new-public-bytes');assert.equal(await page.evaluate(path=>fetch(path).then(r=>r.text()),oldPath),'old-public-bytes');
 phase='a';await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.locator('#lumiUpdateNotice').waitFor();await page.getByRole('button',{name:'Atualizar',exact:true}).click();await page.waitForFunction(()=>document.querySelector('meta[name=lumi-release]')?.content==='release-a');
 console.log(JSON.stringify({serviceWorker:'real Chromium localhost lifecycle',legacyCacheRemoved:true,offlineImmutableAsset:true,privateAndHtmlNotCached:true,subsequentRelease:true,previousAssetAvailable:true,draftSurvived:true,rollbackReload:true,cloudflareRollback:'not part of this isolated test',realAndroidHardware:false}));
 await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
