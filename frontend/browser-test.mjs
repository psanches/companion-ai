import {chromium} from 'playwright';
import assert from 'node:assert/strict';import fs from 'node:fs';
import assets from '../lumi-ativa-integration/assets.generated.mjs';
import release from './release.generated.mjs';import {withFrontendVersion} from './version-worker.mjs';
import {createLumiAtivaIntegration} from '../lumi-ativa-integration/factory.mjs';
import {NEWS_HTML,NEWS_CSS,NEWS_SCRIPT} from '../lumi-ativa-integration/health-news-ui-assets.mjs';
const HOST='https://lumi-develop.psanchesnle.workers.dev';
const history=Array.from({length:18},(_,i)=>({role:i%2?'assistant':'user',content:'Mensagem fictícia '+i}));
const backend={fetch:async request=>{const path=new URL(request.url).pathname;if(path==='/history')return Response.json({history});if(path==='/history/archives')return Response.json({archives:[]});if(path==='/calendar/events/week'){const {date}=await request.json();return Response.json({events:[{id:'agenda-test',title:'Compromisso fictício da agenda',start:date+'T14:00:00-03:00',end:date+'T14:30:00-03:00'}]});}if(path==='/calendar/events/day')return Response.json({events:[{id:'agenda-test',title:'Compromisso fictício da agenda',start:'2026-10-16T14:00:00-03:00',end:'2026-10-16T14:30:00-03:00'}]});if(path==='/chat')return Response.json({reply:'Resposta fictícia de teste.'});return Response.json({error:'mock boundary'}, {status:401});}};
const original=createLumiAtivaIntegration(backend,assets);
const withNews={fetch:async request=>{const path=new URL(request.url).pathname;if(path==='/noticias')return new Response(NEWS_HTML,{headers:{'content-type':'text/html'}});let r=await original.fetch(request);if(path==='/'){r=new Response((await r.text()).replace('</body>','<script src="/health-news-ui.js" defer></script></body>'),{headers:r.headers});}return r;}};
const fixture=`(()=>{let signedIn=false;const listeners=[];window.__setAuth=value=>{signedIn=value;for(const cb of listeners)cb(value?'SIGNED_IN':'SIGNED_OUT',value?{access_token:'synthetic-test-token'}:null);};window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:signedIn?{access_token:'synthetic-test-token'}:null}}),onAuthStateChange:cb=>{listeners.push(cb);return {data:{subscription:{unsubscribe(){}}}};},signOut:async()=>{window.__setAuth(false);return {};},signInWithOtp:async options=>{window.__authOptions=options;return {};},signInWithOAuth:async options=>{window.__authOptions=options;return {};}}})};})();`;
const browser=await chromium.launch({headless:true,...(process.env.LUMI_CHROMIUM_EXECUTABLE?{executablePath:process.env.LUMI_CHROMIUM_EXECUTABLE,args:["--no-sandbox","--disable-dev-shm-usage","--no-zygote"]}:{})});const results=[];
try{
for(const [name,width,height,mobile]of [['desktop',1440,900,false],['android-360',360,800,true],['android-393',393,851,true],['small-320',320,640,true],['landscape',800,360,true]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'}),page=await context.newPage();const errors=[];
 page.setDefaultTimeout(15000);console.log('Viewport scenario:',name);
 page.on('pageerror',e=>errors.push(e.message));let newer=false;
 const worker=withFrontendVersion(withNews,release);
 await context.route('**/*',async route=>{
  const url=route.request().url();
  if(new URL(url).pathname.endsWith('/supabase.js'))return route.fulfill({body:fixture,contentType:'application/javascript'});
  if(!url.startsWith(HOST))return route.abort();
  if(newer&&new URL(url).pathname==='/frontend-version')return route.fulfill({json:{release:'next-release',commit:'next'}});
  const request=route.request();const response=await worker.fetch(new Request(url,{method:request.method(),...(request.method()==='POST'?{body:request.postData()}:{}),headers:request.headers()}));
  return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 });
 if(name==='small-320')await page.addInitScript(()=>localStorage.setItem('companion-ai-v2','{corrupt'));
 await page.goto(HOST);await page.locator('#signInBtn').waitFor({state:'visible'});
 assert.equal(await page.locator('#chatForm').isVisible(),false);
 await page.locator('#signInBtn').focus();await page.keyboard.press('Enter');await page.locator('#lumiGoogleSignIn').waitFor({state:'visible'});assert.notEqual(await page.evaluate(()=>document.activeElement?.id),'lumiSignInEmail');assert.ok(await page.locator('#lumiGoogleSignIn').evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));await page.locator('#lumiSignInEmail').fill('synthetic@example.invalid');await page.getByRole('button',{name:'Enviar link',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.__authOptions.options.emailRedirectTo),HOST+'/');
 await page.getByRole('button',{name:'Continuar com Google',exact:true}).click();assert.equal(await page.evaluate(()=>window.__authOptions.options.redirectTo),HOST+'/');
 await page.evaluate(()=>window.__setAuth(true));await page.locator('#signOutBtn').waitFor({state:'visible'});await page.locator('#chatForm').waitFor({state:'visible'});
 await page.locator('#lumiGuideDialog').waitFor({state:'visible'});await page.locator('#lumiGuideDontShow').check();await page.getByRole('button',{name:'Começar a conversar',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('#messages .msg').length===6);
 await page.locator('#loadEarlierBtn').click();assert.equal(await page.locator('#messages .msg').count(),12);
 const geometry=await page.evaluate(()=>{const input=document.getElementById('messageInput').getBoundingClientRect(),send=document.querySelector('.send-button').getBoundingClientRect(),out=document.getElementById('signOutBtn');return {input:{bottom:input.bottom,top:input.top,width:input.width},send:{bottom:send.bottom,right:send.right},vw:innerWidth,vh:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,labelFits:out.scrollWidth<=out.clientWidth};});
 assert.equal(geometry.overflow,false,JSON.stringify({name,geometry}));assert.ok(geometry.input.bottom<=height+1&&geometry.input.top>=0&&geometry.input.width>40,JSON.stringify({name,geometry}));assert.ok(geometry.send.right<=width&&geometry.labelFits,JSON.stringify({name,geometry}));
 if(width<=900){await page.locator('#chatHistoryBtn').click();await page.locator('#lumiExerciseBtn').waitFor({state:'visible'});await page.locator('#lumiHealthNewsBtn').waitFor({state:'visible'});await page.locator('#lumiAgendaBtn').click();await page.locator('#lumiCalendarWeek').getByText('14:00 – 14:30 · Compromisso fictício da agenda',{exact:true}).waitFor();assert.ok(await page.locator('#lumiCalendarWeek').evaluate(n=>n.getBoundingClientRect().right<=innerWidth));await page.getByRole('button',{name:'Fechar agenda',exact:true}).click();await page.locator('#chatHistoryBtn').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#conversationSidebar').evaluate(n=>n.inert),true);}
 else{await page.locator('#lumiAgendaBtn').click();await page.locator('#lumiCalendarWeek').getByText('14:00 – 14:30 · Compromisso fictício da agenda',{exact:true}).waitFor();assert.ok(await page.locator('#lumiCalendarWeek').evaluate(n=>n.getBoundingClientRect().right<=innerWidth));await page.getByRole('button',{name:'Fechar agenda',exact:true}).click();await page.locator('#lumiExerciseBtn').waitFor({state:'visible'});await page.locator('#lumiHealthNewsBtn').waitFor({state:'visible'});}
 // A reduced visual viewport is a keyboard simulation, not real Android hardware.
 if(mobile&&height>500){await page.setViewportSize({width,height:400});await page.locator('#messageInput').fill('Rascunho preservado');const bottom=await page.locator('#messageInput').evaluate(n=>n.getBoundingClientRect().bottom);assert.ok(bottom<=401);await page.setViewportSize({width,height});}
 await page.screenshot({path:new URL('./test-results/'+name+'-authenticated.png',import.meta.url).pathname,fullPage:true});
 await page.locator('#messageInput').fill('Mensagem em edição');newer=true;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.locator('#lumiUpdateNotice').waitFor({state:'visible'});assert.ok(await page.locator('.send-button').evaluate(n=>{const r=n.getBoundingClientRect();return r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===n;}),'Update notice must not cover Send');await page.getByRole('button',{name:'Atualizar',exact:true}).click();assert.equal(await page.locator('#messageInput').inputValue(),'Mensagem em edição');
 await page.locator('#messageInput').fill('');await page.locator('#signOutBtn').click();await page.locator('#signInBtn').waitFor({state:'visible'});assert.equal(await page.locator('#chatForm').isVisible(),false);assert.equal(await page.locator('#messages .msg').count(),0);
 await page.reload();await page.locator('#signInBtn').waitFor({state:'visible'});assert.equal(await page.locator('#chatForm').isVisible(),false);
 assert.deepEqual(errors,[],name+' runtime errors');
 await page.screenshot({path:new URL('./test-results/'+name+'.png',import.meta.url).pathname,fullPage:true});
 results.push({name,width,height,passed:true,authentication:'synthetic session and redirect contracts',keyboard:mobile&&height>500?'reduced viewport simulation':'not tested',realAndroidHardware:false});await context.close();
}
}finally{await browser.close();fs.writeFileSync(new URL('./test-results/browser-results.json',import.meta.url),JSON.stringify(results,null,2));}
console.log(JSON.stringify({browser:'Playwright Chromium',results},null,2));
